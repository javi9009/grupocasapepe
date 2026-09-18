# Handoff · Compras, precios e inventario (Grupo Casa Pepe)

**Fecha:** 18 sep 2026
**Para:** el agente que continúe el módulo de compras
**De:** sesión del TMS de Sincrético — dejo compras aquí para no cruzar los dos frentes

---

## Dónde vive todo

- **Base:** Supabase `rehophywchakfapivsbh`. Todo lo de compras cuelga del prefijo `cmp_`.
- **Pantalla:** `m/catalogo.html` en el repo `javi9009/grupocasapepe` → `grupocasapepe.netlify.app/m/catalogo.html`. Se llama "Proveedores y stocks" y tiene 8 pestañas: Productos · Productos nuevos · Incompletos · Precios · Proveedores · Stock por bodega · Conteos · Conciliación A&B.
- **App del personal:** carpeta `soypepe/` (PWA). Hoy tiene limpieza, room-audit, nómina, documentos, clases, talleres, experiencias, procedimientos. **No tiene inventario.**
- **Deploy:** push directo a `main`, sin PR. Netlify publica solo. Ver la skill `casapepe-deploy`; la regla dura es **nunca editar la copia de OneDrive** salvo emergencia por GitHub Desktop.
- **Diseño:** seguir la skill `casapepe-ui` (fondo crema, submenús arriba, selector de propiedad, cascada por ubicación con `cp-acceso.js`) y `casapepe-modulos-embed` para cualquier página nueva en `/m/`.

---

## Lo que ya quedó hecho en esta sesión

**Pestaña Precios, con filtros** (commit `c56fa8c`). Antes solo listaba los pendientes de costear y no había forma de volver a los que ya tenían precio. Ahora tiene el mismo bloque de filtros que Incompletos —estado (por costear / ya con precio / todos), área, bodega, cuenta y buscador—, los dos recuadros de arriba son clicables, y en modo "ya con precio" salen el costo por unidad base, quién lo surte y la fecha del último cambio, con botón para editar.

Para eso se añadieron dos consultas al `Promise.all` de `recargar()`: `cmp_v_costo_producto` (→ `COSTO`) y `cmp_presentaciones(producto_id, precio_actualizado)` (→ `p._precioAt`). El estado del filtro es `FPR`; ojo, `FP` ya estaba tomado por la pestaña de Proveedores.

---

## Cómo funciona el precio (esto hay que entenderlo antes de tocar nada)

**El precio no vive en el producto. Vive en la presentación.** Un producto tiene N presentaciones en `cmp_presentaciones` (la caja de 24, el litro, la pieza), cada una con su `precio`, su `proveedor_id` y su `contenido`.

De ahí sale el costo del producto por la vista `cmp_v_costo_producto`:

```sql
SELECT DISTINCT ON (producto_id) ...
FROM cmp_v_presentaciones
WHERE activo AND precio_unidad_base IS NOT NULL
ORDER BY producto_id, preferida DESC, precio_unidad_base;
```

Es decir: **gana la presentación marcada como preferida; si no hay ninguna, gana la más barata.**

Ese costo alimenta, sin que nadie lo copie a mano:

- `cmp_v_valor_stock` → el valor del inventario
- `cmp_v_merma_quincena` → la merma valorizada
- `cmp_v_pedido_sugerido` → el importe estimado del pedido
- `cmp_v_conciliacion_ayb` → el % de compras sobre venta

Un producto sale de la lista "por costear" en cuanto tiene **al menos una** presentación con precio. Eso lo decide la vista `cmp_v_captura_pendiente`.

**Estado hoy:** 369 productos con precio, 631 sin precio (en Casa Pepe CDMX). 378 presentaciones con precio.

---

## Pendiente 1 · Historial de precios — decidido, no construido

**Javi ya eligió: guardar cada cambio de precio.**

Hoy no hay historial. `cmp_presentaciones` guarda solo el precio vigente y `precio_actualizado` (la fecha del último cambio). Cuando alguien edita un precio, **el anterior se pierde para siempre**. No se puede responder "¿cuánto subió el aceite desde marzo?".

Lo que hay que montar:

1. Tabla `cmp_precio_historial`: `presentacion_id`, `producto_id`, `precio_anterior`, `precio_nuevo`, `moneda`, `cambiado_por`, `cambiado_por_nombre`, `motivo`, `created_at`.
2. Trigger `AFTER UPDATE OF precio ON cmp_presentaciones` que inserte una fila cuando el precio cambie de verdad (`IS DISTINCT FROM`). Insertar también en el `INSERT` inicial, con `precio_anterior` nulo, para tener el punto de partida.
3. En la pantalla: en el modal de `verPresentaciones()`, una columna o un desplegable con la curva del precio de esa presentación, y en la pestaña Precios un indicador de variación (↑ 18% desde mar).
4. Sembrar la fila inicial de las 378 presentaciones que ya tienen precio, usando su `precio_actualizado` como fecha, para no arrancar en blanco.

**El otro camino, para más adelante:** el precio realmente pagado al recibir un pedido, que está en `cmp_pedido_items.precio_recibido` y `diferencia_precio`. Es el bueno para costeo real, pero **hoy está en cero: no se ha recibido ni un solo pedido por el sistema** (`cmp_pedido_items` con `precio_recibido` = 0 filas, `cmp_movimientos` con costo = 0 filas). No sirve de nada hasta que la operación empiece a recibir por aquí.

---

## Pendiente 2 · Añadir productos desde la bodega

**Lo pidió Javi así:** *"cuando entro a una bodega tienes que permitirme añadir productos (aquí ya da igual el proveedor)"*.

