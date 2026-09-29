/* Los avisos del huésped: la campanita de APePe.
 *
 * Las notificaciones del equipo viven en `notificaciones` y van por empleado; el
 * huésped no tiene usuario, tiene el token de su reserva, así que tiene las suyas
 * en `apepe_notificacion` y se leen con el token y nada más.
 *
 * Esto vive en un archivo aparte y no dentro de cada pantalla porque la campanita
 * tiene que salir igual en Inicio, en Yo y en la que venga después. Se carga al
 * final del <body>:
 *     <script src="/apepe/notis.js"></script>
 * y se monta sola: busca el <header class="top"> y se cuelga de él.
 *
 * Javi, 29-sep.
 */
(function () {
  'use strict';

  var SB = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  function token() {
    try { if (window.apepeResv && window.apepeResv.token()) return window.apepeResv.token(); } catch (_) {}
    try { return new URLSearchParams(location.search).get('resv') || ''; } catch (_) { return ''; }
  }
  function idioma() {
    try { if (String(document.documentElement.lang || '').slice(0, 2) === 'en') return 'en'; } catch (_) {}
    try { return (localStorage.getItem('apepe_lang') === 'en') ? 'en' : 'es'; } catch (_) { return 'es'; }
  }
  function api(fn, body) {
    return fetch(SB + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function cuando(iso, en) {
    try {
      var d = new Date(iso), m = Math.floor((Date.now() - d.getTime()) / 60000);
      if (m < 2) return en ? 'just now' : 'ahora mismo';
      if (m < 60) return m + (en ? ' min ago' : ' min');
      var h = Math.floor(m / 60);
      if (h < 24) return h + (en ? 'h ago' : ' h');
      var dd = Math.floor(h / 24);
      return dd + (en ? (dd === 1 ? ' day ago' : ' days ago') : (dd === 1 ? ' día' : ' días'));
    } catch (_) { return ''; }
  }

  var TOK = token();
  if (!TOK) return;                       // sin reserva no hay avisos que enseñar

  var css = document.createElement('style');
  css.textContent = [
    '.apnBtn{position:relative;border:0;background:rgba(255,255,255,.18);color:#fff;width:38px;height:38px;',
    '  border-radius:999px;font-size:18px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.apnBtn .pt{position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:999px;background:#F2682A;',
    '  box-shadow:0 0 0 2px rgba(0,0,0,.25);display:none}',
    '.apnBtn.hay .pt{display:block}',
    '.apnOv{position:fixed;inset:0;background:rgba(30,26,22,.45);z-index:900;display:none}',
    '.apnOv.on{display:block}',
    /* Centrado, como todos los modales de la app: pegado abajo se lo comía la
       barra de pestañas. */
    '.apnPanel{position:fixed;left:50%;top:50%;z-index:901;background:var(--papel,#FBF7F2);',
    '  width:min(560px,calc(100vw - 32px));border-radius:18px;max-height:78dvh;overflow:auto;',
    '  transform:translate(-50%,-46%) scale(.98);opacity:0;pointer-events:none;',
    '  transition:transform .2s ease,opacity .2s ease;padding:16px;',
    '  box-shadow:0 26px 60px -24px rgba(30,26,22,.55)}',
    '.apnPanel.on{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}',
    '.apnPanel h3{font-family:Oswald,sans-serif;text-transform:uppercase;margin:0 0 2px;font-size:17px;color:var(--tinta,#1E1A16)}',
    '.apnPanel .apnSub{color:var(--gris,#6E665C);font-size:12.5px;margin-bottom:12px}',
    '.apnIt{display:flex;gap:11px;padding:12px;border:1px solid var(--linea,#E6DFD6);border-radius:13px;',
    '  background:#fff;margin-bottom:9px;text-decoration:none;color:inherit}',
    '.apnIt.nueva{border-color:var(--naranja,#F2682A);background:var(--naranja-suave,#FDE7DC)}',
    '.apnIt .em{font-size:22px;line-height:1;flex:none}',
    '.apnIt .ti{font-weight:700;font-size:14.5px;color:var(--tinta,#1E1A16)}',
    '.apnIt .cu{font-size:13px;color:var(--tinta-2,#3C3630);margin-top:2px;line-height:1.45}',
    '.apnIt .cd{font-size:11.5px;color:var(--tenue,#A9A096);margin-top:4px}',
    '.apnVacio{text-align:center;color:var(--tenue,#A9A096);font-size:13px;padding:24px 8px}',
    '.apnPie{display:flex;gap:10px;margin-top:6px}',
    '.apnPie button{flex:1;border:1px solid var(--linea,#E6DFD6);background:#fff;color:var(--tinta,#1E1A16);',
    '  border-radius:11px;padding:10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}'
  ].join('');
  document.head.appendChild(css);

  var btn, ov, panel, DATOS = null;

  function monta() {
    var top = document.querySelector('header.top .in .dcha') ||
              document.querySelector('header.top .in') ||
              document.querySelector('header.top');
    if (!top) return false;

    btn = document.createElement('button');
    btn.className = 'apnBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', idioma() === 'en' ? 'Notifications' : 'Avisos');
    btn.innerHTML = '🔔<span class="pt"></span>';
    btn.onclick = abre;
    top.insertBefore(btn, top.firstChild);

    ov = document.createElement('div'); ov.className = 'apnOv';
    panel = document.createElement('div'); panel.className = 'apnPanel';
    document.body.appendChild(ov); document.body.appendChild(panel);
    ov.onclick = cierra;
    return true;
  }

  function pinta() {
    var en = idioma() === 'en';
    var l = (DATOS && DATOS.lista) || [];
    panel.innerHTML =
      '<h3>' + (en ? 'Your notices' : 'Tus avisos') + '</h3>' +
      '<div class="apnSub">' + (en ? 'Only for your booking.' : 'Sólo de tu reserva.') + '</div>' +
      (l.length
        ? l.map(function (n) {
            var ti = en && n.titulo_en ? n.titulo_en : n.titulo;
            var cu = en && n.cuerpo_en ? n.cuerpo_en : (n.cuerpo || '');
            var tag = n.url ? 'a' : 'div';
            var href = n.url ? (' href="' + esc(n.url) + '"') : '';
            return '<' + tag + href + ' class="apnIt' + (n.leida ? '' : ' nueva') + '">' +
              '<span class="em">' + esc(n.icono || '🔔') + '</span><span>' +
              '<span class="ti">' + esc(ti) + '</span>' +
              (cu ? '<div class="cu">' + esc(cu) + '</div>' : '') +
              '<div class="cd">' + esc(cuando(n.creada, en)) + '</div>' +
              '</span></' + tag + '>';
          }).join('')
        : '<div class="apnVacio">' + (en ? 'Nothing new. We will tell you if there is.' : 'Nada nuevo. Si lo hay, te avisamos.') + '</div>') +
      '<div class="apnPie">' +
        '<button type="button" id="apnCfg">' + (en ? 'Settings' : 'Configuración') + '</button>' +
        '<button type="button" id="apnX">' + (en ? 'Close' : 'Cerrar') + '</button>' +
      '</div>';
    panel.querySelector('#apnX').onclick = cierra;
    panel.querySelector('#apnCfg').onclick = function () {
      var qs = ''; try { qs = window.apepeResv ? window.apepeResv.qs() : ''; } catch (_) {}
      location.href = '/apepe/yo.html' + qs + '#avisos';
    };
  }

  function abre() {
    pinta();
    ov.classList.add('on'); panel.classList.add('on');
    /* Se marcan leídas al abrir, no al tocar cada una: si tuvo que abrir el panel
       para verlas, ya las vio. */
    if (DATOS && DATOS.no_leidas) {
      api('apepe_notif_leer', { p_resv: TOK }).then(function () {
        btn.classList.remove('hay');
        (DATOS.lista || []).forEach(function (n) { n.leida = true; });
        DATOS.no_leidas = 0;
      }).catch(function () {});
    }
  }
  function cierra() { ov.classList.remove('on'); panel.classList.remove('on'); }

  function carga() {
    return api('apepe_notif_listar', { p_resv: TOK }).then(function (d) {
      DATOS = d || { lista: [], no_leidas: 0 };
      if (btn) btn.classList.toggle('hay', Number(DATOS.no_leidas || 0) > 0);
      return DATOS;
    }).catch(function () {});
  }

  function arranca() {
    if (!monta()) return;
    carga();
    /* Al volver a la pantalla (el huésped cambia de app y vuelve), se refresca:
       un aviso que llega mientras tiene APePe abierta no debería esperar a una recarga. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) carga();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranca);
  else arranca();

  window.apepeNotis = { recarga: carga, abre: abre };
})();
