// La gente de recepción que vende Sincrético.
//
// Tres momentos, tres acciones:
//   invitar  — alguien de casa (o quien manda en el hotel) la da de alta y le
//              manda su liga. El permiso lo contesta la base con el JWT de
//              quien llama, no este archivo.
//   ver      — la liga abre y dice de quién es, para que no se ponga la
//              contraseña de otro por error.
//   password — se crea su cuenta de acceso y la liga se quema.
//
// Aquí no se guarda ninguna contraseña: se la pasamos a Supabase y se olvida.
//
// Contención 26-sep-2026: (1) la respuesta de invitar/reenviar ya no devuelve
// la liga, solo va por correo; (2) la liga SOLO crea cuentas nuevas: si el
// correo ya tiene cuenta, no se le cambia la contraseña.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB   = Deno.env.get("SUPABASE_URL")!;
const SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM   = Deno.env.get("SINCRETICO_FROM") || "Sincrético <javi@casapepe.mx>";
const REPLY  = Deno.env.get("SINCRETICO_REPLY_TO") || "javi@casapepe.mx";
const BASE   = Deno.env.get("SINCRETICO_BASE_URL") || "https://grupocasapepe.netlify.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

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
/* El permiso lo decide la base con el JWT de quien llama. */
async function comoElQueLlama(jwt: string, fn: string, cuerpo: unknown) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON || SRK, Authorization: jwt, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const t = await r.text();
  let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { /* texto plano */ }
  return { ok: r.ok, status: r.status, j, t };
}

const marco = (cuerpo: string) =>
  `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B16">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#137A56;font-weight:800">Sincrético</div>
    ${cuerpo}
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #E2DCCF;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#A49B8C;font-weight:600">Una empresa de Grupo Casa Pepe</div>
  </div></body></html>`;

function correoInvitacion(alias: string, hotel: string, codigo: string, liga: string) {
  return marco(`
    <h1 style="font-size:23px;margin:8px 0 10px">${esc(alias)}, ya puedes vender experiencias</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 14px">Desde la recepción de ${esc(hotel)} vas a poder vender los tours de Sincrético a tus huéspedes. Cada venta tuya te deja una comisión, y el huésped puede dejarte propina.</p>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Tu código de venta es <b style="font-family:ui-monospace,monospace">${esc(codigo)}</b>. Va dentro de tu QR: cuando un huésped lo escanea y compra desde su teléfono, esa venta es tuya aunque la pague tres horas después.</p>
    <p style="margin:0 0 20px"><a href="${liga}" style="display:inline-block;background:#137A56;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Poner mi contraseña y entrar</a></p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Adentro tienes el catálogo, tu QR, lo que llevas vendido y lo que te toca cobrar.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">La liga es personal y caduca en 30 días. No la compartas.</p>`);
}

