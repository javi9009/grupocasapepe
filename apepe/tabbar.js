/* tabbar.js — la barra de abajo de la App Huésped, una sola vez y para todas.
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
 *
 * ---------------------------------------------------------------------------
 * LA BARRA NUEVA. Javi, 26-oct-2026, con el rediseño de la App Huésped.
 *
 * Antes las pestañas eran las cosas que tenemos: Inicio, Vnums, Experiencias,
 * Mapa, Yo. Ahora son las cosas que el huésped quiere hacer:
 *
 *     Casa        dónde duermo y qué hay en la casa
 *     Hoy         qué hago hoy en la ciudad
 *     Artesanías  lo que se lleva, y de quién es
 *     Mexican     How to be a Mexican: el juego, el test y las lecturas
 *     Wallet      sus Vnums, sus boletos, sus pedidos y su perfil
 *
 * Dos cosas que no son capricho:
 *
 * · EL MAPA BAJA DE PESTAÑA. No desaparece —vive dentro de Hoy— pero deja de
 *   ocupar un quinto de la barra. Cuando haya botón flotante de mapa en Hoy,
 *   esto queda redondo; mientras tanto, su ruta enciende Hoy, que es donde
 *   está.
 *
 * · AQUÍ NO SE INVENTAN PANTALLAS. Cada pestaña apunta a una que ya existe.
 *   «Mexican» lleva hoy a Pepe GO! y «Wallet» a Vnums porque sus portadas
 *   todavía no están hechas; el día que existan se cambia `base` y nada más.
 *   Una barra que lleva a un 404 es peor que la barra vieja.
 *
 * · ICONOS DE TRAZO, NO STICKERS. Los stickers son nuestros y están bien en
 *   una pantalla, pero a 22px y en cinco repetidos se convierten en manchas
 *   que no se distinguen. Van dibujados aquí mismo en SVG: pesan nada, se
 *   pintan del color que toque y no dependen de que cargue una imagen.
 */
