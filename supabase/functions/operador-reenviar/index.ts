import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { marco, remitente, respondeA } from "./correo.ts";

// Contención 26-sep-2026: la respuesta YA NO devuelve la liga. Solo sale por
// correo al buzón del alta. Devolver la liga permitía tomar cualquier cuenta
// (alta con el correo de la víctima → reenviar → password).

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
/* El remitente y el «responder a» los decide la marca, no esta función: así los
   correos de Sincrético se parecen entre sí y no acaban saliendo de un correo
   personal. Javi, 10-oct-2026. */
const FROM = remitente("sincretico");
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
  return marco({
    marca: "sincretico",
    avance: "Tu liga para crear la contraseña y terminar el alta. Es personal y solo sirve una vez.",
    saludo: alias || null,
    titulo: "Aquí entras a Sincrético",
    cuerpo: [
      "Sincrético es la marca de experiencias de Grupo Casa Pepe: a través de ella vendemos tours a los huéspedes de nuestros hoteles y a quien llega por nuestra web. Te escribimos porque diste de alta tu touroperadora con nosotros y falta el último paso.",
      "Con el botón de abajo <b>creas tu contraseña y entras a tu cuenta</b>. Dentro vas completando tu alta a tu ritmo: tu empresa, cómo te contactamos, tu seguro, cómo te pagamos y el acuerdo. <b>Se guarda lo que lleves</b>, así que puedes dejarlo a medias y volver.",
    ],
    boton: { texto: "Crear mi contraseña y entrar", liga },
    nota: "Ten a la mano, si los tienes: <b>RFC</b>, tu <b>póliza de responsabilidad civil</b> y los <b>días y horarios</b> de tus tours. Lo que te falte lo llenas después — nada de esto te frena para empezar.",
    despues: "Al terminar, tus experiencias pasan a revisión y te avisamos en cuanto queden publicadas. Y por ser operador de Sincrético te vuelves <b>Ateneísta</b>: tienes condiciones especiales en el coworking del Ateneo de Virreyes.",
  });
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
    body: JSON.stringify({
      from: FROM, to: [email], reply_to: respondeA("sincretico"),
      subject: alias ? `${alias}, aquí entras a Sincrético` : "Aquí entras a Sincrético",
      html: correoHtml(alias, liga),
    }),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 200);
    await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ correo_error: `resend ${r.status}: ${t}` }) });
    return json({ error: "no salió el correo" }, 500);
  }
  await rest(`tour_operador_altas?id=eq.${alta.id}`, { method: "PATCH", body: JSON.stringify({ correo_enviado_at: new Date().toISOString(), correo_error: null }) });
  return json({ ok: true, email, mensaje: "Te mandamos la liga a tu correo." });
});
