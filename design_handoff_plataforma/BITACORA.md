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

**2026-10-26 · F2-4 La comunidad · `/m/comunidad.html`**

Una sola pantalla donde antes había tres listados que decían casi lo mismo —Touroperadores,
Productoras y parte de Hoteles asociados—. Por existir por separado, Barrio Hostel acabó dado
de alta tres veces y Café Cumbre dos.

- D1 listado con contadores reales, cuatro filtros y pastillas de capacidad con su cuenta.
- D2 ficha con ocho pestañas, **todas editables desde el panel**: lo que el ateneísta puede
  escribir en su portal, el equipo lo puede cambiar aquí, y queda anotado quién lo capturó.
- **Revocar una capacidad pide motivo** antes de guardarla, igual que el `check` de la base.
  La pantalla no reinventa la regla: la repite.
- **El nombre y las pastillas no se pisan**, que era la corrección 2 de Javi: el nombre manda
  en su línea con `min-width:0`, las pastillas van debajo en la suya.

---

**2026-10-26 · F2-5 La cola de aprobación · `/m/aprobacion.html`**

La pantalla más importante del panel: el ateneísta crea lo que quiera, pero nada sale a la
venta sin que alguien de la casa lo mire. Si la cola se atasca, la plataforma se para.

- Tres cosas que se deciden —experiencias `en_revision`, eventos `propuesto`, altas
  `en_revision`— y una cuarta que **no es una decisión**: las fichas sin términos escritos,
  que son tarea de la casa y por eso no llevan botón de aprobar.
- **Lo que lleva más de 48 h esperando sale en rojo.**
- **Rechazar pide motivo** (mínimo cuatro letras). Un «no» sin razón obliga a adivinar y
  vuelve dos veces.
- **No se publica a quien no puede cobrar sin avisar**: antes de aprobar se mira el candado
  del dueño —el mismo que mira la base— y si bloquea, se pregunta. Publicar a alguien sin
  Stripe es vender boletos que nadie puede cobrar; ya pasó con tres productoras.
- Todo deja rastro en `historia`.

---

**2026-10-26 · F6-23 y F6-24 · `/m/productos.html` y `/m/salidas.html`**

- **Productos**: todo lo que vive en `op_experiencias` —tours, transportes y eventos, propios
  y de terceros— en un solo listado. El formato es una pastilla, no una pantalla aparte. Cada
  ficha enseña **lo que le falta** para poder venderse, con las mismas palabras que ve su dueño.
- **Salidas del día**: una fila por salida con hora, guía, cupo y lo que llega sin pagar; al
  abrirla, los nombres. **El día se elige, no se adivina**: arranca en hoy, pero manda el
  selector, porque la recepción perdía las llegadas de la mañana siguiente por mirar siempre
  «hoy».

---

**2026-10-26 · F1-2b Inicio de Sincrético · `/m/sinc-inicio.html`**

No es un tablero de indicadores: es la lista de lo que hay que hacer hoy, en orden de urgencia
real. Cada número lleva a la pantalla donde se arregla.

**Cada cuadro se pide por su cuenta y falla por su cuenta.** Que no se pueda leer la cola no
debe dejar en blanco las salidas de hoy, y un cuadro que no se pudo leer lo dice con su motivo
en vez de enseñar un cero. Cero y error no se ven igual: es la lección de la venta de Jorge
Ruvalcaba, que parecía perdida y sólo estaba detrás de una consulta rota.

---

**2026-10-26 · La puerta · `/acceso.html` (`/acceso`, `/login`, `/entrada`)**

Una sola pantalla de login para todo el que forma parte del proyecto: correo, contraseña,
recuperar y alta, con el logotipo de Sincrético y el botón para pasar a Casa Pepe.

**No se pregunta «qué eres».** La respuesta ya la tenemos: después de entrar se mira
`es_equipo_casa()`, luego `tour_operadores` y luego `hoteles` —RLS ya filtra a lo suyo— y cada
quien cae en su portal. Preguntarlo es lo que crea duplicados. El único que elige puerta es el
que todavía no existe, y ese se va al alta.

Volviendo del correo de recuperación **primero se guarda la contraseña nueva y luego se entra**:
si no, el enlace se gasta y la próxima vez vuelve a no poder.

---

**2026-10-26 · El menú: todo lo de Sincrético bajo Sincrético**

Las seis pantallas nuevas salían **en la raíz del menú**, entre Panel y RH, porque se dieron de
alta sin `parent_codigo`. Y tres de ellas daban *Page not found*: estaban anunciadas en el menú
antes de que el archivo existiera. El menú promete y el archivo cumple; si se da de alta la
fila primero, el menú miente.

- Nuevo contenedor raíz **`MENU2-SINC` «Sincrético»**, con Inicio · Cola de aprobación ·
  La comunidad · Productos · Salidas del día · Ventas, y debajo Ateneo, Hoteles y ⋯ Otros.