El problema real: en la pestaña Conteos, la tabla de bodegas muestra varias con **0 productos**. Hoy la única forma de meter un producto a una bodega es desde la ficha del producto, eligiendo `bodega_id`. No se puede trabajar al revés —entrar a una bodega y decir "aquí también va esto"— que es como piensa la gente que cuenta.

Lo que hay que montar, en el botón **Ver** de cada bodega:

- Buscador del catálogo para asignar productos existentes a esa bodega (uno a uno y en bloque).
- Crear un producto nuevo ahí mismo, **sin exigir proveedor ni precio**: solo nombre, unidad base y categoría. Javi fue explícito en que el proveedor da igual en este paso.
- Quitar un producto de la bodega.

**Ojo con el modelo:** `cmp_productos.bodega_id` es un solo campo, así que hoy un producto vive en **una** bodega. Si se quiere que un producto esté en dos (muy probable: un blanco que está en ropería y en lavandería), hay que decidir entre una tabla puente `cmp_producto_bodega` o usar la existencia (`cmp_existencias` ya es por producto **y** bodega, y admite varias). **Mi lectura: `cmp_existencias` ya resuelve el "está en varias bodegas"; `bodega_id` es solo la bodega de cabecera.** Vale la pena confirmarlo con Javi antes de duplicar el modelo.

---

## Pendiente 3 · Inventario en SoyPepe

**Lo pidió Javi así:** *"en soypepe tienes que darle al personal la opción de generar inventario"*.

La idea: que cada quien cuente lo suyo desde el teléfono, y que eso caiga en `cmp_conteos` / `cmp_conteo_items`, que ya existen y ya están cableados a la merma y al valor del inventario.

### El mapa de bodegas reales, ya verificado contra la base

Javi dio una lista de memoria; esta es la de verdad. Le faltaban tres (marcadas).

| Área | Bodegas | Quién cuenta (según Javi) |
|---|---|---|
| A&B | Barra · Cocina · Bodega general · Bodega de bebidas · Cocina común (solo Puebla) | Barra → meseros · Cocina → chefs · Bodega general y de bebidas → Roberto y Claudia |
| Cuartos | Amenidades/Housekeeping · Blancos (ropería) · En lavandería · Lavandería y Habitaciones (blancos en uso) (solo Puebla) | Recamaristas |
| Administración | Recepción · **Site** ⚠️ · **Papelería/Oficina** ⚠️ | Recepción |
| Tienda | Tienda · Casa Verde (tienda) (Puebla) | Recepción ("la tiendita") |
| Mantenimiento | Mantenimiento | Mantenimiento |
| Tours | Experiencias | Experiencias y front — aquí entra la bodega de sonido |

⚠️ = no estaban en la lista de Javi; hay que preguntarle quién las cuenta.

Y una más: **"Poster (global)"** en CDMX. **Esa no la toca nadie a mano: es el espejo del POS.** Hay que excluirla explícitamente de cualquier pantalla de conteo.

### Qué hay que construir

- Una tarjeta nueva en `soypepe/index.html` → `soypepe/inventario.html`.
- Que al colaborador le salgan **solo las bodegas de su área y su sede**. El área del empleado y la de la bodega (`pos_almacenes.area`) ya existen; falta la tabla o el criterio que las cruce. Hoy no hay un mapeo rol → bodega: `cmp_area_rol` existe (`rol`, `area`) y probablemente es el punto de partida, pero hay que revisarlo con el catálogo de puestos de RH.
- Conteo cómodo en teléfono: lista de los productos de esa bodega, campo numérico grande, guardado parcial (un conteo se hace en varios ratos), y cierre explícito.
- Reusar `cmp_conteos` (cabecera, con `estado` y `periodo`) y `cmp_conteo_items` (`cantidad_sistema`, `cantidad_contada`, `cantidad_teorica`, `costo_unitario`, `motivo`). **No inventar tablas nuevas**, ya está todo.
- Respetar la cascada de ubicación de `cp-acceso.js`.

**Dependencia:** esto no sirve de nada hasta que las bodegas tengan productos. Por eso Javi pidió hacer primero el pendiente 2.

---

## Cosas que conviene saber antes de empezar

- **`catalogo.html` es un archivo grande y Javi lo edita a veces por su cuenta desde GitHub Desktop.** En esta sesión hubo un conflicto de rebase por eso. Hacer `git pull --rebase` antes de tocarlo, siempre.
- El archivo no tiene build: es un HTML con un `<script>` gigante. Para validarlo: extraer el script y pasarlo por `new Function(...)` en node. No hay tests.
- `PUEDE` es la variable que controla si el usuario puede editar. Respetarla en cualquier botón nuevo.
- Las solicitudes de producto nuevo (`cmp_altas_producto`) son una bandeja única para las tres casas, a propósito: Roberto las ve todas. Los incompletos, igual.
- Hay 1000 productos incompletos. La pestaña Incompletos es la lista de trabajo y ordena por lo que más se compra de verdad (`veces_recibido`, que viene de Poster), no por nombre. Esa lógica ya está bien pensada; no cambiarla a orden alfabético.

## Lo que NO hay que tocar

- Nada del TMS de Sincrético: `sinc_*`, `tour_*`, `op_*`, `guia_*`, `ficha.html`, `operador.html`, `protagonista.html`, `m/sinc-operadores.html`, `m/tour-editor.html`. Ese frente lo lleva otra sesión y está a medio construir.
- `m/finanzas-auditoria.html` y todo el cuadre diario: tiene sus propias reglas duras en la skill `casapepe-cuadre-ticket`.
