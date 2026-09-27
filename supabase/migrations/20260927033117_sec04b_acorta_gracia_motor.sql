-- La gracia para el motor de pricing (clave anónima sin cabecera) se acorta al 4-oct.
drop policy if exists pipeline_state_motor on storage.objects;
create policy pipeline_state_motor on storage.objects for all to anon, authenticated
  using (bucket_id = 'pipeline-state' and (public.trae_token_integracion('pipeline-state') or public.es_admin_seguridad() or now() < '2026-10-04'))
  with check (bucket_id = 'pipeline-state' and (public.trae_token_integracion('pipeline-state') or public.es_admin_seguridad() or now() < '2026-10-04'));
drop policy if exists pricing_escribe_motor on public.pricing_recomendaciones;
drop policy if exists pricing_borra_motor on public.pricing_recomendaciones;
create policy pricing_escribe_motor on public.pricing_recomendaciones for insert to anon, authenticated
  with check (public.trae_token_integracion('pricing') or public.puede_delicado('tarifas_cuartos') or now() < '2026-10-04');
create policy pricing_borra_motor on public.pricing_recomendaciones for delete to anon, authenticated
  using (public.trae_token_integracion('pricing') or public.puede_delicado('tarifas_cuartos') or now() < '2026-10-04');
-- Un solo token para las dos cosas del motor.
update privado.tokens_integracion set token = (select token from privado.tokens_integracion where nombre='pricing') where nombre='pipeline-state';
