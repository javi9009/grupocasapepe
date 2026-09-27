-- Contención 27-sep-2026: 100+ funciones SECURITY DEFINER que escriben datos
-- eran ejecutables por cualquiera sin comprobar quién llama. Se les inyecta al
-- inicio `perform public.exige_equipo();`: si la llamada viene de un usuario
-- (anon/authenticated) exige ser del equipo; cron, triggers y service_role pasan.
-- Las que sí son formularios públicos quedan fuera (lista `excluir`).
-- El texto original de cada función se guarda en privado.funciones_respaldo.
--
-- NOTA: exige_equipo() se corrige en sec03c (lee el rol de request.jwt.claims).

create or replace function public.exige_equipo()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon','authenticated')
     and not public.es_equipo_casa() then
    raise exception 'Solo el equipo de Casa Pepe puede hacer esto. Inicia sesión con tu cuenta de colaborador.'
      using errcode = '42501';
  end if;
end $$;
revoke all on function public.exige_equipo() from public;
grant execute on function public.exige_equipo() to anon, authenticated, service_role;

create table if not exists privado.funciones_respaldo (
  id bigserial primary key, nombre text, firma text, definicion text, motivo text, created_at timestamptz default now()
);

do $do$
declare
  r record; v_def text; v_nuevo text; n int := 0;
  excluir text[] := array[
    'apepe_checkin_guardar',           -- check-in del huésped por liga
    'filtro1_contacto','filtro1_email','filtro1_email_aviso','filtro1_evaluar', -- formulario voluntarios casapepe.mx
    'fn_contacto_upsert','fn_crm_upsert','fn_crm_recalcular', -- formularios web y crm-sync
    'registrar_acceso_deck','solicitar_acceso',              -- data room y solicitud de acceso
    'responder_test','pq_registrar_gym',                     -- test de candidatos y PepeQuiz
    'handle_new_user','exige_equipo','exige_delicado','puede_delicado','trae_token_integracion',
    'trg_employees_salario_delicado','trg_op_exp_precio_delicado','sinc_reserva_sin_cobro'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) firma
    from pg_proc p join pg_language l on l.oid = p.prolang
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
      and l.lanname = 'plpgsql' and p.provolatile = 'v'
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and not (p.proname = any (excluir))
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and pg_get_functiondef(p.oid) ~* '\m(insert|update|delete)\M'
      and pg_get_functiondef(p.oid) !~* '(auth\.uid\(\)|auth\.jwt\(\)|request\.jwt|auth\.role\(\)|exige_equipo|exige_delicado|puede_delicado|es_equipo_casa|es_operador_externo|es_admin_seguridad|is_admin_rh|es_gerente_o_mas|is_coordinador|mi_operador|mis_sedes|mis_ubicaciones|tiene_acceso_finanzas|puede_gestionar|quien_sube_comprobante|permiso_efectivo|\mp_token\M|\mtoken\M)'
  loop
    v_def := pg_get_functiondef(r.oid);
    -- primer BEGIN del cuerpo (después del AS $function$ y del DECLARE si lo hay)
    v_nuevo := regexp_replace(v_def, '(\$function\$[^$]*?\mbegin\M)', '\1' || E'\n  perform public.exige_equipo();', 'i');
    if v_nuevo = v_def then
      raise notice 'sin BEGIN reconocible, se salta: %', r.proname; continue;
    end if;
    insert into privado.funciones_respaldo (nombre, firma, definicion, motivo)
      values (r.proname, r.firma, v_def, 'sec03 guardia exige_equipo');
    execute v_nuevo;
    n := n + 1;
  end loop;
  raise notice 'funciones con guardia: %', n;
end $do$;

-- Las de lenguaje SQL no admiten inyección: se retira anon.
revoke execute on function public.cmp_quita_del_conteo_abierto from anon;
