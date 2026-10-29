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
     manda -es un acto de esta navegación-; lo guardado, sólo cuando no hay token.

     EL MODO YA NO SE QUEDA A VIVIR EN EL TELÉFONO. Javi, 26-oct-2026: abrió la
     app con su cuenta y le salía la barra de tres pestañas -Mapa, Pepe GO,
     Experiencias-, que es la del colaborador, y al tocar Experiencias se iba a
     Sincrético y parecía que la app lo echaba. El modo se le había quedado
     guardado de alguna vez que entró por SoyPepe, y como él nunca lleva token
     de reserva -entra con su cuenta-, no había nada que lo borrara: la app se
     le quedó recortada para siempre.
     Ahora el modo vive en sessionStorage: dura lo que dura esa navegación, que
     es justo para lo que se guardaba -no perderlo al cambiar de pantalla-, y
     mañana la app vuelve a estar entera. Lo que quedó guardado de antes se
     migra una vez y se borra, para que esto se limpie solo en los teléfonos
     que ya lo tienen. */
  var MODO = (function(){
    function bueno(v){ v=String(v==null?'':v).trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)?v:''; }
    function ls(k){ try{ return bueno(localStorage.getItem(k)); }catch(_){ return ''; } }
    function guarda(v){ try{ sessionStorage.setItem('apepe_modo', v); }catch(_){ } }
    function olvida(){
      try{ sessionStorage.removeItem('apepe_modo'); }catch(_){ }
      try{ localStorage.removeItem('apepe_modo'); }catch(_){ }
    }
    /* El viejo guardado en localStorage: se recoge una vez y se tira. */
    var viejo=''; try{ viejo=localStorage.getItem('apepe_modo')||''; }catch(_){ }
    if(viejo){
      try{ if(!sessionStorage.getItem('apepe_modo')) sessionStorage.setItem('apepe_modo', viejo); }catch(_){ }
      try{ localStorage.removeItem('apepe_modo'); }catch(_){ }
    }

    var p; try{ p=new URLSearchParams(location.search); }catch(_){ p=null; }
    var m = p ? (p.get('modo')||'') : '';
    if(m){ guarda(m); return m; }
    var hayReserva = false;
    try{ hayReserva = !!(window.apepeResv && (window.apepeResv.token()||window.apepeResv.sol())); }catch(_){ }
    if(!hayReserva && p) hayReserva = !!(bueno(p.get('resv'))||bueno(p.get('sol')));
    if(!hayReserva) hayReserva = !!(ls('apepe_resv')||ls('apepe_sol'));
    if(hayReserva){ olvida(); return ''; }
    try{ return sessionStorage.getItem('apepe_modo')||''; }catch(_){ return ''; }
  })();

  var CAT = {
    inicio: { id:'inicio', txt:'Inicio', base:'/apepe/index.html', img:IMG+'hola-perrito.webp',
      caeEn:['/apepe','/apepe/index','/apepe/welcome','/apepe/cosmica','/apepe/extender','/apepe/promos',
        '/apepe/pepequiz','/apepe/tienda','/apepe/upgrade','/apepe/wifi','/apepe/hola-pepe'] },
    pepego: { id:'pepego', txt:'Pepe GO!', base:'/apepe/challenge.html', img:IMG+'bellas-artes.webp', caeEn:['/apepe/challenge'] },
    vnums:  { id:'vnums', txt:'Vnums', base:'/apepe/vnums.html', img:'/img/apepe/vnum-moneda-128.webp', mon:true, caeEn:['/apepe/vnums'] },
    exp:    { id:'exp', txt:'Experiencias', base:'/apepe/experiencias.html', img:IMG+'blue-demon-a.webp', app:true, caeEn:['/apepe/experiencias','/sinc/index','/sinc/exp','/sinc/todas'] },
    mapa:   { id:'mapa', txt:'Mapa', base:'/sinc/mapa.html', img:IMG+'diana-reforma.webp', app:true, caeEn:['/sinc/mapa'] },
    /* MI HOTEL. Javi, 29-oct-2026. Las tres puertas de la casa —darse la
       bienvenida, bajar a cenar, quedarse otra noche— estaban como tres
       bolitas en lo alto de la portada, robándole el sitio a lo que el
       huésped viene a ver. Son de la casa, no del descubrir: ahora viven
       detrás de un botón de la barra, que es donde se busca lo propio. */
    /* El globo y no el xolo: el xolo ya es Inicio, y dos iconos iguales en la
       misma barra no distinguen nada. Javi, 29-oct-2026. */
    hotel:  { id:'hotel', txt:'Mi hotel', hoja:true, img:IMG+'globo.webp',
              base:'#', caeEn:['/apepe/welcome','/apepe/cosmica','/apepe/extender'] },
    yo:     { id:'yo', txt:'Yo', base:'/apepe/yo.html', img:IMG+'teotihuacan.webp',
              caeEn:['/apepe/yo','/apepe/vnums'] }
  };
  /* LAS PUERTAS DE LA CASA, dentro de «Mi hotel». Cada una con su foto y su
     frase: de bolita de 62px no se apetecen, y en franja se leen. */
  var CASA = [
    { txt:'Welcome',        dice:'Tu bienvenida: lo que incluye tu estancia y cómo funciona la casa.',
      href:'/apepe/welcome.html',  img:IMG+'hola-perrito.webp' },
    { txt:'La Cósmica',     dice:'La terraza. Carta, horarios y lo que se cocina hoy.',
      href:'/apepe/cosmica.html',  img:IMG+'molcajete.webp' },
    { txt:'¿Te quedas más?',dice:'Alarga tu estancia o súbete de cuarto.',
      href:'/apepe/extender.html', img:IMG+'globo.webp' }
  ];
  var ORDEN;
  /* El mapa sale de la barra: ahora es un botón flotante encima de ella, como
     el de Fever. Y los Vnums se van dentro de «Yo», que es donde el huésped
     busca lo suyo. Javi, 29-oct-2026. */
  if (MODO==='publico')    ORDEN=['pepego','exp','vnums'];
  else if (MODO==='colab') ORDEN=['pepego','exp'];
  else                     ORDEN=['inicio','hotel','exp','yo'];
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
      '.tabbar a.on{color:var(--naranja,#F2682A)}',
      /* LA APP ESTÁ EN BETA, Y SE DICE. Javi, 12-oct-2026. Va pegada encima de
         la barra de abajo: se ve en todas las pantallas y no estorba en
         ninguna. Quien la usa estos días tiene que saber que está probándola,
         no estrenándola. */
      '.betafranja{position:fixed;left:0;right:0;z-index:59;',
      '  bottom:calc(66px + env(safe-area-inset-bottom, 0px));',
      '  background:var(--tinta,#1E1A16);color:#F6F1E9;text-align:center;',
      '  font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;',
      '  padding:4px 10px;opacity:.92}',
      /* EL MAPA, FLOTANDO. Javi, 29-oct-2026: «como el de Fever». Ya no es una
         pestaña: es una pastilla que va encima de la barra, en el centro, y se
         ve desde cualquier pantalla sin gastar un hueco de los cuatro. */
      '.mapapill{position:fixed;left:50%;transform:translateX(-50%);z-index:61;',
      '  bottom:calc(84px + env(safe-area-inset-bottom, 0px));',
      '  display:inline-flex;align-items:center;gap:8px;text-decoration:none;',
      '  background:var(--blanco,#fff);color:var(--tinta,#1E1A16);',
      '  font-size:14px;font-weight:700;padding:11px 20px;border-radius:999px;',
      '  border:1px solid var(--linea,#E6DFD6);',
      '  box-shadow:0 10px 24px -10px rgba(30,26,22,.45)}',
      '.mapapill img{height:20px;width:20px;object-fit:contain;display:block}',
      '.mapapill:active{transform:translateX(-50%) scale(.97)}',
      /* La hoja de Mi hotel. Tres franjas horizontales, cada una con su foto y
         su frase: una bolita con una palabra no cuenta nada. */
      '.casaOv{position:fixed;inset:0;z-index:1400;background:rgba(30,26,22,.5);',
      '  opacity:0;pointer-events:none;transition:opacity .18s}',
      '.casaOv.on{opacity:1;pointer-events:auto}',
      '.casaHoja{position:fixed;left:0;right:0;bottom:0;z-index:1401;',
      '  background:var(--papel,#FBF7F2);border-radius:18px 18px 0 0;',
      '  padding:16px 16px calc(20px + env(safe-area-inset-bottom));',
      '  transform:translateY(102%);transition:transform .22s ease;',
      '  box-shadow:0 -16px 40px -24px rgba(30,26,22,.6);max-height:84vh;overflow:auto}',
      '.casaHoja.on{transform:translateY(0)}',
      '.casaHoja h3{margin:2px 0 3px;font-size:17px;font-weight:800}',
      '.casaHoja .dice{margin:0 0 14px;font-size:13px;color:var(--gris,#6E665C)}',
      '.casaFr{display:flex;align-items:center;gap:13px;text-decoration:none;color:inherit;',
      '  background:var(--blanco,#fff);border:1px solid var(--linea,#E6DFD6);',
      '  border-radius:14px;padding:12px 14px;margin-bottom:10px}',
      '.casaFr:last-of-type{margin-bottom:0}',
      '.casaFr img{height:46px;width:46px;object-fit:contain;flex:0 0 auto}',
      '.casaFr b{display:block;font-size:15px;margin-bottom:2px}',
      '.casaFr small{display:block;font-size:12.5px;line-height:1.45;color:var(--gris,#6E665C)}',
      '.casaFr .fl{margin-left:auto;color:var(--naranja,#F2682A);font-size:19px;flex:0 0 auto}',
      '.casaCerrar{display:block;width:100%;margin-top:14px;background:none;border:0;',
      '  font:inherit;font-size:14px;font-weight:600;color:var(--gris,#6E665C);padding:8px}'
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
       160px por el sombrero de Hola Pepe y no hay que quitárselos. */
    try {
      var hay = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      if (hay < 92) document.body.style.paddingBottom =
        'calc(92px + env(safe-area-inset-bottom, 0px))';
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
      var href = x.hoja ? '#' : (x.base + (x.app ? (q ? q + '&app=1' : '?app=1') : q));
      var ic = x.mon
        ? '<img src="' + x.img + '" alt="" class="tiMon" onerror="this.replaceWith(document.createTextNode(\'🪙\'))">'
        : '<img src="' + x.img + '" alt="" onerror="this.replaceWith(document.createTextNode(\'•\'))">';
      return '<a class="' + (on ? 'on' : '') + '" href="' + href + '"' +
        (x.hoja ? ' data-hoja="casa"' : '') + '>' +
        '<span class="ti">' + ic + '</span>' + t(x.txt) + '</a>';
    }).join('');
    document.body.appendChild(nav);

    /* La pastilla del mapa. Va aparte de la barra para poder flotar encima. */
    if(!document.querySelector('.mapapill') && ruta !== '/sinc/mapa'){
      var mp = document.createElement('a');
      mp.className = 'mapapill';
      mp.href = '/sinc/mapa.html' + (q ? q + '&app=1' : '?app=1');
      mp.innerHTML = '<img src="' + IMG + 'diana-reforma.webp" alt="" ' +
        'onerror="this.replaceWith(document.createTextNode(\'📍\'))">' + t('Mapa');
      document.body.appendChild(mp);
    }

    var abre = nav.querySelector('[data-hoja="casa"]');
    if(abre) abre.onclick = function(ev){ ev.preventDefault(); hojaCasa(); };
  }

  /* LA HOJA DE MI HOTEL. Se monta la primera vez que se abre y se queda: tres
     ligas no justifican volver a construirla cada vez. */
  var HOJA=null, OV=null;
  function hojaCasa(){
    var q = qs();
    if(!HOJA){
      OV = document.createElement('div'); OV.className='casaOv';
      HOJA = document.createElement('div'); HOJA.className='casaHoja';
      HOJA.innerHTML =
        '<h3>' + t('Mi hotel') + '</h3>' +
        '<p class="dice">' + t('Lo de la casa, a mano.') + '</p>' +
        CASA.map(function(c){
          return '<a class="casaFr" href="' + c.href + q + '">' +
            '<img src="' + c.img + '" alt="" onerror="this.style.display=\'none\'">' +
            '<span><b>' + t(c.txt) + '</b><small>' + t(c.dice) + '</small></span>' +
            '<span class="fl">&rarr;</span></a>';
        }).join('') +
        '<button class="casaCerrar" type="button">' + t('Cerrar') + '</button>';
      document.body.appendChild(OV); document.body.appendChild(HOJA);
      OV.onclick = cierraCasa;
      HOJA.querySelector('.casaCerrar').onclick = cierraCasa;
    }
    OV.classList.add('on');
    requestAnimationFrame(function(){ HOJA.classList.add('on'); });
    terceraPuerta();
  }

  /* LA TERCERA PUERTA CAMBIA CON LA ESTANCIA. Esto vivia en la portada, pegado
     a la bolita: quien la tenia abierta veia «Mejora tu habitacion» si aun no
     habia llegado, y «¿Cuando vuelves?» si ya se habia ido. Al mudarse las
     puertas a la hoja, la logica se muda con ellas —si no, la hoja diria
     «¿Te quedas mas?» a alguien que se fue hace una semana—. Y aqui sirve en
     TODAS las pantallas, no solo en la portada. */
  var PUERTA3=null;
  function terceraPuerta(){
    if(PUERTA3!==null) return;          /* una vez por navegacion basta */
    var r=''; try{ r = (window.apepeResv && window.apepeResv.token()) || ''; }catch(_){ }
    if(!r){ PUERTA3=false; return; }
    PUERTA3=true;
    var SB='https://rehophywchakfapivsbh.supabase.co';
    var KEY='sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
    fetch(SB+'/functions/v1/apepe-estancias',{method:'POST',
      headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({resv:r})})
      .then(function(x){ return x.json(); })
      .then(function(j){
        if(!j||!j.ok||!HOJA) return;
        var A={ futura:   ['/apepe/upgrade.html', 'Mejora tu habitación',
                           'Todavía no llegas: elige mejor cuarto antes de entrar.', 'maximiliano.webp'],
                hospedado:['/apepe/extender.html','¿Te quedas más?',
                           'Alarga tu estancia o súbete de cuarto.', 'globo.webp'],
                salido:   ['/apepe/volver.html',  '¿Cuándo vuelves?',
                           'Ya te fuiste. Aparta tus fechas para la próxima.', 'puerta-cdmx.webp'] }[j.estado];
        if(!A) return;
        var fr=HOJA.querySelectorAll('.casaFr')[2]; if(!fr) return;
        fr.href=A[0]+qs();
        var b=fr.querySelector('b'); if(b) b.textContent=t(A[1]);
        var sm=fr.querySelector('small'); if(sm) sm.textContent=t(A[2]);
        var im=fr.querySelector('img'); if(im) im.src='/img/apepe/stickers/'+A[3];
      })
      .catch(function(){});
  }
  function cierraCasa(){
    if(!HOJA) return;
    HOJA.classList.remove('on'); OV.classList.remove('on');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
