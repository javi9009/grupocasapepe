// apepe-mi-reserva — el huésped encuentra SU reserva, como en las aerolíneas.
//
// Javi, 12-oct-2026: «esta que me mandaste tiene un error que es buscar su
// nombre y mail para que al cliente le aparezca, como en los aviones su
// reserva». La liga de check-in abierta sin token enseñaba la ficha «Tu
// reserva» con todos los campos en «—», porque hasta ahora la única manera de
// identificar al huésped era el token que mintea recepción.
//
// Aquí la identificación la trae él. DOS datos, los dos obligatorios:
//   · el APELLIDO, y
//   · el CORREO con el que reservó — o el NÚMERO DE RESERVA, porque quien
//     viene de Booking no conoce el alias que la OTA nos manda, pero sí tiene
//     su número delante.
// Uno solo no abre nada: un apellido se adivina y un correo también; los dos
// juntos, no. Y se cuentan los intentos por IP (apepe_busca_intentos), que es
// lo que frena a quien quiera probar correos en serie.
//
// Lo que devuelve es el MISMO token opaco que usa recepción, así que a partir
// de ahí el check-in es exactamente el de siempre.
//
// body: { apellido, dato, ciudad? }  ->  { ok, reservas:[{token,nombre,…}] }

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };

const PROP: Record<string, { keyEnv: string; id?: string; idEnv?: string; etiqueta: string }> = {
  cdmx:   { keyEnv: "CLOUDBEDS_API_KEY",        id: "10668",                                 etiqueta: "Casa Pepe CDMX" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA",        etiqueta: "Casa Pepe Puebla" },
};
const VIVAS = new Set(["confirmed", "checked_in", "not_confirmed", "pending"]);
const TOPE_HORA = 20;   // intentos por IP y hora

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function rest(p: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + p, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(p + " " + r.status);
  return t ? JSON.parse(t) : null;
}

/* Sin acentos, sin signos y en minúsculas: «Puente García» y «puente garcia»
   son el mismo apellido, y el huésped teclea el que le sale. */
function plano(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9@. ]+/g, " ").replace(/\s+/g, " ").trim();
}
function soloAlnum(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function hoyMx(): string { return new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10); }
function masDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function habDe(x: any): string {
  const gl = x.guestList && typeof x.guestList === "object" ? Object.values(x.guestList) as any[] : [];
  const n: string[] = [];
  for (const g of gl) { const v = g.roomTypeName || g.roomName; if (v) n.push(String(v)); }
  if (n.length) return [...new Set(n)].join(" · ");
  return x.roomName || x.roomTypeName || "";
}

async function reservas(pk: string, desde: string, hasta: string) {
  const cfg = PROP[pk]; if (!cfg) return [];
  const key = Deno.env.get(cfg.keyEnv); const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  if (!key || !pid) return [];
  const out: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const u = new URL(`${CB}/getReservations`);
    u.searchParams.set("propertyID", pid);
    u.searchParams.set("checkInFrom", desde);
    u.searchParams.set("checkInTo", hasta);
    u.searchParams.set("pageSize", "100");
    u.searchParams.set("pageNumber", String(page));
    u.searchParams.set("includeGuestsDetails", "true");
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json().catch(() => ({}));
    const data = Array.isArray(j.data) ? j.data : [];
    for (const x of data) if (VIVAS.has(String(x.status))) out.push(x);
    if (data.length < 100) break;
  }
  return out;
}

/* ¿Es suya? El apellido tiene que estar entre los nombres de la reserva Y el
   segundo dato tiene que cuadrar: el correo de alguno de los huéspedes, o el
   número de reserva (el nuestro o el de la OTA). */
