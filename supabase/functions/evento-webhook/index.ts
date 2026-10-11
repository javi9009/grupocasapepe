// Webhook de la VENTA DE BOLETOS DE EVENTO (Ateneo). v6, 11-oct-2026.
// Unica fuente de verdad del cobro: el ?pago=ok del navegador no confirma nada.
// Cobro directo en la cuenta del productor (PaymentIntent), asi que el aviso
// llega desde su cuenta conectada: Stripe lo dice en ev.account. Sin JWT: Stripe
// no manda uno; se comprueba la FIRMA. verify_jwt debe quedar en FALSE.
//
// v5 — Javi, 11-oct-2026. Dos cosas:
//
//  · LA SEGUNDA PUERTA. Un webhook solo sirve para lo que pasa DESPUES de darlo
//    de alta: Stripe no reenvia solo lo de antes. Y aunque este dado de alta, un
//    aviso se puede perder —Stripe cae, nosotros caemos, la red—. Asi que ahora
//    esta funcion tambien acepta, con sesion del equipo de casa, un
//    {accion:'reconciliar', folio} que le PREGUNTA a Stripe como quedo ese cobro
//    y, si entro, hace exactamente lo mismo que haria el aviso: marcar pagado y
//    mandar el boleto. El codigo de confirmar vive en un solo sitio, que es lo
//    que evita que el correo y el estado se contradigan.
//
//  · stripe_charge_id. El PATCH escribia esa columna y la columna NO EXISTIA.
//    PostgREST rechaza el PATCH entero cuando sobra un campo, asi que, una vez
//    dado de alta el webhook, el cobro habria seguido quedandose en «pendiente»
//    y el boleto sin mandar, igual que ahora pero sin motivo aparente. La
//    columna ya esta creada; esto queda escrito para que no se vuelva a quitar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SECRETOS = [
  Deno.env.get("STRIPE_WEBHOOK_SECRET_ATENEO"),
  Deno.env.get("STRIPE_WEBHOOK_SECRET_CONNECT"),
  Deno.env.get("STRIPE_WEBHOOK_SECRET"),
].filter((x): x is string => !!x);

const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("SINCRETICO_FROM") ?? "Sincrético <javi@casapepe.mx>";
const REPLY = Deno.env.get("SINCRETICO_REPLY_TO") ?? "";
const BOLETO_BASE = "https://casapepe.mx/sincretico/evento-boleto.html";
/* La misma llave con la que cobra evento-checkout: si se cobro en prueba, se
   pregunta en prueba. */
const SK = Deno.env.get("STRIPE_SECRET_KEY_ATENEO_TEST")
        ?? Deno.env.get("STRIPE_SECRET_KEY_ATENEO") ?? "";

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

