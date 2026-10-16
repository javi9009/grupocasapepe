/* Avisa por correo de cada reserva de Sincretico. Javi, 15-oct-2026.
   Lo dispara el trigger sinc_reservas_avisa_t al insertar la reserva, y
   tambien la solicitud de devolucion del huesped, con otro asunto.
   Sin JWT: lo llama la base. Exige el secreto compartido de
   privado.tokens_integracion, o la service role. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sinc-aviso",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const pesos = (n: unknown) => "$" + Math.round(Number(n ?? 0)).toLocaleString("es-MX");

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  let b: any = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { ok: r.ok, status: r.status, body: b };
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(f: string | null) {
  if (!f) return "sin fecha";
  const p = String(f).split("-");
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  const dd = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][d.getDay()];
  return `${dd} ${+p[2]} de ${MESES[+p[1] - 1]}`;
}

async function destinatarios(): Promise<string[]> {
  const c = await sb(`sinc_config?select=valor&clave=eq.avisos_reserva_correos&limit=1`);
  const v = String(c.body?.[0]?.valor ?? "").trim();
  return v ? v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const sec = req.headers.get("x-sinc-aviso") ?? "";
  if (auth !== SRK) {
    const t = await sb(`rpc/sinc_token_aviso`, { method: "POST", body: "{}" });
    const esperado = typeof t.body === "string" ? t.body : (t.body?.token ?? "");
    if (!sec || !esperado || sec !== esperado) return json({ error: "No autorizado" }, 403);
  }

  try {
    const { reserva_id, motivo } = await req.json();
    if (!reserva_id) return json({ error: "falta reserva_id" }, 400);

    const r = await sb(`v_sinc_portal?select=*&id=eq.${encodeURIComponent(reserva_id)}&limit=1`);
    const x = r.body?.[0];
    if (!x) return json({ ok: false, aviso: "esa reserva no existe" });

    const para = await destinatarios();
    if (!para.length) return json({ ok: true, correo: false, aviso: "sin destinatarios configurados" });
    if (!RESEND) return json({ ok: true, correo: false, aviso: "sin RESEND_API_KEY" });

    const cfg = await sb(`sinc_config?select=valor&clave=eq.url_publica&limit=1`);
    const base = String(cfg.body?.[0]?.valor || "https://grupocasapepe.netlify.app").replace(/\/+$/, "");
    const liga = `${base}/m/sinc-operacion.html?r=${encodeURIComponent(x.id)}`;

    const dev = motivo === "reembolso";
    const dela = !x.touroperadora || x.touroperadora === "Sincretico";
    const cuando = fechaLarga(x.fecha_salida) + (x.hora_salida ? ` a las ${String(x.hora_salida).slice(0, 5)}` : "");

    const filas: Array<[string, string]> = [
      ["Tour", String(x.tour ?? "-") + (dela ? " - de la casa" : ` - ${x.touroperadora}`)],
      ["Cuando", cuando],
      ["Quien", String(x.huesped ?? "-")],
      ["Personas", String(x.pax ?? 0)],
      ["Paga", pesos(x.total)],
      ["Canal", String(x.canal ?? "-")],
      ["Folio", String(x.folio ?? "-")],
    ];
    if (x.email) filas.push(["Correo", String(x.email)]);
    if (x.telefono) filas.push(["Telefono", String(x.telefono)]);
    if (x.hotel) filas.push(["Hotel", String(x.hotel)]);
    if (x.anfitrion) filas.push(["Anfitrion", String(x.anfitrion)]);
    if (dev && x.notas) filas.push(["Lo que dice", String(x.notas).split("\n").slice(-1)[0]]);

    const titulo = dev ? "Pide que le devolvamos su tour" : "Nueva reserva";
    const bajada = dev
      ? `${esc(x.huesped ?? "")} pidio la devolucion desde su boleto. Hay que mirar que se gasto ya (boletos, apartados, alimentos, nomina) y devolverle lo que todavia se pueda liberar.`
      : `Entro una reserva${dela ? " de un tour nuestro" : ""}.`;

    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1F1B16;max-width:520px">
        <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6B6459;margin:0 0 6px">Sincretico - Casa Pepe</p>
        <h2 style="margin:0 0 4px;font-size:21px">${esc(titulo)}</h2>
        <p style="margin:0 0 16px;color:#6B6459">${bajada}</p>
        <table style="border-collapse:collapse;width:100%">
          ${filas.map(([k, v]) => `<tr><td style="padding:5px 10px 5px 0;color:#6B6459;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}
        </table>
        <p style="margin:22px 0"><a href="${esc(liga)}" style="background:#C9501A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Abrir la reserva</a></p>
        <p style="color:#A49B8C;font-size:12px">Este aviso sale solo, en cuanto entra la reserva. Para cambiar a quien le llega, la clave es <b>avisos_reserva_correos</b> en sinc_config.</p>
      </div>`;

    const asunto = dev
      ? `Devolucion pedida - ${x.tour ?? "Sincretico"} - ${x.folio ?? ""}`
      : `Reserva - ${x.tour ?? "Sincretico"} - ${fechaLarga(x.fecha_salida)} - ${x.pax ?? 0} pax`;

    const env = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Sincretico <no-reply@casapepe.mx>", to: para, subject: asunto, html }),
    });

    return json({ ok: true, correo: env.ok, para, detalle: env.ok ? null : (await env.text()).slice(0, 300) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
