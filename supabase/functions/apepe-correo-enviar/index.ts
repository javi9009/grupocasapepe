// apepe-correo-enviar — manda al huésped uno de los correos que recepción
// escribe en el panel (pestaña «Editar correos» → tabla apepe_correos).
//
// Javi, 19-oct-2026: «me gusta tu idea que los mailings se puedan editar en el
// dashboard (…) con "code" por tipo de campo que jale de Cloudbeds o de nuestro
// sistema», y «avísame cuando lo tengas armado para que se envíen».
//
// Cómo encaja:
//   · El TEXTO vive en apepe_correos. Esta función no tiene textos dentro: si
//     recepción cambia una frase en el panel, el siguiente correo sale con ella.
//   · Los DATOS salen de Cloudbeds en vivo (getReservation) y de apepe_config.
//     Los {{códigos}} se cambian aquí con el mismo regex que usa la vista previa
//     del panel, para que lo que se ve y lo que sale no se separen nunca.
//   · El ENVÍO va por Resend desde recepcion.cdmx@ / recepcion.puebla@. Nunca
//     por el conector de Gmail: borra las etiquetas <img> y mata la portada.
//
// El interruptor. Mientras apepe_config.apepe_envio_activo no sea 'true', el
// correo NO va al huésped: va a la recepción de su casa y queda registrado como
// modo prueba. Encenderlo es una decisión de Javi, no un descuido de código.

import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const PANEL = Deno.env.get("PANEL_URL") || "https://grupocasapepe.netlify.app";

