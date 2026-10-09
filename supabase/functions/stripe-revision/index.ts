// stripe-revision — ¿está bien la conexión con Stripe? Solo lectura.
//
// Nació de una pregunta de Javi: «conectemos el Stripe de varios productores y
// touroperadores para probar si está bien la conexión». Antes de conectar a
// nadie hay que saber una cosa que nadie estaba mirando: EN STRIPE NO HAY UNA
// SOLA PLATAFORMA NI UN SOLO MODO.
//
//   · sinc-stripe-connect y sinc-stripe-checkout usan STRIPE_SECRET_KEY.
//   · operador-stripe-alta y todo el Ateneo usan STRIPE_SECRET_KEY_ATENEO.
//   · productora-stripe-alta y evento-checkout prefieren ..._ATENEO_TEST si está.
//
// Una cuenta conectada pertenece a LA PLATAFORMA que la conectó. Si a un
// touroperador se le da de alta con la llave del Ateneo y luego Sincrético le
// cobra con la suya, el cargo no falla «por Stripe»: falla porque esa cuenta no
// existe para esa plataforma. Y una cuenta creada en modo prueba no cobra un
// peso de verdad por mucho que la ficha diga «vinculado».
//
// Esto no mueve dinero, no crea cuentas y no abre ligas. Hace tres cosas:
//   1. de cada llave dice si está puesta, en qué modo está (vivo o prueba) y
//      qué plataforma es —el acct_ de la propia cuenta—, nunca la llave;
//   2. de cada cuenta conectada que tenemos guardada dice QUÉ PLATAFORMAS la
//      ven y si de verdad puede cobrar y recibir pagos;
//   3. refresca charges/payouts/stripe_revisado_at en la ficha, que es la
//      columna que llevaba meses en blanco.
//
// Javi, 9-oct-2026.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { quienLlama, noAutorizado, CORS_EQUIPO } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS_EQUIPO, "Content-Type": "application/json" } });

/* Las llaves que usa el grupo, con quién las usa al lado: el informe sirve de
   poco si dice «ATENEO_TEST está puesta» y hay que ir a buscar a mano quién
   cobra con ella. */
const LLAVES: Array<{ env: string; usa: string }> = [
  { env: "STRIPE_SECRET_KEY", usa: "Sincrético: vinculación por OAuth y cobro de tours" },
  { env: "STRIPE_SECRET_KEY_ATENEO", usa: "Ateneo: cine, coworking, alta de touroperador y de hotel" },
  { env: "STRIPE_SECRET_KEY_ATENEO_TEST", usa: "si está puesta, MANDA sobre la del Ateneo en el alta de productoras y el cobro de eventos" },
  { env: "STRIPE_SECRET_KEY_CDMX", usa: "auditoría de movimientos de CDMX" },
  { env: "STRIPE_SECRET_KEY_PUEBLA", usa: "auditoría de movimientos de Puebla" },
];

/* Dónde vive una cuenta conectada. Tabla, cómo se llama en la pantalla, y con
   qué llave se dio de alta, para poder decir si está en la plataforma que le
   toca o en otra. */
const DONDE: Array<{ tabla: string; nombre: string; quien: string; espera: string }> = [
  { tabla: "tour_operadores", nombre: "nombre_comercial", quien: "touroperador", espera: "STRIPE_SECRET_KEY" },
  { tabla: "productoras", nombre: "nombre_comercial", quien: "productora", espera: "STRIPE_SECRET_KEY_ATENEO" },
  { tabla: "hoteles", nombre: "nombre", quien: "hotel", espera: "STRIPE_SECRET_KEY_ATENEO" },
];

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  return { ok: r.ok, body: t ? JSON.parse(t) : null };
}

