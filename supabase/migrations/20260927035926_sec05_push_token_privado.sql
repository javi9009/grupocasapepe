-- sec05: el aviso push deja de usar un secreto fijo publicado en GitHub.
-- El trigger lee el token de privado.tokens_integracion y lo manda como
-- x-integracion-token; push-notif lo valida con trae_token_integracion('push').
insert into privado.tokens_integracion (nombre, token)
values ('push', encode(gen_random_bytes(32), 'hex'))
on conflict (nombre) do update set token = excluded.token;

create or replace function public.notificaciones_push()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'privado'
as $function$
declare
  destino_url text;
  tok text;
begin
  if new.employee_id is null and new.user_id is null then
    return new;
  end if;

  destino_url := coalesce(new.accion->>'url', '/soypepe/');

  -- Los avisos del chat ya los manda push-chat. Aquí sólo estorbarían.
  if destino_url like '/m/mensajes.html%' then
    return new;
  end if;

  select token into tok from privado.tokens_integracion where nombre = 'push';
  if tok is null then return new; end if;

  perform net.http_post(
    url     := 'https://rehophywchakfapivsbh.supabase.co/functions/v1/push-notif',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-integracion-token', tok),
    body    := jsonb_build_object(
                 'employee_id', new.employee_id,
                 'user_id',     new.user_id,
                 'titulo',      new.titulo,
                 'cuerpo',      coalesce(new.cuerpo, ''),
                 'icono',       coalesce(new.icono, ''),
                 'url',         destino_url,
                 'tag',         'notif-' || new.id::text)
  );
  return new;
exception when others then
  return new; -- un fallo del aviso nunca puede tumbar la notificación
end $function$;
