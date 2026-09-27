import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Contención 26-sep-2026: la respuesta YA NO devuelve la liga. Solo sale por
// correo al buzón del alta. Devolver la liga permitía tomar cualquier cuenta
// (alta con el correo de la víctima → reenviar → password).

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

function correoHtml(alias: string, liga: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B16">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#137A56;font-weight:800">Sincrético · Casa Pepe</div>
    <h1 style="font-size:23px;margin:8px 0 10px">Hola ${esc(alias)}, te esperamos dentro</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Aquí está tu liga. Con ella generas tu contraseña y entras a tu cuenta, donde completas tu alta paso a paso: tu empresa, cómo te contactamos, tu seguro, cómo te pagamos y el acuerdo.</p>
    <p style="margin:0 0 20px"><a href="${liga}" style="display:inline-block;background:#137A56;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Generar mi contraseña y entrar</a></p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 6px">Ten a la mano, si los tienes: RFC, tu póliza de responsabilidad civil y los días y horarios de tus tours. Lo que te falte se llena después: se guarda lo que lleves.</p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Y recuerda: por ser operador de Sincrético te vuelves Ateneísta, con condiciones especiales en el coworking del Ateneo Turístico.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">Si no reconoces este correo, ignóralo. La liga es personal, no la compartas.</p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const email = String(b.email ?? "").trim().toLowerCase();
  if (!email) return json({ error: "falta el correo" }, 400);
  if (!RESEND) return json({ error: "falta RESEND_API_KEY" }, 500);

  const q = await rest(`tour_operador_altas?select=*&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`);
  if (!q.ok) return json({ error: "no se pudo leer el alta" }, 500);
  const alta = (await q.json())[0];
  // Misma respuesta exista o no el alta: no se confirma qué correos están registrados.
  if (!alta || alta.cuenta_creada_at) return json({ ok: true, email, mensaje: "Si hay un alta pendiente con ese correo, te llegará la liga." });

  // No más de un reenvío cada 10 minutos por alta.
  if (alta.correo_enviado_at && Date.now() - new Date(alta.correo_enviado_at).getTime() < 10 * 60 * 1000)
    return json({ ok: true, email, mensaje: "Ya te mandamos la liga hace un momento. Revisa tu correo, también la carpeta de spam." });

  const alias = String(alta.alias || alta.nombre || "").split(" ")[0];
  const liga = `${BASE}/alta-touroperador.html?t=${alta.token}`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject: `${alias}, tu acceso a Sincrético`, html: correoHtml(alias, liga) }),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 200);
    await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ correo_error: `resend ${r.status}: ${t}` }) });
    return json({ error: "no salió el correo" }, 500);
  }
  await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ correo_enviado_at: new Date().toISOString(), correo_error: null }) });
  return json({ ok: true, email, mensaje: "Te mandamos la liga a tu correo." });
});
