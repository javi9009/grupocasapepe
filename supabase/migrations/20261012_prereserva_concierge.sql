-- EL QR DEL CONCIERGE, RECABLEADO. Javi, 12-oct-2026:
-- «me sigue mandando a la página de inicio del tour y no registra el descuento
--  ni el código ni la pre-reserva».
--
-- Era verdad: el QR llevaba a la FICHA del tour con el código del vendedor
-- colgado de la URL. El huésped llegaba a mirar, y el día, la hora, cuántos
-- iban y el descuento que acababan de acordar se quedaban en el teléfono del
-- Pepe. El descuento no viajaba de ninguna forma.
--
-- Ahora el trato se cierra ANTES: el concierge guarda una pre-reserva a su
-- nombre (experiencia, día, hora, personas y descuento), y el QR lleva su
-- código al CHECKOUT. El descuento lo aplica la base al calcular el cobro, con
-- el tope de la comisión de quien vende; nunca viaja en la URL, donde
-- cualquiera podría subírselo.
--
-- Dos puertas para vender: el concierge de un hotel asociado (hotel_usuarios,
-- con su reparto) y el Pepe de la casa (empleado_login -> employees), que hasta
-- hoy no tenía forma de acreditarse una venta.

create table if not exists public.sinc_prereservas(
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  op_exp uuid not null references public.op_experiencias(id) on delete cascade,
  fecha date,
  hora time,
  adultos int not null default 1,
  menores int not null default 0,
  desc_pct numeric not null default 0,
  desc_pp numeric not null default 0,
  codigo_venta text,
  hotel_usuario_id uuid references public.hotel_usuarios(id),
  employee_id uuid,
  vendedor_nombre text,
  vendedor_email text,
  creada_por text,
  created_at timestamptz not null default now(),
  caduca timestamptz not null default now() + interval '7 days',
  reserva_id uuid references public.sinc_reservas(id),
  usada_at timestamptz
);
create index if not exists sinc_prereservas_cod_idx on public.sinc_prereservas(codigo);
create index if not exists sinc_prereservas_quien_idx on public.sinc_prereservas(hotel_usuario_id, created_at desc);
alter table public.sinc_prereservas enable row level security;

-- Las tres funciones (sinc_prereserva_crea, sinc_prereserva_lee y
-- sinc_reservar_pre) están desplegadas en la base; su fuente vive ahí.
-- Resumen de quién puede llamarlas:
--   sinc_prereserva_crea  -> authenticated (quien vende sale de SU sesión)
--   sinc_prereserva_lee   -> anon (el huésped que escanea)
--   sinc_reservar_pre     -> anon/authenticated (crea la reserva desde el código)
