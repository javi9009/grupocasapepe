-- ============================================================================
-- EDITAR UN SERVICIO ESPECIAL · op_especial_guardar
-- Javi, 20-nov-2026: «permítenos editar los servicios especiales porque igual
-- metemos más servicios», con la cesta de La Cósmica y el luchador.
--
-- Por qué una función nueva y no op_especial_editar: esa quedó con dos firmas
-- y PostgREST no sabe elegir entre funciones sobrecargadas (PGRST203) —
-- contestaría 300 a toda llamada. Aquí se borran las dos y nace una sola, con
-- un nombre que no se puede confundir.
--
-- Lo que aprendimos de paso: «lo que incluye» NO vive en op_servicios_dados,
-- vive en op_servicios (la ficha del servicio). Escribirlo en el dado
-- reventaba al primer guardado.
--
-- La unidad se guarda porque la cesta lo exige: una cesta de 60 tacos y 20
-- cervezas es un importe DEL GRUPO, no por persona, y el luchador también. Si
-- se dejara en «por persona», la conciliación multiplicaría por 20.
-- ============================================================================

drop function if exists public.op_especial_editar(uuid, integer, numeric, text, text, date);
drop function if exists public.op_especial_editar(uuid, integer, numeric, text, text, date, boolean, numeric, jsonb);

create or replace function public.op_especial_guardar(
  p_dado          uuid,
  p_personas      integer default null,
  p_precio        numeric default null,
  p_unidad        text    default null,
  p_incluye       text    default null,
  p_nota          text    default null,
  p_fecha         date    default null,
  p_luchador      boolean default null,
  p_luchador_neto numeric default null,
  p_cesta         jsonb   default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_srv uuid; v jsonb;
begin
  -- De quién es: del equipo de la casa, o del touroperador dueño del servicio.
  select d.servicio_id into v_srv
    from op_servicios_dados d
   where d.id = p_dado
     and (public.es_equipo_casa() or exists (
           select 1 from tour_operador_usuarios tu
            where tu.operador_id = d.operador_id and tu.user_id = auth.uid()));
  if v_srv is null then
    return jsonb_build_object('ok', false, 'error', 'Este servicio no es tuyo o no existe.');
  end if;

  -- Lo ya facturado o pagado no se reescribe: dejaría la conciliación
  -- diciendo una cosa y la factura otra.
  if exists (select 1 from op_servicios_dados
              where id = p_dado and (pago_at is not null or factura_folio is not null))
  then
    return jsonb_build_object('ok', false,
      'error', 'Este servicio ya está facturado o pagado: ya no se edita. Háblalo con contabilidad.');
  end if;

  update op_servicios_dados d
     set personas          = coalesce(p_personas, d.personas),
         precio_neto       = coalesce(p_precio, d.precio_neto),
         nota              = coalesce(nullif(trim(p_nota), ''), d.nota),
         fecha             = coalesce(p_fecha, d.fecha),
         requiere_luchador = coalesce(p_luchador, d.requiere_luchador),
         luchador_neto     = coalesce(p_luchador_neto, d.luchador_neto),
         cesta             = coalesce(p_cesta, d.cesta)
   where d.id = p_dado
  returning jsonb_build_object('ok', true, 'id', d.id, 'personas', d.personas,
            'precio_neto', d.precio_neto, 'fecha', d.fecha) into v;

  update op_servicios
     set precio_neto = coalesce(p_precio, precio_neto),
         unidad      = coalesce(nullif(trim(p_unidad), ''), unidad),
         incluye     = coalesce(nullif(trim(p_incluye), ''), incluye)
   where id = v_srv;

  return coalesce(v, jsonb_build_object('ok', false, 'error', 'No encuentro ese servicio.'));
end $$;

grant execute on function public.op_especial_guardar(
  uuid, integer, numeric, text, text, text, date, boolean, numeric, jsonb) to authenticated;

-- El descuento del menú por touroperador (Capital Bus: 25%).
alter table tour_operadores add column if not exists menu_descuento_pct numeric;
update tour_operadores set menu_descuento_pct = 25
 where menu_descuento_pct is null and nombre_comercial ilike '%capital bus%';
