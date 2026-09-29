/* apepe-shell.js — el marco de la APePe para pantallas que viven en Sincrético.
 *
 * La misma pantalla (Mapa, Experiencias…) se abre en dos contextos:
 *   · Público / desde la web de Sincrético  -> se queda con el chrome de Sincrético.
 *   · Desde la APePe (el huésped, que trae su token) -> se le pone el header y la
 *     barra de pestañas de la APePe, y se esconde el header/footer de Sincrético,
 *     para que se navegue como una sola app.
 *
 * Contexto de APePe = ?app=1  ó  hay token de reserva (en la liga o guardado).
 * Se carga al final del <body>. Si NO es contexto de APePe, no hace nada.
 * Javi, 29-sep. */
(function () {
  'use strict';
  try {
    var P = new URLSearchParams(location.search);

    /* --- ¿venimos de la APePe? --- */
    function bueno(v){ v=String(v==null?'':v).trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)?v:''; }
    function ls(k){ try{ return bueno(localStorage.getItem(k)); }catch(_){ return ''; } }
    var RESV = bueno(P.get('resv')) || ls('apepe_resv');
    var SOL  = bueno(P.get('sol'))  || ls('apepe_sol');
    var esApp = P.get('app')==='1' || !!RESV || !!SOL;
    if (!esApp) return;

    var QS = RESV ? ('?resv='+encodeURIComponent(RESV))
           : SOL  ? ('?sol='+encodeURIComponent(SOL)) : '';
    /* a las pantallas que también viven en Sincrético hay que decirles que
       seguimos dentro de la app */
    function ligaApp(base){
      var q = QS ? QS+'&app=1' : '?app=1';
      return base + q;
    }
    function liga(base){ return base + QS; }

    var sede = (function(){
      var g=''; try{ g=localStorage.getItem('apepe_sede')||''; }catch(_){}
      var v=String(P.get('ciudad')||P.get('sede')||g||'').toLowerCase();
      return /pue|chol|atlix|tlax/.test(v) ? 'PUEBLA' : 'CDMX'; })();

    /* --- fuera el chrome de Sincrético --- */
    ['.top', '.franja', '.tabbar', 'footer'].forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        el.style.display = 'none';
      });
    });

    /* --- estilos del marco (prefijo apsh-, para no chocar con sinc.css) --- */
    var css = ''
      + '.apsh-top{position:sticky;top:0;z-index:1200;background:#1E1A16;color:#fff}'
      + '.apsh-in{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:10px 16px}'
      + '.apsh-back{color:#fff;text-decoration:none;font-size:22px;line-height:1;opacity:.9;flex:0 0 auto}'
      + '.apsh-marcafila{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px}'
      + '.apsh-marca{height:34px;width:auto;display:block}'
      + '.apsh-txt{flex:1;min-width:0;line-height:1.15}'
      + '.apsh-nom{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:17px;'
      +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.apsh-lema{font-family:"Lobster Two",cursive;color:#F8BBCB;font-size:14px}'
      + '.apsh-sede{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.08em;color:#8DC8EA;text-transform:uppercase}'
      + '.apsh-franja{height:8px;display:flex}.apsh-franja i{flex:1}'
      + '.apsh-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:1200;background:#FBF7F2;'
      +   'border-top:1px solid #E6DFD6;display:flex;padding:6px 4px calc(6px + env(safe-area-inset-bottom));'
      +   'box-shadow:0 -8px 24px -20px rgba(30,26,22,.5)}'
      + '.apsh-tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;'
      +   'text-decoration:none;color:#6E665C;font-size:10.5px;font-weight:600;padding:5px 0}'
      + '.apsh-tabbar a .ti{height:24px;display:flex;align-items:center;justify-content:center}'
      + '.apsh-tabbar a .ti img{height:24px;width:24px;object-fit:contain;display:block}'
      + '.apsh-tabbar a.on{color:#F2682A}'
      + 'body{padding-bottom:calc(66px + env(safe-area-inset-bottom))!important}';
    var st = document.createElement('style'); st.textContent = css;
    document.head.appendChild(st);

    /* --- header de la APePe --- */
    /* El nombre de la pantalla, no la marca otra vez: el logo ya dice de quién
       es la casa. Se saca del <title> -"Tolantongo · Sincrético"- y si no hay,
       se queda el lema. Igual que en Bienvenida, Vnums o La Cósmica: flecha
       para volver, logo con la sede debajo, y el nombre al lado. */
    function escapa(t){ return String(t==null?'':t).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    /* Ojo: la ficha del tour pone su título DESPUÉS, cuando le llegan los datos.
       Si se lee una sola vez sale «Sincrético», que es el título de fábrica. */
    function delTitulo(){
      var n = String(document.title || '').split(/[·|]/)[0].trim();
      if (!n || /^(sincr[eé]tico|casa pepe)$/i.test(n)) return '';
      return n;
    }
    var nombre = delTitulo() || 'Experiencia';

    var hdr = document.createElement('header');
    hdr.className = 'apsh-top';
    hdr.innerHTML =
      '<div class="apsh-in">'
      +  '<a class="apsh-back" href="'+liga('/apepe/index.html')+'" aria-label="Volver">\u2190</a>'
      +  '<div class="apsh-marcafila">'
      +    '<img class="apsh-marca" src="/img/casapepe/casapepe_blanco.png" alt="Casa Pepe" '
      +      'onerror="this.style.display=\'none\'">'
      +    '<div class="apsh-sede">'+sede+'</div>'
      +  '</div>'
      +  '<div class="apsh-txt"><div class="apsh-nom">'+escapa(nombre)+'</div>'
      +    '<div class="apsh-lema">How to be a Mexican?</div></div>'
      + '</div>'
      + '<div class="apsh-franja"><i style="background:#F2682A"></i><i style="background:#E2188E"></i>'
      +   '<i style="background:#F8BBCB"></i><i style="background:#8DC8EA"></i></div>';
    document.body.insertBefore(hdr, document.body.firstChild);

    /* Y cuando el título cambie, el header se entera. */
    try {
      var caja = hdr.querySelector('.apsh-nom');
      var t = document.querySelector('title');
      if (caja && t && window.MutationObserver) {
        new MutationObserver(function () {
          var n = delTitulo(); if (n) caja.textContent = n;
        }).observe(t, { childList: true, characterData: true, subtree: true });
      }
    } catch (_) {}

    /* --- barra de pestañas de la APePe --- */
    var IMG = '/img/apepe/stickers/';
    /* Modo de acceso recortado: 'publico' (usuario local Pepe GO) o 'colab'
       (colaborador de SoyPepe); vacío = huésped, que lo ve todo.
       Manda la identidad, no el recuerdo: con token de reserva es huésped aunque
       el teléfono guardara otro modo de una visita anterior -a Javi le había
       dejado la app sin Vnums ni Yo-. Un ?modo= en la liga sí manda. */
    var MODO = (function(){ try{
      var m=P.get('modo')||'';
      if(m){ try{ localStorage.setItem('apepe_modo', m); }catch(_){ } return m; }
      if(RESV || SOL){ try{ localStorage.removeItem('apepe_modo'); }catch(_){ } return ''; }
      return localStorage.getItem('apepe_modo')||'';
    }catch(_){ return ''; } })();
    var CAT = {
      inicio: { t:'inicio', label:'Inicio', href:liga('/apepe/index.html'), img:IMG+'hola-perrito.webp', match:['/apepe/index','/apepe/'] },
      pepego: { t:'pepego', label:'Pepe GO!', href:liga('/apepe/challenge.html'), img:IMG+'bellas-artes.webp', match:['/apepe/challenge'] },
      vnums:  { t:'vnums', label:'Vnums', href:liga('/apepe/vnums.html'), img:'/img/apepe/vnum-moneda-128.webp', match:['/apepe/vnums'] },
      exp:    { t:'exp', label:'Experiencias', href:ligaApp('/apepe/experiencias.html'), img:IMG+'blue-demon-a.webp', match:['/apepe/experiencias','/sinc/index','/sinc/exp'] },
      mapa:   { t:'mapa', label:'Mapa', href:ligaApp('/sinc/mapa.html'), img:IMG+'diana-reforma.webp', match:['/sinc/mapa'] },
      yo:     { t:'yo', label:'Yo', href:liga('/apepe/yo.html'), img:IMG+'teotihuacan.webp', match:['/apepe/yo'] }
    };
    var ORDEN = MODO==='publico' ? ['pepego','exp','vnums','mapa']
              : MODO==='colab'  ? ['mapa','pepego','exp']
              : ['inicio','vnums','exp','mapa','yo'];
    var tabs = ORDEN.map(function(k){ return CAT[k]; });
    var ruta = location.pathname.replace(/\.html$/,'');
    var nav = document.createElement('nav');
    nav.className = 'apsh-tabbar';
    nav.innerHTML = tabs.map(function (x) {
      var on = x.match.some(function (m) { return ruta.indexOf(m.replace(/\.html$/,'')) === 0 || ruta === m; });
      return '<a class="' + (on ? 'on' : '') + '" href="' + x.href + '">'
        + '<span class="ti"><img src="' + x.img + '" alt="" '
        + 'onerror="this.replaceWith(document.createTextNode(\'•\'))"></span>' + x.label + '</a>';
    }).join('');
    document.body.appendChild(nav);
    /* El marco cambió la altura útil: que cualquier mapa (Leaflet) recalcule su tamaño. */
    setTimeout(function(){ try{ window.dispatchEvent(new Event('resize')); }catch(_){ } }, 90);
    setTimeout(function(){ try{ window.dispatchEvent(new Event('resize')); }catch(_){ } }, 400);
  } catch (e) { /* el marco nunca debe tumbar la pantalla */ }
})();
