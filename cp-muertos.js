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
    if(fila) fila.classList.add('dm-fila');
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
    a.innerHTML = textoLlamada();
    hueco.appendChild(a);
  }

  /* LO QUE YO ESCRIBO TAMBIÉN HABLA INGLÉS. La app del huésped se conmuta
     entre ES y EN, y mis textos entraban siempre en español: un huésped en
     inglés veía la app traducida y mi tarjeta no. El nombre de la campaña no
     se traduce — Amor ir venimos es el nombre, no una frase. */
  function ingles(){
    var l = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    return l === 'en';
  }
  function textoLlamada(){
    return ingles()
      ? '<span class="dm-tx"><b>Live D\u00eda de Muertos</b>'+
        '<small>The parades, the catrinas, the alebrijes and a night like no '+
        'other in the year.</small>'+
        '<span class="dm-boton">See the collection</span></span>'
      : '<span class="dm-tx"><b>Vive el D\u00eda de Muertos</b>'+
        '<small>Los desfiles, las catrinas, los alebrijes y una noche que no se '+
        'parece a ninguna otra del a\u00f1o.</small>'+
        '<span class="dm-boton">Ver la colecci\u00f3n</span></span>';
  }
  /* y se reescribe sola cuando el huésped cambia de idioma */
  function vigilaIdioma(){
    if(!window.MutationObserver) return;
    new MutationObserver(function(){
      var a = document.getElementById('dmLlamada');
      if(a) a.innerHTML = textoLlamada();
    }).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  }

  /* ---------- LAS CARTAS DE LA LOTERÍA EN SOYPEPE ----------
     Javi, 18-oct-2026: «podrías poner iconos en SoyPepe de Día de Muertos…
     un catrín, un mariachi catrín… las salidas del día puede ser un xolo».
     No hacen falta iconos nuevos: la casa ya tiene una baraja de lotería
     catrín de 55 cartas, ilustración propia y en esta misma paleta. Durante
     la temporada cada atajo cambia su emoji por su carta; al cerrarse la
     ventana vuelve el emoji solo, porque esto no toca el HTML de nadie.
     Lo que NO entra: bruja, araña, calabaza tallada. Eso es Halloween, y
     esta casa vende lo otro. */
  /* TODOS, NO ALGUNOS. Javi, 18-oct-2026: «consigue más iconos y que todos
     sean de Día de Muertos». Las 55 cartas de la baraja están recortadas en
     /img/muertos/, así que reasignar cualquiera es cambiar una línea de aquí.
     Cada carta se eligió por lo que dice, no por rellenar: Los Olvidados lleva
     El Cine de Oro porque es la película de Buñuel; Cobrar lleva El Pepesero,
     que es el que cobra; Ama de Llaves lleva La Llave. */
  var C = '/img/muertos/';
  var CARTAS = {
    /* huéspedes */
    'm/apepe-recepcion':  C+'25-el-castillo.webp',          /* Check-in */
    'soypepe/cambio-cuarto': C+'51-el-encuentro.webp',      /* Early check-in */
    'soypepe/tanfos':     C+'46-el-cine-de-oro.webp',       /* Los Olvidados */
    'm/vnum-cobrar':      C+'45-el-pepesero.webp',          /* Cobrar */
    'soypepe/extension':  C+'54-la-luna.webp',
    /* oficio y gente */
    'soypepe/procedimientos': C+'23-los-filosofos.webp',    /* Pregúntale a Pepe */
    'soypepe/clases':     C+'47-los-poetas-novohispanos.webp',
    'soypepe/documentos': C+'53-el-codice-boturini.webp',
    'soypepe/nomina':     C+'20-el-pepe.webp',
    'soypepe/mi-jefe':    C+'31-el-tata.webp',
    'soypepe/firmar':     C+'48-la-periodista.webp',
    'soypepe/quiero-ser-pepe': C+'01-los-padres.webp',
    /* mantenimiento */
    'm/eloy':             C+'30-el-kaliman.webp',
    'm/mis-mtto':         C+'33-el-tlachiquero.webp',
    /* guías y experiencias */
    'soypepe/mis-guias':  C+'24-los-historiadores.webp',
    'soypepe/salidas-dia':'/img/apepe/stickers/hola-perrito.webp',  /* el xolo */
    'soypepe/experiencias': C+'11-el-mariachi.webp',
    'soypepe/talleres':   C+'19-el-alebrije.webp',
    /* compras y casa */
    'm/pedidos':          C+'12-los-de-pastor.webp',
    'soypepe/inventario': C+'17-los-centzon-totochtin.webp',
    'soypepe/recibir':    C+'26-el-organillero.webp',
    'soypepe/limpieza':   C+'08-la-llave.webp',
    'soypepe/room-audit': C+'14-el-palacio.webp'
  };
  /* las cabeceras de área no tienen enlace: se reconocen por su nombre */
  var AREAS = {
    'hu\u00e9spedes':      C+'10-la-catrina.webp',
    'ama de llaves':  C+'08-la-llave.webp',
    'mantenimiento':  C+'39-el-arqui.webp',
    'gu\u00edas':          C+'11-el-mariachi.webp',
    'compras y stocks': C+'42-el-tianguis.webp',
    'restaurante':    C+'34-el-pulque.webp',
    'experiencias':   C+'19-el-alebrije.webp'
  };

  function pinta(hueco, src){
    if(!hueco || hueco.querySelector('img.dm-carta')) return;
    hueco.innerHTML = '<img class="dm-carta" src="'+src+'" alt="" loading="lazy">';
  }
  function cartas(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-href],[href]'), function(el){
      var ruta = el.getAttribute('data-href') || el.getAttribute('href') || '';
      var m = /\/((?:soypepe|m)\/[a-z0-9-]+)\.html/.exec(ruta);
      if(!m) return;
      var src = CARTAS[m[1]];
      if(src) pinta(el.querySelector('.b') || el.querySelector('.ic'), src);
    });
    /* cabeceras de área */
    Array.prototype.forEach.call(document.querySelectorAll('.area-h'), function(h){
      var nom = (h.textContent||'').replace(/[\u203a\s]+$/,'').trim().toLowerCase();
      for(var k in AREAS){
        if(nom.indexOf(k) >= 0){ pinta(h.querySelector('.ai'), AREAS[k]); break; }
      }
    });
  }

  function arranca(){ tira(); llamada(); vigilaIdioma(); cartas(); }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
