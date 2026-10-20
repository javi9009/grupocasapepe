// apepe-correo-enviar — manda al huésped uno de los correos que recepción
// escribe en el panel (pestaña «Editar correos» → tabla apepe_correos).
//
// Javi, 19-oct-2026: «me gusta tu idea que los mailings se puedan editar en el
// dashboard», «arma los mailings de Puebla también», «¿y está leyendo el
// idioma?» y «pon un guiño a su país en el asunto». Las cuatro cosas viven aquí.
//
// Cómo encaja:
//   · El TEXTO vive en apepe_correos, una fila por correo Y POR CASA, con su
//     versión en español y su versión en inglés (incluida la caja de datos).
//   · El IDIOMA se decide por el país del huésped y, si no lo dio, por el
//     prefijo de su móvil. Un idioma u otro, nunca los dos en el mismo correo.
//   · El SALUDO ({{bienvenido}}) va en SU lengua aunque el correo vaya en otra:
//     un «Bienvenue» a un francés cuesta nada y se nota.
//   · Los DATOS salen de Cloudbeds en vivo y de apepe_config.
//   · El ENVÍO va por Resend desde recepcion.cdmx@ / recepcion.puebla@.
//
// 20-oct-2026, Javi: «en lo de te hicimos un upgrade tenemos que poder meter
// ¿qué upgrade?». El correo de upgrade acepta un target_id —el cuarto al que
// se le sube, elegido a mano en la ficha— y escribe el de antes y el de
// después con su tipología y sus personas.
//
// El interruptor: mientras apepe_config.apepe_envio_activo no sea 'true', el
// correo va a la recepción de su casa y no al huésped.

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
  puebla: { nombre: "Casa Pepe Puebla", direccion: "Avenida 3 Oriente 627, Centro Histórico, Puebla", whatsapp: "+52 221 642 7790" },
};
const PORTADA: Record<string, string> = {
  cdmx: "header-cdmx.gif", puebla: "header-puebla.gif",
  tours: "header-tours.gif", golondrinas: "collage-cancelacion.png",
};

/* EL IDIOMA DEL CORREO. Cloudbeds no guarda en qué idioma habla el huésped, así
   que se deduce: primero el país que puso al reservar; si lo dejó vacío —pasa
   mucho en las OTAs— el prefijo de su móvil, que casi nunca miente. */
const PAISES_ES = new Set(["MX","ES","AR","CO","CL","PE","UY","VE","EC","BO","PY","CR","PA","GT","HN","SV","NI","DO","CU","PR","GQ"]);
const PREFIJOS_ES = ["+52","+34","+54","+57","+56","+51","+598","+58","+593","+591","+595","+506","+507","+502","+504","+503","+505","+53"];
function idiomaDe(rv: { pais?: string; telefono?: string }) {
  const p = String(rv.pais || "").toUpperCase().trim();
  if (p) return PAISES_ES.has(p) ? "es" : "en";
  const t = String(rv.telefono || "").replace(/[^0-9+]/g, "");
  if (t.startsWith("+")) {
    for (const pre of PREFIJOS_ES) if (t.startsWith(pre)) return "es";
    return "en";
  }
  return "es";
}

/* EL GUIÑO. El saludo en la lengua de su casa, aunque el resto del correo vaya
   en español o en inglés. Se usa con el código {{bienvenido}}. Países donde
   conviven varias lenguas (CA, CH, BE…) van a la más probable para un viajero;
   no se inventa precisión que no tenemos. */
