// El cobro de un tour, con la tarjeta dentro de nuestra pantalla.
//
// Antes esto mandaba al huésped al Checkout de Stripe y volvía. Ahora la
// tarjeta se teclea en /sinc/pago.html y lo único que viaja es el permiso para
// cobrar ese importe: un PaymentIntent. Stripe.js recoge los datos de la
// tarjeta directamente; por aquí no pasa ningún número.
//
// COBRO DIRECTO (Connect Standard), igual que antes: si el touroperador tiene
// su Stripe vinculado, el intent nace EN SU CUENTA y nosotros retenemos la
// comisión como application_fee. Quien confirma el cobro sigue siendo el
// webhook, nunca esta función ni la pantalla.
//
// Quién puede cobrar una reserva: solo la cuenta que la hizo. Se comprueba con
// el JWT del navegador, no con lo que diga el cuerpo de la petición.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SK     = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
// La publicable es pública a propósito: va en el navegador. Si no está puesta,
// la pantalla lo sabe y cae al Checkout de siempre en vez de romperse.
const PK     = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";
const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    headers: {
      apikey: SRK, Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json", ...(init.headers ?? {}),
    },
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}

/* Quién llama. El id sale del token, así que nadie puede decir que es otro. */
async function quienEs(req: Request): Promise<string | null> {
  const jwt = req.headers.get("Authorization") ?? "";
  if (!jwt.startsWith("Bearer ")) return null;
  const r = await fetch(`${URL_SB}/auth/v1/user`, {
    headers: { apikey: SRK, Authorization: jwt },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ?? null;
}

/* De quién es el tour y si ya tiene su Stripe enganchado. Misma cuenta y misma
   comisión que usaba el Checkout: esto no cambia el reparto, solo la pantalla. */
async function destinoDe(opExpId: string) {
  let cuenta: string | null = null, comision = 0;
  if (!opExpId) return { cuenta, comision };
  const e = await sb(`op_experiencias?select=operador_id,comision_pct&id=eq.${opExpId}&limit=1`);
  const exp = e.body?.[0];
  if (exp?.operador_id) {
    const o = await sb(
      `tour_operadores?select=stripe_account_id,stripe_charges_enabled,comision_pct&id=eq.${exp.operador_id}&limit=1`,
    );
    const op = o.body?.[0];
    if (op?.stripe_account_id && op.stripe_charges_enabled !== false) cuenta = op.stripe_account_id;
    comision = Number(exp.comision_pct ?? op?.comision_pct ?? 0);
  }
  return { cuenta, comision };
}

async function stripe(path: string, cuerpo: URLSearchParams | null, cuenta: string | null, idem?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${SK}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (cuenta) h["Stripe-Account"] = cuenta;
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: cuerpo ? "POST" : "GET",
    headers: h,
    body: cuerpo ?? undefined,
  });
  return { ok: r.ok, j: await r.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Cuerpo ilegible" }, 400); }
  const accion = String(b?.accion ?? "").trim();

  /* ---------- con qué cuenta se va a cobrar ----------
     Lo pide la pantalla al abrirse, antes de enseñar el formulario: con cobro
     directo, Stripe.js tiene que arrancar apuntando a la cuenta del operador. */
  if (accion === "contexto") {
    const op = String(b?.op_experiencia_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(op)) return json({ error: "Falta la experiencia" }, 400);
    const { cuenta } = await destinoDe(op);
    return json({ pk: PK || null, cuenta, hay_cobro: !!SK });
  }

  /* ---------- el permiso para cobrar ---------- */
  if (accion === "cobrar") {
    if (!SK) return json({ error: "El cobro con tarjeta todavía no está configurado." }, 503);

    const uid = await quienEs(req);
    if (!uid) return json({ error: "Entra con tu cuenta antes de pagar" }, 401);

    const id = String(b?.reserva_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Falta la reserva" }, 400);

    const r = await sb(
      `sinc_reservas?select=id,folio,estado,pago_estado,pago_total,pago_moneda,email,pax,` +
      `comision_pct,op_experiencia_id,cliente_id,stripe_payment_intent&id=eq.${id}&limit=1`,
    );
    const res = r.body?.[0];
    if (!res) return json({ error: "No encontramos esa reserva" }, 404);

    /* Que sea suya. Sin esto, cualquiera con un id de reserva podría abrir el
       cobro de una reserva ajena. */
    const c = await sb(`sinc_clientes?select=id&auth_user_id=eq.${uid}&limit=1`);
    const cli = c.body?.[0];
    if (!cli || !res.cliente_id || res.cliente_id !== cli.id) {
      return json({ error: "Esa reserva no es de esta cuenta" }, 403);
    }

    if (res.estado === "cancelada") return json({ error: "Esa reserva está cancelada" }, 409);
    if (res.pago_estado === "pagado") return json({ error: "Esa reserva ya está pagada", folio: res.folio }, 409);

    const total = Number(res.pago_total ?? 0);
    if (!(total > 0)) return json({ error: "Esa reserva no tiene importe que cobrar" }, 409);
    const moneda = String(res.pago_moneda ?? "MXN").toLowerCase();
    const centavos = Math.round(total * 100);

    const { cuenta, comision } = await destinoDe(String(res.op_experiencia_id ?? ""));
    const pct = Number(res.comision_pct ?? 0) || comision;
    /* La comisión se calcula aquí, nunca en el navegador. Si sale absurda no se
       cobra de más: mejor quedarnos cortos que pasarnos. */
    const fee = cuenta && pct > 0 && pct < 100
      ? Math.min(Math.round(centavos * pct / 100), centavos)
      : 0;

    /* Si ya había un intent vivo por el mismo importe, se reusa: el huésped
       que vuelve con otra tarjeta no deja un rastro de intents abiertos. */
    if (res.stripe_payment_intent) {
      const v = await stripe(`payment_intents/${res.stripe_payment_intent}`, null, cuenta);
      const pi = v.j;
      if (v.ok && pi?.client_secret && pi.amount === centavos &&
          ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)) {
        return json({ client_secret: pi.client_secret, pk: PK || null, cuenta, folio: res.folio });
      }
    }

    const f = new URLSearchParams();
    f.set("amount", String(centavos));
    f.set("currency", moneda);
    f.set("automatic_payment_methods[enabled]", "true");
    f.set("metadata[reserva_id]", res.id);
    f.set("metadata[folio]", String(res.folio ?? ""));
    if (res.email) f.set("receipt_email", String(res.email));
    f.set("description", `Reserva ${res.folio} · ${res.pax} ${res.pax === 1 ? "persona" : "personas"}`);
    if (fee > 0) f.set("application_fee_amount", String(fee));

    const s = await stripe("payment_intents", f, cuenta, `sinc-pi-${res.id}-${centavos}`);
    if (!s.ok || !s.j?.client_secret) {
      console.error("stripe", s.j?.error?.message);
      return json({ error: "No pudimos abrir el pago. Inténtalo otra vez en un momento." }, 502);
    }

    await sb(`sinc_reservas?id=eq.${res.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        stripe_payment_intent: s.j.id,
        pago_estado: "pendiente",
        stripe_destino: cuenta,
        stripe_comision_mxn: fee ? fee / 100 : null,
        stripe_neto_oper_mxn: fee ? (centavos - fee) / 100 : null,
      }),
    });

    return json({ client_secret: s.j.client_secret, pk: PK || null, cuenta, folio: res.folio });
  }

  return json({ error: "acción desconocida" }, 400);
});
