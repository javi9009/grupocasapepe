/* Aviso de cada reserva + solicitud de devolución desde el boleto.
   Javi, 15-oct-2026. Aplicado a mano en rehophywchakfapivsbh; queda aquí
   para poder leerlo en un diff. */

-- 1 · a quién se avisa (editable sin tocar código)
insert into sinc_config (clave, valor)
values ('avisos_reserva_correos','nahel.rodriguez@uabc.edu.mx')
on conflict (clave) do nothing;

-- 2 · el secreto compartido entre la base y la función edge
insert into privado.tokens_integracion (nombre, token)
values ('sinc-aviso','<en la base; no se copia aquí>')
on conflict (nombre) do nothing;

create or replace function public.sinc_token_aviso()
returns text language sql security definer set search_path=public,privado as $$
  select token from privado.tokens_integracion where nombre='sinc-aviso';
$$;
revoke all on function public.sinc_token_aviso() from public, anon, authenticated;
grant execute on function public.sinc_token_aviso() to service_role;

-- 3 · cada reserva toca el timbre. La reserva nace confirmada y con el
--     asiento tomado, así que el aviso al insertar no es un aviso en falso.
create or replace function public.sinc_reservas_avisa()
returns trigger language plpgsql security definer set search_path=public,privado as $$
declare v_tok text;
begin
  select token into v_tok from privado.tokens_integracion where nombre='sinc-aviso';
  if v_tok is null then return new; end if;
  begin
    perform net.http_post(
      url     := 'https://rehophywchakfapivsbh.supabase.co/functions/v1/sinc-aviso-reserva',
      headers := jsonb_build_object('Content-Type','application/json','x-sinc-aviso',v_tok),
      body    := jsonb_build_object('reserva_id', new.id, 'motivo', 'nueva'),
      timeout_milliseconds := 20000);
  exception when others then
    null;   -- nunca tumbar una venta por un aviso
  end;
  return new;
end $$;

drop trigger if exists sinc_reservas_avisa_t on public.sinc_reservas;
create trigger sinc_reservas_avisa_t
  after insert on public.sinc_reservas
  for each row execute function public.sinc_reservas_avisa();

-- 4 · el huésped pide la devolución desde su propio boleto.
--     NO devuelve dinero ni cancela: deja la reserva marcada para que alguien
--     la mire. El dinero no se mueve nunca desde aquí.
create or replace function public.sinc_pide_devolucion(p_folio text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public,privado as $$
declare r public.sinc_reservas; v_tok text; v_nota text;
begin
  if coalesce(trim(p_folio),'')='' then
    return jsonb_build_object('ok',false,'mensaje','Falta el folio.');
  end if;

  select * into r from public.sinc_reservas
   where upper(folio)=upper(trim(p_folio)) limit 1;

  if r.id is null then
    return jsonb_build_object('ok',false,'mensaje','No encontramos esa reserva.');
  end if;
  if r.estado='cancelada' then
    return jsonb_build_object('ok',false,'mensaje','Esa reserva ya está cancelada.');
  end if;
  if r.pago_estado in ('reembolsado','reembolso_parcial') then
    return jsonb_build_object('ok',false,'mensaje','Esa reserva ya tiene su devolución hecha.');
  end if;
  if r.pago_estado='solicita_reembolso' or r.estado='solicita_cancelacion' then
    return jsonb_build_object('ok',true,'ya',true,
      'mensaje','Ya teníamos tu solicitud apuntada. Te escribimos en cuanto la revisemos.');
  end if;

  v_nota := to_char(now() at time zone 'America/Mexico_City','YYYY-MM-DD HH24:MI')
            ||' · el huésped pidió la devolución desde su boleto'
            ||coalesce(': '||nullif(trim(p_motivo),''),'');

  update public.sinc_reservas
     set estado      = 'solicita_cancelacion',
         pago_estado = case when pago_estado in ('pagado','pagado_parcial')
                            then 'solicita_reembolso' else pago_estado end,
         notas       = trim(both e'\n' from coalesce(notas||e'\n','')||v_nota)
   where id = r.id;

  select token into v_tok from privado.tokens_integracion where nombre='sinc-aviso';
  if v_tok is not null then
    begin
      perform net.http_post(
        url     := 'https://rehophywchakfapivsbh.supabase.co/functions/v1/sinc-aviso-reserva',
        headers := jsonb_build_object('Content-Type','application/json','x-sinc-aviso',v_tok),
        body    := jsonb_build_object('reserva_id', r.id, 'motivo', 'reembolso'),
        timeout_milliseconds := 20000);
    exception when others then null; end;
  end if;

  return jsonb_build_object('ok',true,'folio',r.folio);
end $$;

revoke all on function public.sinc_pide_devolucion(text,text) from public;
grant execute on function public.sinc_pide_devolucion(text,text) to anon, authenticated, service_role;
