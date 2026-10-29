// Supabase Edge Function: miniaturas-relleno  (v1)
//
// 29-oct-2026. Relleno de una sola vez.
//
// El recortador guarda, al lado de cada vertical _v.jpg, una miniatura de
// 600 px de ancho con el mismo nombre y _t.jpg. Las cuadriculas piden esa
// miniatura; la ficha del tour pide la vertical. Pero el recortador empezo a
// hacerlo tarde: de las 248 verticales que hay en el cubo `sincretico`, 238 se
// subieron antes y nunca tuvieron su miniatura. Esas cuadriculas llevaban
// meses bajando la foto grande para pintarla del tamano de un sello -unos 5 MB
// para abrir /sinc/todas.html-, y hasta ayer ni eso: se veia el hueco.
//
// Esta funcion lee cada vertical que se le nombra, hace la de 600 px y la
// guarda al lado. No borra nada, no toca la vertical, y si la miniatura ya
// existe no la pisa salvo que se pida. Terminado el relleno, esta funcion no
// hace falta: lo de aqui en adelante lo hace el recortador al subir la foto.
//
// Quien la llama tiene que ser del equipo de la casa. La llave de servicio
// tambien pasa, que es la que usa la casa por dentro.
//
//   POST { nombres: ["carpeta/1793071686796-roma2_v.jpg", ...], forzar?: bool }
//   -> { ok, hechas, saltadas, fallos:[{nombre,por_que}], ms }

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CUBO = "sincretico";
const ANCHO = 600;
const CALIDAD = 82;
const TOPE = 40; // por llamada, para no pasarse del tiempo de la funcion

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// La misma puerta que el reporte del dia: una llave publicable no es una sesion.
async function esDeLaCasa(req: Request): Promise<boolean> {
  const tok = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  if (SERVICE_KEY && tok === SERVICE_KEY) return true;
  if (!SUPA_URL) return false;
  const apikey = ANON_KEY || tok;
  try {
    const u = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${tok}` } });
    if (!u.ok) return false;
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/es_equipo_casa`, {
      method: "POST",
      headers: { apikey, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch (_e) { return false; }
}

function nombreMini(v: string): string { return v.replace(/_v\.jpg$/i, "_t.jpg"); }

async function existe(nombre: string): Promise<boolean> {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/info/public/${CUBO}/${nombre}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.ok;
}

async function unaFoto(v: string, forzar: boolean): Promise<string> {
  const t = nombreMini(v);
  if (t === v) return "no es una vertical";
  if (!forzar && await existe(t)) return "ya estaba";

  const bajada = await fetch(`${SUPA_URL}/storage/v1/object/public/${CUBO}/${v}`);
  if (!bajada.ok) return `no se pudo leer la vertical (HTTP ${bajada.status})`;
  const crudo = new Uint8Array(await bajada.arrayBuffer());

  let salida: Uint8Array;
  try {
    const img = await Image.decode(crudo);
    // Si ya es mas estrecha que la miniatura, se guarda tal cual: agrandar una
    // foto para "reducirla" seria dejarla peor y mas pesada.
    if (img.width <= ANCHO) salida = crudo;
    else salida = await img.resize(ANCHO, Image.RESIZE_AUTO).encodeJPEG(CALIDAD);
  } catch (e) { return "no se pudo abrir la imagen: " + String(e).slice(0, 120); }

  const sube = await fetch(`${SUPA_URL}/storage/v1/object/${CUBO}/${t}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
      "x-upsert": "true",
    },
    body: salida,
  });
  if (!sube.ok) return `no se pudo guardar (HTTP ${sube.status}) ${(await sube.text()).slice(0, 120)}`;
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();
  try {
    if (!await esDeLaCasa(req)) {
      return json({ ok: false, error: "Esto lo corre el equipo de la casa.", sin_permiso: true }, 403);
    }
    const body = (await req.json().catch(() => null)) as { nombres?: unknown; forzar?: unknown } | null;
    const lista = Array.isArray(body?.nombres) ? (body!.nombres as unknown[]).map(String) : [];
    const forzar = body?.forzar === true;
    if (!lista.length) return json({ ok: false, error: "Hacen falta los nombres de las fotos." }, 400);
    if (lista.length > TOPE) return json({ ok: false, error: `De ${TOPE} en ${TOPE} como mucho.` }, 400);

    let hechas = 0, saltadas = 0;
    const fallos: Array<{ nombre: string; por_que: string }> = [];
    for (const v of lista) {
      const mal = await unaFoto(v, forzar);
      if (!mal) hechas += 1;
      else if (mal === "ya estaba") saltadas += 1;
      else fallos.push({ nombre: v, por_que: mal });
    }
    return json({ ok: true, hechas, saltadas, fallos, ms: Date.now() - t0 });
  } catch (e) {
    return json({ ok: false, error: String(e), ms: Date.now() - t0 }, 500);
  }
});
