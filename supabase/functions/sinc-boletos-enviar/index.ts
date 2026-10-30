/* Emite los boletos de una reserva pagada y se los manda al huésped.

   Se llama desde sinc-stripe-webhook en cuanto el pago queda confirmado, y
   también a mano desde el panel cuando hay que reenviarlo.

   Es idempotente de los dos lados: sinc_emitir_boletos no duplica si ya los
   hay, y el correo se puede repetir sin romper nada. Stripe reintenta cuando
   algo va lento, así que esto tenía que aguantar llegar dos veces.

   Sin JWT: lo llama el webhook, que no trae uno. A cambio exige un secreto
   compartido o la service role, para que no lo dispare cualquiera.

   Javi, 27-sep-2026.
   1-oct-2026: cobro dividido. Si el huésped pagó sólo una parte, el boleto se
   lo dice y le pone la cifra que debe al llegar: es el papel que va a mirar
   el día del tour.
   27-oct-2026: EN INGLÉS CUANDO LA RESERVA ES EN INGLÉS. Javi: «traduce todo
   lo que está de cara al cliente». La ficha, el pago y el boleto en pantalla
   ya salían en inglés, y este correo —que es lo único que el huésped se lleva
   a la bandeja— seguía yéndose en español. El idioma no se adivina: lo guarda
   la propia reserva en sinc_reservas.idioma desde que se reserva. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/* EL QR TIENE QUE VIAJAR DENTRO DEL CORREO. Javi, 30-oct-2026: «asegúrate que
   el correo vaya con un QR para poder escanearlo».
   No iba, y no era un descuido: el QR del boleto lo dibuja JavaScript en el
   navegador, y ningún correo ejecuta JavaScript. Así que aquí se genera como
   imagen y se adjunta en línea (cid:), que es la única forma de que llegue
   dibujado a la bandeja.
   Si por lo que sea no se pudiera generar, el correo sale igual que siempre
   -con la liga y el código escrito-: un QR que falta no puede dejar a nadie
   sin boleto. */
import QRCode from "npm:qrcode@1.5.4";

async function qrPngBase64(texto: string): Promise<string | null> {
  try {
    const buf = await QRCode.toBuffer(texto, {
      type: "png", width: 420, margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#1F1B16", light: "#FFFFFF" },
    });
    let bin = "";
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  } catch (_) { return null; }
}