(function () {
  'use strict';
  if (window.__apepeTabbar) return;
  window.__apepeTabbar = true;

  /* EL MODO DE ACCESO. Dos App Huésped distintas viven en las mismas pantallas:
       · huésped  -> la completa (Casa, Hoy, Artesanías, Mexican, Wallet). Se
                     llega por el check-in, y ahí caben también los voluntarios.
       · publico  -> el que entra por el Pepe GO! de Sincrético sin hospedarse:
                     juega, reserva tours y junta Vnums. No tiene Casa -no
                     duerme aquí- ni Artesanías.
       · colab    -> el colaborador que llega desde SoyPepe.

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

  /* Los dibujos. 24×24, trazo de 1.8 y puntas redondeadas, para que a 22px se
     distingan de un vistazo. Heredan el color con currentColor. */
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var ICO = {
    casa:  S+'<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.8 20v-5.4h4.4V20"/></svg>',
    sol:   S+'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/></svg>',
    bolsa: S+'<path d="M5 8h14l-1.1 11.2a1.6 1.6 0 0 1-1.6 1.3H7.7a1.6 1.6 0 0 1-1.6-1.3Z"/><path d="M8.8 8V6.4a3.2 3.2 0 0 1 6.4 0V8"/></svg>',
    dado:  S+'<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2"/><circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/></svg>',
    cartera:S+'<path d="M3.6 8.2a2.2 2.2 0 0 1 2.2-2.2h11.3a2.2 2.2 0 0 1 2.2 2.2v8.6a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2Z"/><path d="M3.6 10.4h4.1a2 2 0 0 1 0 4H3.6"/></svg>',
    pin:   S+'<path d="M12 21s6.3-5.7 6.3-10.3A6.3 6.3 0 0 0 5.7 10.7C5.7 15.3 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/></svg>'
  };

  /* Cada pestaña apunta a una pantalla que EXISTE hoy. `caeEn` son las rutas
     que la encienden: coincidencia exacta, sin .html y sin barra final. */
  var CAT = {
    casa: { id:'casa', txt:'Casa', base:'/apepe/index.html', ico:ICO.casa,
      caeEn:['/apepe','/apepe/index','/apepe/welcome','/apepe/cosmica','/apepe/wifi',
             '/apepe/hola-pepe','/apepe/extender','/apepe/upgrade','/apepe/volver'] },

    /* Hoy es el catálogo de la ciudad. Se entra por el redirector de la app,
       que es el que conserva el token y la marca; el mapa cae aquí. */
    /* La agenda del dia es pantalla propia: el catalogo contesta otra pregunta
       y vive en Sincretico. Las rutas de Sincretico tambien encienden Hoy,
       porque desde aqui se sale hacia alla. */
    hoy: { id:'hoy', txt:'Hoy', base:'/apepe/hoy.html', ico:ICO.sol,
      caeEn:['/apepe/hoy','/apepe/experiencias','/sinc/index','/sinc/exp','/sinc/todas','/sinc/mapa'] },

    arte: { id:'arte', txt:'Artesanías', base:'/apepe/tienda.html', ico:ICO.bolsa,
      caeEn:['/apepe/tienda'] },

    /* En la barra se lee «Mexican» porque el nombre entero no cabe a 12px. */
    mex: { id:'mex', txt:'Mexican', base:'/apepe/challenge.html', ico:ICO.dado,
      caeEn:['/apepe/challenge','/apepe/pepequiz','/apepe/biblioteca','/apepe/pepego'] },

    wallet: { id:'wallet', txt:'Wallet', base:'/apepe/vnums.html', ico:ICO.cartera,
      caeEn:['/apepe/vnums','/apepe/yo','/apepe/pedidos','/apepe/promos'] },

    mapa: { id:'mapa', txt:'Mapa', base:'/sinc/mapa.html', ico:ICO.pin, app:true,
      caeEn:['/sinc/mapa'] }
  };

  var ORDEN;
  if (MODO==='publico')    ORDEN=['hoy','mex','wallet'];
  else if (MODO==='colab') ORDEN=['hoy','mapa'];
  else                     ORDEN=['casa','hoy','arte','mex','wallet'];
  /* Sin huésped no hay Hoy que redirija con token: el público va al catálogo. */
  if (MODO==='publico' || MODO==='colab'){ CAT.hoy.base='/sinc/index.html'; CAT.hoy.app=true; }
  /* Y para el colaborador, el mapa es pestaña propia: es su herramienta. */
  if (MODO==='colab') CAT.hoy.caeEn=['/apepe/experiencias','/sinc/index','/sinc/exp','/sinc/todas'];

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
      /* FLOTANTE Y OSCURA. No pegada al borde: separada, con sombra, para que
         se lea encima de cualquier pantalla —las hay crema, las hay negras— sin
         tener que cambiar de color en cada una. */
      '.tabbar{position:fixed;left:12px;right:12px;z-index:60;',
      '  bottom:calc(14px + env(safe-area-inset-bottom, 0px));',
      '  height:64px;border-radius:22px;background:#1E1A16;',
      '  display:flex;align-items:center;justify-content:space-around;',
      '  padding:0 8px;box-shadow:0 12px 30px -10px rgba(0,0,0,.5)}',
      '.tabbar a{display:flex;align-items:center;gap:7px;text-decoration:none;',
      '  color:#A9A096;padding:10px 12px;border-radius:16px;',
      '  font-size:12.5px;font-weight:700;line-height:1;',
      '  transition:background .18s ease, color .18s ease}',
      '.tabbar a .ti{display:flex;align-items:center;justify-content:center}',
      '.tabbar a .ti svg{width:22px;height:22px;display:block}',
      /* Sólo la activa lleva nombre: cinco nombres a la vez no caben en un
         teléfono estrecho sin quedar todos ilegibles. */
      '.tabbar a .tx{display:none}',
      '.tabbar a.on{background:#F2682A;color:#fff}',
      '.tabbar a.on .ti svg{width:20px;height:20px}',
      '.tabbar a.on .tx{display:inline}',
      '@media (hover:hover){.tabbar a:not(.on):hover{color:#F6EFE4}}',
      /* LA APP ESTÁ EN BETA, Y SE DICE. Javi, 12-oct-2026. Va pegada encima de
         la barra de abajo: se ve en todas las pantallas y no estorba en
         ninguna. Quien la usa estos días tiene que saber que está probándola,
         no estrenándola. */
      '.betafranja{position:fixed;left:12px;right:12px;z-index:59;',
      '  bottom:calc(84px + env(safe-area-inset-bottom, 0px));',
      '  background:var(--tinta,#1E1A16);color:#F6F1E9;text-align:center;',
      '  border-radius:999px;',
      '  font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;',
      '  padding:4px 10px;opacity:.92}'
    ].join('');
    document.head.appendChild(css);

    /* El aviso de beta, una sola vez por pantalla. */
    if(!document.querySelector('.betafranja')){
      var bf=document.createElement('div');
      bf.className='betafranja';
      bf.textContent=t('Versión beta · la estamos afinando');
      document.body.appendChild(bf);
    }

    /* Hueco abajo para que la barra no tape la última línea. Se mira lo que la
       pantalla ya reservaba y sólo se amplía si se queda corto: Inicio guarda
       160px por el sombrero de Hola Pepe y no hay que quitárselos. Ahora la
       barra flota, así que hace falta algo más de aire que antes. */
    try {
      var hay = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      if (hay < 116) document.body.style.paddingBottom =
        'calc(116px + env(safe-area-inset-bottom, 0px))';
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
         seguir vistiéndose de App Huésped. */
      var href = x.base + (x.app ? (q ? q + '&app=1' : '?app=1') : q);
      return '<a class="' + (on ? 'on' : '') + '" href="' + href + '"' +
        ' aria-label="' + t(x.txt) + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<span class="ti">' + x.ico + '</span>' +
        '<span class="tx">' + t(x.txt) + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
