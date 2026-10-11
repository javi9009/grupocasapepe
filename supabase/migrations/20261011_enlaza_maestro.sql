-- El candado del producto maestro tenía cerrada la puerta de entrada.
--
-- Javi, 11-oct-2026: «dice que no tiene precio y no deja; recuerda que los que
-- son gratis tienen que dejar apartar lugar».
--
-- QUÉ PASABA. Una ficha de venta (op_experiencias) cuelga de un producto
-- maestro (experiencias). Cuando no tiene maestro, sinc_asegura_salida le crea
-- uno y la enlaza, al vuelo, al crear la primera salida. Pero el trigger
-- op_exp_guarda_estado clavaba experiencia_id al valor viejo para TODO el que
-- no es del equipo de casa —y un huésped que reserva no lo es—, así que el
-- enlace se deshacía en silencio: sin error y sin aviso. Un rato después
-- sinc_reservar buscaba la ficha por experiencia_id, no encontraba nada, y
-- contestaba «Esa experiencia todavía no tiene precio cargado; no se puede
-- reservar». El mensaje era verdad desde dentro y mentira desde fuera.
--
-- Con un tour gratis se veía clarísimo: precio cero, el checkout diciendo
-- «apartar para 1 persona», y aun así no dejaba. Pero no era cosa de los
-- gratuitos: 258 de las 286 fichas no tienen maestro, así que NINGUNA se podía
-- reservar desde la web si quien reservaba no era del equipo de casa.
--
-- QUÉ SE HACE. El candado se queda —un operador no puede colgar su ficha del
-- producto maestro de otro y cobrar sus salidas— pero con una puerta estrecha:
-- sólo cuando la ficha NO tenía maestro (nunca se repunta uno ya puesto) y sólo
-- si lo pide nuestra propia función, por una bandera local a la transacción.
-- Nadie la puede poner desde fuera: no hay manera de mandar un set_config por
-- PostgREST.
--
-- Y sinc_asegura_salida comprueba el enlace antes de seguir. Un enlace que falla
-- en silencio es justo lo que costó esto: mejor un error que diga la verdad.

create or replace function public.op_exp_guarda_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if public.es_operador_externo() then
    -- el operador nunca publica: eso lo decide Casa Pepe
    if new.estado = 'publicada' and coalesce(old.estado,'') not in ('publicada','pausada') then
      raise exception 'Publicar una experiencia lo autoriza Casa Pepe';
    end if;
    if tg_op = 'INSERT' and new.estado not in ('borrador','en_revision') then
      new.estado := 'borrador';
    end if;

    if not (tg_op = 'UPDATE'
            and old.experiencia_id is null
            and coalesce(current_setting('app.enlaza_maestro', true), '') = '1') then
      new.experiencia_id := case when tg_op='UPDATE' then old.experiencia_id else null end;
    end if;

    new.publicada_at := case when tg_op='UPDATE' then old.publicada_at else null end;
  end if;
  new.updated_at := now();
  if new.estado = 'publicada' and new.publicada_at is null then new.publicada_at := now(); end if;
  return new;
end $fn$;

create or replace function public.sinc_asegura_salida(p_op_exp uuid, p_fecha date, p_hora time without time zone)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_exp op_experiencias; v_maestro uuid; v_sal uuid;
begin
  select * into v_exp from op_experiencias where id = p_op_exp;
  if v_exp.id is null then raise exception 'Esa experiencia no existe'; end if;
  if v_exp.estado <> 'publicada' then raise exception 'Esa experiencia no está publicada'; end if;

  -- si la ficha todavía no cuelga de un producto maestro, se le crea el suyo
  v_maestro := v_exp.experiencia_id;
  if v_maestro is null then
    insert into experiencias (nombre, estatus) values (v_exp.nombre, 'activo') returning id into v_maestro;
    perform set_config('app.enlaza_maestro', '1', true);
    update op_experiencias set experiencia_id = v_maestro where id = p_op_exp;
    perform set_config('app.enlaza_maestro', '', true);
    if not exists (select 1 from op_experiencias
                    where id = p_op_exp and experiencia_id = v_maestro) then
      raise exception 'No se pudo enlazar la ficha con su producto maestro';
    end if;
  end if;

  select id into v_sal from sinc_salidas
   where experiencia_id = v_maestro and fecha = p_fecha and hora = p_hora limit 1;

  if v_sal is null then
    insert into sinc_salidas (experiencia_id, fecha, hora, cupo_max, cupo_min,
                              punto_encuentro, idioma, origen, operacion)
    values (v_maestro, p_fecha, p_hora, v_exp.cupo_max,
            case when v_exp.requiere_minimo then v_exp.cupo_min end,
            v_exp.cer_inicio_lugar,
            case when array_length(v_exp.idiomas,1) > 0 then v_exp.idiomas[1] end,
            'manual', case when v_exp.tipo = 'propio' then 'propia' else 'tercero' end)
    returning id into v_sal;
  end if;
  return v_sal;
end $fn$;