async function enviar(to: string, asunto: string, html: string) {
  if (!RESEND) return { ok: false, error: "falta RESEND_API_KEY" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: asunto, html, reply_to: REPLY || undefined }),
  });
  if (!r.ok) return { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }
  const accion = String(b.accion ?? "").trim();

  // ---- invitar: la da de alta quien tiene permiso, y le llega su liga ------
  if (accion === "invitar" || accion === "reenviar") {
    const jwt = req.headers.get("Authorization") ?? "";
    if (!jwt.startsWith("Bearer ")) return json({ error: "Hay que entrar con tu usuario" }, 401);

    let fila: any = null;
    if (accion === "invitar") {
      const r = await comoElQueLlama(jwt, "hotel_colaborador_alta", {
        p_hotel: b.hotel_id, p_nombre: b.nombre, p_email: b.email,
        p_rol: b.rol ?? "concierge", p_com_pct: b.com_pct ?? null, p_whatsapp: b.whatsapp ?? null,
      });
      if (!r.ok) return json({ error: r.j?.message ?? r.j?.hint ?? r.t.slice(0, 200) }, r.status);
      fila = r.j;
    } else {
      const r = await comoElQueLlama(jwt, "hotel_colaborador_token", { p_id: b.id });
      if (!r.ok) return json({ error: r.j?.message ?? r.j?.hint ?? r.t.slice(0, 200) }, r.status);
      const q = await rest(`hotel_usuarios?select=*&id=eq.${encodeURIComponent(String(b.id))}&limit=1`);
      fila = q.ok ? (await q.json())[0] : null;
    }
    if (!fila?.token) return json({ error: "No se pudo generar la liga" }, 500);

    const h = await rest(`hoteles?select=nombre_comercial&id=eq.${fila.hotel_id}&limit=1`);
    const hotel = h.ok ? ((await h.json())[0]?.nombre_comercial ?? "tu hotel") : "tu hotel";
    const alias = String(fila.nombre).trim().split(" ")[0];
    const liga = `${BASE}/concierge-acceso.html?t=${fila.token}`;

    const env = await enviar(String(fila.email),
      `${alias}, tu acceso a Sincrético`,
      correoInvitacion(alias, hotel, String(fila.codigo_venta ?? ""), liga));

    // La liga solo se devuelve si el correo no salió, para que quien invita
    // (ya autorizado por la base) se la pase a mano. Ya no puede tomar cuentas:
    // la liga solo crea cuentas nuevas.
    return json({ ok: true, id: fila.id, codigo_venta: fila.codigo_venta,
                  correo: env.ok, motivo: env.ok ? null : env.error, liga: env.ok ? undefined : liga });
  }

  // ---- ver / password: los abre la propia persona, con su liga -------------
  const token = String(b.token ?? "").trim();
  if (!/^[a-f0-9]{20,}$/.test(token)) return json({ error: "Esa liga no se ve bien" }, 400);

  const q = await rest(`hotel_usuarios?select=id,nombre,email,rol,codigo_venta,hotel_id,token_expira,token_usado_at,activo&token=eq.${encodeURIComponent(token)}&limit=1`);
  if (!q.ok) return json({ error: "No se pudo leer la liga" }, 500);
  const u = (await q.json())[0];
  if (!u) return json({ error: "Esa liga ya no sirve. Pídele otra a quien te dio de alta." }, 404);
  if (!u.activo) return json({ error: "Esa cuenta está dada de baja." }, 409);
  if (u.token_expira && new Date(u.token_expira) < new Date())
    return json({ error: "Esa liga caducó. Pídele otra a quien te dio de alta." }, 410);

  const h = await rest(`hoteles?select=nombre_comercial&id=eq.${u.hotel_id}&limit=1`);
  const hotel = h.ok ? ((await h.json())[0]?.nombre_comercial ?? "") : "";

  if (accion === "ver") {
    return json({ ok: true, nombre: u.nombre, email: u.email, hotel,
                  codigo_venta: u.codigo_venta, ya_usada: !!u.token_usado_at });
  }

  if (accion !== "password") return json({ error: "Acción desconocida" }, 400);

  const pass = String(b.password ?? "");
  if (pass.length < 8) return json({ error: "La contraseña necesita al menos 8 caracteres" }, 400);

  const meta = { nombre: u.nombre, tipo: "concierge", hotel_id: u.hotel_id };
  const cu = await admin("admin/users", {
    method: "POST",
    body: JSON.stringify({ email: u.email, password: pass, email_confirm: true, user_metadata: meta }),
  });

  if (!cu.ok) {
    const t = (await cu.text()).slice(0, 300);
    if (!/already|registered|exists/i.test(t)) return json({ error: "No se pudo crear la cuenta" }, 500);
    /* Ya tenía cuenta en el grupo. La liga NO prueba que el buzón sea suyo (la
       manda quien invita), así que no se toca su contraseña: entra con la suya
       o la recupera por correo. Su alta como concierge queda lista igual. */
    await rest(`hotel_usuarios?id=eq.${u.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ token_usado_at: new Date().toISOString(), token: null }),
    });
    return json({
      ok: true, ya_existe: true, email: u.email, nombre: u.nombre, hotel, codigo_venta: u.codigo_venta,
      aviso: "Ese correo ya tiene cuenta en Casa Pepe. Entra con tu contraseña de siempre o recupérala con \"olvidé mi contraseña\".",
    });
  }

  await rest(`hotel_usuarios?id=eq.${u.id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ token_usado_at: new Date().toISOString(), token: null }),
  });

  return json({ ok: true, email: u.email, nombre: u.nombre, hotel, codigo_venta: u.codigo_venta });
});
