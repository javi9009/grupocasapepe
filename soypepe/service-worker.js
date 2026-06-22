/* Hola, Soy Pepe — Service Worker (PWA shell)
 * Estrategia: network-first para no servir datos viejos; cae al caché offline.
 * Cachea el cascarón (shell) para que la PWA sea instalable y abra sin conexión.
 */
const CACHE = 'soypepe-shell-v10';
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
