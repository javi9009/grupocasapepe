// hk-dia: motor del módulo Ama de Llaves
//  accion=sync     -> lee Cloudbeds getHousekeepingStatus y escribe public.hk_estatus_dia
//  accion=reparto  -> genera la propuesta de reparto (hk_asignaciones + hk_tareas) respetando pisos y jornada
//  accion=plan     -> sync + reparto (default)
//  accion=ver      -> solo devuelve el plan guardado
// body/query: { prop: 'cdmx'|'puebla', fecha: 'YYYY-MM-DD', accion }

const BASE = Deno.env.get('CLOUDBEDS_BASE_URL') ?? 'https://hotels.cloudbeds.com/api/v1.2';
const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TZ = 'America/Mexico_City';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const hoyTZ = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const PROPS: Record<string, { supaId: string; keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { supaId: '45e69775-d877-4507-a9e1-a45bd3400dc5', keyEnv: 'CLOUDBEDS_API_KEY', id: '10668' },
  puebla: { supaId: 'febfbef6-7fd1-4b45-84d9-13533e8dcb72', keyEnv: 'CLOUDBEDS_API_KEY_PUEBLA', idEnv: 'CLOUDBEDS_PROPERTY_ID_PUEBLA' },
};
const porSupaId = (id: string) => Object.keys(PROPS).find((k) => PROPS[k].supaId === id);

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${txt.slice(0, 500)}`);
  return txt ? JSON.parse(txt) : null;
}

// ---------- 1. SYNC de estatus desde Cloudbeds ----------
interface HkRow { roomID: string; roomName: string; roomCondition: string; roomOccupied: boolean; roomBlocked: boolean; frontdeskStatus: string; doNotDisturb: boolean; refusedService: boolean; roomComments: string; arrivalDate: string; departureDate: string }

async function cbHousekeeping(key: string, pid: string): Promise<HkRow[]> {
  const out: HkRow[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(`${BASE}/getHousekeepingStatus`);
    url.searchParams.set('propertyID', pid);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('pageNumber', String(page));
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json().catch(() => ({ success: false }));
    if (!j.success) break;
    const d = (j.data as HkRow[]) ?? [];
    out.push(...d);
    if (d.length < 100) break;
  }
  return out;
}

// Noches que lleva el huésped en casa a día de hoy.
function nochesEnCasa(llegada: string, fecha: string): number {
  const a = Date.parse((llegada || '').slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(fecha + 'T00:00:00Z');
  if (!a || !b || b < a) return 0;
  return Math.round((b - a) / 86400000);
}

function mapEstatus(r: HkRow, fecha: string, diasBlancos: number) {
  if (r.roomBlocked) return { estatus: 'fuera_servicio', ci: false, co: false, pide: false };
  switch ((r.frontdeskStatus || '').toLowerCase()) {
    case 'stayover': {
      // El flag doNotDisturb de Cloudbeds no es de fiar aquí: sale en la mitad de los
      // stayovers e incluso en cuartos vacíos. No se usa para quitar trabajo del reparto;
      // viaja en metadata y la recamarista cierra con el motivo NO_MOLESTAR si de verdad
      // no pudo entrar.
      const pide = !r.refusedService;
      // Regla de estancia larga: cada N noches se le cambian los blancos aunque siga en casa.
      const n = nochesEnCasa(r.arrivalDate, fecha);
      const toca = diasBlancos > 0 && n > 0 && n % diasBlancos === 0;
      return { estatus: toca ? 'ocupada_blancos' : 'ocupada', ci: false, co: false, pide, noches: n };
    }
    case 'turnover': return { estatus: 'vacia_sucia', ci: true, co: true, pide: true };
    case 'check-out': case 'checkout': case 'departure': return { estatus: 'vacia_sucia', ci: false, co: true, pide: true };
    case 'check-in': case 'checkin': case 'arrival': return { estatus: 'vacia_limpia', ci: true, co: false, pide: true };
    default: return { estatus: 'vacia_limpia', ci: false, co: false, pide: false }; // 'unused'
  }
}

async function syncEstatus(propKey: string, fecha: string) {
  const cfg = PROPS[propKey];
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? '') ?? '';
  if (!key || !pid) return { ok: false, error: 'sin credenciales Cloudbeds' };
  const rows = await cbHousekeeping(key, pid);
  const confArr = await rest(`hk_config?property_id=eq.${cfg.supaId}&select=dias_cambio_blancos`) as Array<{ dias_cambio_blancos: number }>;
  const diasBlancos = Number(confArr?.[0]?.dias_cambio_blancos ?? 4);
  const areas = await rest(`hk_areas?property_id=eq.${cfg.supaId}&select=id,tipo,codigo,cloudbeds_room_id&limit=1000`) as Array<{ id: string; tipo: string; codigo: string; cloudbeds_room_id: string | null }>;
  const porCb = new Map(areas.filter((a) => a.cloudbeds_room_id).map((a) => [a.cloudbeds_room_id!, a]));

  // Un cuarto que quedó limpio y en el que nadie durmió sigue limpio hoy: la limpieza
  // no se borra por cambiar de día. Solo se hereda si no hubo salida.
  const ayer = new Date(Date.parse(fecha + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  const previo = await rest(`hk_estatus_dia?property_id=eq.${cfg.supaId}&fecha=eq.${ayer}&limpieza=eq.limpia&select=area_id,limpieza_por,limpieza_fuente&limit=1000`) as Array<{ area_id: string; limpieza_por: string | null; limpieza_fuente: string | null }>;
  const limpioAyer = new Map(previo.map((x) => [x.area_id, x]));
  const filas: Array<Record<string, unknown>> = [];
  const heredadas: Array<Record<string, unknown>> = [];
  let sinMatch = 0;
  for (const r of rows) {
    const a = porCb.get(r.roomID);
    if (!a) { sinMatch++; continue; }
    const m = mapEstatus(r, fecha, diasBlancos);
    // Herencia de la limpieza de ayer: solo si hoy no hay salida y el cuarto no
    // estuvo ocupado, es decir, nadie lo ha vuelto a usar.
    const hered = (!m.co && (m.estatus === 'vacia_limpia')) ? limpioAyer.get(a.id) : undefined;
    const base = { property_id: cfg.supaId, fecha, area_id: a.id, estatus: m.estatus, check_in: m.ci, check_out: m.co, solicita_limpieza: m.pide, reserva_ref: null, fuente: 'cloudbeds', metadata: { frontdeskStatus: r.frontdeskStatus, roomCondition: r.roomCondition, doNotDisturb: r.doNotDisturb, refusedService: r.refusedService, comentario_cb: r.roomComments ?? '', llegada: r.arrivalDate, salida: r.departureDate, noches: (m as {noches?: number}).noches ?? null } };
    // Los lotes de PostgREST exigen las mismas claves en todas las filas: las que
    // heredan la limpieza de ayer van en su propio lote.
    if (hered) heredadas.push({ ...base, limpieza: 'limpia', limpieza_por: hered.limpieza_por, limpieza_fuente: hered.limpieza_fuente });
    else filas.push(base);
  }
  for (const lote of [filas, heredadas]) {
    for (let i = 0; i < lote.length; i += 100) {
      await rest('hk_estatus_dia?on_conflict=fecha,area_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lote.slice(i, i + 100)) });
    }
  }
  const todas = [...filas, ...heredadas];
  const conBlancos = todas.filter((f) => f.estatus === 'ocupada_blancos').length;
  return { ok: true, cloudbeds_rows: rows.length, guardadas: todas.length, heredadas: heredadas.length, sin_match: sinMatch, cambio_blancos: conBlancos, dias_cambio_blancos: diasBlancos };
}

// ---------- 2. REPARTO ----------
const mins = (t: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

// `lote` agrupa lo que no se puede partir entre dos personas: un dormitorio entero
// (su limpieza general + todas sus camas) va siempre a la misma recamarista.
interface CamaDet { area_id: string; codigo: string; nombre: string; estatus: string; minutos: number }
interface Tarea { area_id: string | null; codigo: string; nombre: string; piso: number; tipo: string; estatus: string; minutos: number; checklist_id: string | null; orden: number; lote: string; op_id?: string; titulo?: string; pase?: number; pases?: number; aQuien?: string; sinTrabajo?: boolean; opcional?: boolean; profunda?: boolean; camas?: CamaDet[]; minGeneral?: number; noMolestar?: boolean }
interface Persona { employee_id: string | null; nombre: string; turno: string; hi: string | null; hf: string | null; cap: number; bruta: number; admin: number }

async function reparto(propKey: string, fecha: string) {
  const cfg = PROPS[propKey];
  const P = cfg.supaId;

  const [confArr, areas, estatus, tiemposArr, checklists, horarios, mapaArr, adminArr, existentes, opsArr, dndArr] = await Promise.all([
    rest(`hk_config?property_id=eq.${P}&select=*`),
    rest(`hk_areas?property_id=eq.${P}&activo=eq.true&select=id,tipo,codigo,nombre,piso,parent_id,minutos_override,minutos_por_estatus,orden,veces_dia,metadata,obligatoria&limit=1000`),
    rest(`hk_estatus_dia?property_id=eq.${P}&fecha=eq.${fecha}&select=area_id,estatus,check_in,check_out,solicita_limpieza&limit=1000`),
    rest(`hk_tiempos?property_id=eq.${P}&activo=eq.true&select=tipo_area,estatus,minutos,variante`),
    rest(`hk_checklists?property_id=eq.${P}&activo=eq.true&select=id,area_id,minutos_estimados,frecuencia`),
    rest(`horarios?property_id=eq.${P}&fecha=eq.${fecha}&select=employee_id,nombre_display,puesto_id,hora_inicio,hora_fin`),
    rest('hk_puestos_map?activo=eq.true&select=puesto_id,turno'),
    rest(`hk_admin_turno?property_id=eq.${P}&activo=eq.true&select=turno,dia_semana,minutos,concepto`),
    rest(`hk_asignaciones?property_id=eq.${P}&fecha=eq.${fecha}&select=id,estado`),
    rest(`hk_tareas_op?property_id=eq.${P}&activo=eq.true&select=id,codigo,nombre,minutos,turno,hora_sugerida,dia_semana,orden,obligatoria&order=orden`),
    rest(`hk_no_molestar?property_id=eq.${P}&fecha=eq.${fecha}&select=area_id,nota`),
  ]) as [Array<Record<string, number>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, string>>, Array<{ turno: string; dia_semana: string | null; minutos: number; concepto: string }>, Array<{ id: string; estado: string }>, Array<{ id: string; codigo: string; nombre: string; minutos: number; turno: string | null; hora_sugerida: string | null; dia_semana: string | null; orden: number; obligatoria: boolean }>, Array<{ area_id: string; nota: string | null }>];

  const conf = confArr[0] ?? { horas_turno: 8, minutos_traslado_piso: 5, no_mezclar_pisos: true, factor_ama_llaves: 0.5, minutos_comida: 30 };
  const bloqueadas = existentes.filter((a) => a.estado !== 'propuesta');
  if (bloqueadas.length) return { ok: false, ya_validado: true, mensaje: 'El reparto de este día ya fue validado; no se regenera.', asignaciones: bloqueadas.length };
  for (const a of existentes) await rest(`hk_asignaciones?id=eq.${a.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await rest(`hk_tareas?property_id=eq.${P}&fecha=eq.${fecha}&asignacion_id=is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

  // Los dormitorios tienen tiempo propio por tamaño (8, 6 y 4 camas), tanto en la
  // limpieza general como en la profunda.
  const tiempo = new Map(tiemposArr.map((t) => [`${t.tipo_area}|${t.estatus}${t.variante ? `|${t.variante}` : ''}`, Number(t.minutos)]));
  const minDe = (tipo: string, est: string, camas?: number | null) =>
    (camas != null ? tiempo.get(`${tipo}|${est}|${camas}`) : undefined) ?? tiempo.get(`${tipo}|${est}`);
  const chkPorArea = new Map(checklists.map((c) => [String(c.area_id), c]));
  const estPorArea = new Map(estatus.map((e) => [String(e.area_id), e]));

  const cuartos: Tarea[] = [];
  const publicas: Tarea[] = [];
  const nocturnas: Tarea[] = [];   // lo que deja hecho el turno de noche
  const opcionales: Tarea[] = [];

  // Cuartos con letrero de No Molestar apuntados anoche: hoy no se limpian.
  const noMolestar = new Map((dndArr ?? []).map((d) => [String(d.area_id), d.nota ?? null]));

  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaSemana = DIAS[new Date(fecha + 'T12:00:00Z').getUTCDay()];
  const dormsTocados = new Set<string>();
  const camasPorDorm = new Map<string, CamaDet[]>();

  for (const a of areas) {
    const tipo = String(a.tipo);
    if (tipo === 'dorm') continue; // se resuelve abajo, cuando ya sabemos qué dormitorios estuvieron ocupados
    if (tipo === 'privada' || tipo === 'cama') {
      const e = estPorArea.get(String(a.id));
      if (!e || !e.solicita_limpieza) continue;
      // El huésped pidió que no le molestaran: no se le carga a nadie.
      if (noMolestar.has(String(a.id)) || (a.parent_id && noMolestar.has(String(a.parent_id)))) continue;
      const est = String(e.estatus);
      if (est === 'fuera_servicio') continue;
      // La limpieza general del dorm se hace a diario en cuanto la habitación estuvo
      // ocupada, aunque ninguna cama concreta dé trabajo (una cama ocupada son 0 min).
      if (tipo === 'cama' && a.parent_id && est !== 'vacia_limpia') dormsTocados.add(String(a.parent_id));
      // Un cuarto puede tener su propio tiempo por estatus (las suites tardan más
      // que una privada normal); si no, manda el estándar del tipo.
      const propio = (a.minutos_por_estatus as Record<string, number> | null)?.[est];
      const min = propio ?? (a.minutos_override as number | null) ?? minDe(tipo, est) ?? 0;
      // Las camas de un dormitorio no se reparten una a una: se suman dentro de la
      // tarjeta del dorm, que es lo que se asigna, se empieza y se termina.
      if (tipo === 'cama' && a.parent_id) {
        if (!min) continue; // cama ocupada sin blancos = 0 min, no da trabajo
        const arr = camasPorDorm.get(String(a.parent_id)) ?? [];
        arr.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: String(a.nombre), estatus: est, minutos: min });
        camasPorDorm.set(String(a.parent_id), arr);
        continue;
      }
      if (!min) continue;
      cuartos.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: String(a.nombre), piso: Number(a.piso ?? 0), tipo, estatus: est, minutos: min, checklist_id: null, orden: Number(a.orden ?? 0), lote: `area:${a.id}` });
    } else {
      const chk = chkPorArea.get(String(a.id));
      // Una zona con checklist semanal (p.ej. la limpieza profunda de azotea de los lunes)
      // solo entra en el reparto el día que le toca.
      const frec = String(chk?.frecuencia ?? 'diaria');
      if (frec !== 'diaria' && frec !== diaSemana) continue;
      const min = (a.minutos_override as number | null) ?? (chk?.minutos_estimados as number | null) ?? minDe(tipo, 'rutina') ?? 0;
      if (!min) continue;
      // La cocina de huéspedes y los baños comunes se limpian dos veces al día:
      // cada pase es una tarea aparte, para que se puedan repartir entre personas y turnos.
      // Una zona opcional (jardinería, la sala) no entra sola en el reparto: viaja a la
      // caja SIN ASIGNAR con sus minutos, para dársela a alguien solo el día que toque.
      const opcional = a.obligatoria === false;
      const veces = Math.max(1, Number(a.veces_dia ?? 1));
      // Zonas del turno de noche: el auditor nocturno las deja hechas antes de que
      // entre el equipo de la mañana. Si la zona tiene dos pases, el de la noche
      // cubre el primero y el segundo sigue siendo de la tarde.
      const deNoche = (a.metadata as Record<string, unknown> | null)?.asignar_a === 'nocturno';
      const minNoche = Number((a.metadata as Record<string, unknown> | null)?.minutos_nocturno ?? 0) || min;
      // Cada pase lleva su nombre (mañana / tarde) para que no se confundan ni se
      // empiecen a la vez: el de la tarde no se abre hasta cerrar el de la mañana.
      const NOM: Record<number, string[]> = { 2: ['mañana', 'tarde'], 3: ['mañana', 'mediodía', 'tarde'] };
      for (let n = 1; n <= veces; n++) {
        const etiqueta = veces > 1 ? (NOM[veces]?.[n - 1] ?? `pase ${n}`) : null;
        if (deNoche && n === 1) {
          nocturnas.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: String(a.nombre), piso: Number(a.piso ?? 0), tipo, estatus: 'rutina', minutos: minNoche, checklist_id: chk ? String(chk.id) : null, orden: Number(a.orden ?? 0), lote: `noche:${a.id}`, titulo: `${a.nombre} · noche`, pase: veces > 1 ? 1 : undefined, pases: veces > 1 ? veces : undefined });
          continue;
        }
        (opcional ? opcionales : publicas).push({ area_id: String(a.id), codigo: String(a.codigo), nombre: String(a.nombre), piso: Number(a.piso ?? 0), tipo, estatus: 'rutina', minutos: min, checklist_id: chk ? String(chk.id) : null, orden: Number(a.orden ?? 0) + (n - 1) * 1000, lote: `area:${a.id}:${n}`, pase: veces > 1 ? n : undefined, pases: veces > 1 ? veces : undefined, titulo: etiqueta ? `${a.nombre} · ${etiqueta}` : undefined, opcional, aQuien: (a.metadata as Record<string, unknown> | null)?.asignar_a as string | undefined });
      }
    }
  }
  // Limpieza general del dormitorio: baño, habitación, balcón y ventana. Se hace a diario
  // en cuanto la habitación estuvo ocupada y se cobra una sola vez por dormitorio; va junto
  // a sus camas y en la misma persona, para no entrar dos veces al mismo cuarto.
  const chkDorm = checklists.find((c) => !c.area_id && String(c.frecuencia) === 'diaria');
  const chkProf = checklists.find((c) => !c.area_id && String(c.frecuencia) === 'profunda');
  const profundas: Tarea[] = [];
  for (const a of areas) {
    if (String(a.tipo) !== 'dorm') continue;
    const camas = Number((a.metadata as Record<string, unknown> | null)?.camas ?? 0) || null;
    // La profunda de cada dormitorio viaja siempre SIN ASIGNAR, con su número de
    // habitación, para programarla el día que toque.
    const minProf = minDe('dorm', 'profunda', camas);
    if (minProf) profundas.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: `${a.nombre} · limpieza profunda`, piso: Number(a.piso ?? 0), tipo: 'dorm', estatus: 'profunda', minutos: minProf, checklist_id: chkProf ? String(chkProf.id) : null, orden: Number(a.orden ?? 0), lote: `prof:${a.id}`, profunda: true });
    if (noMolestar.has(String(a.id))) continue;   // dormitorio con letrero: no se toca
    const det = camasPorDorm.get(String(a.id)) ?? [];
    const tocado = dormsTocados.has(String(a.id));
    if (!tocado && !det.length) continue;
    // La general (baño, habitación, balcón y ventana) solo se cobra si la habitación
    // estuvo ocupada; las camas suman siempre lo suyo.
    const minGeneral = tocado ? ((a.minutos_override as number | null) ?? minDe('dorm', 'rutina', camas) ?? 0) : 0;
    const minCamas = det.reduce((x, c) => x + c.minutos, 0);
    const min = minGeneral + minCamas;
    if (!min) continue;
    det.sort((x, y) => x.codigo.localeCompare(y.codigo, 'es', { numeric: true }));
    cuartos.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: String(a.nombre), piso: Number(a.piso ?? 0), tipo: 'dorm', estatus: 'rutina', minutos: min, checklist_id: chkDorm ? String(chkDorm.id) : null, orden: Number(a.orden ?? 0) - 1, lote: `dorm:${a.id}`, camas: det, minGeneral });
  }

  // Trabajo operativo que no es limpiar un cuarto (reparto de cuartos, armado de carros,
  // lavandería, room audit, separar blancos). Entra en el reparto como una tarea más para
  // que el ama de llaves la asigne, y a veces la parte entre varias personas.
  const operativas: Tarea[] = (opsArr ?? [])
    .filter((o) => !o.dia_semana || o.dia_semana === diaSemana)
    .map((o) => ({
      area_id: null, codigo: String(o.codigo), nombre: String(o.nombre), piso: 0, tipo: 'operativa',
      estatus: 'operativa', minutos: Number(o.minutos || 0), checklist_id: null,
      orden: Number(o.orden ?? 0), lote: `op:${o.id}`, op_id: String(o.id),
      titulo: o.hora_sugerida ? `${o.nombre} · ${String(o.hora_sugerida).slice(0, 5)}` : String(o.nombre),
      turnoPref: o.turno, opcional: o.obligatoria === false,
    } as Tarea & { turnoPref: string | null }))
    .filter((t) => t.minutos > 0);

  // El reparto lleva TODO el inventario: habitaciones y camas. Lo que hoy no tiene un
  // estatus que pida limpieza no se le carga a nadie, va a la caja SIN ASIGNAR con 0 min,
  // por si hace falta dárselo a alguien (una reserva que entra tarde, un cuarto que lo pide).
  const conTarea = new Set(cuartos.map((t) => t.area_id));
  // Una cama que ya viaja dentro de la tarjeta de su dormitorio no vuelve a salir suelta.
  cuartos.forEach((t) => (t.camas ?? []).forEach((c) => conTarea.add(c.area_id)));
  const libres: Tarea[] = [];
  for (const a of areas) {
    const tipo = String(a.tipo);
    if (tipo !== 'privada' && tipo !== 'dorm' && tipo !== 'cama') continue;
    if (conTarea.has(String(a.id))) continue;
    // Tampoco las camas de un dormitorio que hoy sí se limpia.
    if (tipo === 'cama' && a.parent_id && conTarea.has(String(a.parent_id))) continue;
    const e = estPorArea.get(String(a.id));
    const est = String(e?.estatus ?? 'vacia_limpia');
    if (est === 'fuera_servicio') continue;
    const dnd = noMolestar.has(String(a.id)) || (a.parent_id && noMolestar.has(String(a.parent_id)));
    libres.push({ area_id: String(a.id), codigo: String(a.codigo), nombre: dnd ? `${a.nombre} · no molestar` : String(a.nombre), piso: Number(a.piso ?? 0), tipo, estatus: est, minutos: 0, checklist_id: null, orden: Number(a.orden ?? 0), lote: `libre:${a.id}`, sinTrabajo: true, noMolestar: !!dnd });
  }
  libres.sort((x, y) => x.piso - y.piso || x.orden - y.orden);

  cuartos.sort((x, y) => x.piso - y.piso || x.orden - y.orden);
  publicas.sort((x, y) => x.orden - y.orden);

  const turnoDe = new Map(mapaArr.map((m) => [m.puesto_id, m.turno]));
  const personas: Persona[] = [];
  for (const h of horarios) {
    const turno = turnoDe.get(String(h.puesto_id));
    if (!turno) continue;
    const hi = h.hora_inicio as string | null, hf = h.hora_fin as string | null;
    if (!hi || !hf) continue; // descanso
    let dur = (mins(hf)! - mins(hi)!); if (dur < 0) dur += 1440;
    const bruta = dur - Number(conf.minutos_comida ?? 30);
    // Lo que no es limpieza (reparto de camas y carros, revisión de cuartos, briefing
    // de los lunes) vive en hk_admin_turno: se suma a la pila y baja la capacidad.
    const admin = adminArr
      .filter((x) => x.turno === turno && (!x.dia_semana || x.dia_semana === diaSemana))
      .reduce((s, x) => s + Number(x.minutos || 0), 0);
    const cap = bruta - admin;
    if (cap <= 0) continue;
    personas.push({ employee_id: h.employee_id ? String(h.employee_id) : null, nombre: String(h.nombre_display ?? ''), turno, hi, hf, cap, bruta, admin });
  }
  // El de la noche no se mide por horas: se le asigna su ruta de apoyo y punto.
  const nocturno = personas.find((p) => p.turno === 'nocturno') ?? null;
  const poolCuartos = personas.filter((p) => p.turno === 'recamarista' || p.turno === 'ama_llaves').sort((a, b) => (a.hi ?? '').localeCompare(b.hi ?? ''));
  // Si esa noche no hay quien cubra el turno, sus zonas vuelven a la mañana.
  if (!nocturno && nocturnas.length) publicas.push(...nocturnas.map((t) => ({ ...t, titulo: undefined, lote: `area:${t.area_id}:1` })));
  const poolPublicasReal = personas.filter((p) => p.turno === 'areas_publicas');
  const poolP = poolPublicasReal.length ? poolPublicasReal : poolCuartos;

  // repartidor: bloques contiguos de piso, proporcionales a la capacidad de cada persona
  function repartir(tareas: Tarea[], pool: Persona[], usado: Map<string, number>) {
    const res = new Map<number, Tarea[]>();
    const sobra: Tarea[] = [];
    if (!pool.length) return { res, sobra: tareas };
    const T = tareas.reduce((s, t) => s + t.minutos, 0);
    const libre = pool.map((p) => Math.max(0, p.cap - (usado.get(p.employee_id ?? `n:${p.nombre}`) ?? 0)));
    const C = libre.reduce((s, x) => s + x, 0);
    const cuota = libre.map((l) => (C ? (T * l) / C : 0));
    // Se reparte por lotes, no por tareas sueltas: un dormitorio entra completo o no entra.
    const lotes: Array<{ ts: Tarea[]; min: number }> = [];
    const idx = new Map<string, number>();
    for (const t of tareas) {
      const k = t.lote ?? `t:${t.area_id}`;
      const j = idx.get(k);
      if (j === undefined) { idx.set(k, lotes.length); lotes.push({ ts: [t], min: t.minutos }); }
      else { lotes[j].ts.push(t); lotes[j].min += t.minutos; }
    }
    let i = 0, acc = 0;
    for (const l of lotes) {
      while (i < pool.length && (acc + l.min > libre[i] || (acc > 0 && acc >= cuota[i]))) { i++; acc = 0; }
      if (i >= pool.length) { sobra.push(...l.ts); continue; }
      const arr = res.get(i) ?? []; arr.push(...l.ts); res.set(i, arr); acc += l.min;
    }
    return { res, sobra };
  }

  const usado = new Map<string, number>();
  const kp = (p: Persona) => p.employee_id ?? `n:${p.nombre}`;

  // Las operativas se colocan primero: quien tiene el turno que pide la tarea, y si no,
  // quien vaya más descargado. El ama de llaves puede moverlas después con el botón <>.
  const opsPorPersona = new Map<string, Tarea[]>();
  const sobraOps: Tarea[] = [];
  const opsLibres: Tarea[] = [];
  const poraOps = personas.filter((p) => p.turno !== 'front' && p.turno !== 'nocturno');
  // Front tiene una sola caja al día: la de la jefa de front, y el día que descansa,
  // la del turno de front de la mañana. El room audit va siempre a esa persona.
  const JEFA_FRONT = '88b20af6-a1e4-4ac5-b400-f5253ba7e1b7';
  const frontDia = personas.filter((p) => p.turno === 'front');
  const front = frontDia.find((p) => p.employee_id === JEFA_FRONT)
    ?? frontDia.slice().sort((a, b) => (a.hi ?? '').localeCompare(b.hi ?? ''))[0];
  for (const t of operativas) {
    // Una operativa no obligatoria (el room audit, que puede hacer front) no se
    // reparte sola: viaja a SIN ASIGNAR para que el ama de llaves la coloque.
    if (t.opcional) { opsLibres.push(t); continue; }
    const pref = (t as Tarea & { turnoPref?: string | null }).turnoPref;
    // El room audit es de front: va a la caja de front, no a la recamarista más libre.
    if (pref === 'front' && front) {
      const arr = opsPorPersona.get(kp(front)) ?? []; arr.push(t); opsPorPersona.set(kp(front), arr);
      continue;   // no le suma carga: front no se mide por horas de limpieza
    }
    const cand = (pref ? personas.filter((p) => p.turno === pref) : poraOps);
    // Si no hay nadie del turno de día, la operativa queda SIN CUBRIR: nunca se le
    // cuelga a front ni al de la noche, que no son equipo de limpieza.
    const lista = (cand.length ? cand : poraOps).slice().sort((a, b) =>
      ((usado.get(kp(a)) ?? 0) / (a.cap || 1)) - ((usado.get(kp(b)) ?? 0) / (b.cap || 1)));
    const p = lista[0];
    if (!p) { sobraOps.push(t); continue; }
    const arr = opsPorPersona.get(kp(p)) ?? []; arr.push(t); opsPorPersona.set(kp(p), arr);
    usado.set(kp(p), (usado.get(kp(p)) ?? 0) + t.minutos);
  }

  // Zonas que no las hace áreas públicas sino quien abre el primer turno (la oficina).
  // "La que entra en primer turno" es la primera del turno de cuartos, no la de áreas
  // públicas: a esa se le carga todo lo demás.
  // La oficina la abre quien entra primero del equipo de limpieza. Si ese día no
  // hay nadie del turno de día, la zona queda SIN CUBRIR: no es de front.
  const primerTurno = poolCuartos[0]
    ?? personas.filter((p) => p.turno !== 'front' && p.turno !== 'nocturno')
      .slice().sort((a, b) => (a.hi ?? '').localeCompare(b.hi ?? ''))[0] ?? null;
  const dePrimerTurno: Tarea[] = [];
  const publicasResto: Tarea[] = [];
  for (const t of publicas) (t.aQuien === 'primer_turno' && primerTurno ? dePrimerTurno : publicasResto).push(t);
  if (dePrimerTurno.length && primerTurno) {
    const k = kp(primerTurno);
    usado.set(k, (usado.get(k) ?? 0) + dePrimerTurno.reduce((s, t) => s + t.minutos, 0));
    const arr = opsPorPersona.get(k) ?? []; arr.push(...dePrimerTurno); opsPorPersona.set(k, arr);
  }

  const rc = repartir(cuartos, poolCuartos, usado);
  for (const [i, ts] of rc.res) usado.set(kp(poolCuartos[i]), (usado.get(kp(poolCuartos[i])) ?? 0) + ts.reduce((s, t) => s + t.minutos, 0));
  // Los cuartos que no caben tampoco quedan huérfanos: se le cargan a quien ya trabaja
  // ese piso (y si no, a la menos cargada). La sobrecarga se ve en rojo en su pila.
  if (rc.sobra.length && poolCuartos.length) {
    const pisosDe = new Map<number, number>();
    for (const [i, ts] of rc.res) for (const t of ts) if (!pisosDe.has(t.piso)) pisosDe.set(t.piso, i);
    for (const t of rc.sobra) {
      let j = pisosDe.get(t.piso);
      if (j === undefined) {
        j = 0; let menos = Infinity;
        poolCuartos.forEach((p, i) => { const u = (usado.get(kp(p)) ?? 0) / (p.cap || 1); if (u < menos) { menos = u; j = i; } });
      }
      const arr = rc.res.get(j) ?? []; arr.push(t); rc.res.set(j, arr);
      usado.set(kp(poolCuartos[j]), (usado.get(kp(poolCuartos[j])) ?? 0) + t.minutos);
    }
    rc.sobra.length = 0;
  }

  const rp = repartir(publicasResto, poolP, usado);

  // Las áreas públicas no se quedan sin dueño: lo que no cabe se le carga igual al turno
  // que las hace, y aparece en su pila como horas extra. Un turno SIN CUBRIR no limpia nada.
  if (rp.sobra.length && poolP.length) {
    let j = 0, menos = Infinity;
    poolP.forEach((p, i) => { const u = (usado.get(kp(p)) ?? 0) / (p.cap || 1); if (u < menos) { menos = u; j = i; } });
    const arr = rp.res.get(j) ?? []; arr.push(...rp.sobra); rp.res.set(j, arr);
    rp.sobra.length = 0;
  }

  // una sola asignación por persona (cuartos + públicas fusionadas)
  const porPersona = new Map<string, { p: Persona; tareas: Tarea[] }>();
  for (const p of personas) { const ts = opsPorPersona.get(kp(p)); if (ts?.length) { const e = porPersona.get(kp(p)) ?? { p, tareas: [] }; e.tareas.push(...ts); porPersona.set(kp(p), e); } }
  for (const [i, ts] of rc.res) { const p = poolCuartos[i]; const e = porPersona.get(kp(p)) ?? { p, tareas: [] }; e.tareas.push(...ts); porPersona.set(kp(p), e); }
  for (const [i, ts] of rp.res) { const p = poolP[i]; const e = porPersona.get(kp(p)) ?? { p, tareas: [] }; e.tareas.push(...ts); porPersona.set(kp(p), e); }

  const salida: Array<Record<string, unknown>> = [];
  const esPublica = (t: Tarea) => t.tipo === 'zona_comun';
  async function crear(p: Persona | null, tareas: Tarea[], etiqueta?: string, sinAsignar = false) {
    if (!tareas.length && !(p && p.turno === 'front')) return;
    tareas.sort((a, b) => (a.tipo === 'operativa' ? 0 : 1) - (b.tipo === 'operativa' ? 0 : 1) || (esPublica(a) ? 1 : 0) - (esPublica(b) ? 1 : 0) || a.piso - b.piso || a.orden - b.orden);
    const pisos = [...new Set(tareas.map((t) => t.piso))].filter((x) => x > 0).sort((a, b) => a - b);
    const total = tareas.reduce((s, t) => s + t.minutos, 0);
    const asig = await rest('hk_asignaciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
      property_id: P, fecha, employee_id: p?.employee_id ?? null, nombre_display: p?.nombre ?? (etiqueta ?? 'SIN ASIGNAR'),
      turno: p?.turno ?? 'recamarista', hora_inicio: p?.hi ?? null, hora_fin: p?.hf ?? null,
      estado: 'propuesta', minutos_estimados: total, pisos, generado_por: 'motor',
      metadata: { sin_medir: p?.turno === 'nocturno' || p?.turno === 'front', capacidad_min: p?.cap ?? 0, capacidad_bruta_min: p?.bruta ?? 0, admin_min: p?.admin ?? 0, carga_pct: p?.cap ? Math.round((total / p.cap) * 100) : null, sin_asignar: !p, bolsa_libre: sinAsignar, etiqueta: etiqueta ?? null },
    }) }) as Array<{ id: string }>;
    const aid = asig[0].id;
    const filas = tareas.map((t, idx) => ({ asignacion_id: aid, property_id: P, fecha, area_id: t.area_id, tarea_op_id: t.op_id ?? null, titulo: t.titulo ?? null, pase: t.pase ?? null, pases: t.pases ?? null, metadata: t.sinTrabajo ? { sin_trabajo: true, no_molestar: t.noMolestar ?? false } : (t.profunda ? { profunda: true } : (t.opcional ? { opcional: true } : (t.camas?.length ? { camas: t.camas, minutos_general: t.minGeneral ?? 0 } : {}))), checklist_id: t.checklist_id, estatus_area: t.estatus, minutos_estimados: t.minutos, orden: idx + 1, estado: 'pendiente' }));
    for (let i = 0; i < filas.length; i += 100) await rest('hk_tareas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filas.slice(i, i + 100)) });
    salida.push({ colaborador: p?.nombre ?? (etiqueta ?? 'SIN ASIGNAR'), turno: p?.turno ?? '-', horario: p ? `${p.hi}-${p.hf}` : '-', capacidad_min: p?.cap ?? 0, minutos: total, carga_pct: p?.cap ? Math.round((total / p.cap) * 100) : null, pisos, tareas: tareas.length, detalle: tareas.map((t) => `${t.codigo} (${t.estatus}, ${t.minutos}m)`) });
  }

  // La ruta de la noche va entera a quien cubre el turno.
  if (nocturno && nocturnas.length) {
    const e = porPersona.get(kp(nocturno)) ?? { p: nocturno, tareas: [] };
    e.tareas.push(...nocturnas); porPersona.set(kp(nocturno), e);
  }

  // La caja de front existe siempre, aunque ese día no haya audit que colocar.
  if (front && !porPersona.has(kp(front))) porPersona.set(kp(front), { p: front, tareas: [] });
  for (const { p, tareas } of porPersona.values()) await crear(p, tareas);
  // El motor no mueve nada por su cuenta: lo que no se reparte queda suelto en el
  // listado, sin asignación, para que el ama de llaves lo coloque si quiere.
  const sueltas = [...opsLibres, ...profundas, ...opcionales, ...libres];
  if (sueltas.length) {
    const filasS = sueltas.map((t, idx) => ({ asignacion_id: null, property_id: P, fecha, area_id: t.area_id, tarea_op_id: t.op_id ?? null, titulo: t.titulo ?? null, pase: t.pase ?? null, pases: t.pases ?? null, metadata: t.sinTrabajo ? { sin_trabajo: true, no_molestar: t.noMolestar ?? false } : (t.profunda ? { profunda: true } : (t.opcional ? { opcional: true } : (t.camas?.length ? { camas: t.camas, minutos_general: t.minGeneral ?? 0 } : {}))), checklist_id: t.checklist_id, estatus_area: t.estatus, minutos_estimados: t.minutos, orden: 9000 + idx, estado: 'pendiente' }));
    for (let i = 0; i < filasS.length; i += 100) await rest('hk_tareas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filasS.slice(i, i + 100)) });
  }
  if (sobraOps.length) await crear(null, sobraOps, 'SIN CUBRIR · operativas');
  if (rc.sobra.length) await crear(null, rc.sobra, 'SIN CUBRIR · cuartos');
  if (rp.sobra.length) await crear(null, rp.sobra, 'SIN CUBRIR · áreas públicas');

  return {
    ok: true, fecha, propiedad: propKey,
    carga: { cuartos_tareas: cuartos.filter((t) => !t.sinTrabajo).length, cuartos_sin_trabajo: libres.length, cuartos_min: cuartos.reduce((s, t) => s + t.minutos, 0), publicas_tareas: publicas.length, publicas_min: publicas.reduce((s, t) => s + t.minutos, 0), opcionales_tareas: opcionales.length, opcionales_min: opcionales.reduce((s, t) => s + t.minutos, 0), profundas_tareas: profundas.length, operativas_tareas: operativas.length, operativas_min: operativas.reduce((s, t) => s + t.minutos, 0) },
    personal: personas.map((p) => ({ nombre: p.nombre, turno: p.turno, horario: `${p.hi}-${p.hf}`, capacidad_min: p.cap, admin_min: p.admin, jornada_min: p.bruta })),
    reparto: salida,
    sin_cubrir_min: rc.sobra.reduce((s, t) => s + t.minutos, 0) + rp.sobra.reduce((s, t) => s + t.minutos, 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    let prop = 'cdmx', fecha = hoyTZ(), accion = 'plan';
    try { const u = new URL(req.url); prop = u.searchParams.get('prop') ?? prop; fecha = u.searchParams.get('fecha') ?? fecha; accion = u.searchParams.get('accion') ?? accion; } catch { /* noop */ }
    try { const b = await req.json(); if (b?.prop) prop = b.prop; if (b?.fecha) fecha = b.fecha; if (b?.accion) accion = b.accion; } catch { /* noop */ }
    if (prop.length > 12) prop = porSupaId(prop) ?? 'cdmx';
    if (!PROPS[prop]) return J({ ok: false, error: 'propiedad inválida' }, 400);

    if (accion === 'sync') return J(await syncEstatus(prop, fecha));
    if (accion === 'reparto') return J(await reparto(prop, fecha));
    if (accion === 'ver') {
      const P = PROPS[prop].supaId;
      const a = await rest(`hk_asignaciones?property_id=eq.${P}&fecha=eq.${fecha}&select=*,hk_tareas(*,hk_areas(codigo,nombre,tipo,piso))&order=turno,nombre_display`);
      return J({ ok: true, fecha, asignaciones: a });
    }
    const s = await syncEstatus(prop, fecha);
    const r = await reparto(prop, fecha);
    return J({ ok: true, sync: s, plan: r });
  } catch (e) { return J({ ok: false, error: String(e) }, 500); }
});
