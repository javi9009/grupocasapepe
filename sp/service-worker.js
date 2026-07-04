/* Soy Pepe · Service Worker (scope /sp/)
   Estrategia: network-first para el HTML (la app vive en Supabase, siempre fresca),
   cache-first para iconos. Suficiente para que la PWA sea instalable y abra offline
   con el último shell conocido. */
const CACHE = 'soypepe-v1';
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
