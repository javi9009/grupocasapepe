// apepe-donjose — "Don José", conserje de Casa Pepe para el huésped (APePe).
//
// v2 ASESOR QUE LEVANTA LA MANO: informa y aconseja (cómo llegar, horarios,
// mapa, planes/eventos) y LEE el estatus de la reserva del huésped (Cloudbeds,
// vía apepe-reserva con su token). Sigue sin ejecutar cambios.
//
// Lo nuevo (28-sep-2026, Javi): cuando detecta algo que recepción tiene que
// resolver, ABRE UN TICKET. Hasta ahora esa frontera terminaba en «pásate por
// recepción» y lo que el huésped contó se quedaba enterrado en el chat. Tres
// clases, que son las que pidió:
//   · incidencia     — algo de la casa o del cuarto que hay que atender ya
//   · cambio_reserva — cancelar, recorrer, ampliar, cambiar personas o cuarto
//   · queja          — malestar, compensación, algo que salió mal
//
// El ticket lo abre un segundo pase barato que corre EN PARALELO con la
// respuesta: si falla, el huésped recibe su contestación igual. Nunca al revés.
//
// body: { token?: string, mensajes: [{role:'user'|'assistant', content:string}] }
// -> { ok, respuesta, ticket?: {folio, tipo} }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = Deno.env.get("PEPE_DONJOSE_MODELO") ?? "claude-haiku-4-5-20251001";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Hechos de la casa (Casa Pepe CDMX, Centro Histórico). Salen del contrato/registro real.
// Don José SOLO puede afirmar lo que está aquí; para lo demás, deriva a recepción.
const HECHOS = `DATOS DE LA CASA (Casa Pepe CDMX — Hostal Boutique, Centro Histórico, República de Uruguay 86, a dos calles del Zócalo):
- Qué es Casa Pepe: un hotel con espíritu de hostal, donde lo que de verdad importa es que los viajeros se conozcan, en un ambiente humanista. A dos pasos del corazón de la Ciudad de México.
- Check-in: desde las 15:00. Check-out: hasta las 12:00. Check-out tardío después de las 12:00 tiene recargo (50% de la noche) y después de las 17:00 se cobra la noche completa; para pedir un ratito más, que lo consulte en recepción según disponibilidad.
- Check-in temprano: sujeto a disponibilidad y con cargo extra, que se paga en recepción.
- Recomendamos firmar el contrato ANTES de llegar: el equipo lo verifica y con eso se entrega la llave. Recepción abre 24 horas, así que llegar de madrugada no es problema.
- Guardar maletas: sí, gratis y sin límite de tiempo. Antes del check-in (para salir a la ciudad, comer, ducharse o estar en las áreas comunes) y también después del check-out, si sale de noche en autobús o avión.
- Desayuno: de 7:00 a 11:00.
- Horarios: Lobby 24h · Cocina 12:00–23:00 · bar "La Cósmica" 7:00–23:00 · "power hour" a las 19:00 · el descanso (silencio) empieza a las 23:00.
- La tarifa incluye: un coctel de cortesía (reclamable de 14:00 a 19:00, antes de la power hour), un Café de Olla al llegar, un walking tour diario de 2h y un mapa de la ciudad.
- Experiencias (walkings, talleres, food tours, retos): están en la sección Experiencias de la app (/apepe/experiencias) y hay eventos auténticos con la comunidad que cambian cada semana.
- El mapa con nuestras recomendaciones está en la app (botón Mapa).
- No se permiten alimentos ni bebidas alcohólicas en las habitaciones; hay lockers y cajas de seguridad para objetos de valor.

CÓMO LLEGAR (aeropuerto o central de autobuses):
- Metrobús (los autobuses rojos): la opción de local y la más barata. Sale a la puerta de la TAPO y de las terminales T1 y T2 del aeropuerto. La tarjeta de transporte cuesta unos $15 MXN en la estación —sirve para todo el transporte público— y si no sabe cómo, que pida ayuda, aquí se ayuda. El último pasa cerca de medianoche. Se baja en Isabel la Católica, o en Zócalo si va en metro: la casa está a dos calles del Zócalo.
- Taxi autorizado: seguro, pero más caro, unos $500 MXN.
- Uber o DiDi: funcionan perfectamente y salen en unos $200 MXN.
- También se puede reservar el traslado por adelantado para que alguien lo esté esperando (se cotiza en dólares); eso lo gestiona recepción.
- Con maletas y de noche, mejor taxi autorizado o Uber/DiDi que el transporte público.

ANTES DE LLEGAR A LA CIUDAD:
- Datos para el teléfono: un paquete de Telcel, que se compra en cualquier Oxxo o 7-Eleven. Es el que mejor cobertura tiene.
- Llevar algo de efectivo, sobre todo para salir de las zonas turísticas, donde no siempre aceptan tarjeta.
- El transporte público es una manera estupenda de moverse, pero conviene evitar las horas pico.`;

