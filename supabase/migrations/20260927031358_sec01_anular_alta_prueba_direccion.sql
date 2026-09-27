-- Contención 26-sep-2026: el alta de prueba con el correo de dirección tenía un enlace vivo
-- que operador-password aceptaba para poner contraseña a la cuenta existente.
update public.tour_operador_altas
   set cuenta_creada_at = coalesce(cuenta_creada_at, now()), estado = 'descartada',
       token = encode(gen_random_bytes(20),'hex')
 where lower(email) = 'javi@casapepe.mx' and cuenta_creada_at is null;
