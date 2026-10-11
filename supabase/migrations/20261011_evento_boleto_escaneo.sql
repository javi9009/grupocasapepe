-- ESCANEAR EL BOLETO DE UN EVENTO EN LA PUERTA.
--
-- Javi, 11-oct-2026: «permíteme aquí poner el boleto y escanear boleto. También
-- falta en el menú de productora un botón arriba de escanear boletos que vaya
-- marcando en mis reservas los boletos ya escaneados».
--
-- QUÉ FALTABA. El verificador de casa (m/sinc-verificar.html) dice que sirve
-- para «tours, eventos y funciones», pero sinc_verificar_boleto sólo mira
-- sinc_boletos: los boletos de evento viven en evento_reservas.qr_token y no los
-- encontraba nunca. Decía «no es de aquí» de un boleto que sí era de aquí.
--
-- CÓMO SE CUENTA. En tours hay una fila por persona (sinc_boletos). En eventos
-- hay una reserva con pax personas y UN solo QR: la familia llega junta y enseña
-- el mismo pase. Así que no se marca «usado» sí o no, se CUENTA: cada escaneo
-- suma una persona hasta llegar a pax. Al tercer escaneo de una reserva de tres,
-- el siguiente avisa de que ya entraron todos. El portero ve «2 de 3» y sabe si
-- falta gente por llegar, que es justo lo que pasa en una puerta de verdad.
--
-- QUIÉN PUEDE. La productora con el token de su portal, y sólo sobre sus
-- eventos. El equipo de casa, con su sesión, sobre cualquiera. Nadie más: la
-- función es SECURITY DEFINER y comprueba antes de tocar nada.

alter table public.evento_reservas
  add column if not exists usados    integer not null default 0,
  add column if not exists usado_at  timestamptz,
  add column if not exists usado_por text;

comment on column public.evento_reservas.usados is
  'Cuántas de las pax personas de esta reserva ya pasaron la puerta.';

create or replace function public.evento_verificar_boleto(
  p_codigo text,
  p_token  uuid default null,
  p_marcar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_cod text := upper(trim(coalesce(p_codigo,'')));
  r  record;
  e  record;
  v_prod uuid;
  v_quien text;
begin
  if v_cod = '' then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;

  /* El QR trae el qr_token; a mano se teclea el folio. Valen los dos. */
  select * into r from evento_reservas
   where upper(coalesce(qr_token,'')) = v_cod
      or upper(coalesce(folio,''))    = v_cod
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrado', 'codigo', v_cod);
  end if;

  /* LA PUERTA. Con token, la productora dueña y nadie más. Sin token, el
     equipo de casa con su sesión. */
  if p_token is not null then
    select p.id, p.nombre_comercial into v_prod, v_quien
      from productoras p
     where p.portal_token = p_token and coalesce(p.estado,'') <> 'baja'
     limit 1;
    if v_prod is null or r.productora_id is distinct from v_prod then
      raise exception 'Ese boleto no es de tus eventos.' using errcode = '42501';
    end if;
    v_quien := coalesce(v_quien, 'productora');
  else
    if not public.es_equipo_casa() then
      raise exception 'No puedes validar boletos.' using errcode = '42501';
    end if;
    v_quien := coalesce(auth.jwt()->>'email', 'equipo');
  end if;

  select * into e from eventos where id = r.evento_id;

  if coalesce(r.estado,'') = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'reserva_cancelada',
      'codigo', v_cod, 'folio', r.folio, 'titular', r.nombre,
      'experiencia', e.nombre, 'fecha', e.fecha_inicio);
  end if;

  /* Un boleto de pago sin pagar no entra. Uno gratuito, sí: no hay nada que
     cobrar y la reserva es el lugar apartado. */
  if coalesce(r.pago_estado,'') <> 'pagado' and coalesce(r.pago_total, r.total, 0) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sin_pagar',
      'codigo', v_cod, 'folio', r.folio, 'titular', r.nombre,
      'experiencia', e.nombre, 'fecha', e.fecha_inicio,
      'debe', coalesce(r.pago_total, r.total, 0));
  end if;

  if coalesce(r.usados,0) >= coalesce(r.pax,1) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_usado',
      'codigo', v_cod, 'folio', r.folio, 'titular', r.nombre,
      'experiencia', e.nombre, 'fecha', e.fecha_inicio,
      'pax', r.pax, 'usados', r.usados,
      'usado_at', r.usado_at, 'usado_por', r.usado_por);
  end if;

  if p_marcar then
    update evento_reservas
       set usados = coalesce(usados,0) + 1,
           usado_at = now(),
           usado_por = v_quien
     where id = r.id
     returning * into r;
  end if;

  return jsonb_build_object('ok', true,
    'codigo', v_cod, 'folio', r.folio, 'titular', r.nombre,
    'experiencia', coalesce(e.nombre, '(sin evento)'),
    'fecha', e.fecha_inicio, 'espacio', e.espacio,
    'tipo', coalesce(r.tier_nombre, 'General'),
    'numero', coalesce(r.usados, 1), 'de', coalesce(r.pax, 1),
    'pax', r.pax, 'usados', r.usados);
