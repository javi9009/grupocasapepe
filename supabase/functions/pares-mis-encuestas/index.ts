import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const TOPE = 7, MIN = 3;
/* EL PROMEDIO SE VE DESDE LA PRIMERA; EL NUMERO DE PERSONAS, DESDE CINCO.
   Javi, 20-nov-2026: «no son 5 opiniones: a partir de 1 muestras el promedio,
   pero TU le dices que son 5 o mas los que le valoraron, para que vea de
   cuantas personas nace el dato; si son menos de 5 no lo pongas, porque igual
   intuye quien dijo que».
   Las dos cosas son distintas y las habiamos atado a la misma regla: saber tu
   nota es tuyo desde el primer dia, y saber cuanta gente la sostiene solo
   ayuda cuando ya no senala a nadie. En una casa de doce personas, «basado en
   2 valoraciones» es media pista de quien fue. */
const MIN_VER = 1;    // desde cuantas se enseña el promedio
const MIN_CUENTA = 5; // desde cuantas se dice cuantas son
/* SOLO LAS 15 PREGUNTAS DE AHORA, Y SOLO DE ESTA SEMANA. Javi, 20-nov-2026:
   «descarta las valoraciones anteriores a esta semana; para nuestro nuevo
   sistema solo considera las 15 preguntas que tenemos, porque si no no
   podriamos unificar». La encuesta vieja tenia otras siete preguntas, con
   otra escala y otro sentido: promediar las dos da un numero que no significa
   nada. Lo viejo no se borra -va en un informe aparte-, pero no cuenta. */