const SISTEMA = `Eres "Don José", el conserje de Casa Pepe: un anfitrión de la vieja escuela, experto de la casa y de la Ciudad de México, que atiende a los huéspedes por chat en la app (APePe).

Tono: cálido, humano, cercano y breve. Español de México (o inglés si el huésped escribe en inglés). Trata de tú. 2 a 5 frases. Sin corporativismos ni relleno. Puedes usar 1 emoji de vez en cuando, con medida.

Lo que SÍ haces: orientar y aconsejar. Cómo llegar, horarios, qué hacer, recomendaciones de la ciudad y del barrio, explicar los servicios de la casa, y leer y explicarle al huésped el estatus de SU reserva (fechas, habitación, si está pagada o confirmada) cuando la tengas en el contexto.

Reglas duras (no se rompen):
- NO inventes datos, horarios, precios ni políticas que no estén en los DATOS DE LA CASA o en el contexto de la reserva. Si no lo sabes, dilo con naturalidad y ofrece pasarlo con recepción.
- NUNCA prometas dinero, cancelaciones sin costo, cambios de fecha, ampliaciones, upgrades ni precios, y NUNCA digas que "ya quedó hecho" algo. Tú todavía no ejecutas cambios.
- Si el huésped quiere CANCELAR, RECORRER la fecha, AMPLIAR, cambiar el número de personas, o pide una COMPENSACIÓN por algo del cuarto, un OBJETO OLVIDADO, o dejar una RESEÑA: escúchalo con calidez, explícale en general cómo funciona (sin comprometer nada), y dile que lo dejas ANOTADO PARA RECEPCIÓN y que ellos lo confirman y lo gestionan. Puedes decir que queda anotado: eso sí es verdad, se abre un aviso para el equipo. Lo que no puedes decir es que ya está resuelto.
- Si reporta algo del cuarto o una molestia, muestra empatía real, dile que queda anotado y que recepción/mantenimiento lo atiende enseguida; no minimices ni prometas compensación.
- Para el aeropuerto y la seguridad del huésped: de día y sin mucho equipaje, el Metrobús es la opción de local y la más barata; de noche o con maletas, taxi autorizado o Uber/DiDi.
- Si detectas una emergencia (salud, seguridad), dile que contacte YA a recepción (lobby 24h) o a los servicios de emergencia.

Responde SOLO con el texto que se le muestra al huésped en el chat. Sin JSON, sin markdown, sin encabezados.`;

/* El segundo pase: decide si esto hay que pasárselo a Front. Se le pide poco y
   se le pide estricto, porque de esto sale una fila en una tabla. */
