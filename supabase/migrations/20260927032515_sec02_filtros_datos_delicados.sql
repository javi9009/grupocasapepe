-- ============================================================================
-- Contención 26/27-sep-2026 — FILTROS DE DATOS DELICADOS
--
-- Regla: los cuatro datos que más duelen (tarifas de cuartos, precios de tours,
-- Cósmica y salarios) solo los toca quien esté en la lista `acceso_delicado`
-- para esa área, o dirección. Esa lista la administra dirección desde la base
-- (y después desde una pantalla). Todo lo demás del sistema sigue igual.
--
-- La comprobación vive en la base (RLS, triggers y funciones), no en la
-- página, así que da igual desde dónde se llame.
-- ============================================================================

-- 1. Lista de autorizados por área -------------------------------------------
create table if not exists public.acceso_delicado (
  email        text not null,
  area         text not null check (area in ('tarifas_cuartos','precios_tours','cosmica','salarios')),
  otorgado_por text,
  nota         text,
  created_at   timestamptz not null default now(),
  primary key (email, area)
);
comment on table public.acceso_delicado is
  'Quién puede modificar datos delicados por área. Dirección (es_admin_seguridad) siempre puede. Solo dirección edita esta tabla.';

alter table public.acceso_delicado enable row level security;
drop policy if exists acceso_delicado_lee on public.acceso_delicado;
drop policy if exists acceso_delicado_admin on public.acceso_delicado;
create policy acceso_delicado_lee   on public.acceso_delicado for select to authenticated using (public.es_equipo_casa());
create policy acceso_delicado_admin on public.acceso_delicado for all    to authenticated
  using (public.es_admin_seguridad()) with check (public.es_admin_seguridad());

-- Semilla: dirección en las cuatro áreas; RH/contabilidad en salarios (los
-- mismos correos que ya reconoce is_admin_rh, para no romper la nómina).
insert into public.acceso_delicado (email, area, otorgado_por, nota)
select e, a, 'migracion sec02', 'semilla inicial'
from unnest(array['javi@casapepe.mx']) e, unnest(array['tarifas_cuartos','precios_tours','cosmica','salarios']) a
on conflict do nothing;
insert into public.acceso_delicado (email, area, otorgado_por, nota)
select e, 'salarios', 'migracion sec02', 'semilla: ya eran admin RH'
from unnest(array['contabilidad@casapepe.mx','administracion@casapepe.mx','administracion.cdmx@casapepe.mx','administracion.puebla@casapepe.mx','hola.puebla@casapepe.mx']) e
on conflict do nothing;

