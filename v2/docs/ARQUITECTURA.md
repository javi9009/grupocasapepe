# Arquitectura · casapepe-app

GitHub (código) + Netlify (deploy) + Supabase (datos/auth). Sin build step (ES modules + CDN).

## Esquema core (fuente única de identidad)
- `core.entidades` — razones sociales (HBR, El Pontigu, Struchture).
- `core.propiedades` — CDMX, Virreyes, Puebla (UUIDs estables, ligados a entidad).
- `core.empleados` — personas; `user_id` liga a `auth.users` (sin passwords).
- `core.roles`, `core.empleado_roles` — RBAC.
- `core.dominios`, `core.paginas`, `core.rol_permisos`, `core.usuario_permisos` — catálogo de permisos por superficie.
- `core.audit_log`, `core.integridad_resultados`, `core.catalogo_tablas` — auditoría, autoverificación y mapa vivo de dominios.

## Migración (strangler fig)
1. `core` primero (hecho).
2. Área piloto: **Finanzas** (conciliación + intake) sobre esquema `finanzas`, leyendo de `core`.
3. Migrar datos buenos de `public.*` a los esquemas nuevos, área por área.
4. Cutover: cuando `/v2` cubre todo, toma la raíz de grupocasapepe.netlify.app y se retira lo viejo.

## Exposición de `core` al cliente
Para leer `core` vía PostgREST hay que agregar `core` a *Exposed schemas* (Dashboard → API). Mientras tanto, los permisos se resuelven por el wrapper `public.mi_nivel()`.
