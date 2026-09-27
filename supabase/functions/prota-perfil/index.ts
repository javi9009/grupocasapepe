import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Contención 26-sep-2026: la liga del guía SOLO crea cuentas nuevas. Si el
// correo ya tiene cuenta, no se le cambia la contraseña (antes, un operador
// podía invitar a un "guía" con el correo de un empleado y tomarle la cuenta).

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "sincretico";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
async function admin(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function buscaUsuario(token: string) {
  const q = await rest(`tour_operador_usuarios?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
  if (!q.ok) return null;
  return (await q.json())[0] || null;
}

/* ojo: la liga es a op_experiencias, no a experiencias */
async function toursDe(protaId: string) {
  const q = await rest(`op_exp_protagonistas?select=op_experiencias(nombre)&protagonista_id=eq.${protaId}`);
  if (!q.ok) return [];
  const rows = await q.json();
  return rows.map((r: Record<string, { nombre?: string }>) => r.op_experiencias?.nombre).filter(Boolean);
}

async function subeFoto(dataUrl: string, id: string): Promise<string | null> {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const tipo = m[1], ext = m[2] === "jpeg" ? "jpg" : m[2];
  const bin = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
  if (bin.length > 5 * 1024 * 1024) return null;
  const ruta = `protagonistas/${id}.${ext}`;
  const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": tipo, "x-upsert": "true" },
    body: bin,
  });
  if (!r.ok) return null;
  return `${SB}/storage/v1/object/public/${BUCKET}/${ruta}?v=${Date.now()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const token = String(b.token ?? "").trim();
  if (!/^[a-f0-9]{20,}$/.test(token)) return json({ error: "falta la liga" }, 400);

  const u = await buscaUsuario(token);
  if (!u) return json({ error: "Esa liga ya no sirve. Pídele al operador que te la vuelva a mandar." }, 404);
  if (u.token_expira && new Date(u.token_expira) < new Date())
    return json({ error: "Esa liga ya venció. Pídele al operador que te la vuelva a mandar." }, 410);

  const accion = String(b.accion ?? "ver");

  if (accion === "ver") {
    return json({
      ok: true,
      nombre: u.nombre, email: u.email,
      foto_url: u.foto_url, instagram: u.instagram, descripcion: u.descripcion,
      tiene_cuenta: !!u.token_usado_at,
      tours: u.protagonista_id ? await toursDe(u.protagonista_id) : [],
    });
  }

  if (accion !== "guardar") return json({ error: "acción desconocida" }, 400);

  const desc = String(b.descripcion ?? "").trim();
  const ig = String(b.instagram ?? "").trim().replace(/^@/, "");
  const pass = String(b.password ?? "");
  const b64 = String(b.foto_b64 ?? "");
  let foto = String(b.foto_url ?? "").trim();

  if (!desc) return json({ error: "Escribe unas líneas contando quién eres." }, 400);
  if (pass && pass.length < 8) return json({ error: "La contraseña necesita al menos 8 caracteres." }, 400);
  if (pass && !u.email) return json({ error: "No tienes correo registrado, así que no puedes crear contraseña. Avísale al operador." }, 400);
  if (pass && u.token_usado_at) return json({ error: "Esta liga ya creó tu cuenta. Entra con tu contraseña." }, 409);

  if (b64) {
    const subida = await subeFoto(b64, u.id);
    if (!subida) return json({ error: "No pudimos guardar esa foto. Prueba con otra, o pega una liga." }, 400);
    foto = subida;
  }

  const up = await rest(`tour_operador_usuarios?id=eq.${u.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      foto_url: foto || null, descripcion: desc, instagram: ig ? "@" + ig : null,
      perfil_completo_at: new Date().toISOString(),
    }),
  });
  if (!up.ok) return json({ error: "no se pudo guardar tu ficha" }, 500);

  let entra = false;
  if (pass) {
    const email = String(u.email).toLowerCase();
    const r = await admin("admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { nombre: u.nombre, rol: "protagonista" } }),
    });
    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      if (/already|registered|exists/i.test(t)) {
        return json({
          ok: true, entra: false, email: u.email, foto_url: foto,
          aviso: "Tu ficha se guardó. Ese correo ya tiene cuenta en Casa Pepe: entra con tu contraseña de siempre o recupérala con \"olvidé mi contraseña\".",
          ya_existe: true,
        });
      }
      return json({ error: "tu ficha se guardó, pero la contraseña no" }, 500);
    }
    entra = true;
    await rest(`tour_operador_usuarios?id=eq.${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ token_usado_at: new Date().toISOString() }),
    });
  }

  return json({ ok: true, entra, email: u.email, foto_url: foto });
});
