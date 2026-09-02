/* Hola, Soy Pepe — Service Worker (PWA shell)
 * Estrategia: network-first para no servir datos viejos; cae al caché offline.
 * Cachea el cascarón (shell) para que la PWA sea instalable y abra sin conexión.
 */
const CACHE = 'soypepe-shell-v20';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Solo GET; deja pasar todo lo demás (auth, edge functions, etc.).
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // No interceptes llamadas a Supabase / CDNs externos: deben ir siempre a la red.
  if (url.origin !== self.location.origin) return;

  // Network-first: intenta la red, cachea la respuesta fresca, cae al caché offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});

/* ── Avisos al teléfono (Web Push) ──────────────────────────────────────
   El servidor manda {title, body, icon, url, tag, badge}. Aquí se pinta
   la notificación aunque la app esté cerrada: suena y vibra según cómo
   tenga el teléfono configurada la app. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_e) { d = { body: e.data && e.data.text ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    if (typeof d.badge === 'number') {
      try {
        if (d.badge > 0) await navigator.setAppBadge(d.badge);
        else await navigator.clearAppBadge();
      } catch (_e) { /* navegador sin Badging API: el aviso igual se muestra */ }
    }
    await self.registration.showNotification(d.title || 'Casa Pepe', {
      body: d.body || '',
      icon: d.icon || '/soypepe/icon-192.png',
      badge: '/soypepe/icon-192.png',
      tag: d.tag || 'casapepe',
      renotify: true,
      vibrate: [200, 100, 200, 100, 300],
      data: { url: d.url || '/soypepe/' }
    });
  })());
});

/* Al tocar el aviso: si la app ya está abierta se trae al frente y se
   lleva a la pantalla que toca; si no, se abre. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || '/soypepe/';
  e.waitUntil((async () => {
    const lista = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of lista) {
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        try { await c.navigate(destino); } catch (_e) {}
        return c.focus();
      }
    }
    return clients.openWindow(destino);
  })());
});
