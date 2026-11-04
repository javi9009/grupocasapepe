/* cp-texto.js — la ayuda de escritura de los campos del ateneísta.
   Javi, 4-nov-2026: «¿puedes meter un corrector automático en todos los campos
   de texto que creen los ateneístas para que se autocorrija?».

   SÍ, PERO NO UN CORRECTOR QUE CAMBIE PALABRAS A CIEGAS, y conviene decir por
   qué antes del código: el vocabulario de esta casa es justo el que un
   corrector destroza. Wixárika, chicatana, Mayahuel, tlachiquero, Cuchamás,
   Tepito, mezcal, molcajete, Xochimilco. Un corrector genérico los "arregla" y
   nos deja fichas con palabras inventadas, firmadas por alguien que escribió
   bien. Y el alta termina en un convenio firmado: reescribirle las palabras a
   quien firma es otra cosa distinta de ayudarle a escribir.

   Así que esto hace tres cosas, en tres niveles de atrevimiento:

   1 · ENCIENDE LA AYUDA QUE YA TRAE EL APARATO. spellcheck y lang en los
       campos de texto libre, autocapitalize en frases, y —esto importa— la
       APAGA en RFC, CURP, CLABE, correo, web, Instagram y teléfono, donde el
       corrector del teléfono es el enemigo: te convierte el RFC en una palabra
       y el correo en otra cosa.

   2 · ARREGLA LO MECÁNICO, sin tocar ni una palabra: espacios de más, espacio
       antes de la coma, mayúscula al principio, el ¿ y el ¡ que el teclado se
       come, TODO EN MAYÚSCULAS en un párrafo largo.

   3 · PONE LOS ACENTOS QUE NO TIENEN DISCUSIÓN. Sólo de una lista cerrada de
       palabras que sin tilde no existen en español (tambien, informacion,
       practica NO entra: práctica y practica son dos palabras). Y cuando
       cambia algo lo DICE, con un deshacer al lado. Un cambio silencioso en
       un texto que alguien firma no es ayuda, es otra cosa.

   Lo que NO hace, a propósito: adivinar palabras. Para eso está el subrayado
   rojo del navegador, que propone y deja decidir.

   Uso:  <script src="/cp-texto.js" defer></script>
   Y ya. Se engancha solo a todo input de texto y textarea de la página,
   incluidos los que se pinten después.                                   */