const CLASIFICA = `Eres el filtro de recepción de un hotel. Lees lo último que escribió un huésped en el chat del conserje y decides si hay que abrir un aviso para el equipo de recepción (Front).

Abres aviso SOLO en estos tres casos:
- "incidencia": algo de la casa o de su cuarto que hay que atender (avería, ruido, limpieza, falta algo, wifi caído, agua, llave, seguridad). También un objeto olvidado.
- "cambio_reserva": quiere cancelar, recorrer o adelantar fechas, ampliar noches, cambiar el número de personas, cambiar de cuarto, o pregunta por un late check-out o early check-in concreto.
- "queja": está molesto, pide una compensación o un reembolso, o cuenta algo que salió mal.

NO abres aviso si solo pide información, recomendaciones, cómo llegar, horarios, qué hacer, o si charla.

Prioridad: 1 si es urgente o afecta a que pueda dormir, entrar, ducharse o estar seguro (o está muy molesto); 2 lo normal; 3 si puede esperar.

Responde ÚNICAMENTE con un objeto JSON, sin texto alrededor y sin markdown:
{"abrir":true|false,"tipo":"incidencia"|"cambio_reserva"|"queja","prioridad":1|2|3,"titulo":"...","detalle":"..."}
El "titulo" es una línea de menos de 70 caracteres que un recepcionista entiende de un vistazo. El "detalle" resume en dos o tres frases qué pide y qué contexto hay, en español, sin inventar nada. Si abrir es false, pon el resto en null.`;

