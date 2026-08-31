# Numerito en el icono y notificaciones push — estado

**Fecha:** 2026-08-31

---

## Lo que ya funciona (subido)

`app-badge.js` pone en el icono de la app el número de pendientes:
notificaciones sin leer + conversaciones del chat con mensajes sin leer.

Se recalcula:
- al abrir la app
- al volver a ella (`visibilitychange`, `focus`)
- cada 60 segundos mientras está abierta
- al marcar notificaciones como leídas
- al abrir una conversación del chat (`markRead`)

### Para que el equipo lo vea

**Tienen que instalar la app en la pantalla de inicio.** En una pestaña
normal del navegador la Badging API no hace nada — no falla, se ignora.

- **Android/Chrome:** menú ⋮ → "Añadir a pantalla de inicio" / "Instalar app"
- **iPhone/Safari:** botón compartir → "Añadir a pantalla de inicio".
  Requiere iOS 16.4 o superior.

---

## Lo que NO funciona todavía

**Con la app cerrada el número no se actualiza.** Si a alguien le llega un
mensaje mientras no tiene la app abierta, el icono sigue mostrando el
número viejo hasta que la abra.

Esto no se puede arreglar con más JavaScript en la página: hace falta que
el celular reciba un aviso del servidor aunque la app esté cerrada. Eso es
Web Push.

---

## Lo que falta para Web Push

### 1. Claves VAPID (las tiene que generar Javi)

```bash
npx web-push generate-vapid-keys
```

Devuelve una clave pública y una privada. La pública va en el código; la
privada es secreta y va en Supabase:

```bash
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:javi@casapepe.mx
```

### 2. Tabla de suscripciones

```sql
create table push_suscripciones (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz default now()
);
alter table push_suscripciones enable row level security;
-- política: cada quien ve y borra sólo las suyas
```

### 3. Pedir permiso y suscribir (en el cliente)

Al entrar a SoyPepe, `Notification.requestPermission()` y luego
`registration.pushManager.subscribe(...)` con la clave pública. La
suscripción resultante se guarda en la tabla de arriba.

**Ojo:** el permiso hay que pedirlo tras un gesto del usuario (un botón
"Activar avisos"), no al cargar. Si se pide de golpe, muchos lo bloquean
y luego cuesta revertirlo.

### 4. Service worker: recibir el push

En `soypepe/service-worker.js` faltan dos listeners:

```js
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil((async () => {
    if (typeof d.badge === 'number') {
      try { await navigator.setAppBadge(d.badge); } catch (err) {}
    }
    await self.registration.showNotification(d.titulo || 'Casa Pepe', {
      body: d.cuerpo || '',
      icon: '/soypepe/icon-192.png',
      data: { url: d.url || '/soypepe/' }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
```

### 5. Edge Function que envía

Una función que se dispare al insertar en `chat_mensajes` o en
`notificaciones` (trigger de Postgres o Realtime), calcule el total de
pendientes de cada destinatario y le mande el push con ese número.

Va en `supabase/functions/push-enviar/`.

---

## Advertencias

- **iOS es quisquilloso.** Web Push sólo funciona con la PWA instalada,
  desde iOS 16.4. En Safari normal no llega nada.
- **Las suscripciones caducan.** Hay que borrar de la tabla las que
  devuelvan 410 Gone al enviar, o la tabla se llena de basura y cada envío
  se hace más lento.
- **Pensar antes el ruido.** Si cada mensaje de cada grupo manda push, el
  equipo va a silenciar la app en una semana. Conviene decidir qué
  merece push: ¿sólo menciones y tickets asignados? ¿mensajes directos sí
  y grupos no? Eso es una decisión de operación, no técnica.

---

## Siguiente paso

Javi genera las claves VAPID y decide qué eventos merecen push. Con eso
se puede montar el resto.