function hex(b: ArrayBuffer) { return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function iguales(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function firmaValida(cuerpo: string, cabecera: string | null) {
  if (!SECRETOS.length || !cabecera) return false;
  const p: Record<string, string> = {};
  for (const x of cabecera.split(",")) { const i = x.indexOf("="); if (i > 0) p[x.slice(0, i).trim()] = x.slice(i + 1).trim(); }
  const t = p["t"], v1 = p["v1"]; if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  let vale = false;
  for (const s of SECRETOS) {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${cuerpo}`));
    if (iguales(hex(f), v1)) vale = true;
  }
  return vale;
}

/* Para la segunda puerta: quien pide reconciliar tiene que ser del equipo. */
async function esEquipo(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === ANON || jwt.startsWith("sb_publishable_")) return false;
  if (jwt === SRK) return true;
  return await fetch(`${URL_SB}/rest/v1/rpc/es_equipo_casa`, {
    method: "POST",
    headers: { apikey: ANON || SRK, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((x) => x.ok ? x.json() : false).catch(() => false) === true;
}

async function mandaBoleto(reservaId: string) {
  try {
    const r = await sb(`evento_reservas?id=eq.${reservaId}&select=folio,email,nombre,tier_nombre,pax,qr_token,evento_id&limit=1`);
    const res = r.body?.[0]; if (!res || !res.email) return;
    let evNombre = "tu evento", cuando = "";
    const e = await sb(`eventos?id=eq.${res.evento_id}&select=nombre,fecha_inicio&limit=1`);
    if (e.body?.[0]) { evNombre = e.body[0].nombre ?? evNombre; cuando = e.body[0].fecha_inicio ?? ""; }
    if (!RESEND) return;
    const link = `${BOLETO_BASE}?f=${encodeURIComponent(res.folio)}`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#2c2c2a">
      <h2 style="font-family:Oswald,Arial;text-transform:uppercase">¡Pago confirmado!</h2>
      <p>Hola ${res.nombre ?? ""}, tu ${res.pax > 1 ? res.pax + " boletos" : "boleto"} para <b>${evNombre}</b> ${cuando ? "· " + String(cuando).slice(0, 16).replace("T", " ") : ""} ${res.tier_nombre ? "(" + res.tier_nombre + ")" : ""} quedó pagado.</p>
      <p>Folio <b>${res.folio}</b>. Abre tu boleto con su código QR — es lo que te deja entrar:</p>
      <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#C9501A;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Ver mi boleto</a></p>
      <p style="color:#888;font-size:12px">Si el botón no abre, copia: ${link}</p></div>`;
    const body: Record<string, unknown> = { from: FROM, to: res.email, subject: `Tu boleto · ${evNombre} · ${res.folio}`, html };
    if (REPLY) body.reply_to = REPLY;
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (e) { console.error("mandaBoleto", reservaId, String(e)); }
}

async function confirma(id: string, o: any, cuenta: string | null) {
  const r = await sb(`evento_reservas?select=pago_estado&id=eq.${id}&limit=1`);
  const res = r.body?.[0]; if (!res) return false;
  if (res.pago_estado === "pagado") return true;
  const intent = o.payment_intent ?? (o.object === "payment_intent" ? o.id : null);
  const charge = o.latest_charge ?? (o.charges?.data?.[0]?.id ?? null);
  const cambios: Record<string, unknown> = { estado: "confirmada", pago_estado: "pagado", pagado_at: new Date().toISOString(), stripe_payment_intent: intent };
  if (charge) cambios.stripe_charge_id = typeof charge === "string" ? charge : charge?.id ?? null;
  if (cuenta) cambios.stripe_destino = cuenta;
  const up = await sb(`evento_reservas?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(cambios) });
  if (!up.ok) { console.error("confirma PATCH", id, up.status, JSON.stringify(up.body)); return false; }
  await mandaBoleto(id);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Solo POST", { status: 405 });
  const cuerpo = await req.text();

  /* ---------- PUERTA 2: ponerse al dia a mano ----------
     Se mira ANTES de la firma: esto no viene de Stripe, viene de nosotros. */
  if (!req.headers.get("stripe-signature")) {
    let b: any = null; try { b = JSON.parse(cuerpo); } catch { /* sigue */ }
    if (b && String(b.accion ?? "") === "reconciliar") {
      if (!SK) return json({ error: "falta la llave de Stripe" }, 503);
      /* Dos llaves para esta puerta: el equipo con su sesion, y la PRODUCTORA
         con el token de su portal —y entonces solo sus propias reservas—.
         Que ella pueda comprobarlo es justo lo que hace falta cuando el cliente
         jura que pago y la pantalla dice que no: esto no decide nada, le
         pregunta a Stripe y escribe lo que Stripe conteste. */
      let miProd = "";
      const tok = String(b.token ?? "").trim();
      if (tok) {
        const p = await sb(`productoras?select=id&portal_token=eq.${encodeURIComponent(tok)}&estado=neq.baja&limit=1`);
        if (!p.body?.[0]) return json({ error: "liga no válida" }, 401);
        miProd = p.body[0].id;
      } else if (!(await esEquipo(req))) {
        return json({ error: "sin sesión" }, 401);
      }
      const folio = String(b.folio ?? "").trim().toUpperCase();
      const rid   = String(b.reserva_id ?? "").trim();
      if (!folio && !rid) return json({ error: "dime el folio" }, 400);
      const q = await sb(`evento_reservas?select=*&` +
        (rid ? `id=eq.${encodeURIComponent(rid)}` : `folio=eq.${encodeURIComponent(folio)}`) +
        (miProd ? `&productora_id=eq.${miProd}` : "") + `&limit=1`);
      const res = q.body?.[0];
      if (!res) return json({ error: miProd ? "esa reserva no es de tus eventos" : "no encuentro esa reserva" }, 404);
      if (!res.stripe_payment_intent) {
        return json({ ok: true, folio: res.folio, estado: "sin_cobro", pagado: false,
          mensaje: "Esa reserva nunca llegó a abrir un cobro: no hay nada que conciliar." });
      }
      const h: Record<string, string> = { Authorization: `Bearer ${SK}` };
      if (res.stripe_destino) h["Stripe-Account"] = String(res.stripe_destino);
      const v = await fetch(`https://api.stripe.com/v1/payment_intents/${res.stripe_payment_intent}`, { headers: h });
      const pi = await v.json();
      if (!v.ok) return json({ error: "Stripe no contestó: " + String(pi?.error?.message ?? "").slice(0, 160) }, 502);
      if (pi.status !== "succeeded") {
        return json({ ok: true, folio: res.folio, estado: pi.status, pagado: false,
          mensaje: `Stripe dice «${pi.status}»: ese cobro no entró. No hay dinero cobrado.` });
      }
      const ya = res.pago_estado === "pagado";
      const hecho = await confirma(res.id, pi, res.stripe_destino ?? null);
      return json({ ok: hecho, folio: res.folio, estado: "succeeded", pagado: true, ya,
        importe: Number(pi.amount ?? 0) / 100,
        mensaje: ya ? "Ya estaba marcada como pagada."
          : hecho ? "Ese cobro SÍ entró. Marcada como pagada y boleto enviado."
                  : "El cobro entró pero no se pudo marcar. Mira los registros." });
    }
  }

  /* ---------- PUERTA 1: el aviso de Stripe ---------- */
  if (!(await firmaValida(cuerpo, req.headers.get("stripe-signature")))) return new Response("Firma invalida", { status: 400 });
  let ev: any; try { ev = JSON.parse(cuerpo); } catch { return new Response("Ilegible", { status: 400 }); }
  const o = ev?.data?.object ?? {};
  if (String(o?.metadata?.tipo ?? "") && o?.metadata?.tipo !== "evento") return new Response("ok", { status: 200 });
  const id = o?.metadata?.reserva_id || null;
  const cuenta: string | null = ev?.account ?? null;
  try {
    if (ev.type === "charge.refunded" && o.payment_intent) {
      await sb(`evento_reservas?stripe_payment_intent=eq.${o.payment_intent}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pago_estado: "reembolsado" }) });
      return new Response("ok", { status: 200 });
    }
    if (!id) return new Response("ok", { status: 200 });
    if (ev.type === "payment_intent.succeeded") { await confirma(id, o, cuenta); return new Response("ok", { status: 200 }); }
    if (ev.type === "payment_intent.payment_failed") {
      const r = await sb(`evento_reservas?select=pago_estado&id=eq.${id}&limit=1`);
      if (r.body?.[0] && r.body[0].pago_estado !== "pagado")
        await sb(`evento_reservas?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pago_estado: "fallido" }) });
      return new Response("ok", { status: 200 });
    }
  } catch (e) { console.error("evento-webhook", ev?.type, String(e)); }
  return new Response("ok", { status: 200 });
});
