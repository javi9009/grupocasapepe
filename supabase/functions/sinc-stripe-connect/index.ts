// Engancha la cuenta de Stripe que el touroperador YA TIENE, por OAuth.
//
// Por que OAuth y no crear la cuenta por API: crear una Standard por API abre
// una cuenta NUEVA. Marianela ya tiene la de Flylike, y casi todos los
// operadores tienen la suya. OAuth es el camino hecho para esto: el operador
// entra con su cuenta de Stripe y nos autoriza.
//
// Dos pasos. "iniciar" devuelve la liga a la que se le manda; "terminar" cambia
// el codigo que Stripe devuelve por el id de su cuenta y lo guarda.
//
// Las llaves viven en los secretos del proyecto. Nunca viajan al navegador.
//
// Contención 27-sep-2026: la sesión se VERIFICA contra Supabase Auth. Antes se
// leía el correo del JWT sin comprobar la firma: con un JWT inventado cualquiera
// vinculaba su Stripe a un operador ajeno y se quedaba con sus ventas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { quienLlama } from "./equipo.ts";

const SK  = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const CID = Deno.env.get("STRIPE_CONNECT_CLIENT_ID") ?? "";
const SB  = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BASE = Deno.env.get("SINCRETICO_BASE_URL") ?? "https://grupocasapepe.netlify.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

const UUID = /^[0-9a-f-]{36}$/i;
const VALE = 30 * 60 * 1000;   // el papelito caduca a la media hora

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);
  if (!SK)  return json({ error: "Stripe todavia no esta configurado." }, 503);
  if (!CID) return json({ error: "falta_client_id", detalle: "Falta registrar la aplicacion de Connect (STRIPE_CONNECT_CLIENT_ID)." }, 503);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json invalido" }, 400); }

  const quien = await quienLlama(req);
  const email = quien.email && quien.email !== "servidor" ? quien.email : null;
  if (!email) return json({ error: "sin sesion" }, 401);

  const accion = String(b.accion ?? "iniciar");
  const opId = String(b.operador_id ?? "");
  if (!UUID.test(opId)) return json({ error: "falta el touroperador" }, 400);

  /* Que quien pide sea de ese touroperador, o del equipo de casa. */
  const uq = await rest(`tour_operador_usuarios?select=operador_id&activo=is.true&email=eq.${encodeURIComponent(email)}&limit=1`);
  const miOp = uq.ok ? (await uq.json())[0]?.operador_id ?? null : null;
  if (!miOp && !quien.equipo) return json({ error: "eso no es tuyo" }, 403);
  const oq = await rest(`tour_operadores?select=id,nombre_comercial,email,stripe_account_id,stripe_oauth_state,stripe_oauth_state_at&id=eq.${opId}&limit=1`);
  const op = oq.ok ? (await oq.json())[0] : null;
  if (!op) return json({ error: "no existe ese touroperador" }, 404);
  if (miOp && miOp !== opId && !quien.equipo) return json({ error: "eso no es tuyo" }, 403);

  const vuelta = `${BASE}/operador.html`;

  if (accion === "iniciar") {
    if (op.stripe_account_id) return json({ ok: true, ya: true, cuenta: op.stripe_account_id });

    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const pa = await rest(`tour_operadores?id=eq.${opId}`, {
      method: "PATCH",
      body: JSON.stringify({ stripe_oauth_state: state, stripe_oauth_state_at: new Date().toISOString(), stripe_estado: "liga_enviada" }),
    });
    if (!pa.ok) return json({ error: "no se pudo preparar la vinculacion" }, 500);

    const q = new URLSearchParams();
    q.set("response_type", "code");
    q.set("client_id", CID);
    q.set("scope", "read_write");
    q.set("redirect_uri", vuelta);
    q.set("state", state);
    if (op.email) q.set("stripe_user[email]", String(op.email));
    if (op.nombre_comercial) q.set("stripe_user[business_name]", String(op.nombre_comercial));
    q.set("stripe_user[country]", "MX");

    return json({ ok: true, url: `https://connect.stripe.com/oauth/authorize?${q.toString()}` });
  }

  if (accion === "terminar") {
    const code = String(b.code ?? "");
    const state = String(b.state ?? "");
    if (!code || !state) return json({ error: "falta el codigo" }, 400);
    if (!op.stripe_oauth_state || op.stripe_oauth_state !== state) return json({ error: "esa vinculacion no cuadra" }, 409);
    const cuando = op.stripe_oauth_state_at ? Date.parse(op.stripe_oauth_state_at) : 0;
    if (!cuando || Date.now() - cuando > VALE) return json({ error: "la vinculacion caduco, vuelve a empezar" }, 409);

    const f = new URLSearchParams({ grant_type: "authorization_code", code });
    const r = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: f,
    });
    const t = await r.json();
    if (!r.ok || !t.stripe_user_id) {
      console.error("stripe oauth", t?.error_description ?? t?.error);
      return json({ error: "Stripe no acepto la vinculacion", detalle: String(t?.error_description ?? "").slice(0, 160) }, 502);
    }

    const a = await fetch(`https://api.stripe.com/v1/accounts/${t.stripe_user_id}`, { headers: { Authorization: `Bearer ${SK}` } });
    const cuenta = a.ok ? await a.json() : null;

    await rest(`tour_operadores?id=eq.${opId}`, {
      method: "PATCH",
      body: JSON.stringify({
        stripe_account_id: t.stripe_user_id,
        stripe_charges_enabled: cuenta ? !!cuenta.charges_enabled : null,
        stripe_payouts_enabled: cuenta ? !!cuenta.payouts_enabled : null,
        stripe_estado: cuenta && cuenta.charges_enabled ? "vinculado" : "restringido",
        stripe_vinculado_at: new Date().toISOString(),
        stripe_oauth_state: null,
        stripe_oauth_state_at: null,
      }),
    });

    return json({
      ok: true,
      cuenta: t.stripe_user_id,
      cobra: cuenta ? !!cuenta.charges_enabled : null,
      le_pagan: cuenta ? !!cuenta.payouts_enabled : null,
    });
  }

  return json({ error: "accion desconocida" }, 400);
});
