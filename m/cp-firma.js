/* cp-firma.js — el lienzo de firma autógrafa, uno solo para todo el Grupo.
 *
 * Javi, 26-oct-2026: «La firma debe ser autógrafa con el dedo o el ratón», y
 * «ha de ser el mismo método que el del resto de ateneistas, se genera y se
 * firma». Hasta hoy no era así en ningún alta: el ateneísta marcaba una
 * casilla («Lo leí y lo acepto»), la productora llamaba a prod_portal_firma
 * con un booleano, y las columnas firma_autografa de tour_operadores y
 * productoras existían desde el principio sin que nadie las llenara nunca.
 * El único lienzo de verdad estaba en firmar.html, para las cartas poder.
 *
 * Así que esto es ese lienzo, sacado de ahí y hecho pieza, con dos arreglos
 * que el original no tenía y que en un alta por pasos importan:
 *
 *  1. Guarda los trazos, no los píxeles. El original medía el canvas al
 *     arrancar. En un asistente por pasos el lienzo nace escondido, mide 0 de
 *     ancho, y la firma no se dibujaba: no había nada que pintar. Aquí los
 *     trazos viven en coordenadas del cuadro y se repintan cuando cambia de
 *     tamaño, así que da igual si nació oculto o si giran el teléfono.
 *  2. Un solo juego de eventos. El original ataba pointer* Y touch*, que en un
 *     móvil disparan los dos y duplican el trazo.
 *
 *   <script src="/m/cp-firma.js"></script>
 *   var f = CP.firma('miCaja');          // id o el propio elemento
 *   f.tinta()   -> true si hay algo dibujado
 *   f.png()     -> dataURL PNG, fondo transparente, 900px de ancho
 *   f.limpia()
 *   f.muestra(dataURL) -> enseña una firma ya guardada (solo lectura)
 *
 * Quien lo use decide dónde guarda el PNG. La columna se llama
 * firma_autografa en tour_operadores y en productoras.
 */
