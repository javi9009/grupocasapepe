/* La cuenta del huésped de Sincrético.
 *
 * Antes se compraba escribiendo un correo en un campo. El problema no era el
 * formulario: era que el boleto viaja con un QR, y un correo mal tecleado deja
 * a alguien en la puerta sin poder entrar. Así que antes de pagar hay que tener
 * una cuenta y el correo confirmado. Dos caminos:
 *
 *   Google  — un botón. El correo viene confirmado de origen.
 *   Correo  — seis cifras al buzón. Se teclean aquí y con eso se abre sesión.
 *
 * La sesión del huésped se guarda aparte de la del panel (storageKey propio):
 * si alguien de casa compra un tour desde su navegador, no se queda sin su
 * sesión de trabajo.
 *
 * Necesita supabase-js cargado antes. Lo demás —estilos incluidos— va aquí.
 */
window.sincCuenta = (function () {
  /* El idioma del huésped. Si esta pantalla no trae sinc-i18n.js, T() devuelve
     el español y todo sigue funcionando. */
  function T(x){ try{ return window.sincI18n ? sincI18n.t(x) : x; }catch(_){ return x; } }

  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  var _sb = null, YO = null, PRESTADA = null;
  function cli() {
    if (!_sb) {
      _sb = supabase.createClient(SB, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
                storageKey: 'sinc-huesped-auth' },
      });
    }
    return _sb;
  }

  /* A dónde devuelve Google. Dos cosas importantes:
     · si la pantalla dice a dónde iba (la de pago, por ejemplo), se vuelve ahí
       directamente, y no a donde se pulsó el botón: si no, el huésped vuelve a
       la ficha, vuelve a darle a Reservar, vuelve a Google… y no sale del bucle;
     · se quitan los parámetros del viaje anterior, que si no se encadenan. */
  function aDondeVuelve(destino) {
    var u = new URL(destino || location.href, location.href);
    ['code', 'error', 'error_description', 'state'].forEach(function (k) { u.searchParams.delete(k); });
    return u.toString();
  }
  /* Cuando Google devuelve, la sesión viaja en la URL: hay que crear el cliente
     para que la recoja. Antes esto solo pasaba si la pantalla llamaba a la
     cuenta al cargar —la ficha del tour no lo hacía—, así que el pase se
     quedaba sin canjear y parecía que no había entrado nunca. */
  function recoge() {
    try {
      cli();
      if (/[?&](code|error)=/.test(location.search)) {
        setTimeout(function () {
          var u = new URL(location.href);
          ['code', 'error', 'error_description', 'state'].forEach(function (k) { u.searchParams.delete(k); });
          history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
        }, 1200);
      }
    } catch (_) {}
  }

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- los estilos del pop-up, aquí mismo ---------- */
  var puesto = false;
  function estilos() {
    if (puesto) return; puesto = true;
    var s = document.createElement('style');
    s.textContent =
      '.cuCapa{position:fixed;inset:0;background:rgba(30,26,22,.5);z-index:120;' +
        'display:flex;align-items:center;justify-content:center;padding:18px;' +
        'backdrop-filter:blur(2px);overflow:auto}' +
      '.cuHoja{background:#fff;border-radius:16px;max-width:430px;width:100%;' +
        'padding:26px 24px 22px;box-shadow:0 30px 60px -30px rgba(30,26,22,.6);' +
        'font-family:Inter,system-ui,sans-serif;color:#1E1A16}' +
      '.cuHoja h2{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;' +
        'font-size:21px;margin:0 0 6px;letter-spacing:.01em}' +
      '.cuHoja p{font-size:13.5px;line-height:1.55;color:#6E665C;margin:0 0 18px}' +
      '.cuHoja label{display:block;font-family:Oswald,sans-serif;font-size:11px;' +
        'letter-spacing:.1em;text-transform:uppercase;color:#6E665C;margin:0 0 5px}' +
      '.cuHoja input{width:100%;padding:12px 13px;border:1px solid #E6DFD6;border-radius:10px;' +
        'font:inherit;font-size:15px;background:#fff;margin-bottom:12px}' +
      '.cuHoja input:focus{outline:2px solid #F2682A;outline-offset:-1px;border-color:#F2682A}' +
      '.cuHoja input.cifras{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' +
        'font-size:27px;letter-spacing:.34em;text-align:center;padding:14px 10px}' +
      '.cuBtn{width:100%;border:0;border-radius:10px;background:#F2682A;color:#fff;' +
        'font-family:Oswald,sans-serif;font-weight:600;letter-spacing:.04em;' +
        'text-transform:uppercase;font-size:14px;padding:13px 18px;cursor:pointer}' +
      '.cuBtn:hover{background:#C9501A}' +
      '.cuBtn:disabled{background:#E6DFD6;color:#A9A096;cursor:default}' +
      '.cuBtn.plano{background:#fff;color:#1E1A16;border:1px solid #E6DFD6;margin-top:8px}' +
      '.cuBtn.plano:hover{background:#F4EFE8}' +
      '.cuBtn.google{background:#fff;color:#1E1A16;border:1px solid #E6DFD6;' +
        'display:flex;align-items:center;justify-content:center;gap:10px;text-transform:none;' +
        'font-family:Inter,sans-serif;font-weight:600;font-size:15px;letter-spacing:0}' +
      '.cuBtn.google:hover{background:#F4EFE8}' +
      '.cuO{display:flex;align-items:center;gap:12px;margin:16px 0;color:#A9A096;' +
        'font-size:12px;text-transform:uppercase;letter-spacing:.1em;' +
        'font-family:Oswald,sans-serif}' +
      '.cuO:before,.cuO:after{content:"";flex:1;height:1px;background:#E6DFD6}' +
      '.cuErr{display:none;background:#F6E1DD;color:#9E3B2E;border-radius:9px;' +
        'padding:10px 13px;font-size:13px;line-height:1.5;margin:0 0 14px}' +
      '.cuPie{font-size:11.5px;color:#A9A096;line-height:1.5;margin:14px 0 0;text-align:center}' +
      '.cuLink{background:none;border:0;padding:0;color:#C9501A;font:inherit;' +
        'font-size:13px;text-decoration:underline;cursor:pointer}';
    document.head.appendChild(s);
  }

  var GOOGLE_SVG =
    '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.6c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.2 6.6-10.3 6.6-16.9z"/>' +
    '<path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.8-6.1z"/>' +
    '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2 1.4-4.8 2.4-8.3 2.4-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

  /* ---------- lo que sabemos de la sesión ---------- */
  async function sesion() {
    try { return (await cli().auth.getSession()).data.session || null; } catch (_) { return null; }
  }
  /* Las cabeceras para hablar con la base. Si hay sesión manda su token; si no,
     la llave pública, que es lo que ve cualquiera que llega de la calle. */
  async function hdr() {
    var s = await sesion();
    return {
      'apikey': KEY,
      'Authorization': 'Bearer ' + ((s && s.access_token) || PRESTADA || KEY),
      'Content-Type': 'application/json',
    };
  }

  /* La ficha del cliente. La crea la base la primera vez que entra. */
  async function fichaje(extra) {
    var h = await hdr();
    var r = await fetch(SB + '/rest/v1/rpc/sinc_soy_cliente', {
      method: 'POST', headers: h, body: JSON.stringify(extra || {}),
    });
    var t = await r.text(), j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || 'No pudimos abrir tu ficha');
    YO = j;
    return j;
  }

  /* Si ya hay sesión de antes, se recupera sin molestar a nadie. */
  async function yaEntrado() {
    var s = await sesion();
    if (!s) return null;
    try { return await fichaje({}); } catch (_) { return null; }
  }

  async function salir() {
    YO = null;
    /* Quien sale, sale: tampoco se le vuelve a reconocer por la sesion del
       panel que tenga abierta al lado. */
    PRESTADA = null;
    try { localStorage.removeItem('sinc_resv_sesion'); } catch (_) {}
    /* Los pax de la reserva se van con la sesión: son de ESE huésped. Si se
       quedaran, el siguiente que entrara en el mismo teléfono -el de recepción,
       el de una compañera- heredaría su tope. */
    try { localStorage.removeItem('sinc_resv_pax'); } catch (_) {}
    try { await cli().auth.signOut(); } catch (_) {}
  }

  /* Cuántas personas duermen en la reserva de quien está entrado, si entró por
     la liga de su hotel. Null cuando no lo sabemos -entró con su correo, o con
     Google-, y entonces no hay tope que aplicar: mejor sin tope que con uno
     inventado. */
  function paxReserva() {
    var v = null;
    try { v = Number(localStorage.getItem('sinc_resv_pax') || '') || null; } catch (_) {}
    return v && v > 0 ? v : null;
  }

  async function fn(nombre, cuerpo, conSesion) {
    var h = conSesion ? await hdr()
                      : { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };
    var r = await fetch(SB + '/functions/v1/' + nombre, {
      method: 'POST', headers: h, body: JSON.stringify(cuerpo || {}),
    });
    var t = await r.text(), j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) throw new Error((j && j.error) || ('Respondió ' + r.status));
    return j;
  }

  /* ---------- el pop-up ---------- */
  /* Devuelve la ficha del cliente, o null si cierra sin entrar. */
  function entra(opts) {
    opts = opts || {};
    estilos();
    return new Promise(function (listo) {
      var capa = document.createElement('div');
      capa.className = 'cuCapa';
      capa.innerHTML = '<div class="cuHoja" id="cuHoja"></div>';
      document.body.appendChild(capa);
      capa.onclick = function (e) { if (e.target === capa) { cierra(); listo(null); } };
      function cierra() { if (capa.parentNode) document.body.removeChild(capa); }
      function $(i) { return document.getElementById(i); }
      function err(t) { var e = $('cuErr'); if (!e) return; e.textContent = t; e.style.display = t ? 'block' : 'none'; }

      var correo = '';
      /* A quien ya entro por una puerta de la casa no se le mandan seis cifras:
         su correo ya esta verificado por esa sesion. Solo se le pregunta el
         nombre si no lo tenemos. Javi, 10-oct-2026. */
      if (opts.soloNombre) paso3(); else paso1();

      /* ---- quién eres ---- */
      function paso1() {
        $('cuHoja').innerHTML =
          '<h2>' + esc(opts.titulo || T('Entra para reservar')) + '</h2>' +
          '<p>' + esc(opts.dice || T('Tu boleto lleva un QR y te llega por correo: por eso necesitamos saber que el correo es tuyo de verdad. Es una vez y ya.')) + '</p>' +
          '<div class="cuErr" id="cuErr"></div>' +
          '<button class="cuBtn google" id="cuGoogle">' + GOOGLE_SVG + ' ' + esc(T('Continuar con Google')) + '</button>' +
          '<div class="cuO">' + esc(T('o con tu correo')) + '</div>' +
          '<label for="cuMail">' + esc(T('Tu correo')) + '</label>' +
          '<input id="cuMail" type="email" inputmode="email" autocomplete="email" ' +
            'placeholder="tu@correo.com" value="' + esc(correo) + '">' +
          '<button class="cuBtn" id="cuManda">' + esc(T('Mandarme un código')) + '</button>' +
          '<button class="cuBtn plano" id="cuNo">' + esc(T('Ahora no')) + '</button>' +
          '<p class="cuPie">' + esc(T('Con Google no hay que confirmar nada: tu correo ya viene verificado.')) + '</p>';

        $('cuNo').onclick = function () { cierra(); listo(null); };
        $('cuMail').focus();
        $('cuMail').onkeydown = function (e) { if (e.key === 'Enter') $('cuManda').click(); };

        $('cuGoogle').onclick = async function () {
          err('');
          this.disabled = true;
          try {
            var r = await cli().auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: aDondeVuelve(opts.volverA) },
            });
            if (r.error) throw r.error;
          } catch (x) {
            this.disabled = false;
            err(T('Entrar con Google todavía no está encendido. Usa tu correo, que funciona igual.'));
            console.error('google', x);
          }
        };

        $('cuManda').onclick = async function () {
          err('');
          var m = $('cuMail').value.trim();
          if (m.indexOf('@') < 1 || m.indexOf('.') < 0) { err(T('Ese correo no se ve bien escrito.')); return; }
          this.disabled = true; this.textContent = T('Mandando…');
          try {
            var j = await fn('sinc-identidad', { accion: 'enviar', email: m });
            correo = m;
            paso2(j && j.enviado_a);
          } catch (x) {
            this.disabled = false; this.textContent = T('Mandarme un código');
            err(String(x.message || x));
          }
        };
      }

      /* ---- las seis cifras ---- */
      function paso2(tapado) {
        $('cuHoja').innerHTML =
          '<h2>' + esc(T('Mira tu correo')) + '</h2>' +
          '<p>' + esc(T('Mandamos seis cifras a')) + ' <b>' + esc(tapado || correo) + '</b>. ' +
            esc(T('Vale diez minutos. Si no lo ves, asómate a la carpeta de spam.')) + '</p>' +
          '<div class="cuErr" id="cuErr"></div>' +
          '<label for="cuCod">' + esc(T('El código')) + '</label>' +
          '<input id="cuCod" class="cifras" inputmode="numeric" autocomplete="one-time-code" ' +
            'maxlength="6" placeholder="······">' +
          '<button class="cuBtn" id="cuVer">' + esc(T('Confirmar')) + '</button>' +
          '<button class="cuBtn plano" id="cuOtro">' + esc(T('Usar otro correo')) + '</button>' +
          '<p class="cuPie"><button class="cuLink" id="cuRe">' + esc(T('Mandármelo otra vez')) + '</button></p>';

        var c = $('cuCod');
        c.focus();
        c.oninput = function () {
          this.value = this.value.replace(/\D/g, '').slice(0, 6);
          if (this.value.length === 6) $('cuVer').click();
        };
        c.onkeydown = function (e) { if (e.key === 'Enter') $('cuVer').click(); };
        $('cuOtro').onclick = paso1;
        $('cuRe').onclick = async function () {
          err('');
          this.textContent = T('Mandando…');
          try { await fn('sinc-identidad', { accion: 'enviar', email: correo }); this.textContent = T('Va de nuevo ✓'); }
          catch (x) { this.textContent = T('Mandármelo otra vez'); err(String(x.message || x)); }
        };

        $('cuVer').onclick = async function () {
          err('');
          var cod = c.value.replace(/\D/g, '');
          if (cod.length !== 6) { err(T('El código son seis cifras.')); return; }
          this.disabled = true; this.textContent = T('Comprobando…');
          var b = this;
          try {
            var j = await fn('sinc-identidad', { accion: 'verificar', email: correo, codigo: cod });
            /* El pase de entrada se cambia por una sesión de verdad. Supabase ha
               llamado 'email' y 'magiclink' a lo mismo según la versión, así que
               se prueban los dos antes de darlo por perdido. */
            var s = await cli().auth.verifyOtp({ token_hash: j.token_hash, type: 'email' });
            if (s.error) s = await cli().auth.verifyOtp({ token_hash: j.token_hash, type: 'magiclink' });
            if (s.error) throw s.error;
            var yo = await fichaje({});
            if (!yo || !String(yo.nombre || '').trim()) { paso3(); return; }
            cierra(); listo(yo);
          } catch (x) {
            b.disabled = false; b.textContent = T('Confirmar');
            c.value = ''; c.focus();
            err(String(x.message || x));
          }
        };
      }

      /* ---- cómo te llamas (solo la primera vez) ---- */
      function paso3() {
        $('cuHoja').innerHTML =
          '<h2>' + esc(T('¿A nombre de quién?')) + '</h2>' +
          '<p>' + esc(T('Es lo que verá quien te reciba el día del tour.')) + '</p>' +
          '<div class="cuErr" id="cuErr"></div>' +
          '<label for="cuNom">' + esc(T('Nombre y apellido')) + '</label>' +
          '<input id="cuNom" autocomplete="name" placeholder="' + esc(T('Nombre y apellido')) + '">' +
          '<label for="cuTel">WhatsApp <span style="text-transform:none;letter-spacing:0">' + esc(T('(por si hay que avisarte algo)')) + '</span></label>' +
          '<input id="cuTel" type="tel" autocomplete="tel" placeholder="+52 55 …">' +
          '<button class="cuBtn" id="cuGuarda">' + esc(T('Listo')) + '</button>';
        $('cuNom').focus();
        $('cuNom').onkeydown = function (e) { if (e.key === 'Enter') $('cuGuarda').click(); };
        $('cuGuarda').onclick = async function () {
          err('');
          var n = $('cuNom').value.trim();
          if (n.length < 2) { err(T('Dinos cómo te llamas.')); return; }
          this.disabled = true; this.textContent = T('Un momento…');
          try {
            var yo = await fichaje({ p_nombre: n, p_telefono: $('cuTel').value.trim() || null });
            cierra(); listo(yo);
          } catch (x) {
            this.disabled = false; this.textContent = T('Listo');
            err(String(x.message || x));
          }
        };
      }
    });
  }

  /* La pantalla de la cuenta. Antes esto era un confirm() que dependía de la
     ficha en memoria, y si todavía no había llegado le volvía a pedir entrar a
     alguien que ya estaba dentro. Ahora primero se comprueba la sesión de
     verdad, y solo se pide entrar a quien no la tiene. */
  async function miPerfil() {
    var yo = YO || await yaEntrado();
    if (!yo) {
      return await entra({ titulo: T('Tu cuenta'),
        dice: T('Con una cuenta guardas tus boletos y no vuelves a escribir tus datos en cada compra.') });
    }
    estilos();
    return new Promise(function (listo) {
      var capa = document.createElement('div');
      capa.className = 'cuCapa';
      capa.innerHTML = '<div class="cuHoja" id="cuHoja"></div>';
      document.body.appendChild(capa);
      capa.onclick = function (e) { if (e.target === capa) { cierra(); listo(yo); } };
      function cierra() { if (capa.parentNode) document.body.removeChild(capa); }

      var de = { google: T('Entraste con Google'), hotel: T('Entraste desde tu reserva de Casa Pepe'),
                 correo: T('Entraste con tu correo') }[yo.origen] || '';
      document.getElementById('cuHoja').innerHTML =
        '<h2>' + esc(yo.nombre || T('Tu cuenta')) + '</h2>' +
        '<p>' + esc(yo.email) + (de ? '<br>' + esc(de) : '') + '</p>' +
        '<div class="cuErr" id="cuErr"></div>' +
        '<a class="cuBtn" style="display:block;text-align:center;text-decoration:none" ' +
          'href="/boleto">' + esc(T('Mis boletos')) + '</a>' +
        '<button class="cuBtn plano" id="cuEdita">' + esc(T('Cambiar mi nombre o teléfono')) + '</button>' +
        '<button class="cuBtn plano" id="cuSalir">' + esc(T('Cerrar sesión')) + '</button>' +
        '<p class="cuPie">' + esc(T('Tus boletos viajan a este correo. Si te equivocaste, cierra sesión y entra con el bueno.')) + '</p>';

      document.getElementById('cuEdita').onclick = function () {
        document.getElementById('cuHoja').innerHTML =
          '<h2>' + esc(T('Tus datos')) + '</h2><p>' + esc(T('Es lo que verá quien te reciba el día del tour.')) + '</p>' +
          '<div class="cuErr" id="cuErr"></div>' +
          '<label for="cuNom">' + esc(T('Nombre y apellido')) + '</label>' +
          '<input id="cuNom" autocomplete="name" value="' + esc(yo.nombre || '') + '">' +
          '<label for="cuTel">WhatsApp</label>' +
          '<input id="cuTel" type="tel" autocomplete="tel" value="' + esc(yo.telefono || '') + '">' +
          '<button class="cuBtn" id="cuOk">' + esc(T('Guardar')) + '</button>';
        document.getElementById('cuOk').onclick = async function () {
          this.disabled = true; this.textContent = T('Guardando…');
          try {
            yo = await fichaje({ p_nombre: document.getElementById('cuNom').value.trim() || null,
                                 p_telefono: document.getElementById('cuTel').value.trim() || null });
            cierra(); listo(yo);
          } catch (x) {
            this.disabled = false; this.textContent = T('Guardar');
            var e = document.getElementById('cuErr');
            e.textContent = String(x.message || x); e.style.display = 'block';
          }
        };
      };

      document.getElementById('cuSalir').onclick = async function () {
        await salir();
        cierra(); listo(null);
      };
    });
  }

  /* Lo normal: si ya entró, sigue; si no, se le pide. Devuelve la ficha o null. */
  /* El huésped que llega con la liga de su reserva no teclea nada: la liga ya
     dice quién es. Si falla —liga vieja, reserva sin correo— se cae al camino
     normal sin decir nada raro. */
  async function comoHuesped() {
    var t = (new URLSearchParams(location.search).get('resv') || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(t)) return null;
    try { if (sessionStorage.getItem('sinc_resv_no') === t) return null; } catch (_) {}
    try {
      var j = await fn('sinc-identidad', { accion: 'huesped', token: t });
      var s = await cli().auth.verifyOtp({ token_hash: j.token_hash, type: 'email' });
      if (s.error) s = await cli().auth.verifyOtp({ token_hash: j.token_hash, type: 'magiclink' });
      if (s.error) throw s.error;
      var ficha = await fichaje({ p_nombre: j.nombre || null, p_telefono: j.telefono || null,
                                  p_hotel: j.hotel_id || null, p_origen: 'hotel' });
      /* De qué liga salió esta sesión. Es lo que luego permite saber si la que
         hay abierta es la del huésped que trae la liga o la de otro. */
      try { localStorage.setItem('sinc_resv_sesion', t); } catch (_) {}
      /* Y cuántos duermen en esa reserva. Lo usa el checkout de los tours de
         entrada libre para no dejar apartar más lugares de los que son.
         Se guarda aquí porque la liga trae el token y las pantallas de después
         ya no: pago.html no recibe ?resv, pero sí sigue en el mismo navegador.
         Javi, 11-oct-2026. */
      try {
        if (j && Number(j.pax) > 0) localStorage.setItem('sinc_resv_pax', String(Number(j.pax)));
        else localStorage.removeItem('sinc_resv_pax');
      } catch (_) {}
      return ficha;
    } catch (x) {
      /* Que no lo vuelva a intentar en cada pantalla de la sesión. */
      try { sessionStorage.setItem('sinc_resv_no', t); } catch (_) {}
      return null;
    }
  }

  /* QUIÉN ES EL DE ESTA PANTALLA.
     Había dos identidades sueltas a la vez: la reserva, que viene en la liga, y
     la cuenta de Sincrético, que vive en el navegador. Como se miraba primero la
     cuenta, en un teléfono donde alguien dejó la suya abierta -el de recepción,
     el de una compañera- a cada huésped le salían los boletos de esa persona
     debajo de su propia reserva. Y peor: habría reservado un tour a nombre de
     ella.
     Con liga delante manda la liga: si la sesión abierta no nació de esta misma
     liga, se cierra y se entra como el huésped que la trae. Sin liga (el público
     del Pepe GO!) todo sigue igual que siempre. */
  /* UNA LIGA QUE NO IDENTIFICA A NADIE NO ECHA A NADIE.
     Javi, 10-oct-2026: «no me lee el usuario», con la pantalla de Lo Tuyo al
     lado diciendo «no pudimos traer tu reserva ahora mismo». Ahi estaba todo:
     APePe guarda el ?resv= del QR del hotel en el telefono y se lo cuelga a
     cada enlace, para siempre. Cuando esa reserva ya caduco, el token sigue
     viajando pero no identifica a nadie — y este codigo cerraba la sesion
     ANTES de comprobarlo. Resultado: a quien si estaba identificado lo echaba,
     y despues no podia entrar a nadie, asi que le pedia las seis cifras otra
     vez.
     Ahora se prueba primero la liga y solo se cede el sitio si de verdad trae
     a alguien. Si la liga esta muerta, se queda quien ya estaba. El candado
     del telefono de recepcion sigue igual: con una liga VIVA, manda la liga. */
  var LIGA_VIVA = null;
  async function yoDeEstaLiga() {
    var t = '';
    try { t = (new URLSearchParams(location.search).get('resv') || '').trim(); } catch (_) {}
    if (!/^[0-9a-f-]{36}$/i.test(t)) return await yaEntrado();
    var deQuien = ''; try { deQuien = localStorage.getItem('sinc_resv_sesion') || ''; } catch (_) {}
    var yo = await yaEntrado();
    if (yo && deQuien === t) { LIGA_VIVA = true; return yo; }
    /* comoHuesped() solo cambia la sesion si el canje sale bien; si falla, la
       que habia se queda intacta. Por eso se puede probar antes de cerrar. */
    var delaLiga = await comoHuesped();
    LIGA_VIVA = !!delaLiga;
    if (delaLiga) return delaLiga;
    return yo;
  }

  /* UNA SESION QUE YA HAY ABIERTA EN ESTE NAVEGADOR.
     Javi, 10-oct-2026: «haz un filtro de que si el usuario es huesped o
     ateneista etc y ya tiene nombre y mail no necesita validar con codigo;
     solo aplica eso para quienes entran por puertas abiertas al publico sin
     login». Y tenia razon: el probo la compra estando dentro del panel con su
     correo, y le mandamos seis cifras igual. La sesion del huesped se guarda
     con llave propia (sinc-huesped-auth) para no pisar la del trabajo, asi que
     la del panel estaba ahi al lado sin que nadie la mirara.
     Aqui se mira: cualquier sesion de Supabase viva en este navegador con
     correo ya verificado sirve para abrir su ficha de cliente sin codigo. Si
     esa ficha no tiene nombre, se le pregunta solo el nombre. */
  function tokenPrestado() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
        var raw = localStorage.getItem(k) || '';
        if (raw.indexOf('base64-') === 0) raw = atob(raw.slice(7));
        var v = JSON.parse(raw), ses = v.currentSession || v.session || v;
        if (!ses || !ses.access_token || !ses.user || !ses.user.email) continue;
        if (ses.expires_at && Number(ses.expires_at) * 1000 < Date.now() + 30000) continue;
        return { token: ses.access_token, email: ses.user.email };
      }
    } catch (_) {}
    return null;
  }

  async function conSesionAbierta() {
    /* Con una liga de reserva VIVA delante manda la liga: en el telefono de
       recepcion no se compra a nombre de quien dejo su sesion abierta. Una
       liga muerta —la de APePe con la reserva ya pasada— no cuenta. */
    if (LIGA_VIVA === true) return null;
    var p = tokenPrestado();
    if (!p) return null;
    try {
      var r = await fetch(SB + '/rest/v1/rpc/sinc_soy_cliente', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + p.token, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) return null;
      var j = await r.json();
      if (!j || !j.email) return null;
      PRESTADA = p.token;
      YO = j;
      return j;
    } catch (_) { return null; }
  }

  async function exige(opts) {
    var yo = await yoDeEstaLiga();
    if (yo) return yo;
    yo = await conSesionAbierta();
    if (yo) {
      if (String(yo.nombre || '').trim()) return yo;
      /* Correo verificado pero sin nombre: solo falta como se llama. */
      return await entra(Object.assign({}, opts || {}, { soloNombre: true }));
    }
    return await entra(opts);
  }

  return {
    cliente: cli, sesion: sesion, hdr: hdr, yo: function () { return YO; },
    yaEntrado: yaEntrado, entra: entra, exige: exige, salir: salir, fn: fn,
    miPerfil: miPerfil, comoHuesped: comoHuesped, yoDeEstaLiga: yoDeEstaLiga, recoge: recoge,
    conSesionAbierta: conSesionAbierta, paxReserva: paxReserva,
  };
})();

/* En cuanto carga: si la sesión viene en la URL, se recoge aquí mismo. Ninguna
   pantalla tiene que acordarse de hacerlo. */
try { sincCuenta.recoge(); } catch (_) {}
