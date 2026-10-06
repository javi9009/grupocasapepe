// productora-borrar — sacar del embudo a una candidata que no va a ningún lado.
//
// Javi, 6-oct-2026: «permítenos eliminar en el funnel a los candidatos de
// productores porque tenemos varias pruebas». Las pruebas estorban: se mezclan
// con las de verdad y nadie sabe cuál mirar.
//
// Borrar una productora arrastra en cascada sus eventos, sus papeles, su gente y
// su carta de room service. Así que aquí se borra SOLO lo que no deja huérfano a
// nadie. Si tiene una reserva vendida, un pedido, una sala a su cargo, el
// convenio firmado o está enganchada a una operadora de Sincrético, no se borra:
// se devuelve escrito por qué, y para eso está la baja en su ficha, que es otra
// cosa —deja de operar, pero su historia se queda.
//
// Una sola puerta: el equipo de casa con su sesión.
import { quienLlama, noAutorizado } from "./equipo.ts";

const SB  = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function rest(p: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + p, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(p + " " + r.status + " " + t.slice(0, 160));
  return t ? JSON.parse(t) : null;
}
/** Cuántas filas hay, sin traérselas: PostgREST lo dice en la cabecera. */
async function cuantas(tabla: string, filtro: string) {
  const r = await fetch(`${SB}/rest/v1/${tabla}?select=id&${filtro}`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  const cr = r.headers.get("content-range") || "";
  const n = Number(cr.split("/")[1]);
  return isFinite(n) ? n : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);

  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado("Esto lo hace el equipo de casa.");

  try {
    const b: any = await req.json().catch(() => ({}));
    const id = String(b.productora_id || "").trim();
    if (!id) return J({ ok: false, error: "falta la productora" }, 400);
    const f = `id=eq.${encodeURIComponent(id)}`;

    const rows = await rest(`productoras?${f}&select=id,nombre_comercial,estado,contrato_firmado_at,tour_operador_id&limit=1`);
    const p = Array.isArray(rows) && rows[0];
    if (!p) return J({ ok: false, error: "Esa productora ya no está." }, 404);

    const pf = `productora_id=eq.${encodeURIComponent(id)}`;
    const [n_ev, n_res, n_ped, n_opera, n_apoyo, n_con] = await Promise.all([
      cuantas("eventos", pf),
      cuantas("evento_reservas", pf),
      cuantas("rs_pedidos", pf),
      cuantas("ev_espacios", `opera_prod=eq.${encodeURIComponent(id)}`),
      cuantas("ev_espacios", `apoyo_tecnico_prod=eq.${encodeURIComponent(id)}`),
      cuantas("prod_contratos", `${pf}&estado=eq.firmado`),
    ]);

    const porque: string[] = [];
    if (n_res > 0) porque.push(`tiene ${n_res} reserva(s) vendida(s)`);
    if (n_ped > 0) porque.push(`tiene ${n_ped} pedido(s) de room service`);
    if (n_opera + n_apoyo > 0) porque.push(`lleva ${n_opera + n_apoyo} sala(s) del Ateneo`);
    if (n_con > 0 || p.contrato_firmado_at) porque.push("ya firmó el convenio");
    if (p.tour_operador_id) porque.push("está enganchada a una operadora de Sincrético");

    if (porque.length) {
      return J({
        ok: false, nombre: p.nombre_comercial,
        error: `No se puede borrar: ${porque.join(", y ")}. Dale de baja en su ficha si ya no opera.`,
      }, 409);
    }

    /* Hasta aquí todo era mirar. A partir de aquí ya no se puede deshacer, y por
       eso la pantalla pregunta antes escribiendo el nombre. */
    await rest(`productoras?${f}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

    return J({
      ok: true, nombre: p.nombre_comercial, eventos_borrados: n_ev,
      mensaje: `Borrada${n_ev > 0 ? `, con sus ${n_ev} evento(s) en borrador` : ""}.`,
    });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: String(e) }, 500);
  }
});