-- 2. La pregunta única --------------------------------------------------------
create or replace function public.puede_delicado(p_area text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select
    -- llamadas de servidor (cron, service_role, triggers sin JWT) pasan
    coalesce(current_setting('request.jwt.claim.role', true), '') not in ('anon','authenticated')
    or (
      public.es_equipo_casa()
      and (
        public.es_admin_seguridad()
        or exists (
          select 1 from public.acceso_delicado d
           where d.area = p_area
             and lower(d.email) = lower(coalesce(auth.jwt()->>'email',''))
        )
      )
    );
$$;
revoke all on function public.puede_delicado(text) from public;
grant execute on function public.puede_delicado(text) to authenticated, service_role;

-- Versión para triggers: lanza error con mensaje claro.
create or replace function public.exige_delicado(p_area text, p_que text default null)
returns void language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.puede_delicado(p_area) then
    raise exception 'Sin permiso para modificar % (área %). Pídeselo a dirección.',
      coalesce(p_que, p_area), p_area using errcode = '42501';
  end if;
end $$;
revoke all on function public.exige_delicado(text, text) from public;
grant execute on function public.exige_delicado(text, text) to authenticated, service_role;

-- 3. TARIFAS DE CUARTOS -------------------------------------------------------
-- 3a. Propuestas de tarifa: crear y aprobar solo con permiso.
create or replace function public.cp_propuesta_crear(p_propiedad_id bigint, p_fecha date, p_codigo text, p_bar_propuesta numeric, p_motivo text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'revenue'
as $function$
declare v_room text; v_rate text; v_actual numeric; v_id bigint;
begin
  if not public.puede_delicado('tarifas_cuartos') then
    return jsonb_build_object('ok',false,'error','sin permiso para proponer tarifas'); end if;

  select h.room_id into v_room from revenue.habitacion h
   where h.propiedad_id = p_propiedad_id and h.codigo = p_codigo;
  if v_room is null then return jsonb_build_object('ok',false,'error','habitacion desconocida'); end if;

  select rate_id into v_rate from revenue.bar_rate_id
   where propiedad_id = p_propiedad_id and room_id = v_room;
  if v_rate is null then return jsonb_build_object('ok',false,'error','sin rateID de BAR fijado'); end if;

  select bar into v_actual from revenue.bar_dia
   where propiedad_id = p_propiedad_id and fecha_estancia = p_fecha and room_id = v_room;
  if v_actual is null then return jsonb_build_object('ok',false,'error','sin BAR leida para esa noche'); end if;

  if p_bar_propuesta is null or p_bar_propuesta <= 0 then
    return jsonb_build_object('ok',false,'error','propuesta invalida'); end if;
  if abs(p_bar_propuesta / v_actual - 1) > 0.60 then
    return jsonb_build_object('ok',false,'error','la propuesta mueve mas del 60%: se para por seguridad'); end if;

  insert into revenue.propuesta_tarifa
    (propiedad_id, fecha_estancia, room_id, codigo, rate_id, bar_actual, bar_propuesta, motivo, creada_por)
  values (p_propiedad_id, p_fecha, v_room, p_codigo, v_rate, v_actual, round(p_bar_propuesta,2), p_motivo,
          coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'email','desconocido'))
  returning id into v_id;

  return jsonb_build_object('ok',true,'id',v_id,'bar_actual',v_actual,'bar_propuesta',round(p_bar_propuesta,2));
end $function$;

create or replace function public.cp_propuesta_aprobar(p_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public', 'revenue'
as $function$
begin
  if not public.puede_delicado('tarifas_cuartos') then
    return jsonb_build_object('ok',false,'error','sin permiso para aprobar tarifas'); end if;
  update revenue.propuesta_tarifa
     set estado='aprobada', aprobada_el=now(),
         aprobada_por=coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'email','desconocido')
   where id=p_id and estado='pendiente';
  if not found then return jsonb_build_object('ok',false,'error','no estaba pendiente'); end if;
  return jsonb_build_object('ok',true,'id',p_id);
end $function$;

-- cp_propuesta_resultado la llama cloudbeds-aplicar con service_role: fuera del alcance de usuarios.
revoke execute on function public.cp_propuesta_resultado(bigint, text, text, text) from anon, authenticated;

-- 3b. Recomendaciones del motor: nadie borra ni inserta a mano sin permiso.
--     El motor (GitHub Actions) sigue entrando con la clave anónima hasta que
--     mande su cabecera x-integracion-token; después del 11-oct solo con token.
create schema if not exists privado;
revoke all on schema privado from public;
create table if not exists privado.tokens_integracion (
  nombre text primary key, token text not null, nota text, created_at timestamptz default now()
);
insert into privado.tokens_integracion (nombre, token, nota)
values ('pricing', encode(gen_random_bytes(24),'hex'), 'motor de pricing en GitHub Actions: cabecera x-integracion-token')
on conflict do nothing;

create or replace function public.trae_token_integracion(p_nombre text)
returns boolean language sql stable security definer set search_path = public, privado as $$
  select coalesce(
    (current_setting('request.headers', true)::json->>'x-integracion-token')
      = (select token from privado.tokens_integracion where nombre = p_nombre), false);
$$;
revoke all on function public.trae_token_integracion(text) from public;
grant execute on function public.trae_token_integracion(text) to anon, authenticated, service_role;

drop policy if exists pricing_insert_anon on public.pricing_recomendaciones;
drop policy if exists pricing_delete_anon on public.pricing_recomendaciones;
create policy pricing_escribe_motor on public.pricing_recomendaciones for insert to anon, authenticated
  with check (public.trae_token_integracion('pricing') or public.puede_delicado('tarifas_cuartos') or now() < '2026-10-11');
create policy pricing_borra_motor on public.pricing_recomendaciones for delete to anon, authenticated
  using (public.trae_token_integracion('pricing') or public.puede_delicado('tarifas_cuartos') or now() < '2026-10-11');

-- 4. PRECIOS DE TOURS ---------------------------------------------------------
-- Un operador edita el precio de SUS experiencias; alguien de casa solo si está
-- autorizado en 'precios_tours'. El resto de campos siguen con sus políticas.
create or replace function public.trg_op_exp_precio_delicado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.precio_adulto is distinct from old.precio_adulto) or (new.precio_menor is distinct from old.precio_menor) then
    if old.operador_id is not null and old.operador_id = public.mi_operador() then
      return new; -- su propio tour
    end if;
    perform public.exige_delicado('precios_tours', 'precios de tours');
  end if;
  return new;
