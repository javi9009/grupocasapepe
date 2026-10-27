/* grupo-i18n.js — el español y el inglés de la web pública del Grupo.
 *
 * Javi, 27-oct-2026: «traduce todas las páginas que se han estado creando,
 * todo lo que está de cara al cliente». Esta landing y su pantalla de accesos
 * eran las dos únicas páginas públicas del Grupo que no tenían ni conmutador
 * ni diccionario: se compartían por WhatsApp y llegaban en español a quien
 * fuera.
 *
 * POR QUÉ NO HAY data-i18n EN EL HTML.
 * El resto de la casa marca cada elemento a mano (data-i18n en APePe y en
 * Sincrético). Aquí no: son doscientos textos en una sola página larga, y
 * marcarlos uno por uno habría dejado el HTML lleno de atributos y, sobre
 * todo, habría dejado fuera el primero que se añada mañana sin acordarse de
 * marcarlo. Así que se traduce por NODO DE TEXTO: se recorre la página, se
 * busca lo que dice cada nodo en el diccionario y, si está, se cambia.
 *
 * La llave es la frase en español con los espacios normalizados —un espacio
 * donde el HTML tenga saltos de línea y sangrías—, así que el diccionario no
 * se rompe cuando alguien reindenta el HTML. Y lo que no esté traducido sale
 * en español, nunca en blanco.
 *
 * Qué NO se traduce, a propósito: los nombres propios de la casa (Casa Pepe,
 * Sincrético, Ateneo de Virreyes, La Cósmica, Pepe GO!, PepeQuiz, App Huésped,
 * Concierge&OP), los nombres de lugar y de comunidad (Potrero de la Palmita,
 * San Juan Raya, Sonideras del Vinyl, Mi Valedor) y las palabras que ya viajan
 * solas en inglés —alebrije, wixárika, pulquería, sonidera, ateneísta—. No
 * tienen entrada en el diccionario y por eso se quedan como están.
 */
