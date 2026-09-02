/* Soy Pepe · Service Worker (scope /sp/)
   Estrategia: network-first para el HTML (la app vive en Supabase, siempre fresca),
   cache-first para iconos. Suficiente para que la PWA sea instalable y abra offline
   con el último shell conocido. */
const CACHE = 'soypepe-v2';
const ICONS = ['/soypepe/icon-192.png', '/soypepe/icon-512.png', '/soypepe/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ICONS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y externos: directo a red
  if (e.request.mode === 'navigate' || url.pathname === '/sp/' || url.pathname === '/sp/index.html') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match('/sp/')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((m) => m || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }))
  );
});

/* ── Avisos al teléfono (Web Push) — mismo comportamiento que /soypepe/ ── */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_e) { d = {}; }
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
      data: { url: d.url || '/sp/' }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || '/sp/';
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