end $$;
drop trigger if exists op_exp_precio_delicado on public.op_experiencias;
create trigger op_exp_precio_delicado before update on public.op_experiencias
  for each row execute function public.trg_op_exp_precio_delicado();

-- Tablas de tours de generaciones anteriores: escribir solo con permiso.
drop policy if exists tours_rw_all on public.tours;
drop policy if exists tr_all on public.tours;
drop policy if exists tours_equipo on public.tours;
create policy tours_equipo on public.tours for all to authenticated
  using (public.es_equipo_casa()) with check (public.puede_delicado('precios_tours'));
drop policy if exists experiencias_write on public.experiencias;
create policy experiencias_write on public.experiencias for all to authenticated
  using (public.es_equipo_casa()) with check (public.puede_delicado('precios_tours'));

-- 5. CÓSMICA ------------------------------------------------------------------
drop policy if exists cosmica_prod_escribe on public.cosmica_productos;
create policy cosmica_prod_escribe on public.cosmica_productos for all to authenticated
  using (public.puede_delicado('cosmica')) with check (public.puede_delicado('cosmica'));
drop policy if exists prueba_suya on public.cosmica_pruebas;
create policy cosmica_pruebas_equipo on public.cosmica_pruebas for all to authenticated
  using (public.es_equipo_casa() or operador_id = public.mi_operador())
  with check (public.es_equipo_casa() or operador_id = public.mi_operador());

-- 6. SALARIOS -----------------------------------------------------------------
-- 6a. Columnas de sueldo en employees: solo con permiso 'salarios'.
create or replace function public.trg_employees_salario_delicado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (
       new.sueldo_base is distinct from old.sueldo_base
    or new.salario_bruto is distinct from old.salario_bruto
    or new.salario_diario is distinct from old.salario_diario
    or new.salario_desde is distinct from old.salario_desde
    or new.bono_puntualidad is distinct from old.bono_puntualidad
    or new.bono_puntualidad_monto is distinct from old.bono_puntualidad_monto
    or new.rol is distinct from old.rol
    or new.categoria is distinct from old.categoria) then
    perform public.exige_delicado('salarios', 'sueldo, rol o categoría');
  end if;
  if tg_op = 'INSERT' and coalesce(new.salario_bruto, new.sueldo_base, 0) > 0 then
    perform public.exige_delicado('salarios', 'sueldo');
  end if;
  return new;
end $$;
drop trigger if exists employees_salario_delicado on public.employees;
create trigger employees_salario_delicado before insert or update on public.employees
  for each row execute function public.trg_employees_salario_delicado();

