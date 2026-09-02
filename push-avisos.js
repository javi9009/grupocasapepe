/* push-avisos.js — Grupo Casa Pepe
 *
 * Da de alta el teléfono del colaborador para recibir avisos (Web Push):
 * mensajes, inicio de jornada, tareas asignadas, nómina, vacaciones… todo lo
 * que entra a la tabla `notificaciones` o al chat.
 *
 * ── Cómo se usa ───────────────────────────────────────────────────────
 *   cpPush.init(sb, { email, employeeId, userId })   // al iniciar sesión
 *   cpPush.activar()   -> Promise<{ok, motivo}>      // desde un BOTÓN
 *   cpPush.estado()    -> 'listo' | 'pedir' | 'bloqueado' | 'no-soportado'
 *                       | 'ios-sin-instalar'
 *
 * ── Reglas ────────────────────────────────────────────────────────────
 * · El permiso SOLO se pide tras un toque del usuario. Si se pide de golpe
 *   al cargar, mucha gente lo bloquea y luego cuesta revertirlo.
 * · Si el permiso YA estaba dado, se re-suscribe solo, sin preguntar nada:
 *   así vuelven los avisos a quien ya dijo que sí alguna vez.
 * · iOS solo entrega push con la PWA instalada en la pantalla de inicio
 *   (iOS 16.4+). En Safari normal no llega nada; por eso lo detectamos.
 */
(function (global) {
  'use strict';

  var CLAVE_PUBLICA = 'BE1A8YAVdUnW0_y7zFiURL0As5fTFkbYy2Z0A30KnOOYQI5w4MF-LLUGk5saVuscA0991BGXKiM57BHshQQdKFQ';

  var sb = null, email = '', employeeId = null, userId = null;

  var soportado = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  var esIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  function b64ToU8(base64) {
    var pad = '='.repeat((4 - (base64.length % 4)) % 4);
    var b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function estado() {
    if (!soportado) return 'no-soportado';
    if (esIOS && !instalada) return 'ios-sin-instalar';
    if (Notification.permission === 'granted') return 'listo';
    if (Notification.permission === 'denied') return 'bloqueado';
    return 'pedir';
  }

  /* Guarda (o revive) la suscripción de este teléfono. Una fila por endpoint. */
  async function guardar(sub) {
    if (!sb) return false;
    var j = sub.toJSON ? sub.toJSON() : sub;
    var fila = {
      email: email || null,
      employee_id: employeeId || null,
      user_id: userId || null,
      endpoint: j.endpoint,
      p256dh: j.keys && j.keys.p256dh,
      auth: j.keys && j.keys.auth,
      ua: navigator.userAgent,
      activo: true,
      updated_at: new Date().toISOString()
    };
    try {
      // Si el endpoint ya estaba, lo reactivamos; si no, lo damos de alta.
      var r = await sb.from('push_subscriptions').select('id').eq('endpoint', j.endpoint).limit(1);
      if (r.data && r.data.length) {
        await sb.from('push_subscriptions').update(fila).eq('id', r.data[0].id);
      } else {
        await sb.from('push_subscriptions').insert(fila);
      }
      return true;
    } catch (e) { return false; }
  }

  async function suscribir() {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(CLAVE_PUBLICA)
      });
    }
    var ok = await guardar(sub);
    return { ok: ok, motivo: ok ? '' : 'no se pudo guardar la suscripción' };
  }

  /* Desde un botón: pide permiso y suscribe. */
  async function activar() {
    var e = estado();
    if (e === 'no-soportado') return { ok: false, motivo: 'Este navegador no admite avisos.' };
    if (e === 'ios-sin-instalar') return { ok: false, motivo: 'En iPhone hay que instalar la app: Compartir → Añadir a pantalla de inicio.' };
    if (e === 'bloqueado') return { ok: false, motivo: 'Los avisos están bloqueados en los ajustes del navegador para esta app.' };
    try {
      var permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return { ok: false, motivo: 'No diste permiso.' };
      return await suscribir();
    } catch (err) { return { ok: false, motivo: String(err) }; }
  }

  /* Al iniciar sesión: si ya había permiso, revive la suscripción en silencio. */
  function init(cliente, datos) {
    sb = cliente || null;
    datos = datos || {};
    email = (datos.email || '').toLowerCase();
    employeeId = datos.employeeId || null;
    userId = datos.userId || null;
    if (!soportado) return;
    if (Notification.permission !== 'granted') return;
    if (esIOS && !instalada) return;
    setTimeout(function () { suscribir().catch(function () {}); }, 1200);
  }

  global.cpPush = { init: init, activar: activar, estado: estado };
})(window);
