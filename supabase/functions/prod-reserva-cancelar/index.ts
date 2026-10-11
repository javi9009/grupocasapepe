// CANCELAR UNA RESERVA DE EVENTO, Y DEVOLVERLE AL CLIENTE TODO SU DINERO.
//
// Javi, 11-oct-2026: «posibilidad de cancelar la reserva y que se haga la
// devolución completa al cliente».
//
// Dos puertas, como en el resto del portal: la PRODUCTORA con el token de su
// liga —y entonces sólo puede tocar reservas de SUS eventos—, y el EQUIPO de
// casa con su sesión, que puede con cualquiera.
//
// EL DINERO. El boleto se cobró con cargo directo en la cuenta Connect del
// productor, con nuestra comisión como application_fee (ver evento-checkout).
// El reembolso va contra esa misma cuenta, por el importe entero, y con
// refund_application_fee=true: si el evento no se hace, nadie cobra por él.
// Devolver al cliente el 100% y quedarnos la comisión dejaría a la productora
// pagando de su bolsillo nuestra parte de una venta que se deshizo.
//
// NO SE BORRA NADA. La reserva se queda, en 'cancelada', con quién la canceló,
// cuándo y por qué. Un boleto que desaparece es un cliente que llega a la puerta
// con un QR y nadie sabe qué pasó.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB   = Deno.env.get("SUPABASE_URL")!;
const SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
/* La misma llave con la que se cobró: si se cobró en prueba, se devuelve en
   prueba. Un reembolso con la llave equivocada no encuentra el cargo. */
const SK = Deno.env.get("STRIPE_SECRET_KEY_ATENEO_TEST")
        ?? Deno.env.get("STRIPE_SECRET_KEY_ATENEO") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM   = Deno.env.get("ATENEO_FROM") || "Ateneo de Virreyes <ateneo@casapepe.mx>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`,
               "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}

async function esEquipo(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === ANON || jwt.startsWith("sb_publishable_")) return false;
  if (jwt === SRK) return true;
  return await fetch(`${SB}/rest/v1/rpc/es_equipo_casa`, {
    method: "POST",
    headers: { apikey: ANON || SRK, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((x) => x.ok ? x.json() : false).catch(() => false) === true;
}

async function stripe(path: string, cuerpo: URLSearchParams, cuenta: string | null, idem?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded",
  };
  if (cuenta) h["Stripe-Account"] = cuenta;
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers: h, body: cuerpo });
  return { ok: r.ok, j: await r.json() };
}

