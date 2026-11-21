import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const TOPE = 7; // maximo por cuatrimestre

/* LA UBICACION MANDA. Javi, 21-nov-2026: «que solo puedan valorar a
   compañeros de su ubicacion Virreyes / CDMX / Puebla».
   Una valoracion entre pares dice como es trabajar contigo, y eso solo lo
   sabe quien te ve trabajar. Valorar a alguien de otra sede era opinar de
   oidas.
   Y va AQUI, no solo en la pantalla: la pantalla deja de ofrecerlo, pero la
   regla que cuenta es la que impide guardarlo. */
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
    const { data: me } = await admin.from('employees').select('id, sede').eq('user_id', u.user.id).maybeSingle();
    if (!me) return json({ ok: false, error: 'No se encontró tu ficha' }, 404);

    const body = await req.json().catch(() => ({}));
    const target = body.target;
    const respuestas = Array.isArray(body.respuestas) ? body.respuestas : [];
    if (!target) return json({ ok: false, error: 'Falta a quién valorar' }, 400);
    if (target === me.id) return json({ ok: false, error: 'No puedes valorarte a ti mismo' }, 400);
    const { data: tgt } = await admin.from('employees').select('id, estatus, sede').eq('id', target).maybeSingle();
    if (!tgt || (tgt.estatus || '') !== 'activo') return json({ ok: false, error: 'Esa persona no está activa' }, 400);

    /* ---- La ubicación ----
       Lo permitido son las ubicaciones de quien valora, mas la suya propia:
       mis_ubicaciones es la cascada de acceso a datos y alguna ficha la tiene
       distinta de su sede, asi que la sede propia siempre cuenta. Si la
       cascada no contesta, se cae a la regla sola -tu sede- y no a dejar pasar
       todo: aqui fallar abierto seria no tener regla. */
    let permitidas = new Set();
    try {
      const { data: ub } = await admin.rpc('mis_ubicaciones', { p_email: String(u.user.email || '').toLowerCase() });
      (ub || []).forEach((x) => permitidas.add(proy(x)));
    } catch (_) { /* la sede propia basta */ }
    if (proy(me.sede)) permitidas.add(proy(me.sede));

    /* La jerarquia no se corta por la sede. Un jefe regional evalua a su gente
       donde este, y esa valoracion es obligatoria; lo mismo al reves. */
    let jerarquia = false;
    try {
      const { data: a } = await admin.from('eval_ciclos').select('id')
        .eq('jefe_id', me.id).eq('employee_id', target).limit(1);
      const { data: b } = await admin.from('eval_ciclos').select('id')
        .eq('jefe_id', target).eq('employee_id', me.id).limit(1);
      jerarquia = !!((a && a.length) || (b && b.length));
    } catch (_) {}

    if (!jerarquia && permitidas.size && !permitidas.has(proy(tgt.sede))) {
      return json({ ok: false, error: 'Solo puedes valorar a compañeros de tu ubicación: quien te ve trabajar es quien puede opinar.' }, 403);
    }

    const now = new Date();
    const y = now.getUTCFullYear();
    const q = Math.floor(now.getUTCMonth() / 4);
    const cuIni = new Date(Date.UTC(y, q * 4, 1)).toISOString();
    const cuFin = new Date(Date.UTC(y, q * 4 + 4, 0)).toISOString().slice(0, 10);
    const dayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    // tope por cuatrimestre + no repetir target en el cuatrimestre
    const { data: inv } = await admin.from('enc_invitaciones')
      .select('ronda_id').eq('respondente_id', me.id).eq('contestada', true).gte('created_at', cuIni);
    const rondaIds = [...new Set((inv || []).map(r => r.ronda_id))];
    let rondas = [];
    if (rondaIds.length) { const { data: rr } = await admin.from('enc_rondas').select('id, employee_id, tipo').in('id', rondaIds); rondas = rr || []; }
    const rmap = Object.fromEntries(rondas.map(r => [r.id, r]));
    const targetsCuatri = new Set();
    for (const i of (inv || [])) { const r = rmap[i.ronda_id]; if (r && r.tipo === 'pares') targetsCuatri.add(r.employee_id); }
    if (targetsCuatri.has(target)) return json({ ok: false, error: 'Ya valoraste a esta persona este cuatrimestre. Podrás darle una nueva opinión el próximo.' }, 409);
    if (targetsCuatri.size >= TOPE) return json({ ok: false, error: 'Llegaste al tope de ' + TOPE + ' compañeros este cuatrimestre' }, 409);

    const { data: preg } = await admin.from('enc_preguntas').select('id').eq('activa', true).eq('tipo_encuesta', 'pares');
    const okIds = new Set((preg || []).map(p => p.id));

    let ronda = null;
    const { data: ex } = await admin.from('enc_rondas').select('id').eq('tipo', 'pares').eq('employee_id', target).eq('estado', 'abierta').gte('lanzada_at', cuIni).limit(1);
    if (ex && ex[0]) ronda = ex[0].id;
    if (!ronda) {
      const { data: nr, error: er } = await admin.from('enc_rondas').insert({ employee_id: target, tipo: 'pares', estado: 'abierta', lanzada_at: now.toISOString(), cierra_at: cuFin, min_respuestas: 3, creado_por: 'pares-enviar' }).select('id').single();
      if (er) return json({ ok: false, error: 'No se pudo abrir la ronda: ' + er.message }, 500);
      ronda = nr.id;
    }

    const rows = []; const vals = []; const full = [];
    for (const x of respuestas) {
      const pid = Number(x.p); if (!okIds.has(pid)) continue;
      const v = (x.v !== undefined && x.v !== null && x.v !== '') ? Number(x.v) : null;
      const t = (x.t !== undefined && x.t !== null) ? String(x.t).trim() : '';
      if (v === null && !t) continue;
      rows.push({ ronda_id: ronda, pregunta_id: pid, valor: v, texto: t || null, created_at: dayIso });
      full.push({ p: pid, v: v, t: t || null });
      if (v !== null) vals.push(v);
    }
    if (!rows.length) return json({ ok: false, error: 'No mandaste respuestas' }, 400);
    const media = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;

    // invitacion: guarda remitente (oculto), la respuesta completa (para que la revise) y la media
    const { error: ei } = await admin.from('enc_invitaciones').insert({ ronda_id: ronda, respondente_id: me.id, contestada: true, cancelada: false, token: crypto.randomUUID(), textos: { respuestas: full, target: target }, media, created_at: now.toISOString() });
    if (ei) return json({ ok: false, error: 'No se pudo registrar: ' + ei.message }, 500);
    const { error: er2 } = await admin.from('enc_respuestas').insert(rows);
    if (er2) return json({ ok: false, error: 'No se pudieron guardar las respuestas: ' + er2.message }, 500);

    const { count } = await admin.from('enc_invitaciones').select('id', { count: 'exact', head: true }).eq('ronda_id', ronda).eq('contestada', true);
    await admin.from('enc_rondas').update({ invitados: count || 0 }).eq('id', ronda);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
});
