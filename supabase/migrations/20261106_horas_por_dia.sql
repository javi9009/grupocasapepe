-- 6-nov-2026 · Una salida puede tener sus propios días.
--
-- Javi: «Las Luchas son a horas distintas dependiendo del día, martes 18:00 y
-- viernes 18:30. ¿Cómo podemos hacer para que un tour arranque a una hora
-- distinta dependiendo del día?».
--
-- No se podía porque la disponibilidad MULTIPLICA: días × horas. Con días
-- [Mar, Vie] y horas [18:00, 18:30] no salían dos salidas, salían cuatro —
-- martes a las 18:30 y viernes a las 18:00 incluidos, que no existen. Las horas
-- eran de la experiencia entera, no de cada día.
--
-- Existe sinc_horarios, que ya guarda una fila por días + hora y es la forma
-- buena; pero nada de lo público la lee —el escaparate, el cupo, el cierre y
-- los bloqueos de iCal van todos por op_experiencias.dias/horas—, así que
-- engancharla era mover el circuito entero. Esto es lo pequeño: cada hora dice
-- a qué días aplica.
--
-- La forma: {"18:00":["Mar"],"18:30":["Vie"]}, con la llave en HH:MM. Va
-- indexado por la hora y no por posición, así que reordenar o quitar una salida
-- no descoloca nada. Una hora que no aparece, o que aparece con la lista vacía,
-- vale para todos los días de la ficha: las fichas que ya existen siguen
-- funcionando igual sin tocarlas (comprobado contra Tolantongo, Teotihuacán,
-- el bike tour y Mexicanismos: mismos huecos que antes).
--
-- Lo vendido no se mueve: la salida guarda su propia hora, así que cambiar esta
-- configuración nunca cambia la hora de una reserva hecha.
-- El cierre sigue cuadrando solo: sinc_cierre_at se calcula por (fecha, hora),
-- así que un corte rodante sigue la hora de verdad de cada día.

alter table op_experiencias
  add column if not exists horas_dias jsonb;

comment on column op_experiencias.horas_dias is
  'Días de cada salida, por hora: {"18:00":["Mar"],"18:30":["Vie"]}. Hora ausente o lista vacía = todos los días de `dias`.';

-- En sinc_disponibilidad, el `cross join dias × horas` pasa a filtrar por los
-- días que declara cada hora. El cuerpo completo está aplicado en la base; el
-- cambio es este:
--
--   horas as (
--     select h::time as t,
--            coalesce((select array_agg(x) from jsonb_array_elements_text(
--                        e.horas_dias -> substr(h, 1, 5)) x), '{}'::text[]) as sus_dias
--       from unnest(coalesce(e.horas, '{}')) h
--   ),
--   puestas as (
--     select ... from dias d cross join horas x left join sinc_salidas s on ...
--      where cardinality(x.sus_dias) = 0
--         or v_dias[extract(dow from d.f)::int + 1] = any(x.sus_dias)
--   ),
--
-- Ver el cuerpo vigente con:
--   select pg_get_functiondef('public.sinc_disponibilidad'::regproc);

-- Y la ficha de las Luchas, que decía Sábado 18:00 y estaba como «bajo
-- demanda», queda con sus dos días de verdad:
update op_experiencias
   set dias = array['Mar','Vie'],
       horas = array['18:00','18:30'],
       horas_fin = array['22:00','22:30'],
       horas_dias = '{"18:00":["Mar"],"18:30":["Vie"]}'::jsonb,
       calendario_modo = 'semanal',
       updated_at = now()
 where id = '7329e196-8769-41b7-9351-3dcc75fe6dfa';
