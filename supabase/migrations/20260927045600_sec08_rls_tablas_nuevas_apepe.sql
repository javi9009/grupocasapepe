-- sec08: dos tablas nuevas de APePe (creadas esta noche) estaban sin RLS.
-- Las escriben las funciones edge con service_role; el equipo las lee.
alter table public.apepe_upgrade_aplicado enable row level security;
alter table public.apepe_winback enable row level security;
create policy apepe_upgrade_aplicado_equipo on public.apepe_upgrade_aplicado for all to authenticated
  using (public.es_equipo_casa()) with check (public.es_equipo_casa());
create policy apepe_winback_equipo on public.apepe_winback for all to authenticated
  using (public.es_equipo_casa()) with check (public.es_equipo_casa());
