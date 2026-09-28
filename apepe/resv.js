/* APePe se acordaba de quién eres sólo mientras la liga estuviera en la barra
   de direcciones.
   El huésped recibe su liga una vez —por correo o por WhatsApp—, entra, y a
   partir de ahí navega: toca «Welcome», vuelve al inicio, instala la app en su
   teléfono. En cualquiera de esos pasos el `?resv=` se pierde, y con él la
   identidad: ¿Upgrade?, el check-in, «Yo» y los Vnums dejaban de funcionar.
   El botón de upgrade no estaba roto — es que la app ya no sabía de quién era.

   Esto lo arregla en un sitio y para todas las pantallas: la primera vez que
   la liga trae el token se guarda, y a partir de ahí se repone en la URL antes
   de que corra el código de la pantalla. Así cada pantalla lo sigue leyendo
   donde siempre lo ha leído y no hay que tocar ninguna.

   Se carga en el <head>, síncrono y antes que nada: si corriera después, el
   código de la pantalla ya habría mirado una URL sin token.
   Javi, 28-sep. */
(function () {
  'use strict';
  var CLAVES = { resv: 'apepe_resv', sol: 'apepe_sol' };

  /* Sólo un uuid. Si alguien pega cualquier cosa en la barra, no se guarda:
     un token inventado no abre nada y ensuciaría el teléfono para siempre. */
  function bueno(v) {
    v = String(v == null ? '' : v).trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : '';
  }
  function lee(k) { try { return bueno(localStorage.getItem(k)); } catch (_) { return ''; } }
  function guarda(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  var p, cambio = false, vals = {};
  try { p = new URLSearchParams(location.search); } catch (_) { p = null; }

  Object.keys(CLAVES).forEach(function (nom) {
    var k = CLAVES[nom];
    var deLaUrl = p ? bueno(p.get(nom)) : '';
    if (deLaUrl) { guarda(k, deLaUrl); vals[nom] = deLaUrl; return; }
    var guardado = lee(k);
    if (guardado && p) { p.set(nom, guardado); cambio = true; }
    vals[nom] = guardado;
  });

  /* Reponerlo en la URL —sin recargar— es lo que hace que las pantallas que ya
     existen funcionen sin cambiarles una línea. */
  if (cambio) {
    try {
      var q = p.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    } catch (_) {}
  }

  window.apepeResv = {
    token: function () { return vals.resv || ''; },
    sol: function () { return vals.sol || ''; },
    /* Lo que hay que pegarle a una liga interna para no perder la identidad. */
    qs: function () {
      if (vals.resv) return '?resv=' + encodeURIComponent(vals.resv);
      if (vals.sol) return '?sol=' + encodeURIComponent(vals.sol);
      return '';
    },
    /* Para cuando el huésped se va: el siguiente que agarre el teléfono no
       hereda su reserva. */
    olvida: function () {
      Object.keys(CLAVES).forEach(function (n) {
        try { localStorage.removeItem(CLAVES[n]); } catch (_) {}
      });
      vals = {};
    }
  };
})();
