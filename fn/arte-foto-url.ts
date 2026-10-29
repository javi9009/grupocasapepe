// Supabase Edge Function: arte-foto-url  (v1)
//
// 29-oct-2026. Trae una foto de fuera y la deja en el almacén de la casa.
//
// Óscar Reyes dejó 22 rótulos del Taller Pase Ud en una carpeta de Drive.
// Apuntar las fichas a la URL de Drive habría sido lo rápido y lo malo: esas
// ligas se caen, se limitan por tráfico y un día la pieza se queda sin foto en
// la tienda. Las 26 piezas que ya tenían foto apuntan a un worker de un
// tercero, y eso es exactamente lo que no queremos repetir.
//
// Así que la foto se baja, se recorta como todas las de la casa —vertical de
// 900x1200 y su miniatura de 600x800— y se guarda en nuestro cubo. Lo que
// queda en la ficha es una liga nuestra.
//
// Solo el equipo de la casa, y solo desde Drive: una función que se descarga
// cualquier URL que le pidan es una puerta abierta a la red de dentro.
//
//   POST { url, ruta?, nombre }  ->  { ok, vUrl, tUrl }

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CUBO = "sincretico";
const V = { w: 900, h: 1200 };
const T = { w: 600, h: 800 };
const CALIDAD = 86;

// De dónde se deja traer una foto. Nada de redes internas ni de localhost.
const HOSTS_OK = [
  "drive.google.com",
  "drive.usercontent.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

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

// Recorta al centro con la proporción pedida y luego ajusta el tamaño. Igual
// que hace el recortador de la casa cuando nadie mueve la foto: llenar el
// marco y centrar, en vez de dejar bandas de color hueso a los lados.
function encuadra(img: Image, w: number, h: number): Image {
  const quiero = w / h;
  const tengo = img.width / img.height;
  let cw = img.width, ch = img.height, cx = 0, cy = 0;
  if (tengo > quiero) { cw = Math.round(img.height * quiero); cx = Math.round((img.width - cw) / 2); }
  else { ch = Math.round(img.width / quiero); cy = Math.round((img.height - ch) / 2); }
  return img.crop(cx, cy, cw, ch).resize(w, h);
}

async function guarda(ruta: string, bytes: Uint8Array): Promise<boolean> {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${CUBO}/${ruta}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
      "x-upsert": "true",
    },
    body: bytes,
  });
  return r.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!await esDeLaCasa(req)) return json({ ok: false, error: "Esto lo corre el equipo de la casa." }, 403);

    const b = (await req.json().catch(() => null)) as { url?: string; ruta?: string; nombre?: string } | null;
    const url = String(b?.url ?? "");
    const nombre = String(b?.nombre ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
    const ruta = String(b?.ruta ?? "artesania/piezas").replace(/[^a-zA-Z0-9/_-]/g, "");
    if (!url || !nombre) return json({ ok: false, error: "Hacen falta la url y el nombre." }, 400);

    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch (_e) { return json({ ok: false, error: "Esa url no se entiende." }, 400); }
    if (!HOSTS_OK.includes(host)) return json({ ok: false, error: "De ese sitio no traemos fotos." }, 400);

    const baja = await fetch(url, { redirect: "follow" });
    if (!baja.ok) return json({ ok: false, error: `No se pudo bajar la foto (HTTP ${baja.status})` }, 502);
    const crudo = new Uint8Array(await baja.arrayBuffer());
    if (crudo.length < 1024) return json({ ok: false, error: "Lo que llegó no es una foto." }, 502);

    let vBytes: Uint8Array, tBytes: Uint8Array;
    try {
      const img = await Image.decode(crudo);
      vBytes = await encuadra(img.clone(), V.w, V.h).encodeJPEG(CALIDAD);
      tBytes = await encuadra(img, T.w, T.h).encodeJPEG(CALIDAD);
    } catch (e) { return json({ ok: false, error: "No se pudo abrir la imagen: " + String(e).slice(0, 120) }, 502); }

    const base = `${ruta}/${Date.now()}-${nombre}`;
    if (!await guarda(`${base}_v.jpg`, vBytes)) return json({ ok: false, error: "No se pudo guardar la vertical." }, 502);
    if (!await guarda(`${base}_t.jpg`, tBytes)) return json({ ok: false, error: "No se pudo guardar la miniatura." }, 502);

    const pub = `${SUPA_URL}/storage/v1/object/public/${CUBO}/${base}`;
    return json({ ok: true, vUrl: `${pub}_v.jpg`, tUrl: `${pub}_t.jpg` });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
