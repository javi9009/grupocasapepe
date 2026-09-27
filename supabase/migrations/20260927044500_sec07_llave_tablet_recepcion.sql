-- sec07: llave de la tablet de recepción. apepe-recepcion-portal y
-- apepe-checkin-token (portal de tablet sin login) dejan de ser públicos:
-- exigen esta llave en x-integracion-token (la tablet la recibe en su link ?k=)
-- o sesión del equipo. Sin esto, cualquiera listaba las llegadas del día y
-- obtenía el token de check-in de cualquier huésped (correo, teléfono, historial).
insert into privado.tokens_integracion (nombre, token, nota)
values ('tablet-recepcion', encode(gen_random_bytes(18),'hex'), 'tablet de recepción: link /apepe/recepcion.html?k=<token>')
on conflict (nombre) do nothing;
