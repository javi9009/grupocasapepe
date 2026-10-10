// operador-borrar — quitar del sistema una touroperadora, casi siempre de prueba.
//
// Javi, 10-oct-2026: «¿cómo puedo dar de baja y borrar touroperadoras y
// productoras, con la intención de volver a crearlas para hacer más pruebas?».
// Para productoras ya estaba (productora-borrar, desde el embudo). Para
// touroperadoras no había NADA, y por eso seguían ahí «ZZ Prueba Candado» y
// compañía.
//
// POR QUÉ ESTO NO ES UNA COMODIDAD, ES LA ÚNICA PROTECCIÓN QUE HAY.
// Mirando las llaves foráneas contra producción: un DELETE a pelo sobre
// tour_operadores NO FALLA. Solo dos tablas menores lo bloquean
// (sinc_repartos y cosmica_pruebas). Todo lo demás, o cae en cascada, o —peor—
// se pone en NULO: `experiencias.operador_id` es SET NULL, así que la
// experiencia PÚBLICA se queda viva, publicada y vendiéndose, sin dueño, y sus
// reservas apuntando a un operador que ya no existe. Nadie se entera hasta que
// alguien reserva. Así que aquí se borra a mano, en orden, de las hojas al
// tronco.
//
// Dos pasos, como pidió Javi:
//   mirar  → dice TODO lo que cuelga, con las reservas por folio. No toca nada.
//   borrar → se niega y lo lista si hay algo colgando;
//            con `arrastrar` se lleva también lo listado, que es el caso de las
//            pruebas; y una reserva con DINERO DE VERDAD cobrado necesita además
//            `arrastrar_pagadas`, para que no se vaya ninguna por inercia.
//
// Una sola puerta: el equipo de casa con su sesión.
import { quienLlama, noAutorizado } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
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
  if (!r.ok) throw new Error(p.split("?")[0] + ": " + t.slice(0, 180));
  let j: unknown = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return j;
}
async function filas(p: string): Promise<any[]> {
  const j = await rest(p);
  return Array.isArray(j) ? j : [];
}
/** Cuántas hay, sin traérselas. */
async function cuantas(tabla: string, filtro: string) {
  const r = await fetch(`${SB}/rest/v1/${tabla}?select=id&${filtro}`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  const n = Number((r.headers.get("content-range") || "").split("/")[1]);
  return isFinite(n) ? n : 0;
}
/** Listas largas de ids: PostgREST va en la URL, así que se parte en trozos. */
async function porTrozos(ids: string[], fn: (trozo: string[]) => Promise<unknown>) {
  for (let i = 0; i < ids.length; i += 80) await fn(ids.slice(i, i + 80));
}
const enLista = (ids: string[]) => `in.(${ids.map((x) => `"${x}"`).join(",")})`;

/* DINERO DE VERDAD.
   Una reserva pagada con una sesión de prueba (cs_test_…) no movió un peso: hoy
   la llave de Sincrético está en modo prueba, así que TODO lo cobrado hasta
   ahora es de mentira. Pero esto va a sobrevivir al cambio de llave, así que la
   regla se escribe para entonces: si tiene fecha de pago y no es una sesión de
   prueba, se considera dinero real y necesita su propio permiso. */
function dineroReal(r: any) {
  if (!r?.pagado_at) return false;
  const s = String(r.stripe_session_id || "");
  if (s.startsWith("cs_test")) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);

  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado("Esto lo hace el equipo de casa.");

  try {
    const b: any = await req.json().catch(() => ({}));
    const id = String(b.operador_id || "").trim();
    const accion = String(b.accion || "mirar");
    const arrastrar = b.arrastrar === true;
    const arrastrarPagadas = b.arrastrar_pagadas === true;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return J({ ok: false, error: "falta el touroperador" }, 400);
    const f = `operador_id=eq.${id}`;

    const op = (await filas(
      `tour_operadores?id=eq.${id}&select=id,nombre_comercial,estado,contrato_firmado_at,stripe_account_id&limit=1`,
    ))[0];
    if (!op) return J({ ok: false, error: "Ese touroperador ya no está." }, 404);

    /* ---------- QUÉ CUELGA ----------
       Sus experiencias llegan por dos caminos: la ficha de producto
       (op_experiencias.operador_id) y la experiencia pública
       (experiencias.operador_id). No siempre coinciden, así que se juntan. */
    const opExps = await filas(`op_experiencias?${f}&select=id,experiencia_id,estado`);
    const expsPropias = await filas(`experiencias?${f}&select=id,nombre,estado`);
    const expIds = [
      ...new Set([
        ...expsPropias.map((x) => String(x.id)),
        ...opExps.map((x) => x.experiencia_id).filter(Boolean).map(String),
      ]),
    ];

    let salidas: any[] = [];
    let reservas: any[] = [];
    if (expIds.length) {
      await porTrozos(expIds, async (t) => {
        salidas.push(...await filas(`sinc_salidas?experiencia_id=${enLista(t)}&select=id,fecha,estado`));
        reservas.push(...await filas(
          `sinc_reservas?experiencia_id=${enLista(t)}` +
          `&select=id,folio,estado,pago_estado,total,pagado_at,stripe_session_id,created_at`,
        ));
      });
    }
    /* Las que cuelgan de la ficha de producto y no de la experiencia pública. */
    if (opExps.length) {
      const vistos = new Set(reservas.map((r) => String(r.id)));
      await porTrozos(opExps.map((x) => String(x.id)), async (t) => {
        for (const r of await filas(
          `sinc_reservas?op_experiencia_id=${enLista(t)}` +
          `&select=id,folio,estado,pago_estado,total,pagado_at,stripe_session_id,created_at`,
        )) if (!vistos.has(String(r.id))) { vistos.add(String(r.id)); reservas.push(r); }
      });
    }

    const [nUsuarios, nDocs, nContratos, nRepartos, nPruebas, nFacturas, nGuias, nLugares] = await Promise.all([
      cuantas("tour_operador_usuarios", f),
      cuantas("tour_operador_docs", f),
      cuantas("op_contratos", `${f}&estado=eq.firmado`),
      cuantas("sinc_repartos", f),
      cuantas("cosmica_pruebas", f),
      cuantas("sinc_factura_solicitudes", `touroperador_id=eq.${id}`),
      cuantas("guia_protagonistas", f),
      cuantas("sinc_lugares", f),
    ]);

    const publicadas = expsPropias.filter((e) => String(e.estado || "") === "publicada").length;
    const conDinero = reservas.filter(dineroReal);

    const cuelga = {
      fichas_de_producto: opExps.length,
      experiencias: expsPropias.length,
      publicadas,
      salidas: salidas.length,
      reservas: reservas.length,
      reservas_con_dinero: conDinero.length,
      usuarios: nUsuarios,
      papeles: nDocs,
      contratos_firmados: nContratos,
      repartos: nRepartos,
      pruebas_de_la_cosmica: nPruebas,
      peticiones_de_factura: nFacturas,
      guias: nGuias,
      lugares: nLugares,
    };

    /* Lo que impide borrar sin permiso. Ni más ni menos: lo que se perdería. */
    const bloquea: string[] = [];
    if (reservas.length) bloquea.push(`${reservas.length} reserva(s)`);
    if (publicadas) bloquea.push(`${publicadas} experiencia(s) publicada(s)`);
    if (salidas.length) bloquea.push(`${salidas.length} salida(s) programada(s)`);
    if (nContratos || op.contrato_firmado_at) bloquea.push("el contrato firmado");
    if (nRepartos) bloquea.push(`${nRepartos} reparto(s) de dinero`);

    const lista = reservas
      .sort((a, c) => String(c.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 60)
      .map((r) => ({
        folio: r.folio ?? null,
        estado: r.estado ?? null,
        pago: r.pago_estado ?? null,
        total: r.total ?? null,
        dinero_real: dineroReal(r),
      }));

    const comun = {
      nombre: op.nombre_comercial,
      estado: op.estado,
      cuelga,
      reservas: lista,
      bloquea,
      se_puede: bloquea.length === 0,
      se_puede_arrastrando: conDinero.length === 0,
    };

    if (accion === "mirar") return J({ ok: true, ...comun });
    if (accion !== "borrar") return J({ ok: false, error: "no sé hacer eso" }, 400);

    /* ---------- LOS DOS CANDADOS ---------- */
    if (bloquea.length && !arrastrar) {
      return J({
        ok: false, ...comun,
        necesita_arrastrar: true,
        error: `No se borra solo: ${bloquea.join(", ")}. Si de verdad es una prueba, bórralo arrastrando todo eso.`,
      }, 409);
    }
    if (conDinero.length && !arrastrarPagadas) {
      return J({
        ok: false, ...comun,
        necesita_arrastrar_pagadas: true,
        error: `Hay ${conDinero.length} reserva(s) con dinero cobrado de verdad (${conDinero.map((r) => r.folio).filter(Boolean).slice(0, 8).join(", ")}). Eso no se va por inercia: hace falta decirlo aparte.`,
      }, 409);
    }

    /* ---------- BORRAR, DE LAS HOJAS AL TRONCO ----------
       El orden no es decorativo: sinc_reservas protege a experiencias con
       RESTRICT, y experiencias se queda huérfana si se deja que el SET NULL
       haga su trabajo. Por eso se borra a mano y en este orden. */
    const borradas: Record<string, number> = {};

    if (reservas.length) {
      await porTrozos(reservas.map((r) => String(r.id)), (t) =>
        rest(`sinc_reservas?id=${enLista(t)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }));
      borradas.reservas = reservas.length;
    }
    if (salidas.length) {
      await porTrozos(salidas.map((s) => String(s.id)), (t) =>
        rest(`sinc_salidas?id=${enLista(t)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }));
      borradas.salidas = salidas.length;
    }
    /* La ficha de producto antes que la experiencia pública: op_experiencias
       apunta a experiencias con NO ACTION y la bloquearía. */
    if (opExps.length) {
      await rest(`op_experiencias?${f}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      borradas.fichas_de_producto = opExps.length;
    }
    if (expIds.length) {
      await porTrozos(expIds, (t) =>
        rest(`experiencias?id=${enLista(t)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }));
      borradas.experiencias = expIds.length;
    }
    /* Las dos que bloquean por llave foránea, y el catálogo suyo que si no se
       queda como basura sin dueño. */
    for (const [tabla, filtro] of [
      ["sinc_repartos", f], ["cosmica_pruebas", f],
      ["guia_protagonistas", f], ["sinc_lugares", f], ["sinc_gastros", f], ["sinc_tangibles", f],
      ["tour_operador_altas", f],
    ] as Array<[string, string]>) {
      try { await rest(`${tabla}?${filtro}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); }
      catch (e) { console.error("limpiando " + tabla, String(e).slice(0, 120)); }
    }

    /* Y el tronco. La cascada se lleva usuarios, papeles, contratos, ODS,
       media, certificados, reclamos, secretos y su paso por el embudo. */
    await rest(`tour_operadores?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

    return J({
      ok: true,
      nombre: op.nombre_comercial,
      borradas,
      aviso: op.stripe_account_id
        ? "Ojo: tenía una cuenta de Stripe vinculada. La ficha se fue, pero la cuenta sigue siendo suya en Stripe."
        : undefined,
      mensaje: `«${op.nombre_comercial}» borrado.`,
    });
  } catch (e) {
    console.error("operador-borrar", e);
    return J({ ok: false, error: "Se rompió el borrado: " + String((e as Error)?.message ?? e).slice(0, 220) }, 500);
  }
});
