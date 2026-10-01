/* LA MARCA DE LA APP.
   Un hotel de marca blanca no quiere la app de Casa Pepe con su logo encima:
   quiere SU app. Y los nombres están horneados a mano en doscientos y pico
   sitios de `apepe/` y `sinc/` — cambiarlos uno por uno era una semana de
   buscar y reemplazar con el riesgo de romper copy en cada pantalla.

   Así que no se cambian: se traducen al vuelo. Esto resuelve de qué hotel es la
   app, se trae su marca y sustituye las cinco piezas en el texto ya pintado.
   Una pantalla nueva no tiene que saber que esto existe.

   Las cinco piezas, y sólo esas cinco:
     Casa Pepe → el nombre del hotel      APePe    → App Barrio
     SoyPepe   → Soy Barrio               PepeQuiz → Quiz Barrio
     Pepe GO!  → Barrio GO!

   Lo que NO se toca, a propósito (ver el doc 72): «El Pepe» es José
   Vasconcelos — el saco de galaxias es La raza cósmica — y «Don José» es quien
   atiende en el chat. Son personas, no palabras: no se renombran con una
   expresión regular. Y las rutas en minúsculas (/apepe/yo.html) tampoco, que
   son archivos y no marca.

   Sin hotel que resolver no sustituye nada y la app se queda como está. Ésa es
   la garantía de que esto no puede romper la app de Casa Pepe.

   Se carga en el <head>, justo después de resv.js: necesita el token de la
   reserva, y tiene que estar listo antes de que la pantalla acabe de pintar.
   Javi, 30-sep. */
