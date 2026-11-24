/* cp-sesion.js — que una pantalla abierta mucho rato no pierda el guardado.
 *
 * Javi, 22-nov-2026, repartiendo el bono en Productividad · Matriz:
 *   «No se pudo guardar el reparto: {"code":"PGRST303","message":"JWT expired"}»
 *
 * Qué pasaba: muchas pantallas leen la llave de sesión UNA vez, al cargar, y la
 * guardan en una variable (const H={Authorization:'Bearer '+token}). La llave
 * dura una hora. El panel (index.html) sí la renueva y deja la nueva en el
 * navegador, pero la pantalla seguía mandando la vieja: a la hora, todo lo que
 * se guardaba fallaba hasta recargar.
 *
 * Qué hace esto, y SOLO esto:
 *   1. Si una petición a nuestro Supabase lleva una llave de usuario ya
 *      caducada (o a punto), la cambia por la vigente que hay en el navegador;
 *      si esa también caducó, la renueva con la llave de renovación.
 *   2. Si aun así el servidor contesta 401, renueva y reintenta UNA vez.
 *
 * Qué NO hace (lección de cp-guarda.js, 8-oct): no toca Prefer ni ninguna otra
 * cabecera, no toca el cuerpo, no toca peticiones sin llave de usuario (las que
 * van con la llave pública pasan intactas), no toca /auth/ ni otros dominios.
 * Si algo aquí falla, la petición sale exactamente como la mandó la pantalla.
 *
 * Vuelta atrás: vaciar este archivo. Nada más depende de él.
 */
(function () {
  'use strict';
  try {
    if (window.__cpSesion || !window.fetch) return;
    window.__cpSesion = true;
    var SB = 'https://rehophywchakfapivsbh.supabase.co';
    var LS = 'sb-rehophywchakfapivsbh-auth-token';
    var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
    var MARGEN = 30;                       /* segundos: «a punto de caducar» */
    var orig = window.fetch.bind(window), renovando = null, ultimoFallo = 0, avisado = 0;

    function ahora() { return Date.now() / 1000; }
    function lee() {
      try {
        var j = JSON.parse(localStorage.getItem(LS) || 'null'); if (!j) return null;
        var s = j.currentSession || j.session || j;
        return (s && s.access_token) ? { raw: j, s: s } : null;
      } catch (_) { return null; }
    }
    /* caducidad de una llave DE USUARIO; null si no lo es (llave pública, anon) */
    function exp(t) {
      try {
        var p = String(t).split('.'); if (p.length !== 3) return null;
        var b = p[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
        var c = JSON.parse(atob(b));
        return (c && c.sub && c.exp) ? +c.exp : null;
      } catch (_) { return null; }
    }
    function vigente(t, margen) { var e = exp(t); return e != null && e - (margen || 0) > ahora(); }
    function guarda(a, j) {
      try {
        var s = {}; for (var k in a.s) s[k] = a.s[k]; for (var k2 in j) s[k2] = j[k2];
        if (!j.expires_at) s.expires_at = Math.round(ahora()) + (+j.expires_in || 3600);
        var raw = a.raw;
        if (raw.currentSession) { raw.currentSession = s; if (raw.expiresAt != null) raw.expiresAt = s.expires_at; }
        else if (raw.session) raw.session = s;
        else raw = s;
        localStorage.setItem(LS, JSON.stringify(raw));
      } catch (_) {}
    }
    function renueva() {
      if (renovando) return renovando;
      var a = lee();
      if (!a || !a.s.refresh_token || Date.now() - ultimoFallo < 30000) return Promise.resolve(null);
      renovando = orig(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: a.s.refresh_token })
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        renovando = null;
        if (j && j.access_token) { guarda(a, j); return j.access_token; }
        /* quizá el panel la renovó a la vez y la nuestra ya no valía */
        var b = lee(); if (b && vigente(b.s.access_token, 5)) return b.s.access_token;
        ultimoFallo = Date.now(); return null;
      }).catch(function () { renovando = null; ultimoFallo = Date.now(); return null; });
      return renovando;
    }
    function fresca() {
      var a = lee();
      if (a && vigente(a.s.access_token, MARGEN)) return Promise.resolve(a.s.access_token);
      return renueva().then(function (t) {
        if (t) return t;
        var b = lee(); return (b && vigente(b.s.access_token, 0)) ? b.s.access_token : null;
      });
    }
    function auth(h) {
      try {
        if (!h) return null;
        if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get('Authorization');
        if (Array.isArray(h)) { for (var i = 0; i < h.length; i++) if (String(h[i][0]).toLowerCase() === 'authorization') return h[i][1]; return null; }
        for (var k in h) if (k.toLowerCase() === 'authorization') return h[k];
      } catch (_) {}
      return null;
    }
    function conLlave(o, t) {
      var o2 = {}; for (var k in o) o2[k] = o[k];
      var h = o.headers, v = 'Bearer ' + t;
      if (typeof Headers !== 'undefined' && h instanceof Headers) { var H2 = new Headers(h); H2.set('Authorization', v); o2.headers = H2; }
      else if (Array.isArray(h)) { o2.headers = h.map(function (p) { return String(p[0]).toLowerCase() === 'authorization' ? [p[0], v] : p; }); }
      else { var n = {}; for (var k2 in h) n[k2] = (k2.toLowerCase() === 'authorization') ? v : h[k2]; o2.headers = n; }
      return o2;
    }
    function llave(v) { return String(v || '').replace(/^Bearer\s+/i, ''); }
    function avisa() {
      if (Date.now() - avisado < 60000) return; avisado = Date.now();
      var m = 'Tu sesión caducó y no se pudo renovar. Vuelve a entrar al panel (recarga la página) y repite lo último que guardaste.';
      try { if (typeof window.cpAviso === 'function') window.cpAviso(m); } catch (_) {}
    }

    window.fetch = function (u, o) {
      var url = '';
      try { url = typeof u === 'string' ? u : ((u && u.url) || String(u)); } catch (_) {}
      if (url.indexOf(SB) !== 0 || url.indexOf('/auth/v1/') >= 0 || !o || !o.headers) return orig(u, o);
      var t0 = llave(auth(o.headers)), e = t0 ? exp(t0) : null;
      if (e == null) return orig(u, o);              /* sin llave de usuario: no es asunto nuestro */
      var antes = (e - MARGEN > ahora()) ? Promise.resolve(null) : fresca().catch(function () { return null; });
      return antes.then(function (t) {
        var usada = (t && t !== t0) ? t : t0;
        return orig(u, usada === t0 ? o : conLlave(o, usada)).then(function (r) {
          if (r.status !== 401) return r;
          /* 401 con llave que aquí parece vigente: sólo es asunto nuestro si el
             servidor dice que la llave caducó (reloj del equipo atrasado). Un
             «no tienes permiso» de una función no se arregla renovando. */
          return r.clone().text().catch(function () { return ''; }).then(function (txt) {
            if (vigente(usada, 0) && !/jwt|expired|PGRST30\d/i.test(txt || '')) return r;
            var a = lee(), otra = (a && a.s.access_token !== usada && vigente(a.s.access_token, 5)) ? Promise.resolve(a.s.access_token) : renueva();
            return otra.then(function (t2) {
              if (!t2 || t2 === usada) { avisa(); return r; }
              return orig(u, conLlave(o, t2));
            }, function () { return r; });
          });
        });
      });
    };
  } catch (_) { /* nunca romper la pantalla por esto */ }
})();
