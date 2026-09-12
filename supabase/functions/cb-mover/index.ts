// cb-mover — cambiar de habitación a un huésped en el check-in sin tocar el calendario.
//
// Llega alguien, su cama o su privada todavía no está lista, y hay otra libre del
// MISMO tipo. En Cloudbeds eso no es cambiar la reserva: es reasignar el cuarto
// físico (postRoomAssign). Las fechas, la tarifa y la factura no se mueven, y por
// eso el calendario no se entera. Cambiar de TIPO de cuarto sí sería otra cosa
// —eso toca precio— y aquí no se hace.
//
// Dos cosas que hay que tener muy presentes:
//
//  1. EL RANGO. Un cuarto libre ESTA NOCHE puede estar vendido mañana. Las
//     opciones que se ofrecen son las libres TODA la estancia de ese cuarto, de
//     su entrada a su salida. Si no, se le mueve hoy y se le descuadra mañana.
//
//  2. EL CUARTO QUE DEJA. Al reasignar con oldRoomID, Cloudbeds suelta el cuarto
//     viejo y vuelve al inventario. Y cuando el cuarto bueno lo tiene OTRA
//     llegada de hoy, no es un movimiento: es un intercambio, y hay que mover a
//     los dos. Eso es `accion=intercambiar`.
//
//  3. QUE ESTE LIMPIO. De nada sirve mandarle a otro cuarto que tampoco esta
//     listo. Cloudbeds dice quien esta vendido; quien esta limpio lo dice
//     nuestro hk_estatus_dia, y se cruza por hk_areas.cloudbeds_room_id.
//
//  accion=diag          solo lectura: qué contestan los endpoints con esta llave
//  accion=rangos        solo lectura: cuántos cuartos quedan libres según el rango
//  accion=libres        una fila por cuarto a entregar hoy, con sus opciones reales
//  accion=mover         reasigna a un cuarto libre (exige confirmar:true)
//  accion=intercambiar  cambia de cuarto a dos llegadas entre sí (exige confirmar:true)
//
// body: { prop:'cdmx'|'puebla'|<uuid>, fecha, accion, ... }

const BASE = 'https://hotels.cloudbeds.com/api/v1.2';
const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TZ = 'America/Mexico_City';
const hoyTZ = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROPS: Record<string, { supaId: string; keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { supaId: '45e69775-d877-4507-a9e1-a45bd3400dc5', keyEnv: 'CLOUDBEDS_API_KEY', id: '10668' },
  puebla: { supaId: 'febfbef6-7fd1-4b45-84d9-13533e8dcb72', keyEnv: 'CLOUDBEDS_API_KEY_PUEBLA', idEnv: 'CLOUDBEDS_PROPERTY_ID_PUEBLA' },
};
const porSupaId = (id: string) => Object.keys(PROPS).find((k) => PROPS[k].supaId === id);

type Obj = Record<string, unknown>;
const DIA = 86400000;
const masDias = (f: string, n: number) => new Date(Date.parse(f + 'T00:00:00Z') + n * DIA).toISOString().slice(0, 10);
const noches = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DIA));

async function cbGet(key: string, ep: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${ep}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
  const txt = await r.text();
  let j: unknown = null;
  try { j = JSON.parse(txt); } catch { /* html o error suelto */ }
  return { http: r.status, body: (j ?? { raw: txt.slice(0, 300) }) as Obj };
}

