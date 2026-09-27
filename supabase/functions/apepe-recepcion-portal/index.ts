// apepe-recepcion-portal — llegadas de hoy para la tablet de recepción.
//
// Devuelve lo mínimo para encontrar al huésped y lanzar su check-in: nombre,
// habitación, fecha, cuántos, y si es No-show de arrastre. Sin correos ni CRM.
//
// Contención 27-sep-2026 (segunda pasada): tampoco es público. La lista de
// quién llega hoy y a qué cuarto es información de huéspedes. Lo sirve a la
// tablet con su llave (x-integracion-token 'tablet-recepcion', que la tablet
// recibe en su link ?k=...) o al equipo con sesión.
//
// body: { prop: 'cdmx' | 'puebla' }
import { quienLlama, tokenIntegracion, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const PROPS: Record<string, { keyEnv: string; id?: string; idEnv?: string }> = {
  cdmx: { keyEnv: "CLOUDBEDS_API_KEY", id: "10668" },
  puebla: { keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA" },
};
const VIVAS = new Set(["confirmed", "checked_in", "not_confirmed", "pending"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-integracion-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function hoyMx(): string {
  const t = new Date(Date.now() - 6 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}
function masDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function habDe(x: any): string {
  const cand = x.rooms || x.assigned || x.roomsList || [];
  if (Array.isArray(cand) && cand.length) {
    const nombres = cand
      .map((r: any) => r.roomTypeName || r.roomName || r.roomTypeNameShort || "")
      .filter(Boolean);
    if (nombres.length) return [...new Set(nombres)].join(" · ");
  }
  return x.roomName || x.roomTypeName || "";
}
function cuentaPax(x: any): { ad: number; ni: number } {
  const cand = x.rooms || x.assigned || [];
  let ad = 0, ni = 0;
  if (Array.isArray(cand) && cand.length) {
    for (const r of cand) { ad += Number(r.adults || 0); ni += Number(r.children || 0); }
  }
  if (!ad && !ni) { ad = Number(x.adults || 0); ni = Number(x.children || 0); }
  return { ad, ni };
}

async function llegadasProp(pk: string, desde: string, hasta: string) {
  const cfg = PROPS[pk];
  if (!cfg) return [];
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  if (!key || !pid) return [];
  const out: any[] = [];
  let page = 1;
  while (page <= 10) {
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
    for (const x of data) {
      const status = String(x.status);
      if (!VIVAS.has(status)) continue;
      out.push(x);
    }
    if (data.length < 100) break;
    page++;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = await quienLlama(req);
  if (!q.equipo && !(await tokenIntegracion(req, "tablet-recepcion"))) return noAutorizado("Solo recepción (tablet con su llave) o el equipo con sesión.");
  let body: any = {};
  try { body = await req.json(); } catch {}
  const prop = String(body.prop ?? "cdmx");
  if (!PROPS[prop]) return J({ ok: false, error: "sede desconocida" }, 400);

  // Búsqueda en otras fechas: si viene un rango válido, devuelve todas las llegadas
  // de ese rango (sin lógica de No-show), para buscar por nombre o número de reserva.
  const desdeIn = String(body.desde || "").slice(0, 10);
  const hastaIn = String(body.hasta || "").slice(0, 10);
  const esRango = /^\d{4}-\d{2}-\d{2}$/.test(desdeIn) && /^\d{4}-\d{2}-\d{2}$/.test(hastaIn) && hastaIn >= desdeIn;
  if (esRango) {
    const capHasta = masDias(desdeIn, 92);
    const hastaR = hastaIn > capHasta ? capHasta : hastaIn;
    let cr: any[] = [];
    try { cr = await llegadasProp(prop, desdeIn, hastaR); }
    catch { return J({ ok: false, error: "no pudimos leer llegadas" }, 502); }
    const lista = cr.map((x: any) => { const { ad, ni } = cuentaPax(x); return {
      reservation_id: String(x.reservationID), nombre: String(x.guestName || "").trim(),
      habitacion: habDe(x), adultos: ad, ninos: ni, desde: String(x.startDate || "").slice(0, 10),
      checked_in: String(x.status) === "checked_in", ns: false }; });
    lista.sort((a, b) => String(a.desde).localeCompare(String(b.desde)) || String(a.nombre).localeCompare(String(b.nombre), "es"));
    return J({ ok: true, rango: true, desde: desdeIn, hasta: hastaR, prop, total: lista.length, llegadas: lista });
  }

  const hoy = hoyMx();
  const ayer = masDias(hoy, -1);

  let crudas: any[] = [];
  try { crudas = await llegadasProp(prop, ayer, hoy); }
  catch (e) { return J({ ok: false, error: "no pudimos leer llegadas" }, 502); }

  const llegadas: any[] = [];
  for (const x of crudas) {
    const desdeR = String(x.startDate || "").slice(0, 10);
    const status = String(x.status);
    const checked_in = status === "checked_in";
    let ns = false;
    if (desdeR === hoy) {
      // llegada de hoy
    } else if (desdeR === ayer) {
      if (checked_in) continue;
      ns = true;
    } else {
      continue;
    }
    const { ad, ni } = cuentaPax(x);
    llegadas.push({
      reservation_id: String(x.reservationID),
      nombre: String(x.guestName || "").trim(),
      habitacion: habDe(x),
      adultos: ad,
      ninos: ni,
      desde: desdeR,
      checked_in,
      ns,
    });
  }

  const rank = (r: any) => (r.ns ? 0 : r.checked_in ? 2 : 1);
  llegadas.sort((a, b) =>
    rank(a) - rank(b) || String(a.nombre).localeCompare(String(b.nombre), "es"));

  return J({ ok: true, fecha: hoy, prop, total: llegadas.length, llegadas });
});