- **Retiradas por redundantes** (el archivo sigue ahí, sólo sale del menú, y el nombre dice
  quién hace ahora su trabajo): Ficha de alta de empresa y Ficha de productoras → La comunidad;
  Salidas · reservas y estados → Salidas del día; Eventos · aprobar y publicar → Cola de
  aprobación; Funnel de captación → La comunidad; Ventas Experiencias → Ventas; y las cuatro
  «dentro de la ficha» (Ficha del producto, Guía del Guía, Costeo, Ficha de venta).
- **Tres entradas apuntaban a archivos que no existen** y daban 404: `sinc-stats.html`,
  `sinc-cosmica-editor.html` y `demo-cosmica.html`. La de La Cósmica se apuntó al archivo que
  sí existe (`/m/sinc-cosmica.html`); las otras dos, apagadas.
- Los permisos de cada pantalla retirada se copiaron a la que la sustituye: nadie pierde acceso
  por la mudanza.
- Se auditaron **las 109 rutas activas del menú** contra el repo. Las que no llevan `.html`
  (`/m/rh-bonos`, `/m/contratos`…) funcionan: Netlify sirve el archivo igual.

**Y un agujero que cerré de paso:** `ateneista_capacidades` e `historia` estaban **sin RLS**.
Cualquiera con sesión —y eso incluye a cada ateneísta y cada hotelero con login— podía
concederse una capacidad a sí mismo. Ahora las capacidades las lee todo el que entra pero sólo
las escribe `es_equipo_casa()`, y la historia sólo la lee la casa.


**2026-10-26 (madrugada) · El portal del ateneísta: lo que trae, no lo que es**

- Tira de capacidades en su portal, leída de `ateneista_capacidades`. Quien ya tiene fichas
  las trae marcadas aunque nadie se lo hubiera puesto: no se le quita lo que ya hace.
- **Marcar habilita crear**, que es la regla de Javi. RPC `ateneista_marca_capacidad`,
  `security definer`, y sólo deja marcarse `experiencias`, `eventos` y `artesania`: `hotel`
  entra por su propia puerta y `membresia` la concede la casa. Publicar sigue pasando por
  la cola.
- **Un evento es una `op_experiencia` con `formato='evento'`**: la misma ficha, el mismo
  editor y el mismo id. Dos tablas era lo que hacía que un taller con fecha fija acabara
  dado de alta dos veces, una como tour y otra como evento.
- El menú de La Cósmica sólo se aplica a los tours: un evento no lleva bienvenida ni despedida.

---

**2026-10-26 (madrugada) · La cadena no es un hotel**

`hotel_grupos` ya existía y estaba bien usado: Barrio es la cadena y Bolívar, Isabel la
Católica y Barrio Hostel son sus tres casas. Lo que estaba mal eran dos cosas:

1. **Barrio Hostel estaba marcado `es_grupo=true` y además tenía 21 cuartos**: era cadena y
   casa a la vez. Corregido; queda como casa dentro de la cadena, con la nota en su ficha y
   el apunte en `historia`.
2. **La lista era plana**, así que las tres casas de Barrio se leían como tres cadenas. Ahora
   la cadena encabeza y las casas cuelgan debajo.

Ojo, Javi: dijiste que **Barrio tiene dos** hoteles asociados y la base tiene **tres**
(Hostel 21 cuartos, Bolívar 18, Isabel la Católica 24). No toqué ninguno: dime cuál sobra.

---

**2026-10-26 (madrugada) · Las fusiones, sin borrar nada**

- **Café Cumbre ya estaba resuelta**: su productora apuntaba a su touroperadora, así que en
  La comunidad sale **una vez**, con experiencias + eventos. Y su candado no bloquea nada,
  así que **no hubo que mover ningún Stripe** — que era la parte que no pensaba tocar
  mientras dormías.
- **Barrio Hostel sí estaba duplicado**: dos fichas con el mismo correo. **Enlacé** la
  productora a la touroperadora en vez de borrarla. Tu nota decía que la productora estaba
  vacía, pero **le cuelgan 16 espacios**: borrarla los dejaba huérfanos. Ahora sale una vez,
  con experiencias + eventos + hotel.
- **Casa Pepe Puebla y «Terraza La Cósmica de Casa Pepe»** comparten correo pero **no son un
  duplicado**: son dos cosas distintas. Las dejé separadas.


**2026-10-26 (madrugada) · El circuito del alta, que no existía**

Javi pidió una prueba del alta de ateneísta. La hice de verdad, llamando a la misma función
que llama el formulario, con la llave pública. La ficha se creó. **Y ahí se acababa todo.**

- Nacía en `borrador`, y la cola de aprobación lee `en_revision`: **caía en un cajón que nadie
  abre.** Nadie se enteraba de que alguien se había dado de alta.
