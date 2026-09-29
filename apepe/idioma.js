/* El conmutador ES/EN de APePe: se cuelga junto a la campanita.
 *
 * Vive en un archivo aparte por lo mismo que notis.js: el botón tiene que salir
 * igual en todas las pantallas del huésped y no queremos copiarlo seis veces.
 *
 * La llave es `apepe_lang`, que es la que ya leía notis.js. De paso se escribe
 * `apepe_ckin_lang`, que es la que mira el check-in, para que no queden dos
 * idiomas distintos en la misma sesión. Y se recarga con `?lang=` en la liga
 * porque así es como sinc-i18n.js resuelve el idioma del contenido traducido.
 */
(function () {
  'use strict';
  if (window.__apepeIdioma) return;
  window.__apepeIdioma = true;

  function lee() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'es') return q;
      var g = localStorage.getItem('apepe_lang');
      if (g === 'en' || g === 'es') return g;
    } catch (_) {}
    // Sin preferencia guardada: lo que traiga el navegador, y por omisión español.
    try { return (navigator.language || '').slice(0, 2) === 'en' ? 'en' : 'es'; } catch (_) {}
    return 'es';
  }

  function pon(l) {
    try {
      localStorage.setItem('apepe_lang', l);
      localStorage.setItem('apepe_ckin_lang', l);
    } catch (_) {}
    try { document.documentElement.lang = l; } catch (_) {}
    var u = new URL(location.href);
    u.searchParams.set('lang', l);
    location.replace(u.toString());
  }

  function estilo() {
    if (document.getElementById('apLangCss')) return;
    var c = document.createElement('style');
    c.id = 'apLangCss';
    c.textContent = [
      '.apLang{display:inline-flex;align-items:center;border:0;padding:0;overflow:hidden;',
      '  border-radius:999px;background:rgba(255,255,255,.18);height:38px;font-family:inherit;cursor:pointer}',
      '.apLang b{display:block;padding:0 10px;line-height:38px;font-size:12px;font-weight:700;',
      '  letter-spacing:.04em;color:rgba(255,255,255,.72)}',
      '.apLang b.on{background:#fff;color:#1E1A16}',
      '@media(prefers-reduced-motion:no-preference){.apLang b{transition:background .15s}}'
    ].join('');
    document.head.appendChild(c);
  }

  function monta() {
    var top = document.querySelector('header.top .in .dcha') ||
              document.querySelector('header.top .in') ||
              document.querySelector('header.top');
    if (!top || document.querySelector('.apLang')) return !!top;
    estilo();
    var l = lee();
    try { document.documentElement.lang = l; } catch (_) {}
    var b = document.createElement('button');
    b.className = 'apLang';
    b.type = 'button';
    b.setAttribute('aria-label', l === 'en' ? 'Change language' : 'Cambiar idioma');
    b.innerHTML = '<b class="' + (l === 'es' ? 'on' : '') + '">ES</b>' +
                  '<b class="' + (l === 'en' ? 'on' : '') + '">EN</b>';
    /* La campanita se mete como primer hijo, así que el idioma queda a su
       derecha sin que importe cuál de los dos scripts cargue antes. */
    b.onclick = function () { pon(l === 'es' ? 'en' : 'es'); };
    top.appendChild(b);
    return true;
  }

  if (!monta()) {
    var n = 0;
    var t = setInterval(function () { if (monta() || ++n > 40) clearInterval(t); }, 120);
  }
})();
