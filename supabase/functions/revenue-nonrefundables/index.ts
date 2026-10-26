/* revenue-nonrefundables — el estudio de cada noche.
   Javi, 19-oct-2026: "haz un estudio todos los dias de aquellas reservas de
   CDMX y Puebla que pasan a ser non-refundables esa noche... o si es una
   reserva ya no reembolsable desde el inicio, y todavia no esta saldado".

   De donde sale cada cosa:
   · El LIBRO: getReservationsWithRateDetails, el unico endpoint que dice el
     PLAN TARIFARIO de cada habitacion (ratePlanNamePublic / rateName). 100
     reservas por llamada en vez de una llamada por reserva.
   · La POLITICA: Cloudbeds no la da -`cancellation` viene null y los planes de
     la API no traen ventana-, asi que se declara en nonref_politica por patron
     de nombre. Lo que no casa con ningun patron NO entra en la lista: sale
     aparte para que alguien lo declare. Cobrarle a un huesped que todavia
     podia cancelar es peor que cobrarle un dia tarde.
   · La TARJETA: solo se pregunta por las que de verdad entran, y solo al
     escribir. Preguntar por todas es una llamada por reserva del libro entero
     y revienta el limite de 150s de la funcion -ya paso-.
   · El CORREO: de esa MISMA llamada. Javi, 26-oct-2026: el boton de avisar
     decia "no hay correo" en reservas que si lo tenian. El libro
     (getReservationsWithRateDetails) no trae el correo del huesped, asi que la
     fila nacia con email null y nadie volvia a buscarlo. Pero dos lineas mas
     abajo ya se pedia getReservation para mirar la tarjeta, y esa respuesta SI
     trae el correo: venia en el mismo paquete y se tiraba. Con 64 reservas
     abiertas, 151 mil pesos y tarjeta guardada en todas, no poder escribirles
     era el unico motivo por el que ese dinero no se movia.

   Las tablas viven en public, no en el esquema revenue: PostgREST solo expone
   public, y en revenue la pantalla no las podria ni leer.

   Aqui NO se cobra ni se avisa a nadie. Esto solo hace la lista; los dos
   botones los aprieta el auditor, porque -Javi- puede intentar el cobro dos
   veces y que la segunda si pase.

   { prop:"cdmx"|"puebla" }  una casa (sin esto, las dos)
   { dias: 30 }              cuanto libro mirar hacia adelante
   { seco:true }             no escribe: dice que haria y que planes no tienen politica
   { rellenar:true }         no mira el libro: repasa las filas abiertas que se
                             guardaron sin correo y se lo pone, de Cloudbeds.
                             { limite: 25 } cuantas por pasada. */
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const PROP: Record<string, { keyEnv: string; id?: string; idEnv?: string; casa: string }> = {
  cdmx:   { keyEnv: "CLOUDBEDS_API_KEY",        id: "10668",                            casa: "Casa Pepe CDMX" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA", casa: "Casa Pepe Puebla" },
};
const VIVAS = new Set(["confirmed", "not_confirmed"]);
const HORA_CHECKIN = 15;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-integracion-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  let b: any = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { ok: r.ok, status: r.status, body: b };
}

async function deCasa(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (jwt === SRV) return true;
  const sec = req.headers.get("x-integracion-token") ?? "";
  if (sec) {
    const ok = await fetch(`${SB}/rest/v1/rpc/trae_token_integracion`, {
      method: "POST",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", "x-integracion-token": sec },
      body: JSON.stringify({ p_nombre: "revenue-nonrefundables" }),
    }).then((r) => r.ok ? r.json() : false).then((v) => v === true).catch(() => false);
    if (ok) return true;
  }
  if (!jwt) return false;
  if (!ANON || jwt === ANON || jwt.startsWith("sb_publishable_")) return false;
  return await fetch(`${SB}/rest/v1/rpc/es_equipo_casa`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.ok ? r.json() : false).then((v) => v === true).catch(() => false);
}

const hoyMx = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const masDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function llaves(propKey: string) {
  const cfg = PROP[propKey];
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  return { key, pid: pid ? String(pid) : "" };
}

/* La ficha completa de UNA reserva. Es la que trae el correo del huesped y las
   tarjetas guardadas; el libro no trae ninguna de las dos cosas. */
async function fichaReserva(reservationID: string, pid: string, key: string) {
  const j = await fetch(
    `${CB}/getReservation?reservationID=${encodeURIComponent(reservationID)}&propertyID=${pid}`,
    { headers: { Authorization: `Bearer ${key}` } },
  ).then((x) => x.json());
  return j?.data ?? j;
}

/* El correo del titular, de donde este. Cloudbeds no lo pone siempre en el
   mismo sitio: unas veces en la lista de huespedes y otras en la reserva. */
