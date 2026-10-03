/* cp-verpass.js — el ojito de "ver contraseña".
 *
 * Le pone un botón para mostrar/ocultar a CUALQUIER <input type="password"> de
 * la página, sin tocar cada formulario a mano. Funciona también con los campos
 * que se dibujan después con JavaScript (observa el DOM). Es autónomo: no
 * depende de nada y se puede incluir en cualquier página con
 *   <script defer src="/cp-verpass.js"></script>
 *
 * No reescribe el campo: lo envuelve en un <span> relativo y mete el botón
 * encima, a la derecha. Conserva el valor, el foco y el autocompletado.
 */
(function () {
  'use strict';
  if (window.__cpVerPass) return; window.__cpVerPass = true;

  var OJO = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OJO_TACHADO = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  var CSS =
    '.cpvp-wrap{position:relative;display:block}' +
    '.cpvp-wrap>input{width:100%}' +
    '.cpvp-btn{position:absolute;top:0;right:0;height:100%;width:42px;border:0;margin:0;padding:0;' +
    'background:transparent;cursor:pointer;color:#8a8278;display:flex;align-items:center;justify-content:center;' +
    'z-index:3;-webkit-tap-highlight-color:transparent;line-height:0}' +
    '.cpvp-btn:hover{color:#3a3630}' +
    '.cpvp-btn:focus-visible{outline:2px solid #137A56;outline-offset:-2px;border-radius:8px}' +
    'input.cpvp-field{padding-right:46px !important}';

  function injectCss() {
    if (document.getElementById('cpvp-css')) return;
    var st = document.createElement('style'); st.id = 'cpvp-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function attach(inp) {
    try {
      if (!inp || inp.dataset.cpvp) return;
      if (String(inp.type || '').toLowerCase() !== 'password') return;
      if (inp.disabled || inp.readOnly) { /* igual lo dejamos: el usuario puede querer ver */ }
      inp.dataset.cpvp = '1';
      var p = inp.parentNode; if (!p) return;

      var w = document.createElement('span');
      w.className = 'cpvp-wrap';
      p.insertBefore(w, inp);
      w.appendChild(inp);
      inp.classList.add('cpvp-field');

      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cpvp-btn';
      b.setAttribute('aria-label', 'Mostrar la contraseña');
      b.setAttribute('aria-pressed', 'false');
      b.title = 'Ver / ocultar la contraseña';
      b.tabIndex = -1; /* no estorbar al tabular entre campos */
      b.innerHTML = OJO;

      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var mostrar = inp.type === 'password';
        inp.type = mostrar ? 'text' : 'password';
        b.innerHTML = mostrar ? OJO_TACHADO : OJO;
        b.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
        b.setAttribute('aria-label', mostrar ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
        try { inp.focus({ preventScroll: true }); } catch (_) {}
      });

      w.appendChild(b);
    } catch (_) {}
  }

  function scan(root) {
    try {
      (root || document).querySelectorAll('input[type="password"]:not([data-cpvp])').forEach(attach);
    } catch (_) {}
  }

  function go() {
    injectCss();
    scan(document);
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var a = muts[i].addedNodes;
          for (var j = 0; j < a.length; j++) {
            var n = a[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.matches && n.matches('input[type="password"]')) attach(n);
            if (n.querySelectorAll) scan(n);
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