(function () {
  'use strict';
  if (window.__grupoI18n) return;
  window.__grupoI18n = true;

  var VIVOS = ['es', 'en'];

  function lee() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (VIVOS.indexOf(q) >= 0) return q;
    } catch (_) {}
    /* Las mismas llaves que ya usan APePe y Sincrético: quien puso la app en
       inglés no tiene que volver a decirlo aquí. */
    try {
      var ks = ['grupo_idioma', 'sinc_idioma', 'apepe_lang', 'apepe_ckin_lang'];
      for (var i = 0; i < ks.length; i++) {
        var v = localStorage.getItem(ks[i]);
        if (VIVOS.indexOf(v) >= 0) return v;
      }
    } catch (_) {}
    try { return (navigator.language || '').slice(0, 2) === 'es' ? 'es' : 'en'; } catch (_) {}
    return 'es';
  }

  function pon(l) {
    try {
      localStorage.setItem('grupo_idioma', l);
      localStorage.setItem('sinc_idioma', l);
      localStorage.setItem('apepe_lang', l);
    } catch (_) {}
    var u;
    try { u = new URL(location.href); u.searchParams.set('lang', l); location.replace(u.toString()); }
    catch (_) { location.reload(); }
  }

  var LANG = lee();
  try { document.documentElement.lang = LANG; } catch (_) {}

  /* ------------------------------------------------------------------ */
  /* EL DICCIONARIO                                                      */
  /* ------------------------------------------------------------------ */
  var EN = {
    /* --- cabecera y navegación --- */
    'Grupo Casa Pepe · Turismo en comunidad': 'Grupo Casa Pepe · Tourism in community',
    'Web prueba de concepto': 'Proof-of-concept site',
    'no publicable': 'not for publication',
    'Web prueba de concepto · no publicable': 'Proof-of-concept site · not for publication',
    'Qué hacemos': 'What we do',
    'El modelo': 'The model',
    'Las tres marcas': 'The three brands',
    'Comunidades': 'Communities',
    'Quién lo lleva': 'Who runs it',
    'Entrar': 'Sign in',

    /* --- portada --- */
    'Turismo en comunidad': 'Tourism in community',
    '«El turismo como un diálogo entre culturas.»': '«Tourism as a dialogue between cultures.»',
    'Qué es el turismo en comunidad': 'What tourism in community is',
    'Con quién trabajamos': 'Who we work with',
    'Nuestro compromiso': 'Our commitment',
    'La industria turística se está redefiniendo para evitar los fenómenos intrínsecos que generan desplazamiento de las comunidades locales, defectos en la derrama económica y falta de diálogo entre anfitriones y visitantes.':
      'The tourism industry is redefining itself to head off the things it produces by its own nature: local communities displaced, money that never reaches the ground, and no dialogue between hosts and visitors.',
    'Casa Pepe lleva 9 años trabajando con viajeros y comunidades locales de México.':
      'Casa Pepe has spent 9 years working with travellers and local communities in Mexico.',
    'Comienza una nueva etapa como': 'A new chapter begins as',
    'Lanzamiento enero 2027': 'Launching January 2027',

    /* --- las cuatro comunidades --- */
    'Artistas': 'Artists',
    'Residencias, foro de música, sala de exposiciones o de ensayo, cine y teatro. Acercamos la oferta artística local al viajero, y el viajero artista al local.':
      'Residencies, a music venue, an exhibition and rehearsal room, cinema and theatre. We bring the local arts to the traveller, and the travelling artist to the locals.',
    'Artesanos': 'Artisans',
    'Cooperativas o familias con oficio propio que preservan las técnicas ancestrales o heredadas de su legado familiar. Su obra también tiene nombre, se comparte en talleres y se vende sin regateos.':
      'Cooperatives and families with a craft of their own, keeping techniques that are ancestral or handed down the family. Their work carries their name too, is shared in workshops and is sold without haggling.',
    'Originarias': 'Indigenous',
    'La distancia a los polos productivos les ha permitido preservar sus tradiciones y su vida. Sin embargo, la voluntad de progreso de las nuevas generaciones ve en el turismo un eje de desarrollo socioeconómico con preservación cultural.':
      'Being far from the industrial centres is what let them keep their traditions, and their way of life. And yet the younger generations, who want to get ahead, see in tourism a way to develop socially and economically while keeping their culture.',
    'De viajeros': 'Of travellers',
    'El buen viajero es el que no desplaza: intercambia cultura con la comunidad local y genera prosperidad económica. Esa es la comunidad que abandera el viaje de paz.':
      'The good traveller is the one who displaces nobody: they trade culture with the local community and leave prosperity behind. That is the community that carries the flag of the journey of peace.',
    'Comunidades de artistas': 'Communities of artists',
    'Comunidades de artesanos': 'Communities of artisans',
    'Comunidades originarias': 'Indigenous communities',
    'Comunidad de viajeros': 'Community of travellers',

    /* --- el modelo --- */
    'Cómo funciona': 'How it works',
    'Modelo de impacto comunitario del turismo del Grupo': 'The Group’s model for the community impact of tourism',
    'El modelo que hemos construido promueve que los viajeros generen impacto económico transparente en la comunidad local, y encuentro entre viajeros y vecinos.':
      'The model we have built gets travellers to leave a transparent economic impact in the local community, and gets travellers and neighbours to meet.',
    'Las paradas del modelo': 'The stops along the model',
    '¿Quién crea?': 'Who creates?',
    'La comunidad': 'The community',
    '¿Dónde crean?': 'Where do they create?',
    'En el Ateneo': 'At the Ateneo',
    '¿Dónde se vende?': 'Where is it sold?',
    'En Sincrético, el concierge del hotel': 'On Sincrético, the hotel’s concierge',
    '¿Dónde se duerme?': 'Where do people sleep?',
    'El hotel / hospedaje': 'The hotel / the lodging',
    '¿Quién lo vende?': 'Who sells it?',
    'El anfitrión': 'The host',
    '¿A quién se vende?': 'Who is it sold to?',
    'A buenos viajeros': 'To good travellers',
    'Artesanos, músicos, artistas, guías, actores.': 'Artisans, musicians, artists, guides, actors.',
    'de cada peso': 'of every peso',
    'Residencias, talleres, foros, coworking.': 'Residencies, workshops, venues, coworking.',
    'Sin ánimo de lucro': 'Not for profit',
    'La plataforma para la generación de intangibles a los hoteles.':
      'The platform that makes intangibles for hotels.',
    'Experiencias': 'Experiences',
    'Tienda de artesanías': 'Craft shop',
    'Reserva de restaurantes': 'Restaurant bookings',
    'Mapa': 'Map',
    'Renta de coworking': 'Coworking rental',
    'Casa Pepe, Barrio Hostel y los hoteles afiliados.': 'Casa Pepe, Barrio Hostel and the affiliated hotels.',
    'El bellboy, el recepcionista, el mesero… todos convierten su tiempo de anfitrionía en una oportunidad para conseguir un ingreso extra.':
      'The bellboy, the receptionist, the waiter — every one of them turns their time as a host into a chance to earn something extra.',
    'Profesionista de la hotelería': 'Hospitality professional',
    'Pagan una vez.': 'They pay once.',
    'Paga el servicio': 'Pays for the service',
    'De cada peso que paga el viajero': 'Of every peso the traveller pays',
    'El reparto, por quién lo cobra': 'The split, by who collects it',
    'La plataforma · Sincrético': 'The platform · Sincrético',
    'Comisiones bancarias': 'Bank fees',
    'Impuestos y tasas': 'Taxes and duties',
    '53,25%': '53.25%',
    '7,10%': '7.10%',
    '3,55%': '3.55%',
    '4,00%': '4.00%',
    '25,00%': '25.00%',
    'La comunidad, 53,25%': 'The community, 53.25%',
    'La plataforma · Sincrético, 7,10%': 'The platform · Sincrético, 7.10%',
    'El hotel / hospedaje, 3,55%': 'The hotel / the lodging, 3.55%',
    'El anfitrión, 7,10%': 'The host, 7.10%',

    /* --- las tres marcas --- */
    'Confort, experiencia y conciencia': 'Comfort, experience and conscience',
    'Contamos con tres operaciones delineadas que se enfocan en los tres grupos de la metodología de las 5 Bs: el confort del hotel que te permite descansar, la información de la experiencia que provoca felicidad y el contacto con la comunidad que genera la sensación de bienestar.':
      'We run three clearly drawn operations, one for each of the three groups in the 5 Bs method: the comfort of the hotel that lets you rest, the knowledge inside the experience that brings happiness, and the contact with the community that brings the feeling of wellbeing.',
    'Fábrica de intangibles': 'A factory of intangibles',
    'Fábrica de intangibles para artistas y artesanos del viaje y la cultura. Espacio de crítica turística y de reflexión del viaje.':
      'A factory of intangibles for the artists and artisans of travel and culture. A place for tourism criticism and for thinking about travel.',
    'José María Izazaga 8 · Centro Histórico, CDMX': 'José María Izazaga 8 · Centro Histórico, Mexico City',
    'Concierge online para viajeros': 'Online concierge for travellers',
    'Concierge online para viajeros, que promueve experiencias y viajeros que buscan dejar un impacto socioeconómico y cultural en la comunidad local.':
      'An online concierge for travellers, backing experiences — and travellers — that set out to leave a social, economic and cultural mark on the local community.',
    'Ciudad de México': 'Mexico City',
    'Ver las experiencias ↗': 'See the experiences ↗',
    'Hotel con vocación de hostal': 'A hotel with the spirit of a hostel',
    'Hotel con vocación de hostal que promueve el encuentro de viajeros en un ambiente humanista.':
      'A hotel with the spirit of a hostel, where travellers meet in a humanist setting.',
    'Ciudad de México · Puebla': 'Mexico City · Puebla',

    /* --- los espacios del Ateneo --- */
    'Ateneo de Virreyes · los espacios': 'Ateneo de Virreyes · the spaces',
    'Cine y teatro': 'Cinema and theatre',
    'El deck de coworking': 'The coworking deck',
    'Las áreas comunes': 'The common areas',
    'Tu lugar de ateneísta': 'Your ateneísta desk',
    'Estudio de podcast': 'Podcast studio',
    'Sala de juntas': 'Meeting room',
    'Cocina comunitaria': 'Community kitchen',
    'Oficinas del piso 1': 'First-floor offices',
    'Sala de cine y teatro del Ateneo': 'The Ateneo’s cinema and theatre',
    'Áreas comunes del Ateneo': 'The Ateneo’s common areas',
    'Puesto de trabajo de ateneísta': 'An ateneísta’s desk',
    'Oficinas privadas del piso 1': 'Private offices on the first floor',

    /* --- las experiencias --- */
    'Sincrético · las experiencias': 'Sincrético · the experiences',
    'Free Walking Tour · Centro': 'Free Walking Tour · Centro',
    'Free Walking Tour · Mercados': 'Free Walking Tour · Markets',
    'Free Walking Tour · Chapultepec': 'Free Walking Tour · Chapultepec',
    'Taller de Alebrijes': 'Alebrije workshop',
    'Mexican Challenge · tortillas a mano': 'Mexican Challenge · tortillas by hand',
    'Caminata por el Centro Histórico': 'A walk through the Centro Histórico',
    'Recorrido por los mercados': 'A walk through the markets',
    'Taller de alebrijes': 'Alebrije workshop',
    'Taller de tortillas hechas a mano': 'Workshop on tortillas made by hand',
    'Caminata por Chapultepec': 'A walk through Chapultepec',
    'Grutas de Tolantongo': 'The Tolantongo caves',

    /* --- habitaciones y espacios de Casa Pepe --- */
    'Casa Pepe · habitaciones y espacios': 'Casa Pepe · rooms and spaces',
    'Habitación Deluxe Queen': 'Deluxe Queen room',
    'AxM Grand Suite · cocineta': 'AxM Grand Suite · kitchenette',
    'La Cósmica · terraza': 'La Cósmica · rooftop',
    'Coworking de huéspedes': 'Guest coworking',
    'Cama compartida mixta de 4': '4-bed mixed dorm',
    'Habitación Superior King': 'Superior King room',
    'Suite Junior King': 'Junior King Suite',
    'Cama compartida mixta de 8': '8-bed mixed dorm',
    'Habitación Deluxe Queen en la Ciudad de México': 'Deluxe Queen room in Mexico City',
    'AxM Grand Suite en la Ciudad de México': 'AxM Grand Suite in Mexico City',
    'Cocineta de la AxM Grand Suite, con ventana octogonal': 'The AxM Grand Suite kitchenette, with its octagonal window',
    'Lobby de Casa Pepe Ciudad de México': 'The lobby of Casa Pepe Mexico City',
    'Terraza de La Cósmica': 'The La Cósmica rooftop',
    'La Cósmica de noche': 'La Cósmica at night',
    'Zona de coworking para huéspedes': 'The coworking area for guests',
    'Dormitorio compartido mixto de cuatro camas': 'Four-bed mixed dorm',
    'Habitación Superior King en Puebla': 'Superior King room in Puebla',
    'Suite Junior King en Puebla': 'Junior King Suite in Puebla',
    'Dormitorio compartido mixto de ocho camas en Puebla': 'Eight-bed mixed dorm in Puebla',
    'Lobby de Casa Pepe Puebla': 'The lobby of Casa Pepe Puebla',
    'La Cósmica, pulquería de Casa Pepe Puebla': 'La Cósmica, the pulquería at Casa Pepe Puebla',

    /* --- las comunidades --- */
    'El enlace con la comunidad': 'The link with the community',
    'El puente al impacto positivo del turismo': 'The bridge to the good that tourism can do',
    'La relación establecida en los últimos 9 años nos permite enfocar esfuerzos y resultados de nuestra actividad en varias comunidades que tienen vocación de hospitalidad.':
      'The relationship built over the last 9 years lets us point the effort — and the results — of what we do at several communities with a calling for hospitality.',
    'Las comunidades': 'The communities',
    'Sierra de Nayarit': 'Sierra de Nayarit',
    'Comunidad wixárika de Potrero de la Palmita': 'Wixárika community of Potrero de la Palmita',
    'Familia Linares · legado de alebrijes': 'The Linares family · the alebrije legacy',
    'Centro Histórico, CDMX': 'Centro Histórico, Mexico City',
    'En conversación': 'In conversation',
    'Comunidades incipientes': 'Communities in the making',
    'Reciben en su territorio, en sus cabañas y en sus términos. Su artesanía se vende con el nombre de cada artesana, y lo que se vende de cada una es lo que cobra cada una.':
      'They host on their own land, in their own cabins and on their own terms. Their craft is sold under each woman’s name, and what each one sells is what each one is paid.',
    'El impacto': 'The impact',
    'mujeres wixárika al frente': 'wixárika women leading it',
    'cabañas en la cooperativa': 'cabins in the cooperative',
    'crecimiento de ingreso por mujer': 'growth in income per woman',
    'MXN donados a la fecha': 'MXN donated to date',
    'Cabañas Tawexikta · tawexikta.com ↗': 'Cabañas Tawexikta · tawexikta.com ↗',
    'La familia que le puso nombre a los alebrijes. Taller, oficio heredado y piezas que salen de sus manos a la habitación del huésped.':
      'The family that gave the alebrijes their name. A workshop, a craft handed down, and pieces that go from their hands to the guest’s room.',
    'Taller en el Ateneo de Virreyes': 'Workshop at the Ateneo de Virreyes',
    'Residencia en el Ateneo de Virreyes': 'Residency at the Ateneo de Virreyes',
    'Tienda online en el concierge Sincrético': 'Online shop in the Sincrético concierge',
    'MXN de derrama al año': 'MXN of local spend a year',
    'El oficio que escribió a mano los muros de la ciudad. Con taller abierto en el Ateneo de Virreyes, de la mano de Óscar Reyes.':
      'The trade that wrote the walls of the city by hand. With an open workshop at the Ateneo de Virreyes, led by Óscar Reyes.',
    'Las siguientes de la lista. Todavía sin acuerdo cerrado, pero ya con mesa.':
      'Next on the list. No agreement closed yet, but the table is already set.',
    '· el barro bruñido': '· burnished clay',
    'Cultura sonidera de la CDMX': 'Mexico City’s sonidera culture',
    'Personas en situación de calle de la CDMX': 'People living on the street in Mexico City',
    'Una mujer wixárika recibe con la mano a una panga de viajeros que llega a la orilla':
      'A wixárika woman reaches out a hand to a boatload of travellers coming ashore',
    'Artesano de la familia Linares sosteniendo dos alebrijes':
      'An artisan of the Linares family holding two alebrijes',
    'Emblema del Taller de Rotulistas y Artistas de la Gráfica Popular y Anexas':
      'The emblem of the Taller de Rotulistas y Artistas de la Gráfica Popular y Anexas',

    /* --- quién lo lleva y pie --- */
    'Liderazgos corporativos': 'Corporate leadership',
    'Fundador y Director': 'Founder and Director',
    'Socio Fundador': 'Founding partner',
    'Socio Consejero': 'Partner and board member',
    'Un viaje, como un libro, comienza con inquietud y termina con melancolía':
      'A journey, like a book, begins in restlessness and ends in melancholy',
    'Si quieres venir, trabajar con nosotros o traer a tu comunidad a la mesa, escríbenos.':
      'If you want to come, to work with us, or to bring your community to the table, write to us.',
    'Escríbenos': 'Write to us',
    'Accesos del grupo': 'Group logins',
    'Accesos': 'Logins',
    'Grupo Casa Pepe · Ciudad de México y Puebla': 'Grupo Casa Pepe · Mexico City and Puebla',

    /* --- las descripciones que se leen al compartir la liga --- */
    'Grupo Casa Pepe · Turismo en comunidad. Hospedaje, cultura y experiencias en la Ciudad de México y Puebla, con comunidades de artistas, artesanos, originarias y de viajeros.':
      'Grupo Casa Pepe · Tourism in community. Lodging, culture and experiences in Mexico City and Puebla, with communities of artists, artisans, indigenous peoples and travellers.',
    'Solo hay dos viajeros. Grupo Casa Pepe fomenta los viajeros de paz.':
      'There are only two kinds of traveller. Grupo Casa Pepe backs the travellers of peace.',

    /* --- entrar.html --- */
    'Entrar · Grupo Casa Pepe': 'Sign in · Grupo Casa Pepe',
    '← Volver a la web': '← Back to the site',
    'Tres puertas, según quién seas. Si no estás seguro, la de la derecha es la de los huéspedes y no hace falta que nadie te mande una liga.':
      'Three doors, depending on who you are. If you are not sure, the one on the right is the guests’ door, and nobody needs to send you a link.',
    'Equipo de casa': 'The house team',
    'El panel del grupo: operación, finanzas, RH, revenue, experiencias y el Ateneo.':
      'The Group’s panel: operations, finance, HR, revenue, experiences and the Ateneo.',
    'Reservas, cuadre y auditoría': 'Bookings, daily close and audit',
    'Touroperadores y experiencias': 'Tour operators and experiences',
    'Socios y gobierno corporativo': 'Partners and corporate governance',
    'Abrir el panel': 'Open the panel',
    '🔒 Hace falta cuenta del grupo.': '🔒 A Group account is required.',
    'Quien trabaja aquí': 'Whoever works here',
    'Tu horario, tus documentos, tus cursos y lo que pasa en tu hotel, en una sola pantalla.':
      'Your shifts, your documents, your courses and what is happening in your hotel, on one screen.',
    'Mi horario y mis documentos': 'My shifts and my documents',
    'PepeQuiz y formación': 'PepeQuiz and training',
    'Incidencias y mantenimiento': 'Issues and maintenance',
    'Entrar a Concierge&OP': 'Sign in to Concierge&OP',
    '🏨 Por ahora, Barrio. Pronto podrás elegir tu hotel al entrar.':
      '🏨 For now, Barrio. Soon you will be able to pick your hotel as you sign in.',
    'Huéspedes y visitantes': 'Guests and visitors',
    'La app del huésped: lo que hay que hacer hoy en la ciudad, tus experiencias y tu llave del edificio.':
      'The guest app: what to do in the city today, your experiences and your key to the building.',
    'Experiencias y reservas': 'Experiences and bookings',
    'Pepe GO!, retos y lotería': 'Pepe GO!, challenges and lotería',
    'Room service y tienda de artesanía': 'Room service and the craft shop',
    'Abrir la App Huésped': 'Open the App Huésped',
    '✨ No hace falta liga ni invitación: entra y ya.': '✨ No link, no invitation: just walk in.',
    '¿Eres touroperador o productora?': 'Are you a tour operator or a producer?',
    'Tu portal se abre con la liga personal que te dimos. Si la perdiste, escríbenos a':
      'Your portal opens with the personal link we gave you. If you have lost it, write to us at',
    'y te la mandamos otra vez.': 'and we will send it again.',
    'Las tres puertas del Grupo Casa Pepe: el panel del equipo, Concierge&OP para quien trabaja aquí, y la App Huésped para quien se hospeda.':
      'The three doors of Grupo Casa Pepe: the team’s panel, Concierge&OP for whoever works here, and the App Huésped for whoever is staying.'
  };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function t(es) {
    var k = norm(es);
    return Object.prototype.hasOwnProperty.call(EN, k) ? EN[k] : null;
  }

  /* ------------------------------------------------------------------ */
  /* EL BARRIDO                                                          */
  /* ------------------------------------------------------------------ */
  var NO_ENTRAR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function nodosDeTexto(raiz) {
    var lista = [];
    try {
      var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || NO_ENTRAR[p.nodeName]) return NodeFilter.FILTER_REJECT;
          return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var n;
      while ((n = w.nextNode())) lista.push(n);
    } catch (_) {}
    return lista;
  }

  var ATRS = ['alt', 'aria-label', 'title', 'placeholder'];
  var METAS = ['description', 'og:description', 'og:title', 'twitter:title',
               'twitter:description', 'og:image:alt'];

  function barre(raiz) {
    if (LANG !== 'en') return;
    var r = raiz || document.body;
    nodosDeTexto(r).forEach(function (n) {
      var v = t(n.nodeValue);
      if (v == null) return;
      /* Se conservan los espacios de los bordes: hay nodos que son media frase
         y van pegados a un <b> o a un número. */
      var s = n.nodeValue;
      n.nodeValue = s.match(/^\s*/)[0] + v + s.match(/\s*$/)[0];
    });
    ATRS.forEach(function (a) {
      try {
        r.querySelectorAll('[' + a + ']').forEach(function (el) {
          var v = t(el.getAttribute(a));
          if (v != null) el.setAttribute(a, v);
        });
      } catch (_) {}
    });
    if (!raiz) {
      try {
        var tit = t(document.title);
        if (tit != null) document.title = tit;
      } catch (_) {}
      METAS.forEach(function (nm) {
        try {
          var el = document.querySelector('meta[name="' + nm + '"]') ||
                   document.querySelector('meta[property="' + nm + '"]');
          if (!el) return;
          var v = t(el.getAttribute('content'));
          if (v != null) el.setAttribute('content', v);
        } catch (_) {}
      });
      try {
        var loc = document.querySelector('meta[property="og:locale"]');
        if (loc) loc.setAttribute('content', 'en_US');
      } catch (_) {}
    }
  }

  /* ------------------------------------------------------------------ */
  /* EL CONMUTADOR                                                       */
  /* ------------------------------------------------------------------ */
  /* El mismo conmutador tiene que verse bien en la barra clara de la landing y
     en la cabecera oscura de la pantalla de accesos, asi que no hereda ni el
     fondo ni el color: borde gris translucido, texto heredado y el verde del
     Grupo para el que esta puesto. */
  var CSS = '.grpIdi{display:inline-flex;border:1px solid rgba(128,122,110,.45);'
    + 'border-radius:999px;overflow:hidden;flex:none;margin-left:6px;vertical-align:middle}'
    + '.grpIdi button{font-family:Oswald,system-ui,sans-serif;font-size:11px;font-weight:600;'
    + 'letter-spacing:.07em;text-transform:uppercase;padding:4px 9px;border:0;cursor:pointer;'
    + 'background:transparent;color:inherit;opacity:.6;line-height:1.5}'
    + '.grpIdi button.on{background:#1D6B4A;color:#fff;opacity:1}'
    + '@media(prefers-reduced-motion:no-preference){.grpIdi button{transition:background .15s}}';

  function conmutador() {
    var donde = document.querySelector('header.barra nav') ||
                document.querySelector('header nav') ||
                document.querySelector('header .in') ||
                document.querySelector('header');
    if (!donde || donde.querySelector('.grpIdi')) return;
    if (!document.getElementById('grpIdiCss')) {
      var st = document.createElement('style');
      st.id = 'grpIdiCss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var caja = document.createElement('span');
    caja.className = 'grpIdi';
    VIVOS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('lang', l);
      b.setAttribute('aria-label', l === 'es' ? 'Español' : 'English');
      b.textContent = l.toUpperCase();
      if (l === LANG) b.className = 'on';
      b.onclick = function () { if (l !== LANG) pon(l); };
      caja.appendChild(b);
    });
    donde.appendChild(caja);
  }

  function arranca() {
    try { conmutador(); } catch (_) {}
    try { barre(); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arranca);
  } else { arranca(); }
  /* La galería y el reparto se pintan desde el JS de la página y pueden llegar
     después: se vuelve a barrer un par de veces en vez de encadenarse a cada
     uno de sus scripts. */
  var n = 0;
  var reloj = setInterval(function () {
    try { conmutador(); barre(); } catch (_) {}
    if (++n > 8) clearInterval(reloj);
  }, 500);

  window.grupoI18n = { idioma: function () { return LANG; }, t: t, barre: barre, pon: pon };
})();
