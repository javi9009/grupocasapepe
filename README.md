# Grupo Casa Pepe — Plataforma Matriz

Dashboard interno del Grupo Casa Pepe. Reemplaza la versión de Lovable.

**Stack:** HTML autocontenido + Supabase (proyecto `Ateneo-del-viaje`, ID `rehophywchakfapivsbh`).

**Deploy:** auto-deploy via Netlify on push a `main`.

**URL:** TBD (Netlify site `grupocasapepe`).

## Estructura

- `index.html` — landing del panel interno con KPI cards de bienvenida.
- `m/{codigo}.html` — un archivo por módulo UI (mapeo 1:1 con `public.modulos`).
- `_shared/` — supabase-client, auth, estilos compartidos.

## Roles

- socio, potencial_socio, mentor (área de Socio)
- colaborador, coordinador (áreas Colaborador y Concierge)

Los permisos por módulo se controlan en `public.user_modules`.

## Variables públicas

```
SUPABASE_URL = https://rehophywchakfapivsbh.supabase.co
SUPABASE_ANON_KEY = (configurar en Netlify env vars)
```
