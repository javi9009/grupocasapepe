/* app-badge.js — Grupo Casa Pepe
 * Pinta en el icono de la app del celular el número de pendientes:
 * notificaciones sin leer + conversaciones con mensajes sin leer.
 *
 * ── Qué hace falta para que se vea ────────────────────────────────────
 * 1. La app tiene que estar INSTALADA en la pantalla de inicio
 *    ("Añadir a pantalla de inicio"). En una pestaña normal del navegador
 *    la Badging API no hace nada: no falla, simplemente se ignora.
 * 2. Android/Chrome la soporta. iOS la soporta desde 16.4, también sólo
 *    con la PWA instalada.
 *
 * ── Limitación importante ─────────────────────────────────────────────
 * Esto actualiza el número mientras la app está abierta o cuando el
 * usuario vuelve a ella. NO actualiza con la app cerrada: para eso hace
 * falta Web Push (el service worker recibe el aviso y pone el número aun
 * con la app cerrada). Ver PUSH-PENDIENTE.md.
 *
 * Uso: cpBadge.init(sb, emailUsuario)
 */
(function (global) {
  'use strict';

  var sb = null;
  var email = '';
  var timer = null;
  var ultimo = -1;

  var soportado = ('setAppBadge' in navigator);

  function pintar(n) {
    if (!soportado) return;
    if (n === ultimo) return;          // no repintar de más
    ultimo = n;
    try {
      if (n > 0) navigator.setAppBadge(n);
      else navigator.clearAppBadge();
    } catch (e) { /* navegador sin permiso o sin soporte: no pasa nada */ }
  }

  /* Notificaciones sin leer. RLS ya filtra por usuario, así que no hace
     falta añadir el email a la consulta. */
  async function contarNotifs() {
    try {
      var r = await sb.from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('leido', false);
      return r.count || 0;
    } catch (e) { return 0; }
  }

  /* Conversaciones con algo sin leer. Misma regla que usa la lista del
     chat: hay mensaje posterior a mi last_read_at y no lo escribí yo. */
  async function contarChats() {
    if (!email) return 0;
    try {
      var p = await sb.from('chat_participantes')
        .select('conversacion_id,last_read_at')
        .eq('email', email);
      var partes = p.data || [];
      if (!partes.length) return 0;

      var ids = partes.map(function (x) { return x.conversacion_id; });
      var leidoPor = {};
      partes.forEach(function (x) { leidoPor[x.conversacion_id] = x.last_read_at; });

      // Último mensaje de cada conversación. Traemos los recientes y nos
      // quedamos con el primero de cada conversación (vienen ordenados).
      var m = await sb.from('chat_mensajes')
        .select('conversacion_id,autor_email,created_at')
        .in('conversacion_id', ids)
        .order('created_at', { ascending: false })
        .limit(400);
      var msgs = m.data || [];

      var visto = {}, n = 0;
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        if (visto[msg.conversacion_id]) continue;   // ya vimos el último de esta
        visto[msg.conversacion_id] = 1;
        if (msg.autor_email === email) continue;    // lo escribí yo
        var leido = leidoPor[msg.conversacion_id];
        if (!leido || new Date(msg.created_at) > new Date(leido)) n++;
      }
      return n;
    } catch (e) { return 0; }
  }

  async function refrescar() {
    if (!sb) return;
    if (document.visibilityState === 'hidden') return;  // no gastar red de fondo
    try {
      var r = await Promise.all([contarNotifs(), contarChats()]);
      pintar(r[0] + r[1]);
    } catch (e) { /* silencio: el badge nunca debe romper la app */ }
  }

  function init(clienteSupabase, correo) {
    sb = clienteSupabase;
    email = (correo || '').toLowerCase();
    if (!sb) return;

    refrescar();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refrescar();
    });
    window.addEventListener('focus', refrescar);

    // Mientras la app está abierta, revisamos cada 60s.
    if (timer) clearInterval(timer);
    timer = setInterval(refrescar, 60000);
  }

  global.cpBadge = {
    init: init,
    refrescar: refrescar,
    set: pintar,
    limpiar: function () { pintar(0); },
    soportado: soportado
  };
})(window);
