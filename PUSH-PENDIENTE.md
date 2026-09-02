# Avisos al teléfono (Web Push) — cómo funciona

**Actualizado:** 2026-09-02 · antes este archivo describía lo que faltaba; ya está montado.

---

## Qué hace

Cuando a un colaborador le entra cualquier cosa, le suena y vibra el teléfono
aunque tenga la app cerrada: mensaje del chat, tarea asignada, contrato por
firmar, bono conseguido, respuesta de dirección en el buzón, avisos de
housekeeping, nómina, vacaciones… Todo lo que ya escribe en la tabla
`notificaciones` dispara aviso, sin tocar nada más.

Al tocar el aviso se abre SoyPepe en la pantalla que corresponde
(`accion->>'url'` de la notificación, o `/soypepe/` si no trae ninguna).

## Las cinco piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `push-avisos.js` (raíz) | cliente | Pide permiso con un botón y guarda la suscripción en `push_subscriptions`. Si el permiso ya estaba dado, re-suscribe solo al entrar. |
| Botón "Activar avisos" | `soypepe/index.html`, panel de Notificaciones | Único sitio donde se pide el permiso. Nunca al cargar. |
| `push` + `notificationclick` | `soypepe/service-worker.js` y `sp/service-worker.js` | Pintan el aviso con vibración `[200,100,200,100,300]` y el numerito del icono; al tocarlo traen la app al frente. |
| Edge Function `push-notif` | Supabase | Manda el push a todos los teléfonos vivos de esa persona y desactiva los que devuelven 410. |
| Trigger `notificaciones_push_trg` | Postgres | `AFTER INSERT` en `notificaciones` → `pg_net` → `push-notif`. Si falla, **nunca** tumba la notificación. |

El chat va por su cuenta: `m/mensajes.html` escribe **dos** cosas por mensaje
—una fila en `notificaciones` (para la campana) y una llamada a `push-chat`—.
Por eso el trigger **se salta** toda notificación cuya `accion->>'url'` empiece
por `/m/mensajes.html`: sin ese filtro cada mensaje llegaba al teléfono dos
veces. Efecto lateral asumido: "te añadieron a un grupo" no manda push, se ve
sólo en la campana.

## Avisos del ciclo de un ticket de mantenimiento

Trigger `mtto_tickets_avisos_trg` (`AFTER UPDATE on mtto_tickets`). Escribe en
`notificaciones`, así que sale por la campana **y** por el teléfono:

| Cuándo | A quién | Aviso |
|---|---|---|
| cambia `asignado_a` | al técnico nuevo (`employee_id`) | 🔧 Te asignaron un ticket |
| `estado` → `resuelto` | a quien lo reportó (`reportado_por`, que es un `user_id`) | ✅ Resolvieron tu reporte · revísalo y ciérralo |
| `estado` → `cerrado` | al técnico | 🔒 Cerraron tu ticket |

Ojo con los dos tipos de id: `asignado_a` es `employees.id` y `reportado_por`
es el `auth.users.id`. El trigger traduce el segundo vía `empleado_login`.

## Claves y secretos

- VAPID pública (va en el cliente): `BE1A8YAVdUnW0_y7zFiURL0As5fTFkbYy2Z0A30KnOOYQI5w4MF-LLUGk5saVuscA0991BGXKiM57BHshQQdKFQ`
- VAPID privada: dentro de las funciones `push-notif` y `push-chat` en Supabase. No la copies a ningún otro sitio.
- El trigger llama a la función con la cabecera `x-cpp-secret`. Si la cambias, cámbiala en los dos lados a la vez o dejan de llegar avisos.

## Lo que hay que decirle al equipo

**Hay que instalar la app en la pantalla de inicio y pulsar "Activar avisos"
una vez.** Sin esos dos pasos no llega nada.

- **Android/Chrome:** menú ⋮ → "Instalar app" / "Añadir a pantalla de inicio".
- **iPhone/Safari:** botón compartir → "Añadir a pantalla de inicio". Requiere
  iOS 16.4 o superior, y **sólo funciona desde el icono**, no desde Safari.

Después: SoyPepe → campana → "Activar avisos" → permitir.

El sonido y la vibración los manda el sistema operativo, no la web: si el
teléfono tiene la app silenciada o en modo "no molestar", el aviso llega pero
callado. Eso se arregla en los ajustes del teléfono, no aquí.

## Mantenimiento

- Las suscripciones caducan. `push-notif` marca `activo=false` en cuanto un
  endpoint devuelve 404/410, así que la tabla se limpia sola.
- Para ver si un aviso salió: `select status_code, content from net._http_response order by created desc limit 5;`
- Para ver quién tiene teléfono dado de alta: `select email, activo, created_at from push_subscriptions order by created_at desc;`

## Lo que queda por decidir (operación, no técnica)

Ahora mismo **todo** lo que entra en `notificaciones` manda push. Si el equipo
empieza a silenciar la app por ruido, el sitio donde se recorta es el trigger
`notificaciones_push()`: ahí se puede filtrar por tipo de aviso o por horario
sin tocar el resto del sistema.
