// Supabase Edge Function: reporte-dia  (v6)
// Reporte operativo del dia desde Cloudbeds con cache stale-while-revalidate.
//
// v6 (28-oct-2026): LA PUERTA. Javi vio a un ateneista -contacto@papitours.mx,
// Papi Tours, que no es empleado- dentro de Soy Pepe leyendo el reporte del
// dia. Al tirar del hilo resulto que no era solo el: esta funcion no preguntaba
// NADA. Estaba con verify_jwt en false y las dos pantallas que cuelgan de ella
// la llamaban con la llave publicable, que va escrita en el HTML de cada pagina
// publica de la casa. Con esa llave y un curl cualquiera salia cuanta gente
// duerme hoy en casa, las llegadas, las salidas, la ocupacion por tipo de
// cuarto y -cuando hay reservas con desayuno- los NOMBRES de los huespedes.
// Una llave publicable no es una sesion: no tiene dueño, y a quien no tiene
// dueño no se le puede preguntar quien es.
// Ahora se pregunta antes de calcular: quien llama tiene que traer su sesion,
// y esa sesion tiene que ser del equipo de la casa (es_equipo_casa). El socio,
// el ateneista, la productora, el hotelero y el candidato a Pepe tienen cada
// uno su sitio; la ocupacion de la casa no esta en ninguno de ellos. La llave
// de servicio sigue pasando, porque es secreta y es la que usa la casa por
// dentro.
//
// v5 (18-oct-2026): la ocupacion se calcula por CUARTO, no adivinando por el
// nombre del tipo de cuarto. Cinco correcciones, todas dentro de `occ`:
//   1. privada/dormitorio sale de `isPrivate` de getRooms, que es por cuarto.
//      El tipo de cuarto es el respaldo para los registros sin cuarto asignado,
//      y la regex de nombres solo se usa si getRooms falla. Se dice en que
//      modo fue en `occ_metodo`: "cuarto" o "nombre".
//   2. capacidad: privadas = cuartos con isPrivate; dorm = suma de maxGuests
//      de los no privados (camas). Ya no se usa roomTypeUnits de getRoomTypes.
//   3. el numerador de dorm cuenta CAMAS (una por registro de cuarto de
//      dormitorio; en Cloudbeds cada cama es su propio cuarto), no personas.
//      Arriba y abajo la misma unidad, igual que las privadas.
//   4. una reserva en checked_out ya no duerme esta noche: fuera del conteo de
//      ocupacion. salidas, llegadas, en_casa y desayunos se calculan igual que
//      antes, sin tocar.
//   5. el antiduplicados deduplica por (reservationID, reservationRoomID,
//      roomID), que no se cae cuando reservationRoomID viene vacio.
// La FORMA del payload NO cambia: las mismas claves de siempre, mas la nueva
// clave opcional `occ_metodo`. De aqui cuelgan SoyPepe, sp/index.html y el RPC
// panel_negocio.

const BASE_URL = Deno.env.get("CLOUDBEDS_BASE_URL") ?? "https://hotels.cloudbeds.com/api/v1.2";
const TZ = "America/Mexico_City";
const CACHE_TTL_SEG = 15 * 60;
const DETALLE_CONCURRENCIA = 8;

const VALID_STATUSES = new Set(["confirmed", "checked_in", "checked_out"]);

type PropConfig = { nombre: string; keyEnv: string; propertyId?: string; propertyIdEnv?: string };

