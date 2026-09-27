// apepe-recepcion — tablero de recepción.
//  - Sin reservation_id: lista llegadas (residencias RPC + Cloudbeds getReservations)
//    con semáforo y enriquecidas con FIDELIDAD del CRM (crm_contactos por email).
//  - Con reservation_id: detalle enriquecido de una reserva (bandera, tipo de viaje,
//    OTA, fidelidad) leyendo getReservation + crm_contactos.
//
// Contención 27-sep-2026: solo el equipo (sesión de colaborador o servidor).
// Antes cualquiera sin sesión sacaba la lista de llegadas con correos.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPS: Record<string, { keyEnv: string; id?: string; idEnv?: string; sede: string }> = {
  cdmx: { keyEnv: "CLOUDBEDS_API_KEY", id: "10668", sede: "cdmx" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA", sede: "puebla" },
};
const VIVAS = new Set(["confirmed", "checked_in", "not_confirmed", "pending"]);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const norm = (e: unknown) => String(e || "").trim().toLowerCase();
const interno = (e: string) => !e || e === "n/a" || e.endsWith("@casapepe.mx");

function tierPepe(est: number, noches: number, unidades: unknown) {
  const u = Array.isArray(unidades) ? unidades.map((x) => String(x).toLowerCase()) : [];
  const viajero = u.indexOf("cdmx") >= 0 && u.indexOf("puebla") >= 0;
  let tier: string | null = null;
  if (est > 10 && noches > 15) tier = "fiel_gold";
  else if (est > 5 && noches > 10) tier = "gold";
  else if (est > 3 && noches > 7) tier = "bronce";
  else if (noches > 10) tier = "residente";
  else if (est > 1) tier = "recurrente";
  return { tier, viajero };
}