const SALUDO: Record<string, string> = {
  FR: "Bienvenue", BE: "Bienvenue", LU: "Bienvenue", MC: "Bienvenue", CA: "Welcome",
  DE: "Willkommen", AT: "Willkommen", CH: "Willkommen", LI: "Willkommen",
  IT: "Benvenuto", SM: "Benvenuto", VA: "Benvenuto",
  PT: "Bem-vindo", BR: "Bem-vindo", AO: "Bem-vindo", MZ: "Bem-vindo",
  NL: "Welkom", SR: "Welkom",
  JP: "ようこそ", CN: "欢迎", TW: "歡迎", HK: "歡迎", KR: "환영합니다",
  RU: "Добро пожаловать", UA: "Ласкаво просимо", BY: "Добро пожаловать", KZ: "Добро пожаловать",
  IL: "ברוכים הבאים", SA: "أهلاً", AE: "أهلاً", EG: "أهلاً", MA: "أهلاً", JO: "أهلاً", LB: "أهلاً",
  SE: "Välkommen", NO: "Velkommen", DK: "Velkommen", IS: "Velkomin", FI: "Tervetuloa",
  PL: "Witamy", CZ: "Vítejte", SK: "Vitajte", HU: "Üdvözöljük", RO: "Bun venit",
  GR: "Καλώς ήρθατε", TR: "Hoş geldiniz", BG: "Добре дошли", HR: "Dobrodošli", RS: "Добродошли", SI: "Dobrodošli",
  TH: "ยินดีต้อนรับ", VN: "Chào mừng", ID: "Selamat datang", MY: "Selamat datang", PH: "Maligayang pagdating",
  IN: "स्वागत है", NP: "स्वागत छ", LK: "ආයුබෝවන්",
  EE: "Tere tulemast", LV: "Laipni lūdzam", LT: "Sveiki atvykę",
};
function saludoDe(pais: string, idioma: "es" | "en") {
  const p = String(pais || "").toUpperCase().trim();
  if (p && SALUDO[p]) return SALUDO[p];
  if (p && PAISES_ES.has(p)) return "Bienvenido";
  return idioma === "en" ? "Welcome" : "Bienvenido";
}

