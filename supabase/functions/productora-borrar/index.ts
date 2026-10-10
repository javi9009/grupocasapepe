// productora-borrar — sacar del embudo a una candidata que no va a ningún lado.
//
// Javi, 6-oct-2026: «permítenos eliminar en el funnel a los candidatos de
// productores porque tenemos varias pruebas». Las pruebas estorban: se mezclan
// con las de verdad y nadie sabe cuál mirar.
//
// Borrar una productora arrastra en cascada sus eventos, sus papeles, su gente y
// su carta de room service. Lo que NO cae solo —reservas, pedidos, salas— se
// mira antes y se dice en claro. 10-oct-2026: y si de verdad es una prueba, se
// puede arrastrar también eso, con permiso expreso.
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
  if (!r.ok) throw new Error(p.split("?")[0] + ": " + t.slice(0, 160));
  try { return t ? JSON.parse(t) : null; } catch { return null; }
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

/* DINERO DE VERDAD. Una reserva pagada con una sesión de prueba (cs_test_…) no
   movió un peso. Si tiene fecha de pago y no es de prueba, sí, y entonces no se
   borra sin decirlo aparte. */
function dineroReal(r: any) {
  if (!r?.pagado_at) return false;
  return !String(r.stripe_session_id || "").startsWith("cs_test");
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
    /* Javi, 10-oct-2026: «si tiene reservas vendidas no puede borrarse; al
       borrar notifica las reservas que tiene, y al admin permítenos borrarlas,
       porque lo más probable es que sean de prueba». Así que ahora hay dos
       pasos, los mismos que en operador-borrar: `mirar` no toca nada y enseña
       los folios; `borrar` se niega y los lista; y con `arrastrar` se los lleva
       por delante. Una reserva con dinero cobrado de verdad necesita además su
       propio permiso, para que no se vaya ninguna por inercia. */
    const accion = String(b.accion || "borrar");
    const arrastrar = b.arrastrar === true;
    const arrastrarPagadas = b.arrastrar_pagadas === true;

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

    /* Las reservas, por folio: decir «tiene 3 reservas» no deja decidir nada.
       Con el folio y el estado delante se ve en un segundo si son de prueba. */
    const resv = await rest(
      `evento_reservas?${pf}&select=id,folio,estado,pago_estado,total,pagado_at,stripe_session_id` +
      `&order=created_at.desc&limit=60`,
    );
    const reservas = Array.isArray(resv) ? resv : [];
    const conDinero = reservas.filter(dineroReal);

    const porque: string[] = [];
    if (n_res > 0) porque.push(`tiene ${n_res} reserva(s) vendida(s)`);
    if (n_ped > 0) porque.push(`tiene ${n_ped} pedido(s) de room service`);
    if (n_opera + n_apoyo > 0) porque.push(`lleva ${n_opera + n_apoyo} sala(s) del Ateneo`);
    if (n_con > 0 || p.contrato_firmado_at) porque.push("ya firmó el convenio");
    if (p.tour_operador_id) porque.push("está enganchada a una operadora de Sincrético");

    const comun = {
      nombre: p.nombre_comercial,
      estado: p.estado,
      cuelga: {
        eventos: n_ev, reservas: n_res, pedidos: n_ped,
        salas: n_opera + n_apoyo, convenios_firmados: n_con,
        reservas_con_dinero: conDinero.length,
      },
      reservas: reservas.map((r: any) => ({
        folio: r.folio ?? null, estado: r.estado ?? null, pago: r.pago_estado ?? null,
        total: r.total ?? null, dinero_real: dineroReal(r),
      })),
      bloquea: porque,
      se_puede: porque.length === 0,
      se_puede_arrastrando: conDinero.length === 0 && !p.tour_operador_id,
    };

    if (accion === "mirar") return J({ ok: true, ...comun });

    /* Enganchada a una operadora de Sincrético no se arrastra: eso no es una
       prueba suelta, es una ficha que otra cosa está usando. */
    if (p.tour_operador_id) {
      return J({ ok: false, ...comun, error: "Está enganchada a una operadora de Sincrético. Desengánchala primero." }, 409);
    }
    if (porque.length && !arrastrar) {
      return J({
        ok: false, ...comun, necesita_arrastrar: true,
        error: `No se borra sola: ${porque.join(", y ")}. Si de verdad es una prueba, bórrala arrastrando todo eso.`,
      }, 409);
    }
    if (conDinero.length && !arrastrarPagadas) {
      return J({
        ok: false, ...comun, necesita_arrastrar_pagadas: true,
        error: `Hay ${conDinero.length} reserva(s) con dinero cobrado de verdad (${conDinero.map((r: any) => r.folio).filter(Boolean).slice(0, 8).join(", ")}). Eso no se va por inercia: hace falta decirlo aparte.`,
      }, 409);
    }

    /* Hasta aquí todo era mirar. A partir de aquí ya no se puede deshacer, y por
       eso la pantalla pregunta antes escribiendo el nombre.
       Las reservas y los pedidos bloquean por llave foránea (NO ACTION), así que
       van primero o el borrado de la ficha rebota. Las salas no se borran: son
       del Ateneo, no suyas — se les quita el nombre y se quedan. */
    if (arrastrar) {
      await rest(`evento_reservas?${pf}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await rest(`rs_pedidos?${pf}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      /* prod_contratos no tiene llave foránea a productoras, así que no cae en
         cascada: si no se borra aquí, quedan convenios de una ficha que ya no
         existe. Javi, 10-oct-2026. */
      try { await rest(`prod_contratos?${pf}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); }
      catch (e) { console.error("prod_contratos", String(e).slice(0, 120)); }
      for (const col of ["opera_prod", "apoyo_tecnico_prod"]) {
        await rest(`ev_espacios?${col}=eq.${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ [col]: null }),
        });
      }
    }
    await rest(`productoras?${f}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

    return J({
      ok: true, nombre: p.nombre_comercial, eventos_borrados: n_ev,
      borradas: arrastrar ? { reservas: n_res, pedidos: n_ped, salas_liberadas: n_opera + n_apoyo } : undefined,
      mensaje: `Borrada${n_ev > 0 ? `, con sus ${n_ev} evento(s)` : ""}.`,
    });
  } catch (e) {
    console.error("productora-borrar", e);
    return J({ ok: false, error: "Se rompió el borrado: " + String((e as Error)?.message ?? e).slice(0, 220) }, 500);
  }
});
