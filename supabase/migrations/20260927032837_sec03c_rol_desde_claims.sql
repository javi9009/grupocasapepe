-- PostgREST moderno solo fija request.jwt.claims (JSON), no request.jwt.claim.role.
-- Se lee el rol desde ahí; sin claims = llamada de servidor.
create or replace function public.rol_peticion()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    '');
$$;
grant execute on function public.rol_peticion() to anon, authenticated, service_role;

create or replace function public.exige_equipo()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.rol_peticion() in ('anon','authenticated') and not public.es_equipo_casa() then
    raise exception 'Solo el equipo de Casa Pepe puede hacer esto. Inicia sesión con tu cuenta de colaborador.'
      using errcode = '42501';
  end if;
end $$;

create or replace function public.exige_sesion()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.rol_peticion() = 'anon' or (public.rol_peticion() = 'authenticated' and auth.uid() is null) then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;
end $$;

create or replace function public.puede_delicado(p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.rol_peticion() not in ('anon','authenticated')
    or (
      public.es_equipo_casa()
      and (
        public.es_admin_seguridad()
        or exists (
          select 1 from public.acceso_delicado d
           where d.area = p_area
             and lower(d.email) = lower(coalesce(auth.jwt()->>'email',''))
        )
      )
    );
$$;
