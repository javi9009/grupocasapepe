# Inventario vivo — Grupo Casa Pepe

> **Actualizado:** 2026-06-15
> **Mantener:** cuando crees/modifiques algo en el stack, actualiza este archivo.

## Cuentas y orgs

| Servicio | Usuario / Org | Plan |
|---|---|---|
| GitHub | `javi9009` | Personal |
| Netlify | `Javi Puente's team` (id `6a02a0b627150589c872651f`) | `nf_team_pro` |
| Supabase | Org **CasaPepe** (id `jhfjmduvgfrzlrzybzig`) | — |
| Cloudflare | Cuenta de Javi | Workers Free |
| Turitop | Casa Pepe Ciudad de México (short_id `C1036`, product `P124`) | — |
| Resend | Dominio `casapepe.mx` verificado | — |
| Cloudbeds | CDMX `10668`, Puebla `201759` | — |

## Repos GitHub (`javi9009`)

| Repo | Visibilidad | Para qué | Site Netlify | Stack |
|---|---|---|---|---|
| `casapepe-revenue` | privado | Pricing Calendar (Casa Pepe CDMX) | `casapeperevenue` | Python + JS plano |
| `flylike-panel` | privado | Flylike Dashboard | `flylikedashboard` | HTML autocontenido |
| `virreyes-sincretico` | público | Landing Hotel Virreyes (index, ateneo, cumbre, hotel) | `virreyes-sincretico` | HTML estático |
| **`casapepe-mitos`** | (por crear) | Web mitosenelring.mx | `mitosenelring` | HTML + JS |
| **`casapepe-web`** | (por crear) | Web casapepe.mx | `casapepeweb` | HTML |
| **`casapepe-sincretico`** | (por crear) | Sincrético sitio | `sincretico` | HTML |
| **`casapepe-contenido`** | (por crear) | Contenido CPP | `contenidopepe` | HTML |
| **`casapepe-asamblea`** | (por crear) | Asamblea socios | `asambleacpp` | HTML |
| **`casapepe-reportesocios`** | (por crear) | Reporte socios | `reportesocios` | HTML |

## Sitios Netlify

| Nombre | Site ID | Dominio prod | Dominio Netlify | Auto-deploy |
|---|---|---|---|---|
| `mitosenelring` | `b5e44918-c8c0-4cb7-afd7-f0e474e34263` | mitosenelring.mx | mitosenelring.netlify.app | ❌ drag&drop |
| `casapepeweb` | `72c9ebe9-b584-4479-889f-2d7ffe4a75da` | casapepe.mx | casapepeweb.netlify.app | ❌ |
| `sincretico` | `91007624-acca-4432-8b8a-a473d06cb7ab` | — | sincretico.netlify.app | ❌ |
| `contenidopepe` | `b17de947-9f92-490d-95bb-d235be204c4d` | — | contenidopepe.netlify.app | ❌ |
| `asambleacpp` | `0b2f374f-31d3-4f3c-9ea8-894019353b15` | — | asambleacpp.netlify.app | ❌ |
| `reportesocios` | `6bb7dd7c-f168-44d7-8f91-209164ef11c7` | — | reportesocios.netlify.app | ❌ |
| `casapeperevenue` | `6e71c811-b7cf-4c33-ba59-07468d073429` | — | casapeperevenue.netlify.app | ✓ (vía `casapepe-revenue`) |
| `flylikedashboard` | `3f87be51-617b-4017-89f2-1f4dc0b1b0a1` | — | flylikedashboard.netlify.app | ✓ (vía `flylike-panel`) |
| `virreyes-sincretico` | `f5f679a9-41ce-4ddc-8fb2-722567ec179e` | — | virreyes-sincretico.netlify.app | ✓ (vía `virreyes-sincretico`) |

## Supabase

**Org CasaPepe** — `jhfjmduvgfrzlrzybzig`

### Proyectos

