-- sec06: los documentos de socios (deck Uruguay 86, modelo, reporte a socios,
-- avalúo y planos) dejan de estar publicados en la web y pasan al bucket
-- privado socios-docs (carpeta web/). Los sirve la función edge doc-privado a
-- quien tenga sesión de socio o del equipo.
create or replace function public.es_socio()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'socio')
    or exists (select 1 from public.employees e where e.user_id = auth.uid() and e.estatus = 'socio')
  );
$$;
revoke all on function public.es_socio() from public;
grant execute on function public.es_socio() to anon, authenticated, service_role;

create or replace function public.puede_docs_socios()
returns boolean language sql stable security definer set search_path = public as $$
  select public.rol_peticion() not in ('anon','authenticated')
      or public.es_socio() or public.es_equipo_casa();
$$;
revoke all on function public.puede_docs_socios() from public;
grant execute on function public.puede_docs_socios() to anon, authenticated, service_role;
-- (la carga inicial se hizo con un token temporal, ya retirado en sec06b)
