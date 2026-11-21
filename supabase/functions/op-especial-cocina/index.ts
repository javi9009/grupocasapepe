// op-especial-cocina — avisa a cocina de un servicio especial.
//
// Javi, 20-nov-2026: «cuando terminan de editar el servicio, un boton que sea
// Enviar a cocina, y se envia al mail de azotea@casapepe y a hola.puebla como
// "nuevo servicio especial de Capital Bus"».
//
// Por que existe: el servicio especial se programaba en la pantalla y cocina
// se enteraba por WhatsApp, o no se enteraba. Lo que incluye un servicio -los
// tacos, las cervezas, el luchador- es justo lo que tiene que leer quien
// cocina, y vivia solo en un campo de texto que nadie fuera de la pantalla
// abria.
//
// Quien puede mandarlo: el equipo de la casa y el touroperador DUENO del
// servicio. Es su servicio y la cocina tiene que saberlo; los destinatarios
// son fijos y de la casa, no los elige quien llama.
//
// Entrada: { dado_id }  ·  Salida: { ok, enviado_a }
import { quienLlama } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY");
const COCINA = ["azotea@casapepe.mx", "hola.puebla@casapepe.mx"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const api = (p: string) =>
  fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);
const pesos = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function dia(f: string | null): string {
  if (!f) return "—";
  const p = String(f).slice(0, 10).split("-");
  return `${+p[2]} de ${MES[+p[1] - 1]}`;
}
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const q = await quienLlama(req);
    if (!q.jwt) return J({ ok: false, error: "Hay que entrar con tu cuenta." }, 401);

    const body = await req.json().catch(() => ({}));
    const id = String(body.dado_id || "");
    if (!id) return J({ ok: false, error: "Falta el servicio" }, 400);

    const [d] = await api(`op_servicios_dados?id=eq.${id}&select=*`);
    if (!d) return J({ ok: false, error: "No encuentro ese servicio" }, 404);

    // Del equipo, o del touroperador dueno.
    if (!q.equipo) {
      const mio = await api(
        `tour_operador_usuarios?operador_id=eq.${d.operador_id}&user_id=eq.${q.uid}&select=operador_id&limit=1`);
      if (!mio.length) return J({ ok: false, error: "Este servicio no es tuyo." }, 403);
    }

    const [op] = await api(`tour_operadores?id=eq.${d.operador_id}&select=nombre_comercial`);
    const [sv] = d.servicio_id
      ? await api(`op_servicios?id=eq.${d.servicio_id}&select=nombre,unidad,incluye`)
      : [null];
    const [sal] = d.salida_id
      ? await api(`sinc_salidas?id=eq.${d.salida_id}&select=hora,punto_encuentro`)
      : [null];

    const cliente = op?.nombre_comercial || "un touroperador";
    const nombre = sv?.nombre || "Servicio especial";
    const pax = Number(d.personas || 0);
    const neto = Number(d.precio_neto || 0) * (String(sv?.unidad || "").startsWith("grupo") ? 1 : pax);
    const hora = sal?.hora ? String(sal.hora).slice(0, 5) : null;
    const incluye = String(sv?.incluye || "").trim();
    const nota = String(d.nota || "").trim();

    // LA CESTA, LINEA POR LINEA. Un total no se puede cocinar: lo que cocina
    // necesita es «60 tacos de pastor, 20 cervezas».
    const cesta: Array<{ nombre?: string; cant?: number }> = Array.isArray(d.cesta) ? d.cesta : [];
    const cestaHtml = cesta.length
      ? `<p style="margin:14px 0 4px"><b>La cesta</b></p>
         <table style="border-collapse:collapse;font-size:15px">${
           cesta.map((p) =>
             `<tr><td style="padding:2px 12px 2px 0"><b>${Number(p.cant) || 0}</b></td><td>${esc(p.nombre)}</td></tr>`)
             .join("")}</table>`
      : "";
    const luchHtml = d.requiere_luchador
      ? `<p style="margin:14px 0 0;background:#fbf0dc;border-left:4px solid #c79a2e;padding:10px 13px">
         <b>Requiere servicio de luchador.</b> Hay que tenerlo apalabrado para ese dia y esa hora.</p>`
      : "";

    if (!RESEND) return J({ ok: false, error: "sin RESEND_API_KEY" }, 500);
    const html = `<div style="font-family:Georgia,serif;font-size:15px;color:#20201e;line-height:1.55">
      <p style="font-size:17px;margin:0 0 14px"><b>${esc(nombre)}</b> para <b>${esc(cliente)}</b></p>
      <table style="border-collapse:collapse;font-size:15px">
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Dia</td><td><b>${dia(d.fecha)}</b>${hora ? ` a las <b>${esc(hora)}</b>` : ""}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Personas</td><td><b>${pax}</b></td></tr>
        ${sal?.punto_encuentro ? `<tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Donde</td><td>${esc(sal.punto_encuentro)}</td></tr>` : ""}
      </table>
      ${cestaHtml}
      ${incluye ? `<p style="margin:14px 0 4px"><b>Lo que lleva</b></p><div style="background:#f6f3ec;border-left:4px solid #1f4d36;padding:10px 13px;white-space:pre-line">${esc(incluye)}</div>` : ""}
      ${luchHtml}
      ${nota ? `<p style="margin:14px 0 4px"><b>Ojo</b></p><div style="background:#fbf0dc;border-left:4px solid #c79a2e;padding:10px 13px;white-space:pre-line">${esc(nota)}</div>` : ""}
      <p style="margin:16px 0 0;color:#6b6b63;font-size:13px">Se factura al touroperador: ${pesos(neto)} sin IVA.
      Si algo de aqui no se puede dar tal cual, dilo hoy y se ajusta antes de que llegue la gente.</p>
      <p style="margin:10px 0 0;color:#6b6b63;font-size:13px">Lo mando ${esc(q.email)} desde la programacion de Sincretico.</p></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Sincretico <no-reply@casapepe.mx>",
        to: COCINA,
        reply_to: q.email && q.email.includes("@") ? q.email : "hola.puebla@casapepe.mx",
        subject: `Nuevo servicio especial de ${cliente} · ${dia(d.fecha)}${hora ? " · " + hora : ""} · ${pax} personas`,
        html,
      }),
    });
    if (!r.ok) return J({ ok: false, error: await r.text() }, 500);

    await fetch(`${SB}/rest/v1/op_servicios_dados?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ cocina_avisada_at: new Date().toISOString() }),
    }).catch(() => {});

    return J({ ok: true, enviado_a: COCINA });
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
