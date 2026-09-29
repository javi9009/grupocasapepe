/* tel.js — el teléfono, con su país.
 *
 * Cualquier campo de teléfono o WhatsApp de cualquier pantalla del Grupo se
 * convierte solo en dos piezas: un botón con la bandera y el prefijo, y el
 * número. El prefijo se elige de una lista con buscador por letras (nombre
 * del país en español o en inglés, sus dos letras, o el propio prefijo).
 *
 * Por qué: sin prefijo no sabemos de dónde es quien se da de alta. Con él,
 * cada huésped, cada Pepe y cada productora traen de dónde son —o al menos
 * dónde viven— sin preguntarles una cosa más.
 *
 * No hay que tocar las pantallas: el.value sigue devolviendo el teléfono,
 * ahora en internacional (+525512345678), y el país queda en el.dataset.pais
 * con sus dos letras. Quien quiera guardarlo, lo lee de ahí.
 *
 * Se monta solo: los campos que ya están, los que la pantalla pinta después
 * con innerHTML, y los que aparezcan más tarde. Para dejar uno fuera:
 * data-tel="no".
 */
(function () {
  if (window.__tel) return;
  window.__tel = true;

  /* [dos letras, prefijo, nombre en español, nombre en inglés si cambia] */
  var P = [["AF","93","Afganistán","Afghanistan"],["AL","355","Albania",null],["DE","49","Alemania","Germany"],["AD","376","Andorra",null],["AO","244","Angola",null],["AI","1","Anguila","Anguilla"],["AG","1","Antigua y Barbuda","Antigua & Barbuda"],["SA","966","Arabia Saudí","Saudi Arabia"],["DZ","213","Argelia","Algeria"],["AR","54","Argentina",null],["AM","374","Armenia",null],["AW","297","Aruba",null],["AU","61","Australia",null],["AT","43","Austria",null],["AZ","994","Azerbaiyán","Azerbaijan"],["BS","1","Bahamas",null],["BD","880","Bangladés","Bangladesh"],["BB","1","Barbados",null],["BH","973","Baréin","Bahrain"],["BE","32","Bélgica","Belgium"],["BZ","501","Belice","Belize"],["BJ","229","Benín","Benin"],["BM","1","Bermudas","Bermuda"],["BY","375","Bielorrusia","Belarus"],["BO","591","Bolivia",null],["BA","387","Bosnia y Herzegovina","Bosnia & Herzegovina"],["BW","267","Botsuana","Botswana"],["BR","55","Brasil","Brazil"],["BN","673","Brunéi","Brunei"],["BG","359","Bulgaria",null],["BF","226","Burkina Faso",null],["BI","257","Burundi",null],["BT","975","Bután","Bhutan"],["CV","238","Cabo Verde","Cape Verde"],["KH","855","Camboya","Cambodia"],["CM","237","Camerún","Cameroon"],["CA","1","Canadá","Canada"],["BQ","599","Caribe neerlandés","Caribbean Netherlands"],["QA","974","Catar","Qatar"],["TD","235","Chad",null],["CZ","420","Chequia","Czechia"],["CL","56","Chile",null],["CN","86","China",null],["CY","357","Chipre","Cyprus"],["VA","39","Ciudad del Vaticano","Vatican City"],["CO","57","Colombia",null],["KM","269","Comoras","Comoros"],["CG","242","Congo","Congo - Brazzaville"],["KP","850","Corea del Norte","North Korea"],["KR","82","Corea del Sur","South Korea"],["CR","506","Costa Rica",null],["CI","225","Côte d’Ivoire",null],["HR","385","Croacia","Croatia"],["CU","53","Cuba",null],["CW","599","Curazao","Curaçao"],["DK","45","Dinamarca","Denmark"],["DM","1","Dominica",null],["EC","593","Ecuador",null],["EG","20","Egipto","Egypt"],["SV","503","El Salvador",null],["AE","971","Emiratos Árabes Unidos","United Arab Emirates"],["ER","291","Eritrea",null],["SK","421","Eslovaquia","Slovakia"],["SI","386","Eslovenia","Slovenia"],["ES","34","España","Spain"],["US","1","Estados Unidos","United States"],["EE","372","Estonia",null],["SZ","268","Esuatini","Eswatini"],["ET","251","Etiopía","Ethiopia"],["PH","63","Filipinas","Philippines"],["FI","358","Finlandia","Finland"],["FJ","679","Fiyi","Fiji"],["FR","33","Francia","France"],["GA","241","Gabón","Gabon"],["GM","220","Gambia",null],["GE","995","Georgia",null],["GH","233","Ghana",null],["GI","350","Gibraltar",null],["GD","1","Granada","Grenada"],["GR","30","Grecia","Greece"],["GL","299","Groenlandia","Greenland"],["GP","590","Guadalupe","Guadeloupe"],["GU","1","Guam",null],["GT","502","Guatemala",null],["GF","594","Guayana Francesa","French Guiana"],["GG","44","Guernesey","Guernsey"],["GN","224","Guinea",null],["GQ","240","Guinea Ecuatorial","Equatorial Guinea"],["GW","245","Guinea-Bisáu","Guinea-Bissau"],["GY","592","Guyana",null],["HT","509","Haití","Haiti"],["HN","504","Honduras",null],["HU","36","Hungría","Hungary"],["IN","91","India",null],["ID","62","Indonesia",null],["IQ","964","Irak","Iraq"],["IR","98","Irán","Iran"],["IE","353","Irlanda","Ireland"],["AC","247","Isla de la Ascensión","Ascension Island"],["IM","44","Isla de Man","Isle of Man"],["CX","61","Isla de Navidad","Christmas Island"],["NF","672","Isla Norfolk","Norfolk Island"],["IS","354","Islandia","Iceland"],["AX","358","Islas Aland","Åland Islands"],["KY","1","Islas Caimán","Cayman Islands"],["CC","61","Islas Cocos","Cocos (Keeling) Islands"],["CK","682","Islas Cook","Cook Islands"],["FO","298","Islas Feroe","Faroe Islands"],["FK","500","Islas Malvinas","Falkland Islands"],["MP","1","Islas Marianas del Norte","Northern Mariana Islands"],["MH","692","Islas Marshall","Marshall Islands"],["SB","677","Islas Salomón","Solomon Islands"],["TC","1","Islas Turcas y Caicos","Turks & Caicos Islands"],["VG","1","Islas Vírgenes Británicas","British Virgin Islands"],["VI","1","Islas Vírgenes de EE. UU.","U.S. Virgin Islands"],["IL","972","Israel",null],["IT","39","Italia","Italy"],["JM","1","Jamaica",null],["JP","81","Japón","Japan"],["JE","44","Jersey",null],["JO","962","Jordania","Jordan"],["KZ","7","Kazajistán","Kazakhstan"],["KE","254","Kenia","Kenya"],["KG","996","Kirguistán","Kyrgyzstan"],["KI","686","Kiribati",null],["XK","383","Kosovo",null],["KW","965","Kuwait",null],["LA","856","Laos",null],["LS","266","Lesoto","Lesotho"],["LV","371","Letonia","Latvia"],["LB","961","Líbano","Lebanon"],["LR","231","Liberia",null],["LY","218","Libia","Libya"],["LI","423","Liechtenstein",null],["LT","370","Lituania","Lithuania"],["LU","352","Luxemburgo","Luxembourg"],["MK","389","Macedonia del Norte","North Macedonia"],["MG","261","Madagascar",null],["MY","60","Malasia","Malaysia"],["MW","265","Malaui","Malawi"],["MV","960","Maldivas","Maldives"],["ML","223","Mali",null],["MT","356","Malta",null],["MA","212","Marruecos","Morocco"],["MQ","596","Martinica","Martinique"],["MU","230","Mauricio","Mauritius"],["MR","222","Mauritania",null],["YT","262","Mayotte",null],["MX","52","México","Mexico"],["FM","691","Micronesia",null],["MD","373","Moldavia","Moldova"],["MC","377","Mónaco","Monaco"],["MN","976","Mongolia",null],["ME","382","Montenegro",null],["MS","1","Montserrat",null],["MZ","258","Mozambique",null],["MM","95","Myanmar (Birmania)","Myanmar (Burma)"],["NA","264","Namibia",null],["NR","674","Nauru",null],["NP","977","Nepal",null],["NI","505","Nicaragua",null],["NE","227","Níger","Niger"],["NG","234","Nigeria",null],["NU","683","Niue",null],["NO","47","Noruega","Norway"],["NC","687","Nueva Caledonia","New Caledonia"],["NZ","64","Nueva Zelanda","New Zealand"],["OM","968","Omán","Oman"],["NL","31","Países Bajos","Netherlands"],["PK","92","Pakistán","Pakistan"],["PW","680","Palaos","Palau"],["PA","507","Panamá","Panama"],["PG","675","Papúa Nueva Guinea","Papua New Guinea"],["PY","595","Paraguay",null],["PE","51","Perú","Peru"],["PF","689","Polinesia Francesa","French Polynesia"],["PL","48","Polonia","Poland"],["PT","351","Portugal",null],["PR","1","Puerto Rico",null],["HK","852","RAE de Hong Kong (China)","Hong Kong SAR China"],["MO","853","RAE de Macao (China)","Macao SAR China"],["GB","44","Reino Unido","United Kingdom"],["CF","236","República Centroafricana","Central African Republic"],["CD","243","República Democrática del Congo","Congo - Kinshasa"],["DO","1","República Dominicana","Dominican Republic"],["RE","262","Reunión","Réunion"],["RW","250","Ruanda","Rwanda"],["RO","40","Rumanía","Romania"],["RU","7","Rusia","Russia"],["EH","212","Sáhara Occidental","Western Sahara"],["WS","685","Samoa",null],["AS","1","Samoa Americana","American Samoa"],["BL","590","San Bartolomé","St. Barthélemy"],["KN","1","San Cristóbal y Nieves","St. Kitts & Nevis"],["SM","378","San Marino",null],["MF","590","San Martín","St. Martin"],["PM","508","San Pedro y Miquelón","St. Pierre & Miquelon"],["VC","1","San Vicente y las Granadinas","St. Vincent & Grenadines"],["SH","290","Santa Elena","St. Helena"],["LC","1","Santa Lucía","St. Lucia"],["ST","239","Santo Tomé y Príncipe","São Tomé & Príncipe"],["SN","221","Senegal",null],["RS","381","Serbia",null],["SC","248","Seychelles",null],["SL","232","Sierra Leona","Sierra Leone"],["SG","65","Singapur","Singapore"],["SX","1","Sint Maarten",null],["SY","963","Siria","Syria"],["SO","252","Somalia",null],["LK","94","Sri Lanka",null],["ZA","27","Sudáfrica","South Africa"],["SD","249","Sudán","Sudan"],["SS","211","Sudán del Sur","South Sudan"],["SE","46","Suecia","Sweden"],["CH","41","Suiza","Switzerland"],["SR","597","Surinam","Suriname"],["SJ","47","Svalbard y Jan Mayen","Svalbard & Jan Mayen"],["TH","66","Tailandia","Thailand"],["TW","886","Taiwán","Taiwan"],["TZ","255","Tanzania",null],["TJ","992","Tayikistán","Tajikistan"],["IO","246","Territorio Británico del Océano Índico","British Indian Ocean Territory"],["PS","970","Territorios Palestinos","Palestinian Territories"],["TL","670","Timor-Leste",null],["TG","228","Togo",null],["TK","690","Tokelau",null],["TO","676","Tonga",null],["TT","1","Trinidad y Tobago","Trinidad & Tobago"],["TA","290","Tristán de Acuña","Tristan da Cunha"],["TN","216","Túnez","Tunisia"],["TM","993","Turkmenistán","Turkmenistan"],["TR","90","Turquía","Türkiye"],["TV","688","Tuvalu",null],["UA","380","Ucrania","Ukraine"],["UG","256","Uganda",null],["UY","598","Uruguay",null],["UZ","998","Uzbekistán","Uzbekistan"],["VU","678","Vanuatu",null],["VE","58","Venezuela",null],["VN","84","Vietnam",null],["WF","681","Wallis y Futuna","Wallis & Futuna"],["YE","967","Yemen",null],["DJ","253","Yibuti","Djibouti"],["ZM","260","Zambia",null],["ZW","263","Zimbabue","Zimbabwe"]];

  var POR_ISO = {};
  P.forEach(function (p) { POR_ISO[p[0]] = p; });

  /* Prefijos de más largo a más corto: así +1876 (Jamaica) gana a +1 cuando
     se pega un número ya escrito en internacional. */
  var PREFS = P.slice().sort(function (a, b) { return b[1].length - a[1].length; });

  /* Zona horaria -> país. Es la mejor pista de dónde está alguien: un
     mexicano con el navegador en inglés sigue teniendo el reloj en
     America/Mexico_City. El idioma va después, y México al final porque
     es donde están las casas. */
  var ZONAS = {"Europe/Andorra":"AD","Asia/Dubai":"AE","Asia/Kabul":"AF","Europe/Tirane":"AL","Asia/Yerevan":"AM","Antarctica/Casey":"AQ","Antarctica/Davis":"AQ","Antarctica/Mawson":"AQ","Antarctica/Palmer":"AQ","Antarctica/Rothera":"AQ","Antarctica/Troll":"AQ","Antarctica/Vostok":"AQ","America/Argentina/Buenos_Aires":"AR","America/Argentina/Cordoba":"AR","America/Argentina/Salta":"AR","America/Argentina/Jujuy":"AR","America/Argentina/Tucuman":"AR","America/Argentina/Catamarca":"AR","America/Argentina/La_Rioja":"AR","America/Argentina/San_Juan":"AR","America/Argentina/Mendoza":"AR","America/Argentina/San_Luis":"AR","America/Argentina/Rio_Gallegos":"AR","America/Argentina/Ushuaia":"AR","Pacific/Pago_Pago":"AS","Europe/Vienna":"AT","Australia/Lord_Howe":"AU","Antarctica/Macquarie":"AU","Australia/Hobart":"AU","Australia/Melbourne":"AU","Australia/Sydney":"AU","Australia/Broken_Hill":"AU","Australia/Brisbane":"AU","Australia/Lindeman":"AU","Australia/Adelaide":"AU","Australia/Darwin":"AU","Australia/Perth":"AU","Australia/Eucla":"AU","Asia/Baku":"AZ","America/Barbados":"BB","Asia/Dhaka":"BD","Europe/Brussels":"BE","Europe/Sofia":"BG","Atlantic/Bermuda":"BM","America/La_Paz":"BO","America/Noronha":"BR","America/Belem":"BR","America/Fortaleza":"BR","America/Recife":"BR","America/Araguaina":"BR","America/Maceio":"BR","America/Bahia":"BR","America/Sao_Paulo":"BR","America/Campo_Grande":"BR","America/Cuiaba":"BR","America/Santarem":"BR","America/Porto_Velho":"BR","America/Boa_Vista":"BR","America/Manaus":"BR","America/Eirunepe":"BR","America/Rio_Branco":"BR","Asia/Thimphu":"BT","Europe/Minsk":"BY","America/Belize":"BZ","America/St_Johns":"CA","America/Halifax":"CA","America/Glace_Bay":"CA","America/Moncton":"CA","America/Goose_Bay":"CA","America/Toronto":"CA","America/Iqaluit":"CA","America/Winnipeg":"CA","America/Resolute":"CA","America/Rankin_Inlet":"CA","America/Regina":"CA","America/Swift_Current":"CA","America/Edmonton":"CA","America/Cambridge_Bay":"CA","America/Inuvik":"CA","America/Vancouver":"CA","America/Dawson_Creek":"CA","America/Fort_Nelson":"CA","America/Whitehorse":"CA","America/Dawson":"CA","Europe/Zurich":"CH","Africa/Abidjan":"CI","Pacific/Rarotonga":"CK","America/Santiago":"CL","America/Coyhaique":"CL","America/Punta_Arenas":"CL","Pacific/Easter":"CL","Asia/Shanghai":"CN","Asia/Urumqi":"CN","America/Bogota":"CO","America/Costa_Rica":"CR","America/Havana":"CU","Atlantic/Cape_Verde":"CV","Asia/Nicosia":"CY","Asia/Famagusta":"CY","Europe/Prague":"CZ","Europe/Berlin":"DE","America/Santo_Domingo":"DO","Africa/Algiers":"DZ","America/Guayaquil":"EC","Pacific/Galapagos":"EC","Europe/Tallinn":"EE","Africa/Cairo":"EG","Africa/El_Aaiun":"EH","Europe/Madrid":"ES","Africa/Ceuta":"ES","Atlantic/Canary":"ES","Europe/Helsinki":"FI","Pacific/Fiji":"FJ","Atlantic/Stanley":"FK","Pacific/Kosrae":"FM","Atlantic/Faroe":"FO","Europe/Paris":"FR","Europe/London":"GB","Asia/Tbilisi":"GE","America/Cayenne":"GF","Europe/Gibraltar":"GI","America/Nuuk":"GL","America/Danmarkshavn":"GL","America/Scoresbysund":"GL","America/Thule":"GL","Europe/Athens":"GR","Atlantic/South_Georgia":"GS","America/Guatemala":"GT","Pacific/Guam":"GU","Africa/Bissau":"GW","America/Guyana":"GY","Asia/Hong_Kong":"HK","America/Tegucigalpa":"HN","America/Port-au-Prince":"HT","Europe/Budapest":"HU","Asia/Jakarta":"ID","Asia/Pontianak":"ID","Asia/Makassar":"ID","Asia/Jayapura":"ID","Europe/Dublin":"IE","Asia/Jerusalem":"IL","Asia/Kolkata":"IN","Indian/Chagos":"IO","Asia/Baghdad":"IQ","Asia/Tehran":"IR","Europe/Rome":"IT","America/Jamaica":"JM","Asia/Amman":"JO","Asia/Tokyo":"JP","Africa/Nairobi":"KE","Asia/Bishkek":"KG","Pacific/Tarawa":"KI","Pacific/Kanton":"KI","Pacific/Kiritimati":"KI","Asia/Pyongyang":"KP","Asia/Seoul":"KR","Asia/Almaty":"KZ","Asia/Qyzylorda":"KZ","Asia/Qostanay":"KZ","Asia/Aqtobe":"KZ","Asia/Aqtau":"KZ","Asia/Atyrau":"KZ","Asia/Oral":"KZ","Asia/Beirut":"LB","Asia/Colombo":"LK","Africa/Monrovia":"LR","Europe/Vilnius":"LT","Europe/Riga":"LV","Africa/Tripoli":"LY","Africa/Casablanca":"MA","Europe/Chisinau":"MD","Pacific/Kwajalein":"MH","Asia/Yangon":"MM","Asia/Ulaanbaatar":"MN","Asia/Hovd":"MN","Asia/Macau":"MO","America/Martinique":"MQ","Europe/Malta":"MT","Indian/Mauritius":"MU","Indian/Maldives":"MV","America/Mexico_City":"MX","America/Cancun":"MX","America/Merida":"MX","America/Monterrey":"MX","America/Matamoros":"MX","America/Chihuahua":"MX","America/Ciudad_Juarez":"MX","America/Ojinaga":"MX","America/Mazatlan":"MX","America/Bahia_Banderas":"MX","America/Hermosillo":"MX","America/Tijuana":"MX","Asia/Kuching":"MY","Africa/Maputo":"MZ","Africa/Windhoek":"NA","Pacific/Noumea":"NC","Pacific/Norfolk":"NF","Africa/Lagos":"NG","America/Managua":"NI","Asia/Kathmandu":"NP","Pacific/Nauru":"NR","Pacific/Niue":"NU","Pacific/Auckland":"NZ","Pacific/Chatham":"NZ","America/Panama":"PA","America/Lima":"PE","Pacific/Tahiti":"PF","Pacific/Marquesas":"PF","Pacific/Gambier":"PF","Pacific/Port_Moresby":"PG","Pacific/Bougainville":"PG","Asia/Manila":"PH","Asia/Karachi":"PK","Europe/Warsaw":"PL","America/Miquelon":"PM","Pacific/Pitcairn":"PN","America/Puerto_Rico":"PR","Asia/Gaza":"PS","Asia/Hebron":"PS","Europe/Lisbon":"PT","Atlantic/Madeira":"PT","Atlantic/Azores":"PT","Pacific/Palau":"PW","America/Asuncion":"PY","Asia/Qatar":"QA","Europe/Bucharest":"RO","Europe/Belgrade":"RS","Europe/Kaliningrad":"RU","Europe/Moscow":"RU","Europe/Simferopol":"RU","Europe/Kirov":"RU","Europe/Volgograd":"RU","Europe/Astrakhan":"RU","Europe/Saratov":"RU","Europe/Ulyanovsk":"RU","Europe/Samara":"RU","Asia/Yekaterinburg":"RU","Asia/Omsk":"RU","Asia/Novosibirsk":"RU","Asia/Barnaul":"RU","Asia/Tomsk":"RU","Asia/Novokuznetsk":"RU","Asia/Krasnoyarsk":"RU","Asia/Irkutsk":"RU","Asia/Chita":"RU","Asia/Yakutsk":"RU","Asia/Khandyga":"RU","Asia/Vladivostok":"RU","Asia/Ust-Nera":"RU","Asia/Magadan":"RU","Asia/Sakhalin":"RU","Asia/Srednekolymsk":"RU","Asia/Kamchatka":"RU","Asia/Anadyr":"RU","Asia/Riyadh":"SA","Pacific/Guadalcanal":"SB","Africa/Khartoum":"SD","Asia/Singapore":"SG","America/Paramaribo":"SR","Africa/Juba":"SS","Africa/Sao_Tome":"ST","America/El_Salvador":"SV","Asia/Damascus":"SY","America/Grand_Turk":"TC","Africa/Ndjamena":"TD","Asia/Bangkok":"TH","Asia/Dushanbe":"TJ","Pacific/Fakaofo":"TK","Asia/Dili":"TL","Asia/Ashgabat":"TM","Africa/Tunis":"TN","Pacific/Tongatapu":"TO","Europe/Istanbul":"TR","Asia/Taipei":"TW","Europe/Kyiv":"UA","America/New_York":"US","America/Detroit":"US","America/Kentucky/Louisville":"US","America/Kentucky/Monticello":"US","America/Indiana/Indianapolis":"US","America/Indiana/Vincennes":"US","America/Indiana/Winamac":"US","America/Indiana/Marengo":"US","America/Indiana/Petersburg":"US","America/Indiana/Vevay":"US","America/Chicago":"US","America/Indiana/Tell_City":"US","America/Indiana/Knox":"US","America/Menominee":"US","America/North_Dakota/Center":"US","America/North_Dakota/New_Salem":"US","America/North_Dakota/Beulah":"US","America/Denver":"US","America/Boise":"US","America/Phoenix":"US","America/Los_Angeles":"US","America/Anchorage":"US","America/Juneau":"US","America/Sitka":"US","America/Metlakatla":"US","America/Yakutat":"US","America/Nome":"US","America/Adak":"US","Pacific/Honolulu":"US","America/Montevideo":"UY","Asia/Samarkand":"UZ","Asia/Tashkent":"UZ","America/Caracas":"VE","Asia/Ho_Chi_Minh":"VN","Pacific/Efate":"VU","Pacific/Apia":"WS","Africa/Johannesburg":"ZA","America/Antigua":"AG","America/Anguilla":"AI","Africa/Luanda":"AO","Antarctica/McMurdo":"AQ","Antarctica/DumontDUrville":"AQ","Antarctica/Syowa":"AQ","America/Aruba":"AW","Europe/Mariehamn":"AX","Europe/Sarajevo":"BA","Africa/Ouagadougou":"BF","Asia/Bahrain":"BH","Africa/Bujumbura":"BI","Africa/Porto-Novo":"BJ","America/St_Barthelemy":"BL","Asia/Brunei":"BN","America/Kralendijk":"BQ","America/Nassau":"BS","Africa/Gaborone":"BW","America/Blanc-Sablon":"CA","America/Atikokan":"CA","America/Creston":"CA","Indian/Cocos":"CC","Africa/Kinshasa":"CD","Africa/Lubumbashi":"CD","Africa/Bangui":"CF","Africa/Brazzaville":"CG","Africa/Douala":"CM","America/Curacao":"CW","Indian/Christmas":"CX","Europe/Busingen":"DE","Africa/Djibouti":"DJ","Europe/Copenhagen":"DK","America/Dominica":"DM","Africa/Asmara":"ER","Africa/Addis_Ababa":"ET","Pacific/Chuuk":"FM","Pacific/Pohnpei":"FM","Africa/Libreville":"GA","America/Grenada":"GD","Europe/Guernsey":"GG","Africa/Accra":"GH","Africa/Banjul":"GM","Africa/Conakry":"GN","America/Guadeloupe":"GP","Africa/Malabo":"GQ","Europe/Zagreb":"HR","Europe/Isle_of_Man":"IM","Atlantic/Reykjavik":"IS","Europe/Jersey":"JE","Asia/Phnom_Penh":"KH","Indian/Comoro":"KM","America/St_Kitts":"KN","Asia/Kuwait":"KW","America/Cayman":"KY","Asia/Vientiane":"LA","America/St_Lucia":"LC","Europe/Vaduz":"LI","Africa/Maseru":"LS","Europe/Luxembourg":"LU","Europe/Monaco":"MC","Europe/Podgorica":"ME","America/Marigot":"MF","Indian/Antananarivo":"MG","Pacific/Majuro":"MH","Europe/Skopje":"MK","Africa/Bamako":"ML","Pacific/Saipan":"MP","Africa/Nouakchott":"MR","America/Montserrat":"MS","Africa/Blantyre":"MW","Asia/Kuala_Lumpur":"MY","Africa/Niamey":"NE","Europe/Amsterdam":"NL","Europe/Oslo":"NO","Asia/Muscat":"OM","Indian/Reunion":"RE","Africa/Kigali":"RW","Indian/Mahe":"SC","Europe/Stockholm":"SE","Atlantic/St_Helena":"SH","Europe/Ljubljana":"SI","Arctic/Longyearbyen":"SJ","Europe/Bratislava":"SK","Africa/Freetown":"SL","Europe/San_Marino":"SM","Africa/Dakar":"SN","Africa/Mogadishu":"SO","America/Lower_Princes":"SX","Africa/Mbabane":"SZ","Indian/Kerguelen":"TF","Africa/Lome":"TG","America/Port_of_Spain":"TT","Pacific/Funafuti":"TV","Africa/Dar_es_Salaam":"TZ","Africa/Kampala":"UG","Pacific/Midway":"UM","Pacific/Wake":"UM","Europe/Vatican":"VA","America/St_Vincent":"VC","America/Tortola":"VG","America/St_Thomas":"VI","Pacific/Wallis":"WF","Asia/Aden":"YE","Indian/Mayotte":"YT","Africa/Lusaka":"ZM","Africa/Harare":"ZW"};

  var DEF = (function () {
    try {
      var g = localStorage.getItem('tel_pais');
      if (g && POR_ISO[g]) return g;
    } catch (_) {}
    try {
      var z = ZONAS[Intl.DateTimeFormat().resolvedOptions().timeZone];
      if (z && POR_ISO[z]) return z;
    } catch (_) {}
    try {
      var l = (navigator.languages || [navigator.language || ''])
        .map(function (x) { return String(x).split('-')[1]; })
        .filter(function (x) { return x && POR_ISO[x.toUpperCase()]; })[0];
      if (l) return l.toUpperCase();
    } catch (_) {}
    return 'MX';
  })();

  function bandera(iso) {
    return String.fromCodePoint.apply(null, iso.toUpperCase().split('').map(function (c) {
      return 0x1F1E6 + c.charCodeAt(0) - 65;
    }));
  }
  function img(iso) {
    /* La imagen es lo que se ve en Windows, donde el emoji de bandera sale
       como dos letras. Si el CDN no responde, se queda el emoji debajo. */
    return '<img class="tlw-f" src="https://flagcdn.com/w40/' + iso.toLowerCase() +
           '.png" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'' +
           bandera(iso) + '\'))">';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* Para buscar sin acentos: "mexico" encuentra México. */
  function plano(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var CSS = '.tlw{display:flex;align-items:stretch;gap:6px;width:100%}' +
    '.tlw>input{flex:1 1 auto;min-width:0}' +
    '.tlw-b{flex:0 0 auto;display:flex;align-items:center;gap:6px;cursor:pointer;font:inherit;' +
    'white-space:nowrap;line-height:1.2;padding:0 10px}' +
    '.tlw-f{width:20px;height:14px;object-fit:cover;border-radius:2px;display:block}' +
    '.tlw-c{font-variant-numeric:tabular-nums}' +
    '.tlw-b .tlw-x{opacity:.45;font-size:10px}' +
    '.tlm{position:fixed;inset:0;z-index:99999;background:rgba(15,20,10,.45);display:flex;' +
    'align-items:flex-end;justify-content:center;font:14px/1.4 Inter,system-ui,-apple-system,sans-serif}' +
    '@media(min-width:560px){.tlm{align-items:center}}' +
    '.tlm-d{background:#fff;color:#1E2415;width:100%;max-width:440px;max-height:82vh;display:flex;' +
    'flex-direction:column;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.3)}' +
    '@media(min-width:560px){.tlm-d{border-radius:14px}}' +
    '.tlm-h{padding:12px 14px;border-bottom:1px solid #E3E0D6;display:flex;gap:8px;align-items:center}' +
    '.tlm-h input{flex:1;padding:10px 12px;border:1px solid #E3E0D6;border-radius:9px;font:inherit;font-size:16px;' +
    'background:#fff;color:#1E2415}' +
    '.tlm-h button{border:0;background:none;font:inherit;font-size:20px;line-height:1;color:#6E6A5C;cursor:pointer;padding:4px 6px}' +
    '.tlm-l{overflow:auto;-webkit-overflow-scrolling:touch;margin:0;padding:6px 0;list-style:none}' +
    '.tlm-l li{display:flex;align-items:center;gap:10px;padding:11px 15px;cursor:pointer}' +
    '.tlm-l li:hover,.tlm-l li.on{background:#F3F8EA}' +
    '.tlm-l b{font-weight:600;flex:1}' +
    '.tlm-l span{color:#6E6A5C;font-variant-numeric:tabular-nums}' +
    '.tlm-l .tlw-f{width:24px;height:17px}' +
    '.tlm-v{padding:18px 15px;color:#6E6A5C;text-align:center}';

  (function () {
    var s = document.createElement('style');
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  })();

  var RAW = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  /* ---------- la lista ---------- */
  function elige(iso, alElegir) {
    var capa = document.createElement('div');
    capa.className = 'tlm';
    capa.innerHTML =
      '<div class="tlm-d" role="dialog" aria-label="Elige el país">' +
        '<div class="tlm-h"><input type="text" inputmode="search" autocomplete="off" ' +
          'placeholder="Busca: país o prefijo" aria-label="Busca el país"><button type="button" aria-label="Cerrar">✕</button></div>' +
        '<ul class="tlm-l"></ul>' +
      '</div>';
    document.body.appendChild(capa);
    var caja = capa.querySelector('.tlm-h input');
    var lista = capa.querySelector('.tlm-l');
    var vis = P, foco = 0;

    function pinta() {
      if (!vis.length) { lista.innerHTML = '<li class="tlm-v">Ningún país con eso.</li>'; return; }
      lista.innerHTML = vis.map(function (p, i) {
        return '<li data-i="' + i + '" class="' + (i === foco ? 'on' : '') + '">' + img(p[0]) +
               '<b>' + esc(p[2]) + '</b><span>+' + p[1] + '</span></li>';
      }).join('');
      Array.prototype.forEach.call(lista.children, function (li) {
        li.onclick = function () { cierra(vis[+li.getAttribute('data-i')]); };
      });
      var on = lista.querySelector('li.on');
      if (on) on.scrollIntoView({ block: 'center' });
    }
    function filtra() {
      var q = plano(caja.value).trim();
      var d = q.replace(/[^0-9]/g, '');
      vis = !q ? P : P.filter(function (p) {
        return plano(p[2]).indexOf(q) === 0 || plano(p[3] || '').indexOf(q) === 0 ||
               plano(p[2]).indexOf(' ' + q) > 0 || p[0].toLowerCase() === q ||
               (d && p[1].indexOf(d) === 0);
      });
      foco = 0; pinta();
    }
    function cierra(p) {
      capa.remove();
      document.removeEventListener('keydown', teclas, true);
      if (p) alElegir(p[0]);
    }
    function teclas(e) {
      if (e.key === 'Escape') { e.preventDefault(); cierra(null); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); foco = Math.min(foco + 1, vis.length - 1); pinta(); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); foco = Math.max(foco - 1, 0); pinta(); }
      else if (e.key === 'Enter' && vis[foco]) { e.preventDefault(); cierra(vis[foco]); }
    }
    caja.oninput = filtra;
    capa.querySelector('.tlm-h button').onclick = function () { cierra(null); };
    capa.onclick = function (e) { if (e.target === capa) cierra(null); };
    document.addEventListener('keydown', teclas, true);
    foco = Math.max(0, P.indexOf(POR_ISO[iso] || POR_ISO[DEF]));
    pinta();
    setTimeout(function () { caja.focus(); }, 30);
  }

  /* ---------- el campo ---------- */
  function monta(el) {
    if (!el || el.__tel || el.getAttribute('data-tel') === 'no') return;
    el.__tel = true;

    var iso = DEF;
    var crudo = RAW.get.call(el) || '';

    /* Si el campo ya traía un número internacional, se parte en país y resto
       para no perder lo que la pantalla acababa de cargar de la base. */
    function parte(v) {
      var s = String(v || '').replace(/[^\d+]/g, '');
      if (s.charAt(0) === '+') {
        var n = s.slice(1);
        for (var i = 0; i < PREFS.length; i++) {
          if (n.indexOf(PREFS[i][1]) === 0) return [PREFS[i][0], n.slice(PREFS[i][1].length)];
        }
        return [iso, n];
      }
      return [null, s.replace(/\D/g, '')];
    }

    var p0 = parte(crudo);
    if (p0[0]) iso = p0[0];

    var caja = document.createElement('span');
    caja.className = 'tlw';
    var bot = document.createElement('button');
    bot.type = 'button';
    bot.className = 'tlw-b';
    bot.setAttribute('aria-label', 'Elige el país');
    el.parentNode.insertBefore(caja, el);
    caja.appendChild(bot);
    caja.appendChild(el);
    RAW.set.call(el, p0[1]);

    /* El botón se viste con el propio campo: cada pantalla tiene su borde,
       su radio y su fondo, y así no hay que retocar 30 hojas de estilo. */
    (function () {
      var c = getComputedStyle(el);
      ['borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRadius',
       'backgroundColor', 'color', 'fontSize', 'fontFamily'].forEach(function (k) {
        var v = c[k];
        if (k.indexOf('borderTop') === 0) bot.style[k.replace('Top', '')] = v;
        else bot.style[k] = v;
      });
      bot.style.borderStyle = c.borderTopStyle === 'none' ? 'solid' : c.borderTopStyle;
      if (c.borderTopStyle === 'none') { bot.style.borderWidth = '1px'; bot.style.borderColor = 'rgba(0,0,0,.14)'; }
      if (c.backgroundColor === 'rgba(0, 0, 0, 0)') bot.style.backgroundColor = 'transparent';
    })();

    function pintaBoton() {
      var p = POR_ISO[iso] || POR_ISO[DEF];
      bot.innerHTML = img(p[0]) + '<span class="tlw-c">+' + p[1] + '</span><span class="tlw-x">▾</span>';
      bot.title = p[2];
      el.dataset.pais = p[0];
      el.dataset.prefijo = p[1];
      /* Si la pantalla dejó un campo oculto <id>-pais, se le llena solo. */
      var h = el.id && document.getElementById(el.id + '-pais');
      if (h) RAW.set.call(h, p[0]);
    }

    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () {
        var n = (RAW.get.call(this) || '').replace(/\D/g, '');
        return n ? '+' + (POR_ISO[iso] || POR_ISO[DEF])[1] + n : '';
      },
      set: function (v) {
        var p = parte(v);
        if (p[0]) { iso = p[0]; pintaBoton(); }
        RAW.set.call(this, p[1]);
      }
    });

    bot.onclick = function () {
      elige(iso, function (nuevo) {
        iso = nuevo;
        try { localStorage.setItem('tel_pais', nuevo); } catch (_) {}
        pintaBoton();
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.focus();
      });
    };

    pintaBoton();
  }

  /* Qué es un teléfono: lo que se declara como tal, y lo que se llama como
     tal. Lo segundo es por las pantallas viejas, donde el campo de WhatsApp
     quedó como texto y nadie va a ir a cambiarlas una por una. */
  var NOMBRE = /(whats|telefon|teléfon|celular|movil|móvil|phone|\btel\b)/i;
  function candidatos(raiz) {
    var out = [];
    try {
      out = Array.prototype.slice.call(
        raiz.querySelectorAll('input[type=tel],input[inputmode=tel],input[data-tel]'));
      Array.prototype.forEach.call(raiz.querySelectorAll('input'), function (el) {
        var t = (el.type || '').toLowerCase();
        if (t && t !== 'text' && t !== 'tel' && t !== 'search') return;
        if (NOMBRE.test(el.id || '') || NOMBRE.test(el.name || '') ||
            NOMBRE.test(el.getAttribute('data-c') || '')) out.push(el);
      });
    } catch (_) {}
    return out;
  }
  function barre(raiz) { candidatos(raiz || document).forEach(monta); }

  window.telMonta = barre;
  window.telPais = function (el) { return el && el.dataset ? (el.dataset.pais || null) : null; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { barre(document); });
  else barre(document);

  /* Estas pantallas repintan medio panel con innerHTML cada vez que guardas.
     El observador es lo que hace que el prefijo siga ahí después. */
  try {
    var pend = null;
    new MutationObserver(function () {
      if (pend) return;
      pend = setTimeout(function () { pend = null; barre(document); }, 120);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
