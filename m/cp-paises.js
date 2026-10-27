/* cp-paises.js — las nacionalidades, una sola vez para todo el Grupo.
 *
 * Javi, 26-oct-2026: «el sistema de leer los pasaportes, permite captar el
 * pasaporte de países internacionales, y si no lo lee bien que lo capten a
 * mano». Y después: «también lo necesito para el alta de los ateneístas».
 *
 * El lector no era el problema: lee la MRZ de cualquier pasaporte del mundo y
 * devuelve bien «Costarricense». El problema era el formulario. El check-in
 * del huésped tenía una lista de 39 nacionalidades, y esta línea:
 *
 *     if (v.nacionalidad && PAISES.indexOf(v.nacionalidad) >= 0) ...
 *
 * Un huésped de Costa Rica, Guatemala, Nigeria, Tailandia o Croacia llegaba
 * con su dato leído correctamente y la pantalla lo TIRABA, sin decir nada,
 * porque no estaba en la lista. Y como era un <select>, tampoco podía
 * escribirlo a mano: su única opción era «Otra».
 *
 * Aquí está la lista entera, y dos funciones que hacen que no vuelva a pasar:
 * una que construye el desplegable, y otra que pone un valor SIN perderlo
 * aunque no esté en la lista. Un catálogo nuestro nunca puede ser el motivo
 * de que a alguien no se le pueda escribir de dónde es.
 *
 *   <script src="/m/cp-paises.js"></script>
 *   CP.paisesEn(selectEl)        -> lo llena, con Mexicana arriba
 *   CP.ponPais(selectEl, 'Keniana') -> la elige, y la añade si no estaba
 */