- No salía ningún correo, ni al que se dio de alta ni a la casa.
- **No se le creaba cuenta**, así que no podía entrar nunca. Se quedaba esperando un correo
  que no existía, y la última pantalla le decía «ya eres ateneísta» y «te mandamos la liga de
  tu portal»: las dos cosas, mentira.

Ahora son tres momentos, cada uno con su correo (función `ateneista-aviso`, con el mismo
Resend y el mismo marco que `operador-alta`):

| | Qué pasa | Quién recibe |
|---|---|---|
| **alta** | la ficha entra `en_revision` y aparece en la cola | acuse al ateneísta + aviso a experience.cdmx |
| **aprobada** | **se le crea la cuenta** y se genera la liga de contraseña | el ateneísta, con el botón para entrar |
| **devuelta** | vuelve a `borrador` | el ateneísta, con el motivo que escribió quien revisó |

La liga de la contraseña **no sale de la plantilla de Supabase**: se genera con
`admin/generate_link` y se manda en nuestro correo, para que quien la reciba vea Sincrético y
no un correo gris de un servicio que no conoce. Cae en `/acceso.html`, que ya sabía recibir un
`type=recovery` y guardar la contraseña nueva **antes** de entrar — si no, el enlace se gasta y
la próxima vez vuelve a no poder.

Probado de punta a punta: alta → acuse (`correo:true`) → aprobar → usuario creado y confirmado
en `auth.users`, con `recovery_sent_at`. Los dos correos fueron a `javi+zzprueba@casapepe.mx`.

---

**2026-10-26 (madrugada) · Una sola puerta en la raíz**

`grupocasapepe.netlify.app` preguntaba **«¿cuál es tu casa?»** con cuatro tarjetas antes de
pedir el correo. Es la misma pregunta —«¿qué eres?»— que tenía a seis empresas dadas de alta
dos y tres veces, y aquí ni siquiera hacía falta: quién es cada quien ya está en la base.

Ahora pide correo y contraseña, y después mira: equipo → el panel; touroperadora →
`/operador.html`; **hotel → `/hotelero.html`** (antes caía en el panel y leía «sin accesos» sin
saber que su portal existía). Más «Darme de alta» → `/ateneista` e «Ir a Casa Pepe».
La portada de las cuatro marcas sigue viva en `/entrar.html`.

---

**2026-10-26 (madrugada) · Las tres que faltaban**

Javi: *«no veo que hayas editado dentro de la página de los ateneístas ni la página de venta
que les creamos ni tampoco el funnel»*. Tenía razón: toqué el panel y el portal del
touroperador, y esas tres se quedaron fuera.

- **El funnel** vuelve al menú (lo había retirado por redundante, y no lo es: lo que hay en el
  funnel todavía no está en la comunidad). Ya no es sólo de touroperadoras: cada tarjeta dice
  **qué trae**, con las mismas pastillas y **leyendo de `v_ateneistas`, la misma fuente que lee
  La comunidad**. Si las dos pantallas no leen lo mismo, no es la misma gente. Más filtro por
  capacidad, que se dibuja con lo que hay.
- **El portal de la productora** tiene la tira de capacidades en la cabecera, por token
  (`prod_portal_capacidades`, porque ese portal entra sin sesión). Sólo sabía que quien entra
  produce eventos; si además traía tours no se enteraba y acababa dándose de alta otra vez por
  el otro lado. **Eso es lo que tenía duplicados a Barrio Hostel y a Café Cumbre.**
- **La página de venta** gana un bloque con sus experiencias publicadas
  (`ateneista_experiencias_publicas`). Sólo sabía enseñar fechas, así que le escondía a su
  dueño la mitad de lo que vende — y justo la mitad que se puede reservar cualquier día.

Hoy devuelve vacío para los dos ateneístas enlazados, y es correcto: ninguno tiene todavía una
experiencia publicada.


## Lo que sigue

| | |
|---|---|
| F3 | Fichas de producto: unificar `ficha.html` y `ficha2.html` en una sola |
| F4 | Portal del ateneísta: que lea las mismas capacidades que la ficha del panel |
| F5 | Hotel: el portal del hotelero contra el nuevo registro único |
| — | Decisiones que no toma un agente: ver AGENTE.md |

Hecho hasta aquí: F1-1, F1-2, F1-2b, F2-3, F2-4, F2-5, F6-23, F6-24, la puerta y el menú.

## Correcciones al diseño que pidió Javi

1. El menú de seis es de **Sincrético**, no del panel: va como submenú lateral.
2. **Ajustar lo que se pisa** en el listado de la comunidad: el nombre a dos líneas y la
   pastilla de capacidad se encabalgan.
3. **Espacios no es capacidad**: sólo los crea un hotel. Confirmado.
4. El alta vive **fuera** del dashboard.
