/* embed-child.js — Grupo Casa Pepe
 * Se carga en las páginas que pueden abrirse DENTRO del shell de SoyPepe
 * (iframe de la vista #v-embed). Cuando la URL trae ?embed=1:
 *   - marca <html class="is-embed">
 *   - oculta SOLO el botón de volver propio de la página
 *   - oculta cualquier barra de navegación inferior propia
 *
 * IMPORTANTE: no se oculta el header de la página hija.
 * La versión anterior escondía body>header y .topbar enteros, y con eso se
 * llevaba por delante los botones que viven ahí (en el chat: 👥 Colaboradores,
 * 👥＋ Nuevo grupo, ＋ Nuevo). El shell ya no dibuja título propio, así que
 * cada página muestra el suyo. Para salir se usa Inicio en la barra inferior.
 */
(function () {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('embed') !== '1') return;

    document.documentElement.classList.add('is-embed');

    var css = document.createElement('style');
    css.textContent =
      /* botones de volver: redundantes dentro del shell */
      'html.is-embed .back-btn,' +
      'html.is-embed header .back,' +
      'html.is-embed .topbar .back,' +
      'html.is-embed [data-embed-hide]{display:none !important}' +
      /* barras de navegación inferiores propias: las duplicaría el shell */
      'html.is-embed body > nav.nav,' +
      'html.is-embed .tabbar{display:none !important}' +
      /* el shell ya da el margen superior */
      'html.is-embed body{padding-top:0 !important}';
    document.head.appendChild(css);
  } catch (e) { /* si algo falla, la página se ve completa: no rompe nada */ }
})();
