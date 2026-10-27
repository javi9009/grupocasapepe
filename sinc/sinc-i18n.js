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
      /* eventos de entrada libre: se apartan, no se pagan */
      'Apartar mi lugar':'Hold my spot',
      'Sin costo':'Free',
      'No se cobra nada: apartas tu lugar y te mandamos el pase con tu QR.':
        'Nothing is charged: you hold your spot and we send you your pass with its QR.',
      'Otros eventos':'More events',
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
      /* El pick up, la cortesia por propina y la tercera figura fiscal. 27-oct-2026. */
      'Dinos en qué hotel te recogemos.':'Tell us which hotel to pick you up from.',
      'Este tour es por propina para huéspedes: a ti no se te cobra. Apartas tu lugar y te mandamos el pase.':'This tour is tip-based for guests, so there’s no charge for you. You hold your spot and we send you the pass.',
      'Hotel y dirección donde te recogemos':'Hotel and address where we pick you up',
      'No pudimos abrir el evento. Vuelve a intentarlo.':'We couldn’t open the event. Please try again.',
      'Pasamos por ti':'We come get you',
      'Persona física sin actividad empresarial':'Individual with no business activity (persona física sin actividad empresarial)',
      'Pick up en el hotel':'Hotel pick-up',
      'la hora puede variar ±30 min y te la confirmamos la noche anterior':'the time may shift by ±30 min and we confirm it the night before',
      'minutos antes de la salida':'minutes before departure',
      /* Huecos de Sincretico: mapa, coleccion de muertos, el pick up y el porcentaje a la comunidad. 27-oct-2026. */
      '% de lo que pagas se queda en la comunidad':'% of what you pay stays in the community',
      'Abriendo la colección…':'Opening the collection…',
      'Ciudad':'City',
      'En la Guía':'In the Guide',
      'Lo que la ciudad hace cuando vuelven.':'What the city does when they come back.',
      'Pasamos por ti a tu hotel':'We pick you up at your hotel',
      'Te recogemos en tu hotel. Al reservar nos dices dónde te quedas.':'We pick you up at your hotel. You tell us where you’re staying when you book.',
      'Versión 1':'Version 1',
      'así se vería tu evento':'this is how your event would look',
      '★ Una estrella':'★ One star',
      '📍 Abrir en Google Maps':'📍 Open in Google Maps',
      /* Los chips abreviados de impacto en la portada. 27-oct-2026. */
      'Ambiente':'Environment',
      'Economía':'Economy',
      /* El mapa: el contador filtrado y el boton de la lista de Google. 27-oct-2026. */
      'que recomendamos de eso.':'that we recommend for that.',
      '» en Google Maps':'» in Google Maps',
      '📍 Abrir «':'📍 Open «',
      /* El aviso de cortesia del pago y la ficha de ejemplo del evento. 27-oct-2026. */
      ', las de tu reserva.':', the ones on your booking.',
      'Quien te va a reservar':'Whoever is booking',
      'Vamos dos, uno en silla de ruedas.':'Two of us, one in a wheelchair.',
      /* Titulos de pestana que se quedaban a medias. 27-oct-2026. */
      'App del Ateneísta':'Ateneísta App',
      'Darse de alta':'Sign up',
      'Firmar el convenio del premio':'Sign the prize agreement',
      'IR VENIMOS — Colección Día de Muertos':'IR VENIMOS — Day of the Dead collection',
      'así se ve una página llena':'this is how a full page looks',
      'la productora':'the producer',
      'tu app':'your app',
      /* La descripcion de cada pantalla, que es lo que se lee al compartir la liga. 27-oct-2026. */
      'Compra tus boletos para eventos en el Ateneo de Virreyes.':'Buy your tickets for events at the Ateneo de Virreyes.',
      'Coworking del Ateneo de Virreyes: por un día o por una semana.':'Coworking at the Ateneo de Virreyes: for a day or for a week.',
      'Dónde estás en la Ciudad de México y qué te recomendamos a la vuelta.':'Where you are in Mexico City and what we recommend around the corner.',
      'Eventos en el Ateneo de Virreyes, Ciudad de México.':'Events at the Ateneo de Virreyes, Mexico City.',
      'Experiencias con gente de aquí, en la Ciudad de México.':'Experiences with people from here, in Mexico City.',
      'La puerta del Ateneo de Virreyes: ateneístas, productoras, equipo y residentes.':'The door into the Ateneo de Virreyes: ateneístas, producers, team and residents.',
      'Lo que la Ciudad de México hace cuando vuelven: desfiles, catrinas, alebrijes y una noche que no se parece a ninguna otra del año.':'What Mexico City does when they come back: parades, catrinas, alebrijes and a night like no other in the year.',
      'Quién programa en el Ateneo de Virreyes, y qué tiene a la venta.':'Who programmes at the Ateneo de Virreyes, and what they have on sale.',
      'Talleres, caminatas y encuentros con gente de aquí. Ciudad de México.':'Workshops, walks and encounters with people from here. Mexico City.',
      'Un ejemplo de ficha de evento en Sincrético.':'A sample event page on Sincrético.',
      'Un ejemplo de página de productora en Sincrético, llena de arriba a abajo.':'A sample producer page on Sincrético, filled in from top to bottom.',
      /* El catalogo de lo que incluye y lo que no, y los idiomas del tour: son listas cortas y controladas, asi que viven en el diccionario y no en la tabla de traducciones. 27-oct-2026. */
      'Alemán':'German',
      'Alimentos descritos':'The food described',
      'Alimentos y bebidas':'Food and drinks',
      'Bebidas alcohólicas':'Alcoholic drinks',
      'Bebidas descritas':'The drinks described',
      'Bicicleta':'Bicycle',
      'Boletos y accesos a los sitios visitados':'Tickets and entry to the places visited',
      'Comidas no descritas':'Meals not described',
      'Degustación':'Tasting',
      'Español':'Spanish',
      'Fotos':'Photos',
      'Francés':'French',
      'Gastos personales':'Personal expenses',
      'Guía':'Guide',
      'Indumentaria específica':'The gear you need',
      'Inglés':'English',
      'Italiano':'Italian',
      'Náhuatl':'Nahuatl',
      'Portugués':'Portuguese',
      'Propinas':'Tips',
      'Seguro':'Insurance',
      'Snack de bienvenida':'Welcome snack',
      'Souvenirs y compras':'Souvenirs and shopping',
      'Transporte al punto de encuentro':'Transport to the meeting point',
      'Transporte propio':'Our own transport',
      'Transporte redondo':'Round-trip transport',
      'Traslado al hotel':'Hotel transfer',
      /* El desglose del precio: sus rotulos viven en la funcion de Postgres, no en una tabla, asi que se traducen aqui. 27-oct-2026. */
      'A la gente que pone el trabajo':'To the people who do the work',
      'Bono a la persona que te lo vendió':'A bonus for the person who sold it to you',
      'Costes de operación':'Operating costs',
      'De nuestra comisión, directo a la comunidad local':'Out of our own commission, straight to the local community',
      'El canal que te trajo':'The channel that brought you',
      'El hotel':'The hotel',
      'Guías, materiales y su margen':'Guides, materials and their margin',
      'ISR y retenciones de toda la cadena':'Income tax and withholdings along the whole chain',
      'La operadora':'The operator',
      'La plataforma':'The platform',
      'Llegue por quien llegue: la operadora, el hotel o nosotros':'However it gets there: the operator, the hotel or us',
      'Lo que cuesta que el tour ocurra y se venda':'What it costs to make the tour happen and to sell it',
      'Lo que pone Sincrético':'What Sincrético puts in',
      'Lo que reparte la operadora':'What the operator passes on',
      'Meta':'Target',
      'Otros impuestos y tasas de operación':'Other taxes and operating levies',
      'Precio neto final':'Final net price',
      'Quien te atendió':'Whoever served you',
      'Reservas, cobro y soporte':'Bookings, payment and support',
      'Se entera al SAT':'Paid to the SAT, the Mexican tax office',
      'Sobre esto se reparte todo':'Everything is split out of this',
      'Stripe y el banco, sobre el cobro':'Stripe and the bank, on the charge',
      /* Que llevar y quien cobra: dos listas cortas que viven en columnas de tipo lista, no en campos de texto, asi que se traducen aqui. 27-oct-2026. */
      'Agua':'Water',
      'Chofer':'Driver',
      'Frutero':'Fruit seller',
      'Gorra':'A cap',
      'Impermeable':'A raincoat',
      'Meseras':'Waitresses',
      'Metro':'The Metro',
      'Nuestros guías':'Our guides',
      'Papelería Sajid - Flyer':'Papelería Sajid · flyers',
      'Protector solar':'Sunscreen',
      'Ropa abrigada':'Warm clothes',
      'Sitio Arqueológico':'The archaeological site',
      'Vendedor Ambulante':'Street vendor',
      'Vendedor michelada':'Michelada vendor',
      'Zapato cómodo':'Comfortable shoes',
      'sombrilla':'an umbrella',
      'vendedores por comisión':'vendors on commission',
      /* El filtro de la galeria. 27-oct-2026. */
      'Categoría':'Category',
      /* Lo que incluye cada plan del coworking: es una lista, no un campo de texto, asi que va al diccionario. 27-oct-2026. */
      '+6 meses incluye Domicilio Fiscal':'From 6 months, a registered tax address is included',
      '4 espacios: deck de 1.4m x 1m':'4 spots: 1.4m x 1m desks',
      '4 lockers':'4 lockers',
      '4 sillas ergonómicas':'4 ergonomic chairs',
      '5 espacios: deck de 1.4m x 1m':'5 spots: 1.4m x 1m desks',
      '5 lockers':'5 lockers',
      '5 sillas ergonómicas':'5 ergonomic chairs',
      '6 day pass al mes':'6 day passes a month',
      'Cine 3 h/mes':'Cinema, 3 h/month',
      'Cine 6 h/mes':'Cinema, 6 h/month',
      'Cocina comunitaria':'Community kitchen',
      'Espacio: deck de 1.4m x 1m':'A spot: a 1.4m x 1m desk',
      'Espacio: zona coworking':'A spot in the coworking area',
      'Locker':'A locker',
      'Oficina 4 lugares':'Office for 4',
      'Oficina 5 lugares':'Office for 5',
      'Oficina Virtual':'Virtual Office',
      'Oficina privada de 20 m2':'A 20 m² private office',
      'Plan Day Pass':'Day Pass',
      'Plan Semanal':'Weekly plan',
      'Sala de juntas 16 h/semana':'Meeting room, 16 h/week',
      'Sala de juntas 2 h/semana':'Meeting room, 2 h/week',
      'Sala de juntas 3 h/semana':'Meeting room, 3 h/week',
      'Sala de juntas 8 h/semana':'Meeting room, 8 h/week',
      'Sala de podcast 2 h/mes':'Podcast studio, 2 h/month',
      'Sala de podcast 4 h/mes':'Podcast studio, 4 h/month',
      'Sala de podcast 6 h/mes':'Podcast studio, 6 h/month',
      'Silla ergonómica':'An ergonomic chair',
      /* La pantalla de firma del contrato del operador. El cuerpo del contrato se queda en espanol a proposito: es el documento que obliga. 27-oct-2026. */
      ' Si vuelve a pasar, escríbenos y lo resolvemos.':' If it happens again, write to us and we’ll sort it out.',
      ' el ':' on ',
      '. Esta página es tu copia: puedes imprimirla o guardarla en PDF.':'. This page is your copy: you can print it or save it as a PDF.',
      'Abriendo el contrato…':'Opening the contract…',
      'Al firmar se guarda la fecha, tu IP y tu navegador como acuse, y te mandamos copia por correo.':'When you sign, we record the date, your IP and your browser as the receipt, and we email you a copy.',
      'Contrato firmado.':'Contract signed.',
      'Contrato · Sincrético':'Contract · Sincrético',
      'Esta liga está incompleta. Abre la que te llegó por correo, entera.':'This link is incomplete. Open the whole one that came to you by email.',
      'Firmar':'Sign',
      'Firmar el contrato':'Sign the contract',
      'Leí este contrato completo, los datos del Anexo A son míos y son correctos, y acepto sus términos.':'I have read this contract in full, the details in Annex A are mine and are correct, and I accept its terms.',
      'Lo firmó ':'Signed by ',
      'No encontramos ese contrato: ':'We couldn’t find that contract: ',
      'No se pudo (HTTP ':'It didn’t work (HTTP ',
      'No se pudo firmar: ':'We couldn’t sign it: ',
      'Razón social':'Registered company name',
      'Registro Nacional de Turismo':'Registro Nacional de Turismo (Mexican tourism registry)',
      'Revisa que tus datos estén bien. Lo que corrijas aquí queda en el contrato.':'Check that your details are right. Whatever you correct here goes into the contract.',
      'Titular de la cuenta':'Account holder',
      'Todavía no puedes firmarlo.':'You can’t sign it yet.',
      'Tu nombre completo, como firma':'Your full name, as your signature',
      /* La pagina publica de la productora, que no tenia nada. 27-oct-2026. */
      '1 noche':'1 night',
      'Abriendo la ficha…':'Opening the page…',
      'Casa Pepe CDMX · Centro Histórico':'Casa Pepe Mexico City · Centro Histórico',
      'Casa Pepe Puebla · Centro':'Casa Pepe Puebla · Centro',
      'Casa Pepe está a unas calles del Ateneo, en el Centro Histórico. Reservando desde aquí va el código <b>SUPERPEPE</b>: welcome y nuestro walking tour diario incluidos.':'Casa Pepe is a few streets from the Ateneo, in the Centro Histórico. Booking from here carries the code <b>SUPERPEPE</b>: welcome drink and our daily walking tour included.',
      'Casa Pepe está a unas calles del Ateneo, en el Centro Histórico. Te pusimos las fechas de la próxima función —llegada la víspera, salida al día siguiente—; cámbialas si quieres. Reservando desde aquí va el código <b>SUPERPEPE</b>: welcome y nuestro walking tour diario incluidos.':'Casa Pepe is a few streets from the Ateneo, in the Centro Histórico. We filled in the dates of the next performance — arriving the night before, leaving the day after; change them if you like. Booking from here carries the code <b>SUPERPEPE</b>: welcome drink and our daily walking tour included.',
      'Elige las fechas.':'Pick your dates.',
      'En cuanto el Ateneo autorice la siguiente, aparece aquí y se puede reservar desde esta misma página.':'As soon as the Ateneo approves the next one, it shows up here and can be booked from this same page.',
      'Entrada':'Check-in',
      'Esa liga de vista previa no vale. Ábrela desde tu portal.':'That preview link isn’t valid. Open it from your portal.',
      'Esta ficha todavía no es pública. ':'This page isn’t public yet. ',
      'Falta decir qué productora.':'You need to say which producer.',
      'Las que se pueden reservar cualquier día.':'The ones you can book any day.',
      'Leer más':'Read more',
      'Lo que tenemos a la venta':'What we have on sale',
      'Lo que ya hicimos':'What we have already done',
      'Los protagonistas':'On stage',
      'No pudimos abrir la ficha. ':'We couldn’t open the page. ',
      'Nuestra historia':'Our story',
      'Pedir desde la app del Ateneo →':'Order from the Ateneo app →',
      'Pide de nuestra carta desde donde estés en el Ateneo y te lo subimos a tu sala.':'Order from our menu wherever you are in the Ateneo and we bring it up to your room.',
      'Quién lo monta':'Who puts it together',
      'Quién se sube al escenario.':'Who gets up on stage.',
      'República de Uruguay 86, Centro Histórico, a unas calles del Ateneo':'República de Uruguay 86, Centro Histórico, a few streets from the Ateneo',
      'Salida':'Check-out',
      'Su galería':'Their gallery',
      'Sus experiencias':'Their experiences',
      'Síguenos':'Follow us',
      'Todavía no hay fechas publicadas.':'No dates published yet.',
      'Ver habitaciones y precios →':'See rooms and prices →',
      'Vista previa de tu página · <b>todavía no está publicada</b>: así quedará cuando el Ateneo la abra. Sólo tú ves esto.':'Preview of your page · <b>not published yet</b>: this is how it will look once the Ateneo opens it. Only you can see this.',
      'Vista previa de tu página · ya está <b>publicada</b>, esto es lo que ve la gente.':'Preview of your page · it is already <b>published</b>, this is what people see.',
      '¿Vienes de fuera?':'Coming from out of town?',
      /* Los roles de la productora, las secciones del room service y el plural de noche. 27-oct-2026. */
      'Baguetes':'Baguettes',
      'Desayunos':'Breakfast',
      'Panadería':'Bakery',
      'Tisanas y tés':'Teas and infusions',
      'Titular de la productora':'Head of the production company',
      'noches':'nights',
      /* La pagina de ejemplo de la productora. 27-oct-2026. */
      'Así se ve una página llena. Esta productora no existe: es para que veas a qué aspirar.':'This is what a full page looks like. This producer doesn’t exist: it’s here so you can see what to aim for.',
      'En la tuya, cada una es una liga de verdad. Lo que dejes vacío no sale.':'On yours, each one is a real link. Whatever you leave empty doesn’t show.',
      'Los eventos pasados bajan aquí solos, sin precio. Sirven para que quien te lee sepa qué clase de cosas montas.':'Past events drop down here by themselves, with no price. They’re there so whoever reads you knows the kind of thing you put on.',
      'Nadie sale por defecto: en tu página marcas tú a cada quien.':'Nobody shows by default: on your page you mark each person yourself.',
      'Pulsa cualquiera y verás la ficha del evento como la ve quien va a reservar. Entran solas en cuanto el Ateneo las publica: eso no lo tienes que hacer tú.':'Tap any of them and you’ll see the event page as the person booking sees it. They appear by themselves as soon as the Ateneo publishes them: that isn’t something you have to do.',
      '← Volver a mi portal':'← Back to my portal',
      /* El ejemplo de correo en la puerta de entrar. 27-oct-2026. */
      'tu@correo.com':'you@email.com',
      /* El alta del ateneista, entera. Se traduce por nodo de texto porque la pantalla se construye desde el JS paso a paso. 27-oct-2026. */
      '. Cada una lleva su anexo.':'. Each one has its own annex.',
      '. Si tu convenio dice otra cosa, lo editamos antes de publicarte nada.':'. If your agreement says otherwise, we edit it before publishing anything of yours.',
      '10% a quien vende · 10% a la plataforma · 5% a la casa':'10% to whoever sells · 10% to the platform · 5% to the house',
      'ASEGURADORA':'INSURER',
      'Anticipo y resto contigo':'Deposit with us, the rest with you',
      'Apúntala y te avisamos cuando se acerque su vencimiento.':'Note it down and we’ll warn you as the expiry date approaches.',
      'Aquí llegan las reservas y lo de último momento.':'This is where the bookings and the last-minute things arrive.',
      'Artesanía':'Craft',
      'CIUDAD':'CITY',
      'CORREO':'EMAIL',
      'CORREO PARA LOS AVISOS DE RESERVA · OPCIONAL':'EMAIL FOR BOOKING NOTICES · OPTIONAL',
      'CURP':'CURP',
      'CUÁNTOS CUARTOS':'HOW MANY ROOMS',
      'Centro Histórico, Roma, Condesa, Coyoacán…':'Centro Histórico, Roma, Condesa, Coyoacán…',
      'Cobramos el anticipo al reservar y el resto lo cobras tú el día del tour. Si eliges esto no te pedimos Stripe.':'We charge the deposit at booking and you charge the rest on the day of the tour. If you choose this, we don’t ask you for Stripe.',
      'Cómo se cobra':'How it is charged',
      'Cómo te localizamos':'How we reach you',
      'Cómo te pagamos':'How we pay you',
      'Dale a «Darme de alta» aquí abajo.':'Tap «Sign me up» down here.',
      'De cada venta: 10% para quien la vende, 10% para la plataforma y 5% para la casa que la aloja. Si lo tuyo es distinto, se escribe aquí antes de firmar.':'Out of each sale: 10% to whoever sells it, 10% to the platform and 5% to the house that hosts it. If yours is different, it is written in here before signing.',
      'De responsabilidad civil. Si no tienes, la de la casa te cubre: esto avisa, nunca bloquea.':'Public liability. If you don’t have one, the house’s policy covers you: this is a heads-up, never a blocker.',
      'De tu puño y letra: con el dedo si estás en el teléfono, o con el ratón. Es la misma firma que se le pide a todos.':'In your own hand: with your finger on a phone, or with the mouse. It is the same signature everyone is asked for.',
      'Dinos en qué plaza vendes.':'Tell us which city you sell in.',
      'Dinos si tienes póliza.':'Tell us whether you have a policy.',
      'Dónde vendes':'Where you sell',
      'El convenio':'The agreement',
      'El de la persona que firma, no el de la empresa.':'The person signing, not the company.',
      'El dinero cae directo en tu cuenta al cobrarse, y la comisión se retiene sola. Tus datos bancarios y fiscales los escribes tú en Stripe: aquí no se piden ni se guardan.':'The money lands straight in your account when it is charged, and the commission is withheld automatically. You enter your bank and tax details in Stripe yourself: we neither ask for them nor store them here.',
      'El dinero de lo que vendes te llega en el momento de la venta.':'The money from what you sell reaches you at the moment of the sale.',
      'Elige cómo te pagamos.':'Choose how we pay you.',
      'Empresa (persona moral)':'Company (persona moral)',
      'Eres ateneísta porque produces o porque tienes tu membresía. Las dos valen igual.':'You are an ateneísta either because you produce, or because you hold a membership. Both count the same.',
      'Es el que va a ver el cliente.':'It is the one the customer will see.',
      'Experiencias · Eventos · Hotel · Artesanía · Membresía. Cada una lleva su anexo.':'Experiences · Events · Hotel · Craft · Membership. Each one has its own annex.',
      'Experiencias. Cada una lleva su anexo.':'Experiences. Each one has its own annex.',
      'Falta el correo.':'The email is missing.',
      'Falta el nombre de quien firma.':'The name of the person signing is missing.',
      'Falta el nombre.':'The name is missing.',
      'Falta mandarlo.':'It still needs to be sent.',
      'Haces piezas que se pueden vender en la tienda.':'You make pieces that can be sold in the shop.',
      'INSTAGRAM · OPCIONAL':'INSTAGRAM · OPTIONAL',
      'La plaza manda: decide quién te atiende y dónde se vende lo tuyo.':'The city decides: who looks after you, and where your work is sold.',
      'La reserva la tiene Casa Pepe y es quien responde ante el cliente. Las devoluciones, las cancelaciones y el cobro los llevamos nosotros. Tú respondes de que la actividad se dé como la describiste.':'The booking is held by Casa Pepe, and Casa Pepe is who answers to the customer. Refunds, cancellations and payment are handled by us. You answer for the activity happening as you described it.',
      'Lo normal del Grupo es':'The Group’s standard is',
      'Lo que marques en el primer paso decide qué te preguntamos después.':'What you tick in the first step decides what we ask you afterwards.',
      'Lo que nos permite facturarte y responder por lo que vendes.':'What lets us invoice you and answer for what you sell.',
      'Lo que se reparte':'How it is split',
      'Marca al menos una.':'Tick at least one.',
      'Membresía. Cada una lleva su anexo.':'Membership. Each one has its own annex.',
      'NACIONALIDAD':'NATIONALITY',
      'NOMBRE CON EL QUE TE CONOCEN':'THE NAME PEOPLE KNOW YOU BY',
      'No hay cobro: vienes por tu membresía.':'There is nothing to charge: you are here on your membership.',
      'No tengo y no la quiero por ahora':'I don’t have one and don’t want one for now',
      'No tengo, quiero que me coticen':'I don’t have one, I’d like a quote',
      'No tienes póliza propia; te cubre la de la casa.':'You have no policy of your own; the house’s policy covers you.',
      'NÚMERO':'NUMBER',
      'Paso 1 de 7':'Step 1 of 7',
      'Persona física con actividad empresarial':'Individual with business activity (persona física con actividad empresarial)',
      'Publicar':'Publishing',
      'Puebla y Cholula':'Puebla and Cholula',
      'Puedes marcar varias, y añadir más después sin volver a empezar.':'You can tick several, and add more later without starting again.',
      'QUIÉN FIRMA · NOMBRE COMPLETO':'WHO SIGNS · FULL NAME',
      'QUIÉN RESPONDE · NOMBRE Y PUESTO':'WHO IS ANSWERABLE · NAME AND ROLE',
      'Quién eres':'Who you are',
      'Quién responde ante el cliente':'Who answers to the customer',
      'Quiénes':'Who',
      'Qué se reparte':'What is split',
      'Qué traes':'What you bring',
      'RAZÓN SOCIAL':'REGISTERED COMPANY NAME',
      'Si lo dejas vacío usamos el de arriba.':'If you leave it empty we use the one above.',
      'Si operas en las dos, empieza por una: la otra la abrimos nosotros con una ficha aparte, porque las ventas y los equipos son distintos.':'If you work in both, start with one: we open the other ourselves as a separate record, because the sales and the teams are different.',
      'Siguiente →':'Next →',
      'Sí tengo':'I have one',
      'TU ALTA':'YOUR SIGN-UP',
      'TU FIRMA':'YOUR SIGNATURE',
      'Te atiende el equipo de Puebla.':'The Puebla team looks after you.',
      'Te cubre la de la casa.':'The house’s policy covers you.',
      'Te pasamos una cotización. Mientras tanto te cubre la de la casa.':'We’ll send you a quote. In the meantime the house’s policy covers you.',
      'Tienes póliza propia de responsabilidad civil.':'You have your own public liability policy.',
      'Tienes un hotel o un grupo de hoteles. Das de alta tus espacios y vendes a tus huéspedes.':'You have a hotel, or a group of hotels. You register your spaces and sell to your guests.',
      'Tours, talleres, recorridos. Tú los guías, nosotros te traemos clientes.':'Tours, workshops, walks. You guide them, we bring you the customers.',
      'Tu Stripe':'Your Stripe',
      'Tu hotel':'Your hotel',
      'Tu lugar en el espacio común del Ateneo de Virreyes. Sin costo.':'Your spot in the shared space at the Ateneo de Virreyes. Free of charge.',
      'Tu póliza':'Your insurance',
      'Tú creas lo tuyo cuando quieras. Publicarlo lo aprobamos nosotros: revisamos que lo que ve el cliente coincida con lo que va a recibir.':'You create your own things whenever you like. Publishing them is approved by us: we check that what the customer sees matches what they are going to get.',
      'Un grupo de hoteles no es un hotel. Si tienes varias casas, da de alta el grupo: después cuelgas cada una.':'A group of hotels is not a hotel. If you have several houses, register the group: you hang each one off it afterwards.',
      'Un grupo o cadena':'A group or chain',
      'Un hotel':'One hotel',
      'Una función, un concierto, una noche. En tu espacio o en el nuestro.':'A show, a concert, one night. In your space or in ours.',
      'Una persona física sin actividad empresarial no tiene RFC. No te lo pedimos.':'An individual with no business activity has no RFC. We don’t ask you for one.',
      'Uno solo, con un anexo por cada cosa que traes. Se arma con lo que acabas de escribir.':'Just one, with an annex for each thing you bring. It is built from what you have just written.',
      'VIGENTE HASTA':'VALID UNTIL',
      'WEB · OPCIONAL':'WEBSITE · OPTIONAL',
      'WHATSAPP':'WHATSAPP',
      'Ya casi':'Almost there',
      '¿CÓMO FACTURAS?':'HOW DO YOU INVOICE?',
      '¿Cómo te localizamos?':'How do we reach you?',
      '¿Cómo te pagamos?':'How do we pay you?',
      '¿Dónde vendes?':'Where do you sell?',
      '¿QUÉ DAS DE ALTA?':'WHAT ARE YOU REGISTERING?',
      '¿Qué traes a la comunidad?':'What do you bring to the community?',
      '—, con los datos de arriba, y el Ateneo Turístico / Sincrético, del Grupo Casa Pepe.':'—, with the details above, and Ateneo Turístico / Sincrético, of Grupo Casa Pepe.',
      '← Atrás':'← Back',
      /* Titulos de pestana de las altas. 27-oct-2026. */
      'Mi comunidad':'My community',
      'Sube tus experiencias':'Upload your experiences',
      'Sé parte del Ateneo':'Be part of the Ateneo',
      'Tu ficha de guía':'Your guide page',
      'Vende tus piezas':'Sell your pieces',
      /* El contador de pasos y los botones del alta. 27-oct-2026. */
      'Darme de alta':'Register me',
      'Firmar y darme de alta':'Sign and register me',
      'Paso':'Step',
      /* Las altas del touroperador y del artesano, la ficha del guia y el portal de la comunidad. 27-oct-2026. */
      '$100 son tuyos':'$100 are yours',
      '(si tienes)':'(if you have one)',
      ', y el precio lo pones tú. El fondo común es de la comunidad, no nuestro: se junta para viajar a la ciudad — ferias, mercados, congresos. Nosotros lo guardamos y lo enseñamos; no lo gastamos.':', and you set the price. The shared fund belongs to the community, not to us: it builds up to travel to the city — fairs, markets, conferences. We keep it and we show it; we don’t spend it.',
      ': la persona que los viajeros van a conocer. Lo que pongas aquí es lo que leen antes de reservar, así que vale la pena cuidarlo.':': the person the travellers are going to meet. What you put here is what they read before booking, so it is worth looking after.',
      'Abriendo tu ficha…':'Opening your page…',
      'Acepto los':'I accept the',
      'Acepto que Casa Pepe venda mis piezas con el 35% encima de mi precio: 20% Sincrético, 10% el hotel donde se venda y 5% al fondo común de mi comunidad.':'I agree that Casa Pepe may sell my pieces with 35% on top of my price: 20% Sincrético, 10% the hotel where it is sold and 5% to my community’s shared fund.',
      'Acomodar la foto':'Position the photo',
      'Agotada':'Sold out',
      'Alias':'Alias',
      'Apellidos':'Surname(s)',
      'Aquí te llega la liga para continuar tu alta.':'This is where the link to carry on your sign-up arrives.',
      'Artesano':'Artisan',
      'Así te saludamos en los correos y en el chat.':'This is how we greet you in emails and in the chat.',
      'Ateneista':'Ateneísta',
      'Centro y Cholula':'Centro and Cholula',
      'Como quieres que lo lea quien te compre':'How you want whoever buys from you to read it',
      'Compensa el costo de la renta de tu nueva oficina con el pago de comisiones, o poniendo uno de nuestros hoteles como inicio o fin de tu tour.':'Offset the rent of your new office with the commissions you pay, or by making one of our hotels the start or the end of your tour.',
      'Con tu correo y esta contraseña entras cuando quieras a cambiar tu foto o tu texto.':'With your email and this password you can come in whenever you like to change your photo or your text.',
      'Coworking en el Centro, sala para recibir a tus grupos y tarifas de amigo en el hotel. Consulta condiciones con nosotros.':'Coworking in the Centro, a room to receive your groups, and friends’ rates at the hotel. Ask us about the conditions.',
      'Crea tu acceso':'Create your login',
      'Crear mi acceso':'Create my login',
      'Crear mi contraseña y entrar':'Create my password and go in',
      'Crear mi cuenta':'Create my account',
      'Créala ahora':'Create it now',
      'Cuéntalo en tus palabras':'Tell it in your own words',
      'Dar de alta a alguien':'Register someone',
      'Dar de alta y generar su liga':'Register them and create their link',
      'Darme de alta':'Register me',
      'Date de alta y súbelas desde tu teléfono. Tú pones tu precio.':'Sign up and upload them from your phone. You set your price.',
      'De cada $135,':'Out of every $135,',
      'Desde tu teléfono puedes usar la cámara. Una foto tuya, de frente, donde se te reconozca. Tú la acomodas antes de que se guarde.':'On your phone you can use the camera. A photo of you, facing forward, where you are recognisable. You position it before it is saved.',
      'Después te llamamos para terminar tu cuenta y enseñarte a subir tus piezas.':'We’ll call you afterwards to finish your account and show you how to upload your pieces.',
      'El coworking del Ateneo Turístico':'The Ateneo Turístico coworking',
      'El hotel donde se vende':'The hotel where it is sold',
      'El huésped paga':'The guest pays',
      'Elige el país':'Choose the country',
      'Elige una contraseña':'Choose a password',
      'Entra para administrar a tu gente y sus piezas.':'Sign in to manage your people and their pieces.',
      'Entrar a Sincrético':'Sign in to Sincrético',
      'Eres':'You are',
      'Es tu decisión, y la puedes cambiar cuando quieras. Si lo dejas sin marcar, nadie lo ve.':'It is your choice, and you can change it whenever you like. If you leave it unticked, nobody sees it.',
      'Escribe como hablas. Tres o cuatro líneas bastan: de dónde eres, qué haces y por qué lo haces.':'Write the way you speak. Three or four lines are enough: where you are from, what you do and why you do it.',
      'Falta tu liga personal. Ábrela desde el correo que te llegó.':'Your personal link is missing. Open it from the email you were sent.',
      'Fondo común de la comunidad':'The community’s shared fund',
      'Gracias':'Thank you',
      'Guardar y entrar':'Save and go in',
      'Guías, artesanos o productores. Solo quien administra la comunidad puede hacerlo.':'Guides, artisans or producers. Only whoever manages the community can do this.',
      'Hola':'Hi',
      'Instagram · opcional':'Instagram · optional',
      'Izazaga 8, Centro Histórico · a unas calles de donde arrancan casi todos los tours.':'Izazaga 8, Centro Histórico · a few streets from where almost every tour starts.',
      'Lo usamos para avisarte cuando se venda algo tuyo.':'We use it to let you know when something of yours sells.',
      'Me interesa':'I’m interested',
      'Mi comunidad':'My community',
      'Mostrar la contraseña':'Show the password',
      'Más pedido':'Most ordered',
      'México':'Mexico',
      'Mínimo 8 caracteres. Con ella entras a tu cuenta.':'At least 8 characters. You use it to get into your account.',
      'Nombre(s)':'First name(s)',
      'Nuestra gente':'Our people',
      'Omitir':'Skip',
      'Para operadores de Sincrético':'For Sincrético operators',
      'Pegar una liga':'Paste a link',
      'Precios de lanzamiento · sujetos a disponibilidad':'Launch prices · subject to availability',
      'Productor':'Producer',
      'Puedes cerrar esta página.':'You can close this page.',
      'Quiero que mi teléfono aparezca en mis piezas, para que quien me compre pueda escribirme.':'I want my phone number to appear on my pieces, so whoever buys from me can write to me.',
      'Repítela':'Type it again',
      'Rol':'Role',
      'Será tu usuario para entrar, y ahí te avisamos de cada reserva.':'It will be your username to sign in, and where we tell you about each booking.',
      'Si lo pones, sale en tu ficha y la gente puede seguirte.':'If you add it, it shows on your page and people can follow you.',
      'Si tu foto ya está en internet, pega aquí la liga.':'If your photo is already online, paste the link here.',
      'Si tus piezas ya están en la tienda, escríbelo igual y las juntamos con tu cuenta.':'If your pieces are already in the shop, write it anyway and we’ll join them to your account.',
      'Sincrético · Grupo Casa Pepe':'Sincrético · Grupo Casa Pepe',
      'Sincrético, por venderlo':'Sincrético, for selling it',
      'Solo esto para empezar. Los datos fiscales, el seguro y el contrato se llenan después.':'Just this to begin with. The tax details, the insurance and the contract are filled in later.',
      'Soy chef, nací en Oaxaca y llevo doce años cocinando mole…':'I’m a chef, I was born in Oaxaca and I’ve been cooking mole for twelve years…',
      'Sube tus experiencias a Sincrético':'Upload your experiences to Sincrético',
      'Subir una foto':'Upload a photo',
      'Te invitaron a tu comunidad. Pon un correo y una contraseña para entrar cuando quieras.':'You have been invited to your community. Set an email and a password so you can come in whenever you like.',
      'Tienes condiciones especiales en el coworking y en los eventos del Ateneo. Consulta condiciones con nosotros.':'You get special terms at the coworking and at the Ateneo’s events. Ask us about the conditions.',
      'Tu comunidad':'Your community',
      'Tu contraseña':'Your password',
      'Tu foto':'Your photo',
      'Tu liga es personal. No la compartas.':'Your link is personal. Don’t share it.',
      'Tus tours se venden en la plaza que elijas. Si operas en las dos, empieza por una y nos lo dices.':'Your tours are sold in the city you choose. If you work in both, start with one and tell us.',
      'Tus tours se venden en la recepción de nuestros hoteles y en la app de los huéspedes. Empieza con lo mínimo: el resto lo completas cuando puedas.':'Your tours are sold at our hotels’ front desks and in the guest app. Start with the bare minimum: you fill in the rest when you can.',
      'Tú pides, por ejemplo':'You ask, for example',
      'Tú pones tu precio':'You set your price',
      'Vende tus piezas':'Sell your pieces',
      'Ver / ocultar la contraseña':'Show / hide the password',
      'XIKA · Una tienda de Grupo Casa Pepe':'XIKA · A shop by Grupo Casa Pepe',
      'Ya estás':'You’re in',
      'Ya quedaste apuntada. Te vamos a llamar para terminar tu cuenta y enseñarte a subir tus piezas con tus fotos y tu precio.':'You are on the list. We will call you to finish your account and show you how to upload your pieces with your photos and your price.',
      'aviso de privacidad':'privacy notice',
      'el guía':'the guide',
      'mínimo 6 letras o números':'at least 6 letters or numbers',
      'opcional':'optional',
      'tucorreo@ejemplo.com':'you@example.com',
      'términos':'terms',
      'y el':'and the',
      '¿Cómo te gustaría que te llamemos?':'What would you like us to call you?',
      '¿Dudas? Escríbenos por WhatsApp y te ayudamos a completar tu alta.':'Questions? Write to us on WhatsApp and we’ll help you finish your sign-up.',
      '¿Dónde operas?':'Where do you operate?',
      '¿Olvidaste tu contraseña?':'Forgotten your password?',
      '¿Sabías que por ser operador de Sincrético te vuelves Ateneísta?':'Did you know that being a Sincrético operator makes you an ateneísta?',
      '🧿 Subir / ver nuestras piezas':'🧿 Upload / see our pieces',
      /* EL PORTAL DE LA TOUROPERADORA (operador.html). Lo abren las 102 que ya operan y los concierges de los hoteles. 27-oct-2026. */
      '. De ahí se descuenta sola la comisión. No nos das tu CLABE: la capturas tú dentro de Stripe, y solo tú la ves.':'. The commission comes off there by itself. You do not give us your bank details: you enter them inside Stripe, and only you see them.',
      '1 a 3 años':'1 to 3 years',
      '3 a 10 años':'3 to 10 years',
      ': el huésped paga en tu cuenta de Stripe y la comisión se descuenta ahí, de forma automática, en el mismo cobro. Así se reparte:':': the guest pays into your Stripe account and the commission comes off there, automatically, in the same charge. This is how it splits:',
      ': la comisión de Stripe te la cobra Stripe a ti a su tarifa, y si un huésped desconoce un cargo, el contracargo lo peleas tú con tu panel de Stripe. Si ya tienes cuenta, al vincular entras con ella; no te creamos una nueva.':': Stripe charges you its own fee at its own rate, and if a guest disputes a charge, you fight the chargeback from your own Stripe dashboard. If you already have an account, linking signs you in with it; we do not create a new one.',
      'Agregar a mi equipo':'Add to my team',
      'Ahí te llega cada venta, al momento':'Every sale lands there, right away',
      'Al huésped se le dice desde el checkout, con todas sus letras, cuánto paga ahora y cuánto te paga a ti el día del tour. Llega sabiéndolo. El anticipo no se le devuelve: es lo que aparta su lugar, y es también tu garantía de que se presenta.':'The guest is told at checkout, in plain words, how much they pay now and how much they pay you on the day of the tour. They arrive knowing. The deposit is not refunded: it is what holds their place, and it is also your guarantee that they turn up.',
      'Antigüedad operando':'Years operating',
      'Aquí no se cobra nada.':'Nothing is charged here.',
      'Arrastra tus fotos y videos aquí':'Drag your photos and videos here',
      'Así te van a ver los huéspedes':'This is how guests will see you',
      'Bebidas alcohólicas, propinas':'Alcoholic drinks, tips',
      'Bienvenido':'Welcome',
      'Cada papel tiene su apartado. Ninguno de estos frena la publicación: lo que sí hace falta es tu RFC o CURP, un correo, un teléfono y el acuerdo firmado.':'Each document has its own section. None of these holds up publishing: what is needed is your RFC or CURP, an email, a phone number and the signed agreement.',
      'Caduca en un año.':'It expires in a year.',
      'Cancelar':'Cancel',
      'Centro Histórico a pie':'Centro Histórico on foot',
      'Chef poblana, tercera generación de moleras':'Chef from Puebla, third generation of mole makers',
      'Ciudad base':'Home city',
      'Comisión total':'Total commission',
      'Como el cobro cae en tu cuenta,':'Since the payment lands in your account,',
      'Como viene en tu constancia':'As it appears on your registration',
      'Como viene en tu constancia de situación fiscal':'As it appears on your tax status registration',
      'Con lo que has contestado se arma un documento con tu nombre y los Objetivos que estás tocando. Lo puedes imprimir, guardarlo en PDF o colgarlo en tu oficina.':'What you have answered builds a document with your name and the Goals you are touching. You can print it, save it as a PDF or hang it in your office.',
      'Conciliaciones':'Reconciliations',
      'Contacto':'Contact',
      'Contraseña':'Password',
      'Coordinador · acceso completo':'Coordinator · full access',
      'Correo (será su usuario)':'Email (this will be their username)',
      'Correo comercial':'Business email',
      'Correo de reportes':'Reports email',
      'Correo de reservas':'Bookings email',
      'Corto y claro. Nada de mayúsculas de gritar.':'Short and clear. No shouting caps.',
      'Crear y abrir la ficha':'Create it and open the form',
      'Cuenta conectada':'Account connected',
      'Cuéntala':'Tell it',
      'Cómo leemos tus tours':'How we read your tours',
      'Cómo te contactamos':'How we reach you',
      'Date de alta':'Register',
      'De Drive, Dropbox o de tu web. La primera es la de portada.':'From Drive, Dropbox or your own site. The first one is the cover.',
      'Declaro bajo protesta de decir verdad que lo anterior es cierto, y entiendo que Sincrético puede mostrarlo en la ficha de mis experiencias indicando que es una declaración mía.':'I declare under oath that the above is true, and I understand that Sincrético may show it on the page of my experiences, stating that it is a declaration of mine.',
      'Del Zócalo al Templo Mayor con quien creció ahí':'From the Zócalo to the Templo Mayor with someone who grew up there',
      'Del guía se publica su foto, su historia y su Instagram. No necesita correo, salvo que vaya a entrar al sistema a ver sus salidas.':'For a guide we publish the photo, the story and the Instagram. No email is needed unless they are going to sign in to see their departures.',
      'Dos roles. El':'Two roles. The',
      'Déjalo vacío si no aplica.':'Leave it empty if it does not apply.',
      'Días que sale':'Days it runs',
      'Dónde y cuándo':'Where and when',
      'Echando cuentas…':'Running the numbers…',
      'El Ateneo de Virreyes está en José María Izazaga 8, a cinco minutos del Zócalo: escritorios, oficinas, sala de juntas, cine y cocina. No hace falta para vender con nosotros —este paso es opcional—, pero si tu equipo necesita dónde aterrizar en el Centro, aquí lo pides y te contestamos.':'The Ateneo de Virreyes is at José María Izazaga 8, five minutes from the Zócalo: desks, private offices, a meeting room, a cinema and a kitchen. You do not need it to sell with us —this step is optional— but if your team needs somewhere to land downtown, you ask for it here and we get back to you.',
      'El acuerdo':'The agreement',
      'El hotel, por empujar la venta':'The hotel, for pushing the sale',
      'El huésped paga una sola vez en Sincrético y':'The guest pays once on Sincrético and',
      'El precio que paga el huésped. De ahí se retiene la comisión que trae tu acuerdo.':'The price the guest pays. The commission in your agreement is held back from that.',
      'El punto de encuentro es la recepción de un hotel de Sincrético.':'The meeting point is the front desk of a Sincrético hotel.',
      'Empezar':'Get started',
      'En el punto de encuentro: apunta la cámara al QR del huésped. Cada lectura marca ese boleto como usado.':'At the meeting point: point the camera at the guest\'s QR code. Each scan marks that ticket as used.',
      'Escanear los boletos de tus salidas':'Scan the tickets for your departures',
      'Escribe el código del boleto. Son ocho caracteres y no lleva ni O ni I ni ceros ni unos, para que no se confundan al dictarlo.':'Type the ticket code. Eight characters, with no O, I, zeros or ones, so nothing gets mixed up when it is read out loud.',
      'Estado de tu cuenta':'Your account status',
      'Esto es lo que vas a firmar. Sólo aparece lo que contestaste.':'This is what you are about to sign. Only what you answered appears.',
      'Estos datos salen de tu constancia fiscal. Se piden una sola vez.':'These details come from your tax registration. They are asked for once only.',
      'Fecha de firma':'Date signed',
      'Firma':'Signature',
      'Firma con el dedo o el ratón ·':'Sign with your finger or the mouse ·',
      'Firmar la declaración':'Sign the declaration',
      'Galería':'Gallery',
      'Generar mi compromiso de impacto':'Generate my impact commitment',
      'Guardar borrador':'Save draft',
      'Guardar y volver':'Save and go back',
      'Guía · sale publicado y ve sus salidas':'Guide · published, and sees their departures',
      'Hay dos maneras y eliges tú. Puedes cambiarla después.':'There are two ways and you choose. You can change it later.',
      'Horas de salida':'Departure times',
      'Idiomas en que se da':'Languages it runs in',
      'JPG, PNG, WEBP o MP4 (también .mov del iPhone) · los videos los comprimimos aquí antes de subirlos · puedes soltar varios a la vez':'JPG, PNG, WEBP or MP4 (iPhone .mov too) · we compress videos here before uploading · you can drop several at once',
      'La pregunta de fondo es una: cuando vendemos un lugar, ¿quién descuenta el cupo? Dinos qué sistema usas y te decimos hasta dónde llegamos.':'There is one question underneath it all: when we sell a place, who takes it off the count? Tell us what system you use and we will tell you how far we can go.',
      'Las descargamos y las guardamos nosotros. Si son de Drive, tienen que estar compartidas con «cualquiera con el enlace».':'We download them and store them ourselves. If they are on Drive, they have to be shared with “anyone with the link”.',
      'Liga de Google Maps':'Google Maps link',
      'Liga de su foto':'Link to their photo',
      'Ligas de las fotos':'Photo links',
      'Listado':'List',
      'Lo esencial':'The essentials',
      'Lo que Casa Pepe presta cuando traes gente, contado servicio a servicio.':'What Casa Pepe lends when you bring people in, counted service by service.',
      'Lo que contestes aquí sale en la ficha de todos tus tours, debajo de':'What you answer here shows on the page of every one of your tours, under',
      'Lo que el huésped no tiene que pagar aparte. Marca solo lo que de verdad va incluido.':'What the guest does not have to pay for separately. Tick only what is genuinely included.',
      'Lo que el huésped ve primero en la recepción y en el concierge.':'What the guest sees first at the front desk and at the concierge.',
      'Lo que has pedido':'What you have requested',
      'Lo que llevas escaneado':'What you have scanned so far',
      'Lo que mandes queda como una solicitud; te escribimos para enseñarte el sitio, cerrar la fecha de entrada y, si el plan lo lleva, firmar el contrato.':'What you send stays as a request; we write to you to show you the place, settle the move-in date and, if the plan calls for it, sign the contract.',
      'Lo que tienes que tener listo:':'What you need to have ready:',
      'Mandar a revisión':'Send for review',
      'Mandarme el enlace':'Send me the link',
      'Menos de 1 año':'Less than 1 year',
      'Mi impacto':'My impact',
      'Mirando tu semana…':'Looking at your week…',
      'Mis experiencias':'My experiences',
      'Mis ventas':'My sales',
      'Más de 10 años':'More than 10 years',
      'Máximo 120 caracteres.':'120 characters max.',
      'Máximo por salida':'Maximum per departure',
      'Mínimo para salir':'Minimum to run',
      'No necesitas cuenta de Stripe.':'You do not need a Stripe account.',
      'No preguntamos por tus números. Preguntamos por lo que haces, que lo sabes sin abrir un libro.':'We are not asking for your figures. We are asking what you do, which you know without opening a ledger.',
      'No te la retenemos nosotros':'We do not hold it back ourselves',
      'Nombre comercial':'Trading name',
      'Nosotros cobramos nuestra comisión con nuestra tarjeta y tú cobras lo tuyo en mano. No hay nada que liquidarte después ni quincenas que esperar.':'We take our commission on our own card and you collect your part in person. There is nothing to settle with you afterwards and no fortnightly payout to wait for.',
      'Nueva experiencia':'New experience',
      'Para publicar tus tours':'To publish your tours',
      'Pedirlo':'Request it',
      'Pega la liga de uno de tus anuncios, o escribe el nombre de tu empresa. Si te tenemos detectado, te traemos tus experiencias ya cargadas y solo las revisas. Te ahorra llenar todo a mano.':'Paste the link to one of your listings, or type your company name. If we already have you on file we bring your experiences in ready-made and you just check them. It saves filling everything in by hand.',
      'Ponle nombre y te llevo a la ficha, donde se llena todo lo demás paso a paso. Se guarda como borrador.':'Give it a name and I will take you to the form, where everything else gets filled in step by step. It is saved as a draft.',
      'Por adulto (MXN)':'Per adult (MXN)',
      'Por comercializar tus tours cobramos una comisión del':'For selling your tours we charge a commission of',
      'Por debajo, avisamos y se decide.':'Below that, we tell you and it gets decided.',
      'Por menor (MXN)':'Per child (MXN)',
      'Portal para quienes operan experiencias con nosotros. Entra con el correo y la contraseña que creaste al darte de alta.':'Portal for everyone who runs experiences with us. Sign in with the email and password you created when you registered.',
      'Precio':'Price',
      'Programación':'Schedule',
      'Protesta de decir verdad':'Sworn statement',
      'Puede ser el mismo correo en los dos. Se separan porque las reservas urgen y los reportes no.':'It can be the same email in both. They are kept apart because bookings are urgent and reports are not.',
      'Puesto':'Role',
      'Quien recibe fondos tiene que identificarse ante el procesador, y eso se hace dentro de Stripe, no aquí.':'Whoever receives funds has to identify themselves to the processor, and that happens inside Stripe, not here.',
      'Quien te vende en la recepción del hotel':'Whoever sells you at the hotel front desk',
      'Quiero vincular mi Stripe':'I want to link my Stripe',
      'Quién firma · nombre completo':'Who signs · full name',
      'Quién reservó tus tours, por salida.':'Who booked your tours, by departure.',
      'Qué debe llevar':'What to bring',
      'Qué se hace, qué se ve, qué se siente.':'What you do, what you see, what you feel.',
      'Recepción de República de Uruguay 86':'Front desk at República de Uruguay 86',
      'Resumen mensual y dónde puedes vender más':'Monthly summary and where you could sell more',
      'Sale de uno de nuestros hoteles':'It departs from one of our hotels',
      'Se abre con tus datos ya puestos. Lo lees, corriges lo que haga falta de tu información fiscal y lo firmas ahí mismo; te mandamos copia por correo. No necesitas póliza de responsabilidad civil para firmarlo.':'It opens with your details already filled in. You read it, correct whatever needs correcting in your tax information and sign it right there; we email you a copy. You do not need a liability policy to sign it.',
      'Se guarda como borrador. Cuando la mandes a revisión la vemos y la publicamos.':'It is saved as a draft. When you send it for review we look at it and publish it.',
      'Se llena al vincular':'Filled in when you link',
      'Si acordamos algo distinto para tus tours, te lo proponemos por escrito y queda anotado aquí antes de publicar.':'If we agree something different for your tours, we put it to you in writing and it gets noted here before publishing.',
      'Si arranca en uno de nuestros hoteles te mandamos huéspedes que ya están ahí: se vende solo.':'If it starts at one of our hotels we send you guests who are already there: it sells itself.',
      'Si ya pasaste por una auditoría, no hace falta contarlo todo otra vez desde cero: se anota aquí y cuenta. Apunta el que sea —de sostenibilidad, de calidad, de higiene— que nosotros lo ordenamos.':'If you have already been through an audit, there is no need to tell it all again from scratch: note it here and it counts. Put down whichever one you have —sustainability, quality, hygiene— and we will sort it out.',
      'Sin asignar todavía':'Not assigned yet',
      'Sin cámara':'No camera',
      'Solo te enseñamos lo que coincide con lo que escribes. Si no aparece nada, sigue llenando abajo con calma.':'We only show you what matches what you type. If nothing comes up, carry on filling in below, no hurry.',
      'Somos tres, entraríamos en noviembre…':'There are three of us, we would move in in November…',
      'Sus eventos, su sala y sus boletos.':'Their events, their room and their tickets.',
      'Sus hoteles':'Their hotels',
      'Sólo se publica lo que contestes:':'Only what you answer gets published:',
      'Temporadas, restricciones, lo que sea':'Seasons, restrictions, anything',
      'Tipo de persona':'Entity type',
      'Todo mi material':'All my material',
      'Todo tu material en un solo sitio. Súbelo aquí y repártelo entre tus tours cuando quieras.':'All your material in one place. Upload it here and spread it across your tours whenever you like.',
      'Touroperadoras · Hoteles y Concierges':'Tour operators · Hotels and concierges',
      'Traer de las ligas':'Fetch from the links',
      'Tres como mínimo, horizontales. Nada de collages ni marcas de agua.':'Three at least, landscape. No collages, no watermarks.',
      'Tu alta':'Your registration',
      'Tu compromiso de impacto':'Your impact commitment',
      'Tu empresa':'Your company',
      'Tu equipo':'Your team',
      'Tu impacto':'Your impact',
      'Tu sitio en Virreyes':'Your spot at Virreyes',
      'Tu web · opcional':'Your website · optional',
      'Tus casas, sus cuartos y por dónde entra cada una.':'Your houses, their rooms and how each one comes in.',
      'Tus salidas, quién las guía y quién va.':'Your departures, who guides them and who is coming.',
      'Un contrato marco sobre responsabilidades: tú operas el tour y respondes por él; nosotros lo vendemos y te mandamos al huésped. Cada experiencia que publiques se cuelga de este acuerdo.':'A framework contract about responsibilities: you run the tour and answer for it; we sell it and send you the guest. Every experience you publish hangs off this agreement.',
      'Un huésped que no llega, un cambio de hora':'A guest who does not show, a time change',
      'Un sitio donde trabajar':'Somewhere to work',
      'Una liga por renglón':'One link per line',
      'Una línea que la venda':'One line that sells it',
      'Vale como identificación cuando no hay RFC':'Works as ID when there is no RFC',
      'Validar':'Validate',
      'Ver la guía':'See the guide',
      'Ver y firmar mi contrato':'Read and sign my contract',
      'WhatsApp de último momento':'Last-minute WhatsApp',
      'Y para el día a día':'And for the day to day',
      'coordinador':'coordinator',
      'el cobro cae directo en tu cuenta de Stripe':'the payment lands straight in your Stripe account',
      'es la persona que tus clientes van a conocer: su ficha sale publicada en los tours donde participa, y dentro del sistema solo ve sus salidas —fecha, hora, punto de encuentro, idioma, cuántos van y el nombre de pila—; no ve precios ni contactos.':'is the person your customers will meet: their page is published on the tours they take part in, and inside the system they only see their own departures —date, time, meeting point, language, how many are coming and first names—; they see no prices and no contact details.',
      'guía':'guide',
      'hace todo menos dar de baja la cuenta. El':'does everything except close the account. The',
      'https://www.airbnb.com/experiences/… o el nombre de tu empresa':'https://www.airbnb.com/experiences/… or your company name',
      'o':'or',
      'o haz clic para elegirlos':'or click to pick them',
      'que tu guía sepa cobrar en el punto de encuentro. En la lista de la salida le aparece, por persona, el importe pendiente.':'that your guide knows how to take payment at the meeting point. The departure list shows them the amount still owed, person by person.',
      'sobre el precio que paga el huésped':'on the price the guest pays',
      'tú eres el comercio de registro':'you are the merchant of record',
      'una pregunta en blanco no se guarda como carencia ni aparece en ningún lado.':'a blank answer is not filed as a shortcoming and does not show up anywhere.',
      '¿Algo que debamos saber? (opcional)':'Anything we should know? (optional)',
      '¿Cuál?':'Which one?',
      '¿Cuánto dura?':'How long does it run?',
      '¿Cuántos meses?':'How many months?',
      '¿Cómo se llama?':'What is it called?',
      '¿Hasta cuándo se puede reservar?':'How late can it be booked?',
      '¿No tienes cuenta?':'No account yet?',
      '¿Quién es? · esto se publica':'Who are they? · this gets published',
      '¿Qué sistema usas?':'What system do you use?',
      '¿Tienes algún distintivo o certificado?':'Do you hold any seal or certificate?',
      '¿Ya vendes en Airbnb, Viator o GetYourGuide?':'Do you already sell on Airbnb, Viator or GetYourGuide?',
      '— separado del dinero, que ése se calcula solo de cada venta.':'— kept apart from the money, which is worked out on its own from each sale.',
      '—no es un recargo sobre tu neto—.':'—it is not a surcharge on top of your net—.',
      '…o pega ligas de Drive o de la web':'…or paste links from Drive or the web',
      '← Volver':'← Back',
      '⏹ Apagar':'⏹ Turn off',
      '▶ Encender la cámara':'▶ Turn the camera on',
      '＋ Certificado':'＋ Certificate',
      '＋ Nueva experiencia':'＋ New experience',
      '＋ Nuevo evento':'＋ New event',
      '🎫 Boletos':'🎫 Tickets',
      '🤵 Aquí nos ponemos un poco formales':'🤵 This is where we get a little formal',
      /* Y lo que el portal construye desde el JS: las nueve vistas, las fichas,
         los dialogos y los avisos. Sale de leer los literales del fichero con
         un parser y quedarse con lo que acaba siendo un NODO DE TEXTO -no el
         trozo de HTML entero-, que es lo que el barrido puede alcanzar.
         Los pedazos que empiezan por coma o por punto son media frase: van
         pegados a un valor, y el nodo se arma al pintarse. 27-oct-2026. */
      '$5,000,000 o más':'$5,000,000 or more',
      '% como anticipo. El resto te lo paga el huésped en mano, al guía, el día del tour.':'% as a deposit. The guest pays the rest in person, to the guide, on the day of the tour.',
      '%) y':'%) and',
      '%. Es la misma cantidad, contada desde el otro lado.':'%. It is the same amount, counted from the other side.',
      '(sin nombre)':'(no name)',
      ', así que este portal no es el tuyo.':', so this portal is not yours.',
      ', con el recorrido, qué incluye, de dónde':', with the route, what is included, where it',
      ', en Europa solo se puede enseñar como sello de sostenibilidad el que da una autoridad pública o el que audita alguien independiente de quien escribió la norma.':', in Europe the only sustainability seal you may display is one issued by a public authority or audited by someone independent of whoever wrote the standard.',
      ', no como touroperadora.':', not as a tour operator.',
      ', no un recargo sobre lo tuyo.':', not a surcharge on top of your share.',
      ', su hora de recogida':', their pick-up time',
      ', y aquí aparece para asignarlo.':', and it shows up here to be assigned.',
      '. Están en azul: revísalas, corrige lo que esté mal y dales guardar.':'. They are in blue: look them over, fix whatever is wrong and save them.',
      '. Mándalo otra vez si hace falta.':'. Send it again if you need to.',
      '. Para publicarlo, lo revisamos nosotros.':'. To publish it, we review it ourselves.',
      '. Sin eso el contrato se firma pero no puedes publicar.':'. Without that the contract can be signed but you cannot publish.',
      '. Usa el código, abajo.':'. Use the code below.',
      '. ¿Cuál es tuyo?':'. Which one is yours?',
      '10 años':'10 years old',
      '12 años':'12 years old',
      '15 años':'15 years old',
      '18 años':'18 years old',
      '27 de septiembre de 2026':'27 September 2026',
      '6 años':'6 years old',
      ': ningún tercero independiente la ha auditado. Los Objetivos de Desarrollo':': no independent third party has audited it. The Sustainable Development',
      'A nombre de quién viene':'Whose name it is under',
      'A partir de':'From',
      'A quién le compras y cuánto de ese dinero se queda cerca de donde operas.':'Who you buy from, and how much of that money stays near where you operate.',
      'A quién le llega':'Who it reaches',
      'A qué tour se liga':'Which tour it ties to',
      'Acomoda la foto':'Position the photo',
      'Ahora mismo no hay planes publicados.':'There are no published plans right now.',
      'Ahí llegan las reservas.':'That is where the bookings land.',
      'Ahí te avisamos de cada reserva en cuanto ocurre.':'That is where we tell you about every booking the moment it happens.',
      'Airbnb Experiences da un iCal por experiencia, en tu pantalla de calendario de anfitrión. Es de una sola dirección: vemos lo que ya tienes ocupado y dejamos de ofrecer esa hora, pero lo que vendamos nosotros no le llega a Airbnb. Reduce la sobreventa, no la elimina.':'Airbnb Experiences gives one iCal per experience, on your host calendar screen. It only runs one way: we see what you already have booked and stop offering that slot, but what we sell never reaches Airbnb. It reduces overselling, it does not end it.',
      'Al guía le llega la lista y las recogidas cuando notifiques a los clientes.':'The guide gets the list and the pick-ups when you notify the customers.',
      'Alimentos y bebida, guía y luchador':'Food and drink, guide and wrestler',
      'Alta en curso':'Registration in progress',
      'Antes de firmar nos falta':'Before signing we still need',
      'Antes de mandarla a revisión falta:':'Before sending it for review, this is missing:',
      'Anticipo y el resto al guía':'Deposit, and the rest to the guide',
      'Apunta al QR.':'Point at the QR code.',
      'Apuntar un servicio dado ·':'Log a service given ·',
      'Armar el ticket':'Build the ticket',
      'Asignada al tour':'Assigned to the tour',
      'Ayúdenme a sacarlo':'Help me get it',
      'Aún no se ha mandado: esta es la lista a la que irá.':'It has not been sent yet: this is the list it will go to.',
      'Basura, traslados y conservación: lo que tus salidas dejan atrás.':'Waste, transport and conservation: what your departures leave behind.',
      'Buscar por nombre':'Search by name',
      'Bökun está en OCTO. Podemos leer tus tours y crear la reserva en tu sistema.':'Bökun is on OCTO. We can read your tours and create the booking inside your system.',
      'Búscala en tu sistema como «exportar calendario», «iCal» o «.ics» y pégala aquí.':'Look for it in your system under “export calendar”, “iCal” or “.ics”, and paste it here.',
      'Búscate por el nombre de tu empresa o por el de alguno de tus tours, y te los damos: no empiezas de cero.':'Find yourself by your company name or by one of your tours, and we hand them over: you are not starting from scratch.',
      'Cada salida tiene su propio botón, por si prefieres mandarlo más cerca.':'Each departure has its own button, in case you would rather send it closer to the day.',
      'Cada una se declara en su ficha, paso Impacto':'Each one is declared on its own page, in the Impact step',
      'Cada venta te llega al correo de reservas en cuanto ocurre. Si te llenas por tu cuenta, avísanos por WhatsApp y cerramos esa salida.':'Every sale reaches your bookings email the moment it happens. If you fill up on your own, let us know on WhatsApp and we close that departure.',
      'Cambiar de operadora':'Switch operator',
      'Casi todos los sistemas la dan y se conecta hoy mismo':'Almost every system provides it, and it connects the same day',
      'Celiaquía, vegetariano, alergia a los cacahuates…':'Coeliac, vegetarian, peanut allergy…',
      'Checkfront tiene API. Hay que pedirles acceso; mientras tanto, iCal o manual.':'Checkfront has an API. Access has to be requested from them; until then, iCal or manual.',
      'Cliente, grupo, lo que haga falta recordar':'Customer, group, whatever needs remembering',
      'Cobrada. Fuera del reloj.':'Charged. Off the clock.',
      'Cobro completo a tu Stripe':'Full payment to your Stripe',
      'Comprimido: de':'Compressed: from',
      'Comprimiendo el video… tarda lo que dura el video.':'Compressing the video… it takes about as long as the video runs.',
      'Compromiso de impacto':'Impact commitment',
      'Compromiso de impacto ·':'Impact commitment ·',
      'Con esta ruta el cobro pasa por el marketplace y su comisión, y deja de caerte directo por Stripe. Solo la recomendamos si ya vendes ahí.':'On this route the payment goes through the marketplace and its commission, and stops landing straight in your Stripe. We only recommend it if you already sell there.',
      'Con incidencia':'With an issue',
      'Con lo que tienes anotado, tus tours pueden llevar sello en la ficha.':'With what you have noted down, your tours can carry a seal on their page.',
      'Con matiz':'With a caveat',
      'Con «':'With “',
      'Conexión directa':'Direct connection',
      'Conexión directa (OCTO)':'Direct connection (OCTO)',
      'Confirma la salida de':'Confirm the departure of',
      'Constancia de situación fiscal':'Tax status registration',
      'Consíganmela ustedes: una póliza de grupo, ni me voy a dar cuenta de que ya la tengo':'Get it for me: a group policy, and I will not even notice I have it',
      'Correo · opcional':'Email · optional',
      'Cuando la enciendas, sale a la venta en Sincrético.':'When you switch it on, it goes on sale on Sincrético.',
      'Cuenta activa':'Account active',
      'Cuenta como distintivo, no como sello':'It counts as a badge, not as a seal',
      'Cuenta con':'Counts with',
      'Cuenta dada de baja':'Account closed',
      'Cuenta suspendida':'Account suspended',
      'Cuéntanos cuál es y lo revisamos. Si da iCal, ya es algo.':'Tell us which one it is and we will look at it. If it gives iCal, that is already something.',
      'Cómo cobras (anticipo + resto al guía)':'How you get paid (deposit + rest to the guide)',
      'Cómo se llama':'What it is called',
      'Cómo te conduces':'How you conduct yourself',
      'De dónde sale':'Where it leaves from',
      'De ella cuelgan la sala, el montaje y los boletos,':'The room, the set-up and the tickets all hang off it,',
      'De otra plataforma':'From another platform',
      'Declaración firmada. Gracias.':'Declaration signed. Thank you.',
      'Declarado bajo protesta de decir verdad por':'Declared under oath by',
      'Desarrollo Sostenible de la Agenda 2030 de Naciones Unidas, y se suma al compromiso de':'Development Goals of the United Nations 2030 Agenda, and joins the commitment of',
      'Desde el':'Since',
      'Devuelta a la galería':'Returned to the gallery',
      'Dos días antes':'Two days before',
      'Drive, Dropbox, tu nube':'Drive, Dropbox, your own cloud',
      'Día completo':'Full day',
      'Dónde está el dinero':'Where the money is',
      'Echando la cuenta…':'Doing the sums…',
      'El acuerdo firmado':'The signed agreement',
      'El archivo no trae ninguna fila.':'The file does not carry a single row.',
      'El correo es su usuario, hace falta':'The email is their username, it is needed',
      'El cupo nunca se vende dos veces y no copias nada a mano':'A place is never sold twice and you copy nothing by hand',
      'El día anterior':'The day before',
      'El huésped paga al reservar nuestra comisión (':'The guest pays our commission when booking (',
      'El huésped paga el total y el dinero cae en tu cuenta. De ahí se descuenta sola nuestra comisión del':'The guest pays the full amount and the money lands in your account. Our commission comes off there by itself, at',
      'El iCal no trae cuántos lugares quedan: reduce la sobreventa, no la elimina':'The iCal does not carry how many places are left: it reduces overselling, it does not end it',
      'El navegador bloqueó la ventana. Permite las ventanas emergentes.':'The browser blocked the window. Allow pop-ups.',
      'El nombre de tu empresa, o el de un tour tuyo':'Your company name, or the name of one of your tours',
      'El planeta':'The planet',
      'El precio se copia a cada servicio dado. Cambiarlo aquí no toca lo ya conciliado.':'The price is copied onto each service given. Changing it here does not touch what has already been reconciled.',
      'El precio sin IVA tiene que ser mayor que cero.':'The price before tax has to be greater than zero.',
      'El precio sin IVA tiene que ser un número mayor que cero.':'The price before tax has to be a number greater than zero.',
      'El precio viene del catálogo y se puede ajustar aquí: lo que se guarda es lo que se cobró ese día, no lo que valga mañana.':'The price comes from the catalogue and can be adjusted here: what gets saved is what was charged that day, not what it is worth tomorrow.',
      'El registro oficial de la Secretaría de Turismo federal. Presentarte con él le da confianza a tus clientes.':'The official register of the federal Ministry of Tourism. Showing up with it gives your customers confidence.',
      'El tour se creó, pero no pude añadirle el menú. Lo tienes en el paso de La Cósmica.':'The tour was created, but I could not add the menu to it. You have it in the La Cósmica step.',
      'Elegido en el menú antes de darse de alta':'Chosen from the menu before registering',
      'Elegiste que el huésped pague el total a tu Stripe, y todavía no está vinculado.':'You chose for the guest to pay the full amount into your Stripe, and it is not linked yet.',
      'Elige tu sistema y te decimos qué podemos conectar.':'Pick your system and we will tell you what we can connect.',
      'Elige una de las dos para seguir. Puedes cambiarla después,':'Pick one of the two to carry on. You can change it later,',
      'Elige uno y te contestamos.':'Pick one and we will get back to you.',
      'Emitido por Sincrético el':'Issued by Sincrético on',
      'En concreto':'Specifically',
      'En cuanto contestes que sí a algo, aquí aparecen los Objetivos que tocas.':'As soon as you answer yes to something, the Goals you touch appear here.',
      'En revisión':'Under review',
      'Encontramos esto. ¿Es tuyo?':'We found this. Is it yours?',
      'Entrar a esta casa ↗':'Go into this house ↗',
      'Es la que responde si un huésped se lastima durante tu tour. Mientras no tengas la tuya, lo que vendas con nosotros va bajo la nuestra. Si quieres una propia, marca la casilla y te conseguimos una de grupo.':'It is what answers if a guest gets hurt during your tour. Until you have your own, what you sell with us runs under ours. If you want one of your own, tick the box and we will get you a group policy.',
      'Es mi empresa':'This is my company',
      'Esa ficha ya tiene dueño.':'That page already has an owner.',
      'Esa reserva todavía no está pagada.':'That booking is not paid yet.',
      'Escribe al menos tres letras, o pega una liga.':'Type at least three letters, or paste a link.',
      'Escribe al menos tres letras.':'Type at least three letters.',
      'Escríbelo antes de guardar':'Write it in before saving',
      'Escríbenos y la creamos contigo: no tienes que volver a darte de alta.':'Write to us and we will create it with you: you do not have to register again.',
      'Ese código no corresponde a ninguna reserva tuya.':'That code does not match any booking of yours.',
      'Ese día no tienes salidas.':'You have no departures that day.',
      'Esta cuenta no está dada de alta como':'This account is not registered as',
      'Esta es mía':'This one is mine',
      'Esta foto está publicada en un tour. ¿La borro de todas formas?':'This photo is published on a tour. Delete it anyway?',
      'Estamos confirmando tu ficha':'We are confirming your page',
      'Este boleto existió, pero la reserva se canceló.':'This ticket existed, but the booking was cancelled.',
      'Este documento recoge una declaración de la propia empresa.':'This document records a declaration by the company itself.',
      'Este portal es el de ellos: aquí eliges a cuál quieres ver por dentro, tal como lo ve ella.':'This portal is theirs: here you pick which one you want to see from the inside, exactly as she sees it.',
      'Esto es lo que':'This is what',
      'Estás viendo el portal de':'You are looking at the portal of',
      'Falta el día: sin fecha no entra en ninguna semana.':'The day is missing: with no date it does not fall in any week.',
      'Falta el nombre':'The name is missing',
      'Falta el nombre de quien firma':'The name of whoever signs is missing',
      'Falta la firma':'The signature is missing',
      'Falta su ficha de productora.':'Their producer page is missing.',
      'FareHarbor tiene API, pero el acceso para revendedores pasa por una autorización suya. Lo pedimos por ti; mientras tanto, iCal o manual.':'FareHarbor has an API, but reseller access goes through their own authorisation. We request it for you; until then, iCal or manual.',
      'Ficha del producto':'Product page',
      'Firma el convenio':'Sign the agreement',
      'Firmada por':'Signed by',
      'Folio o número':'Reference or number',
      'Fuera del grupo':'Outside the group',
      'Funciona desde hoy':'It works from today',
      'Gastronómico':'Food and drink',
      'Gratis hasta 24 h antes':'Free up to 24 h before',
      'Gratis hasta 48 h antes':'Free up to 48 h before',
      'Gratis hasta 72 h antes':'Free up to 72 h before',
      'Hasta la hora de salida':'Up to departure time',
      'Hemos encontrado esta información sobre tu proyecto en la web.':'We found this information about your project on the web.',
      'INE o pasaporte de quien firma por la empresa.':'ID or passport of whoever signs for the company.',
      'Identificación del representante':'Representative\'s ID',
      'Impacto sin declarar':'Impact not declared',
      'Ir a mi galería':'Go to my gallery',
      'Ir a «Cómo te pagamos»':'Go to “How we pay you”',
      'Japonés':'Japanese',
      'La base no dejó apuntarla.':'The database would not let it be logged.',
      'La base no dejó cargarlas.':'The database would not let them be loaded.',
      'La base no dejó guardar eso.':'The database would not let that be saved.',
      'La comunidad':'The community',
      'La estamos revisando.':'We are reviewing it.',
      'La póliza de responsabilidad civil es lo único que de verdad nos frena. Si no la tienes, te la conseguimos.':'The liability policy is the only thing that genuinely holds us up. If you do not have one, we will get it for you.',
      'La vendió la touroperadora':'Sold by the tour operator',
      'Las experiencias, propias y de terceros, se editan en':'Experiences, both your own and third parties\', are edited in',
      'Las que vende otra plataforma y reciben aquí.':'The ones another platform sells and that arrive here.',
      'Las reglas que te pones tú, incluso cuando cuestan dinero.':'The rules you set yourself, even when they cost money.',
      'Las salidas vienen del calendario de cada experiencia: si falta una, es que su ficha no la ofrece ese día.':'Departures come from each experience\'s calendar: if one is missing, its page is not offering it that day.',
      'Le falta':'It is missing',
      'Le pusimos lo que elegiste del menú de La Cósmica.':'We put in what you chose from the La Cósmica menu.',
      'Les llega cómo encontrarte':'They get how to find you',
      'Les llega cómo encontrarte, su hora de recogida y dos botones para decirte si vienen.':'They get how to find you, their pick-up time and two buttons to tell you whether they are coming.',
      'Leyendo el archivo…':'Reading the file…',
      'Liga al certificado':'Link to the certificate',
      'Liga del archivo':'Link to the file',
      'Listo, empiezas de cero.':'Done, you are starting from scratch.',
      'Listo, es tuya.':'Done, it is yours.',
      'Listo: cobras el resto al llegar.':'Done: you collect the rest on arrival.',
      'Listo: el cobro completo cae en tu Stripe.':'Done: the full payment lands in your Stripe.',
      'Listo: te mandamos la liga para conectar tu sistema':'Done: we are sending you the link to connect your system',
      'Listo: tu Stripe quedó vinculado.':'Done: your Stripe is linked.',
      'Listo: ya puedes crear':'Done: you can now create',
      'Llegó':'Arrived',
      'Lo azul es nuestro hasta que lo toques. El precio que ves es':'Anything blue is ours until you touch it. The price you see is',
      'Lo formal':'The formal part',
      'Lo hacemos juntos, de arriba abajo. Lo de abajo puede esperar.':'We do it together, top to bottom. The bottom part can wait.',
      'Lo intentaste el':'You tried on',
      'Lo que compras':'What you buy',
      'Lo que falta es tuyo:':'What is missing is yours:',
      'Lo que guardes queda a nombre de esa cuenta.':'Whatever you save goes under that account\'s name.',
      'Lo que queda abajo no te frena, pero te hace vender más.':'What is left below does not hold you up, but it makes you sell more.',
      'Lo que subo':'What I upload',
      'Lo que vendes: qué es, cuánto dura, qué incluye y cuánto cuesta.':'What you sell: what it is, how long it runs, what it includes and what it costs.',
      'Lo que ya firmaste en otro sitio y podemos verificar.':'What you have already signed somewhere else and we can verify.',
      'Lo que ya te tenemos hecho':'What we already have done for you',
      'Lo revisamos y te avisamos por correo — suele ser el mismo día.':'We review it and let you know by email — usually the same day.',
      'Lo subimos el':'We uploaded it on',
      'Lo subimos nosotros cuando lo firmes. No tienes que hacer nada aquí.':'We upload it ourselves once you sign. You do not have to do anything here.',
      'Lo vencido también está contado en su etapa: se saca aparte porque es lo que toca perseguir.':'What is overdue is also counted in its own stage: it is pulled out separately because it is what needs chasing.',
      'Los servicios':'The services',
      'Los servicios de este ticket':'The services on this ticket',
      'MB y el tope de una foto son 25':'MB and the cap for one photo is 25',
      'MB y el tope son 200':'MB and the cap is 200',
      'Mandada a revisión':'Sent for review',
      'Marcado como mandado. El correo todavía sale a mano.':'Marked as sent. The email still goes out by hand.',
      'Marcado con incidencia. Tiene tres días hábiles; pasados, se factura igual.':'Flagged with an issue. There are three working days; after that, it is invoiced anyway.',
      'Mejor no':'Better not',
      'Menos de $1,000,000':'Less than $1,000,000',
      'Mete un intermediario y su comisión, y el cobro deja de caerte directo por Stripe':'It puts a middleman and its commission in the way, and the payment stops landing straight in your Stripe',
      'Mi cuenta → tu equipo':'My account → your team',
      'Mientras tanto puedes seguir subiendo experiencias aquí: cuando lo confirmemos se juntan solas.':'In the meantime you can carry on uploading experiences here: once we confirm it, they join up on their own.',
      'Mándenme la liga para conectar':'Send me the link to connect',
      'Márcalo y lo creas hoy mismo. Publicarlo lo aprobamos nosotros.':'Tick it and you create it today. Publishing it is approved by us.',
      'Nada de esto lo has validado tú.':'None of this has been validated by you.',
      'Nada en este filtro.':'Nothing in this filter.',
      'Nada pendiente: todo lo que se ha dado ya está en un ticket.':'Nothing outstanding: everything given is already on a ticket.',
      'Nadie apuntado todavía.':'Nobody signed up yet.',
      'Nadie configurado todavía.':'Nobody set up yet.',
      'Necesitas vincular una cuenta de Stripe.':'You need to link a Stripe account.',
      'Ninguna fila tenía nombre y personas: no se cargó nada.':'Not one row had a name and a head count: nothing was loaded.',
      'Ninguno, lo llevo en papel o en Excel':'None, I keep it on paper or in Excel',
      'No corre prisa. Se necesita cuando empieces a facturar tus ventas.':'No hurry. It is needed when you start invoicing your sales.',
      'No encontramos de quién era esa vinculación de Stripe. Vuelve a empezarla.':'We could not find who that Stripe link belonged to. Start it again.',
      'No encontramos nada con eso.':'We found nothing with that.',
      'No encontramos nada con «':'We found nothing with “',
      'No encontré esa touroperadora. Vuelve al panel y ábrela desde ahí.':'I could not find that tour operator. Go back to the panel and open it from there.',
      'No es sello':'Not a seal',
      'No es un certificado ni':'It is not a certificate, nor',
      'No hay nada que conectar. En cada experiencia nos pones días, horas y máximo por salida, y de ahí llevamos la cuenta.':'There is nothing to connect. On each experience you give us days, times and a maximum per departure, and we keep count from there.',
      'No hay touroperadoras cargadas.':'No tour operators loaded.',
      'No pudimos abrir tus hoteles:':'We could not open your hotels:',
      'No pudimos entrar con esos datos.':'We could not sign in with those details.',
      'No pudimos leer ese archivo:':'We could not read that file:',
      'No pudimos terminar de abrir tu cuenta.':'We could not finish opening your account.',
      'No pudimos traer la conciliación:':'We could not fetch the reconciliation:',
      'No pudimos traer tu semana:':'We could not fetch your week:',
      'No pudimos traer tus ventas. Recarga la página.':'We could not fetch your sales. Reload the page.',
      'No reembolsable':'Non-refundable',
      'No se le cobra aquí':'They are not charged here',
      'No se pudieron traer.':'They could not be fetched.',
      'No se pudo abrir Stripe:':'Stripe could not be opened:',
      'No se pudo abrir la cámara:':'The camera could not be opened:',
      'No se pudo abrir tu contrato:':'Your contract could not be opened:',
      'No se pudo agregar':'It could not be added',
      'No se pudo asignar':'It could not be assigned',
      'No se pudo asignar el guía: la base no dejó tocar esta salida.':'The guide could not be assigned: the database would not let this departure be touched.',
      'No se pudo avisar':'They could not be notified',
      'No se pudo borrar':'It could not be deleted',
      'No se pudo borrar.':'It could not be deleted.',
      'No se pudo buscar (':'The search failed (',
      'No se pudo cambiar':'It could not be changed',
      'No se pudo cargar el cuestionario.':'The questionnaire could not be loaded.',
      'No se pudo cargar el lector de Excel.':'The Excel reader could not be loaded.',
      'No se pudo comprobar':'It could not be checked',
      'No se pudo crear la casa.':'The house could not be created.',
      'No se pudo crear.':'It could not be created.',
      'No se pudo crear:':'It could not be created:',
      'No se pudo enlazar':'It could not be linked',
      'No se pudo firmar:':'It could not be signed:',
      'No se pudo guardar':'It could not be saved',
      'No se pudo guardar el certificado':'The certificate could not be saved',
      'No se pudo guardar el recorte.':'The crop could not be saved.',
      'No se pudo guardar esa hora de recogida.':'That pick-up time could not be saved.',
      'No se pudo guardar esa opción. Vuelve a intentarlo.':'That option could not be saved. Try again.',
      'No se pudo guardar.':'It could not be saved.',
      'No se pudo guardar:':'It could not be saved:',
      'No se pudo marcar la llegada.':'The arrival could not be marked.',
      'No se pudo marcar. Escríbenos y te la ponemos.':'It could not be marked. Write to us and we will set it for you.',
      'No se pudo marcar:':'It could not be marked:',
      'No se pudo pedir:':'It could not be requested:',
      'No se pudo quitar':'It could not be removed',
      'No se pudo terminar la vinculación:':'The linking could not be finished:',
      'No sé':'I do not know',
      'No tengo':'I do not have one',
      'No tienes material suelto. Todo está repartido entre tus tours.':'You have no loose material. It is all spread across your tours.',
      'Noche Mexicana en Casa Pepe':'Mexican Night at Casa Pepe',
      'Noche de son jarocho':'Son jarocho night',
      'Nombre de la reserva':'Name on the booking',
      'Nos damos de alta como tu distribuidor dentro de Bökun o Rezdy. Lo gestionamos contigo: escríbenos y lo arrancamos.':'We register as your distributor inside Bökun or Rezdy. We handle it with you: write to us and we get it going.',
      'Nos deben':'Owed to us',
      'Nos hace falta una llave de tu sistema para leer tus tours y crear las reservas. No la pongas aquí: cuando le des al botón te mandamos por correo una liga segura donde la capturas tú.':'We need a key from your system to read your tours and create the bookings. Do not put it here: when you press the button we email you a secure link where you enter it yourself.',
      'Nosotros cobramos sólo nuestra comisión del':'We charge only our commission of',
      'Nosotros llevamos el cupo':'We keep the count of places',
      'Notificar a los clientes':'Notify the customers',
      'Número':'Number',
      'Número de registro':'Registration number',
      'OCTO es el estándar abierto del sector. Leemos tus tours con su cupo real y, al vender, creamos la reserva en tu sistema, que descuenta el lugar solo.':'OCTO is the industry\'s open standard. We read your tours with their real availability and, on a sale, we create the booking in your system, which takes the place off by itself.',
      'Ocupación que damos por buena':'Occupancy we take as good',
      'Orden de pago apuntada. El dinero todavía no está: el reloj sigue.':'Payment order logged. The money is not in yet: the clock keeps running.',
      'Orden de pago enviada':'Payment order sent',
      'Otra persona ya la pidió.':'Someone else has already requested it.',
      'Para lo de último momento.':'For the last-minute things.',
      'Para lo de último momento: un huésped que no llega, un cambio de hora.':'For the last-minute things: a guest who does not show, a time change.',
      'Para mandarle su QR':'To send them their QR code',
      'Pedido. Te escribimos para enseñártelo y cerrar la fecha.':'Requested. We will write to you to show you around and settle the date.',
      'Pediste quedarte con':'You asked to keep',
      'Peek Pro publica una API de revendedor sobre OCTO, el estándar abierto del sector. Es la conexión buena: leemos tus tours con su cupo real y, al vender, la reserva entra en tu sistema y descuenta sola.':'Peek Pro publishes a reseller API on top of OCTO, the industry\'s open standard. It is the good connection: we read your tours with their real availability and, on a sale, the booking enters your system and takes the place off by itself.',
      'Pega al menos una liga.':'Paste at least one link.',
      'Pegas la liga iCal que da tu sistema. Vemos qué salidas tienes bloqueadas y dejamos de ofrecerlas.':'You paste the iCal link your system gives. We see which departures you have blocked and stop offering them.',
      'Pendiente de firmar la protesta de decir verdad.':'The sworn statement is still to be signed.',
      'Pendiente de vincular':'Still to be linked',
      'Pon el precio por adulto y te decimos qué te queda.':'Enter the price per adult and we will tell you what you keep.',
      'Pon la liga del archivo':'Paste the link to the file',
      'Pon tu correo y tu contraseña.':'Enter your email and your password.',
      'Ponle el nombre de la reserva: sin nombre no se la encuentra al llegar.':'Put the name on the booking: with no name they cannot be found on arrival.',
      'Ponle nombre a la experiencia.':'Give the experience a name.',
      'Ponle nombre: sin nombre nadie sabrá qué se cobró.':'Give it a name: with no name nobody will know what was charged.',
      'Ponle un nombre.':'Give it a name.',
      'Por experiencia':'Per experience',
      'Por qué te lo preguntamos.':'Why we are asking.',
      'Por revisar':'To review',
      'Por tu marketplace':'Through your marketplace',
      'Preparando la cámara…':'Getting the camera ready…',
      'Preparándolo…':'Getting it ready…',
      'Prueba con el nombre de un tour tuyo, o sigue de largo y súbelos tú: se tarda menos de lo que parece.':'Try the name of one of your tours, or carry straight on and upload them yourself: it takes less time than it looks.',
      'Prueba con la liga de un anuncio tuyo, o sigue llenando a mano más abajo.':'Try the link to one of your listings, or carry on filling it in by hand below.',
      'Publícala':'Publish it',
      'Puede que ya los tengamos apuntados de tu anuncio público, en borrador y sin publicar.':'We may already have them noted down from your public listing, as drafts and unpublished.',
      'Puedes llenarlo todo; lo que guardes queda a su nombre y anotado como capturado por ti.':'You can fill in everything; whatever you save goes under their name and is noted as entered by you.',
      'Póliza de responsabilidad civil':'Liability insurance policy',
      'Quién eres en papel y a dónde te avisamos de cada venta.':'Who you are on paper and where we tell you about every sale.',
      'Quién trabaja contigo y en qué condiciones. Todo este bloque es opcional.':'Who works with you and on what terms. This whole block is optional.',
      'Qué papel tiene el barrio o la comunidad donde operas: si participa, si aprueba lo que se cuenta y qué recibe.':'What part the neighbourhood or community where you operate plays: whether it takes part, whether it approves what gets told, and what it receives.',
      'RFC o CURP de quien responde':'RFC or CURP of whoever answers for it',
      'Recogida en hotel':'Hotel pick-up',
      'Recogidas en hotel · en orden':'Hotel pick-ups · in order',
      'Reserva de otra plataforma · cargada desde':'Booking from another platform · loaded from',
      'Reserva de otra plataforma · welcoming en Casa Pepe':'Booking from another platform · welcoming at Casa Pepe',
      'Revisar tus fichas':'Review your pages',
      'Rezdy tiene API y marketplace de distribución. Hay que darte de alta como proveedor nuestro dentro de Rezdy; lo gestionamos contigo.':'Rezdy has an API and a distribution marketplace. You have to be registered as our supplier inside Rezdy; we handle that with you.',
      'Se abre con tus datos puestos; lo lees y lo firmas ahí mismo.':'It opens with your details filled in; you read it and sign it right there.',
      'Se cobra cuando sale':'It is charged when it runs',
      'Se cobra por':'It is charged per',
      'Se enciende rápido':'It switches on quickly',
      'Se escaneó el':'It was scanned on',
      'Se firma una vez y de ahí cuelgan todos tus tours.':'It is signed once, and all your tours hang off it.',
      'Se le añaden al primer tour que crees, en el paso de La Cósmica.':'They get added to the first tour you create, in the La Cósmica step.',
      'Se marca en':'It is marked in',
      'Se puede cobrar hoy':'It can be charged today',
      'Se retiene la comisión que lleves en tu contrato. En cuanto esté puesta,':'The commission in your contract is held back. As soon as it is set,',
      'Se retiene por comercializar (':'Held back for selling (',
      'Sello válido':'Valid seal',
      'Si eres del equipo de Grupo Casa Pepe, entra en':'If you are on the Grupo Casa Pepe team, sign in at',
      'Si este año lo llenamos · toda tu empresa':'If we fill it this year · your whole company',
      'Si le pones correo, le llegará su QR para que se lo escaneemos al llegar.':'If you add an email, they get their QR code so we can scan it on arrival.',
      'Si lo mandas ahora, ya no les llega el recordatorio de tres horas antes: es el mismo correo.':'If you send it now, the three-hour reminder no longer reaches them: it is the same email.',
      'Si no tienes ninguno no pasa nada: lo que declaras aquí se publica como lo que haces, con tu nombre detrás. Eso es igual de honesto y no necesita certificado.':'If you have none, that is fine: what you declare here is published as what you do, with your name behind it. That is just as honest and needs no certificate.',
      'Si operas experiencias con nosotros y deberías tener acceso, escríbenos.':'If you run experiences with us and should have access, write to us.',
      'Si prefieres empezar de cero,':'If you would rather start from scratch,',
      'Si vendes el mismo lugar por dos lados, puede haber sobreventa':'If you sell the same place in two places, there can be overselling',
      'Si ya nos subiste tu INE, nos falta el número escrito. Si tienes RFC, pon el RFC.':'If you have already uploaded your ID, we are missing the number in writing. If you have an RFC, put the RFC.',
      'Si ya usas un sistema, lo conectamos para que el cupo no se venda dos veces.':'If you already use a system, we connect it so a place is never sold twice.',
      'Sin cobrar todavía':'Not charged yet',
      'Sin conciliar':'Not reconciled',
      'Sin correo':'No email',
      'Sin datos de contacto.':'No contact details.',
      'Sin declarar · no suma todavía':'Not declared · does not count yet',
      'Sin días':'No days',
      'Sin fecha':'No date',
      'Sin firmar':'Unsigned',
      'Sin líneas: se quedó vacío.':'No lines: it came out empty.',
      'Sin mandar':'Not sent',
      'Sin mínimo':'No minimum',
      'Sin pagar':'Unpaid',
      'Sin sistema, el cupo lo llevamos nosotros con los horarios que nos des en cada experiencia. Es lo más sencillo para arrancar.':'With no system, we keep the count of places using the times you give us on each experience. It is the simplest way to start.',
      'Sin tipo':'No type',
      'Sin tour ligado: nadie lo contará solo.':'No tour tied to it: nobody will count it on its own.',
      'Sin una foto no se publica: es lo primero que mira el huésped.':'Without a photo it does not get published: it is the first thing the guest looks at.',
      'Sincrético con la Declaración de Glasgow sobre la Acción Climática en el Turismo, de ONU Turismo.':'Sincrético has made to the Glasgow Declaration on Climate Action in Tourism, of UN Tourism.',
      'Sirve como sello en Europa':'It works as a seal in Europe',
      'Sirve, con un matiz':'It works, with a caveat',
      'Solo si tu sistema lo ofrece, y hay que pedir la llave':'Only if your system offers it, and the key has to be requested',
      'Sostenible son de Naciones Unidas; que aparezcan aquí no significa que la ONU respalde esta':'Goals belong to the United Nations; their appearing here does not mean the UN endorses this',
      'Su hotel':'Their hotel',
      'Sube tu primera experiencia':'Upload your first experience',
      'Sus eventos':'Their events',
      'Sí, silla de ruedas':'Yes, wheelchair',
      'Sí, ya pagó':'Yes, already paid',
      'Sí, ya tengo':'Yes, I have one',
      'Te dejamos aquí':'We are leaving you here',
      'Te distribuimos desde Bökun o Rezdy, donde ya estás.':'We distribute you from Bökun or Rezdy, where you already are.',
      'Te estábamos esperando y nos encanta lo que divulgas':'We were waiting for you, and we love what you put out',
      'Te faltan':'You are missing',
      'Te queda':'You keep',
      'Te trajimos':'We brought you',
      'Teléfono':'Phone',
      'Ten a la mano, si los tienes: RFC, tu póliza':'Have these to hand, if you have them: RFC, your policy',
      'Ten a la mano, si los tienes: RFC, tu póliza y los':'Have these to hand, if you have them: RFC, your policy and the',
      'Tiene que ser un número.':'It has to be a number.',
      'Tiene que venir alguien: al menos una persona.':'Somebody has to be coming: at least one person.',
      'Tienen que ser una o más personas.':'It has to be one person or more.',
      'Todas las fechas':'All dates',
      'Todavía nada. Si tienes alguno, aunque sea el Distintivo H, vale la pena anotarlo.':'Nothing yet. If you have any at all, even the Distintivo H, it is worth noting down.',
      'Todavía no':'Not yet',
      'Todavía no está abierta la vinculación. Escríbenos y lo dejamos listo.':'Linking is not open yet. Write to us and we will get it ready.',
      'Todavía no has contestado nada.':'You have not answered anything yet.',
      'Todavía no has dado de alta a nadie.':'You have not registered anyone yet.',
      'Todavía no has pedido nada. Puedes hacerlo cuando quieras.':'You have not requested anything yet. You can do it whenever you like.',
      'Todavía no has subido nada':'You have not uploaded anything yet',
      'Todavía no has subido nada. Empieza arriba.':'You have not uploaded anything yet. Start above.',
      'Todavía no hay contrato firmado.':'There is no signed contract yet.',
      'Todavía no hay nada aquí.':'There is nothing here yet.',
      'Todavía no hay ninguna experiencia tuya con calendario, así que no hay salidas que programar.':'None of your experiences has a calendar yet, so there are no departures to schedule.',
      'Todavía no hay ningún servicio dado de alta. Sin servicio no hay nada que contar.':'No service has been registered yet. With no service there is nothing to count.',
      'Todavía no se ha armado ningún ticket. Sale el viernes, después del último servicio de la semana.':'No ticket has been built yet. It comes out on Friday, after the last service of the week.',
      'Todavía no te ha reservado nadie. En cuanto publiquemos un tour tuyo, las ventas caen aquí solas.':'Nobody has booked you yet. As soon as we publish one of your tours, the sales land here on their own.',
      'Todavía no tienes a nadie marcado como que atiende clientes.':'You have nobody marked as dealing with customers yet.',
      'Todos mis tours':'All my tours',
      'Tu RFC o CURP':'Your RFC or CURP',
      'Tu RFC o CURP, para poder facturarte y responder por lo que vendes.':'Your RFC or CURP, so we can invoice you and answer for what you sell.',
      'Tu Stripe vinculado':'Your Stripe linked',
      'Tu Stripe ya está vinculado.':'Your Stripe is already linked.',
      'Tu WhatsApp':'Your WhatsApp',
      'Tu alta marcó que traes hotel, pero no encontramos su ficha.':'Your registration said you bring a hotel, but we cannot find its page.',
      'Tu calendario':'Your calendar',
      'Tu calendario (iCal)':'Your calendar (iCal)',
      'Tu contrato está listo. Léelo y fírmalo en la pestaña que se abrió.':'Your contract is ready. Read it and sign it in the tab that just opened.',
      'Tu contrato ya está firmado: te abrimos tu copia.':'Your contract is already signed: we are opening your copy.',
      'Tu empresa y tus contactos':'Your company and your contacts',
      'Tu impacto quedó guardado.':'Your impact has been saved.',
      'Tu nombre completo':'Your full name',
      'Tu sesión caducó. Entra otra vez con tu correo para seguir donde ibas.':'Your session expired. Sign in again with your email to pick up where you were.',
      'TuriTop ya lo usamos en casa. Lo conectamos nosotros.':'We already use TuriTop in-house. We connect it ourselves.',
      'Tus datos fiscales y tu correo de reservas':'Your tax details and your bookings email',
      'Tus tours':'Your tours',
      'Tú nos das los horarios y el máximo por salida en cada experiencia. Sincrético lleva la cuenta y cada venta te llega al correo de reservas. Si tú vendes por fuera y se te llena, avísanos.':'You give us the times and the maximum per departure on each experience. Sincrético keeps count and every sale reaches your bookings email. If you sell elsewhere and fill up, let us know.',
      'Un grupo no se vende solo: lo que el viajero reserva es una casa. Cuelga la primera.':'A group does not sell by itself: what the traveller books is a house. Put the first one up.',
      'Va en azul hasta que':'It stays blue until',
      'Ve a «Cómo te pagamos»: vincúlalo, o cambia a anticipo y resto al guía.':'Go to “How we pay you”: link it, or switch to deposit and the rest to the guide.',
      'Vence en':'Due in',
      'Vence hoy':'Due today',
      'Vencido y sin cobrar':'Overdue and unpaid',
      'Vendida en la web':'Sold on the web',
      'Vendida en recepción':'Sold at the front desk',
      'Ver y firmar mi convenio':'Read and sign my agreement',
      'Vigencia de la póliza':'Policy valid until',
      'Vincula tu Stripe, o elige anticipo y resto al guía.':'Link your Stripe, or choose deposit and the rest to the guide.',
      'Vinculada, pero Stripe aún no te deja cobrar':'Linked, but Stripe will not let you take payment yet',
      'Vinculado, pero Stripe todavía te pide unos datos para poder cobrar.':'Linked, but Stripe still needs some details from you before you can take payment.',
      'Vinculas tu Stripe y el dinero de cada venta te cae directo. No pasa por nosotros.':'You link your Stripe and the money from every sale lands straight with you. It does not pass through us.',
      'Vista de Casa Pepe':'Casa Pepe\'s view',
      'Visto al revés: sobre los':'Seen the other way round: on the',
      'Volver al panel':'Back to the panel',
      'Vuelve a cargar la página. Si sigue igual, mándale esto a Casa Pepe:':'Reload the page. If it stays the same, send this to Casa Pepe:',
      'Xola tiene API. Hay que pedirles acceso; mientras tanto, iCal o manual.':'Xola has an API. Access has to be requested from them; until then, iCal or manual.',
      'Y entonces, ¿qué pasa?':'So what happens then?',
      'Ya está en tu equipo':'Already on your team',
      'Cuántas personas':'How many people',
      'Hay una incidencia':'There is an issue',
      'Otro — no está en la lista':'Other — not on the list',
      'Subir el Excel del día':'Upload the day\'s Excel',
      'Ver más':'See more',
      'Ya está enlazada a otra cuenta':'It is already linked to another account',
      'Ya puedes vender':'You can sell now',
      'Ya salió el':'It already ran on',
      'Ya tienes cuenta. Aquí subes tus experiencias y las vendemos':'You already have an account. This is where you upload your experiences and we sell them',
      'a la semana':'a week',
      'a la venta':'on sale',
      'a ti, en mano, el día del tour.':'to you, in person, on the day of the tour.',
      'a tus':'to your',
      'al año ·':'a year ·',
      'al día':'a day',
      'al reservar — eso es nuestro —':'when booking — that part is ours —',
      'aquí te sale la cuenta hecha; si no la tienes clara, escríbenos antes de publicar.':'the sums come out here ready-made; if you are not clear on it, write to us before publishing.',
      'cada persona':'each person',
      'cada salida':'each departure',
      'con IVA · por':'incl. tax · per',
      'con acceso ·':'with access ·',
      'con cita para verla':'with a viewing appointment',
      'con contrato':'with a contract',
      'con lo vendido hasta hoy. Lo de arriba es el escenario; esto es la medición.':'on what has been sold so far. The part above is the scenario; this is the measurement.',
      'contrato desde':'contract from',
      'correo@ejemplo.com':'you@example.com',
      'cuánto dura':'how long it runs',
      'cuántos cuartos tiene':'how many rooms it has',
      'declara que su operación genera impacto en los siguientes Objetivos de':'declares that its operation has an impact on the following Sustainable',
      'declaración.':'declaration.',
      'del menú de La Cósmica.':'from the La Cósmica menu.',
      'días y horarios de tus tours.':'days and times of your tours.',
      'el almacén lo rechazó (':'storage refused it (',
      'el máximo por salida':'the maximum per departure',
      'el precio':'the price',
      'el punto de encuentro':'the meeting point',
      'el resto te lo paga a ti, en mano, el día del tour':'they pay you the rest in person, on the day of the tour',
      'el tipo':'the type',
      'en borrador':'in draft',
      'en la recepción de nuestros hoteles y en el concierge de los huéspedes. Antes de publicar':'at our hotels\' front desks and in the guests\' concierge. Before publishing',
      'en tu galería':'in your gallery',
      'es lo que llevas este año de verdad,':'is what you have genuinely done this year,',
      'estimado: lo sacamos de tu precio público menos la comisión de la plataforma donde lo vendes.':'an estimate: we work it out from your public price minus the commission of the platform you sell on.',
      'habla inglés':'speaks English',
      'la base respondió':'the database answered',
      'la ciudad':'the city',
      'la dirección':'the address',
      'la línea que la vende':'the line that sells it',
      'la primera hay que completar tu alta; se guarda lo que lleves.':'the first one, your registration has to be finished; whatever you have is saved.',
      'las cuentas y los contratos, en':'the accounts and the contracts, in',
      'las horas':'the times',
      'lo confirmes, y no se publica nada sin que pases por ahí. Si algo está mal, lo corriges y':'you confirm it, and nothing is published without you going through it. If something is wrong, you fix it and',
      'los días':'the days',
      'mañana':'tomorrow',
      'mes(es)':'month(s)',
      'miércoles':'Wednesday',
      'ninguna a la venta todavía':'none on sale yet',
      'no cargó el lector':'the reader did not load',
      'no salieron. Los que fallaron siguen esperando el recordatorio automático.':'did not go out. The ones that failed are still waiting for the automatic reminder.',
      'no se pudo':'it could not be done',
      'no se pudo (':'it could not be done (',
      'para el mínimo':'for the minimum',
      'paradas del recorrido':'stops on the route',
      'pedida':'requested',
      'que haces.':'that you do.',
      'que te quedan, equivale a un':'you keep, that comes to a',
      'quítalas':'remove them',
      'sale y a qué precio.':'it runs and at what price.',
      'se queda como tú lo dejes.':'it stays as you leave it.',
      'se quedan en la comunidad local ·':'stay in the local community ·',
      'se quedaron fuera por no traer nombre o personas.':'were left out for having no name or no head count.',
      'sin IVA':'before tax',
      'sin asignar':'unassigned',
      'sin correo':'no email',
      'sin detalle':'no detail',
      'sin hora':'no time',
      'sin pagar':'unpaid',
      'sábado':'Saturday',
      'tal como lo ve ella.':'exactly as she sees it.',
      'todavía no':'not yet',
      'todavía sin casas':'no houses yet',
      'traída':'brought in',
      'tu RFC o CURP':'your RFC or CURP',
      'tu experiencia':'your experience',
      'tu tour':'your tour',
      'un correo':'an email',
      'un teléfono o WhatsApp':'a phone number or WhatsApp',
      'vendido en':'sold on',
      'viajeros al año':'travellers a year',
      'y dos botones para decirte si vienen. Mándalo cuando quieras: una hora antes también vale.':'and two buttons to tell you whether they are coming. Send it whenever you like: an hour before works too.',
      'y los días y horarios de tus tours.':'and the days and times of your tours.',
      'y no afecta a los tours que ya tengas vendidos.':'and it does not affect tours you have already sold.',
      'y no quedó':'and it did not stay',
      'y sin ella no hay dónde montar un evento. Se crea en La Comunidad, en su ficha.':'and without it there is nowhere to stage an event. It is created in La Comunidad, on its own page.',
      'y te paga':'and pays you',
      'ya entró':'already in',
      'ya está ocupada':'already taken',
      'ya estás haciendo':'you are already doing',
      'ya la tenías)':'you already had it)',
      '· código':'· code',
      '· para ti':'· for you',
      '· reservó':'· booked',
      '· su orden':'· their order',
      '· última lectura':'· last scan',
      '· último escaneo':'· last scan',
      '» colgada. Ábrela y dile cuántos cuartos tiene.':'” is up. Open it and tell it how many rooms it has.',
      '», que vendes a':'”, which you sell at',
      '¿Borramos «':'Delete “',
      '¿Cómo se llama la casa?':'What is the house called?',
      '¿El portal de quién?':'Whose portal?',
      '¿Está pagada?':'Is it paid?',
      '¿Lo quitamos?':'Shall we remove it?',
      '¿Quién lo emite?':'Who issues it?',
      '¿Seguro? Pulsa otra vez':'Are you sure? Press again',
      '¿Te suena?':'Does it ring a bell?',
      '¿Tienes RNT?':'Do you have an RNT?',
      '¿Tienes póliza?':'Do you have a policy?',
      '¿Ya tienes tours publicados por ahí?':'Do you already have tours published out there?',
      '— ninguno, se apunta a mano —':'— none, it is logged by hand —',
      '— sin asignar —':'— unassigned —',
      '⚠️ Sin pagar':'⚠️ Unpaid',
      '⚠️ Ya se usó':'⚠️ Already used',
      '⛔ No es de aquí':'⛔ Not from here',
      '✓ en':'✓ in',
      '✓ ya sale':'✓ already running',
      '＋ Apuntar una reserva de fuera':'＋ Log an outside booking',
      '＋ Colgar una casa':'＋ Put up a house',
      '＋ Subir mi primera experiencia':'＋ Upload my first experience',
      /* LOS MOLDES DEL PORTAL. Lo que lleva un valor dentro: el barrido las reconoce por el hueco {a} y lo vuelve a poner donde toca en ingles. 27-oct-2026. */
      '({a} ya la tenías)':'({a} you already had)',
      'Antes de firmar nos falta {a}. Sin eso el contrato se firma pero no puedes publicar.':'Before signing we still need {a}. Without that the contract can be signed but you cannot publish.',
      'Antes de mandarla a revisión falta: {a}.':'Before sending it for review, this is missing: {a}.',
      'Apagado':'Switched off',
      'Apuntar un servicio dado · {a}':'Log a service given · {a}',
      'Avisados {a}, y {b} no salieron. Los que fallaron siguen esperando el recordatorio automático.':'{a} notified, and {b} did not go out. The ones that failed are still waiting for the automatic reminder.',
      'Cargadas {a} reserva.':'{a} booking loaded.',
      'Cargadas {a} reservas.':'{a} bookings loaded.',
      'Cargadas {a}, y {b} se quedaron fuera por no traer nombre o personas.':'{a} loaded, and {b} were left out for having no name or no head count.',
      'Comprimido: de {a} MB a {b} MB':'Compressed: from {a} MB to {b} MB',
      'Confirma la salida de hoy a tus {a} cliente':'Confirm today\'s departure for your {a} customer',
      'Confirma la salida de hoy a tus {a} clientes':'Confirm today\'s departure for your {a} customers',
      'Confirma la salida de mañana a tus {a} cliente':'Confirm tomorrow\'s departure for your {a} customer',
      'Confirma la salida de mañana a tus {a} clientes':'Confirm tomorrow\'s departure for your {a} customers',
      'Cuenta con {a}.':'It holds {a}.',
      'Declarado bajo protesta de decir verdad por {a}':'Declared under oath by {a}',
      'Emitido por Sincrético el {a}':'Issued by Sincrético on {a}',
      'Encontramos {a}. ¿Cuál es tuyo?':'We found {a}. Which one is yours?',
      'Ese día no tienes salidas. Las salidas vienen del calendario de cada experiencia: si falta una, es que su ficha no la ofrece ese día.':'You have no departures that day. Departures come from each experience\'s calendar: if one is missing, its page is not offering it that day.',
      'Firmada por {a}':'Signed by {a}',
      'Foto {a} de {b}':'Photo {a} of {b}',
      'Le falta {a}.':'It is missing {a}.',
      'Les llega cómo encontrarte y dos botones para decirte si vienen. Mándalo cuando quieras: una hora antes también vale.':'They get how to find you and two buttons to tell you whether they are coming. Send it whenever you like: an hour before works too.',
      'Les llega cómo encontrarte, su hora de recogida y dos botones para decirte si vienen. Mándalo cuando quieras: una hora antes también vale.':'They get how to find you, their pick-up time and two buttons to tell you whether they are coming. Send it whenever you like: an hour before works too.',
      'Listo: avisados {a} cliente.':'Done: {a} customer notified.',
      'Listo: avisados {a} clientes.':'Done: {a} customers notified.',
      'Lo intentaste el {a} y no quedó':'You tried on {a} and it did not stick',
      'No encontramos nada con «{a}». Prueba con el nombre de un tour tuyo, o sigue de largo y súbelos tú: se tarda menos de lo que parece.':'We found nothing with “{a}”. Try the name of one of your tours, or carry straight on and upload them yourself: it takes less time than it looks.',
      'No encontramos nada con «{a}». Prueba con la liga de un anuncio tuyo, o sigue llenando a mano más abajo.':'We found nothing with “{a}”. Try the link to one of your listings, or carry on filling it in by hand below.',
      'No pudimos abrir tus hoteles: {a}':'We could not open your hotels: {a}',
      'No pudimos leer ese archivo: {a}':'We could not read that file: {a}',
      'No pudimos traer la conciliación: {a}':'We could not fetch the reconciliation: {a}',
      'No pudimos traer tu semana: {a}':'We could not fetch your week: {a}',
      'No se pudo abrir Stripe: {a}':'Stripe could not be opened: {a}',
      'No se pudo abrir la cámara: {a}. Usa el código, abajo.':'The camera could not be opened: {a}. Use the code below.',
      'No se pudo abrir tu contrato: {a}':'Your contract could not be opened: {a}',
      'No se pudo buscar ({a}). Inténtalo otra vez.':'The search failed ({a}). Try again.',
      'No se pudo crear: {a}':'It could not be created: {a}',
      'No se pudo firmar: {a}':'It could not be signed: {a}',
      'No se pudo guardar. {a}':'It could not be saved. {a}',
      'No se pudo marcar: {a}':'It could not be marked: {a}',
      'No se pudo terminar la vinculación: {a}':'The linking could not be finished: {a}',
      'Persona {a} de {b}':'Person {a} of {b}',
      'Persona {a} de {b} · folio {c}':'Person {a} of {b} · ref {c}',
      'Reserva de otra plataforma · cargada desde {a}':'Booking from another platform · loaded from {a}',
      'Se escaneó el {a}':'It was scanned on {a}',
      'Se retiene por comercializar ({a}%)':'Held back for selling ({a}%)',
      'Te dejamos aquí tu experiencia, con el recorrido, qué incluye, de dónde sale y a qué precio.':'We are leaving you your experience here, with the route, what is included, where it leaves from and at what price.',
      'Te dejamos aquí tus {a} experiencias, con el recorrido, qué incluye, de dónde sale y a qué precio.':'We are leaving you your {a} experiences here, with the route, what is included, where it leaves from and at what price.',
      'Te estábamos esperando y nos encanta lo que divulgas, {a}':'We were waiting for you, and we love what you put out, {a}',
      'Traes {a} cosa del menú de La Cósmica.':'You are bringing {a} thing from the La Cósmica menu.',
      'Traes {a} cosas del menú de La Cósmica.':'You are bringing {a} things from the La Cósmica menu.',
      'Vence en {a} día':'Due in {a} day',
      'Vence en {a} días':'Due in {a} days',
      'Vencida hace {a} día':'Overdue by {a} day',
      'Vencida hace {a} días':'Overdue by {a} days',
      'Visto al revés: sobre los {a} que te quedan, equivale a un {b}%. Es la misma cantidad, contada desde el otro lado.':'Seen the other way round: on the {a} you keep, that comes to {b}%. It is the same amount, counted from the other side.',
      'Volver a notificar':'Notify them again',
      'Ya salió el {a} a las {b}. Mándalo otra vez si hace falta.':'It already went out on {a} at {b}. Send it again if you need to.',
      'cancelada':'cancelled',
      'con acceso · {a}':'with access · {a}',
      'el almacén lo rechazó ({a})':'storage refused it ({a})',
      'entraron todos':'all in',
      'entró':'in',
      'faltan {a} para el mínimo':'{a} short of the minimum',
      'no se pudo ({a})':'it could not be done ({a})',
      'pagada':'paid',
      'persona en {a} reserva':'person in {a} booking',
      'persona en {a} reservas':'person in {a} bookings',
      'personas en {a} reserva':'people in {a} booking',
      'personas en {a} reservas':'people in {a} bookings',
      'pesa {a} MB y el tope de una foto son 25':'it weighs {a} MB and the cap for a photo is 25',
      'pesa {a} MB y el tope son 200':'it weighs {a} MB and the cap is 200',
      'vendido en {a} · para ti':'sold at {a} · for you',
      'ya entraron':'already in',
      '{a} apuntados':'{a} signed up',
      '{a} archivo en tu galería':'{a} file in your gallery',
      '{a} archivo · {b} sin asignar':'{a} file · {b} unassigned',
      '{a} archivos en tu galería':'{a} files in your gallery',
      '{a} archivos · {b} sin asignar':'{a} files · {b} unassigned',
      '{a} con IVA · por {b}':'{a} incl. tax · per {b}',
      '{a} de {b} dentro':'{a} of {b} in',
      '{a} de {b} lugares':'{a} of {b} places',
      '{a} evento':'{a} event',
      '{a} eventos':'{a} events',
      '{a} experiencia':'{a} experience',
      '{a} experiencia en borrador':'{a} experience in draft',
      '{a} experiencias':'{a} experiences',
      '{a} experiencias en borrador':'{a} experiences in draft',
      '{a} persona':'{a} person',
      '{a} persona · su orden {b}':'{a} person · their order {b}',
      '{a} personas':'{a} people',
      '{a} personas · su orden {b}':'{a} people · their order {b}',
      '{a} reseñas':'{a} reviews',
      '{a} traída':'{a} brought in',
      '{a} traída · {b} fallaron':'{a} brought in · {b} failed',
      '{a} traídas':'{a} brought in',
      '{a} traídas · {b} fallaron':'{a} brought in · {b} failed',
      '{a} · ninguna a la venta todavía':'{a} · none on sale yet',
      '{a} · {b} a la venta':'{a} · {b} on sale',
      '{a} · {b} adulto y {c} niño':'{a} · {b} adult and {c} child',
      '{a} · {b} adulto y {c} niños':'{a} · {b} adult and {c} children',
      '{a} · {b} adultos y {c} niño':'{a} · {b} adults and {c} child',
      '{a} · {b} adultos y {c} niños':'{a} · {b} adults and {c} children',
      '«{a}» colgada. Ábrela y dile cuántos cuartos tiene.':'“{a}” is up. Open it and tell it how many rooms it has.',
      '· código {a} · reservó {b}':'· code {a} · booked {b}',
      '· código {a} · reservó {b} · último escaneo {c}':'· code {a} · booked {b} · last scan {c}',
      '· folio {a}':'· ref {a}',
      '· reservó {a}':'· booked {a}',
      '· reservó {a} · último escaneo {b}':'· booked {a} · last scan {b}',
      '¿Borramos «{a}»?':'Delete “{a}”?',
      '✓ en {a}':'✓ in {a}',

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
      /* EL VALOR DE UN CAMPO. Lo piden las fichas de ejemplo, donde lo que se
         lee dentro del campo no es un placeholder sino un valor de muestra. */
      r.querySelectorAll('[data-i18n-val]').forEach(function(el){
        var k = el.getAttribute('data-i18n-val'); el.value = t(k);
      });
      /* LA DESCRIPCION DE LA PAGINA. No la ve el huesped en la pantalla, pero
         si cuando comparte la liga por WhatsApp, y era lo ultimo que seguia
         saliendo en espanol en una app puesta en ingles. 27-oct-2026. */
      if(!raiz) try{
        var md=document.querySelector('meta[name="description"]');
        if(md){ var v=t(md.getAttribute('content')||''); if(v) md.setAttribute('content', v); }
      }catch(_){}
      titulo();
    }catch(_){}
  }

  /* ------------------------------------------------------------------------
     BARRIDO POR NODO DE TEXTO.

     El barrido de arriba necesita que alguien haya marcado el HTML con
     data-i18n. Hay pantallas donde eso no se puede pedir: el alta del
     ateneista, por ejemplo, se construye entera desde el JS, paso a paso, y
     marcar ciento cuarenta trozos de innerHTML a mano habria dejado fuera el
     primero que se anada manana sin acordarse de marcarlo.

     Para esas, se traduce por NODO DE TEXTO: se recorre lo que hay pintado, se
     busca lo que dice cada nodo en el diccionario y, si esta, se cambia. La
     llave es la frase en espanol con los espacios normalizados, asi que no se
     rompe cuando alguien reindenta el HTML, y lo que no este traducido sale en
     espanol, nunca en blanco. Javi, 27-oct-2026.

     OJO: esto NO toca el valor de los campos -lo que escribe la persona vive en
     .value, no en un nodo de texto-, ni entra en script, style ni textarea. */
  var NO_ENTRAR = { SCRIPT:1, STYLE:1, TEXTAREA:1, CODE:1, PRE:1 };
  function normEs(x){ return String(x==null?'':x).replace(/\s+/g,' ').trim(); }
  function tNodo(x){
    var d = UI[resuelve()]; if(!d) return null;
    var k = normEs(x);
    if(!k) return null;
    return Object.prototype.hasOwnProperty.call(d,k) ? d[k] : null;
  }

  /* LOS MOLDES. 27-oct-2026.
     La busqueda de arriba compara el nodo entero, y eso deja fuera justo lo que
     mas se lee: la frase que lleva un valor dentro. «No pudimos traer tu
     semana: ECONNRESET» no esta en el diccionario y nunca va a estarlo, porque
     la mitad la pone el servidor.

     Antes esto se arreglaba a mano, cableando T() en cada sitio. En el portal
     de la touroperadora eran ciento cuarenta y siete sitios dentro de un
     fichero de trescientos kilos: cada uno, una ocasion de romper algo que
     funciona. Asi que la llave admite huecos. Se escribe

         'No pudimos traer tu semana: {a}' : 'We could not fetch your week: {a}'

     y el barrido reconoce el nodo, saca lo que cayo en el hueco y lo vuelve a
     poner en su sitio del ingles -que no es el mismo sitio, y eso es justo lo
     que no se podia hacer concatenando-. Los huecos son {a}, {b} y {c}.

     Para que esto no cueste un barrido entero por nodo, los moldes se indexan
     por las primeras letras de su parte fija: un nodo solo se compara con los
     moldes que empiezan como el. Los que empiezan por hueco van a una lista
     aparte, que es corta. */
  var MOLDES = null, MOLDES_IDI = null;
  var HUECO = /\{([abc])\}/g;
  function escRe(x){ return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  /* La llave del indice son cuatro letras de la parte fija, ya normalizada.
     Tienen que ser pocas y las mismas por los dos lados: con seis, «Foto {a}
     de {b}» se guardaba en «foto» y el nodo «Foto 2 de 5» se buscaba en
     «foto 2», y no se encontraban nunca. */
  function corte(x){ return normEs(x).slice(0,4).toLowerCase(); }
  function armaMoldes(){
    var idi = resuelve();
    if(MOLDES && MOLDES_IDI===idi) return MOLDES;
    MOLDES_IDI = idi;
    MOLDES = { porCorte:{}, sinCorte:[] };
    var d = UI[idi]; if(!d) return MOLDES;
    for(var k in d){
      if(!Object.prototype.hasOwnProperty.call(d,k)) continue;
      if(k.indexOf('{')<0) continue;
      HUECO.lastIndex = 0;
      var orden = [], m;
      while((m = HUECO.exec(k))) orden.push(m[1]);
      if(!orden.length) continue;
      var re = '^' + k.split(HUECO).map(function(tr,i){
        /* split con grupo intercala los nombres de los huecos */
        return i%2 ? '([\\s\\S]*?)' : escRe(tr);
      }).join('') + '$';
      var mol = { re:new RegExp(re), orden:orden, sale:d[k] };
      mol.peso = k.replace(HUECO,'').length;      /* lo fijo, para ordenar */
      var cab = k.split('{')[0];
      if(normEs(cab).length>=4) (MOLDES.porCorte[corte(cab)] = MOLDES.porCorte[corte(cab)] || []).push(mol);
      else MOLDES.sinCorte.push(mol);
    }
    /* Primero el molde que mas texto fijo trae: entre «{a} personas» y «Vienen
       {a} personas», el segundo es el que de verdad describe el nodo. */
    function ordena(l){ l.sort(function(a,b){ return b.peso - a.peso; }); }
    for(var c in MOLDES.porCorte) if(Object.prototype.hasOwnProperty.call(MOLDES.porCorte,c)) ordena(MOLDES.porCorte[c]);
    ordena(MOLDES.sinCorte);
    return MOLDES;
  }
  /* El ultimo hueco se vuelve codicioso: si no, «No se pudo buscar ({a}).
     Intentalo otra vez.» se queda con el primer parentesis que encuentre. */
  function tMolde(x){
    var k = normEs(x);
    if(!k || k.length<3) return null;
    var M = armaMoldes();
    var cand = (M.porCorte[corte(k)] || []).concat(M.sinCorte);
    for(var i=0;i<cand.length;i++){
      var r = cand[i].re.exec(k);
      if(!r) continue;
      var sale = cand[i].sale;
      for(var j=0;j<cand[i].orden.length;j++){
        sale = sale.replace('{'+cand[i].orden[j]+'}', r[j+1]);
      }
      return sale;
    }
    return null;
  }

  var ATRS_T = ['alt','aria-label','title','placeholder'];
  function barreTexto(raiz){
    if(resuelve()==='es') return;
    var r = raiz || document.body;
    if(!r) return;
    try{
      var w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
        acceptNode:function(n){
          var p=n.parentNode;
          if(!p || NO_ENTRAR[p.nodeName]) return NodeFilter.FILTER_REJECT;
          return (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var lista=[], n;
      while((n=w.nextNode())) lista.push(n);
      lista.forEach(function(nd){
        var v = tNodo(nd.nodeValue);
        if(v==null) v = tMolde(nd.nodeValue);
        if(v==null) return;
        var s = nd.nodeValue;
        /* Se conservan los espacios de los bordes: hay nodos que son media
           frase y van pegados a un <b> o a un numero. */
        nd.nodeValue = s.match(/^\s*/)[0] + v + s.match(/\s*$/)[0];
      });
      ATRS_T.forEach(function(a){
        r.querySelectorAll('['+a+']').forEach(function(el){
          var crudo = el.getAttribute(a);
          var v = tNodo(crudo);
          if(v==null) v = tMolde(crudo);
          if(v!=null) el.setAttribute(a, v);
        });
      });
    }catch(_){}
  }

  /* Para las pantallas que se repintan solas: se barre lo que llegue, sin que
     cada paso tenga que acordarse de llamar. Un solo observador, y se agrupa
     con requestAnimationFrame para no barrer cien veces por pintado. */
  var VIGILA = null;
  function vigila(raiz){
    if(resuelve()==='es') return;
    var r = raiz || document.body;
    if(!r || VIGILA) { try{ barre(r); barreTexto(r); }catch(_){} return; }
    try{ barre(r); barreTexto(r); }catch(_){}
    var pendiente = false;
    VIGILA = new MutationObserver(function(){
      if(pendiente) return;
      pendiente = true;
      requestAnimationFrame(function(){
        pendiente = false;
        try{ barre(r); barreTexto(r); }catch(_){}
      });
    });
    try{ VIGILA.observe(r, {childList:true, subtree:true, characterData:true}); }catch(_){}
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
    barreTexto: barreTexto,
    /* Por si una pantalla quiere pedir un molde a mano: tn('Son {a} noches',3) */
    tn: function(molde,a,b,c){
      var v = t(molde);
      return String(v).replace('{a}',a==null?'':a).replace('{b}',b==null?'':b).replace('{c}',c==null?'':c);
    },
    vigila: vigila,
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