(function (raiz) {
  'use strict';

  var CP = raiz.CP = raiz.CP || {};
  var CSS_PUESTO = false;

  /* El ancho con el que se exporta. El cuadro en pantalla puede ser de 280px
     en un teléfono; una firma de 280px pegada en un convenio se ve como una
     mancha. Se reescala desde los trazos, que no tienen resolución. */
  var ANCHO_PNG = 900;

  function css() {
    if (CSS_PUESTO) return;
    CSS_PUESTO = true;
    var s = document.createElement('style');
    s.id = 'cp-firma';
    s.textContent =
      '.cp-firma{position:relative;border:2px dashed #C9BFA6;border-radius:12px;' +
        'background:#FFFDF8;margin-top:10px;overflow:hidden}' +
      '.cp-firma canvas{display:block;width:100%;height:170px;' +
        'touch-action:none;cursor:crosshair}' +
      '.cp-firma.cp-firma-ver canvas{cursor:default}' +
      '.cp-firma-pista{position:absolute;inset:0;display:flex;align-items:center;' +
        'justify-content:center;color:#BCAE8C;font:400 14px Inter,system-ui,sans-serif;' +
        'pointer-events:none;text-align:center;padding:0 16px}' +
      '.cp-firma-pie{display:flex;align-items:center;justify-content:space-between;' +
        'gap:10px;margin-top:7px}' +
      '.cp-firma-pie .cp-firma-ayuda{font:400 12.5px Inter,system-ui,sans-serif;color:#6E665C}' +
      '.cp-firma-borra{background:none;border:1.5px solid #E6DFD6;border-radius:9px;' +
        'padding:7px 13px;font:600 11px Oswald,system-ui,sans-serif;letter-spacing:.09em;' +
        'text-transform:uppercase;color:#6E665C;cursor:pointer}' +
      '.cp-firma-borra:hover{border-color:#C9501A;color:#C9501A}';
    document.head.appendChild(s);
  }

  CP.firma = function (donde, opts) {
    css();
    opts = opts || {};
    var caja = typeof donde === 'string' ? document.getElementById(donde) : donde;
    if (!caja) return null;

    var soloVer = !!opts.soloVer;
    var pista = opts.pista || 'Firma aquí con el dedo o el ratón';

    caja.innerHTML =
      '<div class="cp-firma' + (soloVer ? ' cp-firma-ver' : '') + '">' +
        '<canvas></canvas>' +
        '<div class="cp-firma-pista">' + String(pista).replace(/</g, '&lt;') + '</div>' +
      '</div>' +
      (soloVer ? '' :
        '<div class="cp-firma-pie">' +
          '<span class="cp-firma-ayuda">' +
            (opts.ayuda || 'Vale tu firma de puño y letra. Queda registrada con la fecha.') +
          '</span>' +
          '<button type="button" class="cp-firma-borra">Borrar</button>' +
        '</div>');

    var marco = caja.querySelector('.cp-firma');
    var lienzo = caja.querySelector('canvas');
    var elPista = caja.querySelector('.cp-firma-pista');
    var btn = caja.querySelector('.cp-firma-borra');
    var ctx = lienzo.getContext('2d');

    /* Los trazos, en coordenadas del cuadro (px CSS). Esto es lo que se
       guarda; el canvas es solo donde se enseñan. */
    var trazos = [], actual = null, anchoCaja = 0, altoCaja = 0;
    /* Una firma ya guardada que se enseña de fondo (modo solo ver). */
    var imagen = null;

    function pluma(c, escala) {
      c.lineWidth = 2.2 * escala;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#16130F';
    }

    function pinta(c, escala) {
      for (var i = 0; i < trazos.length; i++) {
        var t = trazos[i];
        if (t.length < 2) {
          /* Un punto suelto —un toque sin arrastrar— no se ve con lineTo. */
          if (t.length === 1) {
            c.beginPath();
            c.arc(t[0].x * escala, t[0].y * escala, 1.1 * escala, 0, 6.2832);
            c.fillStyle = '#16130F';
            c.fill();
          }
          continue;
        }
        c.beginPath();
        c.moveTo(t[0].x * escala, t[0].y * escala);
        for (var j = 1; j < t.length; j++) c.lineTo(t[j].x * escala, t[j].y * escala);
        c.stroke();
      }
    }

    function repinta() {
      var r = lienzo.getBoundingClientRect();
      if (!r.width) return;              /* sigue escondido; ya volverá */
      var dpr = raiz.devicePixelRatio || 1;
      anchoCaja = r.width; altoCaja = r.height;
      lienzo.width = Math.round(r.width * dpr);
      lienzo.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      if (imagen) ctx.drawImage(imagen, 0, 0, r.width, r.height);
      pluma(ctx, 1);
      pinta(ctx, 1);
      elPista.style.display = (trazos.length || imagen) ? 'none' : 'flex';
    }

    /* El lienzo puede nacer con 0 de ancho dentro de un paso oculto. Cuando
       aparece, ResizeObserver lo avisa y se pinta entonces. */
    if (raiz.ResizeObserver) {
      new raiz.ResizeObserver(repinta).observe(lienzo);
    } else {
      raiz.addEventListener('resize', repinta);
      setTimeout(repinta, 0);
    }
    repinta();

    if (!soloVer) {
      var dibujando = false;

      function donde_(e) {
        var b = lienzo.getBoundingClientRect();
        var t = (e.touches && e.touches[0]) || e;
        return { x: t.clientX - b.left, y: t.clientY - b.top };
      }
      function ini(e) {
        e.preventDefault();
        if (!anchoCaja) repinta();
        dibujando = true;
        actual = [donde_(e)];
        trazos.push(actual);
        elPista.style.display = 'none';
        pluma(ctx, 1);
      }
      function mov(e) {
        if (!dibujando) return;
        e.preventDefault();
        var p = donde_(e), a = actual[actual.length - 1];
        actual.push(p);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      function fin() {
        if (!dibujando) return;
        dibujando = false;
        if (actual && actual.length === 1) repinta();  /* el punto suelto */
        actual = null;
        if (opts.alFirmar) opts.alFirmar();
      }

      /* Uno solo de los dos. Atar pointer* y touch* a la vez duplica cada
         trazo en un teléfono. */
      if (raiz.PointerEvent) {
        lienzo.addEventListener('pointerdown', ini);
        lienzo.addEventListener('pointermove', mov);
        lienzo.addEventListener('pointerup', fin);
        lienzo.addEventListener('pointerleave', fin);
        lienzo.addEventListener('pointercancel', fin);
      } else {
        lienzo.addEventListener('mousedown', ini);
        lienzo.addEventListener('mousemove', mov);
        lienzo.addEventListener('mouseup', fin);
        lienzo.addEventListener('mouseleave', fin);
        lienzo.addEventListener('touchstart', ini);
        lienzo.addEventListener('touchmove', mov);
        lienzo.addEventListener('touchend', fin);
      }

      btn.onclick = function () {
        trazos = []; actual = null;
        repinta();
        if (opts.alFirmar) opts.alFirmar();
      };
    }

    return {
      tinta: function () { return trazos.length > 0; },

      limpia: function () { trazos = []; actual = null; repinta(); },

      /* El PNG se dibuja aparte, a ANCHO_PNG, desde los trazos. No sale del
         canvas de pantalla: ése puede ser diminuto en un móvil. */
      png: function () {
        if (!trazos.length) return null;
        var w = anchoCaja || 1;
        var escala = ANCHO_PNG / w;
        var off = document.createElement('canvas');
        off.width = ANCHO_PNG;
        off.height = Math.round((altoCaja || 170) * escala);
        var c = off.getContext('2d');
        pluma(c, escala);
        pinta(c, escala);
        return off.toDataURL('image/png');
      },

      /* Enseña una firma que ya está guardada. */
      muestra: function (dataURL) {
        if (!dataURL) return;
        var im = new Image();
        im.onload = function () { imagen = im; repinta(); };
        im.src = dataURL;
      },

      /* Por si quien la usa necesita el marco (para teñirlo en rojo, p.ej.) */
      marco: marco
    };
  };
})(typeof window !== 'undefined' ? window : this);