function correoDe(d: any): string | null {
  const gl = d?.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as any[] : [];
  const main = gl.find((g: any) => g?.isMainGuest) || gl[0] || {};
  const c = String(main?.guestEmail ?? d?.guestEmail ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c) ? c : null;
}

function tarjetaDe(d: any) {
  const cof = Array.isArray(d?.cardsOnFile) ? d.cardsOnFile : [];
  return {
    tiene: cof.length > 0,
    texto: cof.length ? [cof[0].cardType, String(cof[0].cardNumber ?? "").slice(-4)].filter(Boolean).join(" ····") : null,
  };
}

/* ---------- repasar lo ya guardado sin correo ----------
   No mira el libro: va fila por fila a Cloudbeds. Se hace por tandas porque
   son 150 segundos de reloj y cada reserva es una llamada. */
async function rellenaCorreos(prop: string | null, limite: number) {
  const casas = prop && PROP[prop] ? [prop] : Object.keys(PROP);
  const out: any = { revisadas: 0, con_correo: 0, sin_correo_en_cloudbeds: 0, fallos: 0, quedan: 0 };

  for (const propKey of casas) {
    const { key, pid } = llaves(propKey);
    if (!key || !pid) continue;

    const q = await rest(
      `nonref_dia?select=id,reservation_id&property=eq.${propKey}` +
      `&estado=in.(pendiente,no_paso,avisado)&email=is.null&order=check_in.asc&limit=${limite}`);
    const filas: any[] = Array.isArray(q.body) ? q.body : [];

    for (const f of filas) {
      out.revisadas++;
      try {
        const d = await fichaReserva(String(f.reservation_id), pid, key);
        const correo = correoDe(d);
        const tj = tarjetaDe(d);
        const cuerpo: any = { tiene_tarjeta: tj.tiene };
        if (tj.texto) cuerpo.tarjeta = tj.texto;
        if (correo) { cuerpo.email = correo; out.con_correo++; }
        else out.sin_correo_en_cloudbeds++;
        await rest(`nonref_dia?id=eq.${f.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(cuerpo) });
      } catch (e) {
        out.fallos++;
        console.error("rellenar", f.reservation_id, String(e));
      }
    }

    /* Cuantas siguen sin correo despues de esta tanda, para saber si hay que
       volver a llamar. */
    const r2 = await rest(
      `nonref_dia?select=id&property=eq.${propKey}` +
      `&estado=in.(pendiente,no_paso,avisado)&email=is.null&limit=500`);
    out.quedan += Array.isArray(r2.body) ? r2.body.length : 0;
  }
  return out;
}

async function libro(propKey: string, dias: number) {
  const { key, pid } = llaves(propKey);
  if (!key || !pid) return { pid: "", key: "", filas: [] as any[] };
  const hoy = hoyMx();
  const out: any[] = [];
  for (let page = 1; page <= 8; page++) {
    const u = new URL(`${CB}/getReservationsWithRateDetails`);
    u.searchParams.set("propertyID", String(pid));
    u.searchParams.set("checkInFrom", hoy);
    u.searchParams.set("checkInTo", masDias(hoy, dias));
    u.searchParams.set("pageSize", "100");
    u.searchParams.set("pageNumber", String(page));
    const j = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => ({}));
    const d = Array.isArray(j?.data) ? j.data : [];
    out.push(...d);
    if (d.length < 100) break;
  }
  return { pid: String(pid), key, filas: out };
}

function planesDe(r: any): string {
  const rooms = Array.isArray(r.rooms) ? r.rooms : [];
  const n = new Set<string>();
  for (const rm of rooms) {
    for (const v of [rm.ratePlanNamePublic, rm.rateName, rm.ratePlanNamePrivate]) {
      const s = String(v ?? "").trim(); if (s) n.add(s);
    }
  }
  return [...n].join(" · ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);
  if (!(await deCasa(req))) return J({ ok: false, error: "esto es de casa" }, 403);
  let body: any = {}; try { body = await req.json(); } catch {}

  /* Repasar lo viejo es otra faena: no se mira el libro de las proximas
     noches, se va a buscar lo que falta de las filas que ya existen. */
  if (body.rellenar === true) {
    const limite = Math.min(60, Math.max(1, Number(body.limite ?? 25)));
    const prop = PROP[String(body.prop ?? "")] ? String(body.prop) : null;
    const r = await rellenaCorreos(prop, limite);
    return J({ ok: true, rellenar: true, ...r });
  }

  const seco = body.seco === true;
  const dias = Math.min(180, Math.max(2, Number(body.dias ?? 30)));
  const casas = PROP[String(body.prop ?? "")] ? [String(body.prop)] : Object.keys(PROP);

  const pol = (await rest(`nonref_politica?activa=is.true&select=*&order=prioridad.asc`)).body ?? [];
  const politicas: any[] = Array.isArray(pol) ? pol : [];
  if (!politicas.length) return J({ ok: false, error: "no hay ninguna politica declarada; sin eso no se puede decidir nada" }, 409);

  const abiertas = (await rest(`nonref_dia?estado=in.(pendiente,no_paso,avisado)` +
    `&select=id,property,reservation_id,saldo,estado,email`)).body ?? [];
  const yaAbierta = new Map<string, any>();
  for (const a of (Array.isArray(abiertas) ? abiertas : [])) yaAbierta.set(`${a.property}|${a.reservation_id}`, a);

  const hoy = hoyMx();
  const ahora = Date.now();
  const resumen: any = { fecha: hoy, dias, nuevas: 0, actualizadas: 0, correos_puestos: 0, por_casa: {}, sin_politica: {} as Record<string, number> };
  const muestra: any[] = [];

  for (const propKey of casas) {
    const { pid, key, filas } = await libro(propKey, dias);
    if (!pid) { resumen.por_casa[propKey] = { error: "sin llave" }; continue; }
    let miradas = 0, entran = 0;

    for (const r of filas) {
      if (!VIVAS.has(String(r.status))) continue;
      const saldo = Math.round(Number(r.balance ?? 0) * 100) / 100;
      if (!(saldo > 0)) continue;
      miradas++;

      const plan = planesDe(r);
      const regla = politicas.find((p) =>
        (!p.property || p.property === propKey) && new RegExp(p.patron, "i").test(plan));
      if (!regla) { resumen.sin_politica[plan || "(sin nombre)"] = (resumen.sin_politica[plan || "(sin nombre)"] ?? 0) + 1; continue; }

      const checkIn = String(r.reservationCheckIn ?? "").slice(0, 10);
      let motivo = "", cierra: string | null = null;
      if (regla.tipo === "no_reembolsable") {
        motivo = "de_origen";
      } else {
        const entrada = Date.parse(`${checkIn}T${String(HORA_CHECKIN).padStart(2, "0")}:00:00-06:00`);
        if (!entrada) continue;
        const cierraMs = entrada - Number(regla.horas_antes ?? 0) * 3600000;
        if (!(cierraMs > ahora - 86400000 && cierraMs <= ahora + 86400000)) continue;
        motivo = "cierra_esta_noche";
        cierra = new Date(cierraMs).toISOString();
      }

      entran++;
      const clave = `${propKey}|${r.reservationID}`;
      const abierta = yaAbierta.get(clave);

      if (abierta) {
        if (!seco) {
          const cuerpo: any = {};
          if (Number(abierta.saldo) !== saldo) cuerpo.saldo = saldo;
          /* Si quedo sin correo en su dia, se aprovecha el paso para ponerselo. */
          if (!String(abierta.email ?? "").trim()) {
            try {
              const d0 = await fichaReserva(String(r.reservationID), pid, key);
              const correo = correoDe(d0);
              if (correo) { cuerpo.email = correo; resumen.correos_puestos++; }
            } catch (_) { /* si falla, se queda como estaba */ }
          }
          if (Object.keys(cuerpo).length) {
            await rest(`nonref_dia?id=eq.${abierta.id}`, { method: "PATCH",
              headers: { Prefer: "return=minimal" }, body: JSON.stringify(cuerpo) });
            if (cuerpo.saldo != null) resumen.actualizadas++;
          }
        }
        continue;
      }

      const fila: any = {
        fecha: hoy, property: propKey, reservation_id: String(r.reservationID),
        huesped: String(r.guestName ?? "").trim() || null,
        email: null,
        check_in: checkIn || null, check_out: String(r.reservationCheckOut ?? "").slice(0, 10) || null,
        plan, fuente: String(r.sourceName ?? r.source ?? "") || null,
        total: Math.round(Number(r.total ?? 0) * 100) / 100, saldo,
        motivo, cierra_at: cierra,
      };

      if (seco) { muestra.push(fila); continue; }

      /* UNA SOLA LLAMADA PARA LAS DOS COSAS: la tarjeta y el correo. Antes se
         pedia esta ficha solo para la tarjeta y el correo del mismo paquete se
         tiraba, asi que la fila nacia sin a quien escribirle. */
      try {
        const d0 = await fichaReserva(String(r.reservationID), pid, key);
        const tj = tarjetaDe(d0);
        fila.tiene_tarjeta = tj.tiene;
        if (tj.texto) fila.tarjeta = tj.texto;
        fila.email = correoDe(d0);
      } catch { fila.tiene_tarjeta = null; }

      const ins = await rest(`nonref_dia`, { method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(fila) });
      if (ins.ok) resumen.nuevas++;
    }
    resumen.por_casa[propKey] = { libro: filas.length, con_saldo: miradas, entran };
  }

  return J({ ok: true, seco, ...resumen, muestra: seco ? muestra.slice(0, 40) : undefined });
});
