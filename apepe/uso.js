/* uso.js — saber si la App Huésped se usa, y para qué.
 *
 * Javi, 13-nov-2026, pidiendo el analytics de los últimos 15 días. No se
 * podía: la app no medía nada. Sus llamadas a la base eran todas funcionales
 * -guardar el check-in, pedir el quiz- y ninguna dejaba constancia de que
 * alguien la hubiera abierto. Esto es lo que faltaba.
 *
 * TRES REGLAS, y son las que hacen que esto se pueda dejar puesto:
 *
 * 1. Que no se note. Si el ping falla, falla en silencio y el huésped no se
 *    entera: está comprando un tour, no ayudándonos a medir. Es el único
 *    sitio de la casa donde un catch vacío es lo correcto, y por eso está
 *    dicho aquí en vez de que parezca un descuido.
 *
 * 2. Que no estorbe. El primer ping espera a que la página esté pintada, y el
 *    de salida va por sendBeacon, que el navegador manda cuando le viene bien
 *    sin retener el cierre de la pestaña.
 *
 * 3. Que no guarde de más. La reserva, la sede, la pantalla y la hora. Ni
 *    nombre, ni correo, ni user-agent: para saber si la app se usa no hace
 *    falta saber con qué teléfono, y lo que no se guarda no se filtra.
 *
 * La pantalla se saca del nombre del archivo, así que una página nueva se
 * mide sola sin que nadie tenga que acordarse de añadirla a una lista -que es
 * como las listas se quedan viejas-.
 */
(function () {
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  /* La sesión es la visita: lo que hace alguien hasta que cierra la pestaña.
     En sessionStorage y no en localStorage justo por eso. Si el navegador no
     deja guardar -modo privado, almacenamiento bloqueado-, se usa una en
     memoria: se pierde al cambiar de página, pero sigue contando la visita. */
  var sesion = (function () {
    var u;
    try {
      u = sessionStorage.getItem('apepe_sesion');
      if (!u) {
        u = (crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
              var r = Math.random() * 16 | 0;
              return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        sessionStorage.setItem('apepe_sesion', u);
      }
    } catch (_) {
      u = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    }
    return u;
  })();

  function pantalla() {
    var p = String(location.pathname || '').replace(/\/+$/, '');
    var f = p.split('/').pop() || 'inicio';
    return f.replace(/\.html$/, '') || 'inicio';
  }

  /* Quién. Sale de donde ya vive la reserva: la liga que abrió el huésped o
     lo que resv.js le guardó en el teléfono. Si no hay, el ping va sin ella y
     cuenta como visita anónima, que también es un dato: alguien llegó a la
     app sin reserva. */
  function reserva() {
    try {
      var q = new URLSearchParams(location.search);
      var r = q.get('resv') || q.get('reserva') || '';
      if (r) return r;
      return localStorage.getItem('apepe_reserva_token') ||
             localStorage.getItem('apepe_reserva') || '';
    } catch (_) { return ''; }
  }

  function sede() {
    try { return localStorage.getItem('apepe_sede') || ''; } catch (_) { return ''; }
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

  /* `ref` es lo que estaba mirando dentro de la pantalla: el tour, el premio.
     Sin esto, «reservas» es un número suelto y no se puede saber si entran
     pocas porque nadie mira o porque muchos miran y no compran, que son dos
     problemas opuestos y se arreglan al revés. */
  function ref() {
    try {
      var q = new URLSearchParams(location.search);
      return q.get('tour') || q.get('exp') || q.get('id') || q.get('e') || '';
    } catch (_) { return ''; }
  }

  function cuerpo() {
    return JSON.stringify({
      p_sesion: sesion, p_pantalla: pantalla(), p_reserva: reserva() || null,
      p_sede: sede() || null, p_ref: ref() || null,
      p_idioma: idioma() || null, p_disp: dispositivo()
    });
  }
  var URL_PING = SB + '/rest/v1/rpc/apepe_ping';

  function ping() {
    try {
      fetch(URL_PING, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: cuerpo()
      }).catch(function () { /* medir nunca molesta al huésped */ });
    } catch (_) { /* igual */ }
  }

  /* El de salida es el que da la duración: sin un último ping, toda visita
     duraría cero. Va por sendBeacon porque el navegador lo manda aunque la
     pestaña ya se esté cerrando; fetch ahí se pierde la mitad de las veces. */
  var despedido = false;
  function despide() {
    if (despedido) return;
    despedido = true;
    try {
      var b = new Blob([cuerpo()], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon(URL_PING + '?apikey=' + KEY, b))) ping();
    } catch (_) { ping(); }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(ping, 400);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(ping, 400); });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') despide();
    else despedido = false;
  });
  window.addEventListener('pagehide', despide);

  /* Por si una pantalla quiere marcar algo que no es un cambio de página:
     abrir la ficha de un tour dentro de la misma vista, por ejemplo. */
  window.apepeUso = function (pant, r) {
    try {
      fetch(URL_PING, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_sesion: sesion, p_pantalla: String(pant || pantalla()),
          p_reserva: reserva() || null, p_sede: sede() || null,
          p_ref: r ? String(r) : null, p_idioma: idioma() || null, p_disp: dispositivo()
        })
      }).catch(function () {});
    } catch (_) {}
  };
})();
