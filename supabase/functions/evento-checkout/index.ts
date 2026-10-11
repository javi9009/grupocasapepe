// VENTA DE BOLETOS DE EVENTO — abre el cobro. v4, 11-oct-2026.
// Espeja sinc-pago: PaymentIntent con cobro directo en la cuenta Connect del productor
// y la comision del Ateneo como application_fee. El importe SIEMPRE sale de la base
// (evento_reservas.pago_total), nunca del navegador. Llave del Ateneo (misma cuenta).
//
// v2: el 'contexto' devuelve el evento y el comprador, para la columna del
// detalle de la pantalla de pago.
// v3: devuelve tambien si quien vende traslada IVA. La productora de la prueba
// esta dada de alta como persona fisica SIN actividad empresarial (CURP, sin
// RFC): esa figura no es contribuyente de IVA y no puede facturar, asi que
// ponerle al comprador «IVA 16% incluido» era enseñarle un impuesto que nadie
// cobra.
//
// v4 — QUIEN COME LA COMISION DE STRIPE. Javi, 11-oct-2026.
// Con cargo directo, el coste de Stripe se lo descuenta Stripe a la cuenta
// CONECTADA, no a nosotros. Resultado: de un boleto de $350, la productora
// cobraba 59,8% en vez del 65% pactado, y nuestro 35% salia entero. El
// productor pagaba nuestra pasarela sin saberlo, y cuanto mas barato el
// boleto, peor (los $3 fijos pesan mas).
// Ahora el coste de Stripe se descuenta de NUESTRA comision: el productor
// recibe su porcentaje limpio y nosotros cobramos lo que sobra. En un boleto
// de $350 al 35%: $122,50 brutos menos $18,10 de Stripe = $104,40 (29,8%).
// Es una ESTIMACION: la tasa real depende de la tarjeta (una extranjera cuesta
// mas). Si la estimacion se queda corta, la diferencia la ponemos nosotros, que
// es justo el sentido de absorberla. Nunca al reves.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SK     = Deno.env.get("STRIPE_SECRET_KEY_ATENEO_TEST") ?? Deno.env.get("STRIPE_SECRET_KEY_ATENEO") ?? "";
const PK     = Deno.env.get("STRIPE_PUBLISHABLE_KEY_ATENEO_TEST") ?? Deno.env.get("STRIPE_PUBLISHABLE_KEY_ATENEO") ?? Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";
const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/* Tarifa de Stripe Mexico para tarjeta nacional, con IVA encima. Si algun dia
   cambia, se cambia aqui y en ningun sitio mas. */
const STRIPE_PCT  = Number(Deno.env.get("STRIPE_TARIFA_PCT") ?? "3.6");
const STRIPE_FIJO = Number(Deno.env.get("STRIPE_TARIFA_FIJA") ?? "3");    // pesos
const STRIPE_IVA  = Number(Deno.env.get("STRIPE_TARIFA_IVA") ?? "16");    // %

/* Lo que Stripe le va a descontar a la cuenta conectada por este cobro. */
function costeStripe(centavos: number): number {
  const bruto = centavos * STRIPE_PCT / 100 + STRIPE_FIJO * 100;
  return Math.round(bruto * (1 + STRIPE_IVA / 100));
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}

async function stripe(path: string, cuerpo: URLSearchParams | null, cuenta: string | null, idem?: string) {
  const h: Record<string, string> = { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" };
  if (cuenta) h["Stripe-Account"] = cuenta;
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: cuerpo ? "POST" : "GET", headers: h, body: cuerpo ?? undefined });
  return { ok: r.ok, j: await r.json() };
}

async function datos(folio: string) {
  const r = await sb(`evento_reservas?folio=eq.${encodeURIComponent(folio)}&select=*&limit=1`);
  return r.body?.[0] ?? null;
}
async function productoraDe(productoraId: string | null) {
  if (!productoraId) return null;
  const o = await sb(`productoras?select=stripe_account_id,nombre_comercial,tipo_persona,quien_factura&id=eq.${productoraId}&limit=1`);
  return o.body?.[0] ?? null;
}

/* Hay IVA que desglosar cuando factura Casa Pepe, o cuando la productora es
   persona fisica con actividad empresarial o persona moral. Con 'fisica_sin'
   facturando ella, no hay IVA. Si no sabemos el tipo, se asume que si. */
