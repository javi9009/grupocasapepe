/* cp-guarda.js — que un guardado bloqueado no se haga pasar por guardado.
 *
 * Cuando RLS bloquea un UPDATE o un DELETE, PostgREST no da error: devuelve
 * 204 con CERO filas tocadas. En el navegador eso es `r.ok === true`, así que
 * la pantalla canta "Guardado", vuelve a leer la fila y repinta los valores
 * viejos. Quien lo vive jura que escribió y se le borró. No se borró: nunca
 * llegó a entrar. (Caso David Linares, 7-oct-2026: su ficha llevaba tres días
 * intacta mientras el Ateneo la rellenaba una y otra vez.)
 *
 * Esto envuelve fetch y, SOLO para PATCH y DELETE contra /rest/v1/:
 *   1. fuerza `Prefer: return=representation` — incluso si la llamada pedía
 *      `return=minimal`, porque son justo esas las que no miran la respuesta;
 *   2. si no vuelve ninguna fila, sustituye la respuesta por un 403 con un
 *      texto claro, y
 *   3. enseña un aviso en pantalla, para las llamadas que ni siquiera miran
 *      si salió bien.
 *
 * Con el 403, el `if(!r.ok){toast(...)}` de casi todas las pantallas salta
 * solo, y los ayudantes tipo `sb()`/`api()` que lanzan excepción también.
 * No hace falta tocar las 77 llamadas una por una.
 *
 * No toca POST (un insert bloqueado SÍ da 403 por su cuenta), ni GET, ni las
 * funciones edge (/functions/v1/).
 */
(function () {
  if (typeof window === 'undefined' || !window.fetch || window.__cpGuarda) return;
  window.__cpGuarda = true;

  var AVISO = 'No se guardó: tu usuario no tiene permiso para editar esto, '
            + 'o la fila ya no existe. No se perdió nada — no llegó a entrar. '
            + 'Avísale a Javi.';

  function enPantalla(texto) {
    try {
      if (!document || !document.body) return;
      var id = 'cpGuardaAviso', caja = document.getElementById(id);
      if (!caja) {
        caja = document.createElement('div');
        caja.id = id;
        caja.setAttribute('role', 'alert');
        caja.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;'
          + 'z-index:2147483647;max-width:min(560px,92vw);background:#9E3B2E;color:#fff;'
          + 'padding:13px 16px;border-radius:12px;font:500 14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;'
          + 'box-shadow:0 12px 34px -12px rgba(0,0,0,.55);cursor:pointer';
        caja.onclick = function () { caja.style.display = 'none'; };
        document.body.appendChild(caja);
      }
      caja.textContent = texto;
      caja.style.display = 'block';
      clearTimeout(caja.__t);
      caja.__t = setTimeout(function () { caja.style.display = 'none'; }, 9000);
    } catch (_) {}
  }

  var original = window.fetch;

  window.fetch = function (entrada, opciones) {
    var url = '';
    try { url = (typeof entrada === 'string') ? entrada : (entrada && entrada.url) || ''; } catch (_) {}
    var metodo = 'GET';
    try { metodo = String((opciones && opciones.method) || (entrada && entrada.method) || 'GET').toUpperCase(); } catch (_) {}

    var nosToca = (metodo === 'PATCH' || metodo === 'DELETE')
               && url.indexOf('/rest/v1/') >= 0
               && url.indexOf('/functions/v1/') < 0;

    if (!nosToca || !opciones) return original.apply(this, arguments);

    var init = {};
    for (var k in opciones) { if (Object.prototype.hasOwnProperty.call(opciones, k)) init[k] = opciones[k]; }

    /* Se normalizan las cabeceras a objeto llano y se impone el Prefer.
       Pisar un `return=minimal` es seguro: quien lo pedía no lee el cuerpo. */
    var cabeceras = {}, h = opciones.headers || {};
    if (h && typeof h.forEach === 'function' && typeof h.get === 'function') {
      h.forEach(function (v, n) { cabeceras[n] = v; });
    } else {
      for (var n in h) { if (Object.prototype.hasOwnProperty.call(h, n)) cabeceras[n] = h[n]; }
    }
    for (var c in cabeceras) {
      if (Object.prototype.hasOwnProperty.call(cabeceras, c) && String(c).toLowerCase() === 'prefer') delete cabeceras[c];
    }
    cabeceras['Prefer'] = 'return=representation';
    init.headers = cabeceras;

    return original.call(this, entrada, init).then(function (r) {
      if (!r.ok) return r;
      var copia;
      try { copia = r.clone(); } catch (_) { return r; }
      return copia.json().then(function (filas) {
        if (Array.isArray(filas) && filas.length === 0) {
          try { console.warn('[cp-guarda] ' + metodo + ' sin efecto (RLS o fila inexistente):', url); } catch (_) {}
          enPantalla(AVISO);
          try { return new Response(AVISO, { status: 403, statusText: 'Sin permiso' }); }
          catch (_) { return r; }
        }
        return r;
      }, function () { return r; });
    });
  };
})();
