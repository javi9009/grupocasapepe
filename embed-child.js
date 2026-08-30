/* embed-child.js — Grupo Casa Pepe
 * Se carga en las páginas que pueden abrirse DENTRO del shell de SoyPepe
 * (iframe de la vista #v-embed). Cuando la URL trae ?embed=1:
 *   - marca <html class="is-embed">
 *   - oculta el header propio de la página (el shell ya muestra header + back)
 *   - oculta cualquier barra de navegación inferior propia
 * Los elementos siguen en el DOM (display:none), así que el JS de la página
 * que lea el selector de sede u otros controles sigue funcionando igual.
 */
(function () {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('embed') !== '1') return;

    document.documentElement.classList.add('is-embed');

    var css = document.createElement('style');
    css.textContent =
      'html.is-embed body > header,' +
      'html.is-embed .topbar,' +
      'html.is-embed .appbar,' +
      'html.is-embed body > nav.nav,' +
      'html.is-embed .tabbar{display:none !important}' +
      'html.is-embed body{padding-top:0 !important;padding-bottom:12px !important}';
    document.head.appendChild(css);
  } catch (e) { /* si algo falla, la página se ve completa: no rompe nada */ }
})();
