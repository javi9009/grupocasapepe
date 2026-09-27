-- sec09: funciones SECURITY DEFINER en lenguaje SQL, de solo lectura, que
-- devolvían datos de personas a cualquiera (tablero de recepción con documentos
-- y firmas, resumen de nómina, solicitudes de voluntarios, historial de
-- huéspedes...). sec03 solo cubrió las plpgsql que escriben. Se reescriben como
-- plpgsql con la guardia al inicio; el original queda en privado.funciones_respaldo.
do $do$
declare
  r record; v_def text; v_src text; v_guard text; v_body text; n int := 0;
  lista text[] := array['apepe_recepcion_detalle','apepe_recepcion_tablero','apepe_cliente_historial',
                        'nomina_resumen','rh_conocimiento','vol_calendario','vol_cartas_log','vol_embudo',
                        'vol_solicitudes','alta_faltantes_contrato','cmp_responsables_bodega'];
begin
  for r in
    select p.oid, p.proname, p.proretset, pg_get_function_identity_arguments(p.oid) firma,
           pg_get_function_arguments(p.oid) args_def,
           pg_get_function_result(p.oid) res, p.prosrc
    from pg_proc p join pg_language l on l.oid = p.prolang
    where p.pronamespace = 'public'::regnamespace and l.lanname = 'sql' and p.prosecdef
      and p.proname = any (lista)
  loop
    v_def := pg_get_functiondef(r.oid);
    insert into privado.funciones_respaldo (nombre, firma, definicion, motivo)
      values (r.proname, r.firma, v_def, 'sec09 guardia lectoras sql');
    v_src := regexp_replace(btrim(r.prosrc), ';\s*$', '');
    v_guard := case when r.proname = 'nomina_resumen' then 'perform public.exige_delicado(''salarios'', ''resumen de nómina'');'
                    else 'perform public.exige_equipo();' end;
    v_body := case when r.proretset then format('begin %s return query %s; end', v_guard, v_src)
                   else format('begin %s return (%s); end', v_guard, v_src) end;
    execute format('create or replace function public.%I(%s) returns %s language plpgsql stable security definer set search_path = public, auditoria as $f$%s$f$',
                   r.proname, r.args_def, r.res, v_body);
    n := n + 1;
  end loop;
  raise notice 'reescritas: %', n;
end $do$;
