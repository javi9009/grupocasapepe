/* embed-child.js — Grupo Casa Pepe
 * Se carga en las páginas que pueden abrirse DENTRO del shell de SoyPepe
 * (iframe de la vista #v-embed). Cuando la URL trae ?embed=1:
 *   - marca <html class="is-embed">
 *   - oculta el botón de volver propio de la página
 *   - neutraliza cualquier enlace que apunte de vuelta al shell
 *   - oculta cualquier barra de navegación inferior propia
 *
 * POR QUÉ LO DE NEUTRALIZAR
 * Varias páginas (eloy, lecturas, limpieza, room-audit, nómina) tienen un
 * "regresar" que hace href="/soypepe/" o location.href='/soypepe/'. Dentro
 * del iframe eso cargaba la app entera anidada: dos headers y dos barras
 * apiladas. Ahora esos enlaces cierran el embed avisando al shell.
 *
 * NO se oculta el header de la página hija: ahí viven botones necesarios
 * (en el chat, Nuevo grupo y Colaboradores). El shell no dibuja título
 * propio, así que cada página muestra el suyo.
 */
(function () {
  'use strict';
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('embed') !== '1') return;

    document.documentElement.classList.add('is-embed');

    var css = document.createElement('style');
    css.textContent =
      'html.is-embed .back-btn,' +
      'html.is-embed header .back,' +
      'html.is-embed .topbar .back,' +
      'html.is-embed [data-embed-hide]{display:none !important}' +
      'html.is-embed body > nav.nav,' +
      'html.is-embed .tabbar{display:none !important}' +
      'html.is-embed body{padding-top:0 !important}';
    document.head.appendChild(css);

    /* Esta URL lleva de vuelta al shell? */
    function esVolverAlShell(href) {
      if (!href) return false;
      try {
        var u = new URL(href, location.href);
        if (u.origin !== location.origin) return false;
        var ruta = u.pathname.replace(/index\.html$/, '');
        return ruta === '/soypepe/' || ruta === '/sp/' || ruta === '/';
      } catch (e) { return false; }
    }

    function volverAInicio() {
      try { window.parent.postMessage({ type: 'cp-embed-home' }, location.origin); }
      catch (e) { }
    }

    /* Fase de captura: nos adelantamos a los handlers de la página y
       cubrimos enlaces creados despues de cargar. */
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      if (!esVolverAlShell(a.getAttribute('href'))) return;
      ev.preventDefault();
      ev.stopPropagation();
      volverAInicio();
    }, true);

    /* Ademas los ocultamos para que ni se vean. Si algo navega por JS con
       location.href, el guard del propio shell detecta el anidado y avisa. */
    function ocultarEnlaces() {
      var as = document.querySelectorAll('a[href]');
      for (var i = 0; i < as.length; i++) {
        if (esVolverAlShell(as[i].getAttribute('href'))) as[i].style.display = 'none';
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ocultarEnlaces);
    } else { ocultarEnlaces(); }

  } catch (e) { /* si algo falla, la pagina se ve completa: no rompe nada */ }
})();
