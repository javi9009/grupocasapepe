/* Sincrético · compartir una ficha
 * ---------------------------------------------------------------------------
 * Javi, 15-oct-2026: «nos falta en la página del tour la opción de compartir».
 *
 * Un botón y una regla: la liga que sale de aquí tiene que servir para comprar.
 * Por eso se conserva el CÓDIGO DE QUIEN RECOMIENDA —?c= o ?ref=—, que es lo
 * que hace que la venta se le acredite al Pepe o al hotel que la pasó. Si al
 * compartir se perdiera, el concierge se quedaría sin su comisión por hacer
 * justo lo que queremos que haga.
 *
 * Y se van los parámetros del viaje de ida y vuelta —app, d, a, b, sigo, code,
 * prueba—: son de la sesión de quien comparte, no del sitio. Mandar «sigo=1»
 * a un amigo lo lanzaría a un pago que no ha pedido.
 *
 * En el teléfono abre el menú del sistema (WhatsApp, mensajes, lo que tenga).
 * En un ordenador no hay menú: copia la liga y lo dice.
 */
(function (global) {
  'use strict';

  /* Lo que viaja y lo que se queda. Lista blanca, no negra: si mañana alguien
     inventa un parámetro nuevo, por defecto NO se comparte. */
  var VIAJAN = ['c', 'ref', 'h', 'hotel'];

  function liga() {
    try {
      var u = new URL(location.href);
      var limpia = new URL(u.origin + u.pathname);
      if (u.searchParams.get('id')) limpia.searchParams.set('id', u.searchParams.get('id'));
      if (u.searchParams.get('plan')) limpia.searchParams.set('plan', u.searchParams.get('plan'));
      if (u.searchParams.get('p')) limpia.searchParams.set('p', u.searchParams.get('p'));
      VIAJAN.forEach(function (k) {
        var v = u.searchParams.get(k);
        if (v) limpia.searchParams.set(k, v);
      });
      return limpia.toString();
    } catch (_) { return location.href; }
  }

  function tr(x) { try { return global.sincI18n ? global.sincI18n.t(x) : x; } catch (_) { return x; } }

  async function copia(texto) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (_) {}
    /* Safari viejo y los navegadores sin permiso de portapapeles: el truco del
       textarea sigue funcionando y es la diferencia entre compartir y no. */
    try {
      var t = document.createElement('textarea');
      t.value = texto;
      t.setAttribute('readonly', '');
      t.style.cssText = 'position:absolute;left:-9999px;top:0';
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(t);
      return !!ok;
    } catch (_) { return false; }
  }

  /* opts: {titulo, texto}. El botón se crea y se devuelve; quien llama decide
     dónde lo cuelga. */
  function boton(opts) {
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sincShare';
    b.setAttribute('aria-label', tr('Compartir'));
    b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle>' +
      '<circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"></line>' +
      '<line x1="8.6" y1="13.4" x2="15.4" y2="17.6"></line></svg><span>' + tr('Compartir') + '</span>';
    b.onclick = async function () {
      var url = liga();
      var titulo = opts.titulo || document.title || 'Casa Pepe';
      try {
        if (navigator.share) {
          await navigator.share({ title: titulo, text: opts.texto || titulo, url: url });
          return;
        }
      } catch (e) {
        /* Cancelar el menú del sistema lanza AbortError: eso no es un fallo y
           no hay que contestarle nada a quien se arrepintió. */
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return;
      }
      var ok = await copia(url);
      var s = b.querySelector('span');
      if (!s) return;
      var antes = s.textContent;
      s.textContent = ok ? tr('Liga copiada') : url;
      b.classList.add('listo');
      setTimeout(function () { s.textContent = antes; b.classList.remove('listo'); }, 2200);
    };
    return b;
  }

  function estilos() {
    if (document.getElementById('sincShareCss')) return;
    var s = document.createElement('style');
    s.id = 'sincShareCss';
    s.textContent =
      '.sincShare{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;' +
      'border:1px solid var(--linea,#E2DCCF);background:var(--blanco,#fff);color:var(--tinta,#1E1A16);' +
      'font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;transition:background .15s}' +
      '.sincShare:hover{background:var(--hueso,#F7F3EC)}' +
      '.sincShare.listo{background:#E8F3EC;border-color:#B9DCC6}' +
      '.sincShare svg{flex:0 0 auto}';
    document.head.appendChild(s);
  }

  /* Lo pone al lado del título, que es donde la gente lo busca. */
  function monta(opts) {
    opts = opts || {};
    var ancla = typeof opts.junto === 'string' ? document.getElementById(opts.junto) : opts.junto;
    if (!ancla || ancla.querySelector('.sincShare') ||
        (ancla.parentNode && ancla.parentNode.querySelector('.sincShare'))) return null;
    estilos();
    var b = boton(opts);
    var caja = document.createElement('div');
    caja.style.cssText = 'margin:10px 0 0';
    caja.appendChild(b);
    ancla.parentNode.insertBefore(caja, ancla.nextSibling);
    return b;
  }

  global.sincCompartir = { monta: monta, boton: boton, liga: liga };
})(window);
