# Schema Supabase — Proyecto Ateneo-del-viaje (plataforma matriz)

> **Project ID:** `rehophywchakfapivsbh`
> **URL:** `https://rehophywchakfapivsbh.supabase.co`

## Tablas públicas

### `entities`
Sociedades + unidades de negocio (jerarquía).

```sql
id              uuid pk
tipo            text  -- 'sociedad_activa' | 'nuevo_proyecto'
clase           text  -- 'operadora' | 'vehiculo_inversion' | 'unidad_negocio'
nombre          text
metadata        jsonb
is_active       bool
parent_entity_id uuid fk -> entities.id
```

### `properties`
Propiedades físicas.

```sql
id                      uuid pk
tipo                    text  -- 'hotel' | 'ateneo' | 'corporativo'
ciudad                  text
nombre                  text
metadata                jsonb
timezone                text  -- 'America/Mexico_City'
entity_id               uuid fk -> entities.id
cloudbeds_property_id   text  -- nullable
```

### `espacios`
Espacios reservables dentro de las propiedades (coworking, podcast, cine, café).

```sql
id              uuid pk
tipo            text  -- 'coworking' | 'podcast' | 'cine' | 'musica' | 'cafe'
activo          bool
nombre          text
horario         text  -- "9:00-21:00"
foto_url        text
capacidad       int
descripcion     text
property_id     uuid fk -> properties.id
duracion_slot   text  -- "Por bloque" | "1 hora" | "2 horas" | "Por consumo"
```

### `reservas_espacio`
Reservas concretas. Inferir schema con SELECT cuando se vaya a tocar.

### `reglamento`
Reglas del Ateneo (12 entradas). Schema: por inferir.

### `info_propiedad`
Datos descriptivos de propiedades.

### `aliados` (vacía aún)
Distribuidores, partners, aliados comerciales.

```sql
id                uuid pk
nombre            text NOT NULL
tipo              text
email             text
telefono          text
contacto          text
ciudad            text
stripe_account_id text
is_active         bool default true
metadata          jsonb default '{}'
created_at        timestamptz default now()
```

### `proveedores`
Catálogo de 131 proveedores. Schema: por inferir.

### `products`
Catálogo principal de 423 productos. Schema: por inferir (muy probablemente con `taxonomy_id`, `entity_id`, `property_id`, precio, etc.).

### `product_taxonomy`
Categorías.

```sql
id              uuid pk
icono           text
foto_url        text
categoria       text  -- 'Comida' | 'Tours' | 'Residencias' | etc.
subcategoria    text
unidad_negocio  text  -- 'A&B' | 'Ateneo' | 'Experiencias' | 'Hospedaje' | 'Otros ingresos'
```

### `experiencias`
30 tours/experiencias.

```sql
id                       uuid pk
sku                      text
nombre                   text
propio_3o                text
touroperador             text
correo_prov              text
telefono_prov            text
contacto_contab          text
pvp                      numeric
duracion                 text
dias_horario             text
adn_gastronomico         text
adn_informacion          text
adn_dinamica             text
adn_protagonista         text
adn_souvenir             text
itinerario               text
traslado_pct             text
impacto_unesco_glasgow   text
comision_sincretico      text
metodo_cobro             text
grupo_minimo             text
release_antelacion       text
lugar_salida             text
hora_salida              text
ods_que_cumple           text
vnums_por_compra         numeric
link_turitop             text
foto_url                 text
galeria                  jsonb
rating                   numeric
num_reviews              int
destacado                bool
destacado_orden          int
```

### `ods_catalog`
Los 17 ODS de la ONU + variantes (22 entradas). Schema: por inferir.

### `experiencia_ods`
Mapeo M:N entre experiencia y ODS. Schema: por inferir.

### `profiles`
Perfiles de usuario. Schema: por inferir.

### `user_roles`
Roles. Schema: por inferir.

### `employees`
Empleados (37). Schema: por inferir.

### `memberships`
Asignación user↔entity. Schema: por inferir.

### `modulos`
Módulos UI del dashboard (43).

```sql
codigo            text pk    -- 'SOC-DECK', 'COL-TRABAJADOR', etc.
area              text       -- 'Área de Socio' | 'Área de Colaborador' | etc.
orden             int
nombre            text
en_perfil         bool
actor_base        text       -- 'socio' | 'colaborador' | 'mentor' | 'potencial_socio'
area_orden        int
descripcion       text
parent_codigo     text fk -> modulos.codigo
solo_coordinador  bool
```

### `user_modules`
Módulos activos por usuario. Schema: por inferir.

### `pyg_accounts`
Cuentas P&G (79). Schema: por inferir.

### `data_points`
KPIs definidos (95). Schema: por inferir.

### `data_values`
Valores históricos de KPIs. Schema: por inferir.

### `wallets` / `wallet_transactions` / `pago_splits`
Sistema de monederos digitales. Vacíos. Schema: por inferir.

### `documents` / `biblioteca`
Documentos. Vacíos.

### `impact_events`
Eventos de impacto. Vacíos.

### `integraciones_solicitudes`
Solicitudes de integración pendientes. Vacíos.

### `fuentes`
Fuentes de datos (22). Schema: por inferir.

---

## CAMBIOS REALIZADOS (2026-08-29)

### Reestructura de Ateneo Virreyes
**Decision:** Mover Ateneo Virreyes de entity independiente a property bajo Sincrético.

**Cambios en Supabase:**
1. ✅ Actualizar `properties` — cambiar `entity_id` de Ateneo Virreyes (3e10a9ea...) de `06c2b780...` (Ateneo de Virreyes entity) a `f70154ca...` (Sincrético entity)
2. ✅ Confirmar que todas las referencias (`espacios`, `reservas_espacio`, `reglamento`, `info_propiedad`, `user_modules`) apunten correctamente a la property de Ateneo
3. Considerar deprecación futura de entity `06c2b780-9111-4a3a-a381-1d1c759a892b` (Ateneo de Virreyes)

**SQL Update:**
```sql
UPDATE properties
SET entity_id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4'  -- Sincrético
WHERE id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'  -- Ateneo Virreyes property
;
```

**Funcionalidades movidas a Sincrético:**
- 5 espacios (coworking, podcast, cine, música, café)
- Reservas de espacios
- Reglamento (12 entradas)
- Info de propiedad
- Módulos UI asignados

---

## Para inferir el schema completo de cualquier tabla:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<TABLA>'
ORDER BY ordinal_position;
```

O usar el tool `list_tables` con `verbose: true`.

---

## Esquema `auth` (Supabase Auth)

Manejado automáticamente por Supabase Auth. Tablas relevantes:
- `auth.users` — 15 usuarios reales
- `auth.identities` — proveedores (email, OAuth)
- `auth.sessions`

NUNCA escribir directo en estas tablas. Usar el API de Supabase Auth.