const PROP_MAP: Record<string, PropConfig> = {
  "45e69775-d877-4507-a9e1-a45bd3400dc5": { nombre: "CDMX", keyEnv: "CLOUDBEDS_API_KEY", propertyId: "10668" },
  "febfbef6-7fd1-4b45-84d9-13533e8dcb72": { nombre: "Puebla", keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", propertyIdEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};
const DEFAULT_PROP = "45e69775-d877-4507-a9e1-a45bd3400dc5";

function supaIdDe(prop: string | undefined): string { return (prop && PROP_MAP[prop]) ? prop : DEFAULT_PROP; }

function resolverPropiedad(prop: string | undefined): { apiKey: string; propertyId: string } | null {
  const cfg = PROP_MAP[supaIdDe(prop)];
  if (!cfg) return null;
  const apiKey = Deno.env.get(cfg.keyEnv);
  if (!apiKey) return null;
  let propertyId = cfg.propertyId;
  if (!propertyId && cfg.propertyIdEnv) propertyId = Deno.env.get(cfg.propertyIdEnv) ?? undefined;
  if (!propertyId) return null;
  return { apiKey, propertyId };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// ---- La puerta: quien llama, y si lo de dentro es suyo ----
// Dos preguntas, en este orden, y ninguna se salta:
//   1. ¿Hay una sesion detras de esta llamada? Una llave publicable no lo es.
//   2. ¿Esa persona es del equipo de la casa?
// Se pregunta con el token de quien llama, no con la llave de servicio: asi
// es_equipo_casa() ve a la persona y no a la casa.
type Quien = { ok: true; quien: string } | { ok: false; motivo: "sin_sesion" | "no_equipo" };

async function quienLlama(req: Request): Promise<Quien> {
  const cabecera = req.headers.get("authorization") ?? "";
  const tok = cabecera.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return { ok: false, motivo: "sin_sesion" };
  // Por dentro la casa se llama a si misma con la llave de servicio, que es
  // secreta y nunca viaja a un navegador.
  if (SERVICE_KEY && tok === SERVICE_KEY) return { ok: true, quien: "servicio" };
  if (!SUPA_URL) return { ok: false, motivo: "sin_sesion" };
  const apikey = ANON_KEY || tok;
  let correo = "";
  try {
    const u = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${tok}` } });
    if (!u.ok) return { ok: false, motivo: "sin_sesion" };
    const d = (await u.json()) as Json;
    correo = String(d?.email ?? "");
  } catch (_e) { return { ok: false, motivo: "sin_sesion" }; }
  if (!correo) return { ok: false, motivo: "sin_sesion" };
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/es_equipo_casa`, {
      method: "POST",
      headers: { apikey, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) return { ok: false, motivo: "no_equipo" };
    const esEquipo = await r.json();
    if (esEquipo !== true) return { ok: false, motivo: "no_equipo" };
  } catch (_e) { return { ok: false, motivo: "no_equipo" }; }
  return { ok: true, quien: correo };
}

async function leerCache(supaId: string, fecha: string): Promise<{ payload: Json; updated_at: string } | null> {
  if (!SUPA_URL || !SERVICE_KEY) return null;
  try {
    const url = `${SUPA_URL}/rest/v1/reporte_dia_cache?property_id=eq.${supaId}&fecha=eq.${fecha}&select=payload,updated_at`;
    const r = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{ payload: Json; updated_at: string }>;
    if (!rows.length) return null;
    return rows[0];
  } catch (_e) { return null; }
}

async function escribirCache(supaId: string, fecha: string, payload: Json): Promise<void> {
  if (!SUPA_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/reporte_dia_cache?on_conflict=property_id,fecha`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ property_id: supaId, fecha, payload, updated_at: new Date().toISOString() }),
    });
  } catch (_e) { /* noop */ }
}

function hoyEnTZ(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function soloFecha(v: unknown): string { return String(v ?? "").slice(0, 10); }

type Json = Record<string, unknown>;

class CloudbedsClient {
  apiKey: string; propertyId: string; baseUrl: string;
  constructor(apiKey: string, propertyId: string, baseUrl = BASE_URL) { this.apiKey = apiKey; this.propertyId = propertyId; this.baseUrl = baseUrl; }
  private async get(endpoint: string, params: Record<string, string | number> = {}): Promise<Json> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set("propertyID", this.propertyId);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${this.apiKey}` } });
        if (r.status === 429 || r.status >= 500) { lastErr = `HTTP ${r.status}`; await sleep(400 * Math.pow(2, attempt)); continue; }
        return (await r.json()) as Json;
      } catch (e) { lastErr = String(e); await sleep(400 * Math.pow(2, attempt)); }
    }
    return { success: false, error: lastErr };
  }
  async listReservationsByCheckin(from: string, to: string): Promise<Json[]> {
    const out: Json[] = [];
    let page = 1; const maxPages = 100;
    while (page <= maxPages) {
      const resp = await this.get("getReservations", { checkInFrom: from, checkInTo: to, pageSize: 100, pageNumber: page });
      if (!resp.success) break;
      const data = (resp.data as Json[]) ?? [];
      out.push(...data);
      if (data.length < 100) break;
      page += 1;
    }
    return out;
  }
  async getReservation(reservationID: string): Promise<Json> { return await this.get("getReservation", { reservationID }); }
  async getRoomTypes(): Promise<Json> { return await this.get("getRoomTypes"); }
  // Paginado obligatorio: sin pageNumber/pageSize getRooms solo devuelve un tipo.
  async getRooms(pageNumber: number): Promise<Json> { return await this.get("getRooms", { pageSize: 100, pageNumber }); }
  async getRatePlans(startDate: string, endDate: string): Promise<Json> { return await this.get("getRatePlans", { startDate, endDate }); }
}
function sleep(ms: number): Promise<void> { return new Promise((res) => setTimeout(res, ms)); }

