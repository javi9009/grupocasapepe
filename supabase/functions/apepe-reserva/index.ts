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

function mapear(d: any) {
  const gl = d.guestList && typeof d.guestList==="object" ? Object.values(d.guestList) as any[] : [];
  const main = gl.find((g:any)=>g.isMainGuest) || gl[0] || {};
  const rooms = [ ...(Array.isArray(d.assigned)?d.assigned:[]), ...(Array.isArray(d.unassigned)?d.unassigned:[]) ];
  let adultos=0, menores=0; const habs = new Set<string>();
  for (const r of rooms) { adultos += Number(r.adults||0); menores += Number(r.children||0); if (r.roomTypeName) habs.add(r.roomTypeName); }
  const pax = (adultos+menores) || gl.length || 1;
  const roomTypeName = [...habs][0] || main.roomTypeName || "";
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
    desayuno: /b&b|breakfast|desayuno/i.test(roomTypeName) ? true : null,
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
  const reserva = mapear(d);
  const [loyalty, notas, resenas] = await Promise.all([
    historial(reserva.nombre, reserva.reservation_id),
    notasReserva(key, String(pid), reservationId),
    resenasPrevias(reserva.nombre, propKey),
  ]);
  return J({ ok:true, reserva, loyalty, notas, resenas });
});
