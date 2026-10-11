-- Mis reservas, en el portal de la productora.
--
-- Javi, 11-oct-2026: «en el portal de la productora debe haber una pestaña de
-- mis reservas de los que le reservaron y que las pueda gestionar», «con la info
-- completa, contacto, posibilidad de cancelar la reserva y que se haga la
-- devolución completa al cliente».
--
-- Esta función es la mitad de lectura. La de cancelar vive en la función edge
-- prod-reserva-cancelar, porque mueve dinero y eso no se hace desde el navegador.
--
-- Van las reservas de SUS eventos y nada más: el filtro es el productora_id que
-- sale de su propio token. El contacto del cliente va entero —nombre, correo y
-- teléfono— porque es gente que le compró a ella y a quien tiene que poder
-- avisar si se cae una función. Lo que NO va es nada de Stripe: ni el payment
-- intent ni la sesión. No le hacen falta en pantalla, y un identificador de
-- cobro dando vueltas por el navegador es una llave de más.

create or replace function public.prod_portal_reservas(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id, 'folio', r.folio, 'evento_id', r.evento_id,
      'evento', e.nombre, 'evento_fecha', e.fecha_inicio,
      'evento_espacio', e.espacio, 'evento_estado', e.estado,
      'tier', r.tier_nombre, 'pax', r.pax,
      'nombre', r.nombre, 'email', r.email, 'telefono', r.telefono,
      'moneda', coalesce(r.moneda,'MXN'),
      'pvp_unitario', r.pvp_unitario, 'total', r.total, 'pago_total', r.pago_total,
      'descuento', r.descuento_mxn, 'codigo', r.codigo,
      'estado', r.estado, 'pago_estado', r.pago_estado, 'pagado_at', r.pagado_at,
      'canal', r.canal, 'notas', r.notas, 'created_at', r.created_at,
      'dia', r.dia, 'hora_desde', r.hora_desde, 'hora_hasta', r.hora_hasta,
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
$fn$;

grant execute on function public.prod_portal_reservas(uuid) to anon, authenticated;
