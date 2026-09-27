// crear-socios — retirada en la contención del 27-sep-2026.
// Era un alta masiva de socios con secreto fijo en el código y contraseña por defecto
// ('casapepe123'): con el repo público, cualquiera podía RESTABLECER la contraseña
// de las cuentas de los socios. Las altas de socios se hacen ahora desde RH
// (crear-acceso-colaborador, con sesión de admin RH).
Deno.serve(() => new Response("410 - funcion retirada (contencion 27-sep-2026)", { status: 410 }));