function lunesDeEstaSemana(): string {
  const ahora = new Date();
  const mx = new Date(ahora.getTime() - 6 * 3600 * 1000); // CDMX = UTC-6
  const dow = mx.getUTCDay(); // 0 domingo
  const atras = (dow + 6) % 7; // dias desde el lunes
  const d = new Date(Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate() - atras, 6, 0, 0));
  return d.toISOString();
}
function h32(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* LA UBICACION MANDA. Javi, 21-nov-2026: «que solo puedan valorar a
   compañeros de su ubicacion Virreyes / CDMX / Puebla».
   Una valoracion entre pares dice como es trabajar contigo, y eso solo lo
   sabe quien te ve trabajar: con 50 personas en tres sedes, la mitad de la
   lista eran nombres que el que valora no ha visto nunca. Aqui se quitan de
   la lista; la regla que cuenta la aplica pares-enviar al guardar. */
function proy(s) {
  const t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t) return '';
  if (t.includes('virrey')) return 'virreyes';
  if (t.includes('puebla')) return 'puebla';
  if (t.includes('sincr')) return 'sincretico';
  if (t.includes('corp')) return 'corp';
  if (t.includes('cdmx') || t.includes('mexico') || t.includes('df')) return 'cdmx';
  return t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const asUser = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + tok } }, auth: { persistSession: false } });
    const { data: u } = await asUser.auth.getUser();
    if (!u || !u.user) return json({ ok: false, error: 'No autenticado' }, 401);
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { data: me } = await admin.from('employees').select('id, area, sede').eq('user_id', u.user.id).maybeSingle();
    if (!me) return json({ ok: false, error: 'No se encontró tu ficha' }, 404);

    const now = new Date(); const y = now.getUTCFullYear(); const q = Math.floor(now.getUTCMonth() / 4);
    const cuIni = new Date(Date.UTC(y, q * 4, 1)).toISOString();
    const seed = y * 10 + q; const cuLabel = 'C' + (q + 1) + ' ' + y;
    const desdeSemana = lunesDeEstaSemana();

    /* Mis ubicaciones, mas la mia propia: mis_ubicaciones es la cascada de
       acceso a datos y alguna ficha la tiene distinta de su sede, asi que la
       sede propia siempre cuenta. Si la cascada no contesta, queda la sede
       sola: aqui fallar abierto seria no tener regla. */
    const permitidas = new Set<string>();
    try {
      const { data: ub } = await admin.rpc('mis_ubicaciones', { p_email: String(u.user.email || '').toLowerCase() });
      (ub || []).forEach((x: string) => permitidas.add(proy(x)));
    } catch (_) { /* la sede propia basta */ }
    if (proy(me.sede)) permitidas.add(proy(me.sede));

    // preguntas pares
    const { data: preguntas } = await admin.from('enc_preguntas').select('id, orden, bloque, pregunta, tipo, polo_bajo, polo_alto').eq('activa', true).eq('tipo_encuesta', 'pares').order('orden');
    const bMap = Object.fromEntries((preguntas || []).map(p => [p.id, p.bloque]));
    const vivas = new Set((preguntas || []).filter(p => p.bloque !== 'cierre').map(p => p.id));

    // mis envios (contestadas) con target y respuesta completa
    const { data: inv } = await admin.from('enc_invitaciones').select('ronda_id, created_at, textos, media, contestada').eq('respondente_id', me.id).eq('contestada', true).order('created_at', { ascending: false });
    const rondaIds = [...new Set((inv || []).map(r => r.ronda_id))];
    let rondas = [];
    if (rondaIds.length) { const { data: rr } = await admin.from('enc_rondas').select('id, employee_id, tipo, lanzada_at').in('id', rondaIds); rondas = rr || []; }
    const rmap = Object.fromEntries(rondas.map(r => [r.id, r]));
    const targetIds = [...new Set(rondas.map(r => r.employee_id))];
    let tnames = {};
    if (targetIds.length) { const { data: te } = await admin.from('employees').select('id, nombre_display, nombre').in('id', targetIds); tnames = Object.fromEntries((te || []).map(e => [e.id, e.nombre_display || e.nombre])); }
    const targetsCuatri = new Set();
    const contestadas = [];
    for (const i of (inv || [])) {
      const r = rmap[i.ronda_id]; if (!r || r.tipo !== 'pares') continue;
      if (r.lanzada_at && r.lanzada_at >= cuIni) targetsCuatri.add(r.employee_id);
      contestadas.push({ ronda_id: i.ronda_id, target: r.employee_id, nombre: tnames[r.employee_id] || '—', fecha: String(i.created_at).slice(0, 10), media: i.media, respuestas: (i.textos && i.textos.respuestas) || [] });
    }
    const restante = Math.max(0, TOPE - targetsCuatri.size);

    /* A quien puedo valorar: mi gente, de mi ubicacion. La jerarquia no se
       corta por la sede -un jefe regional evalua a su gente donde este-, asi
       que quien esta en mis ciclos entra aunque trabaje en otra. */
    const { data: lazos } = await admin.from('eval_ciclos').select('employee_id, jefe_id').or('jefe_id.eq.' + me.id + ',employee_id.eq.' + me.id);
    const deLaJerarquia = new Set<string>();
    (lazos || []).forEach((c: any) => { if (c.jefe_id === me.id) deLaJerarquia.add(c.employee_id); if (c.employee_id === me.id) deLaJerarquia.add(c.jefe_id); });

    // candidatos y sugeridos (comparten procedimientos = misma area)
    const { data: emps } = await admin.from('employees').select('id, nombre_display, nombre, area, sede, rol, user_id').eq('estatus', 'activo').not('user_id', 'is', null);
    const pool = (emps || []).filter(e => e.id !== me.id
      && (e.area || '') !== 'Voluntariado'
      && !/^socio/i.test(e.rol || '')
      && !targetsCuatri.has(e.id)
      && (permitidas.size === 0 || permitidas.has(proy(e.sede)) || deLaJerarquia.has(e.id)));
    const mapc = e => ({ id: e.id, nombre: e.nombre_display || e.nombre, area: e.area || '', sede: e.sede || '' });
    const candidatos = pool.map(mapc).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    let sugPool = pool.filter(e => (e.area || '') === (me.area || '') && me.area);
    if (sugPool.length < MIN) { const extra = pool.filter(e => (e.sede || '') === (me.sede || '') && (e.area || '') !== (me.area || '')); sugPool = sugPool.concat(extra); }
    if (sugPool.length < MIN) sugPool = sugPool.concat(pool.filter(e => sugPool.indexOf(e) < 0));
    const sugeridos = sugPool.map(e => ({ e, k: h32(e.id + ':' + seed) })).sort((a, b) => a.k - b.k).slice(0, MIN).map(x => mapc(x.e));

    // soy jefe: valoraciones pendientes de mi equipo
    const { data: cic } = await admin.from('eval_ciclos').select('id, employee_id, vence, tipo_jefe, estado').eq('jefe_id', me.id).in('estado', ['pendiente', 'notificado']);
    const eids = [...new Set((cic || []).map(c => c.employee_id))];
    let enames = {};
    if (eids.length) { const { data: ee } = await admin.from('employees').select('id, nombre_display, nombre').in('id', eids); enames = Object.fromEntries((ee || []).map(e => [e.id, e.nombre_display || e.nombre])); }
    const jefe_pendientes = (cic || []).map(c => ({ ciclo: c.id, evaluado: enames[c.employee_id] || '—', vence: c.vence, tipo_jefe: c.tipo_jefe, estado: c.estado }));

    // mis valoraciones recibidas: solo las 15 preguntas vivas y solo de esta semana
    const { data: myr } = await admin.from('enc_rondas').select('id').eq('tipo', 'pares').eq('employee_id', me.id);
    const myRondas = (myr || []).map(r => r.id);
    let nPeers = 0, items = [], bloques = [], general = null;
    if (myRondas.length) {
      const { count } = await admin.from('enc_invitaciones').select('id', { count: 'exact', head: true })
        .in('ronda_id', myRondas).eq('contestada', true).gte('created_at', desdeSemana);
      nPeers = count || 0;
      if (nPeers >= MIN_VER) {
        const { data: resp } = await admin.from('enc_respuestas').select('pregunta_id, valor, created_at')
          .in('ronda_id', myRondas).gte('created_at', desdeSemana);
        const agg = {}, aggB = {}; let sT = 0, nT = 0;
        for (const r of (resp || [])) {
          if (r.valor == null) continue;
          if (!vivas.has(r.pregunta_id)) continue;   // la encuesta vieja no entra
          (agg[r.pregunta_id] = agg[r.pregunta_id] || []).push(Number(r.valor));
          const b = bMap[r.pregunta_id]; if (b) (aggB[b] = aggB[b] || []).push(Number(r.valor));
          sT += Number(r.valor); nT += 1;
        }
        items = (preguntas || []).filter(p => vivas.has(p.id)).map(p => {
          const a = agg[p.id];
          return { pregunta_id: p.id, orden: p.orden, bloque: p.bloque, pregunta: p.pregunta,
            promedio: a ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : null, n: a ? a.length : 0 };
        });
        bloques = Object.keys(aggB).map(b => ({ bloque: b, promedio: Math.round((aggB[b].reduce((x, y) => x + y, 0) / aggB[b].length) * 100) / 100, n: aggB[b].length }));
        general = nT ? Math.round((sT / nT) * 100) / 100 : null;
      }
    }
    let te20 = null;
    try { const { data: pila } = await admin.from('eval_pila').select('criterios').eq('id', me.id).eq('periodo', 'hist').maybeSingle(); if (pila && pila.criterios && pila.criterios.actitud) te20 = pila.criterios.actitud.valor_20; } catch (_) {}

    return json({ ok: true, cuatri: cuLabel, restante, tope: TOPE, min: MIN, usados: targetsCuatri.size,
      preguntas: preguntas || [], sugeridos, candidatos,
      mi_sede: me.sede || null, ubicaciones: [...permitidas],
      jefe_pendientes, soyJefe: jefe_pendientes.length > 0,
      contestadas,
      misvaloraciones: {
        n: nPeers >= MIN_CUENTA ? nPeers : null,   // menos de cinco no se cuentan: senalarian a quien opino
        suficientes: nPeers >= MIN_VER, min_ver: MIN_VER, min_cuenta: MIN_CUENTA,
        desde: desdeSemana.slice(0, 10), general, items, bloques, te_20: te20 } });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
});
