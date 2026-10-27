// hk-extension — la extensión la vende quien está en el cuarto, no recepción.
//
// La recamarista es quien se entera de que el huésped se quiere quedar: está ahí,
// con la ropa sin recoger y la mochila abierta. Hasta hoy eso terminaba en "pues
// baja a recepción", y a recepción no baja todo el mundo. Aquí vende ella.
//
// NO SE REESCRIBE EL MOTOR. Las camas, las noches, la escalera de alternativas y
// el cobro ya los resuelve `apepe-extender`, que lleva semanas funcionando contra
// Cloudbeds. Esta función le habla a esa, y encima pone lo que la venta de mostrador
// no tenía: quién la vendió, la firma del huésped, el correo que la hace válida y
// los $25 por noche que van a la bolsa común de housekeeping.
//
// Tres puertas:
//   ocupadas  → qué camas están ocupadas esta noche y quién duerme en cada una
//   opciones  → la escalera de ese huésped (noches × dónde duerme), tal cual
//   vender    → ejecuta la extensión, guarda la firma, manda el correo y apunta la comisión
//
// Javi, 6-oct-2026.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB  = "https://hotels.cloudbeds.com/api/v1.2";
const SB  = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("CASAPEPE_FROM") || "Casa Pepe <javi@casapepe.mx>";
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };

const PROP: Record<string, { keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx:   { keyEnv: "CLOUDBEDS_API_KEY", id: "10668" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};
/* El panel trabaja con el uuid de la propiedad y la app del huésped con el slug.
   Se aceptan los dos para que nadie tenga que traducir en la pantalla. */
const UUID2SLUG: Record<string, string> = {
  "45e69775-d877-4507-a9e1-a45bd3400dc5": "cdmx",
  "febfbef6-7fd1-4b45-84d9-13533e8dcb72": "puebla",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TZ = "America/Mexico_City";
const hoyMX = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const masDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dias = (a: string, b: string) => { try { return Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000); } catch { return 0; } };
const money = (n: number) => "$" + Number(n || 0).toLocaleString("es-MX");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

async function rest(p: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + p, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(p + " " + r.status + " " + t.slice(0, 160));
  return t ? JSON.parse(t) : null;
}
async function cfg(clave: string, porDefecto: string) {
  try {
    const x = await rest(`apepe_config?clave=eq.${encodeURIComponent(clave)}&select=valor&limit=1`);
    const v = Array.isArray(x) && x[0] ? String(x[0].valor ?? "") : "";
    return v === "" ? porDefecto : v;
  } catch { return porDefecto; }
}
const cbGet = async (key: string, path: string) =>
  await fetch(`${CB}/${path}`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => ({}));

/* Hablarle al motor. Va con la llave de servicio porque apepe-extender no pide
   sesión: la puerta la guardamos aquí, que es donde se sabe quién vende. */
async function motor(body: Record<string, unknown>) {
  const r = await fetch(`${SB}/functions/v1/apepe-extender`, {
    method: "POST",
    headers: { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({ ok: false, error: "el motor no contestó" }));
}

function slugDe(b: any) {
  const p = String(b.prop || b.property || b.property_id || "cdmx");
  return UUID2SLUG[p] || (PROP[p] ? p : "cdmx");
}
function credenciales(slug: string) {
  const c = PROP[slug] || PROP.cdmx;
  const key = Deno.env.get(c.keyEnv) || "";
  const pid = c.id ?? Deno.env.get(c.idEnv ?? "") ?? "";
  return { key, pid };
}

/** El uuid de la casa, que es como la conocen las tablas del panel. */
async function casaUuid(slug: string) {
  const { pid } = credenciales(slug);
  if (!pid) return null;
  try {
    const p = await rest(`properties?cloudbeds_property_id=eq.${encodeURIComponent(pid)}&select=id&limit=1`);
    return Array.isArray(p) && p[0] ? String(p[0].id) : null;
  } catch { return null; }
}
/** cloudbeds_room_id → el nombre de la cama tal como sale en el reparto de housekeeping. */
async function camasDeLaCasa(slug: string) {
  const uuid = await casaUuid(slug);
  if (!uuid) return null;
  const r = await rest(`hk_areas?property_id=eq.${uuid}&cloudbeds_room_id=not.is.null&select=cloudbeds_room_id,cloudbeds_room_name,nombre`);
  const m: Record<string, string> = {};
  for (const a of (r || [])) m[String(a.cloudbeds_room_id)] = String(a.cloudbeds_room_name || a.nombre || "");
  return m;
}

/* ---------- QUIÉN DUERME EN CADA CAMA ESTA NOCHE ----------
   La recamarista no busca por número de reserva: está parada delante de la cama.
   Así que la lista va por cama, con el nombre de quien duerme ahí y el día que se
   va, que es lo que decide a quién le pregunta. */
async function ocupadas(slug: string) {
  const { key, pid } = credenciales(slug);
  if (!key || !pid) return { ok: false, error: "sin credenciales" };
  const hoy = hoyMX();
  const filas: any[] = [];
  const vistas = new Set<string>();

  for (let p = 1; p <= 4; p++) {
    const j = await cbGet(key, `getReservationsWithRateDetails?propertyID=${pid}&resultsFrom=${masDias(hoy, -40)}&resultsTo=${masDias(hoy, 1)}&pageSize=100&pageNumber=${p}`);
    const d = Array.isArray(j?.data) ? j.data : [];
    for (const r of d) {
      const st = String(r.status || "").toLowerCase();
      if (/cancel|no_show|void|checked_out/.test(st)) continue;
      /* LAS FECHAS NO SE LLAMAN COMO UNO CREE.
         Esta llamada NO devuelve startDate/endDate —eso es getReservations—:
         devuelve reservationCheckIn y reservationCheckOut. Leyendo el nombre
         equivocado las dos fechas salían vacías, el filtro de «quién duerme hoy»
         no dejaba pasar a nadie y la pantalla decía «no hay nadie en casa» con la
         casa llena. Probado contra la casa: 25 reservas esta noche, 27 camas.
         Javi, 7-oct-2026. */
      const llega = String(r.reservationCheckIn || r.startDate || "").slice(0, 10);
      const sale  = String(r.reservationCheckOut || r.endDate || "").slice(0, 10);
      if (!llega || !sale) continue;
      if (!(llega <= hoy && hoy < sale)) continue;           // en casa esta noche
      const nombreResv = String(r.guestName || "").trim() ||
        `${r.guestFirstName ?? ""} ${r.guestLastName ?? ""}`.trim();
      for (const rm of (Array.isArray(r.rooms) ? r.rooms : [])) {
        const roomID = String(rm.roomID || "");
        if (!roomID || vistas.has(roomID)) continue;
        vistas.add(roomID);
        filas.push({
          room_id: roomID,
          cama: String(rm.roomName || rm.roomNumber || roomID),
          reservation_id: String(r.reservationID || ""),
          /* Cada cama trae el nombre de quien duerme EN ELLA. En una reserva de
             tres, el de la reserva es uno solo y los otros dos no se llamarían
             así delante del huésped. */
          huesped: String(rm.guestName || "").trim() || nombreResv || "Huésped",
          llega: String(rm.roomCheckIn || llega).slice(0, 10),
          sale: String(rm.roomCheckOut || sale).slice(0, 10),
          le_quedan: dias(hoy, String(rm.roomCheckOut || sale).slice(0, 10)),
        });
      }
    }
    if (d.length < 100) break;
  }
  /* El nombre de la cama, el que ella ve en su reparto. Cloudbeds no siempre lo
     manda dentro de la reserva, y aunque lo mande, el que conoce la recamarista es
     el de hk_areas: si en su lista pone "4MD(241)", eso es lo que tiene que leer
     aquí, no un número de cuarto suelto. */
  try {
    const mapa = await camasDeLaCasa(slug);
    if (mapa) filas.forEach((f) => { if (mapa[f.room_id]) f.cama = mapa[f.room_id]; });
  } catch { /* el nombre de Cloudbeds sirve igual */ }

  filas.sort((a, b) => (a.sale === b.sale ? a.cama.localeCompare(b.cama) : a.sale.localeCompare(b.sale)));

  /* Las que ya tienen una extensión pedida se marcan: preguntarle dos veces al
     mismo huésped es quedar mal, y cobrarle dos veces es peor. */
  try {
    const rids = [...new Set(filas.map((f) => f.reservation_id))].filter(Boolean);
    if (rids.length) {
      const ya = await rest(`apepe_extension?reservation_id=in.(${rids.map((x) => `"${x}"`).join(",")})&select=reservation_id,estado,salida_despues,monto`);
      const m: Record<string, any> = {};
      for (const e of (ya || [])) m[String(e.reservation_id)] = e;
      filas.forEach((f) => { if (m[f.reservation_id]) f.ya_extendida = m[f.reservation_id]; });
    }
  } catch { /* si no se puede mirar, se sigue: es un aviso, no un muro */ }

  return { ok: true, fecha: hoy, camas: filas };
}

/* ---------- LA FIRMA ---------- */
function bytesDe(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  return u;
}
async function subeFirma(opKey: string, dataUrl: string) {
  try {
    const ruta = `extensiones/${opKey.replace(/[^\w.-]/g, "_")}.png`;
    const r = await fetch(`${SB}/storage/v1/object/apepe-docs/${ruta}?upsert=true`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "image/png" },
      body: bytesDe(dataUrl),
    });
    return r.ok ? ruta : null;
  } catch { return null; }
}

/* ---------- EL IDIOMA DEL HUÉSPED ----------
   Misma regla que `apepe-correo-enviar`, y a propósito: si a alguien le llega
   la confirmación de su reserva en inglés, el papel de su extensión no puede
   llegarle en español. Cloudbeds no guarda en qué idioma habla, así que se
   deduce del país que puso al reservar y, si lo dejó vacío —pasa mucho en las
   OTAs—, del prefijo de su móvil, que casi nunca miente. 27-oct-2026. */
const PAISES_ES = new Set(["MX","ES","AR","CO","CL","PE","UY","VE","EC","BO","PY","CR","PA","GT","HN","SV","NI","DO","CU","PR","GQ"]);
const PREFIJOS_ES = ["+52","+34","+54","+57","+56","+51","+598","+58","+593","+591","+595","+506","+507","+502","+504","+503","+505","+53"];
function idiomaDe(pais?: string, telefono?: string): "es" | "en" {
  const p = String(pais || "").toUpperCase().trim();
  if (p) return PAISES_ES.has(p) ? "es" : "en";
  const t = String(telefono || "").replace(/[^0-9+]/g, "");
  if (t.startsWith("+")) {
    for (const pre of PREFIJOS_ES) if (t.startsWith(pre)) return "es";
    return "en";
  }
  return "es";
}

/* ---------- EL CORREO QUE LA HACE VÁLIDA ----------
   Javi: "se envía mail al cliente con la cantidad y la reserva para que tenga
   validez". No es un acuse de cortesía: es el papel de lo que acaba de firmar con
   el dedo en un teléfono que no es suyo.

   Va en UN idioma. Antes iba en español con un párrafo-resumen en inglés
   debajo, y ese resumen decía menos que el correo: no traía el nombre, ni
   quién lo vendió, ni a quién reclamar. Un huésped que no lee español se
   quedaba con la mitad del papel. 27-oct-2026. */
const TX = {
  es: {
    titulo: "Te quedas con nosotros",
    entrada: (n: string, noches: number) =>
      `${n}, acabas de extender tu estancia ${noches > 1 ? `${noches} noches` : "una noche"} más. Esto es lo que quedó registrado en tu reserva.`,
    reserva: "Reserva",
    donde: "Dónde duermes",
    noches: "Noches",
    salida: "Nueva salida",
    total: "Total de la extensión",
    descuento: "El precio ya lleva tu descuento SuperPepe.",
    ahorro: (m: string) => `Te ahorras ${m} sobre la tarifa del día.`,
    saldo: "El importe queda como saldo pendiente en tu cuenta: lo pagas en recepción cuando bajes.",
    mueve: "🧳 Para esta extensión te cambiamos de cama. Deja tus cosas juntas y listas: te las movemos nosotros. Pasa por recepción por tu nueva llave.",
    gestiono: (q: string) => `Lo gestionó ${q} y lo firmaste desde su teléfono. Si algo no cuadra, dínoslo en recepción antes de tu salida.`,
    equipo: "el equipo de la casa",
    gracias: "¡Gracias por escoger Casa Pepe!",
    asunto: (f: string) => `Tu extensión en Casa Pepe · hasta el ${f}`,
  },
  en: {
    titulo: "You're staying with us",
    entrada: (n: string, noches: number) =>
      `${n}, you have just extended your stay by ${noches > 1 ? `${noches} nights` : "one night"}. This is what went on your booking.`,
    reserva: "Booking",
    donde: "Where you sleep",
    noches: "Nights",
    salida: "New check-out",
    total: "Extension total",
    descuento: "The price already includes your SuperPepe discount.",
    ahorro: (m: string) => `You save ${m} on the day's rate.`,
    saldo: "The amount stays as a balance on your account: you pay it at the front desk on your way down.",
    mueve: "🧳 For this extension we are moving you to another bed. Leave your things together and ready: we'll move them for you. Pick up your new key at the front desk.",
    gestiono: (q: string) => `${q} handled it and you signed from their phone. If something doesn't add up, tell us at the front desk before you check out.`,
    equipo: "the house team",
    gracias: "Thanks for choosing Casa Pepe!",
    asunto: (f: string) => `Your extension at Casa Pepe · until ${f}`,
  },
} as const;

function correoHtml(d: any) {
  const t = TX[(d.idioma === "en" ? "en" : "es") as "es" | "en"];
  const linea = (k: string, v: string) =>
    `<tr><td style="padding:7px 0;color:#6B6459;font-size:13px">${esc(k)}</td><td style="padding:7px 0;text-align:right;font-weight:700;color:#2b2622;font-size:14px">${esc(v)}</td></tr>`;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f2efe9;padding:26px 14px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:26px 24px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#cd9a4b;font-weight:700">Casa Pepe</div>
    <h1 style="margin:8px 0 4px;font-size:21px;color:#2b2622">${esc(t.titulo)}</h1>
    <p style="margin:0 0 16px;color:#6B6459;font-size:14px;line-height:1.55">
      ${esc(t.entrada(String(d.huesped || ""), Number(d.noches || 0)))}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4ded3;border-bottom:1px solid #e4ded3;margin-bottom:16px">
      ${linea(t.reserva, d.reservation_id)}
      ${linea(t.donde, d.donde)}
      ${linea(t.noches, String(d.noches))}
      ${linea(t.salida, d.nueva_salida)}
      ${linea(t.total, money(d.monto) + " MXN")}
    </table>
    <p style="margin:0 0 14px;color:#2b2622;font-size:14px;line-height:1.55">
      <b>${esc(t.descuento)}</b> ${d.ahorro > 0 ? esc(t.ahorro(money(d.ahorro))) : ""}
      ${esc(t.saldo)}</p>
    ${d.mueve_cosas ? `<p style="margin:0 0 14px;background:#fbf0dc;border-radius:10px;padding:12px 14px;color:#8a6420;font-size:13.5px;line-height:1.5">
      ${esc(t.mueve)}</p>` : ""}
    <p style="margin:0 0 6px;color:#6B6459;font-size:13.5px;line-height:1.55">
      ${esc(t.gestiono(String(d.vendedor_nombre || t.equipo)))}</p>
    <p style="margin:14px 0 0;color:#2b2622;font-size:14px">${esc(t.gracias)}</p>
  </div></div>`;
}

async function mandaCorreo(to: string, d: any) {
  if (!RESEND || !to) return { ok: false, error: "sin correo" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to],
      subject: TX[(d.idioma === "en" ? "en" : "es") as "es" | "en"].asunto(String(d.nueva_salida || "")),
      html: correoHtml(d),
    }),
  });
  if (!r.ok) return { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 160)}` };
  return { ok: true };
}

