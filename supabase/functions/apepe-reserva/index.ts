// apepe-reserva — lee una reserva de Cloudbeds para el check-in y el detalle de recepción.
// La app pasa un TOKEN opaco (check-in del huésped) o {rid,prop} (detalle de recepción).
// Devuelve también: notas de la reserva (Cloudbeds) y reseñas previas que podrían ser del huésped.
// No devuelve datos de tarjeta.
//
// Contención 27-sep-2026: el modo {rid,prop} solo para el equipo. Antes cualquiera
// recorría IDs de reserva y sacaba nombre, teléfono, nacimiento y documento.
// El modo token (liga del huésped) sigue público: el token es opaco y de un solo huésped.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROP: Record<string, { keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { keyEnv: "CLOUDBEDS_API_KEY", id: "10668" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};
const NAC: Record<string,string> = { MX:"Mexicana", US:"Estadounidense", CA:"Canadiense", ES:"Española", FR:"Francesa", DE:"Alemana", IT:"Italiana", GB:"Británica", AR:"Argentina", BR:"Brasileña", CL:"Chilena", CO:"Colombiana", PE:"Peruana", UY:"Uruguaya", VE:"Venezolana", EC:"Ecuatoriana", NL:"Neerlandesa", BE:"Belga", CH:"Suiza", PT:"Portuguesa", IE:"Irlandesa", AU:"Australiana", NZ:"Neozelandesa", JP:"Japonesa", CN:"China", KR:"Surcoreana", IN:"India", RU:"Rusa" };

const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{ ...CORS, "Content-Type":"application/json" } });