async function ia(system: string, messages: any[], max = 600) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO, max_tokens: max, system, messages }),
  });
  if (!r.ok) throw new Error(`IA ${r.status}`);
  const j = await r.json();
  return (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
}

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function reservaContexto(token: string): Promise<{ texto: string; datos: any }> {
  const nada = { texto: "El huésped aún no ha ligado su reserva (no tienes sus datos). Puedes ayudarle con información general y pedirle que abra el chat desde el link de su reserva si quiere que veas su estancia.", datos: null };
  if (!token) return nada;
  try {
    const r = await fetch(`${SB_URL}/functions/v1/apepe-reserva`, {
      method: "POST",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok || !j.reserva) return { texto: "No se pudo leer la reserva del huésped ahora mismo; ayúdale con información general y, para su reserva, remítelo a recepción.", datos: null };
    const x = j.reserva;
    const ck = j.ya_checkin ? "sí" : "no";
    return {
      datos: x,
      texto: `RESERVA DEL HUÉSPED (léela para orientarlo; no la compartas en crudo, explícala natural):
- Nombre: ${x.nombre || "—"}
- Llegada: ${x.desde || "—"} · Salida: ${x.hasta || "—"} · Noches: ${x.noches ?? "—"}
- Habitación: ${x.habitacion || "—"} · Personas: ${x.pax ?? "—"}
- Estatus: ${x.status || "—"} · Pago: ${x.pago?.estado || "—"}
- Ya hizo check-in en la app: ${ck}
Nota: para cancelar/mover/ampliar o confirmar si aplica cancelación sin costo, deriva a recepción (ellos ven los términos exactos de su tarifa).`,
    };
  } catch {
    return { texto: "No se pudo leer la reserva del huésped; ayúdale con información general y remite su reserva a recepción.", datos: null };
  }
}

async function eventosProx(): Promise<string> {
  try {
    const r = await rest("rpc/apepe_catalogo", { method: "POST", body: JSON.stringify({ p_dias: 7 }) });
    const j = await r.json().catch(() => []);
    if (!Array.isArray(j) || !j.length) return "";
    const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
    const top = j
      .filter((e: any) => e.proxima_fecha && String(e.proxima_fecha) >= hoy)
      .sort((a: any, b: any) => String(a.proxima_fecha).localeCompare(String(b.proxima_fecha)))
      .slice(0, 8)
      .map((e: any) => `- ${e.nombre}${e.proxima_fecha ? " (próx. " + String(e.proxima_fecha).slice(5) + (e.proxima_hora ? " " + String(e.proxima_hora).slice(0, 5) : "") + ")" : ""}${e.apepe_gratuito ? " · gratis por propina" : ""}`)
      .join("\n");
    return top ? `EXPERIENCIAS PRÓXIMAS (próximos días, por si recomienda algo real; dile que reserve en la sección Experiencias):\n${top}` : "";
  } catch {
    return "";
  }
}

/* ¿Ya hay uno abierto de lo mismo? Un huésped que insiste tres veces con su
   cambio de fecha no tiene que generar tres tickets: es el mismo asunto, y
   recepción lo vería como tres personas distintas. */
async function yaHayAbierto(token: string, tipo: string) {
  if (!token) return false;
  const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const r = await rest(
    `apepe_tickets?select=id&reserva_token=eq.${token}&tipo=eq.${tipo}` +
    `&estado=in.(nuevo,en_curso)&created_at=gte.${desde}&limit=1`,
  );
  if (!r.ok) return false;
  const j = await r.json().catch(() => []);
  return Array.isArray(j) && j.length > 0;
}

async function abreTicket(token: string, resv: any, mensajes: any[], respuesta: string) {
  let crudo = "";
  try {
    crudo = await ia(CLASIFICA, mensajes.slice(-4), 400);
  } catch { return null; }

  let v: any = null;
  try {
    const m = crudo.match(/\{[\s\S]*\}/);
    v = m ? JSON.parse(m[0]) : null;
  } catch { return null; }
  if (!v || v.abrir !== true) return null;
  if (!["incidencia", "cambio_reserva", "queja"].includes(v.tipo)) return null;
  if (await yaHayAbierto(token, v.tipo)) return null;

  const t = await rest("apepe_tickets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tipo: v.tipo,
      prioridad: [1, 2, 3].includes(Number(v.prioridad)) ? Number(v.prioridad) : 2,
      titulo: String(v.titulo || "Aviso del chat").slice(0, 140),
      detalle: v.detalle ? String(v.detalle).slice(0, 2000) : null,
      reserva_token: token || null,
      huesped: resv?.nombre || null,
      huesped_email: resv?.email || null,
      /* Lo que dijo, tal cual: Front no debería fiarse solo del resumen. */
      conversacion: mensajes.slice(-6).concat([{ role: "assistant", content: respuesta }]),
    }),
  });
  if (!t.ok) return null;
  const fila = (await t.json().catch(() => []))[0];
  return fila ? { folio: fila.folio, tipo: fila.tipo, prioridad: fila.prioridad } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);
  if (!ANTHROPIC_KEY) return J({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const token = String(body.token || "").trim();
  let mensajes = Array.isArray(body.mensajes) ? body.mensajes : [];
  // saneo: solo role user/assistant, content texto, últimos 12, cada uno acotado
  mensajes = mensajes
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  if (!mensajes.length) return J({ ok: false, error: "sin mensaje" }, 400);
  if (mensajes[mensajes.length - 1].role !== "user") return J({ ok: false, error: "el último mensaje debe ser del huésped" }, 400);

  const [ctxReserva, ctxEventos] = await Promise.all([reservaContexto(token), eventosProx()]);
  const system = [SISTEMA, HECHOS, ctxReserva.texto, ctxEventos].filter(Boolean).join("\n\n");

  let texto = "";
  try {
    texto = await ia(system, mensajes, 600);
  } catch (e) {
    return J({ ok: false, error: "no se pudo contactar a la IA", detalle: String(e).slice(0, 200) }, 502);
  }
  const respuesta = texto || "Perdona, no te entendí bien. ¿Me lo dices de otra forma?";

  /* El aviso a recepción va después y aparte: si esto revienta, el huésped ya
     tiene su respuesta y nadie se entera de nada raro. */
  let ticket = null;
  try {
    const uuid = /^[0-9a-f-]{36}$/i.test(token) ? token : "";
    ticket = await abreTicket(uuid, ctxReserva.datos, mensajes, respuesta);
  } catch (_) { ticket = null; }

  return J({ ok: true, respuesta, ticket });
});
