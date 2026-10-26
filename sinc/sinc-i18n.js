/* Sincrético · el idioma del huésped
 * ---------------------------------------------------------------------------
 * Dos cosas, y nada más:
 *
 *   sincI18n.idioma()                   -> 'es' | 'en' | ...
 *   sincI18n.pon('en')                  -> lo fija y lo recuerda
 *   await sincI18n.aplica(tabla, filas) -> reescribe los textos de esas filas
 *
 * La idea: NO hay dos catálogos. La base sigue guardando el español, y las
 * traducciones viven aparte en la tabla i18n. La pantalla carga como siempre
 * -sinc_catalogo, la ficha, lo que sea- y luego, en una sola llamada, se le
 * pisan encima los textos del idioma del huésped. Si esa llamada falla, o si
 * a un campo le falta la traducción, lo que se ve es el español: nunca un
 * hueco. Por eso `aplica` no lanza nunca.
 *
 * Y por eso también añadir francés o alemán no toca una línea de esto: se
 * activa el idioma en i18n_idiomas, corre la función que traduce, y ya.
 *
 * Los nombres propios, las direcciones y los horarios no pasan por aquí: una
 * dirección traducida deja de servir para llegar (ver i18n_campos).
 */
(function(){
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var LLAVE = 'sinc_idioma';

  /* Lo que hay traducido hoy. Se comprueba contra esto para no pedirle a la
     base un idioma que no existe todavía. */
  var VIVOS = ['es','en'];

  var ELEGIDO = null;

  function guardado(){
    try{ var s=localStorage.getItem(LLAVE); return VIVOS.indexOf(s)>=0?s:null; }catch(_){ return null; }
  }

  /* El navegador dice 'en-GB', 'pt-BR', 'zh-Hans-CN'... solo interesa el
     primer trozo.
     Lo importante es lo que se hace con un idioma que todavía no tenemos: un
     holandés o un japonés lee inglés mucho mejor que español, así que cae a
     inglés, no a español. Solo el navegador en español pide español. Al
     principio esto caía a español y un huésped de Ámsterdam veía la pantalla
     entera en un idioma que no habla. */
  function delNavegador(){
    var l = [];
    try{ l = (navigator.languages||[navigator.language||'']).slice(); }catch(_){ l=['']; }
    for(var i=0;i<l.length;i++){
      var c = String(l[i]||'').toLowerCase().split('-')[0];
      if(!c) continue;
      if(VIVOS.indexOf(c)>=0) return c;
      /* Idioma que no tenemos: inglés, que es la lengua franca del viaje. */
      return VIVOS.indexOf('en')>=0 ? 'en' : null;
    }
    return null;
  }

  function resuelve(){
    if(ELEGIDO) return ELEGIDO;
    /* Una URL con ?lang= manda sobre todo: así el concierge puede pasarle al
       huésped un enlace ya en su idioma. */
    try{
      var p = new URLSearchParams(location.search).get('lang');
      if(p){ p=String(p).toLowerCase().split('-')[0];
             if(VIVOS.indexOf(p)>=0){ ELEGIDO=p; recuerda(p); return p; } }
    }catch(_){}
    ELEGIDO = guardado() || delNavegador() || 'es';
    return ELEGIDO;
  }

  function recuerda(l){ try{ localStorage.setItem(LLAVE,l); }catch(_){} }

  function pon(l){
    l = String(l||'').toLowerCase().split('-')[0];
    if(VIVOS.indexOf(l)<0) return resuelve();
    ELEGIDO = l; recuerda(l);
    try{ document.documentElement.lang = l; }catch(_){}
    return l;
  }

  /* Reescribe en sitio los textos de `filas` (array de objetos con .id, o la
     clave que se le diga). Una sola llamada para todas las filas de la
     pantalla, no una por tarjeta. */
  async function aplica(tabla, filas, opc){
    opc = opc || {};
    var idi = opc.idioma || resuelve();
    if(idi==='es' || !filas || !filas.length) return filas;
    var clave = opc.clave || 'id';

    var ids = [];
    for(var i=0;i<filas.length;i++){
      var v = filas[i] && filas[i][clave];
      if(v!=null && ids.indexOf(String(v))<0) ids.push(String(v));
    }
    if(!ids.length) return filas;

    var t;
    try{
      var r = await fetch(SB+'/rest/v1/rpc/i18n_textos',{
        method:'POST',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_tabla:tabla,p_ids:ids,p_idioma:idi})
      });
      if(!r.ok) return filas;          /* se queda el español, que es correcto */
      t = await r.json();
    }catch(_){ return filas; }
    if(!t || !t.length) return filas;

    /* fila_id -> { campo: texto } */
    var mapa = {};
    for(var k=0;k<t.length;k++){
      var f=t[k]; if(!f||!f.texto) continue;
      (mapa[f.fila_id] = mapa[f.fila_id] || {})[f.campo] = f.texto;
    }

    for(var j=0;j<filas.length;j++){
      var fila = filas[j], id = fila && fila[clave];
      var tr = id!=null ? mapa[String(id)] : null;
      if(!tr) continue;
      for(var campo in tr){
        if(!Object.prototype.hasOwnProperty.call(tr,campo)) continue;
        /* La pantalla no siempre llama al campo como la tabla: el escaparate
           sirve la promo pegada a la experiencia y la llama promo_etiqueta.
           `campos` traduce ese nombre. */
        var destino = (opc.campos && opc.campos[campo]) || campo;
        /* Solo se pisa lo que la fila ya traía: si la pantalla no muestra ese
           campo, no se le inventa uno. Y se guarda el español al lado, por si
           alguien quiere enseñar el original. */
        if(fila[destino]===undefined) continue;
        if(fila.__es===undefined) fila.__es={};
        fila.__es[destino]=fila[destino];
        fila[destino]=tr[campo];
      }
      fila.__idioma=idi;
    }
    return filas;
  }

  /* Azúcar para una sola ficha. */
  async function aplicaUna(tabla, fila, opc){
    if(!fila) return fila;
    await aplica(tabla,[fila],opc);
    return fila;
  }

  /* ---- la interfaz ---------------------------------------------------------
     El contenido -los tours- vive en la tabla i18n. Los botones no: son fijos,
     los escribimos nosotros y cambian cuando cambia el front, asi que viven
     aqui, en el codigo, y se despliegan con el.

     La llave de cada cadena es la propia frase en espanol. Suena raro pero
     tiene dos ventajas que valen mas que la elegancia: no hay que inventar
     nombres de llave (y por tanto no hay llaves mal escritas que dejen un
     hueco), y si a una frase le falta la traduccion sale el espanol, que es
     exactamente lo que hace el contenido. Nada de "missing_key_42" en pantalla.

     Un texto solo aparece aqui una vez aunque se use en tres pantallas.      */
  var UI = {
    en: {
      /* cabecera y navegacion */
      'Ciudad de México':'Mexico City',
      'Con borradores':'Including drafts',
      'Entrar':'Sign in',
      'Mi cuenta':'My account',
      'Salir':'Sign out',
      'Limpiar':'Clear',
      'Cerrar':'Close',
      'Anterior':'Previous',
      'Siguiente':'Next',
      'Para ti':'For you',
      'Buscar':'Search',
      'Mapa':'Map',
      'Boletos':'Tickets',
      'Perfil':'Profile',
      '← Portada':'← Home',
      'Portada':'Home',
      'Una empresa de Grupo Casa Pepe':'A Grupo Casa Pepe company',
      'Centro Histórico':'Centro Histórico',

      /* portada */
      'Experiencias para los buenos viajeros':'Experiences for travellers worth having',
      'Busca una experiencia, un barrio…':'Search an experience, a neighbourhood…',
      'Nombre, barrio, quien la opera…':'Name, neighbourhood, who runs it…',
      'Resultados':'Results',
      'Nada con eso':'Nothing for that',
      'Prueba con otra palabra o con otra categoría.':'Try another word, or another category.',
      'Sale hoy':'Leaving today',
      'Sale mañana':'Leaving tomorrow',
      'Ver todo':'See all',
      'Salidas de hoy con lugar libre, a la hora que todavía las alcanzas.':
        'Today’s departures with spots left, at times you can still make.',
      'Lo que sale mañana, para el que ya no llega a lo de hoy.':
        'What leaves tomorrow, for whoever can no longer make today’s.',
      'Los diez de la casa':'Our ten',
      'No es un ranking de ventas: es lo que pondríamos delante si solo pudiéramos enseñarte diez.':
        'Not a sales ranking: it’s what we’d put in front of you if we could only show you ten.',
      'Cómo ser un buen turista':'How to be a good tourist',
      'Los objetivos de ONU Turismo, resumidos en tres. Toca uno y se encienden las experiencias que aportan ahí. Cada una lleva el número del objetivo concreto.':
        'UN Tourism’s goals, boiled down to three. Tap one and the experiences that contribute there light up. Each carries the number of the specific goal.',
      'Eventos con artistas locales':'Events with local artists',
      'Conciertos, funciones y tardeadas en el Ateneo de Virreyes. Los montan productoras de aquí, y el que toca cobra por tocar.':
        'Concerts, shows and afternoon sessions at the Ateneo de Virreyes. Local producers put them on, and whoever plays gets paid to play.',
      'Talleres':'Workshops',
      'Las que se hacen con las manos: el maíz, el barro, la chaquira, el albur.':
        'The ones you do with your hands: corn, clay, beadwork, wordplay.',
      'Todas las experiencias':'All experiences',
      'Filtra por precio, por día y por tipo de plan':'Filter by price, by day and by kind of plan',
      'Ver las experiencias':'See the experiences',
      'elegidas por el equipo':'picked by the team',
      'con impacto medido':'with measured impact',
      'en total · filtra por precio, por día y por tipo':
        'in total · filter by price, by day and by kind',

      /* esperas y errores */
      'Cargando las experiencias…':'Loading the experiences…',
      'Abriendo las experiencias…':'Opening the experiences…',
      'Abriendo la experiencia…':'Opening the experience…',
      'Trayendo el catálogo…':'Fetching the catalogue…',
      'Mirando ese día…':'Checking that day…',
      'No pudimos cargar las experiencias. ':'We couldn’t load the experiences. ',
      'No pudimos cargar el catálogo. ':'We couldn’t load the catalogue. ',
      'Todavía no hay experiencias publicadas.':'No experiences published yet.',
      'La base respondió ':'The database answered ',
      'Falta el enlace de la experiencia.':'The experience link is missing.',
      'No encontramos esta experiencia. Puede que ya no esté a la venta.':
        'We couldn’t find this experience. It may no longer be on sale.',

      /* tarjetas */
      'Ya pasó':'Already gone',
      'desde ':'from ',
      'por persona':'per person',
      'por persona en grupo de':'per person in a group of',
      '¿Qué día?':'Which day?',
      '¿Cuántos van?':'How many of you?',
      'Tu nombre':'Your name',
      'Tu correo':'Your email',
      'Tu teléfono':'Your phone',
      'Pedir esta fecha':'Request this date',
      'Lo que paga el grupo':'What the group pays',
      'por persona · IVA incluido':'per person · tax included',
      'Es un tour privado: van sólo ustedes y el precio es del grupo entero, de':'This is a private tour: just your group, and the price is for the whole group, from',
      'personas.':'people.',
      'Para un grupo de este tamaño te cotizamos a mano. Pídenos la fecha y te escribimos.':'For a group this size we quote by hand. Request the date and we will write to you.',
      'No se cobra nada ahora. Te confirmamos la fecha y el precio queda como está aquí.':'Nothing is charged now. We confirm the date and the price stays as shown here.',
      'Te escribimos para confirmar la fecha. El precio que viste queda guardado con tu solicitud.':'We will write to confirm the date. The price you saw is saved with your request.',
      'Pedida':'Requested',
      'Enviando…':'Sending…',
      'Calculando…':'Calculating…',
      'No se pudo enviar':'Could not send',
      'Fecha a elegir':'Date of your choice',
      'Privados':'Private',
      'Transporte':'Transport',
      'Preficha · aún no se reserva':'Draft · not bookable yet',
      '· sin medir':'· not measured',
      'Todos los días':'Every day',
      'Todavía sin fechas a la venta':'No dates on sale yet',
      'Experiencia':'Experience',
      'Eventos':'Events',
      'máximo ':'max ',
      ' años':' years',
      ' más':' more',

      /* ficha */
      'Cómo transcurre':'How it unfolds',
      'Lo que se come':'What you eat',
      'Con qué te vas':'What you leave with',
      'Qué incluye':'What’s included',
      'Qué llevar':'What to bring',
      'No incluye':'Not included',
      'Duración':'Duration',
      'Días':'Days',
      'Edad mínima':'Minimum age',
      'Grupo mínimo':'Minimum group',
      'Punto de encuentro':'Meeting point',
      'Fin del recorrido':'End of the route',
      'Cancelación':'Cancellation',
      'Hasta cuándo se reserva':'Booking closes',
      'Accesibilidad':'Accessibility',
      'Información importante':'Important information',
      'Condiciones del operador':'Operator’s terms',
      'Quién guía':'Who guides',
      'El recorrido':'The route',
      'Dónde':'Where',
      'Qué deja':'What it leaves behind',
      'Bueno saber':'Good to know',
      'Elige un día':'Pick a day',
      'Elige la hora':'Pick a time',
      'Entra para reservar':'Sign in to book',
      'Reservar':'Book',
      'El punto de encuentro te llega al confirmar.':'The meeting point reaches you on confirmation.',
      'No se cobra nada ahora. Te escribimos para confirmar y cerrar el pago.':
        'Nothing is charged now. We write to you to confirm and settle the payment.',
      'Cancela gratis hasta 24 horas antes.':'Free cancellation up to 24 hours before.',
      'Cancela gratis hasta 48 horas antes.':'Free cancellation up to 48 hours before.',
      'Cancela gratis hasta 72 horas antes.':'Free cancellation up to 72 hours before.',
      'No admite reembolso una vez reservada.':'No refund once booked.',
      'Consúltalo antes de reservar.':'Check before you book.',
      'Puedes reservar hasta la hora de salida.':'You can book up to departure time.',
      'Se reserva hasta 2 horas antes.':'Books up to 2 hours before.',
      'Se reserva hasta 6 horas antes.':'Books up to 6 hours before.',
      'Se reserva hasta el día anterior.':'Books up to the day before.',
      'Se reserva hasta dos días antes.':'Books up to two days before.',
      'Preficha en revisión: la ficha ya está armada pero todavía no se abre a la venta.':
        'Draft under review: the page is built but not open for sale yet.',
      'Nos vemos en ':'We meet at ',
      'Termina en ':'Ends at ',
      'A partir de ':'From ',
      'Adulto':'Adult',
      'Menor':'Child',
      'Personas':'People',

      /* filtros del catalogo */
      'Filtros':'Filters',
      'Quitar todo':'Clear all',
      'Cuándo':'When',
      'Cualquier día':'Any day',
      'Cualquiera':'Any',
      'Hoy':'Today',
      'Mañana':'Tomorrow',
      'Tipo de plan':'Kind of plan',
      'Tipología':'Type',
      'Precio por persona':'Price per person',
      'Como las recomendamos':'As we recommend them',
      'Orden':'Order',
      'Lo que sale antes':'Leaving soonest',
      'Precio: de menor a mayor':'Price: low to high',
      'Precio: de mayor a menor':'Price: high to low',
      'Por nombre':'By name',
      'Nada con esos filtros':'Nothing with those filters',
      'Prueba quitando alguno.':'Try removing one.',
      ' de ':' of ',

      /* impacto / ODS */
      'Desarrollo económico':'Economic development',
      'Declaración de Glasgow: medir, descarbonizar, regenerar.':
        'Glasgow Declaration: measure, decarbonise, regenerate.',
      'El objetivo se declara en el paso Impacto de cada ficha.':
        'The goal is declared in the Impact step of each experience.',
      'Qué son los Objetivos':'What the Goals are',

      /* piezas sueltas que se pegan a un número o a un nombre */
      'y':'and',
      'a':'to',
      'Todo':'All',
      'Hoy':'Today',
      'lugares libres':'spots left',
      'Te atiende':'Looked after by',
      'Sin fechas publicadas':'No dates published',
      'Resultados para':'Results for',
      'Nada para':'Nothing for',

      /* La taxonomía: tipologías y familias. No vive en la tabla i18n porque no
         es una columna, la calculan sinc_tipologia() y sinc_familias() a partir
         de la categoría. Es un conjunto cerrado y corto, así que vive aquí. Si
         mañana aparece una tipología nueva, sale en español hasta que alguien
         la añada: nunca un hueco. */
      'Caminatas':'City walks',
      'Tour a pie':'Walking tour',
      'Talleres y clases':'Workshops and classes',
      'Comer y beber':'Eating and drinking',
      'Arte e historia':'Art and history',
      'Comunidad y raíces':'Community and roots',
      'Naturaleza y aventura':'Nature and adventure',
      'Noche y espectáculo':'Nightlife and shows',
      'Excursiones':'Day trips',
      'Otras experiencias':'Other experiences',
      /* Categorías y subtítulos del escaparate (sinc-vitrina). Las que ya están
         en inglés en la base (Tours, Shows) se leen igual; aquí van las demás. */
      'En el Ateneo de Virreyes':'At the Ateneo de Virreyes',
      /* Javi, 19-oct-2026: «a este apartado llámale Trabajar & ensayar
         (Work & play)». El nombre del sitio decía dónde, no para qué. */
      'Trabajar & ensayar':'Work & play',
      'El Ateneo de Virreyes: coworking por día, salas y estudio de música por horas.':
        'Ateneo de Virreyes: coworking by the day, rooms and a music studio by the hour.',
      'Ven a componer y crear a Virreyes':'Come compose and create at Virreyes',
      'Lo que se ve desde una butaca: conciertos, funciones, lucha.':
        'What you watch from a seat: concerts, shows, lucha libre.',
      /* Javi, 19-oct-2026: «donde pone Shows cámbialo por ¿Quién dijo Fiesta?».
         «Fiesta» se queda en español también en inglés: es la palabra que el
         huésped ya trae aprendida. */
      '¿Quién dijo Fiesta?':'Who said Fiesta?',
      'Conciertos, funciones, lucha y lo que se arma en la terraza.':
        'Concerts, shows, lucha libre and whatever kicks off on the terrace.',
      'Salir a la calle con alguien que la conoce: a pie, en bici o un día entero fuera.':
        'Hit the streets with someone who knows them: on foot, by bike, or a full day out.',
      'Por horas':'By the hour',
      ' la hora':' per hour',
      'Lanzamiento':'Launch',
      'Ver todas':'See all',
      'Todavía no hay nada publicado por aquí.':'Nothing published here yet.',
      'máx ':'max ',
      ' lugares':' seats',
      /* Estas dos familias ya están en inglés en la base; se dejan igual, y en
         español también se leen así. */
      'Deportes':'Sports',
      'salidas':'departures',
      'salida':'departure',
      'experiencia':'experience',
      'experiencias':'experiences',
      'Esta semana':'This week',
      'Hasta':'Up to',
      'Ver':'See',
      'de':'of',

      /* ficha: piezas que se pegan a un nombre o a un numero */
      'De qué va':'What it\u2019s about',
      'Quién te recibe':'Who receives you',
      'Dónde empieza':'Where it starts',
      'Lo que hay que saber':'What you need to know',
      'Desde':'From',
      'Total':'Total',
      'Reservar':'Book',
      'Ver fechas':'See dates',
      'Idiomas':'Languages',
      'Grupo':'Group',
      'Edad':'Age',
      'Mes anterior':'Previous month',
      'Mes siguiente':'Next month',
      'Reservas gestionadas por':'Bookings handled by',
      'Ver con sonido':'Watch with sound',
      'más':'more',
      'Abrir el recorrido en Google Maps':'Open the route in Google Maps',
      ' años.':' years old.',
      'La salida necesita ':'The departure needs ',
      ' personas. Si no se juntan, te avisamos y te devolvemos el importe.':
        ' people. If they don\u2019t come together, we tell you and refund you.',

      /* impacto */
      '¿A dónde va tu dinero?':'Where does your money go?',
      '¿Qué más estás logrando haciendo el tour con nosotros?':
        'What else are you achieving by taking the tour with us?',
      'Lo que pagas':'What you pay',
      'a la comunidad':'to the community',
      'En la empresa que lo opera':'At the company that runs it',
      '% del precio neto':'% of the net price',
      'del neto':'of the net',
      'Precio neto':'Net price',
      'Comunidad':'Community',
      'prestador':'provider',
      'prestadores':'providers',
      'En este tour':'On this tour',
      'Adultos':'Adults',
      'Menores':'Children',
      'Niños':'Children',
      'años':'years',
      'Precio reducido':'Reduced price',
      /* la ficha: la tarjeta del impacto, su hoja y el botón de seguir */
      'se queda en el barrio':'stays in the neighborhood',
      'De lo que pagas, ':'Of what you pay, ',
      ' va a la comunidad':' goes to the community',
      'A dónde va tu dinero':'Where your money goes',
      'Lo que esta experiencia deja en el barrio':
        'What this experience leaves in the neighborhood',
      'Detalle':'Details',
      'Continuar':'Continue',
      /* la pantalla de pago: la liga para volver y la barra del teléfono */
      'Cambiar día, hora o personas':'Change day, time or people',
      'Confirma y paga':'Confirm and pay',
      'Resumen':'Summary',
      'adulto':'adult',
      'adultos':'adults',
      'niño':'child',
      'niños':'children',
      'Ahora no':'Not now',
      'Si le dejas propina, le llega completa.':'If you tip, it reaches them in full.',
      'se quedan en el barrio':'stays in the neighborhood',
      'propina incluida':'tip included',
      'Este boleto está cancelado.':'This ticket has been cancelled.',
      'Por cada ':'For every ',
      'Incluye tu propina de ':'Includes your tip of ',
      ', que va completa a quien te atiende.':', which goes in full to whoever looks after you.',
      'Desliza para pagar':'Slide to pay',
      'Desliza para apartar tu lugar':'Slide to hold your spot',
      'Apartar':'Hold my spot',
      'Hoy. Faltan ':'Today. ',
      ' el día del tour':' left for the day of the tour',
      'Elige tu fecha':'Pick your date',
      'Ver el calendario':'See the calendar',
      'Cerrar el calendario':'Close the calendar',
      'Cerrar':'Close',
      'Todavía no hay fechas abiertas. Escríbenos y te avisamos en cuanto las haya.':
        'No dates are open yet. Write to us and we’ll let you know as soon as there are.',
      'Este tour es por propina para huéspedes. Duermes en la casa, así que no pagas nada: si te gusta, le dejas al guía lo que quieras.':
        'This tour is tip-based for house guests. You sleep here, so you pay nothing: if you enjoy it, tip the guide whatever you like.',
      'Para quien duerme en la casa este tour es por propina. Si te alojas con nosotros, entra con la liga de tu reserva y no pagas nada.':
        'For anyone sleeping at the house this tour is tip-based. If you stay with us, come in through your booking link and you pay nothing.',
      'El cargo de hoy aparta tu lugar; el resto se paga el día del tour.':
        'Today’s charge holds your spot; the rest is paid on the day of the tour.',
      'min antes':'min before',
      'o pick up en tu hotel':'or pick-up at your hotel',
      'c/u':'each',
      'Quedan ':'Only ',
      'lugares':'spots left',
      'Parada':'Stop',
      'Desde ':'From ',

      /* la cuenta: entrar, el código, tus datos */
      'Entra para reservar':'Sign in to book',
      'Tu boleto lleva un QR y te llega por correo: por eso necesitamos saber que el correo es tuyo de verdad. Es una vez y ya.':
        'Your ticket carries a QR code and reaches you by email, so we need to know the address is really yours. Once, and never again.',
      'Continuar con Google':'Continue with Google',
      'o con tu correo':'or with your email',
      'Tu correo':'Your email',
      'Mandarme un código':'Send me a code',
      'Ahora no':'Not now',
      'Con Google no hay que confirmar nada: tu correo ya viene verificado.':
        'With Google there\u2019s nothing to confirm: your email arrives already verified.',
      'Tu boleto lleva un QR y va a tu correo: sin correo confirmado no hay a dónde mandarlo. Con Google no hay que confirmar nada.':
        'Your ticket carries a QR and goes to your email: without a confirmed email there is nowhere to send it. With Google there is nothing to confirm.',
      'Para terminar esta reserva hay que entrar con tu correo. Vuelve a abrir la liga que te dieron.':
        'To finish this booking you need to sign in with your email. Open the link you were given again.',
      'Entrar con Google todavía no está encendido. Usa tu correo, que funciona igual.':
        'Signing in with Google isn\u2019t switched on yet. Use your email, it works just the same.',
      'Ese correo no se ve bien escrito.':'That email doesn\u2019t look right.',
      'Mandando…':'Sending…',
      'Mira tu correo':'Check your email',
      'Mandamos seis cifras a':'We sent six digits to',
      'Vale diez minutos. Si no lo ves, asómate a la carpeta de spam.':
        'Good for ten minutes. If you don\u2019t see it, have a look in your spam folder.',
      'El código':'The code',
      'Confirmar':'Confirm',
      'Usar otro correo':'Use another email',
      'Mandármelo otra vez':'Send it again',
      'Va de nuevo ✓':'On its way ✓',
      'El código son seis cifras.':'The code is six digits.',
      'Comprobando…':'Checking…',
      '¿A nombre de quién?':'In whose name?',
      'Es lo que verá quien te reciba el día del tour.':'It\u2019s what whoever receives you on the day will see.',
      'Nombre y apellido':'First and last name',
      '(por si hay que avisarte algo)':'(in case we need to reach you)',
      'Listo':'Done',
      'Dinos cómo te llamas.':'Tell us your name.',
      'Un momento…':'One moment…',
      'Tu cuenta':'Your account',
      'Con una cuenta guardas tus boletos y no vuelves a escribir tus datos en cada compra.':
        'With an account your tickets are kept and you don\u2019t type your details again on every purchase.',
      'Entraste con Google':'You signed in with Google',
      'Entraste desde tu reserva de Casa Pepe':'You signed in from your Casa Pepe booking',
      'Entraste con tu correo':'You signed in with your email',
      'Mis boletos':'My tickets',
      'Cambiar mi nombre o teléfono':'Change my name or phone',
      'Cerrar sesión':'Sign out',
      'Tus boletos viajan a este correo. Si te equivocaste, cierra sesión y entra con el bueno.':
        'Your tickets travel to this address. If you got it wrong, sign out and sign in with the right one.',
      'Tus datos':'Your details',
      'Guardar':'Save',
      'Guardando…':'Saving…',

      /* pago */
      'Confirmar y pagar':'Confirm and pay',
      'Método de pago':'Payment method',
      'Los datos de tu tarjeta viajan directo a Stripe. Aquí no se guarda ni se ve ningún número.':
        'Your card details go straight to Stripe. Nothing is stored or seen here.',
      'El cobro se abre en la pasarela segura de Stripe y vuelves aquí al terminar.':
        'The charge opens in Stripe\u2019s secure checkout and you come back here when it\u2019s done.',
      'El cobro se hace en la pasarela segura de Stripe.':'The charge is made through Stripe\u2019s secure checkout.',
      'Pagar':'Pay',
      'Transacción segura con':'Secure transaction with',
      'Entradas y complementos':'Tickets and extras',
      'Detalle del precio':'Price breakdown',
      'Antes de pagar':'Before you pay',
      'Volver':'Back',
      'Entra para pagar':'Sign in to pay',
      'Preparando tu compra…':'Preparing your purchase…',
      'Confirmando tu pago…':'Confirming your payment…',
      'No encontramos esta experiencia.':'We couldn\u2019t find this experience.',
      'Entrada adulto':'Adult ticket',
      'Entrada menor':'Child ticket',
      'Cobertura de cancelación':'Cancellation cover',
      'Propina para':'Tip for',
      'recepción':'reception',
      'Subtotal':'Subtotal',
      'Cobertura':'Cover',
      'Propina':'Tip',
      'Gastos de gestión':'Booking fee',
      'Sin gastos':'None',
      'Llega unos minutos antes: el grupo sale a su hora.':
        'Arrive a few minutes early: the group leaves on time.',
      ' años, sin excepciones.':' years old, no exceptions.',
      'Lleva contigo':'Bring with you',
      'Idioma':'Language',
      'Se da en ':'Given in ',
      'Necesita ':'Needs ',
      ' personas. Si no se juntan te avisamos y te devolvemos todo.':
        ' people. If they don\u2019t come together we tell you and refund everything.',
      'No es accesible en silla de ruedas.':'Not wheelchair accessible.',
      'Parcialmente accesible: escríbenos antes y lo vemos.':
        'Partly accessible: write to us beforehand and we\u2019ll sort it out.',
      'He leído y acepto las':'I have read and accept the',
      'condiciones de reserva':'booking terms',
      'y las condiciones propias de':'and the own terms of',
      'la operadora':'the operator',
      'Te atendió':'Looked after by',
      'Hay que aceptar las condiciones de reserva para continuar.':
        'You need to accept the booking terms to continue.',
      'No pudimos abrir el pago':'We couldn\u2019t open the payment',
      'Casi':'Almost',
      'Guarda este folio':'Keep this reference',
      'Tu boleto va en camino a':'Your ticket is on its way to',
      'Lleva un QR por persona: es lo que te deja entrar.':
        'It carries one QR code per person: that\u2019s what gets you in.',
      'El pago está entrando. En cuanto lo confirme el banco te llega el boleto por correo. Si en unos minutos no lo ves, escríbenos con tu folio.':
        'The payment is going through. As soon as the bank confirms it, your ticket arrives by email. If you don\u2019t see it in a few minutes, write to us with your reference.',
      'Ver mi boleto':'See my ticket',
      'Ver más experiencias':'See more experiences',
      'Cancelas gratis hasta 24 horas antes.':'Free cancellation up to 24 hours before.',
      'Cancelas gratis hasta 48 horas antes.':'Free cancellation up to 48 hours before.',
      'Cancelas gratis hasta la hora de salida.':'Free cancellation up to departure time.',

      /* el boleto */
      'Buscando tu boleto…':'Looking for your ticket…',

      /* pedir la devolución desde el boleto */
      '¿Ya no puedes venir?':'Can’t make it any more?',
      'Puedes pedirnos que te lo devolvamos. Aunque tu tarifa no sea reembolsable, lo miramos caso por caso.':
        'You can ask us for a refund. Even if your rate is non-refundable, we look at each case.',
      'Pedir la devolución':'Ask for a refund',
      'Cuéntanos qué pasó':'Tell us what happened',
      'No hace falta que sea largo. Nos ayuda a resolverlo más rápido.':
        'It doesn’t have to be long. It helps us sort it out faster.',
      'Me salió un imprevisto y no voy a llegar…':'Something came up and I won’t make it…',
      'Enviar la solicitud':'Send the request',
      'Enviando…':'Sending…',
      'Tenemos tu solicitud':'We have your request',
      'Vamos a revisar si ya tuvimos que gastar algo por tu reserva —boletos, apartar el lugar, alimentos o la nómina del día—. Si todavía no hemos incurrido en ese gasto, te devolvemos la parte que se pueda liberar. Te escribimos a tu correo en cuanto lo tengamos.':
        'We’ll check whether we already had to spend anything on your booking — tickets, holding the venue, food or the day’s wages. If we haven’t incurred that cost yet, we’ll refund you whatever can still be released. We’ll write to your email as soon as we know.',
      'No pudimos enviarla. Inténtalo otra vez en un momento.':
        'We couldn’t send it. Try again in a moment.',
      'No encontramos ese boleto':'We couldn\u2019t find that ticket',
      'Revisa el enlace del correo, o escríbenos y lo buscamos por tu nombre.':
        'Check the link in the email, or write to us and we\u2019ll look it up by your name.',
      'Persona':'Person',
      'persona':'person',
      'Esta reserva está cancelada':'This booking is cancelled',
      'Si crees que es un error, escríbenos antes de venir.':
        'If you think that\u2019s a mistake, write to us before coming.',
      'Este boleto ya se usó':'This ticket has already been used',
      'Si todavía no has entrado, enséñaselo a quien te recibe.':
        'If you haven\u2019t gone in yet, show it to whoever receives you.',
      'a las':'at',
      'Folio':'Reference',
      'Boleto':'Ticket',
      'Menor':'Child',
      'Adulto':'Adult',
      'Enseña este código al llegar. Si no carga la imagen, sirve leerlo en voz alta: no lleva ni ceros ni oes ni unos ni íes, para que no haya confusión.':
        'Show this code when you arrive. If the image doesn\u2019t load, reading it out loud works: it has no zeros or Os, no ones or Is, so there\u2019s no confusion.',
      'Falta el código':'The code is missing',
      'Abre el enlace que te llegó por correo, o escribe la dirección con tu código al final.':
        'Open the link that reached you by email, or type the address with your code at the end.',
      'No pudimos cargarlo':'We couldn\u2019t load it',
      'Inténtalo de nuevo en un momento.':'Try again in a moment.',

      /* el mapa de lo que hay cerca */
      'qué hay cerca de ti':'what\u2019s near you',
      '¿Dónde andas?':'Where are you?',
      'te decimos qué hay a la vuelta':'we tell you what\u2019s around the corner',
      'Lo que recomendamos de verdad en esta ciudad: dónde comer unos tacos que valgan la pena, dónde tomar algo sin turistas, qué ver antes de irte. Es el mismo mapa que te dimos en papel.':
        'What we actually recommend in this city: where to eat tacos worth eating, where to have a drink without tourists, what to see before you leave. The same map we gave you on paper.',
      '📍 Estoy aquí':'📍 I\u2019m here',
      'o dime la zona:':'or tell us the area:',
      'Tu ubicación no se guarda ni se manda a ningún lado: solo sirve para ordenar la lista.':
        'Your location isn\u2019t saved or sent anywhere: it only sorts the list.',
      'Llévatelo a tu Google Maps':'Take it to your Google Maps',
      'Un toque y te queda guardado en tu Google Maps, con todo y nuestras notas. Sin descargar nada.':
        'One tap and it\u2019s saved in your Google Maps, notes and all. Nothing to download.',
      'aquí mismo':'right here',
      'min a pie':'min on foot',
      'No pudimos cargar las recomendaciones. Vuelve a intentar en un momento.':
        'We couldn\u2019t load the recommendations. Try again in a moment.',
      'Estás aquí':'You are here',
      'Listo: ordenado por lo que tienes más cerca. Tu ubicación no se guarda ni se manda a ningún lado.':
        'Done: sorted by what\u2019s closest to you. Your location isn\u2019t saved or sent anywhere.',
      'Ordenado desde ':'Sorted from ',
      'Si prefieres, dale a «Estoy aquí».':'If you\u2019d rather, tap \u201cI\u2019m here\u201d.',
      'Tu navegador no comparte ubicación. Elige la zona a mano.':
        'Your browser doesn\u2019t share location. Pick the area by hand.',
      'Buscándote…':'Finding you…',
      'donde estás':'where you are',
      'No pudimos ubicarte — quizá el permiso está apagado. Elige la zona a mano.':
        'We couldn\u2019t locate you \u2014 the permission may be off. Pick the area by hand.',
      'lugares':'places',
      'que recomendamos en la ciudad.':'we recommend in the city.',
      'Dinos dónde andas y te los ordenamos por cercanía.':
        'Tell us where you are and we\u2019ll sort them by distance.',
      'Por':'Around',
      'no tenemos nada de eso a menos de media hora andando.':
        'we have none of that within half an hour\u2019s walk.',
      'Prueba con otro antojo o con otra zona.':'Try another craving, or another area.',
      'a un paseo de':'a walk from',
      'del más cercano al más lejos.':'from nearest to furthest.',
      'Ahí cerca había poco, así que abrimos un poco el radio.':
        'There was little right there, so we widened the radius a bit.',
      'Cómo llegar':'How to get there',
      'Reto de':'Challenge from',
      'la casa':'the house',
      'Pasamos por aquí':'We come through here',
      'en':'on',
      'ver la experiencia':'see the experience',
      'Esta todavía no está lista. Prueba con otra.':'This one isn\u2019t ready yet. Try another.',
      'Las cifras de impacto las declara quien opera la experiencia; Sincrético aporta la suya. Es una declaración, no una auditoría.':
        'Impact figures are declared by whoever runs the experience; Sincrético declares its own. It is a declaration, not an audit.',
      'Esto no sale de tu dinero: sale de cómo trabaja quien opera esta experiencia. Al reservar con ellos, lo sostienes.':
        'This doesn\u2019t come out of your money: it comes from how whoever runs this experience works. By booking with them, you keep it going.',
      'Lo declara la empresa que opera el tour, por escrito y bajo protesta de decir verdad, al darse de alta con nosotros. Es una declaración suya, no una auditoría nuestra.':
        'The company that runs the tour declares this in writing and under oath when it signs up with us. It is their declaration, not our audit.',

      /* ---- Fase 1 i18n: llaves que faltaban (pasaban por T sin traducción) ---- */
      /* ficha de experiencia (exp.html) */
      'Al llegar, al operador':'On arrival, to the operator',
      'Ampliar':'Expand',
      'Ver menos':'Show less',
      'Aplican nuestras condiciones generales.':'Our general terms apply.',
      'Cancelar y reservar':'Cancel and book',
      'La letra chica':'The fine print',
      'Nada en especial: ven como estés.':'Nothing special: come as you are.',
      'Nos vemos en':'We meet at',
      'Termina en':'Ends at',
      'Pagas ahora':'You pay now',
      'Propina sugerida':'Suggested tip',
      'propina sugerida':'Suggested tip',
      'Quién puede ir':'Who can come',
      'Reservas tu lugar pagando una parte; el resto lo liquidas el día del tour, directo con ':
        'You book your spot by paying a part; you settle the rest on the day of the tour, directly with ',
      'Salimos con ':'We run with ',
      'Sin requisitos: cualquiera puede venir.':'No requirements: anyone can come.',
      'Tour gratuito: reservas sin pagar y, si te gusta, le dejas al guía la propina que quieras.':
        'Free tour: book without paying and, if you like it, leave your guide whatever tip you want.',
      'su página':'their page',

      /* pago (pago.html) */
      'A nombre de':'In the name of',
      'Pagas ahora con tarjeta':'You pay now by card',
      'Pagar ahora ':'Pay now ',
      'Descuento de':'Discount from',
      'Apartamos para ':'We hold for ',
      'Apartar para ':'Hold for ',
      'El anticipo de ':'The deposit of ',
      ' no se devuelve: es lo que aparta tu lugar.':' is non-refundable: it’s what holds your spot.',
      'Hoy sólo se te cobra esa parte. Los ':'Today you’re only charged that part. The ',
      ' restantes los pagas el día del tour, en mano, directo con ':
        ' remaining you pay on the day of the tour, in cash, directly with ',
      'Entra con tu cuenta':'Sign in with your account',
      'tu cuenta':'your account',
      'El boleto llega a este correo. ¿No eres tú?':'The ticket goes to this email. Not you?',
      'En los tours de cortesía el lugar es para quien duerme en la casa, y tu reserva es de ':
        'On courtesy tours the spot is for whoever stays at the house, and your booking is for ',
      'Es de cortesía para quien duerme en la casa: hasta ':'It’s complimentary for house guests: up to ',
      'Si viene alguien más, escríbenos y lo vemos.':'If anyone else comes, write to us and we’ll sort it out.',
      'Sin costo. Apartas tu lugar y te mandamos el pase.':'Free. You reserve your spot and we send you the pass.',
      'Tu lugar queda apartado a tu nombre':'Your spot is held in your name',
      'Ese código no existe. Pídele otro a quien te lo dio.':'That code doesn’t exist. Ask whoever gave it to you for another.',
      'Ese código ya se usó. Si no fuiste tú, pídele otro a quien te lo dio.':
        'That code has already been used. If it wasn’t you, ask whoever gave it to you for another.',
      'Ese código ya caducó. Pídele otro a quien te lo dio.':'That code has expired. Ask whoever gave it to you for another.',
      '¿Quieres dejarle algo? Le llega completo.':'Want to leave them something? They get all of it.',

      /* mapa (mapa.html) */
      'Foto':'Photo',
      'Llamar':'Call',
      'Éstos son los':'These are the',
      'más cercanos, para que decidas si vale el viaje.':'closest, so you can decide if the trip is worth it.',
      'Nada de eso queda a paseo desde':'None of that is within a walk from',
      'Ábrelo en Pepe GO!':'Open it in Pepe GO!',
      'Reto Pepe GO!':'Pepe GO! Challenge',
      'reseñas':'reviews',
      'En la Guía MICHELIN':'In the MICHELIN Guide',

      /* boleto (boleto.html) */
      'Llevas pendiente de pago ':'You still owe ',
      'Se paga en el punto de encuentro, al empezar, directo con ':'Paid at the meeting point, at the start, directly with ',
      'tu guía':'your guide',
      'Lleva efectivo si puedes.':'Bring cash if you can.',

      /* escaparate: bloque ODS y pie de tarjeta (index.html) */
      'Medioambiente':'Environment',
      'Lo que le queda al barrio: convivencia, patrimonio, grupos pequeños, quién decide y quién cobra. ONU Turismo lo trabaja con las ciudades, y es el terreno del overtourism.':
        'What stays in the neighbourhood: coexistence, heritage, small groups, who decides and who gets paid. UN Tourism works on this with cities, and it’s where overtourism plays out.',
      'Agua, energía, residuos, clima y ecosistemas. Es el corazón de la Declaración de Glasgow: medir, descarbonizar, regenerar.':
        'Water, energy, waste, climate and ecosystems. It’s the heart of the Glasgow Declaration: measure, decarbonise, regenerate.',
      'A dónde va el dinero: ingreso a quien protagoniza la experiencia, compra a productores de aquí y empleo digno. Es donde la Agenda 2030 nombra al turismo con todas sus letras, en la meta 8.9.':
        'Where the money goes: income to the people at the heart of the experience, buying from local producers and decent work. It’s where the 2030 Agenda names tourism outright, in target 8.9.',
      'Todavía no hay ninguna medida aquí':'Nothing measured here yet',
      'El objetivo se declara en el paso <b>Impacto</b> de cada ficha.':'The goal is declared in the <b>Impact</b> step of each experience.',
      'desde':'from',
      'Están subidas todas las experiencias de la base, también borradores y prefichas. Las promociones y los objetivos de la ONU son demo.':
        'All experiences from the database are loaded, including drafts and pre-listings. The promotions and the UN goals are demo.',
      /* Fase 2 — eventos, espacios, terminos */
      ' a ':' to ',
      ' queda apartado a tu nombre. ':' is held in your name. ',
      ' y te apartamos el lugar.':' and we’ll hold your spot.',
      '(fecha fija)':'(fixed date)',
      '. Te mandamos el pase a ':'. We’ll send the pass to ',
      '. Tu lugar quedó apartado a nombre de ':'. Your spot was held in the name of ',
      '; escríbenos a javi@casapepe.mx y lo cerramos.':'; write to us at javi@casapepe.mx and we’ll close it.',
      'Abriendo el pago seguro…':'Opening secure payment…',
      'Abriendo el pago…':'Opening payment…',
      'Abriendo la compra…':'Opening the purchase…',
      'Abrir mi app del Ateneo':'Open my Ateneo app',
      'Agotado':'Sold out',
      'Ahora la hora en que terminas.':'Now your end time.',
      'Aparta el espacio':'Reserve the space',
      'Apartado':'Held',
      'Apartando el espacio…':'Holding the space…',
      'Apartando tu lugar…':'Holding your spot…',
      'Apartando…':'Reserving…',
      'Apartar':'Reserve',
      'Apartar lugar':'Hold spot',
      'Aplicar':'Apply',
      'Con qué pagas':'How you pay',
      'Conviértete en ateneísta':'Become an Ateneo member',
      'Cupo':'Capacity',
      'Código aplicado':'Code applied',
      'De ':'From ',
      'Descuento':'Discount',
      'El cobro con tarjeta todavía no está configurado. Te mandaremos el enlace de pago.':'Card payment isn’t set up yet. We’ll send you the payment link.',
      'El mínimo son ':'The minimum is ',
      /* Entrar, los paquetes de horas y lo que hay en la sala. Todo de hoy,
         14-oct-2026: salía en español con la ficha puesta en inglés. */
      'Para apartar necesitas tu cuenta. Entra ahora y no te lo pedimos al final.':
        'You’ll need your account to book. Sign in now and we won’t ask at the end.',
      'Entrar o crear cuenta':'Sign in or create an account',
      'Reservas como ':'Booking as ',
      /* «Entra con tu correo» ya está más abajo: no se repite aquí. */
      'Así la reserva sale a tu nombre y el comprobante te llega a ti.':
        'That way the booking is in your name and the receipt goes to you.',
      'Así ves tus boletos y sus QR desde cualquier teléfono.':
        'That way you can see your tickets and their QR codes from any phone.',
      'Entra con tu cuenta para ver tus boletos y lo que has comprado.':
        'Sign in to see your tickets and everything you’ve bought.',
      'Seguimos donde lo dejaste.':'Picking up where you left off.',
      'Paquete de ':'Package of ',
      'Te ahorras con el paquete':'You save with the package',
      'O por paquete: ':'Or by package: ',
      'por ':'for ',
      'Qué hay en la sala':'What’s in the room',
      'Equipo':'Gear',
      'todos los días':'every day',
      'Elige el día y las horas para ver el total':'Pick the day and hours to see the total',
      'Elige primero el día.':'Pick the day first.',
      'Elige un boleto para ver el total':'Pick a ticket to see the total',
      'Entrada libre':'Free entry',
      'Entre esas dos horas hay algo ya apartado. Elige otro tramo.':'There’s something already booked between those hours. Pick another slot.',
      'Escríbenos a ':'Write to us at ',
      'Ese código no aplica.':'That code doesn’t apply.',
      'Ese espacio no está a la venta ahora mismo.':'This space isn’t on sale right now.',
      'Este boleto todavía no está pagado. Termina tu pago para activarlo.':'This ticket isn’t paid yet. Finish your payment to activate it.',
      'Este evento no está disponible.':'This event isn’t available.',
      'Este evento todavía no tiene boletos a la venta en línea.':'This event doesn’t have tickets on sale online yet.',
      'Este evento ya no está a la venta. ':'This event is no longer on sale. ',
      'Evento':'Event',
      'Falta decir qué evento.':'No event specified.',
      'Falta el evento.':'Event missing.',
      'Falta el folio del boleto.':'The ticket reference is missing.',
      'Falta la reserva.':'Booking missing.',
      'General':'General',
      'Gratis':'Free',
      'IVA':'VAT',
      'Listo, ':'Done, ',
      'Listo, te apartamos ':'Done, we’ve held ',
      'Lo monta':'Put on by',
      'Lo que deja en el barrio':'What it leaves in the neighbourhood',
      'Mira lo que sí hay':'See what’s on',
      'No encontramos ese boleto.':'We couldn’t find that ticket.',
      'No encontramos tu reserva.':'We couldn’t find your booking.',
      'No pudimos abrir el espacio. ':'We couldn’t open the space. ',
      'No pudimos abrir el evento. ':'We couldn’t open the event. ',
      'No pudimos abrir el pago. Intenta de nuevo.':'We couldn’t open the payment. Try again.',
      'No se pudo apartar tu lugar. Intenta de nuevo.':'We couldn’t hold your spot. Try again.',
      'No se pudo apartar. Intenta de nuevo.':'We couldn’t hold it. Try again.',
      'No se pudo cobrar. Revisa tu tarjeta.':'The charge failed. Check your card.',
      'Nos falta tu WhatsApp con su país: es por donde te confirmamos.':'We’re missing your WhatsApp with its country code: that’s how we confirm.',
      'Pagar ':'Pay ',
      'Pagar ahora':'Pay now',
      'Pago seguro con Stripe. El cobro cae en la cuenta del productor.':'Secure payment with Stripe. The charge goes to the producer’s account.',
      'Pide tu lugar':'Request your spot',
      'Pidiendo…':'Requesting…',
      'Por un día, por persona.':'Per day, per person.',
      'Por una semana, por persona.':'Per week, per person.',
      'Precio de lanzamiento.':'Launch price.',
      'Precio por confirmar':'Price to be confirmed',
      'Precios al público, IVA incluido.':'Retail prices, VAT included.',
      'Procesando…':'Processing…',
      'Reintentar el pago':'Retry payment',
      'Si ya compraste antes con este correo, tu tarjeta aparece guardada.':'If you’ve bought before with this email, your card appears saved.',
      'Te llevamos a elegir boleto y pagar…':'Taking you to pick a ticket and pay…',
      'Te llevamos a la pasarela segura…':'Taking you to the secure checkout…',
      'Te mandamos el pase a ':'We’ll send the pass to ',
      'Te mandamos la confirmación por correo: por eso necesitamos saber que el correo es tuyo de verdad. Es una vez y ya.':'We send you the confirmation by email: that’s why we need to know the address is really yours. Once, and never again.',
      'Toca la hora en que empiezas.':'Tap your start time.',
      'Total a pagar':'Total to pay',
      'Tu boleto':'Your ticket',
      'Tu compra':'Your purchase',
      'Tus boletos, reservar las salas del Ateneo y pedir room service a tu lugar viven en la app. Entra con este mismo correo y date de alta en un toque.':'Your tickets, booking the Ateneo’s rooms and ordering room service to your seat all live in the app. Sign in with this same email and register in one tap.',
      'Verde: hay lugar. Tachado: ya está apartado o no se renta.':'Green: available. Struck through: already booked or not for rent.',
      'cambiar':'change',
      'disponibles':'available',
      'incluido':'included',
      'la hora':'per hour',
      'lugar':'spot',
      'mínimo ':'minimum ',
      'por hora':'per hour',
      'quedan ':'only ',
      '¿Cuántas personas vienen?':'How many people are coming?',
      '¿De qué hora a qué hora?':'From what time to what time?',
      '¿Qué boleto?':'Which ticket?',
      '¿Qué día lo necesitas?':'Which day do you need it?',
      '¿Tienes un código de pago?':'Have a payment code?',
      '← Volver al evento':'← Back to the event',
      'Abriendo el evento…':'Opening the event…',
      'Abriendo el espacio…':'Opening the space…',
      'Cargando…':'Loading…',
      'Correo':'Email',
      'Cuántos van':'How many of you',
      'Cuántos son':'How many of you',
      'Día que vienes':'Day you’re coming',
      'Algo que debamos saber':'Anything we should know',
      '(opcional)':'(optional)',
      'Pedir lugar':'Request spot',
      'Dejas tus datos y el Ateneo te confirma el lugar y cómo pagarlo. No se cobra nada ahora.':'Leave your details and the Ateneo confirms your spot and how to pay. Nothing is charged now.',
      'Nos dices quién eres y qué día vienes, y el Ateneo te confirma el lugar y cómo pagarlo. El precio es el de arriba.':'Tell us who you are and which day you’re coming, and the Ateneo confirms your spot and how to pay. The price is the one above.',
      'Ejemplo':'Example',
      'Así vería tu evento quien va a reservarlo. Este no existe.':'This is how whoever books it would see your event. This one doesn’t exist.',
      '← Volver a la página':'← Back to the page',
      'Más de esta productora':'More from this producer',
      'Dejas tus datos y el Ateneo te confirma el lugar y cómo pagarlo. No se cobra nada ahora. <b>Aquí no: esto es un ejemplo y el formulario está apagado.</b>':'Leave your details and the Ateneo confirms your spot and how to pay. Nothing is charged now. <b>Not here: this is an example and the form is off.</b>',
      'Condiciones<br><b>Versión 1</b>':'Terms<br><b>Version 1</b>',
      'Condiciones de reserva de Sincrético':'Sincrético Booking Terms',
      'Versión 1 · vigente desde el 18 de septiembre de 2026':'Version 1 · in force since 18 September 2026',
      'Imprimir o guardar en PDF':'Print or save as PDF',
      'Estas condiciones se aplican a cualquier experiencia reservada a través de Sincrético, la plataforma de experiencias de Grupo Casa Pepe. Al reservar las aceptas. Están escritas para entenderse: si algo no te queda claro, escríbenos antes de reservar.':'These terms apply to any experience booked through Sincrético, Grupo Casa Pepe’s experiences platform. By booking, you accept them. They are written to be understood: if anything is unclear, write to us before booking.',
      '1. Qué hacemos nosotros y qué hace el operador':'1. What we do and what the operator does',
      'Sincrético pone en contacto a quien viaja con quien opera la experiencia. Cada experiencia la diseña, organiza y ejecuta un operador —a veces Casa Pepe, casi siempre una empresa o una persona independiente—, y en su ficha aparece siempre quién es.':'Sincrético connects travellers with whoever runs the experience. Each experience is designed, organised and run by an operator —sometimes Casa Pepe, most often an independent company or person—, and its page always shows who that is.',
      'Nosotros respondemos de la reserva: del cobro, de la información que publicamos y de la devolución de tu dinero cuando corresponda. El operador responde de la experiencia en sí: de que se haga como se anuncia, de la seguridad durante la actividad y de contar con los permisos y seguros que su actividad requiera.':'We are responsible for the booking: the charge, the information we publish and the refund of your money when due. The operator is responsible for the experience itself: that it happens as advertised, for safety during the activity, and for holding the permits and insurance its activity requires.',
      '2. Tu reserva':'2. Your booking',
      'Tu reserva queda hecha cuando recibes el folio. Ese folio es la prueba de la reserva y te lo pedimos el día de la actividad.':'Your booking is made once you receive the reference. That reference is proof of the booking and we ask you for it on the day of the activity.',
      'Reservas plazas para una fecha, una hora y un número de personas concretos. Si vais más personas de las reservadas, puede que no haya sitio: avísanos antes.':'You book places for a specific date, time and number of people. If more of you come than were booked, there may be no room: let us know beforehand.',
      '3. El precio':'3. The price',
      'El precio que ves incluye el IVA y todo lo que aparece en "Qué incluye". Lo que no aparece ahí, no está incluido: transporte propio, comidas no descritas, entradas no mencionadas y cualquier gasto personal corren por tu cuenta.':'The price you see includes VAT and everything listed under "What’s included". Anything not listed there is not included: your own transport, meals not described, tickets not mentioned and any personal expense are on you.',
      'El desglose de a dónde va cada peso está publicado en la ficha de cada experiencia. Las cifras de impacto las declara quien opera la experiencia; nosotros las publicamos como declaración suya, no como auditoría.':'The breakdown of where every peso goes is published on each experience’s page. Impact figures are declared by whoever runs the experience; we publish them as their declaration, not as an audit.',
      '4. Si cancelas tú':'4. If you cancel',
      'Cada experiencia tiene su propia política de cancelación y está escrita en su ficha, antes de que reserves. Es la que manda.':'Each experience has its own cancellation policy, written on its page before you book. That policy governs.',
      'Si la política permite cancelación gratuita y cancelas dentro del plazo, te devolvemos el importe íntegro por el mismo medio con el que pagaste. Fuera de plazo, o si la experiencia no admite reembolso, no hay devolución, aunque siempre puedes escribirnos: si el operador puede reubicarte en otra fecha, lo intentamos.':'If the policy allows free cancellation and you cancel within the window, we refund the full amount by the same method you paid with. Outside the window, or if the experience is non-refundable, there is no refund, though you can always write to us: if the operator can move you to another date, we try.',
      'No presentarse el día de la actividad, o llegar cuando el grupo ya ha salido, cuenta como cancelación fuera de plazo.':'Not showing up on the day, or arriving once the group has already left, counts as a cancellation outside the window.',
      '5. Si cancelamos nosotros o el operador':'5. If we or the operator cancel',
      'Si cancelamos la salida por cualquier motivo —no se junta el grupo mínimo, el operador no puede operar, el clima lo impide, o un motivo de fuerza mayor—, te devolvemos el importe completo o te ofrecemos otra fecha. Tú eliges.':'If we cancel the departure for any reason —the minimum group isn’t met, the operator can’t run it, the weather prevents it, or a force majeure—, we refund the full amount or offer you another date. You choose.',
      'Esa devolución es todo a lo que estamos obligados en ese caso: no cubrimos vuelos, hoteles, traslados ni otros gastos que hubieras reservado por tu cuenta alrededor de la actividad.':'That refund is all we are bound to in that case: we don’t cover flights, hotels, transfers or other expenses you may have booked on your own around the activity.',
      '6. Grupo mínimo':'6. Minimum group',
      'Algunas experiencias necesitan un número mínimo de personas para salir. Cuando es así, está dicho en la ficha. Si no se junta, te avisamos con la mayor antelación posible y se aplica el punto anterior.':'Some experiences need a minimum number of people to run. When so, it’s stated on the page. If it isn’t met, we tell you as far in advance as possible and the previous point applies.',
      '7. Cambios pequeños':'7. Small changes',
      'Un itinerario puede cambiar de orden, una parada puede sustituirse por otra equivalente y el guía anunciado puede cambiar. Mientras el contenido y la duración de la experiencia se mantengan, no da lugar a reembolso. Si el cambio es de fondo, te lo consultamos antes y puedes cancelar sin coste.':'An itinerary may be reordered, a stop may be replaced by an equivalent one and the announced guide may change. As long as the content and length of the experience hold, this gives no right to a refund. If the change is substantial, we consult you beforehand and you can cancel at no cost.',
      '8. Puntualidad y punto de encuentro':'8. Punctuality and meeting point',
      'El punto de encuentro y la hora están en tu confirmación. Llega con margen: los grupos salen a su hora y no siempre se puede esperar ni alcanzar al grupo después.':'The meeting point and time are in your confirmation. Arrive with time to spare: groups leave on time and it isn’t always possible to wait or to catch up with the group later.',
      '9. Quién puede participar':'9. Who can take part',
      'Si la experiencia tiene edad mínima, está indicada en su ficha y se aplica sin excepciones. Los menores de edad participan acompañados de un adulto responsable, que reserva por ellos y responde de ellos.':'If the experience has a minimum age, it’s stated on its page and applies without exception. Minors take part accompanied by a responsible adult, who books for them and is answerable for them.',
      'Si la actividad exige un esfuerzo físico determinado o se desarrolla en condiciones particulares, lo decimos en la ficha. Valora tú si te conviene. Si tienes alguna condición que el operador deba conocer para atenderte bien —movilidad, alergias, cualquier otra—, cuéntanosla al reservar: nos ayuda a prepararlo y no la usamos para nada más.':'If the activity demands a certain physical effort or takes place in particular conditions, we say so on the page. Judge for yourself whether it suits you. If you have any condition the operator should know to look after you well —mobility, allergies, anything else—, tell us when you book: it helps us prepare and we use it for nothing else.',
      '10. Durante la actividad':'10. During the activity',
      'Sigue las indicaciones de quien guía: están ahí por seguridad y por respeto a los lugares y a las personas que nos reciben.':'Follow the guide’s instructions: they are there for safety and out of respect for the places and the people who host us.',
      'El operador puede apartar de la actividad, sin devolución, a quien ponga en riesgo al grupo, llegue en estado que le impida participar con seguridad, o falte al respeto a otros participantes, al equipo o a las comunidades anfitrionas.':'The operator may remove from the activity, without refund, anyone who endangers the group, arrives in a state that prevents safe participation, or disrespects other participants, the team or the host communities.',
      'Muchas de estas experiencias ocurren en casas, talleres y comunidades que abren sus puertas. Pregunta antes de fotografiar a las personas.':'Many of these experiences take place in homes, workshops and communities that open their doors. Ask before photographing people.',
      '11. Fotos y vídeo':'11. Photos and video',
      'Durante algunas experiencias tomamos fotos. Si no quieres salir, dilo y no sales: basta con avisar al guía. Si no nos dices nada, podemos usar esas imágenes para enseñar la experiencia. Si luego cambias de idea, escríbenos y las retiramos.':'During some experiences we take photos. If you don’t want to appear, say so and you won’t: just tell the guide. If you say nothing, we may use those images to show the experience. If you later change your mind, write to us and we’ll remove them.',
      '12. Hasta dónde respondemos':'12. The limits of our liability',
      'Respondemos de lo que está en nuestra mano: la reserva, el cobro, la devolución y que la información publicada sea fiel a lo que el operador nos ha declarado.':'We are liable for what is in our hands: the booking, the charge, the refund, and that the published information is faithful to what the operator has declared to us.',
      'La ejecución de la actividad y lo que ocurra durante ella es responsabilidad del operador, que debe contar con los seguros y permisos que su actividad exija. No respondemos de daños derivados de no seguir las indicaciones del guía, de no declarar una condición relevante, ni de objetos personales perdidos o dañados.':'Running the activity and whatever happens during it is the operator’s responsibility, and they must hold the insurance and permits their activity requires. We are not liable for harm arising from failing to follow the guide’s instructions, from not declaring a relevant condition, or for personal belongings lost or damaged.',
      'Nada de lo anterior limita los derechos que te reconozca la ley mexicana de protección al consumidor.':'Nothing above limits the rights granted to you by Mexican consumer protection law.',
      '13. Tus datos':'13. Your data',
      'Usamos tu nombre, tu correo, tu teléfono y lo que nos cuentes al reservar para gestionar la reserva, para que el operador pueda atenderte y para escribirte sobre ella. Compartimos con el operador solo lo que necesita para recibirte.':'We use your name, email, phone and whatever you tell us when booking to manage the booking, so the operator can look after you, and to write to you about it. We share with the operator only what they need to receive you.',
      'Puedes pedirnos en cualquier momento acceder a tus datos, corregirlos o que los borremos, escribiendo a':'You can ask us at any time to access your data, correct it or delete it, by writing to',
      '14. Si algo sale mal':'14. If something goes wrong',
      'Dínoslo cuanto antes, y a ser posible el mismo día: casi todo tiene arreglo si nos enteramos a tiempo. Escríbenos a':'Tell us as soon as possible, and ideally the same day: almost everything can be fixed if we hear in time. Write to us at',
      'con tu folio.':'with your reference.',
      'Estas condiciones se rigen por la legislación mexicana. Para cualquier controversia, la Procuraduría Federal del Consumidor (PROFECO) es la vía de conciliación, sin perjuicio de acudir a los tribunales competentes de la Ciudad de México.':'These terms are governed by Mexican law. For any dispute, the Federal Consumer Protection Agency (PROFECO) is the route for conciliation, without prejudice to turning to the competent courts of Mexico City.',
      '15. Condiciones propias del operador':'15. The operator’s own terms',
      'Un operador puede añadir condiciones suyas, y cuando lo hace aparecen en la ficha de su experiencia bajo su nombre. Esas condiciones complementan a estas, nunca las contradicen: si una condición del operador choca con algo de este documento, manda este documento.':'An operator may add its own terms, and when it does they appear on its experience’s page under its name. Those terms complement these, never contradict them: if an operator’s term clashes with anything in this document, this document governs.',
      /* Fase 2 — Ateneo */
      'La App del Ateneísta':'The Ateneísta App',
      'La app de quien usa el Ateneo: sus <span class=\'q\'>boletos con QR</span>, reservar las <span class=\'q\'>salas</span>, pedir <span class=\'q\'>room service</span> a su lugar, el <span class=\'q\'>check-in</span> del residente y los shows con <span class=\'q\'>2×1</span>. Se entra con el correo de la compra.':'The app for everyone who uses the Ateneo: their <span class=\'q\'>QR tickets</span>, booking the <span class=\'q\'>rooms</span>, ordering <span class=\'q\'>room service</span> to their spot, the resident <span class=\'q\'>check-in</span>, and shows with <span class=\'q\'>2-for-1</span>. You sign in with your purchase email.',
      'Abrir la app <span class=\'em\'>del Ateneísta</span> ↗':'Open the app <span class=\'em\'>for the Ateneísta</span> ↗',
      'Link para darse de alta / compartir':'Link to sign up / share',
      'Copiar':'Copy',
      '¡Copiado!':'Copied!',
      'Se abre en una pestaña nueva, así no sales del panel. El ateneísta también entra solo al confirmar una compra (desde su boleto).':'It opens in a new tab, so you don\'t leave the panel. The ateneísta also gets in automatically when confirming a purchase (from their ticket).',
      '¿Quién eres?':'Who are you?',
      'Dinos por dónde entras y te llevamos a tu puerta. Cada una pide cosas distintas, así que conviene empezar por aquí.':'Tell us how you\'re coming in and we\'ll take you to your door. Each one asks for different things, so it\'s best to start here.',
      'Soy ateneísta':'I\'m an ateneísta',
      'Vengo al Ateneo a trabajar o a sus eventos: tengo un lugar en el coworking, o vengo a menudo y quiero estar al día.':'I come to the Ateneo to work or for its events: I have a coworking spot, or I come often and want to stay up to date.',
      'Soy productora':'I\'m a production company',
      'Traigo eventos al Ateneo: teatro, cine, podcast, música, expos, grabaciones o congresos. Doy de alta mi empresa y entro a mi portal.':'I bring events to the Ateneo: theatre, cinema, podcast, music, expos, recordings or conferences. I register my company and enter my portal.',
      'Trabajo en el Ateneo':'I work at the Ateneo',
      'Vengo a darme de alta como colaborador. Se hace en Soy Pepe y pide tus datos y documentos.':'I\'m here to register as a team member. It\'s done in Soy Pepe and asks for your details and documents.',
      'Soy residente':'I\'m a resident',
      'Pronto':'Soon',
      'Las residencias del Ateneo todavía no abren su alta. Cuando abran, se entra por aquí.':'The Ateneo residencies aren\'t open for registration yet. When they open, you\'ll enter here.',
      'Ya tengo mi lugar':'I already have my spot',
      'Contraté coworking o reservé algo en el Ateneo. Entro a mi app con mi correo.':'I signed up for coworking or booked something at the Ateneo. I enter my app with my email.',
      'Quiero estar al día':'I want to stay up to date',
      'Todavía no tengo plan. Quiero ver qué pasa en el edificio y apartar un lugar cuando me haga falta.':'I don\'t have a plan yet. I want to see what\'s going on in the building and book a spot when I need one.',
      'Estar al día':'Stay up to date',
      'Te abrimos la app del Ateneo: la cartelera, quién está en el edificio y los planes de coworking. No cobramos nada ni te pedimos contraseña.':'We\'ll open the Ateneo app for you: the listings, who\'s in the building, and the coworking plans. We charge nothing and don\'t ask for a password.',
      'Entrar a tu app':'Enter your app',
      'Se entra con el correo con el que contrataste tu lugar o reservaste. Si lo contrataste con otro correo, dentro de la app puedes enlazarlo.':'You sign in with the email you used to sign up or book. If you used a different email, you can link it inside the app.',
      'Ir a mi app':'Go to my app',
      '‹ Volver':'‹ Back',
      '← No soy productora, volver':'← I\'m not a production company, go back',
      'Tu productora':'Your production company',
      'Tu primer evento':'Your first event',
      'Cuatro datos y entras. A qué te dedicas, lo fiscal, la póliza y dónde cobras se llenan dentro, cuando los tengas. Tu primer evento se publica cuando el Ateneo lo apruebe.':'Four details and you\'re in. What you do, tax info, insurance and where you get paid are filled in inside, when you have them. Your first event goes live once the Ateneo approves it.',
      'Nombre de la productora *':'Production company name *',
      'Tu nombre *':'Your name *',
      'Tu correo *':'Your email *',
      'Con él entras, y ahí te mandamos la liga de tu portal.':'You sign in with it, and that\'s where we send your portal link.',
      'Contraseña *':'Password *',
      'Crear mi cuenta y entrar':'Create my account and enter',
      'Tarda un segundo.':'Takes a second.',
      '¿Ya te diste de alta y perdiste tu liga?':'Already signed up and lost your link?',
      'Te la volvemos a mandar':'We\'ll resend it to you',
      'Mandarme mi liga':'Send me my link',
      'Entrar a mi portal':'Enter my portal',
      'Como la conoce la gente':'As people know it',
      'Quien queda como titular':'Who\'s listed as owner',
      '10 dígitos':'10 digits',
      'Mínimo 8 caracteres':'At least 8 characters',
      'el correo con el que te diste de alta':'the email you signed up with',
      'Las residencias del Ateneo abren pronto. Si te interesa, escríbenos a ateneo@casapepe.mx y te avisamos en cuanto abran.':'The Ateneo residencies open soon. If you\'re interested, write to us at ateneo@casapepe.mx and we\'ll let you know as soon as they open.',
      'Falta tu nombre.':'Your name is missing.',
      'Revisa tu correo, parece incompleto.':'Check your email, it looks incomplete.',
      'Abriendo…':'Opening…',
      'No pudimos abrirte la app. Inténtalo otra vez o escríbenos a ateneo@casapepe.mx.':'We couldn\'t open the app for you. Try again or write to us at ateneo@casapepe.mx.',
      '¿Ya tienes tu lugar, o vienes a menudo y quieres estar al día?':'Do you already have your spot, or do you come often and want to stay up to date?',
      'Alta de productora':'Production company sign-up',
      'Son dos minutos. Lo indispensable ahora, el resto desde tu portal.':'Two minutes. The essentials now, the rest from your portal.',
      'Dinos cómo se llama tu productora.':'Tell us your production company\'s name.',
      'La contraseña necesita al menos 8 caracteres.':'The password needs at least 8 characters.',
      'No se pudo crear tu cuenta. Inténtalo otra vez.':'We couldn\'t create your account. Try again.',
      'Creando…':'Creating…',
      'Ya tenías cuenta,':'You already had an account,',
      'Con ese correo ya hay una productora en el Ateneo. Entra con tu contraseña.':'There\'s already a production company at the Ateneo with that email. Sign in with your password.',
      'Listo,':'Done,',
      'Tu cuenta está creada. Te quedan dos pasos y los dos se hacen dentro: la ficha de':'Your account is created. Two steps left, both done inside: the profile for',
      'y tu primer evento, que publicamos cuando el Ateneo lo apruebe. También te mandamos la liga a':'and your first event, which we publish once the Ateneo approves it. We\'ve also sent the link to',
      'Ya estás dentro':'You\'re in',
      'No se pudo. Inténtalo otra vez.':'It didn\'t work. Try again.',
      'Si ese correo tiene una productora en el Ateneo, su liga va para allá.':'If that email has a production company at the Ateneo, its link is on the way.',
      'Revisa el correo, parece incompleto.':'Check the email, it looks incomplete.',
      'Cargando tu contrato…':'Loading your contract…',
      'respuesta ilegible':'unreadable response',
      'Algo falló':'Something went wrong',
      'Contrato':'Contract',
      'Plan':'Plan',
      'Primer pago':'First payment',
      'Vigencia':'Term',
      'meses':'months',
      'Contrato firmado':'Contract signed',
      'Lo firmó':'Signed by',
      'el':'on',
      'Abajo queda el documento tal como se firmó; también te llegó por correo.':'The document as signed is below; it was also emailed to you.',
      'ACUSE DE FIRMA ELECTRÓNICA':'ELECTRONIC SIGNATURE RECEIPT',
      'Folio:':'Ref:',
      'Firmó:':'Signed by:',
      'Fecha y hora:':'Date and time:',
      'IP:':'IP:',
      'Navegador:':'Browser:',
      'Lee el contrato completo. Abajo completas los datos que faltan y lo firmas; te llega copia por correo.':'Read the full contract. Below you complete the missing details and sign it; you\'ll get a copy by email.',
      'Datos para el contrato':'Contract details',
      'Razón social o nombre completo':'Legal name or full name',
      'Tipo':'Type',
      'Persona física':'Individual',
      'Persona moral':'Legal entity',
      'Representante legal':'Legal representative',
      'Domicilio fiscal':'Tax address',
      'Actividad principal':'Main activity',
      'Correo de facturación':'Billing email',
      'He leído el contrato completo y acepto sus términos. Entiendo que mi firma electrónica tiene la misma validez que una firma autógrafa.':'I have read the full contract and accept its terms. I understand my electronic signature has the same validity as a handwritten one.',
      'Escribe tu nombre completo para firmar':'Type your full name to sign',
      'Nombre y apellidos':'First and last name',
      'Firmar contrato':'Sign contract',
      '¿Dudas? WhatsApp 55 4930 5703':'Questions? WhatsApp 55 4930 5703',
      'Falta la razón social o tu nombre.':'Legal name or your name is missing.',
      'Marca la casilla de aceptación para poder firmar.':'Tick the acceptance box to sign.',
      'Escribe tu nombre completo para firmar.':'Type your full name to sign.',
      'Firmando…':'Signing…',
      'No se pudo firmar. Inténtalo otra vez.':'Couldn\'t sign. Try again.',
      'Falta el enlace':'Missing link',
      'Entra con el enlace que te mandamos por correo.':'Use the link we emailed you.',
      'No encontramos ese contrato':'We couldn\'t find that contract',
      '. Escríbenos y te mandamos uno nuevo.':'. Write to us and we\'ll send you a new one.',
      'Abriendo el convenio…':'Opening the agreement…',
      'No pudimos abrir el convenio':'We couldn\'t open the agreement',
      'Si crees que es un error, escríbenos a':'If you think this is a mistake, write to us at',
      'Convenio de entrega de premio':'Prize award agreement',
      'Desplázate hasta el final para leerlo completo.':'Scroll to the end to read it in full.',
      'Tus datos y la cuenta donde recibes el pago':'Your details and the account where you receive payment',
      'La transferencia sólo puede ir a una cuenta a tu nombre, por ser quien registró y representó a la empresa.':'The transfer can only go to an account in your name, as the person who registered and represented the company.',
      'Nombre completo del titular':'Account holder\'s full name',
      'RFC o identificación fiscal':'RFC or tax ID',
      '¿Dónde está la cuenta?':'Where is the account?',
      '🇲🇽 En México':'🇲🇽 In Mexico',
      '🌎 En el extranjero':'🌎 Abroad',
      'Banco':'Bank',
      'CLABE interbancaria (18 dígitos)':'CLABE (18 digits)',
      'IBAN o número de cuenta':'IBAN or account number',
      'País del banco':'Bank country',
      'Reino Unido':'United Kingdom',
      'Correo para la confirmación del pago':'Email for payment confirmation',
      'La transferencia internacional puede tardar unos días más y el banco intermediario suele cobrar una comisión, que sale del monto.':'An international transfer may take a few more days, and the intermediary bank usually charges a fee, taken from the amount.',
      'El equipo de desarrollo':'The development team',
      'En cuanto firmes, les llega su propio enlace para que firmen ellos.':'Once you sign, they get their own link to sign.',
      'Pagamos cuando los dos hayan firmado.':'We pay once both have signed.',
      'Nombre del desarrollador o del equipo':'Developer\'s or team\'s name',
      'Correo del desarrollador':'Developer\'s email',
      'Tu firma':'Your signature',
      'Escribe tu nombre tal como firmas':'Type your name as you sign it',
      'Borrar y repetir':'Clear and redo',
      'Firma con el dedo o con el ratón.':'Sign with your finger or mouse.',
      'Firmar el convenio':'Sign the agreement',
      'Quién ha firmado':'Who has signed',
      '✓ Firmado':'✓ Signed',
      'Te guardamos el acuse con la fecha, el dispositivo y el documento tal como lo firmaste. Cualquier duda,':'We keep the receipt with the date, device and document as you signed it. Any questions,',
      'Al enlace le falta el código de firma. Ábrelo desde el correo que te mandamos.':'The link is missing the signing code. Open it from the email we sent.',
      'No hay conexión. Inténtalo otra vez en un momento.':'No connection. Try again in a moment.',
      'Firmas como':'You\'re signing as',
      'firmante':'signer',
      'Al firmar aceptas el convenio, confirmas que la cuenta indicada está a tu nombre y autorizas a HBRU a depositar ahí el equivalente en pesos de USD':'By signing you accept the agreement, confirm the account is in your name, and authorise HBRU to deposit there the peso equivalent of USD',
      'Al firmar reconoces que el premio se reparte 50% equipo de desarrollo y 50% empresa, que la aportación de Casa Pepe es de USD':'By signing you acknowledge the prize is split 50% development team / 50% company, that Casa Pepe\'s contribution is USD',
      'y se paga al representante de la empresa, y que':'and is paid to the company representative, and that',
      'la mitad que corresponde al equipo de desarrollo la paga un tercero, no Casa Pepe':'the development team\'s half is paid by a third party, not Casa Pepe',
      'empresa':'company',
      'desarrollo':'development',
      'firmado':'signed',
      'pendiente':'pending',
      'Todavía nadie.':'No one yet.',
      'Ya habías firmado este convenio. No hace falta que hagas nada más.':'You\'d already signed this agreement. Nothing else to do.',
      'Escribe tu nombre completo.':'Type your full name.',
      'Falta tu firma: dibújala en el recuadro.':'Your signature is missing: draw it in the box.',
      'Falta el nombre del titular de la cuenta.':'Account holder\'s name is missing.',
      'Falta el banco.':'Bank is missing.',
      'La CLABE son 18 dígitos.':'The CLABE is 18 digits.',
      'El IBAN o número de cuenta va entre 8 y 34 letras o números.':'The IBAN or account number is 8–34 letters or digits.',
      'El SWIFT/BIC son 8 u 11 letras o números.':'SWIFT/BIC is 8 or 11 letters or digits.',
      'Falta el país del banco.':'Bank country is missing.',
      'Falta el correo del desarrollador.':'Developer\'s email is missing.',
      'Falta el nombre del desarrollador.':'Developer\'s name is missing.',
      'Firmaron las dos partes. Ya podemos procesar la transferencia.':'Both parties signed. We can process the transfer now.',
      'Gracias. Le acabamos de mandar el enlace al equipo de desarrollo; en cuanto firmen, pagamos.':'Thanks. We\'ve just sent the link to the development team; once they sign, we pay.',
      'Gracias. Con tu firma el convenio queda completo por tu parte.':'Thanks. With your signature the agreement is complete on your side.',
      'No se pudo guardar. Inténtalo otra vez.':'Couldn\'t save. Try again.',
      'Tu app':'Your app',
      'Entra con tu correo':'Sign in with your email',
      'El mismo con el que reservaste. La app es para quien ya usa el Ateneo: si todavía no has reservado nada, reserva primero y entras con ese correo.':'The same one you booked with. The app is for people already using the Ateneo: if you haven\'t booked anything yet, book first and sign in with that email.',
      '¿Qué hay aquí dentro?':'What\'s in here?',
      'Tus boletos con su QR, lo que viene esta semana, reservar las salas (con tus horas de cortesía si eres ateneísta), room service a tu sala, y quién vive el edificio.':'Your tickets with their QR, what\'s coming this week, booking the rooms (with your complimentary hours if you\'re an ateneísta), room service to your room, and who lives in the building.',
      'Esta semana en el Ateneo':'This week at the Ateneo',
      'Lo que viene en los próximos días. Se reserva desde aquí.':'What\'s coming in the next few days. Book it from here.',
      'En el edificio':'In the building',
      'Shows y eventos · 2×1 ateneístas':'Shows & events · 2-for-1 for ateneístas',
      'Tu entrada trae otra de regalo: ven con alguien.':'Your ticket brings another one free: come with someone.',
      'Experiencias de Sincrético':'Sincrético experiences',
      'Nuestra touroperadora: lo que se hace fuera del edificio.':'Our tour operator: what happens outside the building.',
      'Aprende con las manos: artesanía, oficios y más.':'Learn with your hands: crafts, trades and more.',
      'Apartar un lugar en el coworking':'Book a coworking spot',
      'Los planes del Ateneo. El Day Pass es para venir un día suelto.':'The Ateneo plans. The Day Pass is for coming just one day.',
      'La comunidad de Virreyes':'The Virreyes community',
      'Quién vive y trabaja en el edificio. Toca a alguien para saber más.':'Who lives and works in the building. Tap someone to learn more.',
      'Las comunidades con las que colaboramos':'The communities we work with',
      'Con quién trabajamos directamente en la sierra y en el taller.':'Who we work with directly in the sierra and the workshop.',
      'Mi cartera':'My wallet',
      'Tus compras, con su código. Lo vencido se queda en gris; una membresía sigue hábil hasta que vence.':'Your purchases, with their code. Expired ones stay grey; a membership stays valid until it expires.',
      'Reservar una sala':'Book a room',
      '¿Tienes un lugar en el coworking?':'Do you have a coworking spot?',
      'Si lo contrataste con otro correo, ponlo aquí y te cargamos tus horas.':'If you signed up with a different email, enter it here and we\'ll load your hours.',
      'El correo con el que lo contrataste':'The email you signed up with',
      'Cargar mis beneficios':'Load my benefits',
      'Mis reservas':'My bookings',
      'Las horas de las salas vienen con el plan. Si todavía no tienes uno, aquí están.':'Room hours come with the plan. If you don\'t have one yet, here they are.',
      'Tu pedido':'Your order',
      '¿A qué sala te lo subimos?':'Which room should we bring it to?',
      '¿Cómo pagas al recibir?':'How will you pay on delivery?',
      'Efectivo':'Cash',
      'Tarjeta':'Card',
      'Pedir':'Order',
      'Pedidos de room service':'Room service orders',
      'Mis eventos activos':'My active events',
      'Check-in de tu residencia':'Your residency check-in',
      'Nombre completo':'Full name',
      'Nacionalidad':'Nationality',
      'Celular':'Mobile',
      'Identificación':'ID',
      'Pasaporte':'Passport',
      'Licencia':'License',
      'Otro':'Other',
      'Número de ID':'ID number',
      'Borrar':'Clear',
      'Confirmo que mis datos son correctos y acepto el reglamento de la residencia del Ateneo de Virreyes.':'I confirm my details are correct and accept the Ateneo de Virreyes residency rules.',
      'Hacer check-in':'Check in',
      'Nombre':'Name',
      'Foto (liga)':'Photo (link)',
      'Tu ficha en la comunidad':'Your community profile',
      'Esto es lo que ven los demás en la portada. No sale nada hasta que lo enciendes, y lo apagas cuando quieras.':'This is what others see on the home page. Nothing shows until you turn it on, and you can turn it off whenever.',
      'Qué haces aquí':'What you do here',
      'Dos líneas sobre ti':'Two lines about you',
      'Quiero salir en la comunidad de Virreyes.':'I want to appear in the Virreyes community.',
      'Que me puedan escribir por WhatsApp desde mi ficha.':'Let people message me on WhatsApp from my profile.',
      'Guardar mi ficha':'Save my profile',
      'Los residentes de Virreyes':'The Virreyes residents',
      'Quién hace cosas en el edificio: quienes coordinan, los artistas y oficios de los talleres, y las comunidades con las que trabajamos.':'Who makes things happen in the building: the coordinators, the artists and trades from the workshops, and the communities we work with.',
      'Inicio':'Home',
      'Cartera':'Wallet',
      'Salas':'Rooms',
      'Mis eventos':'My events',
      'Yo':'Me',
      'Mexicana, Española…':'Mexican, Spanish…',
      'INE, pasaporte…':'INE, passport…',
      'Mexicana, Colombiana…':'Mexican, Colombian…',
      'Fotógrafa, luthier, programador…':'Photographer, luthier, programmer…',
      'En qué andas, qué buscas, qué ofreces':'What you\'re up to, what you\'re looking for, what you offer',
      'Hola,':'Hi,',
      'Tu app del Ateneo':'Your Ateneo app',
      'Tarjeta guardada:':'Saved card:',
      'Todavía no tienes tarjeta guardada. Se guarda la primera vez que pagues algo desde la app.':'You don\'t have a saved card yet. It\'s saved the first time you pay from the app.',
      'Para que te escriban por WhatsApp hace falta tu celular, arriba.':'To be messaged on WhatsApp we need your mobile, above.',
      'Guardado. Ya sales en la portada.':'Saved. You now appear on the home page.',
      'Guardado. No sales en la portada.':'Saved. You don\'t appear on the home page.',
      'Guardado.':'Saved.',
      'Pon tu correo.':'Enter your email.',
      'Entrando…':'Signing in…',
      'No pudimos abrir tu cuenta.':'We couldn\'t open your account.',
      'Vencido':'Expired',
      'Pagado':'Paid',
      'Confirmado':'Confirmed',
      'Falta pagar':'Payment due',
      'Membresía':'Membership',
      'Pase':'Pass',
      'Vigente hasta':'Valid until',
      'Venció el':'Expired on',
      'Todavía no tienes nada aquí.':'Nothing here yet.',
      'En cuanto reserves algo, su boleto aparece en esta cartera con su código.':'As soon as you book something, its ticket appears in this wallet with its code.',
      'Nada vigente ahora mismo.':'Nothing valid right now.',
      'Historia':'History',
      'Lo que ya usaste o venció. Se queda aquí de recuerdo.':'What you\'ve used or that expired. It stays here as a keepsake.',
      'Esta semana no hay nada programado. Mira el resto de la cartelera en Sincrético.':'Nothing scheduled this week. See the rest of the listings on Sincrético.',
      'De la cocina a tu sala':'From the kitchen to your room',
      'El juego de la casa':'The house game',
      'Dormir en Virreyes':'Sleep at Virreyes',
      'Reservar noche de hotel':'Book a hotel night',
      'Más del Ateneo':'More about the Ateneo',
      'Qué es y qué hay dentro':'What it is and what\'s inside',
      'Ahora mismo no hay shows en cartelera.':'No shows on right now.',
      'Sin experiencias publicadas ahora mismo.':'No experiences published right now.',
      'Sin talleres publicados ahora mismo.':'No workshops published right now.',
      'Sin comunidades cargadas.':'No communities loaded.',
      'Sin planes publicados.':'No plans published.',
      'al mes':'per month',
      'la semana':'per week',
      'el día':'per day',
      'Para empezar':'To start',
      'Ocupado ahora mismo':'Taken right now',
      'Ese correo ya era tuyo.':'That email was already yours.',
      'Listo. Te cargamos tu plan y tus horas.':'Done. We\'ve loaded your plan and hours.',
      'Listo. Te enlazamos tu residencia.':'Done. We\'ve linked your residency.',
      'Todavía nadie ha encendido su ficha. La tuya se enciende en Yo → Tu ficha en la comunidad.':'No one has turned on their profile yet. Turn yours on in Me → Your community profile.',
      'Aquí van a salir los residentes y ateneístas que quieran darse a conocer.':'This is where residents and ateneístas who want to be known will appear.',
      'Escribirle por WhatsApp':'Message them on WhatsApp',
      'No dejó su WhatsApp abierto.':'They didn\'t leave their WhatsApp open.',
      'Tu plan trae horas incluidas. Se gastan primero y no se acumulan de un periodo a otro: lo que no uses, se pierde.':'Your plan includes hours. They\'re used first and don\'t roll over: what you don\'t use is lost.',
      'Las horas incluidas son de los planes del Ateneo. Sin plan, la sala se cobra.':'Included hours come with the Ateneo plans. Without a plan, the room is charged.',
      'Te quedan':'You have',
      'h de cortesía este':'complimentary hrs left this',
      'semana':'week',
      'mes':'month',
      'Sin cortesía ·':'No complimentary hours ·',
      'Incluida en los planes del Ateneo · todavía no se vende al público':'Included in the Ateneo plans · not sold to the public yet',
      'Horas':'Hours',
      'Ninguna sala abierta a reserva por la app.':'No rooms open for booking via the app.',
      'Qué hay en la sala':'What\'s in the room',
      'la opera':'run by',
      'Ten en cuenta':'Keep in mind',
      'Cómo se reserva':'How to book',
      'Di cuándo.':'Say when.',
      'Reservada.':'Booked.',
      'h de cortesía y':'complimentary hrs and',
      'h por':'hrs for',
      'Te cobramos al llegar.':'We charge you on arrival.',
      'Reservada con tus horas de cortesía. Nos vemos.':'Booked with your complimentary hours. See you.',
      'h de cortesía':'complimentary hrs',
      'Todavía no has reservado ninguna sala.':'You haven\'t booked any room yet.',
      'La cocina todavía no publica su carta.':'The kitchen hasn\'t published its menu yet.',
      'En cuanto Café Cumbre la cargue, aquí se puede pedir y te lo suben a tu sala.':'Once Café Cumbre loads it, you can order here and we\'ll bring it to your room.',
      'Pide de la carta de Café Cumbre y te lo suben a la sala donde estés. Pagas al recibir, en efectivo o con tarjeta.':'Order from Café Cumbre\'s menu and we\'ll bring it to whichever room you\'re in. Pay on delivery, cash or card.',
      'De':'From',
      'cosa':'item',
      'cosas':'items',
      'Vacío':'Empty',
      'Te lo suben a la sala donde estés.':'We\'ll bring it to whichever room you\'re in.',
      '‹ Toda la carta':'‹ Full menu',
      'Se acabó hoy':'Sold out today',
      'Tu pedido va vacío.':'Your order is empty.',
      'Pedido.':'Ordered.',
      'cosas por':'items for',
      'pagas al recibir':'pay on delivery',
      'tarjeta':'card',
      'efectivo':'cash',
      'Suben en unos':'Up in about',
      'minutos.':'minutes.',
      'Todavía no hay fichas públicas.':'No public profiles yet.',
      'Entregado':'Delivered',
      'En la cocina':'In the kitchen',
      'Cancelado':'Cancelled',
      'Nuevo':'New',
      'Tienes 1 pedido por atender.':'You have 1 order to handle.',
      'Tienes':'You have',
      'pedidos por atender.':'orders to handle.',
      'Nada pendiente ahora mismo. Aquí caen los pedidos en cuanto los hacen.':'Nothing pending right now. Orders land here as they come in.',
      'Todavía no hay pedidos.':'No orders yet.',
      'Acepto, va para allá':'Accept, on its way',
      'No se puede':'Can\'t do it',
      'Sin sala':'No room',
      'Nota:':'Note:',
      'paga en':'pays by',
      'Esta cuenta no es de ninguna productora.':'This account doesn\'t belong to any production company.',
      'Tus productoras:':'Your production companies:',
      'No tienes eventos activos.':'You have no active events.',
      'Cuando publiques uno en el Ateneo, aquí lo ves con quién se inscribió y a qué hora.':'When you publish one at the Ateneo, you\'ll see here who signed up and when.',
      'Publicado':'Published',
      'personas':'people',
      'Sin nombre':'No name',
      'Todavía nadie se ha inscrito.':'No one has signed up yet.',
      'Inscritos':'Sign-ups',
      'Ventas':'Sales',
      'Ver inscritos':'See sign-ups',
      'Tu lugar de coworking':'Your coworking spot',
      'vigente hasta':'valid until',
      'Tu residencia':'Your residency',
      'Hab.':'Room',
      'Check-in hecho':'Check-in done',
      'Haz tu check-in':'Do your check-in',
      '. Déjanos tus datos y tu firma; es tu alta.':'. Leave us your details and signature; it\'s your registration.',
      'Falta aceptar el consentimiento.':'You need to accept the consent.',
      'Falta tu firma.':'Your signature is missing.',
      '¡Listo! Tu check-in quedó registrado.':'Done! Your check-in is registered.',

      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      'Antes de venir':'Before you come',
      'Aquí van a aparecer los boletos de las experiencias que reserves, ':'This is where the tickets for the experiences you book will show up, ',
      'Cómo funciona':'How it works',
      'Estamos en ello.':'We\'re on it.',
      'Este es tu pase. Enséñalo en la puerta.':'This is your pass. Show it at the door.',
      'Están subidas todas las experiencias de la base, también ':'Every experience in the database is loaded, including ',
      'Hola, soy':'Hi, I\'m',
      'Horario de la sala: ':'Room hours: ',
      'La opera':'Operated by',
      'Nuestros tours alineados con la Agenda 2030 de la ONU.':'Our tours aligned with the UN 2030 Agenda.',
      'Qué hay en ':'What\'s in ',
      'Si ya reservaste, abre el enlace que te llegó por correo: ':'If you already booked, open the link we emailed you: ',
      'Solicitar una aclaración':'Ask about a charge',
      'Te mandamos copia a':'We sent a copy to',
      'Tengo una duda sobre mi reserva':'I have a question about my booking',
      'Todavía no tenemos recomendaciones cargadas en ':'We don\'t have recommendations loaded yet for ',
      'Todavía no tienes boletos':'No tickets yet',
      'Tu experiencia':'Your experience',
      'Tu lugar está apartado. Ya eres parte de esta salida.':'Your spot is held. You\'re part of this departure.',
      'Tu pago se procesó sin problema. Ya tienes tu lugar.':'Your payment went through. Your spot is yours.',
      'Ver experiencias':'See experiences',
      'Ver mis boletos':'See my tickets',
      'boletos, uno por persona.':'tickets, one per person.',
      'hasta ':'up to ',
      'la sala':'the room',
      '¡Felicidades!':'Congratulations!',
      '¡Felicidades, ':'Congratulations, ',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      'Abrir la biblioteca':'Open the library',
      'Cine':'Screening',
      'Con las manos':'Hands on',
      'Concierto':'Concert',
      'Congresos y corporativos':'Conferences & corporate',
      'Congresos, encuentros de negocios y las salas por horas.':'Conferences, business meetups and the rooms by the hour.',
      'Coworking':'Coworking',
      'Cultura y Arte':'Culture & Art',
      'DJ set':'DJ set',
      'Day tour':'Day tour',
      'El teatro, la galeria, el cine y el estudio del artesano.':'Theatre, the gallery, the cinema and the artisan\'s studio.',
      'El teatro, la galería, el cine y el estudio del artesano.':'Theatre, the gallery, the cinema and the artisan\'s studio.',
      'Encuentros & Meetings':'Meetups & Meetings',
      'Estudio Taller':'Artisan Studio',
      'Exposicion':'Exhibition',
      'Exposición':'Exhibition',
      'Lucha libre':'Lucha libre',
      'Mexican Challenge':'Mexican Challenge',
      'MidDay tour':'MidDay tour',
      'Por un día':'For a day',
      'Por una semana':'For a week',
      'Pub crawl':'Pub crawl',
      'Renta del teatro':'Theatre rental',
      'Sala de ensayo':'Rehearsal room',
      'Sala de podcast':'Podcast studio',
      'Sentarse con alguien de aquí sin salir de la casa.':'Sitting down with a local without leaving the house.',
      'Teatro':'Theatre',
      'Un DJ, un toquin, una fiesta. Ir a pasarla bien.':'A DJ, a gig, a party. Going out to have a good time.',
      'Un DJ, un toquín, una fiesta. Ir a pasarla bien.':'A DJ, a gig, a party. Going out to have a good time.',
      'Upgrade de cuarto':'Room upgrade',
      'Ver todas →':'See all →',
      'Versión beta · la estamos afinando':'Beta version · we\'re still tuning it',
      'Walking tour':'Walking tour',
      'Work & Play':'Work & Play',
      'máx':'max',
      '¿Te olvidaste el libro? No te preocupes: aquí te prestamos uno. Cinco lecturas para entender México.':'Forgot your book? Don\'t worry — we\'ll lend you one. Five reads to understand Mexico.',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      'Bienvenido a Pepe GO!':'Welcome to Pepe GO!',
      'Check-in':'Check-in',
      'Colección Día de Muertos':'Día de Muertos Collection',
      'Condiciones de reserva':'Booking conditions',
      'Experiencias':'Experiences',
      'Hola Pepe':'Hola Pepe',
      'Hola, Pepe Huésped':'Hi, Pepe Guest',
      'La Cósmica':'La Cósmica',
      'La gente ya no lee':'La gente ya no lee',
      'Lo tuyo':'Your stuff',
      'Mejora tu estancia':'Upgrade your stay',
      'Mis pedidos':'My orders',
      'Pepe GO!':'Pepe GO!',
      'Promos':'Deals',
      'Quédate más':'Stay longer',
      'Recepción':'Reception',
      'Room Shop Service':'Room Shop Service',
      'boletos':'tickets',
      'el evento':'the event',
      'espacios creativos':'creative spaces',
      'experiencias en la Ciudad de México':'experiences in Mexico City',
      'la experiencia':'the experience',
      'pagar':'pay',
      '¿Cuándo vuelves?':'When are you coming back?',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      ' al ':' to ',
      ' fechas hasta el ':' dates through ',
      ' y ':' and ',
      'Acompañante':'Companion',
      'Alemania':'Germany',
      'Aparta tu lugar':'Hold your spot',
      'Argentina':'Argentina',
      'Australia':'Australia',
      'Austria':'Austria',
      'Bolivia':'Bolivia',
      'Brasil':'Brazil',
      'Buscar mi reserva':'Find my booking',
      'Bélgica':'Belgium',
      'Cabinas de teléfono ilimitadas':'Unlimited phone booths',
      'Canadá':'Canada',
      'Chile':'Chile',
      'China':'China',
      'Colombia':'Colombia',
      'Corea del Sur':'South Korea',
      'Costa Rica':'Costa Rica',
      'Cuba':'Cuba',
      'De venta en Front Desk':'Sold at the front desk',
      'Decoración':'Decor',
      'Del ':'From ',
      'Dinamarca':'Denmark',
      'Ecuador':'Ecuador',
      'El Salvador':'El Salvador',
      'España':'Spain',
      'Estados Unidos':'United States',
      'Fecha por confirmar':'Date to be confirmed',
      'Francia':'France',
      'Fue el ':'It was on ',
      'Grecia':'Greece',
      'Guatemala':'Guatemala',
      'Honduras':'Honduras',
      'India':'India',
      'Internet de alta velocidad':'High-speed internet',
      'Irlanda':'Ireland',
      'Israel':'Israel',
      'Italia':'Italy',
      'Japón':'Japan',
      'Lo que la ciudad hace cuando vuelven: los desfiles, las catrinas, los alebrijes y una noche que no se parece a ninguna otra del año.':'What the city does when they come back: the parades, the catrinas, the alebrijes and a night like no other in the year.',
      'Lo que viene':'What\'s coming',
      'Museos':'Museums',
      'Museos y otros':'Museums and more',
      'Máscara':'Mask',
      'Nicaragua':'Nicaragua',
      'No pudimos abrir la colección. Inténtalo en un momento.':'We couldn\'t open the collection. Try again in a moment.',
      'Noruega':'Norway',
      'Nueva Zelanda':'New Zealand',
      'Panamá':'Panama',
      'Paraguay':'Paraguay',
      'País':'Country',
      'Países Bajos':'Netherlands',
      'Perú':'Peru',
      'Polonia':'Poland',
      'Portugal':'Portugal',
      'Puerto Rico':'Puerto Rico',
      'Recintos y cultura':'Venues and culture',
      'República Dominicana':'Dominican Republic',
      'Rumanía':'Romania',
      'Rusia':'Russia',
      'Según disponibilidad, y para una estancia que aún no empieza.':'Subject to availability, and for a stay that hasn\'t started yet.',
      'Sin fecha todavía':'No date yet',
      'Sudáfrica':'South Africa',
      'Suecia':'Sweden',
      'Suiza':'Switzerland',
      'Todavía no hay nada publicado en esta colección.':'Nothing published in this collection yet.',
      'Turquia':'Turkey',
      'Turquía':'Turkey',
      'Uruguay':'Uruguay',
      'Venezuela':'Venezuela',
      'Ver la ficha':'See the page',
      'Ver todas las experiencias':'See all the experiences',
      'Ya pasaron':'Already happened',
      'Zona arqueológica':'Archaeological site',
      'evento':'event',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      'Aquí van a aparecer los boletos de las experiencias que reserves, con su QR para enseñarlo el día del tour.':'This is where the tickets for the experiences you book will show up, with the QR code to show on the day of the tour.',
      'Cajeros automáticos':'ATMs',
      'Escondida entre las azoteas del Centro Histórico, La Cósmica te espera al atardecer. Cocteles, cerveza artesanal, eventos y una trajinera.':'Hidden among the rooftops of the Centro Histórico, La Cósmica awaits you at sunset. Cocktails, craft beer, events and a trajinera.',
      'Huevos a la cacerola':'Eggs in the pan',
      'Ikuri “la casa del maíz”':'Ikuri “the house of maize”',
      'Live Día de Muertos':'Live Día de Muertos',
      'Lo dulce':'Something sweet',
      'Lo fit':'The healthy stuff',
      'Los clásicos':'The classics',
      'Mapa CPP 2026 · Casa Pepe. Los horarios y precios cambian: si vas de lejos, confirma antes.':'CPP Map 2026 · Casa Pepe. Opening hours and prices change: if you\'re going far, check first.',
      'Si ya reservaste, abre el enlace que te llegó por correo: tu boleto vive en esa dirección.':'If you already booked, open the link we emailed you: your ticket lives at that address.',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      'Bebida':'Drinks',
      'Bebidas':'Drinks',
      'Cena':'Dinner',
      'Cervezas':'Beers',
      'Cocteles':'Cocktails',
      'Comida':'Lunch',
      'Desayuno':'Breakfast',
      'Entradas':'Starters',
      'Huevos al gusto':'Eggs your way',
      'Mezcales':'Mezcales',
      'Máscaras':'Masks',
      'Para compartir':'To share',
      'Para llevar':'To take away',
      'Postres':'Desserts',
      'Sin alcohol':'Non-alcoholic',
      'Vinos':'Wines',


      /* ---- 20-oct-2026 · lo que el huesped veia en espanol ----
         Javi: «cualquier app o pantalla que vea el huesped en ingles
         este traducida». Los fragmentos conservan el espacio de los
         bordes a proposito: se concatenan con un numero o un nombre. */
      '📅 Por un día':'📅 For a day',
      '📅 Por una semana':'📅 For a week',
      '📷 Subir o tomar foto':'📷 Upload or take a photo',
      '📸 Capturar':'📸 Capture',
      '📸 Tomar con la cámara':'📸 Use the camera',
      '🔗 Copiar link':'🔗 Copy link',
      '🔦 Luz':'🔦 Light',

    }
  };

  /* La cadena en espanol ES la llave. Si no hay traduccion, sale el espanol. */
  function t(es){
    var d = UI[resuelve()];
    if(!d) return es;
    var v = d[String(es)];
    return (v===undefined || v===null) ? es : v;
  }

  /* Barrido del HTML fijo. Marca los elementos y ya:
       <span data-i18n>Entrar</span>              texto
       <input data-i18n-ph="Busca…">               placeholder
       <button data-i18n-aria="Limpiar">           aria-label
     En data-i18n la llave es el propio texto del elemento, asi que no hay que
     escribirlo dos veces ni mantenerlo sincronizado. */
  /* El titulo de la pestana, que tampoco pasaba por ningun sitio. */
  function titulo(){
    if(resuelve()==='es') return;
    try{
      var d=document.title; if(!d) return;
      var v=t(d);
      if(v!==d){ document.title=v; return; }
      var pz=d.split(' · ');
      if(pz.length>1){
        var r=pz.map(function(x){ return t(x); }).join(' · ');
        if(r!==d) document.title=r;
      }
    }catch(_){}
  }

  function barre(raiz){
    var r = raiz || document;
    if(resuelve()==='es') return;
    try{
      r.querySelectorAll('[data-i18n]').forEach(function(el){
        var clave = el.getAttribute('data-i18n') || el.textContent.trim();
        var tr = t(clave);
        if(tr !== clave) el.textContent = tr;
      });
      r.querySelectorAll('[data-i18n-ph]').forEach(function(el){
        var k = el.getAttribute('data-i18n-ph'); el.setAttribute('placeholder', t(k));
      });
      r.querySelectorAll('[data-i18n-aria]').forEach(function(el){
        var k = el.getAttribute('data-i18n-aria'); el.setAttribute('aria-label', t(k));
      });
      r.querySelectorAll('[data-i18n-html]').forEach(function(el){
        var k = el.getAttribute('data-i18n-html'); el.innerHTML = t(k);
      });
      titulo();
    }catch(_){}
  }

  /* Dias y meses. No se usa Intl porque el front ya tiene sus arrays cortos y
     hay que devolver exactamente la misma forma ('mié', 'sáb') para no romper
     los anchos de las pastillas del calendario. */
  var FECHAS = {
    es:{ dias:['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
         cortos:['dom','lun','mar','mié','jue','vie','sáb'],
         meses:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
         largos:['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                 'septiembre','octubre','noviembre','diciembre'] },
    en:{ dias:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
         cortos:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
         meses:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
         largos:['January','February','March','April','May','June','July','August',
                 'September','October','November','December'] }
  };
  function fechas(){ return FECHAS[resuelve()] || FECHAS.es; }

  /* El conmutador. Lo pinta el propio ayudante para que no haya tres copias
     del mismo botón en tres pantallas. Cambiar de idioma recarga: es una vez
     por visita, y recargar es más honesto que repintar media pantalla y
     dejarse un texto sin cambiar. */
  var CSS = '.sincIdi{display:inline-flex;gap:0;border:1.5px solid rgba(255,255,255,.35);'
    + 'border-radius:999px;overflow:hidden;flex:none}'
    + '.sincIdi button{font-family:Oswald,system-ui,sans-serif;font-weight:600;font-size:11px;'
    + 'letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border:0;cursor:pointer;'
    + 'background:transparent;color:inherit;opacity:.65;line-height:1.6}'
    + '.sincIdi button.on{background:#F2682A;color:#fff;opacity:1}'
    + '.sincIdi.claro{border-color:#E6DFD6}'
    + '.sincIdi.claro button{color:#6E665C}';

  function conmutador(donde){
    var el = typeof donde === 'string' ? document.getElementById(donde) : donde;
    if(!el) return;
    if(!document.getElementById('sincIdiCss')){
      var st=document.createElement('style'); st.id='sincIdiCss'; st.textContent=CSS;
      document.head.appendChild(st);
    }
    var hoy = resuelve();
    el.className = 'sincIdi' + (el.getAttribute('data-claro')!=null ? ' claro' : '');
    el.innerHTML = '';
    VIVOS.forEach(function(l){
      var b=document.createElement('button');
      b.type='button'; b.textContent=l.toUpperCase();
      b.setAttribute('lang',l);
      b.setAttribute('aria-label', l==='es'?'Español':'English');
      if(l===hoy) b.className='on';
      b.onclick=function(){
        if(l===resuelve()) return;
        pon(l);
        /* Se conserva todo lo que traía la URL -la reserva, el código del
           hotel- y solo se fija el idioma. */
        try{
          var u=new URL(location.href); u.searchParams.set('lang',l);
          location.replace(u.toString());
        }catch(_){ location.reload(); }
      };
      el.appendChild(b);
    });
  }

  /* Se apunta qué idioma pide el navegador del huésped -solo el código, un
     contador agregado, ni quién ni cuándo- para que dentro de unos meses el
     tercer idioma se elija con datos y no a ojo. Si falla, da igual: esto no
     puede romper una pantalla. */
  var APUNTADO = false;
  function apunta(pantalla){
    if(APUNTADO) return; APUNTADO = true;
    var crudo = '';
    try{ crudo = (navigator.languages && navigator.languages[0]) || navigator.language || ''; }catch(_){}
    if(!crudo) return;
    try{
      fetch(SB+'/rest/v1/rpc/i18n_apunta_navegador',{
        method:'POST', keepalive:true,
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_idioma:String(crudo),p_pantalla:pantalla||'otra'})
      }).catch(function(){});
    }catch(_){}
  }

  window.sincI18n = {
    idioma: resuelve,
    pon: pon,
    vivos: function(){ return VIVOS.slice(); },
    aplica: aplica,
    aplicaUna: aplicaUna,
    conmutador: conmutador,
    apunta: apunta,
    t: t,
    barre: barre,
    titulo: titulo,
    fechas: fechas,
    /* Para que el <html lang> diga la verdad desde el primer pintado. */
    marca: function(){ try{ document.documentElement.lang = resuelve(); }catch(_){} }
  };
  window.sincI18n.marca();
  /* El titulo se traduce al cargar y otra vez cuando el DOM esta listo: hay
     pantallas que lo reescriben con el nombre de la experiencia. */
  try{ titulo(); }catch(_){}
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ try{ titulo(); }catch(_){} });
  }
})();