| Proyecto | Project ID | URL | Región | Uso |
|---|---|---|---|---|
| **Ateneo-del-viaje** (LA MATRIZ) | `rehophywchakfapivsbh` | `https://rehophywchakfapivsbh.supabase.co` | us-east-1 | BBDD del Grupo entero |
| Flylike | `lxmovwgtfdrtkdfoknhu` | `https://lxmovwgtfdrtkdfoknhu.supabase.co` | us-east-2 | Flylike panel |

### Tablas de `Ateneo-del-viaje` (proyecto matriz)

> Schema completo en `schema-supabase.md`.

**Identidad/Auth (Supabase Auth):** `auth.users` (15) · `auth.identities` (15) · `auth.sessions` (7)

**Plataforma:**

| Tabla | Filas | Para qué |
|---|---|---|
| `entities` | 7 | Sociedades + unidades de negocio (Hostal Boutique RU, Izazaga 8, Sincrético, Ateneo Virreyes, Pontigu, Struchture, sociedad por constituir) |
| `properties` | 4 | Propiedades físicas (Casa Pepe CDMX, Casa Pepe Puebla, Ateneo Virreyes, Corporativo) |
| `profiles` | 15 | Perfiles de usuarios |
| `user_roles` | 15 | Roles por usuario |
| `employees` | 37 | Empleados del Grupo |
| `memberships` | 36 | Membresías user↔entity |
| `proveedores` | 131 | Catálogo de proveedores |
| `product_taxonomy` | 40 | Categorías de productos (A&B, Ateneo, Experiencias, Hospedaje, Otros ingresos) |
| `products` | **423** | Catálogo de productos |
| `experiencias` | 30 | Tours + experiencias (incluye 2 Mitos en el Ring) |
| `ods_catalog` | 22 | ODS de la ONU |
| `experiencia_ods` | 0 | Mapeo experiencia→ODS |
| `pyg_accounts` | 79 | Cuentas P&G |
| `data_points` | 95 | KPIs definidos |
| `data_values` | 0 | Valores históricos |
| `documents` | 0 | Documentos legales |
| `impact_events` | 0 | Eventos de impacto |
| `aliados` | 0 | (POR LLENAR — hoteles distribuidores de Mitos + Flylike + futuros aliados) |
| `wallets` | 0 | Monederos digitales |
| `wallet_transactions` | 0 | Transacciones del monedero |
| `pago_splits` | 0 | Splits de pago |
| `modulos` | 43 | Módulos UI del dashboard |
| `user_modules` | 28 | Módulos activos por usuario |
| `fuentes` | 22 | Fuentes de datos |
| `integraciones_solicitudes` | 0 | Pendiente de integración |
| `biblioteca` | 0 | Documentos / recursos |
| `espacios` | 5 | Espacios del Ateneo Virreyes (Coworking, Podcast, Cine, Música, Café Cumbre) |
| `reservas_espacio` | 2 | Reservas de los espacios |
| `reglamento` | 12 | Reglamento del Ateneo |
| `info_propiedad` | 3 | Info de propiedades |

### IDs útiles (entities / properties)

```
ENTITY                                          ID
─────────────────────────────────────────────────────────────────────────────
Hostal Boutique Rep. de Uruguay SA             885783ba-9ea7-4744-82f3-3b67e3aab52a
  Izazaga 8 SA                                 edf66be4-9e65-42f1-a286-e591cd35ebfa  (51%)
    Sincrético                                 f70154ca-3c1f-4679-bc89-a45c31ae40f4
El Pontigu SA                                  cef971ec-e190-4fe9-9110-f5b30a4f4bf4
Struchture Inmoconstrucciones SA               4684908b-67ff-4c50-b1a2-2dd45d61d56a
Sociedad por constituir                        907d8abf-5414-4838-96b0-0fb9259fbc7b

PROPERTY                                        ID                                     entity
─────────────────────────────────────────────────────────────────────────────
Casa Pepe CDMX (Cloudbeds 10668)               45e69775-d877-4507-a9e1-a45bd3400dc5    Hostal Boutique RU
Casa Pepe Puebla (Cloudbeds 201759)            febfbef6-7fd1-4b45-84d9-13533e8dcb72    Hostal Boutique RU
Ateneo Virreyes (CDMX)                         3e10a9ea-4913-4f7c-86ef-0c829caa851d    Sincrético
Corporativo                                    fde2f615-2c65-40fa-9df3-6336b5ab312c    Hostal Boutique RU
```

