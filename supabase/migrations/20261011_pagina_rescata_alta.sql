-- LO QUE YA DIO DE ALTA NO SE LE VUELVE A PEDIR EN SU PÁGINA.
--
-- Javi, 10-oct-2026: «en la página donde pone "crear página", ¿no puedes
-- rescatar toda esta info de lo que ya creó previamente? equipo, ig,
-- productos, etc?».
--
-- QUÉ YA ESTABA Y QUÉ NO. Instagram, Facebook, TikTok, YouTube, Spotify y la
-- web son los mismos campos del alta, así que ésos ya salían llenos. El equipo
-- también estaba: lo que pasa es que nadie sale publicado por defecto, y eso es
-- deliberado (Javi, 3-oct: «nadie sale por defecto: tú marcas a cada quien»).
-- Lo que de verdad se pedía dos veces era el contacto —el WhatsApp y el correo
-- del alta frente a los «públicos»— y las fotos.
--
-- EL CONTACTO NO SE COPIA SOLO. El teléfono del alta es el de trabajo; el de la
-- página es el que ve cualquiera. Copiarlo a escondidas sería publicar un dato
-- personal sin preguntar, así que el portal le enseña que lo tenemos y se lo
-- pone de un clic si ella quiere. Eso vive en productora.html.
--
-- LAS FOTOS SÍ, PORQUE YA SON SUYAS Y YA SON PÚBLICAS. Las que subió a sus
-- eventos están en nuestro servidor y salen en la ficha del evento. Traerlas a
-- su galería es copiar una liga, no volver a subir el archivo ni publicar nada
-- nuevo.

create or replace function public.prod_galeria_desde_eventos(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_prod uuid; v_gal jsonb; v_add jsonb; v_tope int := 24;
begin
  select id into v_prod from productoras
   where portal_token = p_token and coalesce(estado,'') <> 'baja' limit 1;
  if v_prod is null then raise exception 'Liga no válida' using errcode = '42501'; end if;

  select coalesce(galeria, '[]'::jsonb) into v_gal from productoras where id = v_prod;

  /* Las fotos de sus propios eventos que todavía no estén en su galería. Se
     comparan por url: si ya la tiene puesta a mano, no se duplica. El pie sale
     del nombre del evento, que es lo que ella escribiría. */
  select coalesce(jsonb_agg(jsonb_build_object('url', t.url, 'pie', t.pie) order by t.ord), '[]'::jsonb)
    into v_add
  from (
    select f.url as url, min(e.nombre) as pie, min(e.created_at) as ord
      from eventos e
      cross join lateral (select el->>'url' as url
                            from jsonb_array_elements(coalesce(e.fotos,'[]'::jsonb)) el) f
     where e.productora_id = v_prod
       and coalesce(f.url,'') <> ''
       and not exists (select 1 from jsonb_array_elements(v_gal) g where g->>'url' = f.url)
     group by f.url
  ) t;

  v_gal := v_gal || v_add;
  if jsonb_array_length(v_gal) > v_tope then
    select jsonb_agg(x order by n) into v_gal
      from (select x, n from jsonb_array_elements(v_gal) with ordinality as a(x, n)
             order by n limit v_tope) z;
  end if;

  update productoras set galeria = v_gal, updated_at = now() where id = v_prod;
  return jsonb_build_object('ok', true, 'galeria', v_gal,
                            'agregadas', jsonb_array_length(v_add));
end $fn$;

grant execute on function public.prod_galeria_desde_eventos(uuid) to anon, authenticated;

-- Y LA GALERÍA, QUE NO SE DEVOLVÍA. Un fallo de antes que salió al probar esto:
-- prod_portal_ficha no incluía `galeria`, así que la productora subía sus fotos,
-- las veía porque se las devolvía la función que las guarda, y al recargar
-- desaparecían. Seguían guardadas; su portal no sabía pedirlas. Una foto que no
-- se ve no se puede quitar, y volver a subirla es lo que haría cualquiera.
-- Va concatenada aparte: jsonb_build_object no admite más de 100 argumentos y
-- este ya iba justo.
create or replace function public.prod_portal_ficha(p_token uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select jsonb_build_object(
    'id',p.id,'nombre_comercial',p.nombre_comercial,'contrato_firmado_at',p.contrato_firmado_at,'contrato_version',p.contrato_version,'contrato_firmante',p.contrato_firmante,'razon_social',p.razon_social,'rfc',p.rfc,
    'tipo_persona',p.tipo_persona,'curp',p.curp,'ciudad',p.ciudad,'antiguedad',p.antiguedad,
    'email',p.email,'email_notificaciones',p.email_notificaciones,'email_reportes',p.email_reportes,
    'email_facturacion',p.email_facturacion,'quien_factura',p.quien_factura,
    'whatsapp',p.whatsapp,'instagram',p.instagram,'web',p.web,
    'tipo',p.tipo,'tipos',p.tipos,'tipo_otro',p.tipo_otro,
    'tipo_nombre', public.productora_giros(p.tipos, p.tipo, p.tipo_otro),
    'espacio',     public.productora_espacios(p.tipos, p.tipo),
    'estado',p.estado,
    'puede_gratis', coalesce(p.puede_gratis,false),
    'comision_pct', coalesce(p.comision_pct,
                             nullif(coalesce(p.com_vendedor_pct,0)
                                  + coalesce(p.com_hotel_pct,0)
                                  + coalesce(p.com_plataforma_pct,0), 0)),
    'tiene_poliza', coalesce(p.tiene_poliza,false),'poliza_cotizar', coalesce(p.poliza_cotizar,false),
    'poliza_aseguradora',p.poliza_aseguradora,'poliza_numero',p.poliza_numero,
    'poliza_suma',p.poliza_suma,'poliza_vigencia',p.poliza_vigencia,
    'slug',p.slug,'publica',coalesce(p.publica,false),
    'bio',p.bio,'historia',p.historia,
    'logo_url',p.logo_url,'portada_url',p.portada_url,
    'email_publico',p.email_publico,'whatsapp_publico',p.whatsapp_publico,
    'facebook',p.facebook,'tiktok',p.tiktok,'youtube',p.youtube,'spotify',p.spotify,
    'room_service', coalesce(p.room_service,false),
    'rs_horario', p.rs_horario, 'rs_aviso_min', coalesce(p.rs_aviso_min,20),
    'stripe',(p.stripe_estado='vinculado'),'contrato_ok',(p.contrato_firmado_at is not null))
    || jsonb_build_object('galeria', coalesce(p.galeria,'[]'::jsonb))
    from productoras p where p.portal_token=p_token), 'null'::jsonb);
$function$;
