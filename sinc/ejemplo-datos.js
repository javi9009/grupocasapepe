/* ejemplo-datos.js — la productora inventada del ejemplo, en un solo sitio.
 *
 * Javi, 10-oct-2026: una pagina de ejemplo llena, y que las tarjetas abran una
 * ficha de evento ficticia «para que puedan ver como se veria su evento».
 *
 * Lo usan DOS paginas -productora-ejemplo.html y evento-ejemplo.html-, asi que
 * los datos viven aqui y no duplicados: si manana cambia un precio o una fecha,
 * cambia en las dos a la vez.
 *
 * LOS NOMBRES. Javi: «utiliza nombres actualizados de los ateneistas de la
 * juventud». El Ateneo de la Juventud lo fundaron en 1909, en la Ciudad de
 * Mexico, Antonio Caso, Pedro Henriquez Urena, Jose Vasconcelos, Alfonso Reyes,
 * Julio Torri y Martin Luis Guzman, entre otros. Aqui la gente es INVENTADA: lo
 * que se toma prestado es el apellido, como quien hereda un oficio. Nadie real
 * aparece como integrante de una productora que no existe; los de verdad salen
 * en «nuestra historia», contados como lo que fueron.
 */
window.EJEMPLO = (function () {

  var PRODUCTORA = {
    nombre: 'Ateneo Producciones',
    giro: 'Artes escénicas y pensamiento · Ateneo de Virreyes · Centro Histórico',
    bio: 'Programamos el Ateneo de Virreyes como se programaba el de 1909: concierto, taller y lectura en el mismo patio, y la puerta abierta a quien llegue.',
    historia: [
      'Tomamos el nombre del Ateneo de la Juventud, la sociedad que un grupo de jóvenes fundó en la Ciudad de México en 1909: Antonio Caso, Pedro Henríquez Ureña, José Vasconcelos, Alfonso Reyes, Julio Torri, Martín Luis Guzmán. Discutían contra el positivismo que entonces mandaba en la enseñanza, leían a los griegos en voz alta y daban conferencias públicas a las que podía entrar cualquiera. Años después, Vasconcelos fundaría la Secretaría de Educación Pública y abriría las paredes del país a los muralistas y las vitrinas a los artesanos.',
      'No somos aquello, y no lo pretendemos. Lo que copiamos es el método: que la conferencia y el concierto quepan en el mismo programa, que el taller valga tanto como la función, y que entrar no dependa de a quién conozcas.',
      'Llevamos cuatro años programando en el Centro Histórico. Desde 2026 lo hacemos en Izazaga 8, en las salas del Ateneo de Virreyes.'
    ],
    whatsapp: '+52 55 0000 0000 · ejemplo',
    correo: 'hola@ateneoproducciones.mx',
    redes: [['📷', 'Instagram'], ['▶️', 'YouTube'], ['🎧', 'Spotify'], ['🌐', 'Su web']]
  };

  var PROTAS = [
    { n: 'Renata Caso', cara: 'cara-1', rol: 'Dirección escénica',
      de: 'Dirige las lecturas escenificadas. Doce años montando teatro de texto en patios y azoteas del Centro.' },
    { n: 'Mauro Torri', cara: 'cara-2', rol: 'Guitarra y dirección musical',
      de: 'Arma las noches de rock de la Sala Mayor y toca en todas. Antes, quince años de bares de la Roma.' },
    { n: 'Citlali Herrán', cara: 'cara-3', rol: 'Cartonería',
      de: 'Cartonera de oficio y de familia de cartoneros. Da el taller de alebrijes en el patio, con engrudo y papel de estraza.' }
  ];

  var MONTA = [
    { n: 'Bruno Cravioto', cara: 'cara-4', rol: 'Producción', de: 'Montaje, audio y el minuto a minuto de cada función.' },
    { n: 'Paulina Urueta', cara: 'cara-5', rol: 'Programación', de: 'Arma el calendario y pide las salas al Ateneo.' }
  ];

  /* Las fechas se guardan en hora de la Ciudad de México, como en la base. */
  var EVENTOS = [
    {
      clave: 'rock', img: 'rock', nombre: 'Ariel Eléctrico',
      tipo: 'Concierto', sala: 'Sala Mayor', cupo: 180, precio: 380,
      inicio: '2026-10-24T21:00:00-06:00', fin: '2026-10-24T23:50:00-06:00',
      desc: 'Cuatro bandas de la ciudad, una noche. Ariel Eléctrico no es un festival ni un homenaje: es la noche en que la Sala Mayor se queda sin sillas. Abren a las nueve y cierran cuando el Ateneo apaga las luces. Barra abierta de cerveza del Cumbre hasta la medianoche.',
      impacto: 'Las cuatro bandas son de la Ciudad de México y cobran taquilla, no exposición.'
    },
    {
      clave: 'ensayo', img: 'ensayo', nombre: 'El ensayo como conversación',
      tipo: 'Taller · 4 sesiones', sala: 'Aula Reyes', cupo: 18, precio: 1200,
      inicio: '2026-10-29T19:00:00-06:00', fin: '2026-10-29T21:30:00-06:00',
      desc: 'Cuatro miércoles para escribir un ensayo y defenderlo en voz alta. Se lee a Reyes, a Torri y a quien cada quien traiga; se escribe en el aula y se corrige entre todos. No hace falta haber publicado nada: hace falta tener algo que discutir. Dieciocho lugares, ni uno más.',
      impacto: 'Dos de los dieciocho lugares son becados, para estudiantes de preparatoria pública del Centro.'
    },
    {
      clave: 'alebrijes', img: 'alebrijes', nombre: 'Bestiario de papel',
      tipo: 'Taller de alebrijes', sala: 'Patio del Ateneo', cupo: 24, precio: 450,
      inicio: '2026-11-08T11:00:00-06:00', fin: '2026-11-08T15:00:00-06:00',
      desc: 'Cuatro horas en el patio, con engrudo hasta los codos. Se arma la estructura con alambre y carrizo, se forra con papel de estraza y se pinta. Cada quien se lleva su bestia a casa. Lo da Citlali Herrán, cartonera de tercera generación. El material va incluido; la ropa que te importe, déjala en casa.',
      impacto: 'El papel es de reúso y el material lo surten tres talleres de cartonería del barrio.'
    },
    {
      clave: 'teatro', img: 'teatro', nombre: 'El Banquete',
      tipo: 'Lectura escenificada', sala: 'Foro Caso', cupo: 90, precio: 260,
      inicio: '2026-11-13T20:00:00-06:00', fin: '2026-11-13T21:40:00-06:00',
      desc: 'Seis personas a la mesa, seis discursos sobre el amor. El diálogo de Platón leído en escena, sin vestuario y sin cuarta pared, en la traducción que se trabajó en el taller del Ateneo. Dura hora y cuarenta sin intermedio. Al final hay vino y se sigue discutiendo, que de eso iba.',
      impacto: 'La función de los jueves tiene veinte lugares a precio de estudiante.'
    },
    {
      clave: 'congreso', img: 'congreso', nombre: 'Turismo y Tecnología',
      tipo: 'Congreso · dos días', sala: 'Izazaga 8', cupo: 220, precio: 2400,
      inicio: '2026-11-19T09:00:00-06:00', fin: '2026-11-20T19:00:00-06:00',
      desc: 'Dos días sobre lo que la tecnología le está haciendo al oficio de recibir: reservas, datos, precios y el trato con el huésped. Mesas por la mañana y talleres por la tarde, con gente de hotelería, de plataformas y de las comunidades que reciben. Incluye comida los dos días y el acceso a las grabaciones.',
      impacto: 'Una de cada diez entradas se reserva para cooperativas comunitarias de hospedaje.'
    }
  ];

  var PASADOS = [
    { img: 'gal-4', nombre: 'Noche de décimas',          cd: 'septiembre de 2026 · Patio del Ateneo' },
    { img: 'teatro', nombre: 'Antígona, lectura',        cd: 'agosto de 2026 · Foro Caso' },
    { img: 'gal-6', nombre: 'Cineclub: muro y pantalla', cd: 'julio de 2026 · Sala Mayor' },
    { img: 'gal-3', nombre: 'Feria del libro viejo',     cd: 'junio de 2026 · Izazaga 8' }
  ];

  var GALERIA = [
    { img: 'gal-1', pie: 'Casa Talavera, a la vuelta de Izazaga.' },
    { img: 'gal-2', pie: 'El taller de ensayo, cuarta sesión.' },
    { img: 'gal-3', pie: 'Nuestro alebrije, en el desfile de Reforma.' },
    { img: 'gal-4', pie: 'El patio lleno un jueves cualquiera.' },
    { img: 'gal-5', pie: 'El claustro, antes de montar.' },
    { img: 'patio', pie: 'El patio del Ateneo, vacío a las ocho.' },
    { img: 'gal-6', pie: 'La última noche de la temporada.' }
  ];

  function money(n) { return n === 0 ? 'Gratis' : '$' + Number(n).toLocaleString('es-MX'); }

  /* La hora, siempre la de la Ciudad de México: el evento pasa ahí, no donde
     esté el teléfono de quien lo lee. Es la misma función que la ficha de
     verdad, y aquí ADEMÁS se calcula la etiqueta de la tarjeta, en vez de
     escribirla a mano: un cartel que diga «vie 24» junto a una ficha que diga
     «sábado 24» es justo el detalle que tira la ilusión. */
  function cuandoMx(iso, conHora, largo) {
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var o = { timeZone: 'America/Mexico_City', weekday: largo ? 'long' : 'short',
              day: 'numeric', month: largo ? 'long' : 'short' };
    if (conHora) { o.hour = '2-digit'; o.minute = '2-digit'; o.hour12 = false; }
    return new Intl.DateTimeFormat('es-MX', o).format(d).replace(/\.$/, '');
  }
  function de(clave) {
    for (var i = 0; i < EVENTOS.length; i++) if (EVENTOS[i].clave === clave) return EVENTOS[i];
    return EVENTOS[0];
  }

  /* El credito de cada foto. Las CC-BY lo EXIGEN, y las CC0 no lo exigen pero
     tampoco cuesta nada. Sale al pie de las dos páginas. */
  var FOTOS = {
    'portada':  ['Anthony Delanoix', 'CC0', 'https://stocksnap.io/photo/crowd-people-1BYTYOHULR'],
    'cara-1':   ['Kristin Hardwick', 'CC0', 'https://stocksnap.io/'],
    'cara-2':   ['Forrest Cavale', 'CC0', 'https://stocksnap.io/'],
    'cara-3':   ['Candace McDaniel', 'CC0', 'https://stocksnap.io/'],
    'cara-4':   ['Matt Moloney', 'CC0', 'https://stocksnap.io/'],
    'cara-5':   ['Candace McDaniel', 'CC0', 'https://stocksnap.io/'],
    'patio':    ['ikarusmedia', 'CC BY 2.0', 'https://www.flickr.com/photos/32650580@N06/27320432007'],
    'rock':     ['Marc-Antoine Dépelteau', 'CC0', 'https://stocksnap.io/photo/concert-stage-P7JJ4LKNK8'],
    'ensayo':   ['Ylanite Koppens', 'CC0', 'https://stocksnap.io/photo/write-desk-JMVRBGMXZY'],
    'alebrijes':['Secretaría de Cultura CDMX', 'CC BY 2.0', 'https://www.flickr.com/photos/113756879@N03/43637306950'],
    'teatro':   ['Nilo Velez', 'CC0', 'https://wordpress.org/photos/photo/445678e173/'],
    'congreso': ['Nilo Velez', 'CC0', 'https://wordpress.org/photos/photo/4206796198/'],
    'gal-1':    ['saguayo', 'CC BY 2.0', 'https://www.flickr.com/photos/94187100@N00/189548270'],
    'gal-2':    ['Green Chameleon', 'CC0', 'https://stocksnap.io/photo/writing-drawing-8Y0EDX4VP9'],
    'gal-3':    ['Secretaría de Cultura CDMX', 'CC BY 2.0', 'https://www.flickr.com/photos/113756879@N03/48950657756'],
    'gal-4':    ['Rawpixel', 'CC0', 'https://www.rawpixel.com/image/3294002'],
    'gal-5':    ['ikarusmedia', 'CC BY 2.0', 'https://www.flickr.com/photos/32650580@N06/46001683382'],
    'gal-6':    ['Rawpixel', 'CC0', 'https://www.rawpixel.com/image/3337444']
  };

  function creditos() {
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var vistos = [], filas = [];
    for (var k in FOTOS) {
      var f = FOTOS[k], id = f[0] + '|' + f[1];
      if (vistos.indexOf(id) >= 0) continue;
      vistos.push(id);
      filas.push('<a href="' + esc(f[2]) + '" target="_blank" rel="noopener nofollow">' +
        esc(f[0]) + '</a> (' + esc(f[1]) + ')');
    }
    return 'Fotos de ' + filas.join(' · ') + '.<br>' +
      'Los retratos son fotos de archivo: quienes aparecen no tienen relación con esta página ' +
      'ni con los nombres inventados que la acompañan.';
  }

  return { PRODUCTORA: PRODUCTORA, PROTAS: PROTAS, MONTA: MONTA, EVENTOS: EVENTOS,
           PASADOS: PASADOS, GALERIA: GALERIA, FOTOS: FOTOS,
           money: money, de: de, creditos: creditos, cuandoMx: cuandoMx };
})();
