-- 6-nov-2026 · Capital Bus pasa a cobrar por su Stripe.
--
-- Javi: «Capital Bus cobra por Stripe. Ya lo conectó, por favor configúralo
-- así». Conectó su cuenta el 4-nov a las 09:58 (acct_1TCQax…, cobros y
-- transferencias habilitados, sin requisitos pendientes), así que se acabó el
-- cobro dividido: el huésped paga el tour entero con tarjeta, el cargo nace en
-- la cuenta de Capital Bus y nosotros retenemos la comisión como
-- application_fee.
--
-- Hay que apagar las DOS banderas, porque sinc_es_cobro_dividido mira las dos:
-- forma_pago = 'dos_cobros' O cobro_comision_anticipada = true.

update tour_operadores
   set forma_pago = 'stripe_connect',
       cobro_comision_anticipada = false,
       updated_at = now()
 where id = 'a0c65820-09f1-4d97-9b68-5fdf3c70b694';

-- Lo vendido no se toca: las cuatro reservas pagadas del 4-nov se hicieron con
-- el trato anterior y conservan su cobro_dividido y su pago_resto de $861.20.
-- El guía las cobra en el punto de encuentro igual que se les dijo. El cambio
-- sólo rige para lo que se venda a partir de ahora.

-- NUESTRA PARTE, EXACTA.
--
-- El PVP de un tour se construye desde el neto del operador y se redondea, así
-- que el porcentaje y la resta no siempre dan lo mismo: en Noche Mexicana el
-- 25% de 1,148 son 287.00 y la comisión de verdad son 286.80 (1,148 − 861.20).
-- Reteniendo el porcentaje, a Capital Bus le llegarían veinte centavos menos de
-- su neto en cada venta. Son los mismos veinte centavos que el 5-nov dejaron
-- sin cobrar Noche Mexicana entera (doc 229): cuando dos sitios calculan lo
-- mismo de dos maneras, un día no coinciden.
--
-- Ahora manda la resta cuando el neto está grabado en la reserva, y el
-- porcentaje queda de respaldo. En sinc_cobro_plan:
--
--   v_fee := case
--              when v_destino is null then 0
--              when coalesce(r.neto_operador,0) > 0 and r.neto_operador < v_tour
--                then least((round((v_tour - r.neto_operador + v_extras) * 100))::bigint, v_cent)
--              else least((round((v_tour * v_pct / 100.0 + v_extras) * 100))::bigint, v_cent)
--            end;
--
-- Comprobado contra lo ya cobrado: Tekpan, Mexican Tales y los demás
-- stripe_connect retendrían exactamente lo mismo que retuvieron en su día
-- (1,133.00 / 283.25 / 566.75), porque su PVP sí se construyó desde el
-- porcentaje y la resta da igual. Sólo cambia donde hubo redondeo.
--
-- Cuerpo vigente: select pg_get_functiondef('public.sinc_cobro_plan'::regproc);
