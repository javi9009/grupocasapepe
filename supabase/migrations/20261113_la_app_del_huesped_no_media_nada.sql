-- 13-nov-2026 · La App Huésped no medía nada.
--
-- Javi pidió un analytics de los últimos 15 días: personas al día, tiempo de
-- estancia, cuántas veces vuelve la misma persona, pantallas más usadas,
-- reservas y rebote.
--
-- De las siete cosas, hoy sólo se podía contestar una. La app no tiene
-- Analytics, ni Plausible, ni tabla propia: sus únicas llamadas a la base son
-- funcionales —guardar el check-in, pedir el quiz, crear un pedido— y ninguna
-- deja constancia de que alguien la abrió. El análisis del 1-nov medía por
-- rastros (check-in por app o por mostrador, cartas emitidas) porque era lo
-- único que dejaba huella: de 442 huéspedes, 46 habían hecho algo.
--
-- Lo medido empieza el día que se instala. Los 15 días que pidió no se pueden
-- reconstruir hacia atrás, y por eso esto vale más cuanto antes se ponga.
--
-- QUÉ SE GUARDA, Y QUÉ NO. La reserva, la sede, la pantalla y la hora. No el
-- nombre, ni el correo, ni el user-agent: para saber si la app se usa no hace
-- falta saber con qué teléfono, y lo que no se guarda no se filtra. El
-- dispositivo se queda en «móvil» o «escritorio», que es lo único que cambia
-- una decisión de diseño.
--
-- LA SESIÓN la pone el navegador y vive en sessionStorage: una visita es todo
-- lo que hace alguien hasta que cierra la pestaña. Con eso salen las tres
-- medidas que no existían: duración (del primer al último ping), páginas por
-- visita, y visitas por persona.
--
-- EL REBOTE DE RESERVAS necesita distinguir mirar de comprar, así que la
-- ficha de un tour manda su id en `ref`. Sin eso, «reservas» es un número
-- suelto: no se puede saber si entran pocas porque nadie mira o porque
-- muchos miran y no compran, que son dos problemas opuestos.

create table if not exists public.apepe_visitas (
  id          bigserial primary key,
  sesion      uuid        not null,
  reserva     text,                      -- reservation_id; null = entró sin reserva
  sede        text,
  pantalla    text        not null,
  ref         text,                      -- el tour mirado, el premio abierto…
  idioma      text,
  dispositivo text,                      -- 'movil' | 'escritorio'
  at          timestamptz not null default now()
);

create index if not exists apepe_visitas_at_idx      on public.apepe_visitas (at desc);
create index if not exists apepe_visitas_sesion_idx  on public.apepe_visitas (sesion);
create index if not exists apepe_visitas_reserva_idx on public.apepe_visitas (reserva);

alter table public.apepe_visitas enable row level security;

-- Nadie lee esta tabla con la llave pública: se escribe por la función de
-- abajo y se lee por las vistas. Un registro de quién mira qué no es algo que
-- deba poder bajarse cualquiera que abra la app.
revoke all on public.apepe_visitas from anon, authenticated;

create or replace function public.apepe_ping(
  p_sesion   uuid,
  p_pantalla text,
  p_reserva  text default null,
  p_sede     text default null,
  p_ref      text default null,
  p_idioma   text default null,
  p_disp     text default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_sesion is null or coalesce(trim(p_pantalla),'') = '' then return; end if;

  /* Un ping es lo más barato que hay, pero nada que venga del navegador entra
     crudo: todo recortado, y el dispositivo sólo puede ser una de dos cosas. */
  insert into apepe_visitas (sesion, reserva, sede, pantalla, ref, idioma, dispositivo)
  values (
    p_sesion,
    left(nullif(trim(p_reserva),''), 40),
    left(nullif(trim(p_sede),''), 30),
    left(trim(p_pantalla), 40),
    left(nullif(trim(p_ref),''), 60),
    left(nullif(trim(p_idioma),''), 5),
    case when lower(coalesce(p_disp,'')) like 'mov%' then 'movil' else 'escritorio' end
  );
end $$;

grant execute on function public.apepe_ping(uuid,text,text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------- las vistas

-- Una visita: de dónde a dónde, cuánto duró y cuántas pantallas tocó.
create or replace view public.v_apepe_sesiones as
select
  v.sesion,
  min(v.reserva)                               as reserva,
  min(v.sede)                                  as sede,
  min(v.dispositivo)                           as dispositivo,
  min(v.idioma)                                as idioma,
  min(v.at)                                    as empezo,
  max(v.at)                                    as acabo,
  extract(epoch from (max(v.at) - min(v.at)))::int as segundos,
  count(*)                                     as pings,
  count(distinct v.pantalla)                   as pantallas,
  (min(v.at) at time zone 'America/Mexico_City')::date as dia
from public.apepe_visitas v
group by v.sesion;

-- El día a día: lo que Javi quería ver como una curva.
create or replace view public.v_apepe_uso_dia as
select
  s.dia,
  count(*)                                               as visitas,
  count(distinct s.reserva) filter (where s.reserva is not null) as personas,
  round(avg(s.segundos))                                 as seg_medios,
  round(avg(s.pantallas),1)                              as pantallas_media,
  count(*) filter (where s.pantallas = 1)                as de_una_sola_pantalla
from public.v_apepe_sesiones s
group by s.dia;

-- Qué se mira. Lo primero que hay que saber para decidir qué quitar.
create or replace view public.v_apepe_pantallas as
select
  v.pantalla,
  count(*)                        as vistas,
  count(distinct v.sesion)        as visitas,
  count(distinct v.reserva)       as personas,
  max(v.at)                       as ultima
from public.apepe_visitas v
group by v.pantalla;

grant select on public.v_apepe_sesiones, public.v_apepe_uso_dia, public.v_apepe_pantallas to authenticated;

-- PENDIENTE, y es la mitad que falta: cruzar `pantalla='tour'` con las
-- reservas creadas para tener la conversión y el rebote de verdad. No se hace
-- aquí porque hasta que no haya unos días de pings el cruce no dice nada.
