// apepe-pago-webhook — lo que confirma de verdad que el huésped pagó.
//
// El navegador puede cerrarse, volver por otra ruta o mentir: el `?pago=ok` de
// la URL no confirma nada. Solo esto.
//
// Cuando Stripe dice que el cobro entró:
//   1) se marca el pago como pagado en apepe_pagos,
//   2) y se asienta en la cuenta del huésped en Cloudbeds (postPayment), que es
//      lo que hace que el saldo baje y que el dinero aparezca en el cuadre.
//
// El importe que se asienta es el que Stripe dice que COBRÓ (amount_total), no
// el que pedimos: si por lo que sea cobró otra cosa, se asienta lo que de
// verdad entró. Nunca se registra un pago que no ocurrió.
//
// Idempotente de las dos maneras: Stripe reintenta, y la fila lleva
// cb_registrado para no asentar dos veces el mismo cobro en Cloudbeds.
//
// Se despliega con verify_jwt = false (Stripe no manda sesión); lo que se
// comprueba es la firma.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRV, Authorization: `Bearer ${SRV}` };

/* Secreto propio y no el STRIPE_WEBHOOK_SECRET compartido: cada endpoint de
   Stripe tiene su firma, y dos webhooks leyendo la misma variable es la receta
   para que uno de los dos rechace todo. */
const WHS = Deno.env.get("STRIPE_WEBHOOK_SECRET_APEPE") ?? "";

const PROP: Record<string, { cbKey: string; cbId?: string; cbIdEnv?: string }> = {
  cdmx:   { cbKey: "CLOUDBEDS_API_KEY",        cbId: "10668" },
  puebla: { cbKey: "CLOUDBEDS_API_KEY_PUEBLA", cbIdEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};

const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });

async function sb(path: string, init?: RequestInit) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
/* Comparación en tiempo constante: un === filtra información por lo que tarda. */
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function firmaValida(cuerpo: string, cabecera: string | null) {
  if (!WHS || !cabecera) return false;
  const p: Record<string, string> = {};
  for (const x of cabecera.split(",")) { const i = x.indexOf("="); if (i > 0) p[x.slice(0, i).trim()] = x.slice(i + 1).trim(); }
  const t = p["t"], v1 = p["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;   // nada viejo: corta el replay
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(WHS), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${cuerpo}`));
  return iguales(hex(f), v1);
}

/* Asentar el cobro en la cuenta del huésped. Si Cloudbeds lo rechaza, el pago
   NO deja de estar pagado: se apunta el error y alguien lo mete a mano. Perder
   la constancia del cobro sería mucho peor que un asiento manual. */
async function asentarEnCloudbeds(propKey: string, rid: string, monto: number, ref: string) {
  const cfg = PROP[propKey] ?? PROP.cdmx;
  const key = Deno.env.get(cfg.cbKey);
  const pid = cfg.cbId ?? Deno.env.get(cfg.cbIdEnv ?? "");
  if (!key || !pid) return { ok: false, error: `sin credenciales de ${propKey}` };
  const f = new URLSearchParams({
    propertyID: String(pid),
    reservationID: rid,
    amount: monto.toFixed(2),
    type: "credit_card",
    description: `Pago con tarjeta por la App Huésped · Stripe ${ref}`,
  });
  const r = await fetch(`${CB}/postPayment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: f.toString(),
  });
  const j = await r.json().catch(() => ({ success: false, message: "respuesta no JSON" }));
  if (j?.success) return { ok: true, id: String(j?.data?.paymentID ?? j?.paymentID ?? "") };
  return { ok: false, error: String(j?.message ?? r.status).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ ok: false, error: "POST only" });
  const cuerpo = await req.text();

  if (!await firmaValida(cuerpo, req.headers.get("stripe-signature"))) {
    console.error("apepe-pago-webhook: firma no válida");
    return new Response(JSON.stringify({ ok: false, error: "firma" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let ev: any = {}; try { ev = JSON.parse(cuerpo); } catch { return ok(); }
  const tipo = String(ev?.type ?? "");
  const obj = ev?.data?.object ?? {};

  /* Lo que no es nuestro se contesta 200 y a otra cosa: un 500 pone a Stripe a
     reintentar en bucle. */
  const sesId = String(obj?.id ?? "");
  const meta = obj?.metadata ?? {};

  if (tipo === "checkout.session.completed" || tipo === "checkout.session.async_payment_succeeded") {
    if (String(obj?.payment_status ?? "") !== "paid") return ok({ ok: true, nota: "aún no pagado" });
    if (String(meta?.tipo ?? "") !== "hotel_saldo") return ok({ ok: true, nota: "no es un saldo de hotel" });

    const fila = await (await sb(`apepe_pagos?select=id,estado,cb_registrado,reservation_id,property&stripe_session_id=eq.${encodeURIComponent(sesId)}&limit=1`)).json().catch(() => []);
    const p = Array.isArray(fila) && fila[0] ? fila[0] : null;
    if (p?.cb_registrado) return ok({ ok: true, ya: true });

    const rid = String(p?.reservation_id ?? meta?.reservation_id ?? obj?.client_reference_id ?? "");
    const propKey = String(p?.property ?? meta?.property ?? "cdmx").toLowerCase();
    const cobrado = Number(obj?.amount_total ?? 0) / 100;
    const pi = String(obj?.payment_intent ?? "");
    if (!rid || !(cobrado > 0)) return ok({ ok: true, nota: "sin reserva o sin importe" });

    const cb = await asentarEnCloudbeds(propKey, rid, cobrado, pi || sesId);

    const parche: Record<string, unknown> = {
      estado: "pagado", pagado_at: new Date().toISOString(), actualizado_at: new Date().toISOString(),
      stripe_payment_intent: pi, monto: cobrado,
      cb_registrado: cb.ok, cb_payment_id: cb.ok ? cb.id : null, cb_error: cb.ok ? null : cb.error,
    };
    if (p?.id) {
      await sb(`apepe_pagos?id=eq.${p.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(parche) });
    } else {
      /* Pagó por una sesión que no habíamos apuntado. El cobro es real: se
         guarda igual, que para eso es el rastro. */
      await sb("apepe_pagos", { method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ reservation_id: rid, property: propKey, token: meta?.token ?? null, moneda: String(obj?.currency ?? "mxn").toUpperCase(), stripe_session_id: sesId, ...parche }) });
    }
    if (!cb.ok) console.error(`apepe-pago-webhook: pagado pero sin asentar en Cloudbeds (${rid}): ${cb.error}`);
    return ok({ ok: true, cobrado, cloudbeds: cb });
  }

  if (tipo === "checkout.session.expired" || tipo === "checkout.session.async_payment_failed") {
    if (sesId) {
      await sb(`apepe_pagos?stripe_session_id=eq.${encodeURIComponent(sesId)}&estado=eq.pendiente`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: tipo.endsWith("expired") ? "caducado" : "fallido", actualizado_at: new Date().toISOString() }),
      }).catch(() => {});
    }
    return ok();
  }

  if (tipo === "charge.refunded") {
    const pi = String(obj?.payment_intent ?? "");
    if (pi) {
      await sb(`apepe_pagos?stripe_payment_intent=eq.${encodeURIComponent(pi)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: "reembolsado", actualizado_at: new Date().toISOString() }),
      }).catch(() => {});
    }
    /* El reembolso en Cloudbeds lo mete una persona: aquí no se mueve dinero. */
    return ok();
  }

  return ok();
});
