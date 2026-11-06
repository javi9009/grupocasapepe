-- 6-nov-2026 · El dueño del portal nacía sin «Mi cuenta».
--
-- Javi: «Tania sigue teniendo problemas con su portal. Le comenté que tenía que
-- hacer lo de su Stripe, pero me comenta que no le aparece el apartado de Mi
-- cuenta». Y la foto de su celular: Resumen · Eventos · Mis ventas ·
-- Programación · Boletos. Nada más.
--
-- Esa lista no es un fallo de pintado: es exactamente `op_roles.areas` del
-- papel COORDINADOR —exp, eventos, arte, ventas, prog, boletos, hoteles—. Y
-- `aplicaPapel`, en operador.html, hace lo que debe: esconde los botones que no
-- son suyos y, si un desplegable se queda sin hijos visibles, se lo lleva
-- entero. «Mi cuenta» desapareció porque sus cuatro hijos —Mi impacto,
-- Galería, Mi equipo, Mis datos— son todos de áreas que coordinador no tiene.
--
-- La pregunta buena no era por qué no se ve, sino por qué Tania es
-- coordinadora de su propia empresa. Y la respuesta estaba en el alta:
-- `alta_por_portal` creaba la fila de quien se da de alta con rol
-- 'coordinador'. Quien abre su ficha por el portal ES el titular, así que cada
-- alta por portal nacía con un negocio que no podía cobrar: sin «Mi cuenta» no
-- se vincula el Stripe y no se firma el convenio, que son justo las dos cosas
-- que faltaban para poder vender. Coordinador además lleva lleva_equipo=false,
-- así que tampoco podía arreglárselo ella dándose otro papel.
--
-- No era sólo Tania. Cinco casas activas estaban igual, todas con su titular
-- como coordinador: Flow Latino Mx, Caro's Tours, Tepito Chido Tour,
-- Volcanic Quest y Alejandro Rivera.
--
-- Se arregla en los tres sitios, porque uno solo no basta:

-- 1) EL ALTA. Las dos firmas de alta_por_portal pasan a crear al titular como
--    admin. Aplicado con un parche textual sobre pg_get_functiondef para no
--    reescribir dos cuerpos enteros por una palabra:
--
--      do $do$ declare r record; v_def text; v_new text;
--      begin
--        for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--                  where p.prokind='f' and n.nspname='public' and p.proname='alta_por_portal'
--        loop
--          v_def := pg_get_functiondef(r.oid);
--          v_new := replace(v_def, '''coordinador'', true);', '''admin'', true);');
--          if v_new <> v_def then execute v_new; end if;
--        end loop;
--      end $do$;

-- 2) LA RED, EN mi_papel_op. Un papel mal escrito no puede volver a dejar una
--    casa sin nadie que entre a cobrar. Si en ese operador no hay NINGÚN admin
--    activo, el papel de admin lo tiene el usuario activo más antiguo, que es
--    quien abrió la ficha. No mira correos —el de contacto puede ser el de la
--    contadora— sino quién llegó primero.
--
--    Cuerpo vigente: select pg_get_functiondef('public.mi_papel_op'::regproc);
--
--      efectivo as (
--        select y.*,
--               case when y.rol = 'admin' then 'admin'
--                    when not exists (select 1 from tour_operador_usuarios a
--                                      where a.operador_id = y.operador_id
--                                        and a.activo and a.rol = 'admin')
--                     and y.id = (select a.id from tour_operador_usuarios a
--                                  where a.operador_id = y.operador_id and a.activo
--                                  order by a.created_at asc, a.id asc limit 1)
--                    then 'admin'
--                    else y.rol end as rol_ef
--          from yo y
--      )
--
--    El jsonb pasa a devolver `rol_ef` y a unir op_roles por él, así que las
--    áreas que llegan al portal son las del papel que de verdad manda.

-- 3) EL DATO. Los cinco titulares suben a admin, para que la tabla diga la
--    verdad y la red sea red y no el único soporte:

update tour_operador_usuarios u
   set rol = 'admin'
 where u.activo
   and u.rol <> 'admin'
   and not exists (select 1 from tour_operador_usuarios a
                    where a.operador_id = u.operador_id and a.activo and a.rol='admin')
   and u.id = (select a.id from tour_operador_usuarios a
                where a.operador_id = u.operador_id and a.activo
                order by a.created_at asc, a.id asc limit 1)
   and exists (select 1 from tour_operadores o
                where o.id = u.operador_id and o.estado = 'activo');

-- Comprobado después: 0 portales activos con gente dentro y sin ningún admin.
--
-- Lo que no se tocó: operador.html. `aplicaPapel` no tenía nada que arreglar
-- —estaba obedeciendo un papel equivocado—, y esconder lo que no es tuyo sigue
-- siendo lo correcto. El fallo estaba una capa antes, en quién dice qué eres.
