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

  function paisesEn(sel, textoVacio) {
    if (!sel) return;
    var h = '<option value="">' + (textoVacio || 'Elige…') + '</option>';
    h += '<option>' + PAISES[0] + '</option>';
    h += '<option disabled>──────────</option>';
    for (var i = 1; i < PAISES.length; i++) h += '<option>' + PAISES[i] + '</option>';
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
    var o = document.createElement('option');
    o.textContent = v;
    sel.appendChild(o);
    sel.value = v;
    return true;
  }

  raiz.CP = raiz.CP || {};
  raiz.CP.PAISES = PAISES;
  raiz.CP.paisesEn = paisesEn;
  raiz.CP.ponPais = ponPais;
})(window);