end $fn$;

grant execute on function public.evento_verificar_boleto(text, uuid, boolean) to anon, authenticated;

-- UN SOLO VERIFICADOR. El de la puerta de casa no tiene por qué saber si lo que
-- le enseñan es un tour o un concierto: prueba en los boletos de tour y, si ahí
-- no está, prueba en los de evento. Antes decía «no es de aquí».
create or replace function public.sinc_verificar_boleto(p_codigo text, p_marcar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare b record; r record; s record; v_exp uuid; v_nombre text;
begin
  select * into b from sinc_boletos where upper(codigo) = upper(trim(p_codigo)) limit 1;
  if not found then
    -- ¿será un boleto de evento? Ahí la puerta la pone evento_verificar_boleto.
    return public.evento_verificar_boleto(p_codigo, null, p_marcar);
  end if;

  select * into r from sinc_reservas where id = b.reserva_id;
  select * into s from sinc_salidas  where id = b.salida_id;

  -- la ficha: por la reserva, o por la salida a través del catálogo viejo
  v_exp := r.op_experiencia_id;
  if v_exp is null and s.experiencia_id is not null then
    select coalesce(e.op_experiencia_id, null), e.nombre
      into v_exp, v_nombre
      from experiencias e where e.id = s.experiencia_id;
  end if;
  if v_nombre is null and v_exp is not null then
    select o.nombre into v_nombre from op_experiencias o where o.id = v_exp;
  end if;

  if not public.sinc_puede_validar(b.salida_id, v_exp) then
    raise exception 'No puedes validar boletos de esta experiencia.' using errcode = '42501';
  end if;

  if coalesce(r.estado,'') = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'reserva_cancelada',
      'codigo', b.codigo, 'experiencia', v_nombre, 'titular', coalesce(b.titular, r.nombre));
  end if;

  if b.usado then
    return jsonb_build_object('ok', false, 'motivo', 'ya_usado',
      'codigo', b.codigo, 'experiencia', v_nombre, 'fecha', s.fecha, 'hora', s.hora,
      'titular', coalesce(b.titular, r.nombre), 'usado_at', b.usado_at, 'usado_por', b.usado_por);
  end if;

  if p_marcar then
    update sinc_boletos set usado = true, usado_at = now(),
           usado_por = coalesce(auth.jwt()->>'email','') where id = b.id;
  end if;

  return jsonb_build_object('ok', true, 'codigo', b.codigo,
    'experiencia', coalesce(v_nombre,'(sin ficha)'),
    'fecha', s.fecha, 'hora', s.hora,
    'titular', coalesce(b.titular, r.nombre), 'tipo', b.tipo, 'numero', b.numero,
    'de', coalesce(r.adultos,0) + coalesce(r.menores,0), 'folio', r.folio);
end $function$;

-- Y el portal de la productora necesita ver el resultado: cuántos entraron, de
-- cuándo es el último escaneo, y la foto del evento para la vista de galería.
-- El qr_token NO viaja: el boleto se abre por folio, que es la llave que ya
-- tiene el cliente en su correo.
create or replace function public.prod_portal_reservas(p_token uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
      'folio', r.folio,
      'evento_id', r.evento_id,
      'evento', e.nombre,
      'evento_fecha', e.fecha_inicio,
      'evento_espacio', e.espacio,
      'evento_estado', e.estado,
      'evento_foto', e.fotos->0->>'url',
      'tier', r.tier_nombre,
      'pax', r.pax,
      'nombre', r.nombre,
      'email', r.email,
      'telefono', r.telefono,
      'moneda', coalesce(r.moneda,'MXN'),
      'pvp_unitario', r.pvp_unitario,
      'total', r.total,
      'pago_total', r.pago_total,
      'descuento', r.descuento_mxn,
      'codigo', r.codigo,
      'estado', r.estado,
      'pago_estado', r.pago_estado,
      'pagado_at', r.pagado_at,
      'canal', r.canal,
      'notas', r.notas,
      'created_at', r.created_at,
      'dia', r.dia,
      'hora_desde', r.hora_desde,
      'hora_hasta', r.hora_hasta,
      'usados', coalesce(r.usados,0),
      'usado_at', r.usado_at,
      'usado_por', r.usado_por,
      'devolveria', case when r.pago_estado = 'pagado'
                        then coalesce(r.pago_total, r.total, 0) else 0 end,
      'cancelable', (coalesce(r.estado,'') <> 'cancelada')
    ) as x
    from evento_reservas r
    left join eventos e on e.id = r.evento_id
    where r.productora_id = (select p.id from productoras p
                              where p.portal_token = p_token
                                and coalesce(p.estado,'') <> 'baja' limit 1)
  ) z;
$function$;