(function (raiz) {
  'use strict';

  /* Mexicana primero porque es la de ocho de cada diez; el resto alfabético. */
  var PAISES = [
    'Mexicana',
    'Afgana',
    'Albanesa',
    'Alemana',
    'Andorrana',
    'Angoleña',
    'Antiguana',
    'Arabe saudí',
    'Argelina',
    'Argentina',
    'Armenia',
    'Australiana',
    'Austriaca',
    'Azerbaiyana',
    'Bahameña',
    'Bangladesí',
    'Barbadense',
    'Bareiní',
    'Belga',
    'Beliceña',
    'Beninesa',
    'Bielorrusa',
    'Birmana',
    'Boliviana',
    'Bosnia',
    'Botsuana',
    'Brasileña',
    'Bruneana',
    'Burkinesa',
    'Burundesa',
    'Butanesa',
    'Búlgara',
    'Caboverdiana',
    'Camboyana',
    'Camerunesa',
    'Canadiense',
    'Catarí',
    'Centroafricana',
    'Chadiana',
    'Checa',
    'Chilena',
    'China',
    'Chipriota',
    'Colombiana',
    'Comorense',
    'Congoleña',
    'Coreana del Norte',
    'Coreana del Sur',
    'Costarricense',
    'Croata',
    'Cubana',
    'Danesa',
    'Dominicana',
    'Ecuatoguineana',
    'Ecuatoriana',
    'Egipcia',
    'Emiratí',
    'Eritrea',
    'Eslovaca',
    'Eslovena',
    'Española',
    'Estadounidense',
    'Estonia',
    'Etíope',
    'Filipina',
    'Finlandesa',
    'Fiyiana',
    'Francesa',
    'Gabonesa',
    'Gambiana',
    'Georgiana',
    'Ghanesa',
    'Granadina',
    'Griega',
    'Guatemalteca',
    'Guineana',
    'Guineana-Bisáu',
    'Guyanesa',
    'Haitiana',
    'Hondureña',
    'Húngara',
    'India',
    'Indonesia',
    'Iraní',
    'Iraquí',
    'Irlandesa',
    'Islandesa',
    'Israelí',
    'Italiana',
    'Jamaiquina',
    'Japonesa',
    'Jordana',
    'Kazaja',
    'Keniana',
    'Kirguisa',
    'Kiribatiana',
    'Kuwaití',
    'Laosiana',
    'Lesotense',
    'Letona',
    'Libanesa',
    'Liberiana',
    'Libia',
    'Liechtensteiniana',
    'Lituana',
    'Luxemburguesa',
    'Macedonia',
    'Malasia',
    'Malauí',
    'Maldiva',
    'Malgache',
    'Maliense',
    'Maltesa',
    'Marfileña',
    'Marroquí',
    'Marshalesa',
    'Mauriciana',
    'Mauritana',
    'Micronesia',
    'Moldava',
    'Monegasca',
    'Mongola',
    'Montenegrina',
    'Mozambiqueña',
    'Namibia',
    'Nauruana',
    'Neerlandesa',
    'Neozelandesa',
    'Nepalí',
    'Nicaragüense',
    'Nigeriana',
    'Nigerina',
    'Noruega',
    'Omaní',
    'Pakistaní',
    'Palaua',
    'Palestina',
    'Panameña',
    'Papú',
    'Paraguaya',
    'Peruana',
    'Polaca',
    'Portuguesa',
    'Puertorriqueña',
    'Reino Unido (británica)',
    'Ruandesa',
    'Rumana',
    'Rusa',
    'Salomonense',
    'Salvadoreña',
    'Samoana',
    'Sanmarinense',
    'Santalucense',
    'Santotomense',
    'Senegalesa',
    'Serbia',
    'Seychellense',
    'Sierraleonesa',
    'Singapurense',
    'Siria',
    'Somalí',
    'Srilanquesa',
    'Suazi',
    'Sudafricana',
    'Sudanesa',
    'Sudanesa del Sur',
    'Sueca',
    'Suiza',
    'Surinamesa',
    'Tailandesa',
    'Tanzana',
    'Tayika',
    'Timorense',
    'Togolesa',
    'Tongana',
    'Trinitense',
    'Tunecina',
    'Turca',
    'Turcomana',
    'Tuvaluana',
    'Ucraniana',
    'Ugandesa',
    'Uruguaya',
    'Uzbeka',
    'Vanuatuense',
    'Vaticana',
    'Venezolana',
    'Vietnamita',
    'Yemení',
    'Yibutiana',
    'Zambiana',
    'Zimbabuense'
  ];


  /* LA MISMA LISTA, EN INGLES. Javi, 27-oct-2026: «traduce todo lo que esta de
     cara al cliente». El check-in del huesped y el alta del ateneista se abren
     en ingles mas veces que en espanol, y este desplegable era lo unico que
     seguia enteramente en espanol dentro de un formulario en ingles.
     OJO: lo que se traduce es la ETIQUETA, nunca el valor. El valor sigue
     siendo la nacionalidad en espanol porque es la que devuelve el lector de
     pasaportes y la que esta guardada en la base; si lo tradujeramos, un
     huesped que elige «German» guardaria algo que ningun informe reconoce. */
  var EN = {
    'Mexicana': 'Mexican',
    'Afgana': 'Afghan',
    'Albanesa': 'Albanian',
    'Alemana': 'German',
    'Andorrana': 'Andorran',
    'Angoleña': 'Angolan',
    'Antiguana': 'Antiguan',
    'Arabe saudí': 'Saudi',
    'Argelina': 'Algerian',
    'Argentina': 'Argentine',
    'Armenia': 'Armenian',
    'Australiana': 'Australian',
    'Austriaca': 'Austrian',
    'Azerbaiyana': 'Azerbaijani',
    'Bahameña': 'Bahamian',
    'Bangladesí': 'Bangladeshi',
    'Barbadense': 'Barbadian',
    'Bareiní': 'Bahraini',
    'Belga': 'Belgian',
    'Beliceña': 'Belizean',
    'Beninesa': 'Beninese',
    'Bielorrusa': 'Belarusian',
    'Birmana': 'Burmese',
    'Boliviana': 'Bolivian',
    'Bosnia': 'Bosnian',
    'Botsuana': 'Botswanan',
    'Brasileña': 'Brazilian',
    'Bruneana': 'Bruneian',
    'Burkinesa': 'Burkinabé',
    'Burundesa': 'Burundian',
    'Butanesa': 'Bhutanese',
    'Búlgara': 'Bulgarian',
    'Caboverdiana': 'Cape Verdean',
    'Camboyana': 'Cambodian',
    'Camerunesa': 'Cameroonian',
    'Canadiense': 'Canadian',
    'Catarí': 'Qatari',
    'Centroafricana': 'Central African',
    'Chadiana': 'Chadian',
    'Checa': 'Czech',
    'Chilena': 'Chilean',
    'China': 'Chinese',
    'Chipriota': 'Cypriot',
    'Colombiana': 'Colombian',
    'Comorense': 'Comoran',
    'Congoleña': 'Congolese',
    'Coreana del Norte': 'North Korean',
    'Coreana del Sur': 'South Korean',
    'Costarricense': 'Costa Rican',
    'Croata': 'Croatian',
    'Cubana': 'Cuban',
    'Danesa': 'Danish',
    'Dominicana': 'Dominican',
    'Ecuatoguineana': 'Equatorial Guinean',
    'Ecuatoriana': 'Ecuadorian',
    'Egipcia': 'Egyptian',
    'Emiratí': 'Emirati',
    'Eritrea': 'Eritrean',
    'Eslovaca': 'Slovak',
    'Eslovena': 'Slovenian',
    'Española': 'Spanish',
    'Estadounidense': 'American',
    'Estonia': 'Estonian',
    'Etíope': 'Ethiopian',
    'Filipina': 'Filipino',
    'Finlandesa': 'Finnish',
    'Fiyiana': 'Fijian',
    'Francesa': 'French',
    'Gabonesa': 'Gabonese',
    'Gambiana': 'Gambian',
    'Georgiana': 'Georgian',
    'Ghanesa': 'Ghanaian',
    'Granadina': 'Grenadian',
    'Griega': 'Greek',
    'Guatemalteca': 'Guatemalan',
    'Guineana': 'Guinean',
    'Guineana-Bisáu': 'Guinea-Bissauan',
    'Guyanesa': 'Guyanese',
    'Haitiana': 'Haitian',
    'Hondureña': 'Honduran',
    'Húngara': 'Hungarian',
    'India': 'Indian',
    'Indonesia': 'Indonesian',
    'Iraní': 'Iranian',
    'Iraquí': 'Iraqi',
    'Irlandesa': 'Irish',
    'Islandesa': 'Icelandic',
    'Israelí': 'Israeli',
    'Italiana': 'Italian',
    'Jamaiquina': 'Jamaican',
    'Japonesa': 'Japanese',
    'Jordana': 'Jordanian',
    'Kazaja': 'Kazakh',
    'Keniana': 'Kenyan',
    'Kirguisa': 'Kyrgyz',
    'Kiribatiana': 'Kiribati',
    'Kuwaití': 'Kuwaiti',
    'Laosiana': 'Laotian',
    'Lesotense': 'Basotho',
    'Letona': 'Latvian',
    'Libanesa': 'Lebanese',
    'Liberiana': 'Liberian',
    'Libia': 'Libyan',
    'Liechtensteiniana': 'Liechtensteiner',
    'Lituana': 'Lithuanian',
    'Luxemburguesa': 'Luxembourgish',
    'Macedonia': 'Macedonian',
    'Malasia': 'Malaysian',
    'Malauí': 'Malawian',
    'Maldiva': 'Maldivian',
    'Malgache': 'Malagasy',
    'Maliense': 'Malian',
    'Maltesa': 'Maltese',
    'Marfileña': 'Ivorian',
    'Marroquí': 'Moroccan',
    'Marshalesa': 'Marshallese',
    'Mauriciana': 'Mauritian',
    'Mauritana': 'Mauritanian',
    'Micronesia': 'Micronesian',
    'Moldava': 'Moldovan',
    'Monegasca': 'Monégasque',
    'Mongola': 'Mongolian',
    'Montenegrina': 'Montenegrin',
    'Mozambiqueña': 'Mozambican',
    'Namibia': 'Namibian',
    'Nauruana': 'Nauruan',
    'Neerlandesa': 'Dutch',
    'Neozelandesa': 'New Zealander',
    'Nepalí': 'Nepali',
    'Nicaragüense': 'Nicaraguan',
    'Nigeriana': 'Nigerian',
    'Nigerina': 'Nigerien',
    'Noruega': 'Norwegian',
    'Omaní': 'Omani',
    'Pakistaní': 'Pakistani',
    'Palaua': 'Palauan',
    'Palestina': 'Palestinian',
    'Panameña': 'Panamanian',
    'Papú': 'Papua New Guinean',
    'Paraguaya': 'Paraguayan',
    'Peruana': 'Peruvian',
    'Polaca': 'Polish',
    'Portuguesa': 'Portuguese',
    'Puertorriqueña': 'Puerto Rican',
    'Reino Unido (británica)': 'British',
    'Ruandesa': 'Rwandan',
    'Rumana': 'Romanian',
    'Rusa': 'Russian',
    'Salomonense': 'Solomon Islander',
    'Salvadoreña': 'Salvadoran',
    'Samoana': 'Samoan',
    'Sanmarinense': 'Sammarinese',
    'Santalucense': 'Saint Lucian',
    'Santotomense': 'São Toméan',
    'Senegalesa': 'Senegalese',
    'Serbia': 'Serbian',
    'Seychellense': 'Seychellois',
    'Sierraleonesa': 'Sierra Leonean',
    'Singapurense': 'Singaporean',
    'Siria': 'Syrian',
    'Somalí': 'Somali',
    'Srilanquesa': 'Sri Lankan',
    'Suazi': 'Swazi',
    'Sudafricana': 'South African',
    'Sudanesa': 'Sudanese',
    'Sudanesa del Sur': 'South Sudanese',
    'Sueca': 'Swedish',
    'Suiza': 'Swiss',
    'Surinamesa': 'Surinamese',
    'Tailandesa': 'Thai',
    'Tanzana': 'Tanzanian',
    'Tayika': 'Tajik',
    'Timorense': 'Timorese',
    'Togolesa': 'Togolese',
    'Tongana': 'Tongan',
    'Trinitense': 'Trinidadian',
    'Tunecina': 'Tunisian',
    'Turca': 'Turkish',
    'Turcomana': 'Turkmen',
    'Tuvaluana': 'Tuvaluan',
    'Ucraniana': 'Ukrainian',
    'Ugandesa': 'Ugandan',
    'Uruguaya': 'Uruguayan',
    'Uzbeka': 'Uzbek',
    'Vanuatuense': 'Ni-Vanuatu',
    'Vaticana': 'Vatican',
    'Venezolana': 'Venezuelan',
    'Vietnamita': 'Vietnamese',
    'Yemení': 'Yemeni',
    'Yibutiana': 'Djiboutian',
    'Zambiana': 'Zambian',
    'Zimbabuense': 'Zimbabwean'
  };

  /* El idioma no lo decide este archivo: lo decide la pantalla que lo usa.
     Se mira, por orden, la liga, las llaves que ya usan APePe y Sincretico, y
     por ultimo el <html lang>. Si algo falla, espanol. */
  function idioma() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'es') return q;
    } catch (_) {}
    try {
      var ks = ['apepe_ckin_lang', 'apepe_lang', 'sinc_idioma', 'bib.lang'];
      for (var i = 0; i < ks.length; i++) {
        var v = localStorage.getItem(ks[i]);
        if (v === 'en' || v === 'es') return v;
      }
    } catch (_) {}
    try { if (String(document.documentElement.lang || '').slice(0, 2) === 'en') return 'en'; } catch (_) {}
    return 'es';
  }
  function etiqueta(p) {
    return (idioma() === 'en' && EN[p]) ? EN[p] : p;
  }

  function paisesEn(sel, textoVacio) {
    if (!sel) return;
    var en = idioma() === 'en';
    var vacio = textoVacio || (en ? 'Choose…' : 'Elige…');
    function op(p) { return '<option value="' + p + '">' + etiqueta(p) + '</option>'; }
    var h = '<option value="">' + vacio + '</option>';
    h += op(PAISES[0]);
    h += '<option disabled>──────────</option>';
    /* En ingles el orden alfabetico es otro: «Alemana» va por la A y «German»
       por la G. Se ordena por lo que se LEE, que es lo que busca el dedo. */
    var resto = PAISES.slice(1);
    if (en) resto.sort(function (x, y) { return etiqueta(x).localeCompare(etiqueta(y), 'en'); });
    for (var i = 0; i < resto.length; i++) h += op(resto[i]);
    sel.innerHTML = h;
  }

  /* LO QUE NO ESTÁ EN LA LISTA NO SE TIRA: SE AÑADE.
     Si el lector devuelve una nacionalidad que no tenemos catalogada, el dato
     es bueno y la lista es nuestra: la que se corrige es la lista. */
  function ponPais(sel, valor) {
    if (!sel || !valor) return false;
    var v = String(valor).trim();
    if (!v) return false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === v || sel.options[i].text === v) { sel.value = sel.options[i].value || v; return true; }
    }
    /* El lector siempre devuelve la nacionalidad en espanol, asi que con el
       desplegable en ingles ya casa por el value. Pero si alguna pantalla le
       pasa la inglesa, tambien se encuentra: el dato es bueno. */
    for (var j = 0; j < sel.options.length; j++) {
      if (EN[sel.options[j].value] === v) { sel.value = sel.options[j].value; return true; }
    }
    var o = document.createElement('option');
    o.textContent = v;
    sel.appendChild(o);
    sel.value = v;
    return true;
  }

  raiz.CP = raiz.CP || {};
  raiz.CP.PAISES = PAISES;
  raiz.CP.PAISES_EN = EN;
  raiz.CP.paisesEn = paisesEn;
  raiz.CP.ponPais = ponPais;
  raiz.CP.etiquetaPais = etiqueta;
})(window);
