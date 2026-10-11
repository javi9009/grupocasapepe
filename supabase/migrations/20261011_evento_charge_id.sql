-- La columna que faltaba y que habria dejado el webhook inutil.
--
-- evento-webhook escribia stripe_charge_id al confirmar el pago, y la columna no
-- existia. PostgREST rechaza el PATCH ENTERO cuando sobra un campo, asi que, una
-- vez dado de alta el webhook en Stripe, el cobro habria seguido quedandose en
-- «pendiente» y el boleto sin mandar -igual que ahora, pero ya sin motivo
-- aparente y con el webhook contestando 200 tan contento-.
alter table public.evento_reservas add column if not exists stripe_charge_id text;
comment on column public.evento_reservas.stripe_charge_id is
 'El cargo de Stripe. Lo escribe evento-webhook al confirmar el pago. Javi, 11-oct-2026.';