async function crmPorEmails(emails: string[]) {
  const map: Record<string, any> = {};
  const uniq = [...new Set(emails.map(norm).filter((e) => !interno(e)))];
  for (let i = 0; i < uniq.length; i += 80) {
    const chunk = uniq.slice(i, i + 80);
    const q = `${SB_URL}/rest/v1/crm_contactos?select=email,num_estancias,noches_totales,unidades,pais,primera_estancia,ultima_estancia&email=in.(${chunk.map((e) => '"' + e + '"').join(",")})`;
    const r = await fetch(q, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }).then((x) => x.json()).catch(() => []);
    for (const c of (Array.isArray(r) ? r : [])) if (!map[norm(c.email)]) map[norm(c.email)] = c;
  }
  return map;
}
function fidDe(c: any) {
  if (!c) return null;
  const t = tierPepe(c.num_estancias || 0, c.noches_totales || 0, c.unidades);
  return { est: c.num_estancias || 0, noches: c.noches_totales || 0, tier: t.tier, viajero: t.viajero, pais: c.pais || "", primera: c.primera_estancia || null, ultima: c.ultima_estancia || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado();
  let body: any = {}; try { body = await req.json(); } catch {}

  // ----- DETALLE de una reserva de Cloudbeds -----
  if (body.reservation_id) {
    const prop = String(body.prop ?? "cdmx");
    const cfg = PROPS[prop] ?? PROPS.cdmx;
    const key = Deno.env.get(cfg.keyEnv); const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
    if (!key || !pid) return J({ ok: false, error: "sin credenciales" }, 500);
    const r = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(String(body.reservation_id))}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${key}` } });
    const dj = await r.json().catch(() => ({}));
    const d = dj?.data ?? dj;
    if (!d) return J({ ok: false, error: "no se pudo leer" }, 502);
    const gl = d.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as any[] : [];
    const main = gl.find((g: any) => g.isMainGuest) || gl[0] || {};
    const rooms = [...(Array.isArray(d.assigned) ? d.assigned : []), ...(Array.isArray(d.unassigned) ? d.unassigned : [])];
    let ad = 0, ni = 0; for (const rm of rooms) { ad += Number(rm.adults || 0); ni += Number(rm.children || 0); }
    const email = main.guestEmail || d.guestEmail || "";
    const crm = (await crmPorEmails([email]))[norm(email)];
    return J({ ok: true, detalle: {
      nombre: d.guestName || "", pais: main.guestCountry || "", adultos: ad, ninos: ni,
      fuente: d.source || d.sourceName || "", email, cb_status: d.status || "", fid: fidDe(crm),
    } });
  }

  // ----- LISTA del tablero -----
  const dias = Math.min(Number(body.dias ?? 21), 60);
  const prop = String(body.prop ?? "cdmx");
  const filas: any[] = [];
  try {
    const rr = await fetch(`${SB_URL}/rest/v1/rpc/apepe_recepcion_tablero`, {
      method: "POST", headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_dias: dias }),
    });
    const arr = await rr.json();
    if (Array.isArray(arr)) for (const x of arr) filas.push({ ...x, source: "residencia", sede: "virreyes", fuente: x.fuente ?? "Residencias", email: x.email || "" });
  } catch {}

  const porRid = new Map<string, any>();
  try {
    const ck = await fetch(`${SB_URL}/rest/v1/apepe_checkin?select=id,estado,created_at,acompanantes,doc_datos&order=created_at.desc&limit=800`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }).then((r) => r.json());
    for (const c of (Array.isArray(ck) ? ck : [])) { const rid = c?.doc_datos?.reserva_id; if (rid && !porRid.has(String(rid))) porRid.set(String(rid), c); }
  } catch {}

  const hoy = new Date(); hoy.setUTCHours(12, 0, 0, 0);
  const desde = iso(hoy), hasta = iso(new Date(hoy.getTime() + dias * 86400000));
  const props = prop === "all" ? ["cdmx", "puebla"] : [prop];
  for (const pk of props) {
    const cfg = PROPS[pk]; if (!cfg) continue;
    const key = Deno.env.get(cfg.keyEnv); const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
    if (!key || !pid) continue;
    let page = 1;
    while (page <= 10) {
      const u = new URL(`${CB}/getReservations`);
      u.searchParams.set("propertyID", pid); u.searchParams.set("checkInFrom", desde); u.searchParams.set("checkInTo", hasta);
      u.searchParams.set("pageSize", "100"); u.searchParams.set("pageNumber", String(page));
      const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } });
      const j = await r.json().catch(() => ({}));
      const data = Array.isArray(j.data) ? j.data : [];
      for (const x of data) {
        const status = String(x.status);
        if (!VIVAS.has(status)) continue;
        const rid = String(x.reservationID);
        const c = porRid.get(rid);
        const semaforo = c ? (c.estado === "validado" ? "verde" : "naranja") : (status === "checked_in" ? "fisico" : "gris");
        const via = c ? "online" : (status === "checked_in" ? "fisico" : null);
        filas.push({
          source: "cloudbeds", sede: cfg.sede, reservation_id: rid,
          nombre: x.guestName || "", nacionalidad: "", fuente: x.sourceName || x.source || "",
          email: x.guestEmail || x.email || "",
          desde: x.startDate || "", hasta: x.endDate || "", cb_status: status,
          checkin_id: c ? c.id : null, estado: c ? c.estado : null, hecho_at: c ? c.created_at : null,
          n_acompanantes: c && Array.isArray(c.acompanantes) ? c.acompanantes.length : 0,
          via, hecho: !!via, semaforo,
        });
      }
      if (data.length < 100) break; page++;
    }
  }

  // FIDELIDAD por email (una sola tanda de consultas al CRM)
  const crm = await crmPorEmails(filas.map((f) => f.email));
  for (const f of filas) { const c = crm[norm(f.email)]; f.fid = fidDe(c); if (c && !f.pais) f.pais = c.pais || ""; }

  filas.sort((a, b) => String(a.desde).localeCompare(String(b.desde)) || String(a.nombre).localeCompare(String(b.nombre)));
  return J(filas);
});