async function sget(key: string, ruta: string) {
  try {
    const r = await fetch(`https://api.stripe.com/v1/${ruta}`, { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => null) as any };
  } catch (e) {
    return { ok: false, status: 0, j: { error: { message: String(e).slice(0, 120) } } };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_EQUIPO });
  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado("La revisión de Stripe la ve el equipo de casa.");

  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch { /* sin cuerpo = revisar */ }
  const accion = String(cuerpo?.accion ?? "revisar");

  /* ---------- 1. LAS LLAVES ----------
     /v1/account dice qué plataforma es; /v1/balance dice si está en vivo. De la
     llave no sale nada: ni el prefijo, ni los últimos cuatro, ni la longitud. */
  const llaves: Record<string, any> = {};
  const vivas: Array<{ env: string; key: string; plataforma: string; vivo: boolean | null }> = [];
  for (const L of LLAVES) {
    const key = Deno.env.get(L.env) ?? "";
    if (!key) { llaves[L.env] = { puesta: false, usa: L.usa }; continue; }
    const a = await sget(key, "account");
    const b = await sget(key, "balance");
    const plataforma = a.ok ? String(a.j?.id ?? "") : "";
    const vivo = b.ok && typeof b.j?.livemode === "boolean" ? !!b.j.livemode : null;
    llaves[L.env] = {
      puesta: true,
      usa: L.usa,
      acepta: a.ok,
      modo: vivo === null ? "no se pudo leer" : (vivo ? "VIVO" : "PRUEBA"),
      plataforma,
      nombre: a.ok ? (a.j?.business_profile?.name ?? a.j?.settings?.dashboard?.display_name ?? null) : null,
      pais: a.ok ? (a.j?.country ?? null) : null,
      error: a.ok ? undefined : String(a.j?.error?.message ?? `HTTP ${a.status}`).slice(0, 140),
    };
    if (a.ok) vivas.push({ env: L.env, key, plataforma, vivo });
  }

  /* Dos llaves distintas que resultan ser la MISMA plataforma no son un
     problema; dos que son plataformas distintas sí, porque las cuentas
     conectadas no se cruzan. Se dice aquí y no se deja deducir. */
  const porPlataforma: Record<string, string[]> = {};
  for (const v of vivas) {
    if (!v.plataforma) continue;
    (porPlataforma[v.plataforma] ||= []).push(v.env);
  }

  /* ---------- PEGAR UNA CUENTA A MANO ----------
     En las fichas del panel el `acct_` estaba en solo-lectura, y con razón: un
     id escrito a mano no lo ha autorizado nadie, y si está mal el cobro no
     falla aquí sino el día de la venta, con un error que no dice nada. Pero no
     poder pegarlo tampoco sirve, porque hay cuentas que ya existen.
     Así que se pega y se COMPRUEBA antes de guardar: se le pregunta a Stripe,
     con cada una de nuestras llaves, si alguna plataforma nuestra ve esa
     cuenta. Si ninguna la ve, no se guarda y se dice por qué.
     Y hay un caso que no se guarda ni forzando: nuestra propia cuenta de
     plataforma en la ficha de un tercero. Es exactamente lo que le pasó a
     FlyLike —quedó registrada la cuenta de Casa Pepe CDMX— y nadie se enteró
     hasta hoy. Javi, 9-oct-2026. */
  if (accion === "pegar") {
    const tipo = String(cuerpo?.tipo ?? "");
    const fid = String(cuerpo?.id ?? "");
    const acct = String(cuerpo?.cuenta ?? "").trim();
    const forzar = cuerpo?.forzar === true;

    const D = DONDE.find((x) => x.quien === tipo || x.tabla === tipo);
    if (!D) return J({ ok: false, error: "No sé de qué tipo de ficha hablamos." }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(fid)) return J({ ok: false, error: "Falta la ficha." }, 400);
    if (!/^acct_[A-Za-z0-9]{8,}$/.test(acct)) {
      return J({ ok: false, error: "Eso no tiene forma de cuenta de Stripe. Empieza por «acct_» y lo copias del panel de Stripe de la cuenta, no de un cobro." }, 400);
    }

    /* Nuestras propias plataformas, sacadas de las llaves que hay puestas. */
    const nuestras = new Set(vivas.map((v) => v.plataforma).filter(Boolean));
    if (nuestras.has(acct)) {
      return J({
        ok: false,
        error: "Esa es una de NUESTRAS cuentas de plataforma, no la de un tercero. " +
          "Pasa cuando se hace la vinculación entrando con el Stripe de la casa en vez del suyo. " +
          "Pídele a él el acct_ de su propia cuenta.",
      }, 409);
    }

    /* Que no esté ya puesta en otra ficha: dos fichas con la misma cuenta
       significa que a alguien le van a caer los cobros del otro. */
    for (const T of DONDE) {
      const o = await rest(`${T.tabla}?select=id,${T.nombre}&stripe_account_id=eq.${encodeURIComponent(acct)}`);
      for (const fila of (o.body ?? [])) {
        if (T.tabla === D.tabla && String(fila.id) === fid) continue;
        return J({ ok: false, error: `Esa cuenta ya está en la ficha de «${fila[T.nombre]}» (${T.quien}). Una cuenta no puede estar en dos fichas.` }, 409);
      }
    }

    /* ¿La ve alguna de nuestras plataformas? */
    const ven: string[] = [];
    let datos: any = null;
    let vivo: boolean | null = null;
    for (const v of vivas) {
      const a = await sget(v.key, `accounts/${acct}`);
      if (!a.ok) continue;
      ven.push(v.env);
      if (!datos) { datos = a.j; vivo = v.vivo; }
    }

    if (!datos) {
      if (!forzar) {
        return J({
          ok: false,
          no_la_vemos: true,
          error: "Ninguna de nuestras plataformas ve esa cuenta. O todavía no nos ha autorizado " +
            `(eso se hace desde su portal, no desde aquí), o está en el otro modo: la llave con la que ` +
            `se le cobra a un ${D.quien} es ${D.espera}. Guardarla igual la deja apuntada pero sin cobrar.`,
          puedes_forzar: true,
        }, 409);
      }
      /* Forzado: queda apuntada y marcada como lo que es. */
      const campos: Record<string, unknown> = {
        stripe_account_id: acct,
        stripe_estado: "restringido",
        stripe_charges_enabled: null,
        stripe_payouts_enabled: null,
      };
      if (D.tabla === "tour_operadores") {
        campos.stripe_requisitos = "sin comprobar: ninguna plataforma nuestra ve esta cuenta";
        campos.stripe_revisado_at = new Date().toISOString();
      }
      const w = await rest(`${D.tabla}?id=eq.${fid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos) });
      if (!w.ok) return J({ ok: false, error: "No se pudo guardar en la ficha." }, 500);
      return J({ ok: true, guardada: acct, comprobada: false, aviso: "Guardada sin comprobar: Stripe no nos deja verla, así que no va a cobrar hasta que nos autorice." });
    }

    const cobra = !!datos.charges_enabled;
    const pagan = !!datos.payouts_enabled;
    const pend: string[] = Array.isArray(datos?.requirements?.currently_due) ? datos.requirements.currently_due : [];
    const campos: Record<string, unknown> = {
      stripe_account_id: acct,
      stripe_charges_enabled: cobra,
      stripe_payouts_enabled: pagan,
      stripe_estado: cobra ? "vinculado" : "restringido",
      stripe_vinculado_at: new Date().toISOString(),
    };
    if (D.tabla === "tour_operadores") {
      campos.stripe_requisitos = pend.length ? pend.join(", ") : null;
      campos.stripe_revisado_at = new Date().toISOString();
    }
    const w = await rest(`${D.tabla}?id=eq.${fid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos) });
    if (!w.ok) return J({ ok: false, error: "Stripe la reconoció, pero no se pudo guardar en la ficha." }, 500);

    return J({
      ok: true,
      guardada: acct,
      comprobada: true,
      la_ven: ven,
      en_su_plataforma: ven.includes(D.espera),
      modo: vivo === null ? "no se pudo leer" : (vivo ? "VIVO" : "PRUEBA"),
      cobra, le_pagan: pagan, tipo_cuenta: datos?.type ?? null,
      le_falta: pend.slice(0, 12),
      motivo: datos?.requirements?.disabled_reason ?? null,
    });
  }

  /* ---------- 2. LAS CUENTAS CONECTADAS ---------- */
  const cuentas: any[] = [];
  for (const D of DONDE) {
    const r = await rest(`${D.tabla}?select=id,${D.nombre},stripe_account_id,stripe_estado&stripe_account_id=not.is.null`);
    for (const fila of (r.body ?? [])) {
      const acct = String(fila.stripe_account_id ?? "");
      if (!acct) continue;
      const ven: string[] = [];
      let datos: any = null;
      let modo: boolean | null = null;
      for (const v of vivas) {
        const a = await sget(v.key, `accounts/${acct}`);
        if (!a.ok) continue;
        ven.push(v.env);
        /* La primera plataforma que la ve es la que manda para los datos: son
           los mismos en todas las que la vean. */
        if (!datos) { datos = a.j; modo = v.vivo; }
      }
      const pend: string[] = Array.isArray(datos?.requirements?.currently_due) ? datos.requirements.currently_due : [];
      const cobra = datos ? !!datos.charges_enabled : null;
      const pagan = datos ? !!datos.payouts_enabled : null;

      cuentas.push({
        quien: D.quien,
        nombre: fila[D.nombre] ?? null,
        cuenta: acct,
        la_ven: ven,
        deberia_verla: D.espera,
        en_su_plataforma: ven.includes(D.espera),
        modo: modo === null ? (ven.length ? "no se pudo leer" : "ninguna plataforma la ve") : (modo ? "VIVO" : "PRUEBA"),
        cobra,
        le_pagan: pagan,
        ficha_dice: fila.stripe_estado ?? null,
        motivo: datos?.requirements?.disabled_reason ?? null,
        le_falta: pend.slice(0, 12),
        tipo: datos?.type ?? null,
      });

      /* 3. Refrescar la ficha. Solo lo que Stripe acaba de decir; si ninguna
         plataforma la ve, no se toca nada: borrar los flags por no haber podido
         leer sería peor que dejarlos como estaban. */
      if (datos) {
        const campos: Record<string, unknown> = {
          stripe_charges_enabled: cobra,
          stripe_payouts_enabled: pagan,
        };
        /* stripe_requisitos es TEXTO, no una lista: mandarle el arreglo tal cual
           hacía que PostgREST rechazara el PATCH entero y la revisión no
           guardara nada, calladita. Javi, 9-oct-2026. */
        if (D.tabla === "tour_operadores" || D.tabla === "hoteles") {
          campos.stripe_revisado_at = new Date().toISOString();
          campos.stripe_requisitos = pend.length ? pend.join(", ") : null;
        }
        await rest(`${D.tabla}?id=eq.${fila.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos),
        });
      }
    }
  }

  /* ---------- 3. LO QUE HAY QUE MIRAR ---------- */
  const avisos: string[] = [];
  const test = llaves["STRIPE_SECRET_KEY_ATENEO_TEST"];
  if (test?.puesta) {
    avisos.push(
      "STRIPE_SECRET_KEY_ATENEO_TEST está puesta y MANDA sobre la del Ateneo: " +
      "el alta de productoras (productora-stripe-alta) y el cobro de eventos (evento-checkout) " +
      "corren con ella. Mientras siga ahí, cualquier productora que vincule su Stripe queda " +
      "en una cuenta de prueba y no cobra dinero de verdad. Quitarla es en los secretos del " +
      "proyecto de Supabase, no desde aquí.",
    );
  }
  for (const [plat, envs] of Object.entries(porPlataforma)) {
    if (envs.length > 1) avisos.push(`Misma plataforma (${plat}) con varios secretos: ${envs.join(", ")}. No estorba, pero son la misma cuenta.`);
  }
  const platSinc = llaves["STRIPE_SECRET_KEY"]?.plataforma;
  const platAte = llaves["STRIPE_SECRET_KEY_ATENEO"]?.plataforma;
  if (platSinc && platAte && platSinc !== platAte) {
    avisos.push(
      "Sincrético y el Ateneo son DOS plataformas distintas en Stripe. Un touroperador dado de " +
      "alta por operador-stripe-alta (llave del Ateneo) queda colgado de la plataforma del Ateneo, " +
      "y sinc-stripe-checkout le cobra con la de Sincrético: ese cargo no puede salir. " +
      "Para touroperadores, la vinculación buena es la de OAuth (sinc-stripe-connect).",
    );
  }
  for (const c of cuentas) {
    if (!c.la_ven.length) avisos.push(`${c.quien} «${c.nombre}»: la cuenta ${c.cuenta} no la ve ninguna plataforma nuestra. O se borró en Stripe, o se creó con una llave que ya no está.`);
    else if (!c.en_su_plataforma) avisos.push(`${c.quien} «${c.nombre}»: su cuenta vive en ${c.la_ven.join(", ")}, pero quien le cobra usa ${c.deberia_verla}.`);
    if (c.modo === "PRUEBA") avisos.push(`${c.quien} «${c.nombre}»: cuenta de PRUEBA. No cobra dinero de verdad.`);
    if (c.ficha_dice === "vinculado" && c.cobra === false) avisos.push(`${c.quien} «${c.nombre}»: la ficha dice «vinculado» y Stripe dice que todavía no puede cobrar.`);
  }

  return J({ ok: true, cuando: new Date().toISOString(), llaves, plataformas: porPlataforma, cuentas, avisos });
});
