// Stripe -> auditoria.stripe_movimientos (via RPC: PostgREST no expone el esquema auditoria)
// Stripe es la fuente de LIQUIDACION. Se separa hospedaje de tours por el campo `application`:
//   ca_CcYIH4fRT3uUJBkBw02Wb2rULBuGNCIc -> Cloudbeds
//   ca_9eQsLUKrdcLmcTNO5wY92a1AXw4sxo1l -> Turitop
// v3: lee las llaves de los secretos STRIPE_SECRET_KEY_CDMX / _PUEBLA
//
// v4, 11-oct-2026 — LA LLAVE YA NO VIAJA EN EL CUERPO. Javi.
// Esta funcion aceptaba un {claves:{cdmx:'sk_live_...'}} en el POST y lo usaba
// ANTES que el secreto del entorno. Con eso, cualquiera que tuviera el
// x-sync-secret podia apuntar la carga a OTRA cuenta de Stripe y meter sus
// movimientos en la contabilidad de Casa Pepe: no hace falta robar nada para
// envenenar un libro, basta con poder elegir de donde se lee. Y de paso hacia
// viajar una llave secreta de Stripe dentro de un POST, que acaba en registros.
// Ahora la llave sale SIEMPRE del entorno. Si alguien manda `claves`, no se
// ignora en silencio: se contesta que ya no se aceptan, para que quien tenga un
// script viejo se entere en vez de creer que funciono.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
const APP_CB = "ca_CcYIH4fRT3uUJBkBw02Wb2rULBuGNCIc";
const APP_TT = "ca_9eQsLUKrdcLmcTNO5wY92a1AXw4sxo1l";
const CUENTAS: Record<string, { property: string; envKey: string }> = {
  cdmx:   { property: "45e69775-d877-4507-a9e1-a45bd3400dc5", envKey: "STRIPE_SECRET_KEY_CDMX" },
  puebla: { property: "febfbef6-7fd1-4b45-84d9-13533e8dcb72", envKey: "STRIPE_SECRET_KEY_PUEBLA" },
};
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const J = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json" } });
const dinero = (c: number) => Number((c / 100).toFixed(2));
const TZ = "America/Mexico_City";

/* Comparar el secreto sin delatar en cuantos caracteres acierta. */
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function diaOperativo(seg: number): string {
  return new Date((seg - 6 * 3600) * 1000).toISOString().slice(0, 10);
}
function hoyCDMX(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function epochDe(f: string, h: number): number {
  return Math.floor(Date.parse(`${f}T00:00:00-06:00`) / 1000) + h * 3600;
}
async function stripeGet(key: string, path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
  const j = await r.json();
  if (j.error) throw new Error(`Stripe ${path}: ${j.error.message}`);
  return j;
}
function origenDe(src: any) {
  if (!src || typeof src !== "object") return { origen: "otro", reserva: null, cliente: null };
  const desc = String(src.description ?? ""); const app = String(src.application ?? "");
  const nombre = src.billing_details?.name ?? null;
  if (app === APP_TT) { const m = desc.match(/^(C\d+-\d+-\d+)/); return { origen: "turitop", reserva: m ? m[1] : null, cliente: nombre }; }
  if (app === APP_CB) {
    const m = desc.match(/(?:Reserva|Reservation)\s*:?\s*(\d+)/i);
    return { origen: "cloudbeds", reserva: m ? m[1] : (src.metadata?.["Reservation Id"] ?? src.metadata?.["Reserva Id"] ?? null), cliente: nombre };
  }
  return { origen: "otro", reserva: null, cliente: nombre };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  const dado = req.headers.get("x-sync-secret") ?? "";
  if (!SYNC_SECRET || !iguales(dado, SYNC_SECRET)) return J({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (body && typeof body === "object" && body.claves) {
    return J({ error: "Las llaves de Stripe ya no se aceptan en el cuerpo. Se leen de los secretos del proyecto (STRIPE_SECRET_KEY_CDMX / _PUEBLA). Quita `claves` de la llamada." }, 400);
  }

  const ayer = new Date(Date.parse(hoyCDMX() + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const desde: string = body.desde ?? ayer;
  const hasta: string = body.hasta ?? ayer;
  const cuentas: string[] = body.cuentas ?? Object.keys(CUENTAS);
  const out: Record<string, any> = { desde, hasta, cuentas: {} };

  for (const nombre of cuentas) {
    const cfg = CUENTAS[nombre];
    if (!cfg) { out.cuentas[nombre] = { estado: "desconocida" }; continue; }
    const key = Deno.env.get(cfg.envKey) ?? "";
    if (!key) { out.cuentas[nombre] = { estado: "sin_clave", falta: cfg.envKey }; continue; }
    try {
      const gte = epochDe(desde, 0), lt = epochDe(hasta, 24);
      const filas: any[] = [];
      let after: string | undefined;
      for (let p = 0; p < 20; p++) {
        const q: Record<string, string> = { limit: "100", "created[gte]": String(gte), "created[lt]": String(lt), "expand[]": "data.source" };
        if (after) q.starting_after = after;
        const j = await stripeGet(key, "balance_transactions", q);
        const d: any[] = j.data ?? [];
        filas.push(...d);
        if (!j.has_more || !d.length) break;
        after = d[d.length - 1].id;
      }
      const rows = filas.map((t) => {
        const src = t.source;
        const o = origenDe(src);
        return {
          id: t.id, property_id: cfg.property, cuenta: nombre,
          charge_id: typeof src === "object" && src ? src.id : (typeof src === "string" ? src : null),
          fecha_operativa: diaOperativo(t.created),
          ocurrido_at: new Date(t.created * 1000).toISOString(),
          tipo: t.type, descripcion: t.description,
          reserva: o.reserva, cliente: o.cliente,
          bruto: dinero(t.amount), comision: dinero(t.fee), neto: dinero(t.net),
          estado: t.status,
          disponible_el: t.available_on ? new Date(t.available_on * 1000).toISOString().slice(0, 10) : null,
          raw: { origen: o.origen, reporting_category: t.reporting_category, application: (src as any)?.application ?? null },
        };
      });
      let cargados = 0;
      for (let i = 0; i < rows.length; i += 300) {
        const { data, error } = await sb.rpc("aud_cargar_stripe", { p_movs: rows.slice(i, i + 300) });
        if (error) throw new Error(error.message);
        cargados += (data as any)?.cargados ?? 0;
      }
      const resumen: Record<string, any> = {};
      for (const r of rows) {
        const k = r.raw.origen === "otro" ? r.tipo : r.raw.origen;
        resumen[k] ??= { n: 0, bruto: 0, neto: 0 };
        resumen[k].n++; resumen[k].bruto += r.bruto; resumen[k].neto += r.neto;
      }
      for (const k of Object.keys(resumen)) { resumen[k].bruto = Number(resumen[k].bruto.toFixed(2)); resumen[k].neto = Number(resumen[k].neto.toFixed(2)); }
      out.cuentas[nombre] = { estado: "ok", movimientos: rows.length, cargados, resumen };
    } catch (e) {
      out.cuentas[nombre] = { estado: "error", mensaje: String((e as any)?.message ?? e) };
    }
  }
  return J(out);
});