function trasladaIva(p: any): boolean {
  if (!p) return true;
  if (p.quien_factura === "casa_pepe") return true;
  if (p.tipo_persona === "fisica" || p.tipo_persona === "moral") return true;
  if (p.tipo_persona === "fisica_sin") return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);
  if (!SK) return json({ error: "El cobro con tarjeta todavía no está configurado." }, 503);

  let b: any; try { b = await req.json(); } catch { return json({ error: "Cuerpo ilegible" }, 400); }
  const folio  = String(b?.folio ?? "").trim().toUpperCase();
  const accion = String(b?.accion ?? "").trim();
  if (!folio) return json({ error: "falta el folio" }, 400);

  const res = await datos(folio);
  if (!res) return json({ error: "No encontramos esa reserva" }, 404);
  const prod = await productoraDe(res.productora_id);
  const cuenta = prod?.stripe_account_id ?? null;
  if (!cuenta) return json({ error: "El productor todavía no conectó su Stripe para cobrar en línea." }, 409);

  if (accion === "contexto") {
    let ev: any = null;
    if (res.evento_id) {
      const e = await sb(`eventos?id=eq.${res.evento_id}&select=nombre,fecha_inicio,espacio,fotos&limit=1`);
      ev = e.body?.[0] ?? null;
    }
    return json({
      pk: PK || null, cuenta, folio: res.folio,
      total: Number(res.pago_total ?? 0),
      subtotal: Number(res.total ?? res.pago_total ?? 0),
      descuento: Number(res.descuento_mxn ?? 0),
      unitario: Number(res.pvp_unitario ?? 0),
      moneda: res.moneda || "mxn", tier: res.tier_nombre, pax: res.pax,
      nombre: res.nombre ?? null, email: res.email ?? null, telefono: res.telefono ?? null,
      productora: prod?.nombre_comercial ?? null,
      iva: trasladaIva(prod),
      evento: ev ? { nombre: ev.nombre, fecha_inicio: ev.fecha_inicio, espacio: ev.espacio, fotos: ev.fotos } : null,
      pagado: res.pago_estado === "pagado",
    });
  }

  if (res.pago_estado === "pagado") return json({ error: "Esa reserva ya está pagada", folio: res.folio }, 409);
  const total = Number(res.pago_total ?? 0);
  if (!(total > 0)) return json({ error: "Esa reserva no tiene importe que cobrar" }, 409);
  const centavos = Math.round(total * 100);
  const moneda = String(res.moneda || "mxn");
  const pct = Number(res.comision_pct ?? 0);

  /* Nuestra parte bruta, y de ahi sale el coste de la pasarela. Si el boleto es
     tan barato que la comision no cubre a Stripe, el fee se queda en 0: el
     productor cobra su parte entera y la pasarela nos la comemos completa. */
  const bruta  = pct > 0 && pct < 100 ? Math.min(Math.round(centavos * pct / 100), centavos) : 0;
  const coste  = costeStripe(centavos);
  const fee    = Math.max(0, bruta - coste);

  if (res.stripe_payment_intent) {
    const v = await stripe(`payment_intents/${res.stripe_payment_intent}`, null, cuenta);
    const pi = v.j;
    if (v.ok && pi?.client_secret && pi.amount === centavos &&
        ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status))
      return json({ client_secret: pi.client_secret, pk: PK || null, cuenta, folio: res.folio });
  }

  const f = new URLSearchParams();
  f.set("amount", String(centavos));
  f.set("currency", moneda);
  f.set("automatic_payment_methods[enabled]", "true");
  f.set("metadata[reserva_id]", res.id);
  f.set("metadata[folio]", String(res.folio ?? ""));
  f.set("metadata[tipo]", "evento");
  f.set("metadata[comision_bruta_mxn]", String(bruta / 100));
  f.set("metadata[stripe_estimado_mxn]", String(coste / 100));
  if (res.email) f.set("receipt_email", String(res.email));
  f.set("description", `Boleto ${res.folio} · ${res.tier_nombre ?? ""} · ${res.pax} ${res.pax === 1 ? "boleto" : "boletos"}`);
  if (fee > 0) f.set("application_fee_amount", String(fee));

  const s = await stripe("payment_intents", f, cuenta, `evt-pi-${res.id}-${centavos}-v4`);
  if (!s.ok || !s.j?.client_secret) { console.error("stripe", s.j?.error?.message); return json({ error: "No pudimos abrir el pago. Inténtalo otra vez en un momento." }, 502); }

  /* Lo que de verdad le queda al productor: el cobro menos nuestra comision y
     menos lo que Stripe le descuenta a su cuenta. Antes se guardaba sin restar
     la pasarela, y por eso el numero del panel no cuadraba con su saldo. */
  await sb(`evento_reservas?id=eq.${res.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ stripe_payment_intent: s.j.id, pago_estado: "pendiente", stripe_destino: cuenta,
      stripe_comision_mxn: fee ? fee / 100 : 0,
      stripe_neto_prod_mxn: (centavos - fee - coste) / 100 }) });

  return json({ client_secret: s.j.client_secret, pk: PK || null, cuenta, folio: res.folio });
});
