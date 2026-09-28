// apepe-donjose — "Don José", conserje de Casa Pepe para el huésped (APePe).
//
// v1 ASESOR: informa y aconseja (cómo llegar, horarios, mapa, planes/eventos) y
// LEE el estatus de la reserva del huésped (Cloudbeds, vía apepe-reserva con su token).
// NO ejecuta cambios: cancelar/recorrer/ampliar/cambiar personas, compensaciones,
// objetos olvidados y links de reseña se derivan a recepción. (Las acciones
// auto-ejecutables con candados son una fase posterior — decisión de Javi.)
//
// body: { token?: string, mensajes: [{role:'user'|'assistant', content:string}] }
// -> { ok, respuesta }
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
const HECHOS = `DATOS DE LA CASA (Casa Pepe CDMX — Hostal Boutique, Centro Histórico, República de Uruguay):
- Check-in: desde las 15:00. Check-out: hasta las 12:00. Check-out tardío después de las 12:00 tiene recargo (50% de la noche) y después de las 17:00 se cobra la noche completa; para pedir un ratito más, que lo consulte en recepción según disponibilidad.
- Desayuno: de 7:00 a 11:00.
- Horarios: Lobby 24h · Cocina 12:00–23:00 · bar "La Cósmica" 7:00–23:00 · "power hour" a las 19:00 · el descanso (silencio) empieza a las 23:00.
- La tarifa incluye: un coctel de cortesía (reclamable de 14:00 a 19:00, antes de la power hour), un Café de Olla al llegar, un walking tour diario de 2h y un mapa de la ciudad.
- Experiencias (walkings, talleres, food tours, retos): están en la sección Experiencias de la app (/apepe/experiencias) y hay eventos auténticos con la comunidad que cambian cada semana.
- El mapa con nuestras recomendaciones está en la app (botón Mapa).
- Del aeropuerto de CDMX al Centro: lo más seguro es un taxi autorizado del aeropuerto o un Uber/Didi (unos 30–45 min según tráfico). El metro es la opción más económica pero con maletas no es cómodo.
- No se permiten alimentos ni bebidas alcohólicas en las habitaciones; hay lockers y cajas de seguridad para objetos de valor.`;

const SISTEMA = `Eres "Don José", el conserje de Casa Pepe: un anfitrión de la vieja escuela, experto de la casa y de la Ciudad de México, que atiende a los huéspedes por chat en la app (APePe).

Tono: cálido, humano, cercano y breve. Español de México (o inglés si el huésped escribe en inglés). Trata de tú. 2 a 5 frases. Sin corporativismos ni relleno. Puedes usar 1 emoji de vez en cuando, con medida.

Lo que SÍ haces: orientar y aconsejar. Cómo llegar, horarios, qué hacer, recomendaciones de la ciudad y del barrio, explicar los servicios de la casa, y leer y explicarle al huésped el estatus de SU reserva (fechas, habitación, si está pagada o confirmada) cuando la tengas en el contexto.

Reglas duras (no se rompen):
- NO inventes datos, horarios, precios ni políticas que no estén en los DATOS DE LA CASA o en el contexto de la reserva. Si no lo sabes, dilo con naturalidad y ofrece pasarlo con recepción.
- NUNCA prometas dinero, cancelaciones sin costo, cambios de fecha, ampliaciones, upgrades ni precios, y NUNCA digas que "ya quedó hecho" algo. Tú todavía no ejecutas cambios.
- Si el huésped quiere CANCELAR, RECORRER la fecha, AMPLIAR, cambiar el número de personas, o pide una COMPENSACIÓN por algo del cuarto, un OBJETO OLVIDADO, o dejar una RESEÑA: escúchalo con calidez, explícale en general cómo funciona (sin comprometer nada), y dile que RECEPCIÓN lo confirma y lo gestiona. Ofrece dejarlo anotado para recepción.
- Si reporta algo del cuarto o una molestia, muestra empatía real y dile que recepción/mantenimiento lo atiende enseguida; no minimices ni prometas compensación.
- Para el aeropuerto y la seguridad del huésped, recomienda taxi autorizado o Uber/Didi; el metro solo como opción económica sin maletas.
- Si detectas una emergencia (salud, seguridad), dile que contacte YA a recepción (lobby 24h) o a los servicios de emergencia.

Responde SOLO con el texto que se le muestra al huésped en el chat. Sin JSON, sin markdown, sin encabezados.`;

async function reservaContexto(token: string): Promise<string> {
  if (!token) return "El huésped aún no ha ligado su reserva (no tienes sus datos). Puedes ayudarle con información general y pedirle que abra el chat desde el link de su reserva si quiere que veas su estancia.";
  try {
    const r = await fetch(`${SB_URL}/functions/v1/apepe-reserva`, {
      method: "POST",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok || !j.reserva) return "No se pudo leer la reserva del huésped ahora mismo; ayúdale con información general y, para su reserva, remítelo a recepción.";
    const x = j.reserva;
    const ck = j.ya_checkin ? "sí" : "no";
    return `RESERVA DEL HUÉSPED (léela para orientarlo; no la compartas en crudo, explícala natural):
- Nombre: ${x.nombre || "—"}
- Llegada: ${x.desde || "—"} · Salida: ${x.hasta || "—"} · Noches: ${x.noches ?? "—"}
- Habitación: ${x.habitacion || "—"} · Personas: ${x.pax ?? "—"}
- Estatus: ${x.status || "—"} · Pago: ${x.pago?.estado || "—"}
- Ya hizo check-in en la app: ${ck}
Nota: para cancelar/mover/ampliar o confirmar si aplica cancelación sin costo, deriva a recepción (ellos ven los términos exactos de su tarifa).`;
  } catch {
    return "No se pudo leer la reserva del huésped; ayúdale con información general y remite su reserva a recepción.";
  }
}

async function eventosProx(): Promise<string> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/apepe_catalogo`, {
      method: "POST",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_dias: 7 }),
    });
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
  const system = [SISTEMA, HECHOS, ctxReserva, ctxEventos].filter(Boolean).join("\n\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELO, max_tokens: 600, system, messages: mensajes }),
    });
    if (!r.ok) { const t = await r.text(); return J({ ok: false, error: `IA ${r.status}`, detalle: t.slice(0, 200) }, 502); }
    const ia = await r.json();
    const texto = (ia.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    return J({ ok: true, respuesta: texto || "Perdona, no te entendí bien. ¿Me lo dices de otra forma?" });
  } catch (e) {
    return J({ ok: false, error: "no se pudo contactar a la IA", detalle: String(e).slice(0, 200) }, 502);
  }
});