const PROP: Record<string, { keyEnv: string; id?: string; idEnv?: string; ciudad: string; buzon: string }> = {
  cdmx:   { keyEnv: "CLOUDBEDS_API_KEY", id: "10668", ciudad: "Ciudad de México", buzon: "hola.cdmx@casapepe.mx" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA", ciudad: "Puebla", buzon: "hola.puebla@casapepe.mx" },
};
const REMITENTE: Record<string, string> = {
  cdmx:   "Casa Pepe CDMX <recepcion.cdmx@casapepe.mx>",
  puebla: "Casa Pepe Puebla <recepcion.puebla@casapepe.mx>",
};
const CASA: Record<string, { nombre: string; direccion: string; whatsapp: string }> = {
  cdmx:   { nombre: "Casa Pepe CDMX", direccion: "República de Uruguay 86, Centro Histórico, Ciudad de México", whatsapp: "+52 55 4470 0390" },
  puebla: { nombre: "Casa Pepe Puebla", direccion: "Avenida 3 Oriente 627, Centro Histórico, Puebla", whatsapp: "+52 55 4470 0390" },
};
const PORTADA: Record<string, string> = {
  cdmx: "header-cdmx.gif", puebla: "header-puebla.gif",
  tours: "header-tours.gif", golondrinas: "collage-cancelacion.png",
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function sb(path: string, init?: RequestInit) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

async function config(clave: string): Promise<string> {
  try {
    const r = await sb(`apepe_config?clave=eq.${encodeURIComponent(clave)}&select=valor&limit=1`);
    const j = await r.json();
    return Array.isArray(j) && j[0] ? String(j[0].valor ?? "") : "";
  } catch { return ""; }
}

/* La liga del check-in es el mismo token opaco que ya usa la tablet: si la
   reserva ya tiene uno, se reutiliza; si no, se crea. Nunca dos ligas para la
   misma reserva, porque el huésped guarda la primera que recibe. */
async function ligaCheckin(rid: string, prop: string): Promise<string> {
  try {
    const r = await sb(`apepe_reserva_token?reservation_id=eq.${encodeURIComponent(rid)}&select=token&limit=1`);
    const j = await r.json();
    let tok = Array.isArray(j) && j[0] ? j[0].token : "";
    if (!tok) {
      tok = crypto.randomUUID();
      await sb("apepe_reserva_token", { method: "POST", body: JSON.stringify({ token: tok, reservation_id: rid, property: prop, nota: "correo" }) });
    }
    return `${PANEL}/apepe/checkin.html?resv=${encodeURIComponent(tok)}`;
  } catch { return `${PANEL}/apepe/checkin.html`; }
}

function dineroMX(n: number) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " MXN";
}
function fechaLarga(s: string) {
  if (!s) return "";
  const M = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const p = String(s).split("T")[0].split("-");
  if (p.length !== 3) return s;
  return `${Number(p[2])} de ${M[Number(p[1]) - 1]}`;
}

async function reserva(rid: string, prop: string) {
  const cfg = PROP[prop] || PROP.cdmx;
  const key = Deno.env.get(cfg.keyEnv) || "";
  const pid = cfg.id || Deno.env.get(cfg.idEnv || "") || "";
  const r = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
  const j = await r.json().catch(() => ({}));
  const d = j?.data;
  if (!d) return null;
  const gl = d.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as any[] : [];
  const main = gl.find((g: any) => g.isMainGuest) || gl[0] || {};
  const rooms = [...(Array.isArray(d.assigned) ? d.assigned : []), ...(Array.isArray(d.unassigned) ? d.unassigned : [])];
  let adultos = 0, menores = 0; const habs = new Set<string>();
  for (const x of rooms) { adultos += Number(x.adults || 0); menores += Number(x.children || 0); if (x.roomTypeName) habs.add(x.roomTypeName); }
  const pax = (adultos + menores) || gl.length || 1;
  const total = Number(d.total || 0), saldo = Number(d.balance || 0);
  let noches = 1;
  try { noches = Math.max(1, Math.round((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86400000)); } catch { /* una noche */ }
  return {
    nombre: String(main.guestFirstName || d.guestName || "").trim(),
    apellido: String(main.guestLastName || "").trim(),
    correo: String(main.guestEmail || d.guestEmail || "").trim(),
    telefono: String(main.guestCellPhone || main.guestPhone || "").trim(),
    pais: String(main.guestCountry || "").toUpperCase(),
    desde: String(d.startDate || ""), hasta: String(d.endDate || ""),
    noches, pax, habitacion: [...habs][0] || "",
    total, saldo, pagado: Math.max(0, total - saldo),
    status: String(d.status || ""),
  };
}

/* Los códigos. El mismo contrato que enseña el panel: si aquí falta uno, en la
   vista previa se ve y en el correo saldría la llave cruda. */
async function diccionario(rv: any, rid: string, prop: string) {
  const casa = CASA[prop] || CASA.cdmx;
  const wifi = await config(`apepe_wifi_${prop}`);
  const liga = await ligaCheckin(rid, prop);
  const red = await config(`wifi_red_${prop}`);
  const clave = await config(`wifi_clave_${prop}`);
  return {
    "{{nombre}}": rv.nombre, "{{apellido}}": rv.apellido,
    "{{reserva}}": rid,
    "{{llegada}}": fechaLarga(rv.desde), "{{salida}}": fechaLarga(rv.hasta),
    "{{noches}}": String(rv.noches),
    "{{cuarto}}": rv.habitacion,
    "{{personas}}": rv.pax === 1 ? "1 persona" : `${rv.pax} personas`,
    "{{total}}": dineroMX(rv.total), "{{pagado}}": dineroMX(rv.pagado), "{{pendiente}}": dineroMX(rv.saldo),
    "{{correo}}": rv.correo, "{{telefono}}": rv.telefono, "{{pais}}": rv.pais,
    "{{liga_checkin}}": liga,
    "{{liga_app}}": `${PANEL}/apepe/index.html`,
    "{{liga_pago}}": `${PANEL}/apepe/index.html`,
    "{{liga_upgrade}}": `${PANEL}/apepe/upgrade.html`,
    "{{liga_extender}}": `${PANEL}/apepe/extender.html`,
    "{{liga_resena}}": `${PANEL}/apepe/resena.html`,
    "{{liga_volver}}": `${PANEL}/apepe/volver.html`,
    "{{casa}}": casa.nombre, "{{direccion}}": casa.direccion, "{{whatsapp}}": casa.whatsapp,
    "{{wifi_red}}": red || wifi || "Casa Pepe Guest",
    "{{wifi_clave}}": clave || "sin contraseña",
    "{{desayuno}}": (await config("desayuno_horario")) || "de 7:00 a 11:00",
    "{{entrada}}": "15:00", "{{salida_hora}}": "12:00",
    "{{como_llegar}}": (await config(`llegar_${prop}`)) || "",
  } as Record<string, string>;
}
function rellena(t: string, dic: Record<string, string>) {
  return String(t ?? "").replace(/\{\{[a-z_]+\}\}/g, (k) => (dic[k] !== undefined ? dic[k] : k));
}

function armar(c: any, dic: Record<string, string>, prop: string, liga: string) {
  const ciudad = (PROP[prop] || PROP.cdmx).ciudad;
  const casa = CASA[prop] || CASA.cdmx;
  const port = PORTADA[c.portada] || PORTADA.cdmx;
  const parrafos = String(c.cuerpo || "").split(/\n\s*\n/).filter((p: string) => p.trim())
    .map((p: string) => `<p style="margin:9px 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.62;color:#3C3630">${esc(rellena(p, dic))}</p>`).join("");
  const caja = Array.isArray(c.caja) && c.caja.length
    ? `<tr><td style="padding:14px 34px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EFE8;border-radius:12px"><tr><td style="padding:12px 15px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      c.caja.map((f: any) => `<tr><td style="padding:3px 0;font-size:13px;color:#6E665C;width:44%">${esc(rellena(String(f[0] ?? ""), dic))}</td><td style="padding:3px 0;font-size:13px;color:#1E1A16;font-weight:600">${esc(rellena(String(f[1] ?? ""), dic))}</td></tr>`).join("") +
      `</table></td></tr></table></td></tr>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rellena(c.asunto, dic))}</title></head>
<body style="margin:0;padding:22px 10px;background:#EFEAE1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(rellena(c.avance, dic))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:100%;background:#FBF7F2;border:1px solid #E6DFD6;border-radius:14px;border-collapse:separate;overflow:hidden">
  <tr><td bgcolor="#1E1A16" style="background-color:#1E1A16;padding:14px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="middle"><img src="${PANEL}/img/casapepe/logo-correo.png" alt="Casa Pepe" height="42" style="display:block;height:42px;width:auto;border:0"></td>
    <td align="right" valign="middle" style="font-family:Oswald,Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#C9A98F">${esc(ciudad)}</td>
  </tr></table></td></tr>
  <tr><td style="padding:0"><img src="${PANEL}/img/apepe/correos/${port}" alt="${esc(casa.nombre)}" width="620" style="display:block;width:100%;height:auto;border:0;font-family:Oswald,Arial,sans-serif;font-size:14px;color:#6E665C"></td></tr>
  <tr><td style="padding:16px 34px 0">
    <h1 style="margin:0;font-family:Oswald,Arial,sans-serif;font-weight:700;font-size:25px;line-height:1.18;text-transform:uppercase;letter-spacing:.015em;color:#1E1A16">${esc(rellena(c.titular, dic))}</h1>
    ${parrafos}
  </td></tr>
  ${caja}
  <tr><td align="center" style="padding:20px 34px 2px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="#F2682A" style="background-color:#F2682A;border-radius:11px"><a href="${esc(liga)}" style="display:inline-block;padding:14px 32px;font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:14.5px;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;background-color:#F2682A;border:1px solid #F2682A;border-radius:11px;text-decoration:none">${esc(rellena(c.boton, dic))}</a></td></tr></table></td></tr>
  <tr><td style="padding:10px 34px 0"><p style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#A9A096;word-break:break-all">Si el botón no se ve: ${esc(liga)}</p></td></tr>
  <tr><td style="height:16px;line-height:16px">&nbsp;</td></tr>
  <tr><td bgcolor="#1E1A16" style="background-color:#1E1A16;padding:22px 26px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="top" width="54"><img src="${PANEL}/img/casapepe/iso-correo.png" alt="" height="40" style="display:block;height:40px;width:auto;border:0;opacity:.95"></td>
    <td align="left" valign="top" style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#BDB2A4"><b style="color:#FBF7F2;font-family:Oswald,Arial,sans-serif;font-size:13px;letter-spacing:.06em;text-transform:uppercase">Casa Pepe · Hostal Boutique</b><br>${esc(casa.direccion)}<br><a href="mailto:recepcion.${prop}@casapepe.mx" style="color:#F2682A;text-decoration:none">recepcion.${prop}@casapepe.mx</a> · WhatsApp ${esc(casa.whatsapp)}</td>
  </tr><tr><td colspan="2" style="padding-top:14px;border-top:1px solid #332D25;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#7E756A">Te escribimos porque tienes una reserva con nosotros. Si no esperabas este correo, contéstanos y lo revisamos.</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

/* La liga del botón depende del correo: el destino que escribe recepción es una
   nota para ella, no una URL. Aquí se decide a dónde va de verdad. */
function ligaBoton(clave: string, dic: Record<string, string>) {
  if (/documento|confirmacion|llegas/.test(clave)) return dic["{{liga_checkin}}"];
  if (clave === "tarjeta" || clave === "pendiente") return dic["{{liga_pago}}"];
  if (clave === "cancelacion") return dic["{{liga_volver}}"];
  if (clave === "upgrade") return dic["{{liga_upgrade}}"];
  if (clave === "noche_mas") return dic["{{liga_extender}}"];
  if (clave === "gracias") return dic["{{liga_resena}}"];
  return dic["{{liga_app}}"];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);
  if (!RESEND) return J({ ok: false, error: "falta RESEND_API_KEY" }, 500);

  const quien = await quienLlama(req);
  if (!quien.equipo) return noAutorizado();

  let b: any = {}; try { b = await req.json(); } catch { /* cuerpo vacío */ }
  const rid = String(b.reservation_id || "").trim();
  const prop = PROP[String(b.prop || "cdmx")] ? String(b.prop) : "cdmx";
  const clave = String(b.clave || "").trim();
  if (!rid || !clave) return J({ ok: false, error: "faltan reservation_id y clave" }, 400);

  const rc = await sb(`apepe_correos?clave=eq.${encodeURIComponent(clave)}&select=*&limit=1`);
  const cj = await rc.json().catch(() => []);
  const c = Array.isArray(cj) && cj[0] ? cj[0] : null;
  if (!c) return J({ ok: false, error: "ese correo no existe" }, 404);
  if (c.activo === false) return J({ ok: false, error: "ese correo está apagado en el panel" }, 409);

  const rv = await reserva(rid, prop);
  if (!rv) return J({ ok: false, error: "no encontré la reserva en Cloudbeds" }, 404);

  const dic = await diccionario(rv, rid, prop);
  const html = armar(c, dic, prop, ligaBoton(clave, dic));
  const asunto = rellena(c.asunto, dic);

  // El interruptor: mientras esté apagado, el correo va a la recepción de la
  // casa y no al huésped. Así se puede probar con reservas de verdad sin que
  // nadie de fuera reciba nada.
  const encendido = (await config("apepe_envio_activo")).toLowerCase() === "true";
  const modo = encendido ? "real" : "prueba";
  const a = String(b.a || "").trim() || (encendido ? rv.correo : (PROP[prop] || PROP.cdmx).buzon);
  if (!a) return J({ ok: false, error: "la reserva no tiene correo" }, 422);

  const env = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: REMITENTE[prop] || REMITENTE.cdmx,
      to: [a],
      subject: modo === "real" ? asunto : `[PRUEBA · no salió al huésped] ${asunto}`,
      html,
      reply_to: `recepcion.${prop}@casapepe.mx`,
    }),
  });
  const bien = env.ok;
  const detalle = bien ? null : `resend ${env.status}: ${(await env.text()).slice(0, 200)}`;

  await sb("apepe_correo_log", {
    method: "POST",
    body: JSON.stringify({
      reservation_id: rid, clave, sede: prop, a, asunto, modo,
      resultado: bien ? "ok" : "error", detalle, por: quien.email,
    }),
  }).catch(() => {});

  if (!bien) return J({ ok: false, error: detalle }, 502);
  return J({ ok: true, modo, a, asunto, aviso: modo === "prueba" ? "El interruptor de envío está apagado: esto salió a la recepción, no al huésped." : null });
});