async function enLotes<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const res = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...res);
  }
  return out;
}

const RE_BB = /\b(bb|b&b|bed\s*and\s*breakfast|desayuno|breakfast|con\s*desayuno)\b/i;
const RE_DORM = /\b(dorm|dormitorio|cama|bed\s*in|shared|compartid|hostel|mixto|hombres|mujeres|female|male)\b/i;
const RE_PRIVADA = /\b(privad|private|habitaci|room|suite|matrimonial|doble|sencill|king|queen)\b/i;
function pareceBB(...textos: (string | undefined | null)[]): boolean { return textos.some((t) => t && RE_BB.test(t)); }
// Solo respaldo: se usa cuando getRooms falla y no hay `isPrivate` que consultar.
function tipoCuarto(nombreRoomType: string | undefined): "privada" | "dorm" {
  const n = nombreRoomType ?? "";
  if (RE_DORM.test(n)) return "dorm";
  if (RE_PRIVADA.test(n)) return "privada";
  return "privada";
}
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function esVerdad(v: unknown): boolean {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}
function extraerPersonas(src: Json): { adultos: number; ninos: number } {
  const adultos = num(src.adults) || num(src.adultsCount) || num(src.numAdults) || num((src as Json).guestsCount);
  const ninos = num(src.children) || num(src.childrenCount) || num(src.numChildren) || num(src.kids);
  return { adultos, ninos };
}

// ---- Cuartos reales (getRooms): isPrivate es por cuarto, no por nombre ----
type RoomInfo = { isPrivate: boolean; maxGuests: number };
type MapaCuartos = { porRoom: Map<string, RoomInfo>; porTipo: Map<string, boolean>; ok: boolean };

async function cargarCuartos(cb: CloudbedsClient): Promise<MapaCuartos> {
  const porRoom = new Map<string, RoomInfo>();
  const porTipo = new Map<string, boolean>();
  let ok = false;
  let page = 1; const maxPages = 50;
  while (page <= maxPages) {
    const resp = await cb.getRooms(page);
    if (!resp.success) break;
    ok = true;
    // La respuesta trae dos niveles: data[] -> { propertyID, rooms:[...] }
    const bloques = (resp.data as Json[]) ?? [];
    let enPagina = 0;
    for (const b of bloques) {
      for (const c of (((b.rooms as Json[]) ?? []))) {
        enPagina += 1;
        const roomID = String(c.roomID ?? c.roomId ?? "");
        const rtid = String(c.roomTypeID ?? c.roomTypeId ?? "");
        const priv = esVerdad(c.isPrivate);
        const mg = num(c.maxGuests) || num(c.roomTypeMaxOccupancy) || 0;
        if (roomID && !porRoom.has(roomID)) porRoom.set(roomID, { isPrivate: priv, maxGuests: mg });
        // Respaldo por tipo, para los registros de reserva sin cuarto asignado.
        if (rtid && !porTipo.has(rtid)) porTipo.set(rtid, priv);
      }
    }
    if (enPagina < 100) break;
    page += 1;
  }
  if (!porRoom.size) ok = false;
  return { porRoom, porTipo, ok };
}

