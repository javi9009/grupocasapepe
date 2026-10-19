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

  /* UNA SOLA CABECERA. La tira se mete dentro de la que la app ya tiene,
     pegada a su filo de abajo. Si la app no tiene cabecera, se pone suelta
     arriba. Lo que nunca hace es apilarse encima de otra: eso es lo que se
     veía como un header doble. */
  function cabecera(){
    return document.querySelector('header.top') ||
           document.querySelector('header') ||
           document.querySelector('.top');
  }
  function tira(){
    if(document.getElementById('dmTira')) return;
    var t = document.createElement('div');
    t.className = 'dm-tira'; t.id = 'dmTira';
    t.innerHTML = '<div class="dm-picado" aria-hidden="true"></div>'+
      '<div class="dm-lema">Amor <span aria-hidden="true">&#10048;</span> ir venimos</div>';
    var cab = cabecera();
    if(cab){
      t.classList.add('dm-en-cabecera');
      /* la franja de colores de la casa cede el sitio: hacen lo mismo */
      var franja = cab.querySelector('.franja');
      if(franja) franja.style.display = 'none';
      cab.appendChild(t);
    } else if(document.body.firstChild){
      document.body.insertBefore(t, document.body.firstChild);
    } else {
      document.body.appendChild(t);
    }
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
    /* El título ya está arriba, en la tira. Repetirlo aquí era decir lo
       mismo dos veces en la misma pantalla; abajo va el botón, que es lo
       único que hace falta. Javi, 19-oct-2026. */
    a.innerHTML =
      '<span class="dm-tx"><b>Ver Colecci\u00f3n D\u00eda de Muertos</b>'+
      '<small>Vive el D\u00eda de Muertos con Casa Pepe.</small></span>'+
      '<span class="dm-fl" aria-hidden="true">&rarr;</span>';
    hueco.appendChild(a);
  }

  function arranca(){ tira(); llamada(); }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
