-- 13-nov-2026 · Ninguna de las tres apps medía nada.
--
-- Javi pidió un analytics de la App Huésped de los últimos 15 días y, al
-- montarlo, «pon también un analytics de dashboard y otro de SoyPepe».
--
-- De las siete cosas que pedía —personas al día, duración, recurrencia,
-- pantallas, reservas, rebote— sólo se podía contestar una. Ninguna de las
-- tres apps tiene Analytics ni tabla propia: sus llamadas a la base son todas
-- funcionales y ninguna deja constancia de que alguien las abrió. Por eso el
-- análisis del 1-nov medía por rastros —check-in por app o por mostrador,
-- cartas emitidas—: era lo único que dejaba huella. De 442 huéspedes, 46
-- habían hecho algo.
--
-- UNA TABLA PARA LAS TRES, no una por app. Las preguntas son las mismas
-- —quién entra, cuánto se queda, qué mira, si vuelve— y tres tablas serían
-- tres sitios donde arreglar el mismo cálculo. La columna `app` las separa
-- cuando hace falta y las suma cuando interesa.
--
-- QUÉ SE GUARDA, Y QUÉ NO. Quién (la reserva, o el correo en las apps de
-- equipo), la sede, la pantalla y la hora. No el user-agent: para saber si
-- una app se usa no hace falta saber con qué teléfono, y lo que no se guarda
-- no se filtra. El dispositivo se queda en «móvil» o «escritorio», que es lo
-- único que cambia una decisión de diseño.
--
-- LA SESIÓN la pone el navegador y vive en sessionStorage: una visita es todo
-- lo que hace alguien hasta que cierra la pestaña. De ahí salen las tres
-- medidas que no existían: duración, pantallas por visita y visitas por
-- persona.
--
-- Lo medido empieza el día que se instala. Los 15 días que pidió no se pueden
-- reconstruir hacia atrás, y por eso esto vale más cuanto antes se aplique.

create table if not exists public.uso_visitas (
  id          bigserial primary key,
  app         text        not null,     -- 'huesped' | 'soypepe' | 'dashboard'
  sesion      uuid        not null,
  quien       text,                     -- reserva o correo; null = sin identificar
  sede        text,
  pantalla    text        not null,
  ref         text,                     -- el tour mirado, el módulo abierto…
  idioma      text,
  dispositivo text,
  at          timestamptz not null default now()
);

create index if not exists uso_visitas_at_idx     on public.uso_visitas (at desc);
create index if not exists uso_visitas_app_idx    on public.uso_visitas (app, at desc);
create index if not exists uso_visitas_sesion_idx on public.uso_visitas (sesion);

alter table public.uso_visitas enable row level security;
-- Se escribe por la función y se lee por las vistas. Un registro de quién
-- mira qué no es algo que deba poder bajarse cualquiera que abra una app.
revoke all on public.uso_visitas from anon, authenticated;

create or replace function public.uso_ping(
  p_app      text,
  p_sesion   uuid,
  p_pantalla text,
  p_quien    text default null,
  p_sede     text default null,
  p_ref      text default null,
  p_idioma   text default null,
  p_disp     text default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_sesion is null or coalesce(trim(p_pantalla),'') = '' then return; end if;
  -- Nada que venga del navegador entra crudo.
  insert into uso_visitas (app, sesion, quien, sede, pantalla, ref, idioma, dispositivo)
  values (
    case lower(coalesce(p_app,'')) when 'soypepe' then 'soypepe'
                                   when 'dashboard' then 'dashboard'
                                   else 'huesped' end,
    p_sesion,
    left(nullif(trim(p_quien),''), 80),
    left(nullif(trim(p_sede),''), 30),
    left(trim(p_pantalla), 48),
    left(nullif(trim(p_ref),''), 60),
    left(nullif(trim(p_idioma),''), 5),
    case when lower(coalesce(p_disp,'')) like 'mov%' then 'movil' else 'escritorio' end
  );
end $$;

grant execute on function public.uso_ping(text,uuid,text,text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------- las vistas

create or replace view public.v_uso_sesiones as
select
  v.sesion,
  min(v.app)                                       as app,
  min(v.quien)                                     as quien,
  min(v.sede)                                      as sede,
  min(v.dispositivo)                               as dispositivo,
  min(v.idioma)                                    as idioma,
  min(v.at)                                        as empezo,
  max(v.at)                                        as acabo,
  extract(epoch from (max(v.at) - min(v.at)))::int as segundos,
  count(*)                                         as pings,
  count(distinct v.pantalla)                       as pantallas,
  (min(v.at) at time zone 'America/Mexico_City')::date as dia
from public.uso_visitas v
group by v.sesion;

-- El día a día: la curva que Javi quería ver.
create or replace view public.v_uso_dia as
select
  s.app, s.dia,
  count(*)                                                      as visitas,
  count(distinct s.quien) filter (where s.quien is not null)    as personas,
  round(avg(s.segundos))                                        as seg_medios,
  round(avg(s.pantallas),1)                                     as pantallas_media,
  count(*) filter (where s.pantallas = 1)                       as rebotes
from public.v_uso_sesiones s
group by s.app, s.dia;

-- Qué se mira. Lo primero para decidir qué quitar y qué subir de sitio.
create or replace view public.v_uso_pantallas as
select
  v.app, v.pantalla,
  count(*)                  as vistas,
  count(distinct v.sesion)  as visitas,
  count(distinct v.quien)   as personas,
  max(v.at)                 as ultima
from public.uso_visitas v
group by v.app, v.pantalla;

-- Vuelve o no vuelve. Una app que se abre una vez y nunca más no tiene un
-- problema de tráfico: tiene un problema de para qué sirve.
create or replace view public.v_uso_recurrencia as
select app, quien, count(*) as visitas, min(empezo) as primera, max(acabo) as ultima
from public.v_uso_sesiones
where quien is not null
group by app, quien;

grant select on public.v_uso_sesiones, public.v_uso_dia,
                public.v_uso_pantallas, public.v_uso_recurrencia to authenticated;

-- Alta de la pantalla en el panel. El área CRM ya existe (MENU2-CRM).
insert into paginas (codigo, nombre, app, area, area_orden, parent_codigo, orden, ruta, activo, default_nivel, en_menu, tipo)
values ('PAG-CRM-USO','📈 Uso de las apps','dashboard','CRM',8,'MENU2-CRM',30,'/m/crm-uso.html',true,'none',true,'pagina')
on conflict (codigo) do update set nombre=excluded.nombre, ruta=excluded.ruta,
  area=excluded.area, parent_codigo=excluded.parent_codigo, orden=excluded.orden,
  activo=true, en_menu=true;

insert into rol_permisos (pagina_codigo, rol, nivel)
select 'PAG-CRM-USO', rol, 'ver' from (values ('Director'),('Gerente Regional Operativo'),('Gerente Administrativo')) t(rol)
on conflict do nothing;

-- PENDIENTE: cruzar pantalla='tour' con las reservas creadas para tener la
-- conversión y el rebote de compra. Hasta que no haya unos días de pings, el
-- cruce no dice nada.