const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const pesos = (n: unknown) => "$" + Number(n ?? 0).toLocaleString("es-MX");

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}
async function rpc(fn: string, body: unknown) {
  return await sb(`rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
               "agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* La fecha se escribe como se escribe en cada idioma, no traducida palabra por
   palabra: «sábado 1 de noviembre» / «Saturday 1 November». */
function fechaLarga(f: string | null, en = false) {
  if (!f) return "";
  const p = String(f).split("-");
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return en
    ? `${DAYS[d.getDay()]} ${+p[2]} ${MONTHS[+p[1] - 1]}`
    : `${DIAS[d.getDay()]} ${+p[2]} de ${MESES[+p[1] - 1]}`;
}

/* Todo lo que lee el huésped, en los dos idiomas. Un solo sitio: si mañana
   hay que cambiar una frase, se cambia aquí y no en seis plantillas. */
const TX = {
  es: {
    marca: "Sincrético · Casa Pepe",
    tuExp: "Tu experiencia",
    aLas: (h: string) => ` a las ${h}`,
    hola: (n: string, uno: boolean, c: number) =>
      `Hola ${n}, ya ${uno ? "está tu boleto" : `están tus ${c} boletos`}.`,
    abrir: (uno: boolean) => `Abrir ${uno ? "mi boleto" : "mis boletos"}`,
    donde: "Dónde:",
    folio: "Folio:",
    codigo: (uno: boolean) => (uno ? "Tu código" : "Tus códigos"),
    ensena: "Enseña el código al llegar. Si no te abre el enlace, basta con decirlo en voz alta: " +
            "no lleva ni ceros ni oes ni unos ni íes, para que no haya confusión.",
    pie: "Si no reconoces esta reserva, contéstanos a este correo.",
    faltaTit: (m: string) => `Te falta pagar ${m} al llegar`,
    faltaTxt: (op: string) => `Con la tarjeta pagaste sólo una parte de la reserva. ` +
            `El resto se lo pagas directamente a ${op} el día del tour, en el punto de encuentro.`,
    operadora: "la operadora del tour",
    /* Javi, 30-oct-2026. Dos reglas de la puerta que hasta hoy se decian de
       palabra y acababan en discusion en el punto de encuentro. Van en el
       correo, que es el papel que el huesped se lleva. */
    valePor: (n: number) =>
      `Este código vale por ${n} ${n === 1 ? "persona" : "personas"}. Se escanea una sola vez, al llegar.`,
    reglaTit: "Antes de venir, dos cosas",
    reglaTarde: "Una vez iniciado el viaje a la Arena no se permite incorporar a más personas.",
    reglaNoShow: "Los boletos de quien no se presente sólo se entregan si se piden en el check-in.",
    asunto: (uno: boolean, exp: string, f: string) =>
      `${uno ? "Tu boleto" : "Tus boletos"} · ${exp} · ${f}`,
  },
  en: {
    marca: "Sincrético · Casa Pepe",
    tuExp: "Your experience",
    aLas: (h: string) => ` at ${h}`,
    hola: (n: string, uno: boolean, c: number) =>
      `Hi ${n}, your ${uno ? "ticket is" : `${c} tickets are`} ready.`,
    abrir: (uno: boolean) => `Open my ${uno ? "ticket" : "tickets"}`,
    donde: "Where:",
    folio: "Reference:",
    codigo: (uno: boolean) => (uno ? "Your code" : "Your codes"),
    ensena: "Show the code when you arrive. If the link won’t open, just read it out loud: " +
            "it has no zeros, no O’s, no ones and no I’s, so there is nothing to mix up.",
    pie: "If you don’t recognise this booking, just reply to this email.",
    faltaTit: (m: string) => `${m} still to pay when you arrive`,
    faltaTxt: (op: string) => `Your card covered only part of the booking. ` +
            `You pay the rest directly to ${op} on the day of the tour, at the meeting point.`,
    operadora: "the tour operator",
    valePor: (n: number) =>
      `This code is valid for ${n} ${n === 1 ? "person" : "people"}. It is scanned once, on arrival.`,
    reglaTit: "Two things before you come",
    reglaTarde: "Once the trip to the Arena has started, no one else can join.",
    reglaNoShow: "Tickets for anyone who does not show up are only handed over if asked for at check-in.",
    asunto: (uno: boolean, exp: string, f: string) =>
      `Your ${uno ? "ticket" : "tickets"} · ${exp} · ${f}`,
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  /* Quién puede dispararlo: el webhook (que manda la service role) o alguien
     del equipo con sesión. Nadie más, o cualquiera podría mandarle correos a
     los huéspedes desde nuestro dominio. */
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!auth) return json({ error: "Sin autorización" }, 401);
  if (auth !== SRK) {
    const q = await fetch(`${URL_SB}/rest/v1/rpc/es_equipo_casa`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: "{}",
    });
    const esEquipo = q.ok ? await q.json() : false;
    if (esEquipo !== true) return json({ error: "No autorizado" }, 403);
  }

  try {
    const { reserva_id, solo_emitir } = await req.json();
    if (!reserva_id) return json({ error: "falta reserva_id" }, 400);

    // 1 · emitir (no duplica si ya los tiene)
    const em = await rpc("sinc_emitir_boletos", { p_reserva: reserva_id });
    if (!em.ok) return json({ error: "no se pudieron emitir", detalle: em.body }, 500);
    const boletos = Array.isArray(em.body) ? em.body : [];
    if (!boletos.length) return json({ ok: true, aviso: "la reserva no tiene personas" });

    if (solo_emitir) return json({ ok: true, boletos: boletos.length, correo: false });

    // 2 · con qué mandarlo
    const r = await sb(`sinc_reservas?select=id,folio,nombre,email,idioma,adultos,menores,pax,ref_externa,salida_id,op_experiencia_id,cobro_dividido,pago_resto&id=eq.${reserva_id}&limit=1`);
    const res = r.body?.[0];
    if (!res?.email) return json({ ok: true, boletos: boletos.length, correo: false, aviso: "la reserva no trae correo" });

    /* El idioma de la reserva manda. Si viniera vacío —una reserva vieja, o una
       metida a mano desde el panel—, español, que es lo que había siempre. */
    const en = String(res.idioma ?? "es").toLowerCase().slice(0, 2) === "en";
    const t = en ? TX.en : TX.es;

    const pub = await sb(`rpc/sinc_boleto_publico`, { method: "POST", body: JSON.stringify({ p_codigo: boletos[0].codigo }) });
    const d = pub.body ?? {};

    /* El nombre y el punto de encuentro de la experiencia también tienen su
       versión en inglés en la tabla de traducciones: el correo pide la misma
       que ya vio en la ficha, para que no lea dos nombres del mismo tour. */
    let expNombre = String(d.experiencia ?? "");
    let punto = String(d.punto ?? "");
    if (en && res.op_experiencia_id) {
      const tr = await rpc("i18n_textos", {
        p_tabla: "op_experiencias",
        p_ids: [String(res.op_experiencia_id)],
        p_idioma: "en",
      });
      if (Array.isArray(tr.body)) {
        for (const f of tr.body) {
          if (!f?.texto) continue;
          if (f.campo === "nombre") expNombre = String(f.texto);
          if (f.campo === "punto_encuentro") punto = String(f.texto);
        }
      }
    }

    /* Cobro dividido: hay que decirle lo que debe y a quién. El operador se
       busca aquí porque el boleto es lo único que el huésped va a tener en la
       mano el día del tour. */
    let aviso = "";
    if (res.cobro_dividido && Number(res.pago_resto) > 0) {
      let operador = t.operadora;
      if (res.op_experiencia_id) {
        const e = await sb(`op_experiencias?select=operador_id&id=eq.${res.op_experiencia_id}&limit=1`);
        const opid = e.body?.[0]?.operador_id;
        if (opid) {
          const o = await sb(`tour_operadores?select=nombre_comercial&id=eq.${opid}&limit=1`);
          if (o.body?.[0]?.nombre_comercial) operador = o.body[0].nombre_comercial;
        }
      }
      aviso = `
        <div style="border:1px dashed #E8B9A0;background:#FFF4EE;border-radius:10px;padding:14px 16px;margin:18px 0">
          <p style="margin:0 0 4px;font-weight:600">${esc(t.faltaTit(pesos(res.pago_resto)))}</p>
          <p style="margin:0;color:#6B6459;font-size:14px">${esc(t.faltaTxt(operador))}</p>
        </div>`;
    }

    const cfg = await sb(`sinc_config?select=valor&clave=eq.url_publica&limit=1`);
    const base = String(cfg.body?.[0]?.valor || "https://grupocasapepe.netlify.app").replace(/\/+$/, "");
    /* La liga lleva el idioma: si abrió el boleto desde un correo en inglés, la
       pantalla tiene que salir en inglés sin que lo vuelva a elegir. */
    const liga = `${base}/boleto?f=${encodeURIComponent(res.folio)}${en ? "&lang=en" : ""}`;

    const cuantos = boletos.length;
    const uno = cuantos === 1;
    const fechaTx = fechaLarga(d.fecha, en);

    /* EL CÓDIGO DEL GRUPO, NO EL DE CADA PERSONA. Javi, 30-oct-2026: «un QR por
       reserva con el detalle de cuántas pax». Si la reserva vino del sistema de
       otro operador, su código es el que el huésped ya tiene; si nació aquí, el
       folio. Los dos los reconoce el escáner. */
    const paxGrupo = Number(res.pax ?? cuantos) || cuantos;
    const codGrupo = String(res.ref_externa ?? "").trim() || String(res.folio ?? "");
    const qr64 = await qrPngBase64(codGrupo);
    const bloqueQR = qr64
      ? `<div style="text-align:center;margin:22px 0;padding:18px 0;border-top:1px solid #E2DCCF;border-bottom:1px solid #E2DCCF">
           <img src="cid:boleto-qr" alt="${esc(codGrupo)}" width="200" height="200"
                style="width:200px;height:200px;display:block;margin:0 auto 10px;image-rendering:pixelated">
           <div style="font-family:ui-monospace,Menlo,monospace;font-size:17px;letter-spacing:.14em">${esc(codGrupo)}</div>
           <div style="color:#6B6459;font-size:13px;margin-top:8px">${esc(t.valePor(paxGrupo))}</div>
         </div>`
      : "";

    const bloqueReglas = `
      <div style="background:#F6EBD5;border-left:3px solid #8C6212;padding:12px 14px;margin:18px 0;border-radius:0 8px 8px 0">
        <b style="display:block;margin-bottom:6px">${esc(t.reglaTit)}</b>
        <div style="font-size:14px;line-height:1.55">• ${esc(t.reglaTarde)}<br>• ${esc(t.reglaNoShow)}</div>
      </div>`;
    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1F1B16;max-width:520px">
        <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6B6459;margin:0 0 6px">${esc(t.marca)}</p>
        <h2 style="margin:0 0 4px;font-size:22px">${esc(expNombre || t.tuExp)}</h2>
        <p style="margin:0 0 18px;color:#6B6459">${esc(fechaTx)}${d.hora ? esc(t.aLas(String(d.hora).slice(0,5))) : ""}</p>
        <p>${esc(t.hola(String(res.nombre || ""), uno, cuantos))}</p>
        ${aviso}
        ${bloqueQR}
        <p style="margin:22px 0">
          <a href="${esc(liga)}" style="background:#C9501A;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;display:inline-block">
            ${esc(t.abrir(uno))}</a>
        </p>
        ${punto ? `<p><b>${esc(t.donde)}</b> ${esc(punto)}</p>` : ""}
        <p><b>${esc(t.folio)}</b> ${esc(res.folio)}</p>
        <p style="margin-top:10px"><b>${esc(t.codigo(uno))}:</b><br>
          ${boletos.map((b: any) => `<span style="font-family:ui-monospace,Menlo,monospace;font-size:18px;letter-spacing:.2em">${esc(b.codigo)}</span>`).join("<br>")}</p>
        ${bloqueReglas}
        <p style="color:#6B6459;font-size:13px;margin-top:20px">${esc(t.ensena)}</p>
        <p style="color:#A49B8C;font-size:12px;margin-top:18px">${esc(t.pie)}</p>
      </div>`;

    if (!RESEND) return json({ ok: true, boletos: cuantos, correo: false, aviso: "sin RESEND_API_KEY" });

    const env = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Sincrético <no-reply@casapepe.mx>",
        to: [res.email],
        subject: t.asunto(uno, expNombre || "Sincrético", fechaTx),
        html,
        /* En línea, con su content_id: así se ve dibujado dentro del correo y
           no como un archivo suelto que nadie abre. */
        ...(qr64
          ? { attachments: [{ filename: "boleto.png", content: qr64, content_id: "boleto-qr" }] }
          : {}),
      }),
    });

    return json({ ok: true, boletos: cuantos, correo: env.ok, qr: !!qr64, codigo_grupo: codGrupo,
                  idioma: en ? "en" : "es", detalle: env.ok ? null : await env.text() });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
