# casapepe-app (greenfield · v2)

Plataforma unificada del Grupo Casa Pepe, construida en paralelo ("strangler fig") sobre el esquema **`core`** de Supabase. No rompe lo existente: vive bajo `/v2` y toma la raíz cuando esté completa.

## Superficies
- **`/v2/dashboard`** — panel de gestión (dirección/gerencia/áreas).
- **`/v2/soypepe`** — app de colaboradores.
- **`/v2/app`** — app de huéspedes (gestión de experiencia, reservas) · *pendiente*.

## Fuente de verdad de datos
Todo tira del esquema **`core`** (identidad, propiedades, roles, permisos) y de los esquemas de dominio (`finanzas`, `rh`, `tours`, `pricing`, `revenue`, `auditoria`…). Una sola base: proyecto Supabase `rehophywchakfapivsbh`.

## Seguridad y calidad
Ver `docs/SEGURIDAD.md` y `docs/ARQUITECTURA.md`. Resumen:
- RLS deny-by-default en `core`; escrituras solo por service role / funciones SECURITY DEFINER.
- Sin secretos en el cliente: solo la clave *publishable* (anon). La *service key* y el `gh_pat` viven en Supabase Vault / GitHub Secrets.
- Contraseñas: las maneja Supabase Auth (nunca se almacenan).
- Auditoría append-only (`core.audit_log`) + autoverificación diaria de integridad (`core.fn_check_integridad`).
- Permisos vía `public.mi_nivel(pagina)` (RPC) — el front nunca decide permisos solo.

## Convenciones de código
- Módulos ES (`import`/`export`), sin build step. Librería compartida en `shared/`.
- Nada de `localStorage` para datos sensibles; la sesión la maneja el SDK de Supabase.
- Cada página declara su `PAG-*` y llama `guard(pagina, nivel)` antes de render.
