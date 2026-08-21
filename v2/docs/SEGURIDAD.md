# Estándares de seguridad y ciberseguridad · casapepe-app

## Identidad y acceso
- Autenticación con **Supabase Auth** (JWT). No se almacenan contraseñas en tablas propias.
- Autorización por **RBAC** en `core`: roles → páginas → nivel (`none`/`ver`/`editar`/`admin`).
- El front consulta permisos con `public.mi_nivel(pagina)` (SECURITY DEFINER). El servidor es la autoridad; el front solo refleja.

## Datos
- **RLS deny-by-default** y `force row level security` en todas las tablas de `core`.
- Lectura de referencia para `authenticated`; **escrituras solo** por service role / funciones SECURITY DEFINER.
- `core.audit_log` **append-only**: sin políticas para roles cliente (solo service). Registra antes/después de cada cambio en tablas sensibles.
- **Soft-delete** (`deleted_at`) + columnas de auditoría (`created_by/updated_by/updated_at`) para no perder datos silenciosamente.
- Claves foráneas con `on delete restrict/set null` para evitar cascadas destructivas accidentales.

## Autoverificación (resguardo de data)
- `core.fn_check_integridad()` corre a diario (pg_cron 09:15 CDMX) y registra en `core.integridad_resultados`: emails duplicados, empleados activos sin propiedad, propiedades sin entidad, referencias huérfanas. Severidad `ok/warn/error`.

## Secretos
- Cliente: solo clave **publishable/anon** (pública por diseño).
- **service key** y **gh_pat**: en Supabase Vault / GitHub Secrets. Nunca en el repo ni en el cliente.

## Transporte y cabeceras
- HTTPS forzado (Netlify). Al hacer cutover a raíz se añaden cabeceras: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.

## Principios
- Menor privilegio. Validación por constraints/enums en la base, no solo en el front. Todo cambio va commiteado (historial/reversible).
