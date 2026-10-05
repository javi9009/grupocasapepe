/* cp-marco.js — que ninguna pantalla se quede huérfana.
 *
 * Las pantallas de /m/ viven DENTRO del panel (index.html las carga en un
 * iframe), así que van desnudas: sin barra lateral y sin botón de volver, que
 * el panel ya los pone. El problema aparece cuando una de estas ligas se abre
 * suelta en una pestaña -copiando la URL, saliendo de un correo, pinchando un
 * enlace que dimos a mano-: entonces no hay panel, no hay menú y no hay manera
 * de regresar al centro de mando. Javi, 30-sep: "cuando entro a la página de
 * productoras desaparece el menú lateral".
 *
 * Esto lo arregla en un sitio: si la pantalla se ve a sí misma en lo más alto
 * de la ventana, se mete sola dentro del panel pidiendo su propia ruta
 * (index.html?abre=<ruta>), y el huésped del panel recupera su barra.
 *
 * Se carga en el <head> de cada /m/*.html, lo antes posible:
 *     <script src="/m/cp-marco.js"></script>
 *
 * Escapes:
 *   ?suelta=1   la pantalla se queda como está (para imprimir, o para una
 *               pantalla de recepción que vive a pantalla completa)
 *   window.CP_SUELTA = true   lo mismo, desde la propia pantalla, antes de este
 *               script: los portales públicos (operador, productora, concierge)
 *               no son del panel y no deben entrar en él.
 */
(function () {
  'use strict';
  try {
    if (window.top !== window.self) return;          // ya está dentro del panel
    if (window.CP_SUELTA === true) return;
    var q = new URLSearchParams(location.search);
    if (q.get('suelta') === '1' || q.has('t') || q.has('token')) return;
    /* Instalada como app propia (Pepe Atender): el sistema la abre a pantalla
       completa y meterla en el panel le quitaría justo lo que la hace app. */
    try {
      if ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator.standalone === true) return;
    } catch (_) {}
    /* ?t= / ?token= son las ligas personales de fuera (la de la productora, la
       del operador): quien llega con una de ésas no tiene panel al que entrar. */
    var yo = location.pathname + location.search + location.hash;
    location.replace('/index.html?abre=' + encodeURIComponent(yo));
  } catch (_) { /* nunca romper la pantalla por el marco */ }
})();