function esSuya(x: any, apellido: string, dato: string, esCorreo: boolean): boolean {
  const gl = x.guestList && typeof x.guestList === "object" ? Object.values(x.guestList) as any[] : [];
  const nombres = plano([x.guestName, ...gl.map((g: any) => `${g.guestFirstName || ""} ${g.guestLastName || ""}`)].join(" "));
  const trozos = apellido.split(" ").filter(Boolean);
  const nombreOk = trozos.every((t) => t.length > 1 && nombres.split(" ").some((w) => w === t || (t.length > 3 && w.startsWith(t))));
  if (!nombreOk) return false;
  if (esCorreo) return gl.some((g: any) => plano(g.guestEmail) === dato);
  const d = soloAlnum(dato);
  return soloAlnum(x.reservationID) === d || soloAlnum(x.thirdPartyIdentifier) === d;
}

async function token(rid: string, prop: string): Promise<string> {
  const ex = await rest(`apepe_reserva_token?reservation_id=eq.${encodeURIComponent(rid)}&select=token&limit=1`);
  if (Array.isArray(ex) && ex[0]) return ex[0].token;
  const t = crypto.randomUUID();
  await rest("apepe_reserva_token", { method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ token: t, reservation_id: rid, property: prop, nota: "buscador del huésped" }) });
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sin-ip";
  let b: any = {}; try { b = await req.json(); } catch {}
  const apellido = plano(b.apellido).slice(0, 60);
  const bruto = String(b.dato ?? "").trim().slice(0, 120);
  const esCorreo = bruto.includes("@");
  const dato = esCorreo ? plano(bruto) : bruto;

  if (apellido.length < 2 || !bruto) {
    return J({ ok: false, error: "Necesitamos tu apellido y tu correo (o el número de reserva)." }, 400);
  }

  try {
    const desdeHora = new Date(Date.now() - 3600 * 1000).toISOString();
    const previos = await rest(`apepe_busca_intentos?ip=eq.${encodeURIComponent(ip)}&cuando=gte.${desdeHora}&select=id`);
    if (Array.isArray(previos) && previos.length >= TOPE_HORA) {
      return J({ ok: false, error: "Demasiados intentos. Prueba en un rato o pídeselo a recepción." }, 429);
    }
  } catch { /* si el contador falla, no se le cierra la puerta al huésped */ }

  const ciudad = String(b.ciudad || "").toLowerCase().trim();
  const casas = PROP[ciudad] ? [ciudad] : ["cdmx", "puebla"];
  const hoy = hoyMx();
  /* Primero lo de ahora —que es el 95% de quien abre el check-in— y solo si no
     aparece se mira la ventana larga, para no gastar diez llamadas de más. */
  const ventanas: Array<[string, string]> = [[masDias(hoy, -1), masDias(hoy, 3)], [masDias(hoy, -21), masDias(hoy, 120)]];

  const halladas: any[] = [];
  try {
    for (const [desde, hasta] of ventanas) {
      for (const casa of casas) {
        const lista = await reservas(casa, desde, hasta);
        for (const x of lista) {
          if (!esSuya(x, apellido, dato, esCorreo)) continue;
          if (halladas.some((h) => h.reserva === String(x.reservationID))) continue;
          halladas.push({
            reserva: String(x.reservationID), prop: casa, casa: PROP[casa].etiqueta,
            nombre: String(x.guestName || "").trim(), desde: String(x.startDate || "").slice(0, 10),
            hasta: String(x.endDate || "").slice(0, 10), habitacion: habDe(x),
            pax: Number(x.adults || 0) + Number(x.children || 0),
            ya: String(x.status) === "checked_in",
          });
        }
      }
      if (halladas.length) break;
    }
  } catch { return J({ ok: false, error: "No pudimos consultar las reservas ahora mismo." }, 502); }

  try {
    await rest("apepe_busca_intentos", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ip, acierto: halladas.length > 0, prop: casas.join(",") }) });
  } catch { /* el registro es para nosotros, no para él */ }

  if (!halladas.length) {
    return J({ ok: true, reservas: [], nota: "No encontramos ninguna reserva con esos datos." });
  }

  halladas.sort((a, b2) => String(a.desde).localeCompare(String(b2.desde)));
  const con = [];
  for (const h of halladas.slice(0, 5)) con.push({ ...h, token: await token(h.reserva, h.prop) });
  return J({ ok: true, reservas: con });
});
