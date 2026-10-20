// apepe-pago — cobrar con tarjeta el saldo de una reserva de hotel.
//
// Javi, 20-oct-2026: «el link del correo de tu tarjeta no pasó debería de ser
// un link a stripe para hacer el pago (ayer lo teníamos así) pero ahora parece
// que manda a sincrético».
//
// Mirado de cerca, nunca fue así: el botón «Pagar ahora» del correo iba a
// /apepe/index.html —la portada de la App Huésped, que es donde se ven las
// experiencias de Sincrético— y en todo el sistema no había un solo cobro de
// Stripe para el saldo de un cuarto. Los había para el Ateneo, el cine, los
// eventos, el arte y Sincrético. Para el hotel, ninguno. Esta función es el
// que faltaba.
//
//   GET ?t=<token de apepe_reserva_token>   -> 302 a Stripe Checkout
//
// Se entra con la liga de la reserva, la misma que abre el check-in: eso es lo
// que demuestra que es él. No lleva sesión (verify_jwt = false) ni la necesita,
// y no devuelve nada del huésped: solo lo manda a pagar.
//
// EL IMPORTE LO DICE CLOUDBEDS, NO EL NAVEGADOR. Se lee el balance de la
// reserva en el momento de abrir el cobro. Si el huésped pagó en recepción
// hace diez minutos, aquí ya no hay nada que cobrar y se le dice.
import { cobroHTML } from "./pantalla.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PANEL = Deno.env.get("PANEL_URL") || "https://grupocasapepe.netlify.app";
const H = { apikey: SRV, Authorization: `Bearer ${SRV}` };

/* Cada casa cobra en su propia cuenta de Stripe y lee su propia llave de
   Cloudbeds. Las llaves las instala Javi en los secretos de Supabase. */
