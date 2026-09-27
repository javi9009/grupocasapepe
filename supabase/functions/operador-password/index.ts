import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Contención 26-sep-2026: una liga de alta SOLO crea cuentas nuevas. Si el
// correo ya tiene cuenta en el grupo, no se le toca la contraseña: la persona
// entra con la suya o la recupera por correo ("olvidé mi contraseña"), que sí
// prueba que el buzón es suyo. Antes, cualquiera que consiguiera una liga con
// el correo de otra persona le cambiaba la contraseña.

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function slugify(s: string) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "operador";
}
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const token = String(b.token ?? "").trim();
  const pass = String(b.password ?? "");
  if (!/^[a-f0-9]{20,}$/.test(token)) return json({ error: "liga inválida" }, 400);
  if (pass.length < 8) return json({ error: "la contraseña necesita al menos 8 caracteres" }, 400);

  const q = await rest(`tour_operador_altas?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
  if (!q.ok) return json({ error: "no se pudo leer el alta" }, 500);
  const alta = (await q.json())[0];
  if (!alta) return json({ error: "esa liga ya no sirve" }, 404);
  if (alta.cuenta_creada_at) return json({ error: "Esa liga ya se usó. Entra con tu contraseña.", ya_existe: true, email: alta.email }, 409);
  if (alta.estado === "descartada") return json({ error: "esa liga ya no sirve" }, 410);

  const suyo = String(b.email ?? "").trim().toLowerCase();
  const email = (alta.email ? String(alta.email) : suyo).toLowerCase();
  if (!CORREO.test(email)) return json({ error: "falta_correo", detalle: "Necesitamos tu correo para crear la cuenta." }, 400);
  if (!alta.email) await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ email }) });

  const nombreCompleto = [alta.nombre, alta.apellidos].filter(Boolean).join(" ").trim() || email;

  // PRIMERO la cuenta de acceso, DESPUES el operador (Javi, 22-sep).
  const cu = await admin("admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { nombre: nombreCompleto, tipo: "touroperador" } }),
  });
  if (!cu.ok) {
    const t = (await cu.text()).slice(0, 300);
    if (/already|registered|exists/i.test(t)) {
      return json({
        error: "Ese correo ya tiene cuenta en Casa Pepe. Entra con tu contraseña de siempre (o recupérala con \"olvidé mi contraseña\") y escríbenos a javi@casapepe.mx para enlazar tu alta de operador.",
        ya_existe: true, email,
      }, 409);
    }
    return json({ error: "no se pudo crear la cuenta" }, 500);
  }

  // el operador: el que ya traiga el alta, o uno nuevo en borrador
  let operadorId: string | null = alta.operador_id ?? null;
  if (!operadorId) {
    const base = slugify(String(alta.alias || alta.nombre || "operador"));
    let creado: Response | null = null;
    let slug = base;
    for (let i = 0; i < 6; i++) {
      slug = i === 0 ? base : `${base}-${i + 1}`;
      creado = await rest("tour_operadores", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          slug,
          nombre_comercial: String(alta.alias || alta.nombre || "Operador").trim(),
          email,
          email_notificaciones: email,
          whatsapp: alta.celular ?? null,
          estado: "borrador",
          forma_pago: "stripe_connect",
          comision_pct: 25,
        }),
      });
      if (creado.ok) break;
      const t = await creado.clone().text();
      if (!/23505/.test(t)) return json({ error: "no se pudo crear el operador" }, 500);
    }
    if (!creado || !creado.ok) return json({ error: "no se pudo crear el operador" }, 500);
    operadorId = (await creado.json())[0].id;
  }

  const yaU = await rest(`tour_operador_usuarios?select=id&operador_id=eq.${operadorId}&email=eq.${encodeURIComponent(email)}&limit=1`);
  const existeU = yaU.ok ? (await yaU.json())[0] : null;
  if (existeU) {
    await rest(`tour_operador_usuarios?id=eq.${existeU.id}`, { method: "PATCH", body: JSON.stringify({ activo: true, rol: "coordinador" }) });
  } else {
    await rest("tour_operador_usuarios", {
      method: "POST",
      body: JSON.stringify({ operador_id: operadorId, nombre: nombreCompleto, email, whatsapp: alta.celular ?? null, rol: "coordinador", activo: true }),
    });
  }

  const op = await rest(`tour_operadores?select=estado,email,email_notificaciones,whatsapp&id=eq.${operadorId}&limit=1`);
  const o = op.ok ? (await op.json())[0] : null;
  if (o) {
    const cambios: Record<string, unknown> = {};
    if (o.estado === "alta_pendiente_usuario") cambios.estado = "borrador";
    if (!o.email) cambios.email = email;
    if (!o.email_notificaciones) cambios.email_notificaciones = email;
    if (!o.whatsapp && alta.celular) cambios.whatsapp = alta.celular;
    if (Object.keys(cambios).length)
      await rest(`tour_operadores?id=eq.${operadorId}`, { method: "PATCH", body: JSON.stringify(cambios) });
  }

  const ahora = new Date().toISOString();
  const pa = await rest(`tour_operador_altas?id=eq.${alta.id}`, {
    method: "PATCH",
    body: JSON.stringify({ operador_id: operadorId, estado: "convertida", cuenta_creada_at: ahora, atendida_at: ahora }),
  });
  if (!pa.ok) {
    await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ operador_id: operadorId, cuenta_creada_at: ahora }) });
  }

  return json({ ok: true, email, operador_id: operadorId });
});
