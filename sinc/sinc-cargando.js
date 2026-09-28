/* El rato de espera, aprovechado.
 *
 * Una pantalla que carga es medio segundo en el que no pasa nada. En vez de
 * poner una rueda girando, aquí se cuenta de qué va esto: el viajero de paz,
 * las cinco Bes, la ceremonia, el intercambio justo. Son ideas de Javi, no
 * adorno: quien espera tres segundos sale sabiendo una cosa más.
 *
 * No depende de nada: los estilos se inyectan solos y funciona en cualquier
 * página del grupo.
 */
window.sincCargando = (function () {
  'use strict';

  /* Lo que ve el huésped. Cada sticker con su frase: la frase explica el
     sticker, y el sticker hace que se lea. */
  var HUESPED = [
    ['🕊️', 'Hay viajeros de paz y viajeros de guerra. Esto está hecho para los primeros.'],
    ['🌽', 'La cultura no baja del cielo: sale de la tierra y se queda en los oficios, en las cosas y en quien las sabe hacer.'],
    ['🧭', 'Un buen tour es una ceremonia: tiene un principio, un final, sus herramientas y sus imperdibles.'],
    ['🤝', 'Intercambio justo: quien te enseña su oficio cobra por enseñarlo.'],
    ['🛏️', 'Cama, baño y desayuno son el confort. La experiencia es otra cosa, y la conciencia otra más.'],
    ['🪅', 'Sincretismo: aquí casi nada viene de un solo sitio, y eso es justo lo interesante.'],
    ['🌱', 'Cuidar lo que se visita es parte del plan, no un añadido al final del folleto.'],
    ['🎭', 'Te va a recibir alguien con nombre y apellido, no un uniforme.'],
    ['🗺️', 'Los imperdibles no son los más fotografiados: son los que explican el lugar.'],
    ['🫙', 'Prosperidad compartida: que el dinero se quede en el barrio que te recibe.'],
    ['👂', 'La quinta B es el comportamiento. Es la que decide si un viaje suma o resta.'],
    ['🔥', 'Lo que se cocina despacio se cuenta despacio.'],
  ];

  /* Lo que ve el equipo cuando abre una ficha. Mismo fondo, otro oficio: aquí
     se está construyendo el tour, no comprándolo. */
  var FICHA = [
    ['🧭', 'La ceremonia manda: dónde empieza, dónde acaba, con qué se hace y cuáles son los hitos.'],
    ['🎭', 'Los cinco elementos y el guion del protagonista son la ficha. Lo demás es logística.'],
    ['🏺', 'Institución, conocimiento u objeto: toda herramienta del tour entra por una de las tres puertas.'],
    ['💰', 'El costeo no es el último paso: es el que dice si la comunidad de verdad cobra.'],
    ['🗺️', 'Un imperdible se gana el sitio si explica el lugar, no si sale bien en la foto.'],
    ['📸', 'Sin foto no hay venta: una ficha con degradado se lee como un hueco.'],
    ['🤝', 'El protagonista se lleva lo suyo. Es el motivo de todo esto.'],
  ];

  var puesto = false;
  function estilos() {
    if (puesto) return; puesto = true;
    var s = document.createElement('style');
    s.textContent =
      '.scarga{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:14px;padding:58px 24px;text-align:center;min-height:52vh}' +
      '.scarga-st{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;' +
        'justify-content:center;font-size:46px;line-height:1;flex:0 0 auto;' +
        'background:linear-gradient(135deg,#FDE7DC,#E4F1FA);' +
        'box-shadow:0 10px 30px -14px rgba(30,26,22,.45);' +
        'animation:scBota 1.9s ease-in-out infinite}' +
      '.scarga-tx{max-width:38ch;font-size:15.5px;line-height:1.6;color:#3C3630;' +
        'transition:opacity .45s ease;min-height:3em;display:flex;align-items:center}' +
      '.scarga-pie{font-family:Oswald,system-ui,sans-serif;font-size:11.5px;letter-spacing:.14em;' +
        'text-transform:uppercase;color:#A9A096}' +
      '@keyframes scBota{0%,100%{transform:translateY(0) rotate(-3deg)}' +
        '50%{transform:translateY(-9px) rotate(3deg)}}' +
      '@media(prefers-reduced-motion:reduce){.scarga-st{animation:none}' +
        '.scarga-tx{transition:none}}';
    document.head.appendChild(s);
  }

  function baraja(l) {
    var a = l.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Monta el cargando dentro de `el` y va cambiando la frase. Devuelve un
     objeto con para() —por si la página quiere cortarlo— y pie() para cambiar
     el rótulo de abajo sin tocar lo demás. */
  function monta(el, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return { para: function () {}, pie: function () {} };
    opts = opts || {};
    estilos();

    var lista = baraja(opts.set === 'ficha' ? FICHA : HUESPED);
    var i = 0;

    el.innerHTML =
      '<div class="scarga">' +
        '<div class="scarga-st" id="scSt"></div>' +
        '<div class="scarga-tx" id="scTx"></div>' +
        '<div class="scarga-pie" id="scPie"></div>' +
      '</div>';
    var st = el.querySelector('#scSt'), tx = el.querySelector('#scTx'), pie = el.querySelector('#scPie');
    pie.textContent = opts.pie || 'Un momento…';

    function pon() {
      var f = lista[i % lista.length];
      st.textContent = f[0];
      tx.textContent = f[1];
    }
    pon();

    var reloj = setInterval(function () {
      tx.style.opacity = '0'; st.style.opacity = '0';
      setTimeout(function () {
        i++; pon();
        tx.style.opacity = '1'; st.style.opacity = '1';
      }, 450);
    }, opts.cada || 4200);

    return {
      para: function () { clearInterval(reloj); },
      pie:  function (t) { pie.textContent = t; },
    };
  }

  return { monta: monta, huesped: HUESPED, ficha: FICHA };
})();
