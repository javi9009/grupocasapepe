// apepe-recepcion-mov — movimientos para el tablero de recepción (equipo).
//  - winbacks: quién solicitó winback (apepe_winback) con monto y estado.
//  - upgrades: los que el huésped ya cerró en la app y están PENDIENTES DE COBRO.
//  - movimientos: No-shows de AYER y ANTEAYER (no de hoy) + cancelados con penalización
//    (NR = retuvieron cargo). Sin cancelaciones a futuro (solo llegada <= hoy).
//
// Lo de los upgrades es el tramo que faltaba. El huésped confirmaba en la app, se
// guardaba en estado 'por_cobrar' con la promesa de "se paga en recepción al llegar"…
// y ahí moría: nadie en recepción lo veía y ninguna pantalla llamaba nunca a
// apepe-upgrade-aplicar, que es la única que mueve el cuarto en Cloudbeds. De ahí
// que el cuarto nunca cambiara. Javi, 28-sep.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!; const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRV, Authorization: "Bearer " + SRV };
const PROPS: Record<string, { keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { keyEnv: "CLOUDBEDS_API_KEY", id: "10668" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
function mxDate(off: number): string { const t = new Date(Date.now() - 6 * 3600 * 1000); t.setUTCDate(t.getUTCDate() + off); return t.toISOString().slice(0, 10); }
async function rest(p: string) { try { const r = await fetch(SB + "/rest/v1/" + p, { headers: H }); return r.ok ? await r.json() : []; } catch { return []; } }
async function cfgv(clave: string) { try { const c = await rest(`apepe_config?clave=eq.${clave}&select=valor&limit=1`); return Array.isArray(c) && c[0] ? String(c[0].valor || "") : ""; } catch { return ""; } }
async function cbList(key: string, pid: string, params: Record<string, string>) {
  const u = new URL(`${CB}/getReservations`); u.searchParams.set("propertyID", pid);
  for (const k in params) u.searchParams.set(k, params[k]); u.searchParams.set("pageSize", "100");
  try { const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } }); const j = await r.json().catch(() => ({})); return Array.isArray(j.data) ? j.data : []; } catch { return []; }
}
async function cbGet(key: string, pid: string, rid: string) {
  try { const r = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } }); const j = await r.json().catch(() => ({})); return j?.data ?? j; } catch { return {}; }
}

async function winbacks() {
  const rows = await rest(`apepe_winback?select=ota_reservation_id,property,estado,precio_ota,precio_directo,por,detalle,new_reservation_id,updated_at&order=updated_at.desc&limit=100`);
  return (Array.isArray(rows) ? rows : []).map((w: any) => ({
    reservation_id: String(w.ota_reservation_id || ""), property: w.property || "cdmx", estado: w.estado || "",
    precio_ota: Number(w.precio_ota || 0), precio_directo: Number(w.precio_directo || 0),
    por: w.por || "", via: (w.detalle && w.detalle.via) || "",
    nombre: (w.detalle && w.detalle.plan && w.detalle.plan.nombre) || "",
    new_reservation_id: w.new_reservation_id || "", fecha: w.updated_at || "",
  }));
}

/* Nombre legible del cuarto destino, con la misma configuración que usa la app del
   huésped: si no, recepción ve un id de Cloudbeds y no sabe a qué lo va a subir. */
function nombreCuarto(cfg: any, id: string): string {
  const s = String(id);
  if (cfg?.privada_entrada && String(cfg.privada_entrada.id) === s) return cfg.privada_entrada.nombre || s;
  const su = (cfg?.suites || []).find((x: any) => String(x.id) === s); if (su) return su.nombre || s;
  const d = (cfg?.dorms || {})[s];
  if (d) { const g = d.gen === "fem" ? "femenino" : d.gen === "queer" ? "queer" : "mixto"; return `Dormitorio de ${d.beds} camas ${g}`; }
  return s;
}

/* Los upgrades que el huésped ya cerró y recepción todavía no ha cobrado ni aplicado,
   más los aplicados de los últimos días para que se vea qué ya se cobró. */
