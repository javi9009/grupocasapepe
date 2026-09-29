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

  /* EL MODO DE ACCESO. Dos APePe distintas viven en las mismas pantallas:
       · huésped  -> la completa (Inicio, Vnums, Experiencias, Mapa, Yo). Se llega
                     por el check-in, y ahí caben también los voluntarios.
       · publico  -> el que entra por el Pepe GO! de Sincrético sin hospedarse:
                     juega, reserva tours y junta Vnums (Pepe GO, Experiencias,
                     Vnums, Mapa).
       · colab    -> el colaborador que llega desde SoyPepe (Mapa, Pepe GO,
                     Experiencias).

     MANDA LA IDENTIDAD, NO EL RECUERDO. El modo se guardaba en el teléfono, y a
     un huésped que alguna vez abrió el Pepe GO! público o SoyPepe le desaparecían
     los Vnums y el Yo de su propia app. Así que: si hay token de reserva, es
     huésped y punto, y de paso se borra el modo guardado. Un ?modo= en la liga sí
     manda -es un acto de esta navegación-; lo guardado, sólo cuando no hay token. */
  var MODO = (function(){
    function bueno(v){ v=String(v==null?'':v).trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)?v:''; }
    function ls(k){ try{ return bueno(localStorage.getItem(k)); }catch(_){ return ''; } }
    var p; try{ p=new URLSearchParams(location.search); }catch(_){ p=null; }
    var m = p ? (p.get('modo')||'') : '';
    if(m){ try{ localStorage.setItem('apepe_modo', m); }catch(_){ } return m; }
    var hayReserva = false;
    try{ hayReserva = !!(window.apepeResv && (window.apepeResv.token()||window.apepeResv.sol())); }catch(_){ }
    if(!hayReserva && p) hayReserva = !!(bueno(p.get('resv'))||bueno(p.get('sol')));
    if(!hayReserva) hayReserva = !!(ls('apepe_resv')||ls('apepe_sol'));
    if(hayReserva){ try{ localStorage.removeItem('apepe_modo'); }catch(_){ } return ''; }
    try{ return localStorage.getItem('apepe_modo')||''; }catch(_){ return ''; }
  })();

  var CAT = {
    inicio: { id:'inicio', txt:'Inicio', base:'/apepe/index.html', img:IMG+'hola-perrito.webp',
      caeEn:['/apepe','/apepe/index','/apepe/welcome','/apepe/cosmica','/apepe/extender','/apepe/promos',
        '/apepe/pepequiz','/apepe/tienda','/apepe/upgrade','/apepe/wifi','/apepe/hola-pepe'] },
    pepego: { id:'pepego', txt:'Pepe GO!', base:'/apepe/challenge.html', img:IMG+'bellas-artes.webp', caeEn:['/apepe/challenge'] },
    vnums:  { id:'vnums', txt:'Vnums', base:'/apepe/vnums.html', img:'/img/apepe/vnum-moneda-128.webp', mon:true, caeEn:['/apepe/vnums'] },
    exp:    { id:'exp', txt:'Experiencias', base:'/apepe/experiencias.html', img:IMG+'blue-demon-a.webp', app:true, caeEn:['/apepe/experiencias','/sinc/index','/sinc/exp','/sinc/todas'] },
    mapa:   { id:'mapa', txt:'Mapa', base:'/sinc/mapa.html', img:IMG+'diana-reforma.webp', app:true, caeEn:['/sinc/mapa'] },
    yo:     { id:'yo', txt:'Yo', base:'/apepe/yo.html', img:IMG+'teotihuacan.webp', caeEn:['/apepe/yo'] }
  };
  var ORDEN;
  if (MODO==='publico')    ORDEN=['pepego','exp','vnums','mapa'];
  else if (MODO==='colab') ORDEN=['mapa','pepego','exp'];
  else { ORDEN=['inicio','vnums','exp','mapa','yo']; CAT.mapa.caeEn=['/sinc/mapa','/apepe/challenge']; }
  var TABS = ORDEN.map(function(k){ return CAT[k]; });

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