async function calcularReporte(cb: CloudbedsClient): Promise<Json> {
  const hoy = hoyEnTZ(TZ);
  const manana = addDays(hoy, 1);

  // getRoomTypes sigue haciendo falta para el nombre del tipo y para el
  // respaldo por regex si getRooms no responde.
  const rtResp = await cb.getRoomTypes();
  const roomTypes = new Map<string, { nombre: string; tipo: "privada" | "dorm"; unidades: number }>();
  let capPrivadasNombre = 0, capDormNombre = 0;
  if (rtResp.success) {
    for (const rt of ((rtResp.data as Json[]) ?? [])) {
      const id = String(rt.roomTypeID ?? rt.roomTypeId ?? "");
      if (!id) continue;
      const nombre = String(rt.roomTypeName ?? rt.name ?? rt.roomTypeNameShort ?? "");
      const tipo = tipoCuarto(nombre);
      const unidades = num(rt.roomTypeUnits) || num(rt.unitsCount) || num(rt.units) || 0;
      const camas = num(rt.maxGuests) || num(rt.roomTypeMaxOccupancy) || num(rt.adultsIncluded) || 0;
      roomTypes.set(id, { nombre, tipo, unidades });
      if (tipo === "dorm") capDormNombre += unidades * (camas > 0 ? camas : 1);
      else capPrivadasNombre += unidades;
    }
  }

  // Capacidad por cuarto: privadas = cuartos con isPrivate; dorm = camas
  // (suma de maxGuests de los no privados). Si getRooms falla, se conserva el
  // calculo viejo por nombre/roomTypeUnits.
  const cuartos = await cargarCuartos(cb);
  const metodo: "cuarto" | "nombre" = cuartos.ok ? "cuarto" : "nombre";
  let capPrivadas = 0, capDorm = 0;
  if (metodo === "cuarto") {
    for (const info of cuartos.porRoom.values()) {
      if (info.isPrivate) capPrivadas += 1;
      else capDorm += info.maxGuests > 0 ? info.maxGuests : 1;
    }
  } else {
    capPrivadas = capPrivadasNombre;
    capDorm = capDormNombre;
  }
  const capGeneral = capPrivadas + capDorm;

  // Un registro de cuarto es privado o es una cama de dormitorio: manda el
  // cuarto (isPrivate), el tipo solo si no hay roomID, la regex solo si
  // getRooms fallo.
  function clasificar(roomID: string, rtid: string, nombreRt: string): "privada" | "dorm" {
    if (metodo === "cuarto") {
      const info = roomID ? cuartos.porRoom.get(roomID) : undefined;
      if (info) return info.isPrivate ? "privada" : "dorm";
      const porTipo = rtid ? cuartos.porTipo.get(rtid) : undefined;
      if (porTipo !== undefined) return porTipo ? "privada" : "dorm";
    }
    return roomTypes.get(rtid)?.tipo ?? tipoCuarto(nombreRt);
  }

  const ratePlansBB = new Set<string>();
  const rpResp = await cb.getRatePlans(hoy, manana);
  if (rpResp.success && Array.isArray(rpResp.data)) {
    for (const p of (rpResp.data as Json[])) {
      const nombre = String(p.rateName ?? p.name ?? p.ratePlanName ?? "");
      if (pareceBB(nombre)) { const rid = String(p.rateID ?? p.rateId ?? p.ratePlanID ?? ""); if (rid) ratePlansBB.add(rid); }
    }
  }

  const lookback = 30;
  const from = addDays(hoy, -lookback);
  const to = manana;
  const lista = await cb.listReservationsByCheckin(from, to);

  const ridsValidos: string[] = [];
  const seenRes = new Set<string>();
  const rawById = new Map<string, Json>();
  for (const r of lista) {
    const status = String(r.status ?? "").toLowerCase();
    if (!VALID_STATUSES.has(status)) continue;
    const rid = String(r.reservationID ?? "");
    if (!rid || seenRes.has(rid)) continue;
    seenRes.add(rid);
    ridsValidos.push(rid);
    rawById.set(rid, r);
  }

  const detalles = await enLotes(ridsValidos, DETALLE_CONCURRENCIA, async (rid) => ({ rid, det: await cb.getReservation(rid) }));

  let enCasaAdultos = 0, enCasaNinos = 0, llegadas = 0, salidas = 0, desayunos = 0;
  let occGeneral = 0, occPrivadas = 0, occDorm = 0;
  const desayunosLista: Array<{ nombre: string; checkin: string; checkout: string; personas: number; tipo: "privada" | "bb" | "dorm" }> = [];
  let bbDetectadoAlgo = ratePlansBB.size > 0;

  for (const { rid, det } of detalles) {
    if (!det.success) continue;
    const data = (det.data as Json) ?? {};
    const r = rawById.get(rid) ?? {};
    const nombreHuesped = String(data.guestName ?? r.guestName ?? `${data.guestFirstName ?? ""} ${data.guestLastName ?? ""}`.trim() ?? "Huesped") || "Huesped";
    const ci = soloFecha(data.startDate ?? r.startDate);
    const co = soloFecha(data.endDate ?? r.endDate);
    if (ci === hoy) llegadas += 1;
    if (co === hoy) salidas += 1;
    // Una reserva ya cerrada no duerme esta noche: no cuenta para la
    // ocupacion. Llegadas, salidas, en_casa y desayunos siguen igual.
    const yaSalio = String(data.status ?? r.status ?? "").toLowerCase() === "checked_out";
    const pers = extraerPersonas(data);
    const personasReservaTotal = pers.adultos + pers.ninos;
    const rateNameRes = String(data.rateName ?? data.ratePlanName ?? r.rateName ?? "");
    const rateIdRes = String(data.rateID ?? data.ratePlanID ?? r.rateID ?? "");
    let esBBReserva = pareceBB(rateNameRes);
    if (!esBBReserva && rateIdRes && ratePlansBB.has(rateIdRes)) esBBReserva = true;
    if (rateNameRes) bbDetectadoAlgo = true;
    if (esBBReserva) bbDetectadoAlgo = true;
    const rooms = [...(((data.assigned as Json[]) ?? []) || []), ...(((data.unassigned as Json[]) ?? []) || [])];
    const seenRR = new Set<string>();
    let enCasaEstaNoche = false;
    const cuartosHoy: Array<{ tipo: "privada" | "dorm"; nombreRt: string; rrPers: number }> = [];
    for (const rr of rooms) {
      const rrId = String(rr.reservationRoomID ?? "");
      const roomID = String(rr.roomID ?? rr.roomId ?? "");
      const rtid = String(rr.roomTypeID ?? "");
      // Terna (reservationID, reservationRoomID, roomID): el mismo cuarto no
      // se cuenta dos veces aunque reservationRoomID venga vacio.
      const clave = `${rid}|${rrId}|${roomID}`;
      if (seenRR.has(clave)) continue;
      seenRR.add(clave);
      const meta = roomTypes.get(rtid);
      const nombreRt = String(rr.roomTypeName ?? meta?.nombre ?? "");
      const tipo: "privada" | "dorm" = clasificar(roomID, rtid, nombreRt);
      const rci = soloFecha(rr.startDate);
      const rco = soloFecha(rr.endDate);
      if (!rci || !rco) continue;
      const ocupaHoy = rci <= hoy && hoy < rco;
      if (!ocupaHoy) continue;
      enCasaEstaNoche = true;
      const rrPersCampo = extraerPersonas(rr);
      cuartosHoy.push({ tipo, nombreRt, rrPers: rrPersCampo.adultos + rrPersCampo.ninos });
    }
    if (!enCasaEstaNoche) continue;
    const sumRrPers = cuartosHoy.reduce((a, c) => a + c.rrPers, 0);
    for (const c of cuartosHoy) {
      let personas = c.rrPers;
      if (personas <= 0) {
        if (sumRrPers <= 0 && personasReservaTotal > 0 && cuartosHoy.length === 1) personas = personasReservaTotal;
        else personas = esBBReserva ? 4 : c.tipo === "dorm" ? 1 : 2;
      }
      if (cuartosHoy.length === 1 && personasReservaTotal > 0) { enCasaAdultos += pers.adultos; enCasaNinos += pers.ninos; }
      else { enCasaAdultos += personas; }
      // Ocupacion en la misma unidad arriba y abajo: un cuarto por registro
      // privado, una cama por registro de dormitorio.
      if (!yaSalio) {
        if (c.tipo === "dorm") { occDorm += 1; occGeneral += 1; }
        else { occPrivadas += 1; occGeneral += 1; }
      }
      if (esBBReserva) { desayunos += personas; desayunosLista.push({ nombre: nombreHuesped, checkin: ci, checkout: co, personas, tipo: "bb" }); }
    }
  }

  const enCasaTotal = enCasaAdultos + enCasaNinos;
  const pct = (vend: number, cap: number) => (cap > 0 ? Math.round((vend / cap) * 100) : 0);
  const respuesta: Json = {
    ok: true,
    fecha: hoy,
    en_casa: { adultos: enCasaAdultos, ninos: enCasaNinos, total: enCasaTotal },
    llegadas, salidas, desayunos,
    occ: { general: pct(occGeneral, capGeneral), privadas: pct(occPrivadas, capPrivadas), dorm: pct(occDorm, capDorm) },
    occ_metodo: metodo,
    desayunos_lista: desayunosLista,
  };
  if (!bbDetectadoAlgo) { respuesta.desayunos = 0; respuesta.desayunos_lista = []; respuesta.cloudbeds_bb_no_detectado = true; }
  return respuesta;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Primero la puerta. Antes de mirar la fecha, antes de tocar el cache y
    // antes de llamar a Cloudbeds: si quien llama no trae sesion del equipo,
    // aqui se acaba y no se calcula nada.
    const quien = await quienLlama(req);
    if (!quien.ok) {
      const mensaje = quien.motivo === "no_equipo"
        ? "El reporte del día es del equipo de la casa. Tu sitio está en tu propio portal."
        : "Entra con tu cuenta para ver el reporte del día.";
      return json({ ok: false, error: mensaje, sin_permiso: true, motivo: quien.motivo }, 403);
    }

    let prop: string | undefined;
    let force = false;
    try {
      const body = (await req.json().catch(() => null)) as Json | null;
      if (body && typeof body.prop === "string") prop = body.prop;
      if (body && body.force === true) force = true;
    } catch (_e) { /* default */ }

    const supaId = supaIdDe(prop);
    const resolved = resolverPropiedad(prop);
    const hoy = hoyEnTZ(TZ);
    if (!resolved) return json({ ok: false, error: "Esta propiedad aún no está conectada a Cloudbeds.", no_conectado: true }, 200);
    const cb = new CloudbedsClient(resolved.apiKey, resolved.propertyId);

    if (!force) {
      const cache = await leerCache(supaId, hoy);
      if (cache) {
        const edadSeg = Math.round((Date.now() - new Date(cache.updated_at).getTime()) / 1000);
        if (edadSeg < CACHE_TTL_SEG) {
          return json({ ...cache.payload, cached: true, stale: false, edad_seg: edadSeg, updated_at: cache.updated_at }, 200);
        }
        try {
          // @ts-ignore EdgeRuntime existe en Supabase Edge
          EdgeRuntime.waitUntil((async () => { const fresco = await calcularReporte(cb); await escribirCache(supaId, hoy, fresco); })());
        } catch (_e) { /* noop */ }
        return json({ ...cache.payload, cached: true, stale: true, edad_seg: edadSeg, updated_at: cache.updated_at }, 200);
      }
    }

    const respuesta = await calcularReporte(cb);
    await escribirCache(supaId, hoy, respuesta);
    return json({ ...respuesta, cached: false, stale: false, edad_seg: 0, updated_at: new Date().toISOString() }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
