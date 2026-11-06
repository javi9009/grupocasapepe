-- 6-nov-2026 · El cobro dividido se rompió en cuanto el operador conectó su Stripe.
--
-- sinc_cobro_plan existe "para que no haya dos cuentas", y tenía dentro la
-- segunda: recalculaba nuestra parte por porcentaje (25% de 1,148 = 287.00)
-- cuando la reserva ya la traía hecha por sinc_reservar_parte sobre el neto
-- exacto del operador (1,148 - 861.20 = 286.80). Esos veinte centavos hacían
-- que el resto saliera negativo; saltaba la red de seguridad, se apagaba el
-- cobro dividido y el cargo nacía en la cuenta del operador reteniendo el 100%
-- del importe como comisión. Stripe rechaza siempre un cargo así.
--
-- Resultado: Noche Mexicana de Capital Bus no se pudo cobrar desde el 5-nov a
-- las 02:52 -ocho reservas de dos huéspedes reintentando-, y a las cuatro que
-- sí pagaron el 4-nov les dejó pago_resto en cero, o sea su boleto no pedía los
-- $861.20 que el guía debía cobrar.
--
-- Dos cambios:
--   1. El reparto no se recalcula: se lee del neto del operador que la reserva
--      ya lleva grabado.
--   2. Regla dura: si nuestra comisión se come el cargo entero, ese dinero es
--      nuestro, así que el cargo nace en NUESTRA cuenta y sin comisión.
--
-- Las claves que devuelve no cambian: sinc-pago y sinc-stripe-checkout siguen
-- leyendo lo mismo.

create or replace function public.sinc_cobro_plan(p_reserva uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  r sinc_reservas; e op_experiencias; op tour_operadores;
  v_pct numeric; v_div boolean;
  v_tour numeric; v_extras numeric; v_total numeric;
  v_ahora numeric; v_resto numeric; v_cent bigint;
  v_destino text; v_fee bigint; v_costo bigint;
begin
  select * into r from sinc_reservas where id = p_reserva;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'Esa reserva no existe');
  end if;

  select * into e  from op_experiencias where id = r.op_experiencia_id;
  select * into op from tour_operadores  where id = e.operador_id;

  v_pct := coalesce(r.comision_pct, e.comision_pct, op.comision_pct, 25);

  v_tour   := coalesce(r.total, 0);
  v_extras := round(coalesce(r.seguro_mxn, 0) + coalesce(r.propina_mxn, 0), 2);
  v_total  := round(v_tour + v_extras, 2);

  /* El reparto, de una sola fuente: el neto del operador que la reserva ya
     lleva grabado. No se recalcula por porcentaje. */
  if coalesce(sinc_es_cobro_dividido(r.op_experiencia_id), false)
     and coalesce(r.neto_operador, 0) > 0
     and r.neto_operador < v_tour then
    v_resto := round(r.neto_operador, 2);
    v_ahora := round(v_total - v_resto, 2);
    v_div   := true;
  else
    v_ahora := v_total;
    v_resto := 0;
    v_div   := false;
  end if;

  /* Red de seguridad: nunca un cargo de cero -Stripe lo rechaza y la venta se
     moriría ahí- ni un resto que no cuadre con el total. */
  if v_ahora <= 0 or v_resto < 0 or v_ahora > v_total then
    v_ahora := v_total; v_resto := 0; v_div := false;
  end if;

  v_cent := (round(v_ahora * 100))::bigint;

  v_destino := case
                 when v_div then null
                 when coalesce(op.stripe_account_id,'') <> ''
                      and op.stripe_charges_enabled is not false
                   then op.stripe_account_id
               end;

  /* Nuestra parte cuando el cargo nace en la cuenta del operador. La cobertura
     y la propina viajan enteras en la comisión: no son suyas. */
  v_fee := case
             when v_destino is null then 0
             else least((round((v_tour * v_pct / 100.0 + v_extras) * 100))::bigint, v_cent)
           end;

  /* La regla dura. Stripe no deja que la comisión se quede con todo el cargo:
     tiene que sobrar al menos lo que cobra Stripe. Si no sobra, no hay nada
     que repartir -el dinero es nuestro-, así que se cobra en nuestra cuenta. */
  if v_destino is not null then
    v_costo := (ceil(v_cent * 0.036) + 300)::bigint;
    if v_fee >= v_cent - v_costo then
      v_destino := null; v_fee := 0;
    end if;
  end if;

  return jsonb_build_object(
    'ok',             true,
    'dividido',       v_div,
    'pct',            v_pct,
    'moneda',         lower(coalesce(r.pago_moneda, r.moneda, 'MXN')),
    'total',          v_total,
    'ahora',          v_ahora,
    'ahora_centavos', v_cent,
    'resto',          v_resto,
    'destino',        v_destino,
    'fee_centavos',   v_fee,
    'operador',       op.nombre_comercial,
    'folio',          r.folio,
    'pax',            r.pax
  );
end $function$;