/* ---------- LA BOLSA ----------
   No es de quien vendió: es del grupo. Housekeeping y áreas públicas cobran por
   días trabajados al cierre del mes (v_hk_bolsa_mes). Áreas públicas entra porque
   también está delante del huésped y también apoya. Javi, 6-oct. */
async function apuntaComision(opKey: string, slug: string, noches: number, b: any, detalle: any) {
  const canal = String(b.canal || "housekeeping");
  const permitidos = (await cfg("extension_comision_canales", "housekeeping,areas_publicas")).split(",").map((x) => x.trim());
  if (!permitidos.includes(canal)) return { comision: 0, motivo: "canal sin comisión" };
  const porNoche = Number(await cfg("extension_comision_noche", "25")) || 0;
  const monto = porNoche * Math.max(1, Number(noches || 1));
  if (monto <= 0) return { comision: 0 };
  const hoy = hoyMX();
  const property_id = await casaUuid(slug);   // si no se sabe, la bolsa se apunta igual
  try {
    await rest(`hk_bolsa_movimientos?on_conflict=concepto,referencia`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        property_id, property: slug, mes: hoy.slice(0, 8) + "01",
        concepto: "extension", referencia: opKey,
        monto, unidades: noches,
        vendido_por: b.vendedor || null, vendido_por_nombre: b.vendedor_nombre || null,
        canal, detalle,
      }),
    });
    return { comision: monto, por_noche: porNoche };
  } catch (e) { return { comision: 0, error: String(e) }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);

  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado("Esto lo vende el equipo de la casa: inicia sesión en Soy Pepe.");

  try {
    const b: any = await req.json().catch(() => ({}));
    const op = String(b.op || "ocupadas");
    const slug = slugDe(b);

    if (op === "ocupadas") return J(await ocupadas(slug));

    const rid = String(b.reservation_id || "");
    if (!rid) return J({ ok: false, error: "falta la reserva" }, 400);

    if (op === "opciones") return J(await motor({ reservation_id: rid, prop: slug }));

    if (op !== "vender") return J({ ok: false, error: "no sé hacer eso" }, 400);

    // ---- VENDER ----
    const noches = Number(b.noches || 0);
    if (!noches) return J({ ok: false, error: "faltan las noches" }, 400);
    if (!b.firma) return J({ ok: false, error: "falta la firma del huésped" }, 400);

    /* El huésped, antes de tocar nada: el correo y el nombre salen de la reserva,
       no de lo que se teclee en el teléfono. */
    const { key, pid } = credenciales(slug);
    const gr = await cbGet(key, `getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
    const dres = gr?.data ?? gr ?? {};
    const gl = dres.guestList && typeof dres.guestList === "object" ? Object.values(dres.guestList) as any[] : [];
    const main = gl.find((g: any) => g.isMainGuest) || gl[0] || {};
    const huesped = String(dres.guestName || `${main.guestFirstName ?? ""} ${main.guestLastName ?? ""}`).trim() || "Huésped";
    const correo = String(b.correo || dres.guestEmail || dres.email || main.guestEmail || "").trim();

    const r = await motor({ reservation_id: rid, prop: slug, op: "pedir", noches, alternativa: b.alternativa || "" });
    if (!r || !r.ok) return J({ ok: false, error: (r && (r.mensaje || r.error)) || "no se pudo extender", escalera: r?.escalera }, 409);
    if (r.ya) return J({ ok: true, ya: true, mensaje: "Esa extensión ya estaba pedida. Pásale por recepción." });

    const opKey = `${rid}:${r.nueva_salida}`;
    const firmaUrl = await subeFirma(opKey, String(b.firma));
    const documento = {
      texto: b.documento || null,
      huesped, reserva: rid, donde: r.donde, detalle: r.detalle,
      noches, nueva_salida: r.nueva_salida, monto: r.monto, superpepe: true,
    };

    try {
      await rest(`apepe_extension?op_key=eq.${encodeURIComponent(opKey)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          pedido_por: String(b.canal || "housekeeping"),
          canal: String(b.canal || "housekeeping"),
          vendido_por: b.vendedor || null,
          vendido_por_nombre: b.vendedor_nombre || null,
          firma_url: firmaUrl, firmado_at: new Date().toISOString(),
          correo_a: correo || null,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch { /* la extensión ya está hecha; esto es el sello, no el acto */ }

    const com = await apuntaComision(opKey, slug, noches, b, { huesped, reserva: rid, donde: r.donde, monto: r.monto });

    let correoRes: any = { ok: false, error: "sin correo del huésped" };
    if (correo) {
      correoRes = await mandaCorreo(correo, {
        huesped, reservation_id: rid, donde: `${r.donde}${r.detalle ? " · " + r.detalle : ""}`,
        noches, nueva_salida: r.nueva_salida, monto: r.monto, ahorro: r.ahorro || 0,
        mueve_cosas: !!r.mueve_cosas, vendedor_nombre: b.vendedor_nombre || "",
        idioma: idiomaDe(
          dres.guestCountry || main.guestCountry || dres.country || "",
          dres.guestPhone || main.guestPhone || dres.phone || "",
        ),
      });
      try {
        await rest(`apepe_extension?op_key=eq.${encodeURIComponent(opKey)}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify(correoRes.ok
            ? { correo_at: new Date().toISOString(), correo_error: null }
            : { correo_error: String(correoRes.error || "").slice(0, 200) }),
        });
      } catch { /* noop */ }
    }

    /* A recepción le llega sola en su lista de "extensiones por cobrar", que lee
       apepe_extension. Aquí solo se le toca el timbre a quien tenga buzón. */
    try {
      await rest(`notificaciones`, {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          titulo: `Extensión por cobrar · ${money(r.monto)}`,
          cuerpo: `${huesped} se queda ${noches} noche${noches > 1 ? "s" : ""} más (${r.donde}). La vendió ${b.vendedor_nombre || "housekeeping"}. Saldo pendiente en su cuenta.`,
          icono: "🧳", accion: "/m/apepe-recepcion.html",
        }),
      });
    } catch { /* noop */ }

    return J({
      ok: true, estado: "por_cobrar", op_key: opKey,
      huesped, noches, nueva_salida: r.nueva_salida, monto: r.monto, ahorro: r.ahorro || 0,
      donde: r.donde, detalle: r.detalle, mueve_cosas: !!r.mueve_cosas,
      recepcion_mueve: r.recepcion_mueve || null,
      firma_guardada: !!firmaUrl, correo: { a: correo, ...correoRes },
      comision: com, documento,
      mensaje: `Listo. ${huesped} se queda hasta el ${r.nueva_salida}. ${money(r.monto)} pendientes de pago en recepción.`,
    });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: String(e) }, 500);
  }
});