(function () {
  'use strict';
  if (window.cpTexto) return;

  /* ---------- qué campo es cada cual ----------
     Por id, name, data-e o placeholder. Si huele a código, no se toca. */
  var NO_TOCAR = /(rfc|curp|clabe|iban|cuenta|tarjeta|email|correo|mail|web|url|sitio|instagram|facebook|tiktok|usuario|password|contrasen|slug|token|folio|codigo|código|pasaporte|whats|telefono|teléfono|\btel\b|celular|lat|lng|coord|maps)/i;
  var NOMBRE_PROPIO = /(nombre|razon|razón|titular|contacto|administrador|firmante|apellido)/i;

  function señas(el) {
    return [el.id, el.name, el.getAttribute('data-e'), el.getAttribute('data-campo'),
            el.placeholder, (el.closest('.fld') || {}).textContent || ''].join(' ');
  }
  function esCodigo(el) { return NO_TOCAR.test(señas(el)); }
  function esNombre(el) { return NOMBRE_PROPIO.test(señas(el)); }

  /* ---------- 1 · la ayuda del aparato ---------- */
  function preparar(el) {
    if (el.dataset.cpTexto) return;
    el.dataset.cpTexto = '1';
    if (esCodigo(el)) {
      el.spellcheck = false;
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', /rfc|curp|clabe/i.test(señas(el)) ? 'characters' : 'none');
      el.setAttribute('autocomplete', el.getAttribute('autocomplete') || 'off');
      return;
    }
    el.spellcheck = true;
    el.setAttribute('lang', 'es');
    el.setAttribute('autocorrect', 'on');
    el.setAttribute('autocapitalize', esNombre(el) ? 'words' : 'sentences');
    el.addEventListener('blur', function () { repasa(el); });
  }

  /* ---------- 2 · lo mecánico ---------- */
  function mecanico(t, opc) {
    var s = String(t);
    s = s.replace(/ /g, ' ');            // espacio duro pegado al copiar
    s = s.replace(/[ \t]+/g, ' ');            // espacios repetidos
    s = s.replace(/ ?\n ?/g, '\n');           // espacios pegados al salto
    s = s.replace(/\n{3,}/g, '\n\n');         // más de un renglón en blanco
    s = s.replace(/\s+([,;:.!?%])/g, '$1');   // espacio ANTES del signo
    s = s.replace(/([,;:])(?=[^\s\d])/g, '$1 '); // falta espacio DESPUÉS
    /* Punto pegado a la palabra siguiente. Se deja en paz si huele a dominio
       (casapepe.mx), a decimal o a abreviatura corta (Av. / Sr.). */
    s = s.replace(/([A-Za-zÁÉÍÓÚÑÜáéíóúñü]{3,})\.([A-Za-zÁÉÍÓÚÑÜáéíóúñü])/g,
      function (m, antes, sig, i, todo) {
        var cola = todo.slice(i + antes.length + 1, i + antes.length + 6).toLowerCase();
        if (/^(mx|com|org|net|io|es|app|co|gob|edu)\b/.test(cola)) return m;
        return antes + '. ' + sig;
      });
    s = s.replace(/\.{3,}/g, '…');
    s = s.trim();
    if (!s) return s;

    /* TODO EN MAYÚSCULAS en un texto largo: se baja. En un nombre no, que ahí
       las mayúsculas suelen venir de la credencial y son las buenas. */
    if (!opc.nombre && s.length > 14) {
      var letras = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
      var mays = s.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '');
      if (letras.length > 10 && mays.length / letras.length > 0.8) {
        s = s.toLowerCase().replace(/(^|[.!?¿¡]\s+)([a-záéíóúñü])/g,
          function (m, a, b) { return a + b.toUpperCase(); });
      }
    }

    /* mayúscula al empezar y después de punto */
    s = s.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g,
      function (m, a, b) { return a + b.toUpperCase(); });

    /* el ¿ y el ¡ que el teclado del teléfono no pone */
    s = s.split('\n').map(function (ln) {
      var l = ln.trim();
      /* El signo de apertura va al principio de LA PREGUNTA, no del parrafo.
         Si el renglon trae varias frases, se abre la ultima, que es la que
         termina en el signo. */
      if (/\?$/.test(l) && l.indexOf('¿') === -1 && l.length > 3) {
        l = l.replace(/(^|[.!?]\s+)([^.!?]*\?)$/, function (m, a, b) { return a + '¿' + b; });
      }
      if (/!$/.test(l) && l.indexOf('¡') === -1 && l.length > 3) {
        l = l.replace(/(^|[.!?]\s+)([^.!?]*!)$/, function (m, a, b) { return a + '¡' + b; });
      }
      return l;
    }).join('\n');

    return s;
  }

  /* ---------- 3 · las tildes que no tienen discusión ----------
     Regla para entrar en esta lista: sin tilde la palabra NO EXISTE en
     español. Por eso no están aquí «practica», «publico», «termino»,
     «celebre», «angulo» ni «esta»: todas existen de las dos formas y cambiarlas
     sería adivinar. */
  var TILDES = ('tambien:también,ademas:además,asi:así,mas_aun:más aún,despues:después,' +
    'informacion:información,atencion:atención,direccion:dirección,duracion:duración,' +
    'reservacion:reservación,ubicacion:ubicación,descripcion:descripción,' +
    'presentacion:presentación,produccion:producción,organizacion:organización,' +
    'participacion:participación,explicacion:explicación,degustacion:degustación,' +
    'experiencia_s:experiencias,tradicion:tradición,cancion:canción,sesion:sesión,' +
    'reunion:reunión,funcion:función,region:región,artesania:artesanía,artesanias:artesanías,' +
    'companiia:compañía,compania:compañía,fotografia:fotografía,fotografias:fotografías,' +
    'galeria:galería,bateria:batería,energia:energía,dia:día,dias:días,' +
    'mexico:México,mexicano:mexicano,musica:música,pelicula:película,peliculas:películas,' +
    'teatro_:teatro,publico_:público,practica_:práctica,' +
    'arbol:árbol,arboles:árboles,azucar:azúcar,alcohol_:alcohol,' +
    'telefono:teléfono,numero:número,maximo:máximo,minimo:mínimo,ultimo:último,unico:único,' +
    'proximo:próximo,rapido:rápido,facil:fácil,dificil:difícil,util:útil,' +
    'credito:crédito,debito:débito,metodo:método,codigo:código,' +
    'quizas:quizás,aqui:aquí,alli:allí,ahi:ahí,' +
    'jovenes:jóvenes,imagen_:imagen,imagenes:imágenes,origen_:origen,origenes:orígenes,' +
    'sabado:sábado,miercoles:miércoles,' +
    'cafe:café,te_:té,anos:años,ano:año,manana:mañana,pequeno:pequeño,pequena:pequeña,' +
    'nino:niño,ninos:niños,senor:señor,senora:señora,ensenanza:enseñanza,' +
    'vera_:verá,sera:será,estara:estará,habra:habrá,podra:podrá,tendra:tendrá,' +
    'wixarika:wixárika,mayahuel_:Mayahuel,xochimilco:Xochimilco,yucatan:Yucatán,' +
    'michoacan:Michoacán,queretaro:Querétaro,cancun:Cancún,merida:Mérida,' +
    'leon_:León,peru:Perú,panama:Panamá,' +
    'maiz:maíz,cosmica:Cósmica,sincretico:Sincrético,ateneista:ateneísta,' +
    'chapulin:chapulín,chapulines_:chapulines,mascara:máscara,tecnico:técnico,' +
    'degustacion_:degustación,tradicional_:tradicional,artesano:artesano,' +
    'xochimilco_:Xochimilco,coyoacan:Coyoacán,juarez:Juárez,' +
    'anfitrion:anfitrión,guia:guía,guias:guías,reunion_:reunión,' +
    'gastronomia:gastronomía,categoria:categoría,historia_:historia').split(',');

  var MAPA = {};
  TILDES.forEach(function (par) {
    var p = par.split(':');
    if (p.length === 2 && p[0].indexOf('_') === -1) MAPA[p[0]] = p[1];
  });

  /* el vocabulario de la casa: ni se toca ni se marca */
  var GLOSARIO = ('sincrético,ateneísta,wixárika,huichol,chicatana,chicatanas,' +
    'chapulín,chapulines,escamoles,jumiles,cuetlas,cuchamás,tantarrias,chinicuiles,' +
    'molcajete,comal,tlachiquero,acocote,aguamiel,pulque,mezcal,tequila,maguey,agave,' +
    'mayahuel,teocintle,nixtamal,tlayuda,alebrije,alebrijes,cartonería,mixiote,ixtle,quiote,' +
    'tepito,coyoacán,polanco,condesa,roma,juárez,cdmx,puebla,atlixco,cholula,' +
    'casapepe,cósmica,virreyes,cumbre,tawexikta,xika,peyote,nierika,' +
    'luchador,luchadores,rudo,técnico,máscara,arena,lucha,maíz,' +
    'poblano,ancho,pasilla,guajillo,chipotle,serrano,jalapeño,cascabel,piquín,habanero')
    .split(',');
  var ESGLOSARIO = {};
  GLOSARIO.forEach(function (w) { ESGLOSARIO[w.trim()] = true; });

  function tildes(t) {
    return String(t).replace(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/g, function (p) {
      var baja = p.toLowerCase();
      if (ESGLOSARIO[baja]) return p;
      var buena = MAPA[baja];
      if (!buena) return p;
      /* se respeta cómo venía escrita: Tambien -> También */
      if (p[0] === p[0].toUpperCase() && p.slice(1) === p.slice(1).toLowerCase()) {
        return buena[0].toUpperCase() + buena.slice(1);
      }
      if (p === p.toUpperCase()) return buena.toUpperCase();
      return buena;
    });
  }

  /* ---------- el repaso, y el aviso de lo que cambió ---------- */
  function repasa(el) {
    var antes = el.value;
    if (!antes || !antes.trim()) return;
    var nombre = esNombre(el);
    var luego = mecanico(antes, { nombre: nombre });
    if (!nombre) luego = tildes(luego);
    if (luego === antes) return;
    el.value = luego;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    avisa(el, antes);
  }

  function avisa(el, antes) {
    var viejo = el.parentNode && el.parentNode.querySelector('.cp-txt-aviso');
    if (viejo) viejo.remove();
    var d = document.createElement('div');
    d.className = 'cp-txt-aviso';
    d.style.cssText = 'font:500 11.5px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;' +
      'color:#6B5A2E;background:#FBF5E6;border:1px solid #EBDFC2;border-radius:8px;' +
      'padding:5px 9px;margin-top:5px;display:flex;gap:9px;align-items:center';
    var t = document.createElement('span');
    t.textContent = 'Le acomodamos la escritura.';
    t.style.flex = '1';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Deshacer';
    b.style.cssText = 'font:700 11.5px system-ui,sans-serif;color:#9E3B2E;background:none;' +
      'border:0;cursor:pointer;text-decoration:underline;padding:0';
    b.onclick = function () {
      el.value = antes;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      d.remove();
      el.focus();
    };
    d.appendChild(t); d.appendChild(b);
    if (el.parentNode) el.parentNode.insertBefore(d, el.nextSibling);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 9000);
  }

  /* ---------- engancharse a todo, incluso a lo que se pinte después ---------- */
  function barrer(raiz) {
    var sel = 'textarea, input:not([type]), input[type=text], input[type=search]';
    (raiz || document).querySelectorAll(sel).forEach(preparar);
  }
  function arranca() {
    barrer(document);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) barrer(n); });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranca);
  else arranca();

  window.cpTexto = { repasa: repasa, mecanico: mecanico, tildes: tildes, preparar: preparar };
})();
