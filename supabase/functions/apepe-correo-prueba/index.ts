// apepe-correo-prueba — manda a la gente de la casa una muestra de los correos
// del huésped, tal y como le llegan al cliente.
//
// Javi, 19-oct-2026: «necesito que envíes bien los mailings con el gif… no se ve».
//
// Por qué existe: la prueba se mandaba desde el conector de Gmail, que borra
// todas las etiquetas <img> antes de enviar. El correo llegaba sin portada, sin
// logo y con el botón envuelto en google.com/url. No era Gmail bloqueando
// imágenes: era el tubo de la prueba. Esto manda por Resend —el mismo camino que
// ya usan los correos de Sincrético y del Ateneo— desde recepcion.*@casapepe.mx,
// que es el remitente de verdad.
//
// Sólo sirve para esto: coge uno de los correos ya publicados en
// /apepe/correos/ y lo envía a direcciones @casapepe.mx. Ni plantillas sueltas,
// ni destinatarios de fuera.

const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const SITIO = "https://grupocasapepe.netlify.app";

const CORREOS: Record<string, { archivo: string; asunto: string }> = {
  "1":  { archivo: "01-confirmaci-n-de-la-reserva.html",        asunto: "Bienvenido. Tu reserva está confirmada" },
  "2":  { archivo: "02-reserva-pendiente-de-confirmaci-n.html", asunto: "Tu reserva está pendiente de confirmación" },
  "3":  { archivo: "03-no-pas-la-tarjeta.html",                 asunto: "Ups, no pasó tu tarjeta" },
  "4":  { archivo: "04-cancelaci-n.html",                       asunto: "Esta vez no nos vamos a ver" },
  "5":  { archivo: "05-termin-su-check-in.html",                asunto: "Listo. Ya casi llegas" },
  "6":  { archivo: "06-hay-que-repetir-un-documento.html",      asunto: "Se nos quedó un papel a medias" },
  "7":  { archivo: "07-llegas-ma-ana.html",                     asunto: "Ya casi llegas" },
  "8":  { archivo: "08-te-hicimos-un-upgrade.html",             asunto: "¿Cómo ves? Te hicimos un upgrade" },
  "9":  { archivo: "09-te-quedas-una-noche-m-s.html",           asunto: "¿Una noche más?" },
  "10": { archivo: "10-gracias-por-tu-estancia.html",           asunto: "Gracias por venir a vernos" },
};

const REMITENTE: Record<string, string> = {
  cdmx:   "Casa Pepe CDMX <recepcion.cdmx@casapepe.mx>",
  puebla: "Casa Pepe Puebla <recepcion.puebla@casapepe.mx>",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "sólo POST" }, 405);
  if (!RESEND) return json({ error: "falta RESEND_API_KEY" }, 500);

  let p: { n?: string | number; to?: string[]; sede?: string };
  try { p = await req.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  const ficha = CORREOS[String(p.n ?? "")];
  if (!ficha) return json({ error: "ese correo no existe" }, 400);

  // Sólo a la casa. Esta función no es un enviador de propósito general.
  const to = (p.to ?? []).map((x) => String(x).trim().toLowerCase())
    .filter((x) => /^[^@\s]+@casapepe\.mx$/.test(x));
  if (!to.length) return json({ error: "destinatarios: sólo @casapepe.mx" }, 400);

  const from = REMITENTE[String(p.sede ?? "cdmx")] ?? REMITENTE.cdmx;

  const r = await fetch(`${SITIO}/apepe/correos/${ficha.archivo}`);
  if (!r.ok) return json({ error: `no pude leer el correo (${r.status})` }, 502);
  let html = await r.text();

  // La banda negra de «PRUEBA» avisa a quien lo recibe de que no hay nadie
  // detrás; en el correo de verdad no está, y aquí se queda.
  html = html.replace(/<body[^>]*>/, '<body style="margin:0;padding:22px 10px;background:#EFEAE1">');

  const env = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `[PRUEBA ${p.n}/10] ${ficha.asunto}`,
      html,
      reply_to: "javi@casapepe.mx",
    }),
  });
  if (!env.ok) return json({ error: `resend ${env.status}: ${(await env.text()).slice(0, 200)}` }, 502);
  return json({ ok: true, enviado: to, desde: from, asunto: ficha.asunto });
});
