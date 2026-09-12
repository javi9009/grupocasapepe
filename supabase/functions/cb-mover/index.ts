// cb-mover — cambiar de habitación a un huésped en el check-in sin tocar el calendario.
//
// Llega alguien, su cama o su privada todavía no está lista, y hay otra libre del
// MISMO tipo. En Cloudbeds eso no es cambiar la reserva: es reasignar el cuarto
// físico (postRoomAssign). Las fechas, la tarifa y la factura no se mueven, y por
// eso el calendario no se entera. Cambiar de TIPO de cuarto sí sería otra cosa
// —eso toca precio— y aquí no se hace.
//
//  accion=diag     solo lectura: qué contestan los endpoints con esta llave
//  accion=libres   llegadas de hoy, su cuarto y los cuartos libres del mismo tipo
//  accion=mover    reasigna de verdad (exige confirmar:true)
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
  return { http: r.status, body: (j ?? { raw: txt.slice(0, 500) }) as Obj };
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

async function cuartosLibres(key: string, pid: string, desde: string, hasta: string): Promise<Cuarto[]> {
  const r = await cbGet(key, 'getRoomsUnassigned', { propertyID: pid, startDate: desde, endDate: hasta });
  const props = (r.body.data ?? []) as Array<{ rooms?: Cuarto[] }>;
  return props.flatMap((p) => p.rooms ?? []).filter((c) => !c.roomBlocked);
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

    const manana = new Date(Date.parse(fecha + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

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

    if (accion === 'detalle') {
      const id = String(b.reserva_id ?? '');
      if (!id) return J({ ok: false, error: 'falta reserva_id' }, 400);
      const d = await cbGet(key, 'getReservation', { propertyID: pid, reservationID: id });
      return J({ ok: true, http: d.http, data: d.body.data ?? d.body });
    }

    if (accion === 'libres') {
      const [llegadas, libres] = await Promise.all([
        llegadasDelDia(key, pid, fecha),
        cuartosLibres(key, pid, fecha, manana),
      ]);
      // Agrupados por tipo: a un huésped solo se le ofrece cambio DENTRO de su tipo,
      // porque cambiar de tipo cambia el precio y eso ya no es mover, es vender otra cosa.
      const porTipo: Record<string, Cuarto[]> = {};
      for (const c of libres) (porTipo[c.roomTypeID] = porTipo[c.roomTypeID] ?? []).push(c);
      return J({ ok: true, prop, fecha, llegadas, libres_por_tipo: porTipo, total_libres: libres.length });
    }

    if (accion === 'mover') {
      const reserva = String(b.reserva_id ?? '');
      const destino = String(b.room_id_destino ?? '');
      const tipo = String(b.room_type_id ?? '');
      const origen = String(b.room_id_origen ?? '');
      const sub = String(b.sub_reserva_id ?? '');
      if (!reserva || !destino || !tipo) return J({ ok: false, error: 'faltan datos: reserva_id, room_id_destino, room_type_id' }, 400);
      if (b.confirmar !== true) return J({ ok: false, error: 'falta confirmar:true' }, 400);

      // El cuarto de destino tiene que seguir libre en el momento de mover, no cuando
      // se pintó la pantalla: entre una cosa y otra puede haber entrado alguien.
      const libres = await cuartosLibres(key, pid, fecha, manana);
      const elegido = libres.find((c) => String(c.roomID) === destino);
      if (!elegido) return J({ ok: false, error: 'ocupado', detalle: 'Ese cuarto ya no está libre. Vuelve a cargar la lista.' }, 409);
      if (String(elegido.roomTypeID) !== tipo) return J({ ok: false, error: 'otro_tipo', detalle: 'Ese cuarto no es del mismo tipo que el de la reserva.' }, 400);

      const form: Record<string, string> = { propertyID: pid, reservationID: reserva, newRoomID: destino, roomTypeID: tipo };
      if (origen) form.oldRoomID = origen;      // reasignación: Cloudbeds pide de dónde sale
      if (sub) form.subReservationID = sub;
      const r = await cbPost(key, 'postRoomAssign', form);
      const bien = r.http === 200 && r.body.success !== false;

      // Quede bien o mal, se deja rastro: Cloudbeds no guarda quién lo hizo ni por qué.
      try {
        await rest('hk_movimientos_cuarto', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            property_id: cfg.supaId, fecha, reserva_id: reserva, huesped: b.huesped ?? null,
            room_type_id: tipo, room_id_origen: origen || null, room_nombre_origen: b.room_nombre_origen ?? null,
            room_id_destino: destino, room_nombre_destino: elegido.roomName ?? null,
            motivo: b.motivo ?? null, hecho_por: b.hecho_por ?? null, hecho_por_nombre: b.hecho_por_nombre ?? null,
            resultado: bien ? 'ok' : 'error', respuesta: r.body,
          }),
        });
      } catch { /* el rastro no puede tumbar el movimiento */ }

      if (!bien) return J({ ok: false, error: 'cloudbeds', http: r.http, respuesta: r.body }, 502);
      return J({ ok: true, movido_a: elegido.roomName, room_id: destino, respuesta: r.body });
    }

    return J({ ok: false, error: 'acción desconocida' }, 400);
  } catch (e) { return J({ ok: false, error: String(e) }, 500); }
});
