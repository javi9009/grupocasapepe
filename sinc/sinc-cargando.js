/* El rato de espera, aprovechado.
 *
 * Una pantalla que carga es medio segundo en el que no pasa nada. En vez de una
 * rueda girando, aquí sale un sticker de la casa con una frase que dice algo:
 * de qué va esto, o —si sabemos las fechas del huésped— qué puede hacer en la
 * ciudad justo los días que va a estar.
 *
 * Los stickers son los de Casa Pepe, no emojis del teléfono. Y las frases viven
 * en la tabla `sinc_cargando`, no aquí dentro: lo que se le dice al huésped
 * mientras espera es contenido, y el contenido lo cambia el equipo sin tocar
 * código. Lo de abajo es sólo el arranque, para que nunca se vea un hueco
 * mientras llega la tabla.
 *
 *   sincCargando.monta('idDelDiv', {
 *     set: 'ficha' | 'huesped' | 'estancia',
 *     pie: 'Abriendo la ficha…',
 *     fechas: {desde:'2026-10-03', hasta:'2026-10-07'},   // opcional
 *     cada: 4200
 *   })  ->  {para(), pie(txt), fechas(f)}
 */
window.sincCargando = (function () {
  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  /* LOS STICKERS, VISTOS DESDE casapepe.mx. 3-oct-2026.
     Esto era '/img/apepe/stickers/' a pelo, y el escaparate tambien se
     sirve por casapepe.mx/sincretico/, donde /img/ no existe: los cinco
     stickers de la espera salian 404 y el huesped veia huecos mientras
     carga. Se cuelga de la carpeta de este mismo archivo, que es la que
     el otro sitio si tiene mapeada; la regla /sinc/img/apepe/* de
     _redirects cierra el circulo por las dos puertas. */
  var ST  = (function(){
    try{
      var sc=document.currentScript&&document.currentScript.src;
      if(sc) return sc.replace(/[^/]*$/,'')+'img/apepe/stickers/';
    }catch(_){}
    return '/img/apepe/stickers/';
  })();

  /* Arranque: lo mínimo para que la primera pintada no sea un hueco. En cuanto
     responde la tabla, esto se sustituye. */
  var SEMILLA = {
    ficha: [
      [ST+'quetzalcoatl-luchador.webp','La ceremonia manda: dónde empieza, dónde acaba, con qué se hace y cuáles son los hitos.','Teoría de la ceremonia'],
      [ST+'maguey.webp','Institución, conocimiento u objeto: toda herramienta del tour entra por una de las tres puertas.','Teoría de la cultura · Gustavo Bueno']
    ],
    huesped: [
      [ST+'hola-perrito.webp','Hay viajeros de paz y viajeros de guerra. Esto está hecho para los primeros.','Hospitalidad Original'],
      [ST+'maguey.webp','Lo llamaron el árbol de las maravillas: da techo, hilo, aguja, papel y de beber.','El agave']
    ],
    huesped_en: [
      [ST+'hola-perrito.webp','There are travellers of peace and travellers of war. This place was built for the first kind.','Original Hospitality'],
      [ST+'maguey.webp','They called the agave the tree of wonders: a roof, thread, a needle, paper and something to drink.','The agave']
    ]
  };
  SEMILLA.estancia = SEMILLA.huesped;
  SEMILLA.ficha_en = SEMILLA.ficha;   /* la ficha es pantalla de equipo: va en español */

  var cache = null, pidiendo = null;

  function pide() {
    if (cache) return Promise.resolve(cache);
    if (pidiendo) return pidiendo;
    pidiendo = fetch(SB + '/rest/v1/sinc_cargando' +
        '?select=ambito,sticker,frase,pie,frase_en,pie_en,dias,meses&activo=is.true&order=orden',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) { cache = l || []; return cache; })
      .catch(function () { cache = []; return cache; });
    return pidiendo;
  }

  var puesto = false;
  function estilos() {
    if (puesto) return; puesto = true;
    var s = document.createElement('style');
    s.textContent =
      '.scarga{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:15px;padding:54px 24px;text-align:center;min-height:52vh}' +
      '.scarga-st{width:132px;height:132px;flex:0 0 auto;display:flex;align-items:center;' +
        'justify-content:center;animation:scBota 2.4s ease-in-out infinite;' +
        'transition:opacity .45s ease}' +
      '.scarga-st img{max-width:100%;max-height:100%;display:block;' +
        'filter:drop-shadow(0 12px 20px rgba(30,26,22,.22))}' +
      '.scarga-tx{max-width:40ch;font-size:16px;line-height:1.55;color:#3C3630;' +
        'transition:opacity .45s ease;min-height:3.2em;display:flex;align-items:center}' +
      '.scarga-fu{font-size:11.5px;color:#A9A096;line-height:1.4;min-height:1.4em;' +
        'transition:opacity .45s ease;max-width:40ch}' +
      '.scarga-pie{font-family:Oswald,system-ui,sans-serif;font-size:11.5px;letter-spacing:.14em;' +
        'text-transform:uppercase;color:#A9A096;margin-top:4px}' +
      '@keyframes scBota{0%,100%{transform:translateY(0) rotate(-2deg)}' +
        '50%{transform:translateY(-10px) rotate(2deg)}}' +
      /* Dentro de un pop no hay 52vh que gastar. */ 
      '.scarga.compacto{min-height:0;padding:4px 0 0;gap:9px}' +
      '.scarga.compacto .scarga-st{width:0;height:0;overflow:hidden;animation:none}' +
      '.scarga.compacto .scarga-tx{font-size:14px;min-height:3em}' +
      '@media(max-width:480px){.scarga-st{width:104px;height:104px}.scarga-tx{font-size:15px}}' +
      '@media(prefers-reduced-motion:reduce){.scarga-st{animation:none}' +
        '.scarga-st,.scarga-tx,.scarga-fu{transition:none}}';
    document.head.appendChild(s);
  }

  function baraja(l) {
    var a = l.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Los días de la semana que toca la estancia, y los meses. Una estancia de
     cinco noches toca cinco días: la frase del lunes sirve si el lunes cae
     dentro. Más de tres semanas ya es cualquier día, no aporta filtrar. */
  function dias(f) {
    if (!f || !f.desde) return null;
    var d = new Date(f.desde + 'T12:00:00'), fin = new Date((f.hasta || f.desde) + 'T12:00:00');
    if (isNaN(d) || isNaN(fin) || fin < d) return null;
    var vistos = {}, meses = {}, n = 0;
    while (d <= fin && n < 24) { vistos[d.getDay()] = 1; meses[d.getMonth() + 1] = 1; d.setDate(d.getDate() + 1); n++; }
    return { dias: Object.keys(vistos).map(Number), meses: Object.keys(meses).map(Number), largo: n };
  }

  function cabe(fila, ventana) {
    if (!fila.dias && !fila.meses) return true;
    if (!ventana) return !fila.dias && !fila.meses;   /* sin fechas, sólo lo que vale siempre */
    if (fila.dias && fila.dias.length) {
      var hay = fila.dias.some(function (x) { return ventana.dias.indexOf(Number(x)) >= 0; });
      if (!hay) return false;
    }
    if (fila.meses && fila.meses.length) {
      var hm = fila.meses.some(function (x) { return ventana.meses.indexOf(Number(x)) >= 0; });
      if (!hm) return false;
    }
    return true;
  }

  /* Una frase sin traducir NO se enseña en inglés a medias: se deja fuera.
     Es preferible que el inglés tenga menos frases a que tenga una en español. */
  function di(f, en) {
    if (en) return f.frase_en ? [f.sticker, f.frase_en, f.pie_en || ''] : null;
    return [f.sticker, f.frase, f.pie || ''];
  }

  function arma(filas, set, ventana, en) {
    function toma(cond) {
      var out = [];
      (filas || []).forEach(function (f) {
        if (!cond(f)) return;
        var x = di(f, en); if (x) out.push(x);
      });
      return out;
    }

    if (set === 'ficha') {
      var lf = toma(function (f) { return f.ambito === 'ficha'; });
      return lf.length ? baraja(lf) : baraja(SEMILLA.ficha);
    }

    /* Lo accionable primero: si sabemos sus fechas, que lo primero que lea sea
       algo que puede hacer esta semana, no una idea bonita. */
    var deCasa = toma(function (f) { return f.ambito === 'huesped'; });
    if (ventana) {
      var deCiudad = toma(function (f) { return f.ambito === 'estancia' && cabe(f, ventana); });
      if (deCiudad.length) return baraja(deCiudad).concat(baraja(deCasa));
    }
    if (deCasa.length) return baraja(deCasa);
    return baraja(SEMILLA[en ? 'huesped_en' : 'huesped']);
  }

  function monta(el, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return { para: function () {}, pie: function () {}, fechas: function () {}, idioma: function () {} };
    opts = opts || {};
    estilos();

    var set = opts.set === 'ficha' ? 'ficha' : 'huesped';
    /* Si la página no dice el idioma, se mira el del documento. */
    var en = /^en/i.test(opts.idioma || document.documentElement.lang || 'es');
    var ventana = dias(opts.fechas);
    var lista = baraja(SEMILLA[(en ? set + '_en' : set)] || SEMILLA[set] || SEMILLA.huesped);
    var i = 0, vivo = true;

    el.innerHTML =
      '<div class="scarga' + (opts.compacto ? ' compacto' : '') + '">' +
        '<div class="scarga-st"></div>' +
        '<div class="scarga-tx"></div>' +
        '<div class="scarga-fu"></div>' +
        '<div class="scarga-pie"></div>' +
      '</div>';
    var st = el.querySelector('.scarga-st'),
        tx = el.querySelector('.scarga-tx'),
        fu = el.querySelector('.scarga-fu'),
        pi = el.querySelector('.scarga-pie');
    pi.textContent = opts.pie || 'Un momento…';

    function pon() {
      var f = lista[i % lista.length];
      if (!f) return;
      st.innerHTML = f[0] ? '<img src="' + String(f[0]).replace(/"/g, '%22') + '" alt="">' : '';
      tx.textContent = f[1] || '';
      fu.textContent = f[2] || '';
    }
    pon();

    /* Llega la tabla: se cambia la lista sin cortar el ritmo, y se adelantan
       las imágenes para que el cambio no parpadee. */
    pide().then(function (filas) {
      if (!vivo) return;
      var nueva = arma(filas, set, ventana, en);
      if (!nueva.length) return;
      lista = nueva; i = 0; pon();
      nueva.slice(0, 4).forEach(function (f) { if (f[0]) { var im = new Image(); im.src = f[0]; } });
    });

    var reloj = setInterval(function () {
      st.style.opacity = tx.style.opacity = fu.style.opacity = '0';
      setTimeout(function () {
        if (!vivo) return;
        i++; pon();
        st.style.opacity = tx.style.opacity = fu.style.opacity = '1';
      }, 450);
    }, opts.cada || 4600);

    return {
      para:   function () { vivo = false; clearInterval(reloj); },
      pie:    function (t) { pi.textContent = t; },
      /* La reserva suele llegar DESPUÉS de montar el cargando: cuando la
         página ya sabe las fechas, se las pasa y la lista se reordena. */
      fechas: function (f) {
        ventana = dias(f);
        pide().then(function (filas) {
          if (!vivo) return;
          var nueva = arma(filas, set, ventana, en);
          if (nueva.length) { lista = nueva; i = 0; pon(); }
        });
      },
      /* El huésped cambia de idioma a media pantalla: se repinta, no se recarga. */
      idioma: function (l) {
        en = /^en/i.test(l || 'es');
        pide().then(function (filas) {
          if (!vivo) return;
          var nueva = arma(filas, set, ventana, en);
          if (nueva.length) { lista = nueva; i = 0; pon(); }
        });
      }
    };
  }

  return { monta: monta, pide: pide };
})();
