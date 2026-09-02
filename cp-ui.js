/* ============================================================
   cp-ui.js — Comportamiento compartido del Grupo Casa Pepe
   Pestañas, modales, hojas, toasts y las reglas de navegación.

     <script src="/cp-ui.js" defer></script>

   Todo se activa solo por atributos en el HTML; no hace falta
   escribir JS en cada pantalla.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Reglas de navegación del Grupo -----------------
     ABRIR   → data-cp-abre="idDelModal"
     CERRAR  → data-cp-cierra  (o la X .cp-cerrar, o Esc, o clic fuera)
     PESTAÑA → .cp-nav button[data-panel="idDelPanel"]
     ATRÁS   → NO existe dentro de un módulo /m/: el menú lateral del
               panel es permanente. Un "← Panel" carga el dashboard
               dentro del iframe y anida el panel dentro del panel.
               Para salir de una vista secundaria se usa CERRAR.
     ------------------------------------------------------------ */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Pestañas -------------------------------------- */
  function activaPestana(btn) {
    var nav = btn.closest('.cp-nav');
    if (!nav) return;
    $$('button', nav).forEach(function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
    var destino = btn.getAttribute('data-panel');
    if (!destino) return;
    // Sólo tocamos los paneles hermanos declarados por la misma barra.
    $$('button[data-panel]', nav).forEach(function (b) {
      var p = document.getElementById(b.getAttribute('data-panel'));
      if (p) p.hidden = (b !== btn);
    });
    if (history.replaceState) {
      try { history.replaceState(null, '', '#' + destino); } catch (e) {}
    }
    btn.dispatchEvent(new CustomEvent('cp:pestana', { bubbles: true, detail: { panel: destino } }));
  }

  /* ---------- Modales / hojas ------------------------------- */
  var pilaModales = [];

  function abrir(id) {
    var m = typeof id === 'string' ? document.getElementById(id) : id;
    if (!m) return null;
    m.classList.add('abierto');
    pilaModales.push(m);
    document.body.style.overflow = 'hidden';
    var foco = m.querySelector('[autofocus], .cp-input, .cp-btn');
    if (foco) { try { foco.focus(); } catch (e) {} }
    m.dispatchEvent(new CustomEvent('cp:abierto', { bubbles: true }));
    return m;
  }

  function cerrar(id) {
    var m = id ? (typeof id === 'string' ? document.getElementById(id) : id) : pilaModales[pilaModales.length - 1];
    if (!m) return;
    m.classList.remove('abierto');
    pilaModales = pilaModales.filter(function (x) { return x !== m; });
    if (!pilaModales.length) document.body.style.overflow = '';
    m.dispatchEvent(new CustomEvent('cp:cerrado', { bubbles: true }));
  }

  /* ---------- Toast ----------------------------------------- */
  var tToast = null;
  function toast(texto, ms) {
    var t = $('.cp-toast');
    if (!t) { t = document.createElement('div'); t.className = 'cp-toast'; document.body.appendChild(t); }
    t.textContent = texto;
    requestAnimationFrame(function () { t.classList.add('ver'); });
    clearTimeout(tToast);
    tToast = setTimeout(function () { t.classList.remove('ver'); }, ms || 2600);
  }

  /* ---------- Tema ------------------------------------------ */
  function tema(valor) {
    if (valor) {
      document.documentElement.setAttribute('data-tema', valor);
      try { localStorage.setItem('cp-tema', valor); } catch (e) {}
    }
    return document.documentElement.getAttribute('data-tema') || 'claro';
  }
  try {
    var guardado = localStorage.getItem('cp-tema');
    if (guardado) document.documentElement.setAttribute('data-tema', guardado);
  } catch (e) {}

  /* ---------- Formato (que todas las pantallas cuenten igual) */
  var fmt = {
    dinero: function (n, dec) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return '$' + Number(n).toLocaleString('es-MX', {
        minimumFractionDigits: dec === undefined ? 0 : dec,
        maximumFractionDigits: dec === undefined ? 0 : dec
      });
    },
    corto: function (n) { // 1.2M / 340K — para KPIs, nunca para tablas
      if (n === null || n === undefined || isNaN(n)) return '—';
      var a = Math.abs(n);
      if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (a >= 1e3) return Math.round(n / 1e3) + 'K';
      return String(Math.round(n));
    },
    pct: function (n, dec) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toFixed(dec === undefined ? 1 : dec) + '%';
    },
    num: function (n) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toLocaleString('es-MX');
    },
    fecha: function (d) {
      var f = (d instanceof Date) ? d : new Date(d);
      if (isNaN(f)) return '—';
      return f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
    },
    delta: function (n, sufijo) {
      var cls = n > 0 ? 'sube' : (n < 0 ? 'baja' : 'igual');
      var signo = n > 0 ? '▲ +' : (n < 0 ? '▼ ' : '= ');
      return '<span class="cp-delta ' + cls + '">' + signo + Math.abs(n).toFixed(1) + (sufijo || '') + '</span>';
    }
  };

  /* ---------- Cableado automático --------------------------- */
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('.cp-nav button[data-panel]'))) { activaPestana(b); return; }
    if ((b = e.target.closest('[data-cp-abre]'))) { abrir(b.getAttribute('data-cp-abre')); return; }
    if ((b = e.target.closest('[data-cp-cierra], .cp-cerrar'))) {
      cerrar(b.getAttribute('data-cp-cierra') || b.closest('.cp-modal'));
      return;
    }
    if ((b = e.target.closest('.cp-seg button'))) {
      $$('button', b.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      b.dispatchEvent(new CustomEvent('cp:segmento', { bubbles: true, detail: { valor: b.getAttribute('data-valor') } }));
      return;
    }
    // clic en el fondo del modal cierra
    if (e.target.classList && e.target.classList.contains('cp-modal')) cerrar(e.target);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pilaModales.length) { e.preventDefault(); cerrar(); }
  });

  // Pestaña inicial: la del #hash, o la primera
  document.addEventListener('DOMContentLoaded', function () {
    $$('.cp-nav').forEach(function (nav) {
      var btns = $$('button[data-panel]', nav);
      if (!btns.length) return;
      var porHash = location.hash && btns.filter(function (b) { return '#' + b.getAttribute('data-panel') === location.hash; })[0];
      var marcado = btns.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0];
      activaPestana(porHash || marcado || btns[0]);
    });
  });

  global.cpUI = {
    abrir: abrir, cerrar: cerrar, toast: toast, tema: tema, fmt: fmt,
    pestana: activaPestana, $: $, $$: $$
  };
})(window);
