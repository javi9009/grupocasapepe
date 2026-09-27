import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Contención 26-sep-2026: la liga solo se devuelve en la respuesta cuando el
// guía NO tiene correo (se le manda por WhatsApp). Si hay correo, va por correo.

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("SINCRETICO_FROM") || "Sincrético · Casa Pepe <javi@casapepe.mx>";
const BASE = Deno.env.get("SINCRETICO_BASE_URL") || "https://grupocasapepe.netlify.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function restComoElUsuario(path: string, auth: string) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: auth, "Content-Type": "application/json" },
  });
}

function correoHtml(alias: string, liga: string, tours: string[]) {
  const lista = tours.length
    ? `<p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Vas a salir publicado en: <b>${tours.map(esc).join(", ")}</b>.</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B16">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#137A56;font-weight:800">Sincrético · Casa Pepe</div>
    <h1 style="font-size:23px;margin:8px 0 10px">${esc(alias)}, eres el guía</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Te dieron de alta como guía de un tour: eres la persona que los viajeros van a conocer. Lo que escribas aquí es lo que ellos leen antes de reservar.</p>
    ${lista}
    <p style="margin:0 0 20px"><a href="${liga}" style="display:inline-block;background:#137A56;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Subir mi foto y crear mi contraseña</a></p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Te va a pedir tres cosas: una foto tuya en la que te reconozcan, unas líneas contando quién eres, y tu Instagram si quieres que te sigan. Después creas tu contraseña y entras a ver tus salidas.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">Si no reconoces este correo, ignóralo. La liga es personal, no la compartas.</p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth) return json({ error: "sin sesión" }, 401);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const expId = String(b.experiencia_id ?? "").trim();
  const nombre = String(b.nombre ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!expId) return json({ error: "falta la experiencia" }, 400);
  if (!nombre) return json({ error: "el guía necesita un nombre" }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "ese correo no se ve bien" }, 400);

  const qe = await restComoElUsuario(`v_op_experiencias?select=id,nombre,operador_id&id=eq.${expId}&limit=1`, auth);
  if (!qe.ok) return json({ error: "no se pudo leer la experiencia" }, 500);
  const exp = (await qe.json())[0];
  if (!exp) return json({ error: "esa experiencia no es tuya" }, 403);

  if (email) {
    const yq = await rest(`tour_operador_usuarios?select=id,protagonista_id,rol&operador_id=eq.${exp.operador_id}&email=eq.${encodeURIComponent(email)}&limit=1`);
    const ya = yq.ok ? (await yq.json())[0] : null;
    if (ya) return json({ error: "ya hay alguien de tu equipo con ese correo", usuario_id: ya.id, protagonista_id: ya.protagonista_id }, 409);
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const expira = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const ins = await rest("tour_operador_usuarios", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      operador_id: exp.operador_id, nombre, email: email || null, rol: "guia",
      descripcion: (b.descripcion as string) || null, instagram: (b.instagram as string) || null,
      foto_url: (b.foto_url as string) || null,
      token, token_expira: expira, invitado_at: email ? new Date().toISOString() : null,
    }),
  });
  if (!ins.ok) return json({ error: "no se pudo crear al guía" }, 500);
  const u = (await ins.json())[0];

  if (u.protagonista_id) {
    await rest("op_exp_protagonistas", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ experiencia_id: expId, protagonista_id: u.protagonista_id }),
    });
  }

  const liga = `${BASE}/protagonista.html?t=${token}`;
  // Sin correo: la liga se comparte por WhatsApp, así que sí se devuelve.
  if (!email) return json({ ok: true, usuario_id: u.id, protagonista_id: u.protagonista_id, liga, correo: false });
  if (!RESEND) return json({ ok: true, usuario_id: u.id, protagonista_id: u.protagonista_id, correo: false, aviso: "falta RESEND_API_KEY" });

  const alias = nombre.split(" ")[0];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject: `${alias}, eres guía en Sincrético`, html: correoHtml(alias, liga, [exp.nombre]) }),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 200);
    await rest(`tour_operador_usuarios?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ invitacion_error: `resend ${r.status}: ${t}` }) });
    return json({ ok: true, usuario_id: u.id, protagonista_id: u.protagonista_id, correo: false, aviso: "se creó, pero el correo no salió: " + t });
  }
  await rest(`tour_operador_usuarios?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ invitacion_error: null }) });
  return json({ ok: true, usuario_id: u.id, protagonista_id: u.protagonista_id, correo: true });
});
