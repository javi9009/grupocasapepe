-- sinc_reservar_web es la reserva de la web pública: vuelve a su versión original.
do $$ declare d text; begin
  select definicion into d from privado.funciones_respaldo where nombre='sinc_reservar_web' and motivo like 'sec03%' order by id desc limit 1;
  if d is not null then execute d; end if;
end $$;

-- Guardia suave: basta con tener sesión (voluntarios incluidos). Para PepeQuiz y avatares.
-- (se corrige en sec03c para leer el rol de request.jwt.claims)
create or replace function public.exige_sesion()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'anon' or
     (coalesce(current_setting('request.jwt.claim.role', true), '') = 'authenticated' and auth.uid() is null) then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;
end $$;
revoke all on function public.exige_sesion() from public;
grant execute on function public.exige_sesion() to anon, authenticated, service_role;

do $$ declare r record; d text; begin
  for r in select nombre from unnest(array['pp_set_avatar','pq_elegir_premio','pq_reaccion_ganador','pq_anunciar_premio']) nombre loop
    select definicion into d from privado.funciones_respaldo where nombre=r.nombre and motivo like 'sec03%' order by id desc limit 1;
    if d is null then continue; end if;
    d := regexp_replace(d, '(\$function\$[^$]*?\mbegin\M)', '\1' || E'\n  perform public.exige_sesion();', 'i');
    execute d;
  end loop;
end $$;
