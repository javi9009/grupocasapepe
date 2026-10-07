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
      'Precio reducido':'Reduced price',
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
        'The company that runs the tour declares this in writing and under oath when it signs up with us. It is their declaration, not our audit.'
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
    fechas: fechas,
    /* Para que el <html lang> diga la verdad desde el primer pintado. */
    marca: function(){ try{ document.documentElement.lang = resuelve(); }catch(_){} }
  };
  window.sincI18n.marca();
})();
