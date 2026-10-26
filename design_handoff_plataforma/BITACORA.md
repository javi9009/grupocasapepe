# Bitácora de la Plataforma Sincrético

Una línea por tarea terminada. La pide `AGENTE.md`.

---

**2026-10-26 · F1-1 Migraciones · `ateneista_capacidades`, `v_ateneistas`, `historia`**

- `ateneista_capacidades` (experiencias · eventos · hotel · artesanía · membresía).
  **Quitar una capacidad exige motivo, por constraint, no por pantalla.** Conceder se
  entiende solo; retirar le cierra una puerta a alguien de fuera, y esa persona va a
  preguntar por qué. Si el motivo no se exige en el momento, nadie lo escribe después.
- **`v_ateneistas`: el ateneísta ES `tour_operadores`, no una tabla nueva.** Tiene 129
  columnas —identidad fiscal, pasaporte, póliza, convenio, Stripe, forma de pago— y 19
  tablas colgando de su id, entre ellas las reservas. Crear `ateneistas` al lado habría
  sido el quinto censo del mismo señor, que es justo lo que esta reforma viene a quitar.
  La vista ya enseña si además tiene ficha de productora o de hotel, cruzando por correo.
- `historia`: entidad, qué, quién, cuándo. Hoy eso está repartido en cinco pantallas.
- Backfill de lo que ya existía: **104 con experiencias, 3 con eventos, 4 con hotel.**

✔ Una persona física sin actividad no se puede guardar con RFC — comprobado en `alta_ateneista`.
✔ Quitar una capacidad sin motivo falla — `cap_retirada_con_motivo`.

---

**2026-10-26 · F1-2 El menú · área «Sincrético»**

Seis pantallas nuevas registradas como **submenús laterales** (`en_menu = true`), porque al
abrirlas cada una trae sus propios submenús arriba: Inicio · Cola de aprobación · La
comunidad · Productos · Salidas del día · Ventas.

Se movieron a Sincrético las 40 de *Experiencias*, las 12 de *Ateneo* y lo de touroperadora,
hotel y productora que vivía en *Operación* — **77 en total**. En Operación se quedaron las
18 que no son de esto: A&B, huéspedes, coworking, Vnums, room service, Room Tienda.

Permisos: Director, Gerente Administrativo y Gerente Operativo, nivel `editar`.

---

**2026-10-26 · F2-3 El alta del ateneísta · `/alta-ateneista.html` (`/ateneista`)**

Fuera del panel, a propósito: se abre desde una liga que se dicta por teléfono y se pega en
WhatsApp, en el móvil de alguien que todavía no sabe quiénes somos.

- **Siete pasos, o seis si sólo trae membresía**, porque entonces no hay nada que cobrar.
- **El anticipo sólo se ofrece a quien trae experiencias.** Los campos del cobro dividido
  —`cobro_dividido`, `pago_ahora`, `pago_resto`— sólo existen en `sinc_reservas`.
  Ofrecérselo a un evento sería prometer algo que no se puede guardar.
- **Persona física sin actividad: CURP, y el RFC ni se le enseña.** En la pantalla y en la
  base. Pedirle un campo que no puede tener deja un hueco que no sabe llenar y una barra de
  avance que lo cuenta pendiente para siempre, así que deja de medir nada.
- Comisión por defecto **10 / 10 / 5**, dicho en pantalla, editable caso por caso.
- El convenio se arma con lo capturado, con un anexo por capacidad.
- RPC `alta_ateneista(jsonb)`, `security definer`, abierta a `anon`.

`/alta` sigue apuntando a la de siempre hasta el visto bueno de Javi: esa liga está
circulando y hay gente a medio llenarla.

✔ Casos del diseño: Hiking Puebla, Jorge Ruvalcaba (CURP + cobro en destino), Lucía (solo membresía).

---

## Lo que sigue

| | |
|---|---|
| F2-4 | D1 La comunidad y D2 Ficha del ateneísta → `/m/comunidad.html` |
| F2-5 | D3 Cola de aprobación → `/m/aprobacion.html` |
| F6-23 | D5 Productos → `/m/productos.html` |
| F6-24 | D6 Salidas del día → `/m/salidas.html` |
| F1-2b | Inicio de Sincrético → `/m/sinc-inicio.html` |

## Correcciones al diseño que pidió Javi

1. El menú de seis es de **Sincrético**, no del panel: va como submenú lateral.
2. **Ajustar lo que se pisa** en el listado de la comunidad: el nombre a dos líneas y la
   pastilla de capacidad se encabalgan.
3. **Espacios no es capacidad**: sólo los crea un hotel. Confirmado.
4. El alta vive **fuera** del dashboard.
