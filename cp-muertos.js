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
  /* Javi, 18-oct-2026: «arranca desde hoy, ya es temporada». La ventana
     empieza el 18 en vez del 24; el cierre sigue siendo el 3 de noviembre. */
  var DESDE = '10-18', HASTA = '11-03';

  function hoyCDMX(){
    try{
      return new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'});
    }catch(_){ return new Date().toISOString().slice(0,10); }
  }
  function esTemporada(){
    var md = hoyCDMX().slice(5);          /* MM-DD */
    /* La ventana vive dentro del mismo año (24-oct → 3-nov), así que es un
       Y, no un O. Con el O que escribí primero, '12-25' >= '10-24' daba
       cierto y la temporada se quedaba encendida en Navidad y el resto
       del año. Lo cazó la prueba de fechas, no la pantalla. */
    return md >= DESDE && md <= HASTA;
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

  /* UNA SOLA CABECERA. El lema se mete DENTRO de la que la app ya tiene,
     en medio, entre el saludo y el conmutador de idioma; la cabecera se
     tiñe de cempasúchil y el papel picado cuelga de su filo de abajo, una
     sola vez. Si la app no tiene cabecera, el lema va suelto arriba. */
  function cabecera(){
    return document.querySelector('header.top') ||
           document.querySelector('header') ||
           document.querySelector('.top');
  }
  function cartelHTML(){
    return 'Amor <span class="dm-flor" aria-hidden="true">&#10048;</span> ir venimos';
  }
  function tira(){
    if(document.getElementById('dmCartel')) return;
    var cab = cabecera();
    var c = document.createElement('div');
    c.className = 'dm-cartel'; c.id = 'dmCartel';
    c.innerHTML = cartelHTML();

    if(!cab){
      c.style.background = 'var(--dm-cempa-hondo)';
      c.style.padding = '10px 14px';
      document.body.insertBefore(c, document.body.firstChild);
      return;
    }

    cab.classList.add('dm-cab-tenida');

    /* en medio: detrás del bloque del saludo y delante de lo que haya a la
       derecha (campanita, ES/EN). Si la fila no existe, al final de la
       cabecera, que sigue siendo dentro y no encima. */
    var fila = cab.querySelector('.in') || cab.firstElementChild;
    var izq  = fila && (fila.querySelector('.izq') || fila.children[0]);
    if(izq && izq.parentNode) izq.parentNode.insertBefore(c, izq.nextSibling);
    else (fila || cab).appendChild(c);

    /* EL SALUDO SE ACORTA. Javi: «quita el Casa Pepe de Bienvenido» — el
       logo ya lo dice, y en temporada ese sitio lo necesita el lema. */
    var bienv = cab.querySelector('.bienv');
    if(bienv){
      var t = bienv.textContent.replace(/\s+a\s+casa\s+pepe\s*$/i,'')
                               .replace(/\s+to\s+casa\s+pepe\s*$/i,'');
      if(t.trim()) bienv.textContent = t.trim();
    }

    var picado = document.createElement('div');
    picado.className = 'dm-picado dm-filo';
    picado.setAttribute('aria-hidden','true');
    cab.appendChild(picado);
  }

  /* La puerta a la colección. La app dice dónde con <div id="dmColeccion">;
     si no lo dice, cae debajo de la primera fila de atajos. */
  function llamada(){
    if(modo !== 'completa') return;
    if(document.getElementById('dmLlamada')) return;
    var hueco = document.getElementById('dmColeccion');
    if(!hueco){
      var ref = document.querySelector('.wrap nav, .wrap .bolitas, main nav');
      if(!ref) return;
      hueco = document.createElement('div');
      ref.parentNode.insertBefore(hueco, ref.nextSibling);
    }
    var a = document.createElement('a');
    a.className = 'dm-llamada'; a.id = 'dmLlamada';
    a.href = '/sinc/muertos.html';
    a.innerHTML =
      '<span class="dm-tx"><b>Vive el D\u00eda de Muertos</b>'+
      '<small>Los desfiles, las catrinas, los alebrijes y una noche que no se '+
      'parece a ninguna otra del a\u00f1o.</small>'+
      '<span class="dm-boton">Ver la colecci\u00f3n</span></span>';
    hueco.appendChild(a);
  }

  function arranca(){ tira(); llamada(); }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
