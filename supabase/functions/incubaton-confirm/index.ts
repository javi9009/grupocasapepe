// incubaton-confirm — retirada en la contención del 27-sep-2026 (sonda/temporal que exponía datos o secretos).
// Se conserva como 410 para que cualquier llamada vieja falle de forma clara. Borrar del panel cuando se quiera.
Deno.serve(() => new Response("410 - funcion retirada (contencion 27-sep-2026)", { status: 410 }));
