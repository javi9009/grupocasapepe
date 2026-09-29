/* tabbar.js — la barra de abajo de APePe, una sola vez y para todas.
 *
 * Estaba copiada a mano en Inicio y en Yo, y en ninguna otra pantalla: el
 * huésped entraba al PepeQuiz, a Vnums o a La Cósmica y se quedaba sin salida
 * que no fuera la flecha de atrás. Y donde estaba copiada, no coincidía: Yo
 * tenía cuatro pestañas y en otro orden.
 *
 * Ahora vive aquí. Se carga al final del <body>:
 *     <script src="/apepe/tabbar.js"></script>
 * y se monta sola. Si la pantalla ya trae su propia barra (o el marco de
 * apepe-shell.js), no hace nada: manda la que ya está.
 *
 * El token de la reserva se le pega a cada liga con apepeResv.qs(), que es lo
 * que mantiene al huésped identificado al cambiar de pantalla, y los nombres
 * pasan por apepeT() cuando idioma.js está cargado.
 *
 * Javi, 29-sep.
 */
(function () {
  'use strict';
  if (window.__apepeTabbar) return;
  window.__apepeTabbar = true;

  var IMG = '/img/apepe/stickers/';
  /* Inicio · Vnums · Experiencias · Mapa · Yo, en ese orden. El mapa es también
     donde se filtra el Pepe GO!, por eso no tiene pestaña propia. */
  var TABS = [
    { id:'inicio', txt:'Inicio',       base:'/apepe/index.html',       img:IMG+'hola-perrito.webp',   caeEn:['/apepe','/apepe/index',
        /* Las pantallas que cuelgan de Inicio: se llega a ellas desde ahí,
           así que la pestaña encendida sigue siendo Inicio. */
        '/apepe/welcome','/apepe/cosmica','/apepe/extender','/apepe/promos',
        '/apepe/pepequiz','/apepe/tienda','/apepe/upgrade','/apepe/wifi',
        '/apepe/hola-pepe'] },
    { id:'vnums',  txt:'Vnums',        base:'/apepe/vnums.html',       img:'/img/apepe/vnum-moneda-128.webp', mon:true, caeEn:['/apepe/vnums'] },
    { id:'exp',    txt:'Experiencias', base:'/apepe/experiencias.html',img:IMG+'blue-demon-a.webp',   app:true, caeEn:['/apepe/experiencias','/sinc/index','/sinc/exp','/sinc/todas'] },
    { id:'mapa',   txt:'Mapa',         base:'/sinc/mapa.html',         img:IMG+'diana-reforma.webp',  app:true, caeEn:['/sinc/mapa','/apepe/challenge'] },
    { id:'yo',     txt:'Yo',           base:'/apepe/yo.html',          img:IMG+'teotihuacan.webp',    caeEn:['/apepe/yo'] }
  ];

  function qs() {
    try { if (window.apepeResv) return window.apepeResv.qs(); } catch (_) {}
    try {
      var p = new URLSearchParams(location.search), r = p.get('resv') || '';
      return r ? '?resv=' + encodeURIComponent(r) : '';
    } catch (_) { return ''; }
  }
  function t(f) { try { return window.apepeT ? window.apepeT(f) : f; } catch (_) { return f; } }

  function monta() {
    /* Si ya hay barra puesta a mano, o el marco de Sincrético montó la suya, se
       respeta: dos barras es peor que ninguna. */
    if (document.querySelector('.tabbar, .apsh-tabbar')) return;

    var css = document.createElement('style');
    css.textContent = [
      '.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--blanco,#fff);',
      '  border-top:1px solid var(--linea,#E6DFD6);display:flex;',
      '  padding:6px 4px calc(6px + env(safe-area-inset-bottom));',
      '  box-shadow:0 -8px 24px -20px rgba(30,26,22,.5)}',
      '.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;',
      '  text-decoration:none;color:var(--gris,#6E665C);font-size:10.5px;font-weight:600;padding:5px 0}',
      '.tabbar a .ti{font-size:20px;line-height:1;height:22px;display:flex;align-items:center;justify-content:center}',
      '.tabbar a .ti img{height:24px;width:24px;object-fit:contain;display:block}',
      /* El columnario de los Vnums va apagado hasta que es la pestaña activa. */
      '.tabbar a .ti .tiMon{width:21px;height:21px;display:block;filter:grayscale(1) contrast(1.15)}',
      '.tabbar a.on .ti .tiMon,.tabbar a:hover .ti .tiMon{filter:none}',
      '.tabbar a.on{color:var(--naranja,#F2682A)}'
    ].join('');
    document.head.appendChild(css);

    /* Hueco abajo para que la barra no tape la última línea. Se mira lo que la
       pantalla ya reservaba y sólo se amplía si se queda corto: Inicio guarda
       160px por el sombrero de Hola Pepe y no hay que quitárselos. */
    try {
      var hay = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      if (hay < 72) document.body.style.paddingBottom =
        'calc(72px + env(safe-area-inset-bottom, 0px))';
    } catch (_) {}

    var q = qs();
    /* La ruta, sin .html y sin la barra del final, para poder comparar de
       igual a igual: '/apepe/' e '/apepe/index.html' son la misma pantalla. */
    var ruta = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.innerHTML = TABS.map(function (x) {
      /* Coincidencia exacta y nada más: con 'empieza por', '/apepe' encendía
         Inicio en todas las pantallas de la app. */
      var on = x.caeEn.indexOf(ruta) >= 0;
      /* Las pantallas que también viven en Sincrético necesitan app=1 para
         seguir vistiéndose de APePe. */
      var href = x.base + (x.app ? (q ? q + '&app=1' : '?app=1') : q);
      var ic = x.mon
        ? '<img src="' + x.img + '" alt="" class="tiMon" onerror="this.replaceWith(document.createTextNode(\'🪙\'))">'
        : '<img src="' + x.img + '" alt="" onerror="this.replaceWith(document.createTextNode(\'•\'))">';
      return '<a class="' + (on ? 'on' : '') + '" href="' + href + '">' +
        '<span class="ti">' + ic + '</span>' + t(x.txt) + '</a>';
    }).join('');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
