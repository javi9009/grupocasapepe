/* LA MARCA DE LA APP.
   Un hotel de marca blanca no quiere la app de Casa Pepe con su logo encima:
   quiere SU app. Y los nombres están horneados a mano en doscientos y pico
   sitios de `apepe/` y `sinc/` — cambiarlos uno por uno era una semana de
   buscar y reemplazar con el riesgo de romper copy en cada pantalla.

   Así que no se cambian: se traducen al vuelo. Esto resuelve de qué hotel es la
   app, se trae su marca y sustituye las piezas en el texto ya pintado. Una
   pantalla nueva no tiene que saber que esto existe.

   Las piezas:
     Casa Pepe    → el nombre del hotel     APePe    → App Barrio
     SoyPepe      → Soy Barrio              PepeQuiz → Quiz Barrio
     Pepe GO!     → Barrio GO!
     Hola Pepe    → Hola Barrio            Pepe huésped → Barrio huésped
     La Cósmica   → su restaurante         Don José → su conserje
     Los Pepes    → los anfitriones        SuperPepe → tu descuento

   «Hola Pepe» y «Pepe huésped» entraron el 1-oct: ahí Pepe no es nadie — es la
   marca puesta donde va el chat y donde va el nombre del huésped — y en una
   marca blanca no puede quedarse. Sale del campo `nombre_corto`: «Barrio», no
   «App Barrio».

   La Cósmica es el rooftop de Casa Pepe, no un módulo genérico. En otra casa se
   llama como se llame su restaurante (`hoteles.rest_nombre`, el que pusieron en
   su ficha de alta) y, si no lo dijeron, «Restaurante» a secas. Si su ficha dice
   que tienen restaurante, sus horas salen de la misma ficha. Y lo que es de Casa
   Pepe y de nadie más —su azotea, su power hour, su dirección— se marca con
   `data-marca-casapepe` y se va del DOM: eso no se traduce, se quita.

   Lo que NO se toca, a propósito (ver el doc 72): «El Pepe» es José
   Vasconcelos y el saco de galaxias es La raza cósmica. Ojo con esa: la regla
   del restaurante pide «Cósmica» con C mayúscula justo para no tocarla. Las
   rutas en minúsculas (/apepe/yo.html) tampoco se traducen, que son archivos y
   no marca.

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
  /* El nombre de la marca a secas. Si nadie lo cargó se deduce del GO! —
     «Barrio GO!» → «Barrio» — y en último caso se usa el nombre del hotel. */
  function corto(m) {
    if (!m) return '';
    if (m.corto) return String(m.corto).trim();
    if (m.go)    return String(m.go).replace(/\s*GO!?\s*$/, '').trim();
    return String(m.hotel || '').trim();
  }
  /* Cómo se llama su restaurante. Sin nombre cargado, «Restaurante». */
  function rest(m) {
    var r = m && m.rest ? String(m.rest).trim() : '';
    return r || 'Restaurante';
  }
  function piezas(m) {
    if (!m || !m.hotel_id || m.grupo) return [];
    var l = [], c = corto(m);
    if (m.go)    l.push([/Pepe\s?GO!?/g,  m.go]);
    if (m.quiz)  l.push([/PepeQuiz/g,     m.quiz]);
    /* «SoyPepe» y «Soy Pepe» son la misma app escrita de dos maneras; el
       título de su pantalla usa la segunda. */
    if (m.soy)   l.push([/Soy\s?Pepe\b/g, m.soy]);
    /* Antes que APePe y que Casa Pepe porque ninguna de las dos contiene
       estas cadenas; el orden solo importa entre reglas que se solapan. La
       palabra que sigue conserva su mayúscula: «Pepe Huésped» → «Barrio
       Huésped», «Pepe huésped» → «Barrio huésped». */
    if (c) {
      l.push([/Pepe(\s+)(hu[eé]sped|Hu[eé]sped|guest|Guest)/g,
              function (_, e, h) { return c + e + h; }]);
      l.push([/\b(Hola|Hi|Hello)(,?\s+)Pepe\b/g,
              function (_, h, e) { return h + e + c; }]);
    }
    /* «Los Pepes» somos nosotros: el equipo y la gente de la casa. En otra casa
       son sus anfitriones, no unos Pepes. Y cuando la frase dice «la app de los
       Pepes», lo que nombra es la marca, no a la gente. */
    if (c) {
      l.push([/\bapp de los Pepes\b/g,  'app de ' + c]);
      l.push([/\bthe Pepes app\b/g,     'the ' + c + ' app']);
    }
    l.push([/\b([Ll])os\s+Pepes\b/g, function (_, i) { return i + 'os anfitriones'; }]);
    l.push([/\bthe\s+Pepes\b/g, 'the hosts']);
    /* SuperPepe es el nombre interno del descuento por alargar la estancia.
       Fuera de Casa Pepe no quiere decir nada: se llama por lo que es. */
    l.push([/SuperPepe/g, 'tu descuento']);
    if (m.app)   l.push([/APePe/g,        m.app]);
    if (m.hotel) l.push([/Casa\s?Pepe/g,  m.hotel]);
    /* «La Cósmica», con C mayúscula siempre: «La raza cósmica» no se toca. */
    l.push([/La\s?C[óo]smica/g, rest(m)]);
    if (m.conserje) l.push([/Don\s?Jos[eé]/g, m.conserje]);
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
  function tiene(s) {
    if (s == null) return false;
    if (/pepe|c[óo]smica/i.test(s)) return true;
    return !!(M && M.conserje && /don\s?jos[eé]/i.test(s));
  }
  /* LO QUE PONE UNA REGLA NO LO VUELVE A LEER LA SIGUIENTE.
     Las reglas se aplican en fila sobre el mismo texto, así que lo que escribe
     una queda a tiro de las de después. Con «Pepe huésped» → «Casa Pepe CDMX
     huésped», la regla de «Casa Pepe» entraba encima y salía «Casa Pepe CDMX
     CDMX huésped» — que es justo lo que vio Javi en su app el 1-oct.
     La solución es la misma de «Grupo Casa Pepe», generalizada: cada
     sustitución se guarda aparte y deja un hueco numerado; al final se
     devuelven todas de golpe. Así el orden de las reglas deja de importar y
     ninguna puede morder el resultado de otra. */
  function texto(s) {
    if (!M || s == null) return s;
    s = String(s);
    if (!tiene(s)) return s;                  /* lo normal: salir en seguida */
    var caja = [];
    function guarda(v) { caja.push(String(v)); return '\u0000' + (caja.length - 1) + '\u0000'; }
    s = s.replace(/Grupo\s?Casa\s?Pepe/g, function () { return guarda('Grupo Casa Pepe'); });
    piezas(M).forEach(function (par) {
      var r = par[1];
      s = s.replace(par[0], typeof r === 'function'
        ? function () { return guarda(r.apply(null, arguments)); }
        : function () { return guarda(r); });
    });
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return caja[Number(i)]; });
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
      limpia(base);
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

  /* LO QUE SOBRA EN OTRA CASA.
     Traducir un nombre no basta: hay trozos de la app que son de Casa Pepe y de
     nadie más — su azotea, su power hour, su dirección, la historia de la casa.
     Eso no se traduce: se quita. Se marca en el HTML con data-marca-casapepe y
     desaparece en cuanto la app es de otro hotel.
     Se quita del DOM, no se esconde con CSS: así no lo lee un lector de
     pantalla ni lo encuentra un buscador dentro de la app. */
  var SOLO_CP = '[data-marca-casapepe]';
  function limpia(base) {
    if (!M || !M.hotel_id || !base) return;
    try {
      if (base.nodeType === 1 && base.matches && base.matches(SOLO_CP)) { base.remove(); return; }
      Array.prototype.forEach.call(base.querySelectorAll(SOLO_CP), function (e) {
        try { e.remove(); } catch (_) {}
      });
    } catch (_) {}
  }

  /* El logo y los colores: cualquier <img data-marca-logo> se cambia por el del
     hotel, en negro o en blanco según lo que pida su paleta. */
  function pinta() {
    if (!M || !M.hotel_id) return;
    try { limpia(document.body); } catch (_) {}
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
    /* El nombre de la marca a secas: «Barrio», no «App Barrio». */
    corto: function () { return M && M.hotel_id ? corto(M) : 'Pepe'; },
    /* Cómo se llama su restaurante, y si tienen uno. */
    rest:  function () { return M && M.hotel_id ? rest(M) : 'La Cósmica'; },
    hayRest: function () { return M && M.hotel_id ? !!M.rest_activo : true; },
    /* Las horas de su restaurante, si las cargaron en la ficha. */
    restHoras: function () {
      if (!M || !M.hotel_id) return null;
      return (M.rest_abre || M.rest_cierra) ? { abre: M.rest_abre, cierra: M.rest_cierra } : null;
    },
    conserje: function () { return (M && M.conserje) || 'Don José'; },
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
