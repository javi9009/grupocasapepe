/* ============================================================
   AMOR · IR VENIMOS — el interruptor de la temporada de Muertos
   Javi, 19-oct-2026.

   Se cuelga en cualquier pantalla con una línea:

     <script src="/cp-muertos.js" data-modo="completa" defer></script>

   data-modo: "guino" (las pantallas del equipo) o "completa" (las
   del huésped). Si no se pone, guiño.

   LA FECHA MANDA, Y SE MIDE EN CIUDAD DE MÉXICO. Del 24 de octubre
   al 3 de noviembre, inclusive. Fuera de esa ventana este archivo
   no pinta nada y ni siquiera descarga la hoja de estilos: nadie
   tiene que acordarse de quitarlo en diciembre.

   Para probarlo cualquier día del año: ?muertos=1 en la dirección.
   Para apagarlo aunque sea temporada: ?muertos=0.
   ============================================================ */
(function(){
  'use strict';
  var DESDE = '10-24', HASTA = '11-03';

  function hoyCDMX(){
    try{
      return new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'});
    }catch(_){ return new Date().toISOString().slice(0,10); }
  }
  function esTemporada(){
    var md = hoyCDMX().slice(5);          /* MM-DD */
    return md >= DESDE || md <= HASTA;     /* cruza el cambio de mes */
  }
  function forzado(){
    try{ return new URLSearchParams(location.search).get('muertos'); }catch(_){ return null; }
  }

  var f = forzado();
  if(f === '0') return;
  if(f !== '1' && !esTemporada()) return;

  var yo = document.currentScript;
  var modo = (yo && yo.getAttribute('data-modo')) || 'guino';
  if(modo !== 'completa') modo = 'guino';

  function pon(tag, attrs){
    var e = document.createElement(tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    (document.head||document.documentElement).appendChild(e);
    return e;
  }

  document.documentElement.setAttribute('data-muertos', modo);
  pon('link',{rel:'stylesheet', href:'/cp-muertos.css'});
  /* Rye es la letra del cartel. Si Google no carga, cae a Oswald y la
     pantalla sigue entera: la tipografía nunca es el soporte. */
  pon('link',{rel:'preconnect', href:'https://fonts.googleapis.com'});
  pon('link',{rel:'stylesheet',
    href:'https://fonts.googleapis.com/css2?family=Rye&display=swap'});

  /* El guiño es una tira y ya. La completa lleva el cartel entero y la
     puerta a la colección, que es lo único que de verdad hay que vender
     estos diez días. */
  function arranca(){
    if(document.getElementById('dmTira')) return;
    var t = document.createElement('div');
    t.className = 'dm-tira'; t.id = 'dmTira';

    var cartel = modo === 'completa'
      ? '<div class="dm-portada" style="padding:16px 16px 20px">'+
          '<h2 style="font-size:clamp(26px,7vw,38px)">Amor <span class="dm-flor" aria-hidden="true">&#10048;</span> ir venimos</h2>'+
          '<div class="dm-casa">casa pepe</div>'+
          '<a href="/sinc/muertos.html" style="display:inline-block;margin-top:13px;'+
            'font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:12.5px;letter-spacing:.06em;'+
            'text-transform:uppercase;color:#fff;text-decoration:none;border:2px solid rgba(255,255,255,.6);'+
            'border-radius:9px;padding:9px 16px">Ver la Colecci\u00f3n D\u00eda de Muertos</a>'+
        '</div>'
      : '<div class="dm-lema">Amor <span aria-hidden="true">&#10048;</span> ir venimos'+
          '<small>Temporada de Muertos &middot; del 24 de octubre al 3 de noviembre</small></div>';

    t.innerHTML = '<div class="dm-picado" aria-hidden="true"></div>' + cartel;
    if(document.body.firstChild) document.body.insertBefore(t, document.body.firstChild);
    else document.body.appendChild(t);

    /* y el papel picado también abajo, que es como cuelga de verdad */
    if(modo === 'completa'){
      var abajo = document.createElement('div');
      abajo.className = 'dm-picado abajo dm-pie-picado';
      abajo.setAttribute('aria-hidden','true');
      abajo.style.marginTop = '24px';
      document.body.appendChild(abajo);
    }
  }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