function money(n: unknown) {
  return "$" + Number(n ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

async function avisaCliente(r: any, devuelto: number, motivo: string) {
  if (!RESEND || !r?.email) return;
  const dinero = devuelto > 0
    ? `<p style="font-size:15px;line-height:1.6;color:#3C3630;margin:0 0 13px">Te devolvemos <b>${money(devuelto)}</b>, el importe completo. Lo verás en el mismo medio con el que pagaste; según tu banco puede tardar de tres a diez días hábiles.</p>`
    : `<p style="font-size:15px;line-height:1.6;color:#3C3630;margin:0 0 13px">No habías pagado nada, así que no hay ningún cargo que devolver.</p>`;
  const html =
`<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F6EFE4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:540px;margin:0 auto;padding:26px 18px">
  <div style="background:#1E1A16;border-radius:16px 16px 0 0;padding:16px 24px">
    <div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff">Ateneo de Virreyes</div>
  </div>
  <div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">
    <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;color:#1E1A16">Se canceló ${esc(r.evento_nombre || "tu reserva")}</h1>
    <p style="font-size:15px;line-height:1.6;color:#3C3630;margin:0 0 13px">Hola${r.nombre ? " " + esc(String(r.nombre).split(" ")[0]) : ""}: lamentamos decírtelo, pero esta reserva no se va a poder hacer.</p>
    ${motivo ? `<p style="font-size:15px;line-height:1.6;color:#3C3630;margin:0 0 13px">Motivo: ${esc(motivo)}</p>` : ""}
    ${dinero}
    <div style="background:#F6EFE4;border-radius:10px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#3C3630">
      Folio <b>${esc(r.folio || "")}</b>${r.pax ? ` · ${esc(r.pax)} ${Number(r.pax) === 1 ? "boleto" : "boletos"}` : ""}.
      Tu pase deja de servir: no hace falta que hagas nada con él.
    </div>
    <p style="font-size:13.5px;line-height:1.6;color:#6E665C;margin:16px 0 0">Si algo no cuadra, responde a este correo: contesta una persona.</p>
  </div>
</div></body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [r.email], reply_to: "ateneo@casapepe.mx",
        subject: `Cancelada tu reserva ${r.folio ?? ""}`.trim(), html }),
    });
  } catch (e) { console.error("correo", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: any; try { b = await req.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }
  const token  = String(b?.token ?? "").trim();
  const id     = String(b?.reserva_id ?? "").trim();
  const motivo = String(b?.motivo ?? "").trim().slice(0, 300);
  if (!id) return json({ error: "falta la reserva" }, 400);

  /* PUERTA 1: la productora con su token. PUERTA 2: el equipo con su sesión. */
  let prodId = "";
  let quien = "equipo";
  if (token) {
    const p = await rest(`productoras?select=id,nombre_comercial,stripe_account_id&portal_token=eq.${encodeURIComponent(token)}&estado=neq.baja&limit=1`);
    if (!(p.ok && p.body?.[0])) return json({ error: "liga no válida" }, 401);
    prodId = p.body[0].id;
    quien = `productora:${p.body[0].nombre_comercial ?? prodId}`;
  } else if (!(await esEquipo(req))) {
    return json({ error: "sin sesión" }, 401);
  }

  const filtro = `evento_reservas?select=*&id=eq.${encodeURIComponent(id)}` +
                 (prodId ? `&productora_id=eq.${prodId}` : "") + "&limit=1";
  const q = await rest(filtro);
  const r = q.ok ? q.body?.[0] : null;
  if (!r) return json({ error: prodId ? "esa reserva no es de tus eventos" : "no existe esa reserva" }, 404);
  if (String(r.estado ?? "") === "cancelada") {
    return json({ ok: true, ya: true, mensaje: "Esa reserva ya estaba cancelada." });
  }

  /* El nombre del evento, sólo para el correo. */
  let evNombre = "";
  if (r.evento_id) {
    const e = await rest(`eventos?select=nombre&id=eq.${r.evento_id}&limit=1`);
    evNombre = e.body?.[0]?.nombre ?? "";
  }

  /* EL DINERO, ANTES QUE EL ESTADO. Si Stripe falla, la reserva se queda viva:
     una reserva cancelada sin devolver el dinero es lo peor de los dos mundos. */
  let devuelto = 0, aviso = "";
  const pagado = String(r.pago_estado ?? "") === "pagado" && !!r.stripe_payment_intent;
  if (pagado) {
    if (!SK) return json({ error: "El reembolso automático todavía no está configurado. Avísanos y lo hacemos a mano." }, 503);
    const f = new URLSearchParams();
    f.set("payment_intent", String(r.stripe_payment_intent));
    /* Entero: no se cancela media reserva. */
    f.set("refund_application_fee", "true");
    f.set("reason", "requested_by_customer");
    f.set("metadata[reserva_id]", String(r.id));
    f.set("metadata[folio]", String(r.folio ?? ""));
    f.set("metadata[cancelado_por]", quien);
    const s = await stripe("refunds", f, r.stripe_destino || null, `evt-ref-${r.id}`);
    if (!s.ok) {
      const m = String(s.j?.error?.message ?? "");
      /* Si Stripe dice que ya está devuelto, no es un fallo: es que alguien se
         adelantó. Se sigue y se cancela la reserva. */
      if (/already been refunded|has already been refunded/i.test(m)) {
        aviso = "El cargo ya estaba devuelto en Stripe.";
      } else {
        console.error("refund", m);
        return json({ error: "No se pudo devolver el dinero: " + m.slice(0, 160) }, 502);
      }
    } else {
      devuelto = Number(s.j?.amount ?? 0) / 100;
    }
  }

  const nota = [
    r.notas || "",
    `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] Cancelada por ${quien}` +
      (motivo ? `: ${motivo}` : "") +
      (devuelto > 0 ? ` · devuelto ${money(devuelto)}` : ""),
  ].filter(Boolean).join("\n");

  const pat = await rest(`evento_reservas?id=eq.${encodeURIComponent(r.id)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      estado: "cancelada",
      pago_estado: devuelto > 0 ? "reembolsada" : r.pago_estado,
      notas: nota,
    }),
  });
  if (!pat.ok) {
    return json({ error: "Se devolvió el dinero pero no se pudo marcar la reserva. Avísanos." }, 500);
  }

  await avisaCliente({ ...r, evento_nombre: evNombre }, devuelto, motivo);

  return json({ ok: true, devuelto, aviso,
    mensaje: devuelto > 0
      ? `Cancelada. Le devolvimos ${money(devuelto)} y le avisamos por correo.`
      : "Cancelada. No había cargo que devolver; le avisamos por correo." });
});
