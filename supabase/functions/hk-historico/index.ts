// hk-historico: trae de Cloudbeds la ocupación noche a noche del año pasado y la guarda
// en hk_ocupacion_hist, que es la base de la previsión de personal.
//   accion=ingesta  -> body {prop, desde, hasta}  (tramos de 1-2 meses, por el tiempo de la función)
//
// Contención 27-sep-2026: solo el equipo (o servidor). Se retiró accion=probe,
// que devolvía reservas crudas de Cloudbeds a cualquiera.
import { quienLlama, noAutorizado } from "./equipo.ts";

const BASE = Deno.env.get('CLOUDBEDS_BASE_URL') ?? 'https://hotels.cloudbeds.com/api/v1.2';
const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROPS: Record<string, { supaId: string; keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { supaId: '45e69775-d877-4507-a9e1-a45bd3400dc5', keyEnv: 'CLOUDBEDS_API_KEY', id: '10668' },
  puebla: { supaId: 'febfbef6-7fd1-4b45-84d9-13533e8dcb72', keyEnv: 'CLOUDBEDS_API_KEY_PUEBLA', idEnv: 'CLOUDBEDS_PROPERTY_ID_PUEBLA' },
};

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : null;
}

const dia = (d: string) => d.slice(0, 10);
const suma = (f: string, n: number) => new Date(Date.parse(f + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

async function cbReservas(key: string, pid: string, desde: string, hasta: string) {
  const out: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 60; page++) {
    const url = new URL(`${BASE}/getReservations`);
    url.searchParams.set('propertyID', pid);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('pageNumber', String(page));
    url.searchParams.set('checkOutFrom', desde);
    url.searchParams.set('checkInTo', hasta);
    url.searchParams.set('includeAllRooms', 'true');
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json().catch(() => ({ success: false }));
    if (!j.success) break;
    const d = (j.data as Array<Record<string, unknown>>) ?? [];
    out.push(...d);
    if (d.length < 100) break;
  }
  return out;
}

interface Area { id: string; tipo: string; parent_id: string | null }
interface Noche { ocupadas: number; llegadas: number; salidas: number; privadas: number; camas: number; priv_salidas: number; cama_salidas: number; dorms: Set<string> }

function acumular(res: Array<Record<string, unknown>>, porCb: Map<string, Area>, desde: string, hasta: string) {
  const dias = new Map<string, Noche>();
  const vacio = (): Noche => ({ ocupadas: 0, llegadas: 0, salidas: 0, privadas: 0, camas: 0, priv_salidas: 0, cama_salidas: 0, dorms: new Set() });
  const g = (f: string) => { let n = dias.get(f); if (!n) { n = vacio(); dias.set(f, n); } return n; };

  for (const r of res) {
    const estado = String(r.status ?? '').toLowerCase();
    if (estado === 'canceled' || estado === 'cancelled' || estado === 'no_show') continue;
    const rooms = (r.rooms as Array<Record<string, unknown>> | undefined) ?? [];
    const lista = rooms.length ? rooms : [{ roomID: r.roomID, roomCheckIn: r.startDate, roomCheckOut: r.endDate }];
    for (const h of lista) {
      const ini = dia(String(h.roomCheckIn ?? h.startDate ?? r.startDate ?? ''));
      const fin = dia(String(h.roomCheckOut ?? h.endDate ?? r.endDate ?? ''));
      if (!ini || !fin || ini > fin) continue;
      const a = porCb.get(String(h.roomID ?? ''));
      const tipo = a?.tipo ?? 'privada';
      const dorm = a?.parent_id ?? null;
      for (let f = ini; f < fin; f = suma(f, 1)) {
        if (f < desde || f > hasta) continue;
        const n = g(f);
        n.ocupadas++;
        if (tipo === 'cama') { n.camas++; if (dorm) n.dorms.add(dorm); } else n.privadas++;
        if (f === ini) n.llegadas++;
      }
      if (fin >= desde && fin <= hasta) {
        const n = g(fin);
        n.salidas++;
        if (tipo === 'cama') { n.cama_salidas++; if (dorm) n.dorms.add(dorm); } else n.priv_salidas++;
      }
    }
  }
  return dias;
}

async function ingesta(propKey: string, desde: string, hasta: string) {
  const cfg = PROPS[propKey];
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? '') ?? '';
  if (!key || !pid) return { ok: false, error: 'sin credenciales Cloudbeds' };

  const areas = await rest(`hk_areas?property_id=eq.${cfg.supaId}&select=id,tipo,parent_id,cloudbeds_room_id&limit=1000`) as Array<{ id: string; tipo: string; parent_id: string | null; cloudbeds_room_id: string | null }>;
  const porCb = new Map(areas.filter((a) => a.cloudbeds_room_id).map((a) => [String(a.cloudbeds_room_id), a]));

  const res = await cbReservas(key, pid, desde, hasta);
  const dias = acumular(res, porCb, desde, hasta);

  const filas = [...dias.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, n]) => ({
    property_id: cfg.supaId, fecha,
    unidades_ocupadas: n.ocupadas, camas_ocupadas: n.camas, privadas_ocupadas: n.privadas,
    llegadas: n.llegadas, salidas: n.salidas, camas_salida: n.cama_salidas, privadas_salida: n.priv_salidas,
    dorms_tocados: n.dorms.size,
    fuente: 'cloudbeds',
  }));
  for (let i = 0; i < filas.length; i += 200) {
    await rest('hk_ocupacion_hist?on_conflict=property_id,fecha', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(filas.slice(i, i + 200)) });
  }
  return { ok: true, reservas: res.length, dias: filas.length, desde, hasta, muestra: filas.slice(0, 3) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado();
  try {
    let prop = 'cdmx', desde = '', hasta = '';
    try { const u = new URL(req.url); prop = u.searchParams.get('prop') ?? prop; desde = u.searchParams.get('desde') ?? desde; hasta = u.searchParams.get('hasta') ?? hasta; } catch { /* noop */ }
    try { const b = await req.json(); if (b?.prop) prop = b.prop; if (b?.desde) desde = b.desde; if (b?.hasta) hasta = b.hasta; } catch { /* noop */ }
    if (!PROPS[prop]) return J({ ok: false, error: 'propiedad inválida' }, 400);
    if (!desde || !hasta) return J({ ok: false, error: 'faltan desde y hasta' }, 400);
    return J(await ingesta(prop, desde, hasta));
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message ?? e) }, 500);
  }
});
