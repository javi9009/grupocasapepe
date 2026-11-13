/* uso.js — saber si las apps se usan, y para qué.
 *
 * Javi, 13-nov-2026: pidio el analytics de la App Huesped y, al montarlo,
 * «pon tambien un analitycs de dashboard y otro de soypepe».
 *
 * No se podia: ninguna de las tres medía nada. Sus llamadas a la base eran
 * todas funcionales -guardar el check-in, pedir el quiz, fichar la entrada- y
 * ninguna dejaba constancia de que alguien hubiera abierto la app.
 *
 * UN SOLO ARCHIVO PARA LAS TRES. La app se deduce de la ruta y la pantalla
 * del nombre del archivo, asi que una pagina nueva se mide sola. Una lista
 * que hay que mantener a mano es una lista que se queda vieja.
 *
 * TRES REGLAS, y son las que permiten dejarlo puesto en todas partes:
 *
 * 1. Que no se note. Si el ping falla, falla en silencio: quien esta delante
 *    esta comprando un tour o fichando su entrada, no ayudandonos a medir. Es
 *    el unico sitio de la casa donde un catch vacio es lo correcto, y por eso
 *    esta dicho aqui en vez de que parezca un descuido.
 *
 * 2. Que no estorbe. El primer ping espera a que la pagina este pintada, y el
 *    de salida va por sendBeacon, que el navegador manda cuando le viene bien
 *    sin retener el cierre de la pestana.
 *
 * 3. Que no guarde de mas. Quien, la sede, la pantalla y la hora. Ni el
 *    user-agent: para saber si una app se usa no hace falta saber con que
 *    telefono, y lo que no se guarda no se filtra.
 */
(function () {
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var URL_PING = SB + '/rest/v1/rpc/uso_ping';

  var ruta = String(location.pathname || '');
  var app  = /^\/apepe\//.test(ruta)   ? 'huesped'
           : /^\/soypepe\//.test(ruta) ? 'soypepe'
           : 'dashboard';

  var sesion = (function () {
    var u;
    try {
      u = sessionStorage.getItem('cp_uso_sesion');
      if (!u) { u = uuid(); sessionStorage.setItem('cp_uso_sesion', u); }
    } catch (_) { u = uuid(); }
    return u;
    function uuid() {
      try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  })();

  function pantalla() {
    var f = ruta.replace(/\/+$/, '').split('/').pop() || 'inicio';
    return f.replace(/\.html$/, '') || 'inicio';
  }

  /* QUIEN. En la app del huesped es su reserva; en las de equipo, el correo de
     la sesion, que es lo unico que identifica sin pedir nada. */
  function quien() {
    try {
      if (app === 'huesped') {
        var q = new URLSearchParams(location.search);
        return q.get('resv') || q.get('reserva') ||
               localStorage.getItem('apepe_reserva_token') ||
               localStorage.getItem('apepe_reserva') || '';
      }
      if (window.cpAcceso && cpAcceso.tokEmail) return cpAcceso.tokEmail() || '';
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /sb-.*-auth-token/.test(k)) {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          var ss = v && (v.currentSession || v);
          if (ss && ss.user && ss.user.email) return ss.user.email;
        }
      }
    } catch (_) {}
    return '';
  }

  function sede() {
    try { return localStorage.getItem('apepe_sede') || localStorage.getItem('cp_propiedad') || ''; }
    catch (_) { return ''; }
  }
  function idioma() {
    try {
      if (window.apepeLang) return String(window.apepeLang()).slice(0, 5);
      return String(navigator.language || '').slice(0, 5);
    } catch (_) { return ''; }
  }
  function dispositivo() {
    try { return matchMedia('(max-width: 820px)').matches ? 'movil' : 'escritorio'; }
    catch (_) { return 'escritorio'; }
  }
  /* `ref` es lo que miraba dentro de la pantalla: el tour, el modulo. Sin
     esto, «reservas» es un numero suelto y no se puede saber si entran pocas
     porque nadie mira o porque muchos miran y no compran, que son dos
     problemas opuestos y se arreglan al reves. */
  function ref() {
    try {
      var q = new URLSearchParams(location.search);
      return q.get('tour') || q.get('exp') || q.get('id') || q.get('e') || q.get('op') || '';
    } catch (_) { return ''; }
  }

  function cuerpo(pant, r) {
    return JSON.stringify({
      p_app: app, p_sesion: sesion, p_pantalla: String(pant || pantalla()),
      p_quien: quien() || null, p_sede: sede() || null,
      p_ref: (r !== undefined ? r : ref()) || null,
      p_idioma: idioma() || null, p_disp: dispositivo()
    });
  }

  function ping(pant, r) {
    try {
      fetch(URL_PING, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: cuerpo(pant, r)
      }).catch(function () { /* medir nunca molesta a quien esta delante */ });
    } catch (_) {}
  }

  /* El de salida da la duracion: sin un ultimo ping, toda visita duraria
     cero. sendBeacon porque el navegador lo manda aunque la pestana se este
     cerrando; un fetch ahi se pierde la mitad de las veces. */
  var despedido = false;
  function despide() {
    if (despedido) return;
    despedido = true;
    try {
      var b = new Blob([cuerpo()], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon(URL_PING + '?apikey=' + KEY, b))) ping();
    } catch (_) { ping(); }
  }

  function arranca() { setTimeout(function () { ping(); }, 400); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') arranca();
  else document.addEventListener('DOMContentLoaded', arranca);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') despide(); else despedido = false;
  });
  window.addEventListener('pagehide', despide);

  /* Para marcar algo que no es un cambio de pagina: abrir la ficha de un tour
     dentro de la misma vista, por ejemplo. */
  window.cpUso = function (pant, r) { ping(pant, r); };
})();