(function () {
  'use strict';
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var CLAVE_M = 'apepe_marca';      /* la marca resuelta, por sesión */
  var CLAVE_H = 'apepe_hotel';      /* el slug, que sí sobrevive al cierre */

  var M = null, aplicada = false, obs = null;
  try { M = JSON.parse(sessionStorage.getItem(CLAVE_M) || 'null'); } catch (_) {}

  /* ---------- de qué hotel es esta app ---------- */
  /* VOLVER A CASA.
     El hotel se guarda en el aparato, igual que la reserva, para que el huésped
     pueda navegar sin arrastrar el parámetro. El precio es el mismo que apunta
     resv.js: en un teléfono que entró una vez por el QR de un hotel, la app se
     queda de ese hotel para siempre. Hacía falta la puerta de salida.
       ?h=no  ?h=0  ?h=casapepe  ?h=   →  se olvida y vuelve a ser Casa Pepe.
     Y hay que recargar: la sustitución es destructiva — las cadenas originales
     ya no están en el DOM, no se pueden deshacer sin volver a pintar. */
  var VUELVE = { 'no': 1, '0': 1, 'casapepe': 1, 'casa-pepe': 1, 'ninguno': 1 };
  function olvidaHotel() {
    M = null;
    try { sessionStorage.removeItem(CLAVE_M); } catch (_) {}
    try { localStorage.removeItem(CLAVE_H); } catch (_) {}
  }

  var slug = '', resv = '';
  try {
    var p = new URLSearchParams(location.search);
    var cru = p.get('h');
    if (cru !== null) {
      slug = String(cru).trim().toLowerCase();
      if (!slug || VUELVE[slug]) {
        var habia = !!(M && M.hotel_id);
        olvidaHotel(); slug = '';
        /* Se quita el parámetro antes de recargar, o la recarga volvería a
           entrar aquí y no acabaría nunca. */
        try {
          p.delete('h');
          var q = p.toString();
          history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
        } catch (_) {}
        if (habia) { try { location.reload(); } catch (_) {} }
      } else {
        try { localStorage.setItem(CLAVE_H, slug); } catch (_) {}
      }
    } else {
      try { slug = localStorage.getItem(CLAVE_H) || ''; } catch (_) {}
    }
  } catch (_) {}
  try { resv = (window.apepeResv && window.apepeResv.token()) || ''; } catch (_) {}

  /* ---------- las piezas ---------- */
  /* De la más larga a la más corta: «Pepe GO!» antes que nada que contenga
     «Pepe», o se quedaría a medias. */
  function piezas(m) {
    if (!m || !m.hotel_id) return [];
    var l = [];
    if (m.go)    l.push([/Pepe\s?GO!?/g,  m.go]);
    if (m.quiz)  l.push([/PepeQuiz/g,     m.quiz]);
    if (m.soy)   l.push([/SoyPepe/g,      m.soy]);
    if (m.app)   l.push([/APePe/g,        m.app]);
    if (m.hotel) l.push([/Casa\s?Pepe/g,  m.hotel]);
    return l;
  }
  /* «Grupo Casa Pepe» es la sociedad, no la marca de la app: un hotel ajeno
     no es una empresa del Grupo, así que esa frase se queda como está. Se
     aparta antes de sustituir y se devuelve después — más barato y más
     compatible que un lookbehind, que en iPhones viejos no existe. */
  var GRUPO = '\u0000G\u0000';
  /* Ojo con el atajo: «APePe» se escribe A-P-e-P-e y NO contiene la cadena
     «Pepe». Buscarla con mayúscula dejaba fuera las 47 apariciones de APePe.
     Por eso la criba va sin distinguir mayúsculas. */
  function tiene(s) { return s != null && /pepe/i.test(s); }
  function texto(s) {
    if (!M || s == null) return s;
    s = String(s);
    if (!tiene(s)) return s;                  /* lo normal: salir en seguida */
    s = s.replace(/Grupo\s?Casa\s?Pepe/g, GRUPO);
    piezas(M).forEach(function (par) { s = s.replace(par[0], par[1]); });
    return s.split(GRUPO).join('Grupo Casa Pepe');
  }

  /* ---------- sustituir en lo ya pintado ---------- */
  var SALTA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var ATRIBS = ['title', 'placeholder', 'alt', 'aria-label', 'data-pepe'];

  function fijo(n) {
    /* data-marca="fija" protege un trozo entero: ahí dentro Pepe es Pepe.
       Es la puerta de salida para El Pepe y para Don José. */
    while (n && n !== document.body) {
      if (n.nodeType === 1 && n.getAttribute('data-marca') === 'fija') return true;
      n = n.parentNode;
    }
    return false;
  }

  function barre(raiz) {
    if (!M || !raiz) return;
    var it = document.createNodeIterator(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!tiene(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (n.parentNode && SALTA[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        if (fijo(n.parentNode)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, cambios = [];
    while ((n = it.nextNode())) cambios.push(n);
    cambios.forEach(function (x) { x.nodeValue = texto(x.nodeValue); });

    if (raiz.nodeType === 1 || raiz === document) {
      var base = raiz.nodeType === 1 ? raiz : document.body;
      if (!base) return;
      ATRIBS.forEach(function (a) {
        var sel = '[' + a + ']', l = [];
        try { l = Array.prototype.slice.call(base.querySelectorAll(sel)); } catch (_) {}
        if (base.nodeType === 1 && base.matches && base.matches(sel)) l.push(base);
        l.forEach(function (e) {
          var v = e.getAttribute(a);
          if (tiene(v) && !fijo(e)) e.setAttribute(a, texto(v));
        });
      });
    }
  }

  /* El logo y los colores: cualquier <img data-marca-logo> se cambia por el del
     hotel, en negro o en blanco según lo que pida su paleta. */
  function pinta() {
    if (!M || !M.hotel_id) return;
    try { document.title = texto(document.title); } catch (_) {}
    var pal = M.paleta || null;
    if (pal) {
      var r = document.documentElement.style;
      if (pal.fuerte) { r.setProperty('--naranja', pal.fuerte); r.setProperty('--marca', pal.fuerte); }
      if (pal.oscuro) r.setProperty('--naranja-oscuro', pal.oscuro);
      if (pal.suave)  r.setProperty('--naranja-suave', pal.suave);
      if (pal.fondo)  r.setProperty('--papel', pal.fondo);
      if (pal.tinta)  r.setProperty('--tinta', pal.tinta);
    }
    var cual = (pal && pal.logo === 'blanco' && M.logo_blanco) ? M.logo_blanco : (M.logo || M.logo_blanco);
    if (cual) {
      try {
        Array.prototype.forEach.call(document.querySelectorAll('[data-marca-logo]'), function (e) {
          var q = e.getAttribute('data-marca-logo');
          e.src = (q === 'blanco' && M.logo_blanco) ? M.logo_blanco : cual;
        });
      } catch (_) {}
    }
  }

  function aplica() {
    if (!M || !M.hotel_id) return;
    try { barre(document.body || document); pinta(); } catch (_) {}
    aplicada = true;
    /* Casi todo en esta app se pinta con innerHTML después de cargar. Sin esto,
       la sustitución sólo alcanzaría al cascarón. */
    if (!obs && window.MutationObserver && document.body) {
      obs = new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes || [], function (n) {
            if (n.nodeType === 3) { if (tiene(n.nodeValue) && !fijo(n.parentNode)) n.nodeValue = texto(n.nodeValue); }
            else if (n.nodeType === 1) barre(n);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
    /* El <title> vive en el <head>, fuera del alcance del observador de arriba,
       y media pantalla se lo reescribe a sí misma después de cargar
       («Lo tuyo · APePe»). Se vigila aparte. */
    var tt = document.querySelector('title');
    if (tt && !tt.__marca && window.MutationObserver) {
      tt.__marca = true;
      new MutationObserver(function () {
        var n = texto(document.title);
        if (n !== document.title) document.title = n;
      }).observe(tt, { childList: true, characterData: true, subtree: true });
    }
  }

  function arranca() {
    if (document.body) aplica();
    else document.addEventListener('DOMContentLoaded', aplica, { once: true });
  }
  if (M && M.hotel_id) arranca();

  /* ---------- traerla ---------- */
  /* Sólo se pregunta si hay algo que preguntar, y una vez por sesión. */
  if ((slug || resv) && !(M && M.hotel_id && (M.slug === slug || !slug))) {
    fetch(SB + '/rest/v1/rpc/apepe_marca', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug || null, p_resv: resv || null })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.hotel_id) return;
        M = j;
        try { sessionStorage.setItem(CLAVE_M, JSON.stringify(j)); } catch (_) {}
        try { localStorage.setItem(CLAVE_H, j.slug || ''); } catch (_) {}
        arranca();
      })
      .catch(function () {});
  }

  window.apepeMarca = {
    /* La marca cruda, o null si esto es Casa Pepe. */
    marca: function () { return M && M.hotel_id ? M : null; },
    hotel: function () { return (M && M.hotel) || 'Casa Pepe'; },
    app:   function () { return (M && M.app)   || 'APePe'; },
    soy:   function () { return (M && M.soy)   || 'SoyPepe'; },
    go:    function () { return (M && M.go)    || 'Pepe GO!'; },
    quiz:  function () { return (M && M.quiz)  || 'PepeQuiz'; },
    /* Para traducir una cadena a mano antes de meterla en el DOM. */
    texto: texto,
    /* Lo que hay que pegarle a una liga para no perder el hotel. */
    qs: function () { return (M && M.slug) ? 'h=' + encodeURIComponent(M.slug) : ''; },
    aplica: aplica,
    /* Para el teléfono compartido —recepción, la sala— y para salir de un
       hotel sin pelearse con el localStorage a mano. */
    vuelveACasa: function () { olvidaHotel(); try { location.reload(); } catch (_) {} }
  };
})();