const PIE = {
  es: {
    porque: "Te escribimos porque tienes una reserva con nosotros. Si no esperabas este correo, contéstanos y lo revisamos.",
    sinBoton: "Si el botón no se ve:",
    prueba: "PRUEBA · no salió al huésped",
  },
  en: {
    porque: "You are getting this because you have a booking with us. If you weren't expecting it, just reply and we'll look into it.",
    sinBoton: "If the button doesn't show:",
    prueba: "TEST · not sent to the guest",
  },
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

/* EL ANTES Y EL DESPUÉS DEL UPGRADE.
   Dos caminos, en este orden:
     1. Recepción eligió el cuarto a mano en la ficha (target_id). Entonces el
        «antes» es el cuarto en el que está ahora según Cloudbeds y el
        «después» es el que eligió, los dos con el nombre que ve el huésped.
     2. No eligió nada: se mira el upgrade ya registrado en
        apepe_upgrade_aplicado, que guarda los cuartos como números de
        tipología (66013 → 656015) y hay que cambiarlos por su nombre.
   Si no sale ninguno, se devuelve vacío: la fila desaparece de la caja. Mejor
   sin dato que con un número que al huésped no le dice nada. */
async function upgradeCuartos(rid: string, prop: string, targetId: string) {
  if (targetId) {
    try {
      const r = await fetch(`${SB_URL}/functions/v1/apepe-upgrade`, {
        method: "POST",
        headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: rid, prop, accion: "opciones" }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (j && j.ok) {
        const antes = String(j.cuarto_actual?.nombre || "");
        const op = (Array.isArray(j.opciones) ? j.opciones : []).find((o: any) => String(o?.target?.id) === String(targetId));
        const despues = op ? String(op.target?.nombre || "") : "";
        if (antes || despues) return { antes, despues };
      }
    } catch { /* se cae al camino 2 */ }
  }
  try {
    const r = await sb(`apepe_upgrade_aplicado?reservation_id=eq.${encodeURIComponent(rid)}&select=from_room,to_room,created_at&order=created_at.desc&limit=1`);
    const j = await r.json().catch(() => []);
    const u = Array.isArray(j) && j[0] ? j[0] : null;
    if (!u) return { antes: "", despues: "" };
    const cfg = PROP[prop] || PROP.cdmx;
    const key = Deno.env.get(cfg.keyEnv) || "";
    const pid = cfg.id || Deno.env.get(cfg.idEnv || "") || "";
    const rt = await fetch(`${CB}/getRoomTypes?propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
    const rj = await rt.json().catch(() => ({}));
    const lista: any[] = Array.isArray((rj as any)?.data) ? (rj as any).data : [];
    const nombre = (id: unknown) => {
      const f = lista.find((x: any) => String(x.roomTypeID) === String(id ?? ""));
      return f ? String(f.roomTypeName || "") : "";
    };
    return { antes: nombre(u.from_room), despues: nombre(u.to_room) };
  } catch { return { antes: "", despues: "" }; }
}

function dineroMX(n: number) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " MXN";
}
const MESES = {
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};
function fechaLarga(s: string, idioma: "es" | "en") {
  if (!s) return "";
  const p = String(s).split("T")[0].split("-");
  if (p.length !== 3) return s;
  const d = Number(p[2]), m = MESES[idioma][Number(p[1]) - 1];
  return idioma === "en" ? `${m} ${d}` : `${d} de ${m}`;
}

async function reserva(rid: string, prop: string) {
  const cfg = PROP[prop] || PROP.cdmx;
  const key = Deno.env.get(cfg.keyEnv) || "";
  const pid = cfg.id || Deno.env.get(cfg.idEnv || "") || "";
  const r = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
  const j = await r.json().catch(() => ({}));
  const d = (j as any)?.data;
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

async function diccionario(rv: any, rid: string, prop: string, idioma: "es" | "en", clave: string, targetId: string) {
  const casa = CASA[prop] || CASA.cdmx;
  const wifi = await config(`apepe_wifi_${prop}`);
  const liga = await ligaCheckin(rid, prop);
  const red = await config(`wifi_red_${prop}`);
  const clv = await config(`wifi_clave_${prop}`);
  const personas = rv.pax === 1
    ? (idioma === "en" ? "1 guest" : "1 persona")
    : (idioma === "en" ? `${rv.pax} guests` : `${rv.pax} personas`);
  /* Sólo el correo de upgrade necesita saber de dónde venía; no se le pregunta
     a Cloudbeds en los otros nueve. */
  const up = clave === "upgrade" ? await upgradeCuartos(rid, prop, targetId) : { antes: "", despues: "" };
  return {
    "{{bienvenido}}": saludoDe(rv.pais, idioma),
    "{{nombre}}": rv.nombre, "{{apellido}}": rv.apellido,
    "{{reserva}}": rid,
    "{{llegada}}": fechaLarga(rv.desde, idioma), "{{salida}}": fechaLarga(rv.hasta, idioma),
    "{{noches}}": String(rv.noches),
    "{{cuarto}}": rv.habitacion,
    "{{cuarto_anterior}}": up.antes || rv.habitacion,
    "{{cuarto_nuevo}}": up.despues,
    "{{personas}}": personas,
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
    "{{wifi_clave}}": clv || (idioma === "en" ? "no password" : "sin contraseña"),
    "{{desayuno}}": (await config("desayuno_horario")) || "de 7:00 a 11:00",
    "{{entrada}}": "15:00", "{{salida_hora}}": "12:00",
    "{{como_llegar}}": (await config(`llegar_${prop}`)) || "",
  } as Record<string, string>;
}

/* RELLENAR. Acepta {codigo} y {{codigo}} —quien escribe en el panel pone unas
   veces una llave y otras dos— y un código que no conocemos NO se imprime: se
   queda en nada. Un hueco en blanco se perdona; un «{{limite}}» en mitad de la
   frase, no. */
function rellena(t: string, dic: Record<string, string>) {
  return String(t ?? "").replace(/\{{1,3}\s*([a-z_]+)\s*\}{1,3}/g, (_m, k) => {
    const v = dic[`{{${k}}}`];
    return v !== undefined ? v : "";
  });
}

function textos(c: any, idioma: "es" | "en") {
  const en = idioma === "en";
  const pick = (a: string, b: string) => (en && String(c[a] || "").trim() ? c[a] : c[b]);
  /* La caja de datos también tiene su gemela en inglés: si no se elegía aquí,
     el correo salía en inglés con las etiquetas en español. */
  const caja = (en && Array.isArray(c.caja_en) && c.caja_en.length) ? c.caja_en : c.caja;
  return {
    asunto: pick("en_asunto", "asunto"),
    avance: pick("en_avance", "avance"),
    titular: pick("en_titular", "titular"),
    cuerpo: pick("en_cuerpo", "cuerpo"),
    boton: pick("en_boton", "boton"),
    caja,
  };
}

function armar(c: any, dic: Record<string, string>, prop: string, liga: string, idioma: "es" | "en") {
  const t = textos(c, idioma);
  const pie = PIE[idioma];
  const ciudad = (PROP[prop] || PROP.cdmx).ciudad;
  const casa = CASA[prop] || CASA.cdmx;
  const port = PORTADA[c.portada] || PORTADA.cdmx;
  const parrafos = String(t.cuerpo || "").split(/\n\s*\n/).filter((p: string) => p.trim())
    .map((p: string) => `<p style="margin:9px 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.62;color:#3C3630">${esc(rellena(p, dic))}</p>`).join("");
  /* Una fila cuyo dato se queda vacío no se enseña: nadie quiere leer «Tenías:»
     seguido de nada, ni un · suelto. */
  const filas = (Array.isArray(t.caja) ? t.caja : [])
    .map((f: any) => [rellena(String(f[0] ?? ""), dic), rellena(String(f[1] ?? ""), dic).replace(/^\s*·\s*|\s*·\s*$/g, "").trim()])
    .filter((f: string[]) => f[1] !== "");
  const caja = filas.length
    ? `<tr><td style="padding:14px 34px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EFE8;border-radius:12px"><tr><td style="padding:12px 15px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      filas.map((f: string[]) => `<tr><td style="padding:3px 0;font-size:13px;color:#6E665C;width:44%">${esc(f[0])}</td><td style="padding:3px 0;font-size:13px;color:#1E1A16;font-weight:600">${esc(f[1])}</td></tr>`).join("") +
      `</table></td></tr></table></td></tr>`
    : "";
  return `<!doctype html><html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rellena(t.asunto, dic))}</title></head>
<body style="margin:0;padding:22px 10px;background:#EFEAE1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(rellena(t.avance, dic))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:100%;background:#FBF7F2;border:1px solid #E6DFD6;border-radius:14px;border-collapse:separate;overflow:hidden">
  <tr><td bgcolor="#1E1A16" style="background-color:#1E1A16;padding:14px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="middle"><img src="${PANEL}/img/casapepe/logo-correo.png" alt="Casa Pepe" height="42" style="display:block;height:42px;width:auto;border:0"></td>
    <td align="right" valign="middle" style="font-family:Oswald,Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#C9A98F">${esc(ciudad)}</td>
  </tr></table></td></tr>
  <tr><td style="padding:0"><img src="${PANEL}/img/apepe/correos/${port}" alt="${esc(casa.nombre)}" width="620" style="display:block;width:100%;height:auto;border:0;font-family:Oswald,Arial,sans-serif;font-size:14px;color:#6E665C"></td></tr>
  <tr><td style="padding:16px 34px 0">
    <h1 style="margin:0;font-family:Oswald,Arial,sans-serif;font-weight:700;font-size:25px;line-height:1.18;text-transform:uppercase;letter-spacing:.015em;color:#1E1A16">${esc(rellena(t.titular, dic))}</h1>
    ${parrafos}
  </td></tr>
  ${caja}
  <tr><td align="center" style="padding:20px 34px 2px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="#F2682A" style="background-color:#F2682A;border-radius:11px"><a href="${esc(liga)}" style="display:inline-block;padding:14px 32px;font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:14.5px;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;background-color:#F2682A;border:1px solid #F2682A;border-radius:11px;text-decoration:none">${esc(rellena(t.boton, dic))}</a></td></tr></table></td></tr>
  <tr><td style="padding:10px 34px 0"><p style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#A9A096;word-break:break-all">${pie.sinBoton} ${esc(liga)}</p></td></tr>
  <tr><td style="height:16px;line-height:16px">&nbsp;</td></tr>
  <tr><td bgcolor="#1E1A16" style="background-color:#1E1A16;padding:22px 26px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="top" width="54"><img src="${PANEL}/img/casapepe/iso-correo.png" alt="" height="40" style="display:block;height:40px;width:auto;border:0;opacity:.95"></td>
    <td align="left" valign="top" style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#BDB2A4"><b style="color:#FBF7F2;font-family:Oswald,Arial,sans-serif;font-size:13px;letter-spacing:.06em;text-transform:uppercase">Casa Pepe · Hostal Boutique</b><br>${esc(casa.direccion)}<br><a href="mailto:recepcion.${prop}@casapepe.mx" style="color:#F2682A;text-decoration:none">recepcion.${prop}@casapepe.mx</a> · WhatsApp ${esc(casa.whatsapp)}</td>
  </tr><tr><td colspan="2" style="padding-top:14px;border-top:1px solid #332D25;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#7E756A">${pie.porque}</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

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
  const targetId = String(b.target_id || "").trim();
  if (!rid || !clave) return J({ ok: false, error: "faltan reservation_id y clave" }, 400);

  let c: any = null;
  const rc = await sb(`apepe_correos?clave=eq.${encodeURIComponent(clave)}&sede=eq.${encodeURIComponent(prop)}&select=*&limit=1`);
  const cj = await rc.json().catch(() => []);
  c = Array.isArray(cj) && cj[0] ? cj[0] : null;
  if (!c) {
    const r2 = await sb(`apepe_correos?clave=eq.${encodeURIComponent(clave)}&select=*&limit=1`);
    const j2 = await r2.json().catch(() => []);
    c = Array.isArray(j2) && j2[0] ? j2[0] : null;
  }
  if (!c) return J({ ok: false, error: "ese correo no existe" }, 404);
  if (c.activo === false) return J({ ok: false, error: "ese correo está apagado en el panel" }, 409);

  const rv = await reserva(rid, prop);
  if (!rv) return J({ ok: false, error: "no encontré la reserva en Cloudbeds" }, 404);

  const forzarIdioma = String(b.idioma || "").toLowerCase();
  const idioma: "es" | "en" = forzarIdioma === "en" ? "en" : (forzarIdioma === "es" ? "es" : (idiomaDe(rv) as "es" | "en"));

  const dic = await diccionario(rv, rid, prop, idioma, clave, targetId);
  /* El correo de upgrade sin cuarto destino no se manda: sería anunciarle un
     cambio sin decirle a dónde. */
  if (clave === "upgrade" && !dic["{{cuarto_nuevo}}"]) {
    return J({ ok: false, error: "Elige a qué cuarto sube antes de mandarle el correo de upgrade." }, 422);
  }
  const html = armar(c, dic, prop, ligaBoton(clave, dic), idioma);
  const asunto = rellena(textos(c, idioma).asunto, dic);

  const encendido = (await config("apepe_envio_activo")).toLowerCase() === "true";
  const forzado = String(b.a || "").trim();
  const modo = forzado ? "revision" : (encendido ? "real" : "prueba");
  const a = forzado || (encendido ? rv.correo : (PROP[prop] || PROP.cdmx).buzon);
  if (!a) return J({ ok: false, error: "la reserva no tiene correo" }, 422);

  const env = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: REMITENTE[prop] || REMITENTE.cdmx,
      to: [a],
      subject: modo === "real" ? asunto : `[${PIE[idioma].prueba}] ${asunto}`,
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
      resultado: bien ? "ok" : "error",
      detalle: detalle ?? `idioma ${idioma}${rv.pais ? ` · país ${rv.pais}` : " · sin país"}`,
      por: quien.email,
    }),
  }).catch(() => {});

  if (!bien) return J({ ok: false, error: detalle }, 502);
  const aviso = modo === "prueba"
    ? "El interruptor de envío está apagado: esto salió a la recepción, no al huésped."
    : (modo === "revision" ? "Mandado a la dirección que pediste, para revisarlo. Al huésped no le llegó." : null);
  return J({ ok: true, modo, a, asunto, sede: prop, idioma, pais: rv.pais || null, saludo: dic["{{bienvenido}}"], aviso });
});