### Espacios Ateneo Virreyes (5)

| Espacio | ID | Tipo | Capacidad | Horario | Slot | Activo |
|---|---|---|---|---|---|---|
| Coworking | `9f71722f-…` | coworking | 12 | 9–21 | Por bloque | ✓ |
| Estudio Podcast | `e0627207-…` | podcast | 3 | 9–21 | 1 hora | ✓ |
| Cine | `5b07ed92-…` | cine | 10 | 12–23 | 2 horas | ✓ |
| Estudio Música | `32553b8e-…` | musica | 4 | 10–21 | 1 hora | ❌ |
| **Café Cumbre** | `067e5f7c-0dd3-44cd-a54d-f3b592ab7c4f` | cafe | 30 | 7–21 | Por consumo | ✓ |

## Cloudflare

| Recurso | Nombre | ID |
|---|---|---|
| Worker | `mitos-backend` | `e97d4dc289854b31b073c639df36ad84` |
| KV | `HOTELES_DB` | `cce1d3f2311d49ada2a03ce4fd5536a1` |
| KV | `WEBHOOKS_DB` | `7b9e2a42fc7e410387e3754c0df48919` (nuevo, para v5.0) |
| KV | `CACHE_DB` | `e1e0e14c79ff49f6bd97f104316094eb` (nuevo, para v5.0) |
| KV | `AUDIT_DB` | `57a20bcb2d154f4ea2310e526eb5bac9` (nuevo, para v5.0) |

URL del Worker: `https://mitos-backend.javi-5a4.workers.dev`

## Turitop

| Campo | Valor |
|---|---|
| Compañía short_id | `C1036` |
| Producto Mitos | `P124` |
| Link base reserva | `https://app.turitop.com/booking/box/C1036/P124/Esp/0/0/0/0?loading=1&promo=<CODE>` |
| Panel | `https://app.turitop.com/user/C1036/profile` |

## Resend

| Campo | Valor |
|---|---|
| Dominio | `casapepe.mx` |
| From principal | `noreply@casapepe.mx` |
| Notificaciones internas | `hola.puebla@casapepe.mx` |
| Admin email | `javi@casapepe.mx` |

## Cloudbeds (PMS)

| Propiedad | Property ID |
|---|---|
| Casa Pepe CDMX | `10668` |
| Casa Pepe Puebla | `201759` |

## Artifacts Cowork del usuario (en su OneDrive)

| ID | Nombre | Para qué |
|---|---|---|
| `casa-pepe-pricing-calendar` | Casa Pepe Pricing Calendar | Pricing del hostal CDMX (estaba con snapshot del 11-may; refrescable) |
| `flylike-panel-comercial` | Flylike Panel Comercial | Panel comercial Flylike |
| `briefing-cdmx` | Briefing CDMX | Briefing inicial CDMX |
| `cpp-tablero-socios` | CPP Tablero Socios | Tablero para socios |

## Plataforma matriz frontend

**Estado:** Localizada en **Lovable** y EN MIGRACIÓN a Netlify/GitHub propio.

- **Versión Lovable (legacy, a deprecar):** `https://id-preview--1bee5df9-09d9-4e28-ac7e-ce2d588572c8.lovable.app` — project id `1bee5df9-09d9-4e28-ac7e-ce2d588572c8`. 39 módulos visibles. Ruta de módulo: `/m/{CODIGO}`.
- **Versión nueva (canónica):** `https://grupocasapepe.netlify.app` (15-jun-2026 v0 live).
  - Repo: `https://github.com/javi9009/grupocasapepe` (privado).
  - Sitio Netlify: `grupocasapepe` (siteId `98b717be-5c30-4bc4-8d9d-7ad97088ffb