async function upgrades(keys: string[]) {
  const desde = mxDate(-7);
  const rows = await rest(
    `apepe_upgrade_aplicado?estado=in.(por_cobrar,aplicado,aplicado_sin_cargo,error)` +
    `&updated_at=gte.${desde}T00:00:00Z` +
    `&select=id,op_key,reservation_id,property,clase,from_room,to_room,monto,estado,detalle,aplicado_por,updated_at` +
    `&order=updated_at.desc&limit=60`,
  );
  const lista = (Array.isArray(rows) ? rows : []).filter((r: any) => keys.includes(String(r.property || "cdmx")));
  if (!lista.length) return [];

  const cfgs: Record<string, any> = {};
  for (const pk of keys) { try { cfgs[pk] = JSON.parse((await cfgv(`apepe_upgrade_${pk}`)) || "{}"); } catch { cfgs[pk] = {}; } }

  /* Una llamada por reserva, sólo para las pendientes: son pocas y necesitamos el
     nombre del huésped y las fechas para que recepción sepa a quién está cobrando. */
  const pend = lista.filter((r: any) => r.estado === "por_cobrar").slice(0, 20);
  const info: Record<string, any> = {};
  await Promise.all(pend.map(async (r: any) => {
    const pk = String(r.property || "cdmx"); const cfg = PROPS[pk]; if (!cfg) return;
    const key = Deno.env.get(cfg.keyEnv); const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? ""); if (!key || !pid) return;
    const d = await cbGet(key, pid, String(r.reservation_id));
    const gl = d?.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as any[] : [];
    const main = gl.find((g: any) => g.isMainGuest) || gl[0] || {};
    info[String(r.reservation_id)] = {
      nombre: [main.guestFirstName, main.guestLastName].filter(Boolean).join(" ") || d?.guestName || "",
      desde: d?.startDate || "", hasta: d?.endDate || "", cb_status: String(d?.status || ""),
    };
  }));

  return lista.map((r: any) => {
    const pk = String(r.property || "cdmx"); const i = info[String(r.reservation_id)] || {};
    const det = r.detalle || {};
    return {
      reservation_id: String(r.reservation_id), property: pk, estado: r.estado, clase: r.clase || "",
      de: nombreCuarto(cfgs[pk], r.from_room), a: nombreCuarto(cfgs[pk], r.to_room),
      to_room: String(r.to_room || ""), monto: Number(r.monto || 0),
      por_noche: Number(det.perNight || det.monto_noche || (det.plan && det.plan.monto_noche) || 0),
      noches: Number(det.noches || (det.plan && det.plan.noches) || 0),
      nombre: i.nombre || "", desde: i.desde || "", hasta: i.hasta || "", cb_status: i.cb_status || "",
      aplicado_por: r.aplicado_por || "", fecha: r.updated_at || "",
      problemas: Array.isArray(det.problemas) ? det.problemas : [],
    };
  });
}

async function movimientos(keys: string[]) {
  const anteayer = mxDate(-2); const ayer = mxDate(-1); const hoy = mxDate(0); const out: any[] = [];
  for (const pk of keys) {
    const cfg = PROPS[pk]; if (!cfg) continue;
    const key = Deno.env.get(cfg.keyEnv); const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
    if (!key || !pid) continue;
    // No-shows de ayer y anteayer (NO de hoy)
    const ns = await cbList(key, pid, { checkInFrom: anteayer, checkInTo: ayer });
    for (const x of ns) { const st = String(x.status || ""); if (st === "checked_in" || st === "checked_out" || /cancel/i.test(st)) continue;
      out.push({ reservation_id: String(x.reservationID), nombre: x.guestName || "", desde: x.startDate || "", hasta: x.endDate || "", property: pk, tipo: "noshow", nr: false, cb_status: st, penalidad: 0 }); }
    // Cancelados con llegada anteayer..hoy (sin futuro): NR si retuvieron cargo
    const canc = (await cbList(key, pid, { checkInFrom: anteayer, checkInTo: hoy, status: "canceled" })).slice(0, 20);
    const detalles = await Promise.all(canc.map((x: any) => cbGet(key, pid, String(x.reservationID))));
    canc.forEach((x: any, i: number) => { const d = detalles[i] || {}; const total = Number(d.total || 0); const bal = Number(d.balance || 0); const pagado = Math.max(0, total - bal);
      const nr = pagado > 0.5;
      out.push({ reservation_id: String(x.reservationID), nombre: x.guestName || d.guestName || "", desde: x.startDate || d.startDate || "", hasta: x.endDate || d.endDate || "", property: pk, tipo: "cancelado", nr, cb_status: "canceled", penalidad: nr ? Math.round(pagado) : 0 }); });
  }
  out.sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = await quienLlama(req); if (!q.equipo) return noAutorizado();
  let b: any = {}; try { b = await req.json(); } catch {}
  const prop = String(b.prop || "all"); const keys = prop === "all" ? ["cdmx", "puebla"] : [prop];
  const [wb, ups, mov] = await Promise.all([winbacks(), upgrades(keys), movimientos(keys)]);
  return J({ ok: true, winbacks: wb, upgrades: ups, movimientos: mov });
});
