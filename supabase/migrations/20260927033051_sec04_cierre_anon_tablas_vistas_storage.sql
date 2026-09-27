-- Contención 27-sep-2026: políticas anónimas que sobraban (las páginas del
-- equipo ya mandan la sesión), vistas con personas legibles sin sesión,
-- tablas sin RLS y buckets abiertos.

-- 1. Escrituras anónimas en tablas de RH, dirección y Ateneo: fuera.
drop policy if exists actas_administrativas_del_anon on public.actas_administrativas;
drop policy if exists actas_administrativas_ins_anon on public.actas_administrativas;
drop policy if exists actas_administrativas_upd_anon on public.actas_administrativas;
drop policy if exists comentarios_desempeno_del_anon on public.comentarios_desempeno;
drop policy if exists comentarios_desempeno_ins_anon on public.comentarios_desempeno;
drop policy if exists comentarios_desempeno_upd_anon on public.comentarios_desempeno;
drop policy if exists horarios_delete_anon on public.horarios;
drop policy if exists horarios_insert_anon on public.horarios;
drop policy if exists horarios_update_anon on public.horarios;
drop policy if exists briefing_minutas_del_anon on public.briefing_minutas;
drop policy if exists briefing_minutas_ins_anon on public.briefing_minutas;
drop policy if exists briefing_minutas_upd_anon on public.briefing_minutas;
drop policy if exists "anon borra asig" on public.ateneo_asignaciones;
drop policy if exists "anon crea asig" on public.ateneo_asignaciones;
drop policy if exists "anon edita asig" on public.ateneo_asignaciones;
drop policy if exists "anon borra residencias" on public.ateneo_residencias_reservas;
drop policy if exists "anon edita residencias" on public.ateneo_residencias_reservas;
-- (se conserva "anon crea residencias": es el formulario público de reserva)

drop policy if exists empcfg_read on public.empleado_config;
drop policy if exists empcfg_write on public.empleado_config;
create policy empcfg_read on public.empleado_config for select to authenticated using (public.es_equipo_casa());
create policy empcfg_write on public.empleado_config for all to authenticated
  using (public.is_admin_rh()) with check (public.is_admin_rh());

-- Evaluaciones de desempeño: solo el equipo las lee.
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies
           where schemaname='public' and tablename like 'eval\_%' and cmd='SELECT' and 'public'=any(roles) loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_equipo_casa())', r.policyname, r.tablename);
  end loop;
end $$;

-- Tablas con ALL para public=true: pasan a equipo.
do $$ declare r record; begin
  for r in select tablename, policyname, cmd from pg_policies
           where schemaname='public' and 'public'=any(roles) and cmd='ALL'
             and tablename in ('cmp_auto_aprueba','cmp_pasillos','cmp_precio_historial','hk_no_molestar','mtto_consumo_config',
                               'mtto_gas_recargas','mtto_preventivo_log','mtto_proveedores','incubathon_evaluaciones',
                               'incubathon_jueces','incubathon_proyectos','pq_puntos','pq_retos') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_equipo_casa()) with check (public.es_equipo_casa())', r.policyname, r.tablename);
  end loop;
end $$;
-- pq_puntos / pq_retos se leen desde PepeQuiz con sesión de cualquier jugador (voluntarios también)
create policy pq_puntos_lee_jugador on public.pq_puntos for select to authenticated using (true);
create policy pq_retos_lee_jugador  on public.pq_retos  for select to authenticated using (true);

-- 2. Vistas con datos de personas: sin sesión no se leen.
revoke select on public.usuarios, public.v_chat_directorio, public.match_profiles,
                 public.v_personas_alta, public.v_personas_horario, public.v_rh_gerencia_empleados,
                 public.rh_ficha, public.carrera_pila, public.v_ventas_colaborador_mes, public.v_pq_banco
  from anon;

-- 3. Tablas sin RLS.
alter table public.apepe_config enable row level security;
create policy apepe_config_wifi_publico on public.apepe_config for select to anon, authenticated
  using (clave like 'apepe_wifi_%' or public.es_equipo_casa());
create policy apepe_config_equipo on public.apepe_config for all to authenticated
  using (public.es_admin_seguridad()) with check (public.es_admin_seguridad());

do $$ declare t text; begin
  foreach t in array array['mtto_import_puebla_mp2026','crm_sync_cursor','apepe_upgrade_puja','ateneo_lugares_bak_20260823',
    'mtto_profundo_plan','mtto_tema_keywords','deploy_tmp','derrama_config','gob_aportaciones_bak_20260925','tour_sellos','sellos',
    'guia_resenas','gob_refundacion_compromisos_bak_20260925b','tour_herramientas','tour_hitos','sinc_sellos',
    'gob_refundacion_compromisos_bak_20260924'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
-- Las que la web pública sí lee (catálogo de tours) se abren en lectura.
create policy sellos_lee on public.sellos for select to anon, authenticated using (true);
create policy tour_sellos_lee on public.tour_sellos for select to anon, authenticated using (true);
create policy sinc_sellos_lee on public.sinc_sellos for select to anon, authenticated using (true);
create policy tour_hitos_lee on public.tour_hitos for select to anon, authenticated using (true);
create policy tour_herramientas_lee on public.tour_herramientas for select to anon, authenticated using (true);
create policy guia_resenas_lee on public.guia_resenas for select to anon, authenticated using (true);
create policy derrama_config_lee on public.derrama_config for select to authenticated using (public.es_equipo_casa());
create policy apepe_upgrade_puja_equipo on public.apepe_upgrade_puja for all to authenticated
  using (public.es_equipo_casa()) with check (public.es_equipo_casa());
-- resto (copias _bak, importaciones, cursores, planes) sin políticas = solo servidor.

-- 4. Storage.
drop policy if exists temp_seed_anon_all on storage.objects;
insert into privado.tokens_integracion (nombre, token, nota)
values ('pipeline-state', encode(gen_random_bytes(24),'hex'), 'motor de pricing: estado en bucket pipeline-state (cabecera x-integracion-token)')
on conflict do nothing;
create policy pipeline_state_motor on storage.objects for all to anon, authenticated
  using (bucket_id = 'pipeline-state' and (public.trae_token_integracion('pipeline-state') or public.es_admin_seguridad() or now() < '2026-10-11'))
  with check (bucket_id = 'pipeline-state' and (public.trae_token_integracion('pipeline-state') or public.es_admin_seguridad() or now() < '2026-10-11'));

drop policy if exists buzon_obj_ins on storage.objects;
drop policy if exists buzon_obj_upd on storage.objects;
create policy buzon_obj_ins on storage.objects for insert to authenticated with check (bucket_id = 'buzon');
create policy buzon_obj_upd on storage.objects for update to authenticated using (bucket_id = 'buzon') with check (bucket_id = 'buzon');

drop policy if exists plataforma_del_temp on storage.objects;
drop policy if exists plataforma_ins_temp on storage.objects;
drop policy if exists plataforma_sel_temp on storage.objects;
