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

  /* UNA BANDA, SIEMPRE IGUAL, DEBAJO DE LA CABECERA.
     Javi, 19-oct-2026: «¿por qué no diseñas un detalle de Muertos con el mismo
     tamaño para no tener el problema de header y footer?».

     Lo que había antes metía el lema y el papel picado DENTRO de la cabecera
     de cada pantalla. Pero cada pantalla tiene la suya —la portada no se
     parece a la de la tienda ni a la del Pepe GO!— y en cuanto una no encajaba,
     el título se partía en tres líneas y la greca se iba a un lado. Arreglarlo
     pantalla por pantalla es no acabar nunca.

     Así que la temporada deja de meterse en casa ajena: se pone su propia
     banda, de alto fijo, justo debajo de la cabecera. No toca su estructura,
     no compite por el ancho y mide lo mismo en todas partes. Lo único que
     sigue cambiando de la cabecera es el color, que no mueve nada de sitio. */
  function cabecera(){
    return document.querySelector('header.top') ||
           document.querySelector('header') ||
           document.querySelector('.top');
  }
  function cartelHTML(){
    return 'AMOR <span class="dm-flor" aria-hidden="true">&#10048;</span> IR VENIMOS';
  }
  function tira(){
    if(document.getElementById('dmCartel')) return;
    var cab = cabecera();
    /* En SoyPepe, Javi (20-oct-2026): «quita el banner de Amor Ir Venimos en
       todas las pantallas de SoyPepe, deja solo el detalle del papel picado
       naranja». Así que ahí la banda se queda siempre colapsada a su tira de
       papel picado — sin lema, sin teñir la cabecera. En las demás apps
       (portada, tienda, Pepe GO!) el lema sigue igual. */
    var soloPicado = /\/soypepe\//.test(location.pathname);
    var b = document.createElement('div');
    b.className = 'dm-banda' + (soloPicado ? ' dm-solo' : ''); b.id = 'dmCartel';
    b.innerHTML = '<span class="dm-lema">' + cartelHTML() + '</span>';

    /* LA BANDA SE METE DENTRO DE LA CABECERA. Javi, 29-oct-2026: «une el
       detalle de la temporada con el header para que se ahorre espacio y evita
       doble efecto de papel picado; deja el de la galería».
       Iba justo DEBAJO, como bloque aparte, y entre su papel picado y el de la
       vitrina de Muertos había dos grecas a tres dedos de distancia. Ahora el
       lema vive dentro de la cabecera teñida —se lee igual, y el bloque de 46px
       deja de ser un escalón— y su greca se apaga: la única que queda es la de
       la galería. En SoyPepe no cambia nada: ahí la banda es SOLO la greca, y
       esa es justamente la que sí se quiere. */
    if(cab && cab.parentNode){
      if(!soloPicado){
        cab.classList.add('dm-cab-tenida');
        b.className += ' dm-dentro';
        /* Donde hay vitrina de la colección, el lema ya es su título: la banda
           de la cabecera sobra y se marca para que el CSS la apague. Javi,
           29-oct-2026: «ahorrar el espacio donde ahora está el amor ir
           venimos». */
        if(document.getElementById('dmColeccion')) b.className += ' dm-cede';
        cab.appendChild(b);
      }else{
        cab.parentNode.insertBefore(b, cab.nextSibling);
      }
    }else{
      document.body.insertBefore(b, document.body.firstChild);
    }
    if(soloPicado) return;   // solo el papel picado: ni lema arriba ni acortar el saludo

    /* EL LEMA SUBE A LA CABECERA CUANDO HAY SITIO. Javi, 20-oct-2026: «¿no
       puedes poner lo de Amor Ir Venimos arriba, para evitar que el header sea
       tan grande? justo entre el nombre y el idioma».
       Se mete en el hueco libre de la fila, entre el saludo y lo de la
       derecha. Pero no se quita la banda: en pantalla estrecha ahí no cabe y
       partiría la cabecera, que es justo el problema que la banda vino a
       resolver. Así que van los dos y manda el ancho — el CSS encoge la banda
       a su tira de papel picado cuando el lema ya está arriba. */
    try{
      var fila = cab && (cab.querySelector('.in') || cab.querySelector('.apsh-in'));
      if(fila && !fila.querySelector('.dm-lema-cab')){
        var l = document.createElement('span');
        l.className = 'dm-lema-cab';
        l.setAttribute('aria-hidden','true');   /* ya se lee en la banda */
        l.innerHTML = cartelHTML();
        var ultimo = fila.lastElementChild;
        if(ultimo) fila.insertBefore(l, ultimo); else fila.appendChild(l);
      }
    }catch(_){}

    /* EL SALUDO SE ACORTA. Javi: «quita el Casa Pepe de Bienvenido» — el
       logo ya lo dice. Esto sí se puede tocar: es texto, no estructura. */
    var bienv = cab && cab.querySelector('.bienv');
    if(bienv){
      var t = bienv.textContent.replace(/\s+a\s+casa\s+pepe\s*$/i,'')
                               .replace(/\s+to\s+casa\s+pepe\s*$/i,'');
      if(t.trim()) bienv.textContent = t.trim();
    }
  }

  /* ---------- LA VITRINA DE LA COLECCIÓN ----------
     Javi, 19-oct-2026: «en vez del botón pon un carrusel con las tarjetas de
     los tours que van en la colección, y un detalle alrededor del carrusel
     que se sienta especial». El botón mandaba a otra página a ver qué hay;
     la vitrina ya enseña qué hay, con foto, fecha y precio, y el que quiere
     todo sigue teniendo su puerta al final del riel.

     El detalle de alrededor es el mantel de papel de una ofrenda: la franja
     de cempasúchil con el filo calado en arcos arriba y abajo. NO es el
     banderín de la cabecera —es otro papel, otro corte— así que no se
     repite el mismo motivo dos veces en la misma pantalla.

     Si la base no contesta o la colección viene vacía, cae sola a la
     tarjeta-botón de antes: una vitrina sin género es peor que una puerta. */
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var COL = null;                      /* lo que devolvió la colección */

  /* LA TEMPORADA TAMBIÉN TIENE CIUDAD. Javi, 20-oct-2026: «y el Día de Muertos
     de Puebla, no el de CDMX». La colección se pintaba igual en las dos casas,
     así que en Puebla salía el taller de alebrijes del Centro Histórico.
     La sede sale de donde la deja apepe/resv.js; lo que el huésped eligió a
     mano manda, igual que en el resto de la app. */
  function ciudadDeAqui(){
    var v = '';
    try {
      var p = new URLSearchParams(location.search);
      v = p.get('ciudad') || p.get('sede') ||
          localStorage.getItem('apepe_sede_elegida') ||
          localStorage.getItem('apepe_sede') || '';
    } catch(_){}
    return /pue|chol|atlix|tlax/.test(String(v).toLowerCase()) ? 'Puebla' : 'CDMX';
  }

  function esc(t){
    return (t==null?'':String(t)).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
  }
  function money(n){
    return (n==null||n==='') ? null : '$'+Math.round(Number(n)).toLocaleString('es-MX');
  }
  var MESES = {
    es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
        'septiembre','octubre','noviembre','diciembre'],
    en:['January','February','March','April','May','June','July','August',
        'September','October','November','December']
  };
  function dia(f){
    if(!f) return '';
    var p = String(f).split('-');
    return ingles() ? MESES.en[+p[1]-1]+' '+(+p[2]) : (+p[2])+' de '+MESES.es[+p[1]-1];
  }

  function donde(){
    var h = document.getElementById('dmColeccion');
    /* PEGADA AL HEADER, LITERAL. Javi, 29-oct-2026: «quiero que el módulo de la
       galería esté pegado al header literal, que no se vean los bordes del
       fondo». El hueco vivía dentro de .wrap, que tiene 16px a los lados y deja
       el papel de fondo asomando por los costados y por arriba. Sacándolo de
       .wrap y colgándolo justo detrás de la cabecera, la franja de cempasúchil
       arranca donde acaba el naranja y va de borde a borde sin pelear con
       ningún padding. */
    if(h){
      var cab = cabecera();
      if(cab && cab.parentNode && h.previousElementSibling !== cab){
        cab.parentNode.insertBefore(h, cab.nextSibling);
      }
      return h;
    }
    var ref = document.querySelector('.wrap nav, .wrap .bolitas, main nav');
    if(!ref) return null;
    h = document.createElement('div');
    ref.parentNode.insertBefore(h, ref.nextSibling);
    return h;
  }

  function llamada(){
    if(modo !== 'completa') return;
    if(document.getElementById('dmLlamada')) return;
    var h = donde(); if(!h) return;
    var s = document.createElement('section');
    s.id = 'dmLlamada'; s.className = 'dm-vitrina dm-vit-cargando';
    h.appendChild(s);
    fetch(SB+'/rest/v1/v_sinc_coleccion?select=*&coleccion=eq.dia-de-muertos&order=orden.asc',
          {headers:{apikey:KEY, Authorization:'Bearer '+KEY}})
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(L){
        var ciu = ciudadDeAqui();
        /* SIN CIUDAD NO ES CDMX. Aquí también se inventaba: a una ficha sin
           ciudad se le ponía CDMX antes de comparar, igual que hacía la vista.
           Por eso el Walking Tour Panteón, que sale de Casa Pepe Puebla,
           aparecía en la app de CDMX. Javi, 29-oct-2026.
           Si de verdad no se sabe de qué ciudad es, no se enseña en ninguna:
           en la app el huésped la ve y la quiere reservar. */
        COL = (L || []).filter(function(x){ return x.ciudad === ciu; });
        return traduce();
      })
      /* Si la red falla COL se queda en null, y eso significa «no sé», que no
         es lo mismo que «aquí no hay nada»: con null se pinta la puerta de
         siempre; con lista vacía, nada. */
      .catch(function(){ COL = null; })
      .then(function(){ pintaVitrina(); });
  }

  /* EL NOMBRE DEL TOUR TAMBIÉN. 27-oct-2026: mis textos ya hablaban inglés
     —«Live Día de Muertos», «See details»—, pero el nombre y el resumen de
     cada pieza salían de la vista en español, así que un huésped en inglés
     veía mi tarjeta en inglés y dentro «Taller de Alebrijes». La traducción
     vive en la base (tabla i18n) y la aplica sincI18n; la vista trae `tipo`,
     que es lo que dice en qué tabla buscar. Si sincI18n no está en esta
     pantalla, no pasa nada: se queda el español, que es el respaldo. */
  function traduce(){
    try{
      if(!ingles() || !COL || !COL.length) return null;
      if(!(window.sincI18n && sincI18n.aplica && sincI18n.idioma && sincI18n.idioma() !== 'es')) return null;
      var exp = COL.filter(function(x){ return (x.tipo || 'experiencia') === 'experiencia'; });
      var evs = COL.filter(function(x){ return x.tipo === 'evento'; });
      var t = [];
      if(exp.length) t.push(sincI18n.aplica('op_experiencias', exp, {clave:'id'}));
      if(evs.length) t.push(sincI18n.aplica('eventos', evs, {clave:'id', campos:{descripcion:'resumen'}}));
      return Promise.all(t);
    }catch(_){ return null; }
  }

  /* LO VIVIDO NO SE QUEDA EN EL ESCAPARATE. Javi, 29-oct-2026: «cuando ya no
     tengamos más tours en la galería no pongas los pasados, vete recortando».
     Hasta hoy, lo que ya había pasado seguía en la fila, en gris y con un
     «Fue el 25 de octubre» debajo. Al huésped que llega el 29 eso no le sirve
     de nada: le ofrece algo que no puede comprar, y al final de la temporada
     la fila entera era pasado.
     Ahora la fila se encoge sola: primero lo que viene, de lo más próximo a
     lo más lejano, y luego lo que aún no tiene fecha. Cuando no quede nada
     por delante, el bloque desaparece — que es lo mismo que ya hacía una
     colección vacía. La colección completa sigue en /sinc/muertos.html, que
     es donde lo vivido sí tiene sitio. */
  function ordenada(){
    var hoy = hoyCDMX(), prox=[], sin=[];
    (COL||[]).forEach(function(x){
      if(x.proxima)                             prox.push(x);
      else if(!(x.ultima && x.ultima < hoy))    sin.push(x);
    });
    prox.sort(function(a,b){ return a.proxima < b.proxima ? -1 : a.proxima > b.proxima ? 1 : 0; });
    return prox.concat(sin);
  }

  function cuando(x){
    var hoy = hoyCDMX(), en = ingles();
    if(x.proxima) return dia(x.proxima);
    if(x.ultima && x.ultima < hoy) return (en?'Was on ':'Fue el ')+dia(x.ultima);
    return en ? 'Date to be confirmed' : 'Fecha por confirmar';
  }
  function tarjeta(x){
    var hoy = hoyCDMX();
    var ida = !!(x.ultima && x.ultima < hoy && !x.proxima);
    var pr  = money(x.precio);
    return '<a class="dm-tarj'+(ida?' pasada':'')+'" href="'+esc(x.liga||'/sinc/muertos.html')+'">'+
      '<span class="dm-tfoto"'+(x.foto?' style="background-image:url(&quot;'+esc(x.foto)+'&quot;)"':'')+'></span>'+
      '<span class="dm-tcuerpo">'+
        '<span class="dm-tcuando">'+esc(cuando(x))+'</span>'+
        '<h4>'+esc(x.nombre)+'</h4>'+
        /* SIN PRECIO NO SE DICE \u00abentrada libre\u00bb. Cinco de las seis piezas
           vienen sin precio en la base y no todas son gratis: inventarlo le
           miente al hu\u00e9sped. Mientras no tengan precio, la tarjeta invita a
           abrir la ficha, que s\u00ed sabe. */
        '<span class="dm-tpie">'+(pr?esc(pr):(ingles()?'See details':'Ver la ficha'))+'</span>'+
      '</span></a>';
  }

  function pintaVitrina(){
    var s = document.getElementById('dmLlamada'); if(!s) return;
    var en = ingles(), L = ordenada();

    /* Sin género en ESTA ciudad no se pinta nada: ni vitrina, ni puerta a una
       colección que es de la otra casa. Javi, 20-oct-2026: «si no hay nada
       déjalo vacío y mañana lo subimos». */
    if(!L.length){
      if(COL !== null){ s.className=''; s.innerHTML=''; return; }
      s.className = '';                 /* la red falló: la puerta de siempre */
      s.innerHTML = '<a class="dm-llamada" href="/sinc/muertos.html">'+textoLlamada()+'</a>';
      return;
    }
    var flor = '<span class="dm-flor" aria-hidden="true">&#10048;</span>';
    /* EL LEMA ES EL TÍTULO. Javi, 29-oct-2026: «pon el AMOR IR VENIMOS donde
       ahora está el Vive el Día de Muertos». Eran dos renglones diciendo lo
       mismo —la temporada— uno debajo del otro: el lema en su banda bajo la
       cabecera y el título de la vitrina al entrar. Ahora es uno solo, y la
       banda de la cabecera desaparece. */
    s.className = 'dm-vitrina dm-pegada';
    s.innerHTML =
      '<div class="dm-vit-cab">'+
        /* Javi, 29-oct-2026: «quita lo de ver todo». Aquí había dos puertas al
           mismo sitio -el enlace de la cabecera y el cartón del final del
           riel- y la de arriba se leía antes que el lema. Se queda la de
           abajo, que es la que llega empujando el dedo. */
        '<b>'+cartelHTML()+'</b>'+
      '</div>'+
      '<div class="dm-riel">'+
        L.slice(0,8).map(tarjeta).join('')+
        '<a class="dm-tarj dm-tarj-fin" href="/sinc/muertos.html"><span>'+
          (en?'See the whole collection':'Ver la colecci\u00f3n completa')+
        '</span></a>'+
      '</div>';
  }

  /* LO QUE YO ESCRIBO TAMBIÉN HABLA INGLÉS. La app del huésped se conmuta
     entre ES y EN, y mis textos entraban siempre en español: un huésped en
     inglés veía la app traducida y mi tarjeta no. El nombre de la campaña no
     se traduce — AMOR IR VENIMOS es el nombre, no una frase. */
  function ingles(){
    var l = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    return l === 'en';
  }
  function textoLlamada(){
    return ingles()
      ? '<span class="dm-tx"><b>Live D\u00eda de Muertos</b>'+
        '<small>Parades, catrinas and alebrijes.</small></span>'+
        '<span class="dm-boton">See collection</span>'
      : '<span class="dm-tx"><b>Vive el D\u00eda de Muertos</b>'+
        '<small>Desfiles, catrinas y alebrijes.</small></span>'+
        '<span class="dm-boton">Ver colecci\u00f3n</span>';
  }
  /* y se repinta sola cuando el huésped cambia de idioma */
  function vigilaIdioma(){
    if(!window.MutationObserver) return;
    new MutationObserver(function(){
      if(COL !== null) pintaVitrina();
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
  /* NO TODO TIENE ENLACE. Varios atajos de SoyPepe no llevan data-href — unos
     se identifican por su id, otros son «próximamente» y no van a ningún
     sitio— y las cabeceras de área tampoco. Lo único que tienen todos es el
     texto que el Pepe lee, así que el mapa de verdad es por etiqueta. */
  var ETIQUETAS = {
    'check-in hu\u00e9spedes': C+'25-el-castillo.webp',
    'early check-in':      C+'51-el-encuentro.webp',
    'los olvidados':       C+'46-el-cine-de-oro.webp',
    'cobrar':              C+'45-el-pepesero.webp',
    'preg\u00fantale a pepe':  C+'23-los-filosofos.webp',
    'eloy queda':          C+'30-el-kaliman.webp',
    'mis trabajos':        C+'33-el-tlachiquero.webp',
    'la gu\u00eda del gu\u00eda':  C+'24-los-historiadores.webp',
    'salidas del d\u00eda':    '/img/apepe/stickers/hola-perrito.webp',
    'pedidos':             C+'12-los-de-pastor.webp',
    'inventario':          C+'17-los-centzon-totochtin.webp',
    'recibir':             C+'26-el-organillero.webp',
    'mi n\u00f3mina':          C+'20-el-pepe.webp',
    'valoraciones':        C+'48-la-periodista.webp',
    'room audit':          C+'14-el-palacio.webp',
    'mi limpieza':         C+'08-la-llave.webp',
    'gasto de caja':       C+'04-el-juarez.webp',
    'mis vacaciones':      C+'50-la-isla.webp',
    'mi horario':          C+'49-la-jacaranda.webp',
    'mi expediente':       C+'53-el-codice-boturini.webp',
    'firmar':              C+'55-el-madero.webp',
    'mi jefe':             C+'31-el-tata.webp',
    'clases':              C+'47-los-poetas-novohispanos.webp',
    'talleres':            C+'19-el-alebrije.webp',
    'experiencias':        C+'11-el-mariachi.webp',
    'hu\u00e9spedes':          C+'10-la-catrina.webp',
    'ama de llaves':       C+'08-la-llave.webp',
    'mantenimiento':       C+'39-el-arqui.webp',
    'gu\u00edas':              C+'11-el-mariachi.webp',
    'compras y stocks':    C+'42-el-tianguis.webp',
    'restaurante':         C+'34-el-pulque.webp'
  };

  function pinta(hueco, src){
    if(!hueco || hueco.querySelector('img.dm-carta')) return;
    hueco.innerHTML = '<img class="dm-carta" src="'+src+'" alt="" loading="lazy">';
  }
  function limpia(t){
    return (t||'').replace(/[\u203a]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  }
  function porEtiqueta(raiz, sel, selHueco, selTexto){
    Array.prototype.forEach.call(raiz.querySelectorAll(sel), function(el){
      var hueco = el.querySelector(selHueco);
      if(!hueco || hueco.querySelector('img.dm-carta')) return;
      var tx = selTexto ? (el.querySelector(selTexto)||{}).textContent : el.textContent;
      var nom = limpia(tx);
      if(!nom) return;
      if(ETIQUETAS[nom]){ pinta(hueco, ETIQUETAS[nom]); return; }
      for(var k in ETIQUETAS){ if(nom.indexOf(k) >= 0){ pinta(hueco, ETIQUETAS[k]); return; } }
    });
  }
  function cartas(){
    /* primero por ruta, que es lo más exacto */
    Array.prototype.forEach.call(document.querySelectorAll('[data-href],[href]'), function(el){
      var ruta = el.getAttribute('data-href') || el.getAttribute('href') || '';
      var m = /\/((?:soypepe|m)\/[a-z0-9-]+)\.html/.exec(ruta);
      if(!m) return;
      var src = CARTAS[m[1]];
      if(src) pinta(el.querySelector('.b') || el.querySelector('.ic'), src);
    });
    /* y luego por etiqueta, que es lo que cubre al resto */
    porEtiqueta(document, '.circle', '.b', '.t');
    porEtiqueta(document, '.area-h', '.ai', null);
  }
  /* SOYPEPE SE PINTA DESPUÉS DE ENTRAR. Las áreas y la mitad de los atajos no
     existen hasta que carga la sesión y sus permisos, así que una sola pasada
     al cargar dejaba seis emojis sin carta. Se vuelve a pasar cada vez que el
     árbol cambia; pintar es idempotente, así que no cuesta nada. */
  function vigilaCartas(){
    if(!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function(){
      clearTimeout(t); t = setTimeout(cartas, 120);
    }).observe(document.body, {childList:true, subtree:true});
  }

  /* En las apps del equipo (guiño) NO se pintan cartas sobre los iconos: el
     guiño vive solo en la cabecera (tira). Las cartas y su observador quedan
     para las pantallas de huésped (completa), donde sí es la ambientación.
     Javi, 19-oct: "muertos sí, pero la vista del equipo sin calaveras". */
  function arranca(){ tira(); llamada(); vigilaIdioma(); if(modo === 'completa'){ cartas(); vigilaCartas(); } }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