async function tokenLookup(tok: string) {
  const u = `${SB_URL}/rest/v1/apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`;
  const r = await fetch(u, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
  const j = await r.json().catch(()=>[]);
  return Array.isArray(j) && j[0] ? j[0] : null;
}

/* UNA PERSONA DENTRO DE UNA RESERVA DE GRUPO.
   Javi, 7-nov-2026: «que dentro de la reserva de Osiris abras un check-in para
   cada persona del rooming list, y que el check-in de estos chicos sea
   exactamente igual al de cualquier otro huésped, y que entren a SU app de
   cliente con SU QR, SU nombre y SU habitación».
   En Cloudbeds el grupo es UNA reserva —«Osiris - Lustrumfiesta», 62 adultos—
   y ahí se queda. Lo que cambia es el token: cada uno tiene el suyo, y cuando
   ese token es de alguien del rooming, la reserva que se le devuelve lleva SU
   nombre y SU cuarto en vez de los del grupo. Mismo circuito que cualquier
   huésped con su liga; sólo que sesenta ligas miran la misma reserva. */
async function personaDe(tok: string) {
  try {
    const u = `${SB_URL}/rest/v1/apepe_rooming?token=eq.${encodeURIComponent(tok)}` +
      `&baja=is.false&select=nombre,cuarto,grupo,nacionalidad&limit=1`;
    const r = await fetch(u, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
    const j = await r.json().catch(()=>[]);
    return Array.isArray(j) && j[0] ? j[0] : null;
  } catch { return null; }
}

async function historial(nombre: string, rid: string) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/apepe_cliente_historial`, { method:"POST",
      headers:{ apikey:SRV, Authorization:`Bearer ${SRV}`, "Content-Type":"application/json" },
      body: JSON.stringify({ p_nombre: nombre, p_excluir: rid }) });
    return await r.json();
  } catch { return null; }
}
async function resenasPrevias(nombre: string, prop: string) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/apepe_resenas_huesped`, { method:"POST",
      headers:{ apikey:SRV, Authorization:`Bearer ${SRV}`, "Content-Type":"application/json" },
      body: JSON.stringify({ p_nombre: nombre, p_prop: prop }) });
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}
async function notasReserva(key: string, pid: string, rid: string) {
  try {
    const r = await fetch(`${CB}/getReservationNotes?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json().catch(()=>({}));
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map((n:any)=>{
      const txt = String(n.reservationNote||"").trim();
      const firma = /signed the .*agreement|akia\.ai\/agreements/i.test(txt);
      return { autor: String(n.userName||""), fecha: String(n.dateCreated||""), texto: txt, tipo: firma ? "firma" : "nota" };
    }).filter((n:any)=>n.texto);
  } catch { return []; }
}

async function checkinHecho(tok: string) {
  try {
    const u = `${SB_URL}/rest/v1/apepe_checkin?select=id,estado,created_at&doc_datos->>reserva_token=eq.${encodeURIComponent(tok)}&order=created_at.desc&limit=1`;
    const r = await fetch(u, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
    const j = await r.json().catch(()=>[]);
    if (Array.isArray(j) && j[0]) return { id: j[0].id, estado: j[0].estado, fecha: j[0].created_at };
  } catch { /* best-effort */ }
  return null;
}

/* LO QUE YA SABEMOS DE EL. Javi, 19-oct-2026: "¿puedes guardar los ids de los
   que ya hicieron un check-in y dejar la info guardada?". Quien ya se registro
   con nosotros no tiene por que volver a fotografiar su pasaporte: su documento
   ya esta archivado en el bucket privado.
   Se busca por el correo QUE TRAE LA RESERVA -el que Cloudbeds tiene, no uno
   que escriba quien abra la liga-, asi que por aqui no sale el documento de
   nadie mas. Y sale el NUMERO, nunca la foto ni la firma: la imagen no cruza.
   Si falla, se devuelve null y el check-in sigue pidiendo la foto, como siempre. */
async function conocidoDe(email: string, tokActual: string) {
  const e = String(email || "").trim();
  if (!e || !e.includes("@")) return null;
  try {
    const u = `${SB_URL}/rest/v1/apepe_checkin?select=id,created_at,doc_tipo,doc_numero,nacionalidad,doc_datos` +
      `&doc_datos->>email=ilike.${encodeURIComponent(e)}&order=created_at.desc&limit=4`;
    const r = await fetch(u, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
    const j = await r.json().catch(()=>[]);
    if (!Array.isArray(j)) return null;
    const fila = j.find((x:any)=>
      String(x?.doc_datos?.reserva_token || "") !== tokActual && String(x?.doc_numero || "").trim());
    if (!fila) return null;
    const dd = fila.doc_datos || {};
    const num = String(fila.doc_numero || "").trim();
    return {
      checkin_id: fila.id,
      fecha: fila.created_at,
      doc_tipo: fila.doc_tipo || "",
      doc_numero: num,
      doc_pista: num.length > 4 ? ("•".repeat(Math.min(6, num.length - 4)) + num.slice(-4)) : num,
      nacionalidad: fila.nacionalidad || "",
      nombre: String(dd.nombre || ""),
      nacimiento: String(dd.nacimiento || ""),
      tel: String(dd.tel || ""),
      tel_prefijo: String(dd.tel_prefijo || ""),
      email: String(dd.email || ""),
      tiene_foto: !!(dd.id_foto || dd.reusa_de),
    };
  } catch { return null; }
}

/* EL NOMBRE DE LA TARIFA. Javi, 20-oct-2026: en la ficha no sale «si incluye
   desayuno». El desayuno no vive en el tipo de cuarto, vive en el plan de
   tarifa, y Cloudbeds lo nombra distinto según el endpoint. Se recogen todas
   las variantes que pueden venir y se dan tal cual a la ficha: que recepción
   lea la tarifa es más honesto que adivinarle el desayuno. */
const CLAVES_TARIFA = ["ratePlanNamePublic","ratePlanName","rateName","roomRateName","rate_plan_name","ratePlanNamePrivate"];
function tarifasDe(rooms: any[]) {
  const out = new Set<string>();
  for (const r of rooms) {
    for (const k of CLAVES_TARIFA) {
      const v = r && r[k];
      if (v && String(v).trim()) out.add(String(v).trim());
    }
  }
  return [...out];
}

function mapear(d: any) {
  const gl = d.guestList && typeof d.guestList==="object" ? Object.values(d.guestList) as any[] : [];
  const main = gl.find((g:any)=>g.isMainGuest) || gl[0] || {};
  const rooms = [ ...(Array.isArray(d.assigned)?d.assigned:[]), ...(Array.isArray(d.unassigned)?d.unassigned:[]) ];
  let adultos=0, menores=0; const habs = new Set<string>();
  for (const r of rooms) { adultos += Number(r.adults||0); menores += Number(r.children||0); if (r.roomTypeName) habs.add(r.roomTypeName); }
  const pax = (adultos+menores) || gl.length || 1;
  const roomTypeName = [...habs][0] || main.roomTypeName || "";
  const habitaciones = [...habs];
  const tarifas = tarifasDe(rooms);
  const total = Number(d.total||0), saldo = Number(d.balance||0);
  const cards = Array.isArray(d.cardsOnFile) ? d.cardsOnFile : [];
  let estado_pago = "Por confirmar";
  if (total <= 0) estado_pago = "Cortesía / sin cargo";
  else if (saldo <= 0) estado_pago = "Pagado";
  else if (cards.length) estado_pago = "Tarjeta en garantía · saldo pendiente";
  else estado_pago = "Sin método de pago · saldo pendiente";
  const pais = String(main.guestCountry||"").toUpperCase();
  const nac = main.guestNationality || NAC[pais] || pais || "";
  const noches = (()=>{ try { return Math.max(1, Math.round((new Date(d.endDate).getTime()-new Date(d.startDate).getTime())/86400000)); } catch { return 1; } })();
  const tipo_viaje = menores>0 ? "Familia" : (adultos>=3 ? "Grupo" : (adultos===2 ? "Pareja" : "Viaja solo"));
  /* Se mira el tipo de cuarto Y el nombre de la tarifa. Si ninguno lo dice, se
     devuelve null: null es «no consta», nunca «no lleva». */
  const dondeMirar = [roomTypeName, ...tarifas].join(" ");
  return {
    reservation_id: String(d.reservationID||""),
    fuente: d.source || d.thirdPartyIdentifier || "",
    status: d.status || "",
    nombre: [main.guestFirstName, main.guestLastName].filter(Boolean).join(" ") || d.guestName || "",
    email: main.guestEmail || d.guestEmail || "",
    telefono: main.guestCellPhone || main.guestPhone || "",
    nacionalidad: nac, pais,
    nacimiento: main.guestBirthdate || "",
    doc_tipo: main.guestDocumentType || "", doc_numero: main.guestDocumentNumber || "",
    desde: d.startDate || "", hasta: d.endDate || "", noches, pax, adultos, menores, tipo_viaje,
    habitacion: roomTypeName,
    habitaciones,
    cuartos: rooms.length,
    tarifa: tarifas[0] || "",
    tarifas,
    desayuno: /b&b|bed\s*&?\s*breakfast|breakfast|desayuno|con\s+desayuno/i.test(dondeMirar) ? true : null,
    fecha_reserva: d.dateCreated || "", hora_estimada: d.estimatedArrivalTime || "",
    pago: { estado: estado_pago, total, saldo, moneda: "MXN" },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok:false, error:"POST only" }, 405);
  let body:any = {}; try { body = await req.json(); } catch {}
  let reservationId = "", propKey = "cdmx";
  const tok = String(body.resv || body.token || "").trim();
  if (tok) {
    const row = await tokenLookup(tok);
    if (!row) return J({ ok:false, error:"reserva no encontrada" }, 404);
    reservationId = String(row.reservation_id); propKey = row.property || "cdmx";
  } else if (body.rid) {
    const q = await quienLlama(req);
    if (!q.equipo) return noAutorizado();
    reservationId = String(body.rid); propKey = String(body.prop||"cdmx");
  } else {
    return J({ ok:false, error:"falta el token o rid de la reserva" }, 400);
  }
  const cfg = PROP[propKey] || PROP.cdmx;
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? (cfg.idEnv ? Deno.env.get(cfg.idEnv) : undefined);
  if (!key || !pid) return J({ ok:false, error:`sin ${cfg.keyEnv} o propertyID` }, 500);
  const r = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(reservationId)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
  const dj = await r.json().catch(()=>({ success:false }));
  const d = dj?.data ?? dj;
  if (!d || (dj && dj.success === false)) return J({ ok:false, error: String(dj?.message ?? "no se pudo leer la reserva") }, 502);
  const reserva: any = mapear(d);

  /* SI ESTE TOKEN ES DE ALGUIEN DEL ROOMING, LA RESERVA ES SUYA.
     Se pone lo que es de él —su nombre, su cuarto, que viaja uno— y se BORRA
     lo que es del organizador: correo, teléfono, documento y nacimiento del
     titular del grupo. Sin esto, cincuenta y nueve chicos abrirían su check-in
     con los datos de otra persona ya puestos: el mismo fallo que se cazó el
     19-oct, cuando a Aranza le salió la reserva de Gloria.
     Va ANTES del Promise.all a propósito, para que `conocidoDe` reciba un
     correo vacío y no pueda traer el documento archivado del organizador. */
  const persona = tok ? await personaDe(tok) : null;
  if (persona) {
    reserva.nombre = persona.nombre || reserva.nombre;
    reserva.habitacion = persona.cuarto || reserva.habitacion;
    reserva.habitaciones = persona.cuarto ? [persona.cuarto] : reserva.habitaciones;
    reserva.cuarto = persona.cuarto || "";
    reserva.grupo = persona.grupo || "";
    if (persona.nacionalidad) reserva.nacionalidad = persona.nacionalidad;
    reserva.pax = 1; reserva.adultos = 1; reserva.menores = 0;
    reserva.cuartos = 1;
    reserva.tipo_viaje = "Grupo";
    reserva.email = ""; reserva.telefono = "";
    reserva.nacimiento = ""; reserva.doc_tipo = ""; reserva.doc_numero = "";
  }

  const [loyalty, notas, resenas, ya_checkin, conocido] = await Promise.all([
    historial(reserva.nombre, reserva.reservation_id),
    notasReserva(key, String(pid), reservationId),
    resenasPrevias(reserva.nombre, propKey),
    tok ? checkinHecho(tok) : Promise.resolve(null),
    tok ? conocidoDe(reserva.email, tok) : Promise.resolve(null),
  ]);
  return J({ ok:true, reserva, ya_checkin, conocido, loyalty, notas, resenas });
});
