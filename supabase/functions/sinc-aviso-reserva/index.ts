/* Avisa por correo de cada reserva de Sincretico. Javi, 15-oct-2026.
   Lo dispara el trigger sinc_reservas_avisa_t al insertar la reserva, la
   solicitud de devolucion del huesped, y sinc_reserva_mueve cuando una
   reserva cambia de dia. Cada motivo tiene su asunto y su reparto.
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

/* A QUIEN LE LLEGA CADA RESERVA. Javi (de parte de Aranza), 19-oct-2026:
   "cada vez que se reserve un tour se tiene que mandar el correo a la
   persona del hotel donde el cliente reservo". Antes solo salia a una lista
   fija: el hotel donde duerme el huesped no se enteraba, y la touroperadora
   que opera el tour tampoco. Ahora el aviso se arma por reserva:

     1. el buzon de la casa      - sinc_config.avisos_reserva_correos
     2. el hotel del huesped     - hoteles.email_notificaciones
     3. la touroperadora         - tour_operadores.email_notificaciones

   El cuarto destinatario -el cliente- no va aqui: a el le llega su boleto
   con el QR, que es otro correo y otra cosa. Mandarle este, que lleva el
   boton de "Abrir la reserva" del panel, seria ensenarle la cocina.

   Si un correo falta, se sigue sin el: un aviso a medias llega; uno que
   revienta, no. */
async function destinatarios(reservaId: string, conGuias = false): Promise<{ para: string[]; quien: string[] }> {
  const para: string[] = [];
  const quien: string[] = [];
  const mete = (correo: unknown, etiqueta: string) => {
    const e = String(correo ?? "").trim();
    if (!e || !e.includes("@")) return;
    if (para.some((y) => y.toLowerCase() === e.toLowerCase())) return;
    para.push(e); quien.push(`${etiqueta}: ${e}`);
  };

  const c = await sb(`sinc_config?select=valor&clave=eq.avisos_reserva_correos&limit=1`);
  String(c.body?.[0]?.valor ?? "").split(/[,;\s]+/).forEach((x) => mete(x, "casa"));

  const rr = await sb(`sinc_reservas?select=hotel_id,op_experiencia_id&id=eq.${encodeURIComponent(reservaId)}&limit=1`);
  const fila = rr.body?.[0] ?? {};

  if (fila.hotel_id) {
    const h = await sb(`hoteles?select=nombre_comercial,email_notificaciones,email&id=eq.${encodeURIComponent(fila.hotel_id)}&limit=1`);
    const hh = h.body?.[0];
    if (hh) mete(hh.email_notificaciones || hh.email, `hotel ${hh.nombre_comercial ?? ""}`.trim());
  }

  if (fila.op_experiencia_id) {
    const o = await sb(`op_experiencias?select=operador_id,tour_id&id=eq.${encodeURIComponent(fila.op_experiencia_id)}&limit=1`);
    const opid = o.body?.[0]?.operador_id;
    const tourId = o.body?.[0]?.tour_id;
    if (opid) {
      const t = await sb(`tour_operadores?select=nombre_comercial,email_notificaciones,email,recibe_reservas&id=eq.${encodeURIComponent(opid)}&limit=1`);
      const tt = t.body?.[0];
      /* recibe_reservas en false es una decision del operador, no un olvido */
      if (tt && tt.recibe_reservas !== false) {
        mete(tt.email_notificaciones || tt.email, `operador ${tt.nombre_comercial ?? ""}`.trim());
      }
    }

    /* EL GUIA SE ENTERA DEL CAMBIO. Javi, 19-oct-2026: "debes notificar al
       guia del cambio de reserva". Quien se presenta en el punto de encuentro
       es el. Se busca por el tour: la experiencia cuelga de un tour y el tour
       tiene su padron de guias; a quien se dio de baja no se le escribe. */
    if (conGuias && tourId) {
      const tg = await sb(`tour_guia?select=guia_id,principal&tour_id=eq.${encodeURIComponent(tourId)}`);
      const ids = (tg.body ?? []).map((y: any) => y.guia_id).filter(Boolean);
      if (ids.length) {
        const gg = await sb(`guias?select=nombre,email,activo&id=in.(${ids.join(",")})`);
        (gg.body ?? []).forEach((g: any) => {
          if (g.activo === false) return;
          mete(g.email, `guia ${g.nombre ?? ""}`.trim());
        });
      }
    }
  }

  return { para, quien };
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
    const { reserva_id, motivo, antes } = await req.json();
    if (!reserva_id) return json({ error: "falta reserva_id" }, 400);

    const r = await sb(`v_sinc_portal?select=*&id=eq.${encodeURIComponent(reserva_id)}&limit=1`);
    const x = r.body?.[0];
    if (!x) return json({ ok: false, aviso: "esa reserva no existe" });

    const mov = motivo === "movida";
    const { para, quien } = await destinatarios(String(reserva_id), mov);
    if (!para.length) return json({ ok: true, correo: false, aviso: "sin destinatarios configurados" });
    if (!RESEND) return json({ ok: true, correo: false, aviso: "sin RESEND_API_KEY" });

    const cfg = await sb(`sinc_config?select=valor&clave=eq.url_publica&limit=1`);
    const base = String(cfg.body?.[0]?.valor || "https://grupocasapepe.netlify.app").replace(/\/+$/, "");
    const liga = `${base}/m/sinc-operacion.html?r=${encodeURIComponent(x.id)}`;

    const dev = motivo === "reembolso";
    const antesTx = antes?.fecha
      ? fechaLarga(String(antes.fecha)) + (antes.hora ? ` a las ${String(antes.hora).slice(0, 5)}` : "")
      : "";
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
    if (mov && antesTx) filas.splice(2, 0, ["Antes era", antesTx]);

    const titulo = dev ? "Pide que le devolvamos su tour" : mov ? "Una reserva cambio de dia" : "Nueva reserva";
    const bajada = dev
      ? `${esc(x.huesped ?? "")} pidio la devolucion desde su boleto. Hay que mirar que se gasto ya (boletos, apartados, alimentos, nomina) y devolverle lo que todavia se pueda liberar.`
      : mov
      ? `${esc(x.huesped ?? "")} ya no viene${antesTx ? ` el ${esc(antesTx)}` : ""}: viene el ${esc(cuando)}. Su boleto ya apunta al dia nuevo.`
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
        <p style="color:#A49B8C;font-size:12px">${mov
          ? "Este aviso sale solo cuando una reserva cambia de dia, y va tambien al guia del tour. Al huesped se le reenvia su boleto con la fecha nueva."
          : "Este aviso sale solo, en cuanto entra la reserva, y va a la casa, al hotel donde duerme el huesped y a la touroperadora que lo opera. Al huesped le llega su boleto aparte."
        }<br>Le llego a: ${quien.map(esc).join(" &middot; ")}</p>
      </div>`;

    const asunto = dev
      ? `Devolucion pedida - ${x.tour ?? "Sincretico"} - ${x.folio ?? ""}`
      : mov
      ? `Cambio de dia - ${x.tour ?? "Sincretico"} - ahora ${fechaLarga(x.fecha_salida)} - ${x.pax ?? 0} pax`
      : `Reserva - ${x.tour ?? "Sincretico"} - ${fechaLarga(x.fecha_salida)} - ${x.pax ?? 0} pax`;

    const env = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Sincretico <no-reply@casapepe.mx>", to: para, subject: asunto, html }),
    });

    return json({ ok: true, correo: env.ok, para, quien, detalle: env.ok ? null : (await env.text()).slice(0, 300) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