-- 6b. Nómina e incidencias: fuera las políticas anónimas; escribir solo con permiso.
drop policy if exists nomina_quincenal_del_anon on public.nomina_quincenal;
drop policy if exists nomina_quincenal_ins_anon on public.nomina_quincenal;
drop policy if exists nomina_quincenal_upd_anon on public.nomina_quincenal;
drop policy if exists nomina_quincenal_all_auth on public.nomina_quincenal;
drop policy if exists nomina_quincenal_sel_auth on public.nomina_quincenal;
drop policy if exists nomina_quincenal_sel_anon on public.nomina_quincenal;
create policy nomina_quincenal_lee on public.nomina_quincenal for select to authenticated
  using (public.puede_delicado('salarios')
         or employee_id in (select e.id from public.employees e where e.user_id = auth.uid()));
create policy nomina_quincenal_escribe on public.nomina_quincenal for all to authenticated
  using (public.puede_delicado('salarios')) with check (public.puede_delicado('salarios'));

drop policy if exists incidencias_quincenal_del_anon on public.incidencias_quincenal;
drop policy if exists incidencias_quincenal_ins_anon on public.incidencias_quincenal;
drop policy if exists incidencias_quincenal_upd_anon on public.incidencias_quincenal;
drop policy if exists incidencias_quincenal_all_auth on public.incidencias_quincenal;
drop policy if exists incidencias_quincenal_sel_auth on public.incidencias_quincenal;
drop policy if exists incidencias_quincenal_sel_anon on public.incidencias_quincenal;
create policy incidencias_quincenal_lee on public.incidencias_quincenal for select to authenticated
  using (public.es_equipo_casa());
create policy incidencias_quincenal_escribe on public.incidencias_quincenal for all to authenticated
  using (public.puede_delicado('salarios')) with check (public.puede_delicado('salarios'));

drop policy if exists nomina_maquila_all on public.nomina_maquila;
create policy nomina_maquila_lee on public.nomina_maquila for select to authenticated using (public.puede_delicado('salarios'));
create policy nomina_maquila_escribe on public.nomina_maquila for all to authenticated
  using (public.puede_delicado('salarios')) with check (public.puede_delicado('salarios'));

drop policy if exists adelantos_upd_auth on public.nomina_adelantos;
create policy adelantos_escribe on public.nomina_adelantos for all to authenticated
  using (public.puede_delicado('salarios')) with check (public.puede_delicado('salarios'));

drop policy if exists nomina_config_read on public.nomina_config;
create policy nomina_config_read on public.nomina_config for select to authenticated using (public.es_equipo_casa());

-- 7. Tablas del área de tarifas sin RLS: cerrar acceso directo (solo vía funciones).
alter table revenue.propuesta_tarifa enable row level security;
alter table revenue.bar_rate_id enable row level security;
alter table revenue.clase_habitacion enable row level security;
revoke all on revenue.propuesta_tarifa, revenue.bar_rate_id, revenue.clase_habitacion from anon, authenticated;

-- 8. Reservas y boletos.
-- sinc_reserva_sin_cobro es el camino de respaldo de la web pública cuando la
-- pasarela falla: se conserva, pero solo para reservas web recién creadas
-- (30 min) y no pagadas. Antes valía para cualquier reserva de la historia.
create or replace function public.sinc_reserva_sin_cobro(p_reserva uuid)
returns public.sinc_reservas language plpgsql security definer set search_path = public as $$
declare r public.sinc_reservas;
begin
  update public.sinc_reservas s
     set estado = case when s.estado = 'pendiente' then 'confirmada' else s.estado end,
         pago_estado = 'sin_cobro'
   where s.id = p_reserva
     and s.pago_estado <> 'pagado'
     and (public.es_equipo_casa() or (s.created_at > now() - interval '30 minutes' and s.canal = 'web'))
  returning * into r;
  if r.id is null then select * into r from public.sinc_reservas where id = p_reserva; end if;
  return r;
end $$;
-- cine_codigo_usar solo desde el panel del Ateneo (con sesión).
revoke execute on function public.cine_codigo_usar(text) from anon;
