/* cp-ui.js — las piezas que se repiten en todas las pantallas del Grupo.
 *
 * Javi, 26-oct-2026, tarea 2 de la fase 1 del rediseño: «la pastilla de
 * capacidad está copiada en cuatro pantallas con sus colores a mano. El día
 * que cambie un color hay que acordarse de cuatro sitios».
 *
 * Y ya habían empezado a separarse: el azul del hotel era #2F6E93 en el portal
 * y en el funnel, y #1a5f85 en la comunidad. Nadie lo decidió; se copió mal una
 * vez y a partir de ahí eran dos azules. Eso es lo que pasa siempre con lo
 * copiado: no se rompe de golpe, se va desalineando.
 *
 * Aquí vive UNA sola verdad de qué capacidades hay, cómo se llaman y de qué
 * color son. Quien la quiera, la pide.
 *
 *   <script src="/m/cp-ui.js"></script>
 *   CP.pastillas(['experiencias','hotel'])   -> el HTML de las pastillas
 *   CP.capNom('artesania')                   -> «Artesanía» (la cosa)
 *   CP.capQuien('artesania')                 -> «Artesanos» (quien la trae)
 *   CP.pastillas(lista, {quien:true})        -> las pastillas con el nombre de quien
 *
 * El CSS se inyecta solo la primera vez que se pide una pastilla: una pantalla
 * que no las use no paga nada por tener el archivo cargado.
 */
(function (raiz) {
  'use strict';

  /* Las cinco, en el orden en que se enseñan. El nombre es el que lee una
     persona, no el de la columna: en la base es `artesania` y en pantalla es
     «Artesanía», con su tilde. */
  var CAPS = [
    ['experiencias', 'Experiencias', '#FDE7DC', '#C9501A'],
    ['eventos',      'Eventos',      '#FBDCEE', '#B3106F'],
    ['hotel',        'Hotel',        '#E4F1FA', '#2F6E93'],
    ['artesania',    'Artesanía',    '#F7ECD4', '#8C6212'],
    ['membresia',    'Membresía',    '#E1F0E7', '#1D6B4A']
  ];

  /* LA COSA Y QUIEN LA TRAE NO SE LLAMAN IGUAL. Javi, 27-oct-2026.
     Una capacidad se llama «Eventos» cuando nombra lo que se vende, y
     «Productoras» cuando nombra a quien lo trae. En La Comunidad la lista es
     de gente, asi que decia «Eventos 6» y salian hoteles: el nombre prometia
     eventos y entregaba personas. Son dos nombres del mismo dato, y los dos
     viven aqui para que no se separen. */
  var QUIEN = {
    experiencias: 'Touroperadoras',
    eventos:      'Productoras',
    hotel:        'Hotel',
    artesania:    'Artesanos',
    membresia:    'Coworkers'
  };

  var PUESTO = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function capNom(k) {
    for (var i = 0; i < CAPS.length; i++) if (CAPS[i][0] === k) return CAPS[i][1];
    return k;
  }

  /* Como se llama QUIEN trae esa capacidad. Usalo en toda pantalla cuya lista
     sea de personas; `capNom` es para cuando se nombra la cosa. */
  function capQuien(k) { return QUIEN[k] || capNom(k); }

  /* El CSS va con nombre propio —`cp-cap`— y no toca ninguna clase que ya
     exista. Así una pantalla puede migrar hoy y la de al lado mañana, sin que
     la mitad migrada se vea rota mientras tanto. */
  function ponEstilo() {
    if (PUESTO) return;
    PUESTO = true;
    var css = '.cp-cap{display:inline-flex;align-items:center;gap:6px;border-radius:999px;' +
      "padding:4px 11px;font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-size:11.5px;" +
      'letter-spacing:.06em;text-transform:uppercase;line-height:1.3;white-space:nowrap;' +
      'background:#F4EFE8;color:#3C3630}' +
      '.cp-cap i{width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto;opacity:.75}' +
      CAPS.map(function (c) {
        return '.cp-cap.' + c[0] + '{background:' + c[2] + ';color:' + c[3] + '}';
      }).join('') +
      /* Apagada: la capacidad que podría tener y no tiene. Se enseña para que
         se vea el hueco, no para que parezca que la tiene. */
      '.cp-cap.off{background:transparent;color:#A9A096;border:1px dashed #E6DFD6}';
    var e = document.createElement('style');
    e.setAttribute('data-cp-ui', 'caps');
    e.textContent = css;
    document.head.appendChild(e);
  }

  /* Una pastilla. `off` la dibuja apagada; `punto` le pone el circulito. */
  function pastilla(k, opciones) {
    ponEstilo();
    var o = opciones || {};
    return '<span class="cp-cap ' + esc(k) + (o.off ? ' off' : '') + '">' +
      (o.punto ? '<i></i>' : '') + esc(o.quien ? capQuien(k) : capNom(k)) + '</span>';
  }

  function pastillas(lista, opciones) {
    if (!lista || !lista.length) return '';
    return lista.map(function (k) { return pastilla(k, opciones); }).join(' ');
  }

  raiz.CP = raiz.CP || {};
  raiz.CP.CAPS = CAPS;
  raiz.CP.capNom = capNom;
  raiz.CP.capQuien = capQuien;
  raiz.CP.pastilla = pastilla;
  raiz.CP.pastillas = pastillas;
})(window);
