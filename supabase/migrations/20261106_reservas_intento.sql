-- 6-nov-2026 · Un intento de pago que no pasó no es una venta.
--
-- Javi: «los que son intentos y NO pasaron no las pongas como ventas, eso sí
-- dejalas consideradas como intentos y con un filtro a parte. No subas los
-- intentos a la programación».
--
-- Cuando el cobro devuelve un error y el huésped vuelve a darle al botón, nace
-- una reserva nueva cada vez: el 5-nov salieron cinco de Daniel Grabenbauer en
-- siete minutos y tres de Féline ten Cate en 45 segundos. Esas reservas tienen
-- que poder verse -son la prueba de que algo se rompió- pero no son gente que
-- venga ni dinero que entre.
--
-- Lo que menos se ve y más estorba: el cupo de la salida es un contador que se
-- sube al reservar y se baja al cancelar. Noche Mexicana del 6-nov decía 15
-- personas cuando venían 7. Por eso marcar un intento no es sólo poner una
-- bandera: tiene que bajar el cupo, y devolverlo si resulta que sí era una
-- reserva. Eso es sinc_reserva_intento.

alter table sinc_reservas
  add column if not exists intento      boolean not null default false,
  add column if not exists intento_at   timestamptz,
  add column if not exists intento_por  text,
  add column if not exists intento_nota text;

create index if not exists sinc_reservas_intento_idx
  on sinc_reservas (salida_id) where intento;

comment on column sinc_reservas.intento is
  'Reserva nacida de un reintento de pago que no llegó a cobrarse. No es venta, no ocupa cupo, no sale en Programación.';

create or replace function public.sinc_reserva_intento(
  p_reserva uuid,
  p_si      boolean default true,
  p_nota    text    default null
) returns sinc_reservas
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_r sinc_reservas;
begin
  if not coalesce(es_equipo_casa(), false) then
    raise exception 'Esto lo marca quien trabaja en la casa';
  end if;

  select * into v_r from sinc_reservas where id = p_reserva for update;
  if v_r.id is null then raise exception 'Esa reserva no existe'; end if;
  if coalesce(v_r.intento, false) = coalesce(p_si, true) then return v_r; end if;

  /* El cupo sigue a la bandera: deja de ocupar sitio al marcarlo, y lo vuelve
     a ocupar si resulta que sí era una reserva de verdad. */
  if v_r.salida_id is not null and v_r.cancelada_at is null then
    if p_si then
      update sinc_salidas set cupo_tomado = greatest(0, cupo_tomado - coalesce(v_r.pax,0)),
             updated_at = now() where id = v_r.salida_id;
    else
      update sinc_salidas set cupo_tomado = cupo_tomado + coalesce(v_r.pax,0),
             updated_at = now() where id = v_r.salida_id;
    end if;
  end if;

  update sinc_reservas
     set intento      = p_si,
         intento_at   = case when p_si then now() else null end,
         intento_por  = case when p_si then auth.email() else null end,
         intento_nota = case when p_si then p_nota else null end
   where id = p_reserva
   returning * into v_r;

  return v_r;
end $function$;

revoke all on function public.sinc_reserva_intento(uuid, boolean, text) from public;
grant execute on function public.sinc_reserva_intento(uuid, boolean, text) to authenticated;

-- Las vistas y el portal del operador llevan la bandera para poder esconderla:
-- v_sinc_portal, v_sinc_ventas y op_portal_ventas_de ganan `intento` e
-- `intento_nota` al final (se recrean enteras en la base; aquí sólo queda la
-- nota de que la columna viaja hasta las pantallas).