const PROP: Record<string, { cbKey: string; cbId?: string; cbIdEnv?: string; skEnv: string; nombre: string }> = {
  cdmx:   { cbKey: "CLOUDBEDS_API_KEY",        cbId: "10668",                               skEnv: "STRIPE_SECRET_KEY_CDMX",   nombre: "Casa Pepe CDMX" },
  puebla: { cbKey: "CLOUDBEDS_API_KEY_PUEBLA", cbIdEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA",     skEnv: "STRIPE_SECRET_KEY_PUEBLA", nombre: "Casa Pepe Puebla" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

/* Cuando algo sale mal, el huésped ve una pantalla, no un JSON crudo. */
const PAG = (titulo: string, texto: string, s = 200) =>
  new Response(cobroHTML(titulo, texto), { status: s, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });

async function sb(path: string, init?: RequestInit) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  let tk = String(url.searchParams.get("t") ?? "").trim();
  let json = false;
  if (req.method === "POST") {
    json = true;
    try { const b = await req.json(); tk = String(b?.token ?? b?.t ?? tk).trim(); } catch { /* se queda con el de la query */ }
  }
  const mal = (titulo: string, texto: string, s: number) => json ? J({ ok: false, error: texto }, s) : PAG(titulo, texto, s);

  if (!/^[0-9a-f-]{36}$/i.test(tk)) return mal("Liga no válida", "Esta liga de pago no es válida. Escríbenos y te mandamos una nueva.", 400);

  // 1) La liga dice de qué reserva y de qué casa hablamos.
  const t = await (await sb(`apepe_reserva_token?select=reservation_id,property&token=eq.${tk}&limit=1`)).json().catch(() => []);
  const fila = Array.isArray(t) && t[0] ? t[0] : null;
  if (!fila?.reservation_id) return mal("Liga no válida", "Esta liga de pago no es válida. Escríbenos y te mandamos una nueva.", 404);
  const rid = String(fila.reservation_id);
  const propKey = String(fila.property || "cdmx").toLowerCase();
  const cfg = PROP[propKey] ?? PROP.cdmx;

  const cbKey = Deno.env.get(cfg.cbKey);
  const pid = cfg.cbId ?? Deno.env.get(cfg.cbIdEnv ?? "");
  const SK = Deno.env.get(cfg.skEnv) ?? "";
  if (!cbKey || !pid) return mal("No disponible", "No pudimos abrir el pago ahora mismo. Escríbenos y lo resolvemos.", 503);
  if (!SK) {
    console.error(`apepe-pago: falta el secreto ${cfg.skEnv}`);
    return mal("Pago no configurado", "El cobro con tarjeta de esta casa todavía no está configurado. Escríbenos y lo cobramos nosotros.", 503);
  }

  // 2) EL SALDO LO DICE CLOUDBEDS. Aquí no se suma nada a mano.
  const gr = await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`, { headers: { Authorization: `Bearer ${cbKey}` } })
    .then((r) => r.json()).catch(() => ({}));
  const d = gr?.data ?? gr;
  if (!d || !d.reservationID) return mal("No encontramos la reserva", "No pudimos leer tu reserva. Escríbenos y lo vemos contigo.", 502);

  const estado = String(d.status ?? "");
  if (estado === "canceled" || estado === "cancelled") {
    return mal("Reserva cancelada", "Esta reserva está cancelada, así que no hay nada que cobrar. Si crees que es un error, escríbenos.", 409);
  }

  const saldo = Number(d.balance ?? 0);
  if (!(saldo > 0)) {
    return json ? J({ ok: true, saldo: 0, pagado: true })
                : PAG("Ya está pagada", "Tu reserva no tiene saldo pendiente. No tienes que hacer nada más — nos vemos pronto.");
  }

  const gl = d.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as any[] : [];
  const main = gl.find((g: any) => g.isMainGuest) || gl[0] || {};
  const email = String(main.guestEmail || d.guestEmail || "");
  const nombre = [main.guestFirstName, main.guestLastName].filter(Boolean).join(" ") || d.guestName || "";
  const moneda = String(d.currency || "mxn").toLowerCase();

  // 3) La sesión de Stripe. El importe va en unit_amount, nunca en un link con
  //    el precio horneado — de ahí vino el lío del cine en septiembre.
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("client_reference_id", rid);
  f.set("metadata[reservation_id]", rid);
  f.set("metadata[property]", propKey);
  f.set("metadata[token]", tk);
  f.set("metadata[tipo]", "hotel_saldo");
  /* La vuelta va a un dominio nuestro escrito aquí: si la mandara el navegador
     tendríamos un redirector abierto. */
  f.set("success_url", `${PANEL}/apepe/index.html?resv=${encodeURIComponent(tk)}&pago=ok`);
  f.set("cancel_url", `${PANEL}/apepe/index.html?resv=${encodeURIComponent(tk)}&pago=no`);
  if (email) f.set("customer_email", email);
  f.set("locale", "es");
  f.set("expires_at", String(Math.floor(Date.now() / 1000) + 60 * 60 * 23));
  f.set("line_items[0][quantity]", "1");
  f.set("line_items[0][price_data][currency]", moneda);
  f.set("line_items[0][price_data][unit_amount]", String(Math.round(saldo * 100)));
  f.set("line_items[0][price_data][product_data][name]", `${cfg.nombre} · reserva ${rid}`);
  if (nombre) f.set("line_items[0][price_data][product_data][description]", `Saldo pendiente de ${nombre}`);

  const s = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SK}`,
      "Content-Type": "application/x-www-form-urlencoded",
      /* Dos clics nerviosos no abren dos cobros. El saldo entra en la clave:
         si cambia, es otro cobro distinto y debe poder abrirse. */
      "Idempotency-Key": `apepe-pago-${rid}-${Math.round(saldo * 100)}`,
    },
    body: f,
  });
  const ses = await s.json().catch(() => ({}));
  if (!s.ok || !ses?.url) {
    console.error("apepe-pago stripe:", ses?.error?.message ?? s.status);
    return mal("No pudimos abrir el pago", "No pudimos abrir la pantalla de pago. Inténtalo otra vez en un momento, o escríbenos y lo cobramos nosotros.", 502);
  }

  // 4) Rastro, antes de mandarlo a pagar. El webhook lo cierra.
  await sb("apepe_pagos", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      reservation_id: rid, property: propKey, token: tk,
      monto: saldo, moneda: moneda.toUpperCase(),
      stripe_session_id: ses.id, estado: "pendiente",
    }),
  }).catch(() => {});

  if (json) return J({ ok: true, url: ses.url, saldo, moneda: moneda.toUpperCase() });
  return new Response(null, { status: 302, headers: { ...CORS, Location: ses.url } });
});
