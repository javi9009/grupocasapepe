/* Soy Pepe · /sp/ — SERVICE WORKER DE DESPEDIDA.

   Durante meses hubo DOS Soy Pepe instalables: ésta, en /sp/, y la de
   /soypepe/. Para el teléfono eran dos apps distintas -su propio manifest, su
   propio icono, su propio service worker-, así que quien se instaló ésta se
   quedó congelado en la versión de aquel día: no veía un solo cambio nuestro
   por muchas veces que publicáramos. Pasó con Bren y las comidas, y el 25 de
   noviembre de 2026 con el Soy Pepe de Deisy y el de Azucena, que seguían con
   los iconos de antes. Parchear las dos cada vez no se sostiene: la segunda
   siempre envejece.

   Así que este service worker ya no sirve la app: la entierra. Borra su caché,
   se desregistra a sí mismo y manda las ventanas abiertas a /soypepe/, que es
   la única que se mantiene. Javi, 25-nov-2026. */

const CACHE_VIEJA = 'soypepe-v3';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    /* Sólo la caché de esta app. Las cachés son del dominio entero, no de
       /sp/, y barrerlas todas se llevaría por delante la de /soypepe/. */
    try { await caches.delete(CACHE_VIEJA); } catch (_e) {}
    try { await self.registration.unregister(); } catch (_e) {}
    try {
      const lista = await self.clients.matchAll({ type: 'window' });
      for (const c of lista) { try { await c.navigate('/soypepe/'); } catch (_e) {} }
    } catch (_e) {}
  })());
});

/* Sin fetch: desde aquí ya no se contesta a nada, todo va directo a la red.
   Y sin push: los avisos del teléfono viven ahora en el de /soypepe/, que es
   donde se vuelven a dar de alta solos al entrar. */