async function cbPost(key: string, ep: string, form: Record<string, string>) {
  const r = await fetch(`${BASE}/${ep}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const txt = await r.text();
  let j: unknown = null;
  try { j = JSON.parse(txt); } catch { /* noop */ }
  return { http: r.status, body: (j ?? { raw: txt.slice(0, 500) }) as Obj, ok: r.status === 200 };
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

function muestra(x: unknown, n = 2): unknown {
  if (Array.isArray(x)) return { n: x.length, ej: x.slice(0, n) };
  if (x && typeof x === 'object') {
    const o = x as Obj;
    const out: Obj = {};
    for (const k of Object.keys(o).slice(0, 12)) out[k] = Array.isArray(o[k]) ? muestra(o[k], n) : o[k];
    return out;
  }
  return x;
}

// Las que de verdad van a entrar hoy. Canceladas y no-shows fuera.
const VIVAS = new Set(['confirmed', 'checked_in', 'not_confirmed', 'pending']);

interface Cuarto { roomID: string; roomName: string; dormRoomName: string; roomTypeID: string; roomTypeName: string; roomBlocked: boolean }

// Cuartos sin nadie en TODO el rango: se le pregunta a Cloudbeds por la estancia
// completa, no por la noche de hoy.
async function cuartosLibres(key: string, pid: string, desde: string, hasta: string): Promise<Cuarto[]> {
  const r = await cbGet(key, 'getRoomsUnassigned', { propertyID: pid, startDate: desde, endDate: hasta });
  const props = (r.body.data ?? []) as Array<{ rooms?: Cuarto[] }>;
  return props.flatMap((p) => p.rooms ?? []).filter((c) => !c.roomBlocked);
}

// Una sola llamada por rango distinto: en un día hay muchas llegadas pero pocas
// combinaciones de fechas.
function libresCache(key: string, pid: string) {
  const cache = new Map<string, Promise<Cuarto[]>>();
  return (desde: string, hasta: string) => {
    const k = `${desde}|${hasta}`;
    if (!cache.has(k)) cache.set(k, cuartosLibres(key, pid, desde, hasta));
    return cache.get(k)!;
  };
}

async function llegadasDelDia(key: string, pid: string, fecha: string) {
  const r = await cbGet(key, 'getReservations', { propertyID: pid, checkInFrom: fecha, checkInTo: fecha, pageSize: '100' });
  const todas = (r.body.data ?? []) as Array<Obj>;
  const vivas = todas.filter((x) => VIVAS.has(String(x.status)));
  // El detalle es el que trae los cuartos concretos; se piden en paralelo.
  return await Promise.all(vivas.map(async (x) => {
    const d = await cbGet(key, 'getReservation', { propertyID: pid, reservationID: String(x.reservationID) });
    const dd = (d.body.data ?? {}) as Obj;
    return {
      reserva_id: String(x.reservationID),
      huesped: String(x.guestName ?? ''),
      estatus: String(x.status),
      origen: String(x.sourceName ?? ''),
      llegada: String(x.startDate ?? ''),
      salida: String(x.endDate ?? ''),
      asignados: (dd.assigned ?? []) as Array<Obj>,
      sin_asignar: (dd.unassigned ?? []) as Array<Obj>,
    };
  }));
}

// Quién está limpio hoy. Cloudbeds no lo sabe -en CDMX nadie actualiza allí el
// estatus de limpieza-: lo sabemos nosotros, en hk_estatus_dia, y se cruza con
// Cloudbeds por hk_areas.cloudbeds_room_id.
interface Estado { lista: boolean; etiqueta: string; limpiandose: boolean; quien: string | null; desde_min: number | null }
async function estadoLimpieza(supaId: string, fecha: string): Promise<Map<string, Estado>> {
  const m = new Map<string, Estado>();
  try {
    const areas = await rest(`hk_areas?property_id=eq.${supaId}&cloudbeds_room_id=not.is.null&select=id,cloudbeds_room_id&limit=1000`) as Array<{ id: string; cloudbeds_room_id: string }>;
    const est = await rest(`hk_estatus_dia?property_id=eq.${supaId}&fecha=eq.${fecha}&select=area_id,limpieza,limpieza_at,limpieza_por,estatus,solicita_limpieza&limit=1000`) as Array<{ area_id: string; limpieza: string | null; limpieza_at: string | null; limpieza_por: string | null; estatus: string; solicita_limpieza: boolean }>;
    const porArea = new Map(est.map((e) => [String(e.area_id), e]));
    for (const a of areas) {
      const e = porArea.get(String(a.id));
      // Limpio de verdad, o un cuarto que nadie ha usado y que nadie pidió limpiar.
      const lista = e?.limpieza === 'limpia' || (!!e && !e.solicita_limpieza && e.estatus === 'vacia_limpia');
      const limpiandose = e?.limpieza === 'limpiando';
      const etiqueta = e?.limpieza === 'limpia' ? 'limpia'
        : limpiandose ? 'limpiándose'
        : e?.limpieza === 'no_molestar' ? 'no molestar'
        : lista ? 'limpia' : 'por limpiar';
      // Cuánto lleva empezada: es lo que decide entre esperar y mover.
      const desde = limpiandose && e?.limpieza_at ? Math.max(0, Math.round((Date.now() - Date.parse(e.limpieza_at)) / 60000)) : null;
      m.set(String(a.cloudbeds_room_id), { lista, etiqueta, limpiandose, quien: e?.limpieza_por ?? null, desde_min: desde });
    }
  } catch { /* sin datos de limpieza se sigue, pero sin poder prometer nada */ }
  return m;
}

// Qué hacer con esta llegada. La pantalla no debe obligar a front a deducirlo:
// o hay una cama lista, o hay alguien con quien cambiarlo, o toca esperar.
function recomendar(f: {
  mi_estado: Estado; room_nombre: string;
  opciones: Array<{ room_id: string; nombre: string; lista: boolean; limpiandose: boolean; quien: string | null; desde_min: number | null }>;
  intercambios: Array<{ huesped: string; room_nombre: string; lista: boolean; ya_llego: boolean; room_id: string }>;
  noches: number; sin_asignar: boolean;
}): Obj {
  const n = f.noches === 1 ? 'la noche' : `las ${f.noches} noches`;
  if (!f.sin_asignar && f.mi_estado.lista) return { tipo: 'nada', texto: `${f.room_nombre} ya está lista. No hace falta moverle.` };

  const libre = f.opciones.find((o) => o.lista);
  if (libre) return { tipo: 'mover', room_id: libre.room_id, texto: `Dale ${libre.nombre}: está limpia y libre ${n}.` };

  // Cambiarlo por alguien que TODAVÍA NO HA LLEGADO. Mover a quien ya está
  // instalado es peor que esperar.
  const cambio = f.intercambios.find((i) => i.lista && !i.ya_llego);
  if (cambio) return { tipo: 'intercambiar', room_id: cambio.room_id, texto: `Cámbialo por ${cambio.huesped}, que todavía no llega: su ${cambio.room_nombre} está lista y son las mismas noches.` };

  // Nada listo: ¿hay algo a punto de entregarse?
  const enCurso = [f.mi_estado, ...f.opciones].find((o) => o.limpiandose);
  if (enCurso) {
    const quien = enCurso.quien ? String(enCurso.quien).split(' ')[0] : 'Housekeeping';
    const cuanto = enCurso.desde_min != null ? ` (lleva ${enCurso.desde_min} min)` : '';
    const cual = enCurso === f.mi_estado ? f.room_nombre : (f.opciones.find((o) => o.limpiandose)?.nombre ?? '');
    return { tipo: 'esperar', texto: `Espera: ${quien} está limpiando ${cual}${cuanto}. En cuanto la entregue es suya.` };
  }

  const ocupado = f.intercambios.find((i) => i.lista);
  if (ocupado) return { tipo: 'intercambiar', room_id: ocupado.room_id, texto: `Lo único listo es ${ocupado.room_nombre}, pero ${ocupado.huesped} ya se instaló. Mejor avísale a housekeeping.` };

  return { tipo: 'nada', texto: `No hay nada listo de este tipo ${n}. Habría que apurar la limpieza o cambiarle de tipo en Cloudbeds.` };
}

// Soltar un cuarto: newRoomID vacío y el reservationRoomID de la fila que se suelta.
const soltar = (key: string, pid: string, reserva: string, rrid: string, sub: string) =>
  cbPost(key, 'postRoomAssign', { propertyID: pid, reservationID: reserva, reservationRoomID: rrid, newRoomID: '', ...(sub ? { subReservationID: sub } : {}) });

const asignar = (key: string, pid: string, reserva: string, roomId: string, tipo: string, viejo: string, sub: string) =>
  cbPost(key, 'postRoomAssign', {
    propertyID: pid, reservationID: reserva, newRoomID: roomId, roomTypeID: tipo,
    ...(viejo ? { oldRoomID: viejo } : {}), ...(sub ? { subReservationID: sub } : {}),
  });

function rastro(cfg: { supaId: string }, fecha: string, d: Obj) {
  return rest('hk_movimientos_cuarto', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ property_id: cfg.supaId, fecha, ...d }) })
    .catch(() => { /* el rastro no puede tumbar el movimiento */ });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    let prop = 'cdmx', fecha = hoyTZ(), accion = 'diag';
    const b = await req.json().catch(() => ({})) as Obj;
    if (b.prop) prop = String(b.prop);
    if (b.fecha) fecha = String(b.fecha);
    if (b.accion) accion = String(b.accion);
    if (prop.length > 12) prop = porSupaId(prop) ?? 'cdmx';
    const cfg = PROPS[prop];
    if (!cfg) return J({ ok: false, error: 'propiedad inválida' }, 400);
    const key = Deno.env.get(cfg.keyEnv);
    const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? '') ?? '';
    if (!key || !pid) return J({ ok: false, error: 'sin credenciales Cloudbeds' }, 500);

    const manana = masDias(fecha, 1);

    if (accion === 'diag') {
      const pruebas: Obj = {};
      for (const [nombre, ep, params] of [
        ['rooms', 'getRooms', { propertyID: pid }],
        ['unassigned', 'getRoomsUnassigned', { propertyID: pid, startDate: fecha, endDate: manana }],
        ['reservas', 'getReservations', { propertyID: pid, checkInFrom: fecha, checkInTo: fecha, pageSize: '3' }],
      ] as Array<[string, string, Record<string, string>]>) {
        const r = await cbGet(key, ep, params);
        pruebas[nombre] = { http: r.http, muestra: muestra(r.body.data ?? r.body) };
      }
      return J({ ok: true, prop, fecha, pruebas });
    }

    // Para comprobar si Cloudbeds da la intersección del rango: si al alargar las
    // noches la lista se encoge, sí la da, y entonces preguntar por la estancia
    // completa basta para no descuadrar a nadie.
    if (accion === 'rangos') {
      const out: Obj = {};
      for (const n of [1, 2, 3, 7, 14, 30]) {
        const libres = await cuartosLibres(key, pid, fecha, masDias(fecha, n));
        out[`${n}n`] = { hasta: masDias(fecha, n), libres: libres.length, ej: libres.slice(0, 3).map((c) => c.roomName) };
      }
      return J({ ok: true, prop, fecha, out });
    }

    if (accion === 'detalle') {
      const id = String(b.reserva_id ?? '');
      if (!id) return J({ ok: false, error: 'falta reserva_id' }, 400);
      const d = await cbGet(key, 'getReservation', { propertyID: pid, reservationID: id });
      return J({ ok: true, http: d.http, data: d.body.data ?? d.body });
    }

    if (accion === 'libres') {
      const [llegadas, limpieza] = await Promise.all([
        llegadasDelDia(key, pid, fecha),
        estadoLimpieza(cfg.supaId, fecha),
      ]);
      const comoEsta = (roomId: string): Estado => limpieza.get(String(roomId)) ?? { lista: false, etiqueta: 'sin datos', limpiandose: false, quien: null, desde_min: null };
      const libresDe = libresCache(key, pid);

      // Una fila por cuarto o cama a entregar: un grupo de tres camas son tres
      // movimientos distintos, cada uno con su propia estancia.
      const crudas = llegadas.flatMap((r) => [
        ...r.asignados.map((a) => ({ r, a, sin: false })),
        ...r.sin_asignar.map((a) => ({ r, a, sin: true })),
      ]);

      const filas = await Promise.all(crudas.map(async ({ r, a, sin }) => {
        // Las fechas del CUARTO, no las de la reserva: en una reserva de varias
        // habitaciones cada una puede entrar y salir en días distintos.
        const desde = String(a.startDate ?? r.llegada ?? fecha);
        const hasta = String(a.endDate ?? r.salida ?? manana);
        const tipo = String(a.roomTypeID ?? '');
        const libres = await libresDe(desde, hasta);
        return {
          reserva_id: r.reserva_id, huesped: r.huesped, estatus: r.estatus, origen: r.origen,
          sin_asignar: sin,
          room_id: String(a.roomID ?? ''), room_nombre: String(a.roomName ?? ''),
          reservation_room_id: String(a.reservationRoomID ?? ''),
          room_type_id: tipo, room_tipo_nombre: String(a.roomTypeName ?? ''),
          sub_reserva_id: String(a.subReservationID ?? ''),
          desde, hasta, noches: noches(desde, hasta),
          ya_llego: r.estatus === 'checked_in',
          mi_estado: comoEsta(String(a.roomID ?? '')),
          // Libres TODA la estancia. Las limpias primero: son las únicas que de
          // verdad resuelven el problema; las otras se enseñan marcadas, porque a
          // veces están hechas y nadie las ha marcado todavía.
          opciones: libres
            .filter((c) => String(c.roomTypeID) === tipo && String(c.roomID) !== String(a.roomID ?? ''))
            .map((c) => ({ room_id: c.roomID, nombre: c.roomName, dorm: c.dormRoomName ?? '', ...comoEsta(String(c.roomID)) }))
            .sort((x, y) => Number(y.lista) - Number(x.lista) || String(x.nombre).localeCompare(String(y.nombre), 'es', { numeric: true })),
          intercambios: [] as Array<Obj>,
        };
      }));

      // Cuando el cuarto bueno lo tiene otra llegada de hoy, la salida es cambiarlos
      // entre sí. Solo se ofrece si los dos ocupan EXACTAMENTE las mismas noches:
      // si uno se queda más, el intercambio le deja sin cuarto a partir de cierto
      // día y eso sí descuadra el calendario.
      for (const f of filas) {
        if (f.sin_asignar || !f.room_id) continue;
        f.intercambios = filas
          .filter((o) => !o.sin_asignar && o.room_id && o.room_id !== f.room_id
            && o.room_type_id === f.room_type_id && o.desde === f.desde && o.hasta === f.hasta
            && !(o.reserva_id === f.reserva_id && o.sub_reserva_id === f.sub_reserva_id))
          .map((o) => ({
            reserva_id: o.reserva_id, huesped: o.huesped, room_id: o.room_id, room_nombre: o.room_nombre,
            reservation_room_id: o.reservation_room_id, sub_reserva_id: o.sub_reserva_id,
            ya_llego: o.ya_llego,
            ...comoEsta(o.room_id),
          }))
          // Primero los que están listos, y de esos, los que todavía no han
          // llegado: mover a alguien ya instalado es lo último que se hace.
          .sort((x, y) => Number(y.lista) - Number(x.lista) || Number(x.ya_llego) - Number(y.ya_llego));
      }

      for (const f of filas) (f as Obj).recomendacion = recomendar(f as never);

      const libresHoy = await libresDe(fecha, manana);
      return J({ ok: true, prop, fecha, filas, total_libres_hoy: libresHoy.length });
    }

    if (accion === 'mover') {
      const reserva = String(b.reserva_id ?? '');
      const destino = String(b.room_id_destino ?? '');
      const tipo = String(b.room_type_id ?? '');
      const origen = String(b.room_id_origen ?? '');
      const sub = String(b.sub_reserva_id ?? '');
      const desde = String(b.desde ?? fecha);
      const hasta = String(b.hasta ?? manana);
      if (!reserva || !destino || !tipo) return J({ ok: false, error: 'faltan datos: reserva_id, room_id_destino, room_type_id' }, 400);
      if (b.confirmar !== true) return J({ ok: false, error: 'falta confirmar:true' }, 400);

      // Se vuelve a comprobar TODA la estancia, y en el momento de mover, no cuando
      // se pintó la pantalla: entre una cosa y otra puede haber entrado una reserva
      // para pasado mañana.
      const libres = await cuartosLibres(key, pid, desde, hasta);
      const elegido = libres.find((c) => String(c.roomID) === destino);
      if (!elegido) {
        return J({
          ok: false, error: 'ocupado',
          detalle: `Ese cuarto ya no está libre las ${noches(desde, hasta)} noches de la estancia (${desde} → ${hasta}). Vuelve a cargar la lista.`,
        }, 409);
      }
      if (String(elegido.roomTypeID) !== tipo) return J({ ok: false, error: 'otro_tipo', detalle: 'Ese cuarto no es del mismo tipo que el de la reserva.' }, 400);

      // Y que esté limpio: mandarle a otro cuarto sucio no resuelve nada. Se puede
      // forzar -a veces está hecho y nadie lo ha marcado- pero a propósito.
      const limp = await estadoLimpieza(cfg.supaId, fecha);
      const est = limp.get(destino) ?? { lista: false, etiqueta: 'sin datos', limpiandose: false, quien: null, desde_min: null };
      if (!est.lista && b.permitir_sucia !== true) {
        return J({ ok: false, error: 'no_lista', etiqueta: est.etiqueta, detalle: `${elegido.roomName} está ${est.etiqueta}. Si de verdad ya está lista, vuelve a intentarlo confirmando.` }, 409);
      }

      // Con oldRoomID, Cloudbeds suelta el cuarto viejo: vuelve al inventario y
      // housekeeping deja de tenerlo como llegada.
      const r = await asignar(key, pid, reserva, destino, tipo, origen, sub);
      const bien = r.ok && r.body.success !== false;

      await rastro(cfg, fecha, {
        reserva_id: reserva, huesped: b.huesped ?? null, room_type_id: tipo,
        room_id_origen: origen || null, room_nombre_origen: b.room_nombre_origen ?? null,
        room_id_destino: destino, room_nombre_destino: elegido.roomName ?? null,
        motivo: b.motivo ?? null, hecho_por: b.hecho_por ?? null, hecho_por_nombre: b.hecho_por_nombre ?? null,
        resultado: bien ? 'ok' : 'error',
        respuesta: { tipo_movimiento: 'mover', estancia: { desde, hasta, noches: noches(desde, hasta) }, cloudbeds: r.body },
      });

      if (!bien) return J({ ok: false, error: 'cloudbeds', http: r.http, respuesta: r.body }, 502);
      return J({ ok: true, movido_a: elegido.roomName, room_id: destino, noches: noches(desde, hasta), respuesta: r.body });
    }

    if (accion === 'intercambiar') {
      const A = (b.a ?? {}) as Obj, B = (b.b ?? {}) as Obj;
      const tipo = String(b.room_type_id ?? '');
      const desde = String(b.desde ?? fecha), hasta = String(b.hasta ?? manana);
      const aR = String(A.reserva_id ?? ''), aRoom = String(A.room_id ?? ''), aRR = String(A.reservation_room_id ?? ''), aSub = String(A.sub_reserva_id ?? '');
      const bR = String(B.reserva_id ?? ''), bRoom = String(B.room_id ?? ''), bRR = String(B.reservation_room_id ?? ''), bSub = String(B.sub_reserva_id ?? '');
      if (!aR || !aRoom || !bR || !bRoom || !tipo) return J({ ok: false, error: 'faltan datos del intercambio' }, 400);
      if (aRoom === bRoom) return J({ ok: false, error: 'mismo_cuarto' }, 400);
      if (b.confirmar !== true) return J({ ok: false, error: 'falta confirmar:true' }, 400);

      // El cuarto al que va A tiene que estar limpio: si no, el intercambio no
      // arregla nada, solo cambia de sitio el problema.
      {
        const limp = await estadoLimpieza(cfg.supaId, fecha);
        const est = limp.get(bRoom) ?? { lista: false, etiqueta: 'sin datos', limpiandose: false, quien: null, desde_min: null };
        if (!est.lista && b.permitir_sucia !== true) {
          return J({ ok: false, error: 'no_lista', etiqueta: est.etiqueta, detalle: `${B.room_nombre ?? bRoom} está ${est.etiqueta}. Si de verdad ya está lista, vuelve a intentarlo confirmando.` }, 409);
        }
      }

      const base = {
        reserva_id: aR, huesped: A.huesped ?? null, room_type_id: tipo,
        room_id_origen: aRoom, room_nombre_origen: A.room_nombre ?? null,
        room_id_destino: bRoom, room_nombre_destino: B.room_nombre ?? null,
        motivo: b.motivo ?? null, hecho_por: b.hecho_por ?? null, hecho_por_nombre: b.hecho_por_nombre ?? null,
      };

      // 1) B suelta su cuarto — si no, el de A no puede entrar.
      const s = await soltar(key, pid, bR, bRR, bSub);
      if (!s.ok || s.body.success === false) {
        await rastro(cfg, fecha, { ...base, resultado: 'error', respuesta: { tipo_movimiento: 'intercambiar', paso: 'soltar_b', cloudbeds: s.body } });
        return J({ ok: false, error: 'cloudbeds', paso: 'soltar', detalle: 'No se pudo liberar la habitación del otro huésped. No se cambió nada.', respuesta: s.body }, 502);
      }

      // 2) A entra al cuarto de B; con oldRoomID, el suyo queda suelto.
      const pa = await asignar(key, pid, aR, bRoom, tipo, aRoom, aSub);
      if (!pa.ok || pa.body.success === false) {
        // Marcha atrás: B vuelve a donde estaba y nadie se queda sin cuarto.
        const vuelta = await asignar(key, pid, bR, bRoom, tipo, '', bSub);
        await rastro(cfg, fecha, { ...base, resultado: 'error', respuesta: { tipo_movimiento: 'intercambiar', paso: 'mover_a', cloudbeds: pa.body, rollback: vuelta.body } });
        return J({ ok: false, error: 'cloudbeds', paso: 'mover_a', detalle: 'No se pudo mover al huésped. Se dejó todo como estaba.', respuesta: pa.body }, 502);
      }

      // 3) B entra al que acaba de dejar A.
      const pb = await asignar(key, pid, bR, aRoom, tipo, '', bSub);
      const bien = pb.ok && pb.body.success !== false;

      await rastro(cfg, fecha, {
        ...base, resultado: bien ? 'ok' : 'parcial',
        respuesta: { tipo_movimiento: 'intercambiar', estancia: { desde, hasta, noches: noches(desde, hasta) }, mover_a: pa.body, mover_b: pb.body },
      });
      // El segundo huésped también deja su rastro, para que cada reserva tenga el suyo.
      await rastro(cfg, fecha, {
        reserva_id: bR, huesped: B.huesped ?? null, room_type_id: tipo,
        room_id_origen: bRoom, room_nombre_origen: B.room_nombre ?? null,
        room_id_destino: aRoom, room_nombre_destino: A.room_nombre ?? null,
        motivo: b.motivo ?? null, hecho_por: b.hecho_por ?? null, hecho_por_nombre: b.hecho_por_nombre ?? null,
        resultado: bien ? 'ok' : 'error',
        respuesta: { tipo_movimiento: 'intercambiar', pareja_de: aR, cloudbeds: pb.body },
      });

      if (!bien) {
        return J({
          ok: false, error: 'a_medias', paso: 'mover_b',
          detalle: `${A.huesped ?? 'El huésped'} ya está en ${B.room_nombre ?? bRoom}, pero ${B.huesped ?? 'el otro huésped'} se quedó SIN habitación asignada. Asígnasela a mano en Cloudbeds (${A.room_nombre ?? aRoom} está libre).`,
          respuesta: pb.body,
        }, 502);
      }
      return J({ ok: true, intercambio: true, a_en: B.room_nombre ?? bRoom, b_en: A.room_nombre ?? aRoom, noches: noches(desde, hasta) });
    }

    return J({ ok: false, error: 'acción desconocida' }, 400);
  } catch (e) { return J({ ok: false, error: String(e) }, 500); }
});
