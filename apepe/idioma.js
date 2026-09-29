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


  /* EL DICCIONARIO.
     La llave es la propia frase en español, como en sinc-i18n.js. Suena raro y
     tiene dos ventajas que valen más que la elegancia: no hay que inventar
     nombres de llave (ni equivocarse al escribirlos), y a una frase sin
     traducir le sale el español, nunca un hueco. Los nombres propios —Pepe GO!,
     La Cósmica, PepeQuiz, Vnums— no se traducen a propósito. */
  var DIC = {
    'Bienvenido a Casa Pepe': 'Welcome to Casa Pepe',
    'Pepe huésped': 'Pepe guest',
    '¿Te quedas más?': 'Staying longer?',
    '¿Dónde andas?': 'Where are you?',
    '📍 Estoy aquí': '📍 I am here',
    'Centrado donde estás.': 'Centred on you.',
    'Ver el mapa completo →': 'See the whole map →',
    'Hoy y mañana': 'Today and tomorrow',
    'Ver todas →': 'See them all →',
    'Ver todo →': 'See it all →',
    'Mira el resto →': 'See the rest →',
    'Mirando qué sale…': 'Checking what is on…',
    'La tienda': 'The shop',
    'Abriendo la vitrina…': 'Opening the shop…',
    'Vitrina en preparación.': 'Shop on its way.',
    'Nada en esta colección todavía.': 'Nothing in this collection yet.',
    'No pudimos cargar las salidas.': 'We could not load today’s departures.',
    'Voluntario': 'Volunteer',
    'Guía': 'Guide',
    'Mi día / Guía': 'My day / Guide',
    'Inicio': 'Home',
    'Experiencias': 'Experiences',
    'Mapa': 'Map',
    'Yo': 'Me',
    'Hola Pepe': 'Hi Pepe',
    'Cómo llegar': 'How to get there',
    'Cerrar': 'Close',
    'Sé el primero': 'Be the first',
    'Qué tiene que ver con un viaje.': 'What this has to do with travelling.',
    'Hoy': 'Today',
    'Mañana': 'Tomorrow',
    /* Las tres tarjetas de la portada */
    '¿Listo para encontrar los secretos de esta ciudad? ¡No dejes que se te escapen!':
      'Ready to find this city’s secrets? Do not let them get away.',
    'Salir a cazarlos': 'Go hunt them',
    'Aprender tiene premio. Reta a otros viajeros y gana el premio del día. ¿Qué tan mexicano eres ya?':
      'Learning pays. Challenge other travellers and win today’s prize. How Mexican are you by now?',
    'Jugar ahora': 'Play now',
    'Promos': 'Deals',
    '¿SIM? ¿Museos? Descubre qué descuentos tiene Casa Pepe para ti. Los buenos turistas ya no pagan de más.':
      'SIM card? Museums? See what Casa Pepe has lined up for you. Good travellers stop overpaying.',
    'Ver descuentos': 'See the deals'
  };

  var LANG = lee();
  function t(f) {
    if (LANG !== 'en') return f;
    var k = String(f == null ? '' : f).trim();
    return Object.prototype.hasOwnProperty.call(DIC, k) ? DIC[k] : f;
  }
  /* Barre el HTML fijo. `data-i18n` sin valor usa el propio texto como llave,
     así no se escribe la frase dos veces. */
  function barre(raiz) {
    var r = raiz || document;
    Array.prototype.forEach.call(r.querySelectorAll('[data-i18n]'), function (e) {
      var k = e.getAttribute('data-i18n') || e.textContent;
      var v = t(k); if (v !== k || e.getAttribute('data-i18n')) e.textContent = v;
    });
    Array.prototype.forEach.call(r.querySelectorAll('[data-i18n-ph]'), function (e) {
      e.placeholder = t(e.getAttribute('data-i18n-ph') || e.placeholder);
    });
    Array.prototype.forEach.call(r.querySelectorAll('[data-i18n-aria]'), function (e) {
      e.setAttribute('aria-label', t(e.getAttribute('data-i18n-aria')));
    });
  }
  window.apepeT = t;
  window.apepeBarre = barre;
  window.apepeLang = function () { return LANG; };

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

  function arranca() {
    monta();
    try { barre(); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arranca);
  } else { arranca(); }
  /* La campanita y los carruseles llegan tarde: se vuelve a barrer un par de
     veces en vez de encadenarse a cada script. */
  var n = 0;
  var reloj = setInterval(function () {
    monta(); try { barre(); } catch (_) {}
    if (++n > 12) clearInterval(reloj);
  }, 400);
})();
