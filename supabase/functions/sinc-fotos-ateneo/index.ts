// Las fotos de los eventos del Ateneo, al almacén de Sincrético.
//
// En el Ateneo la foto de un evento no es una liga: es la imagen entera metida
// dentro de la base como base64, dos o tres megas por cartel. Cuando migramos
// los seis eventos a Sincrético se copiaron los datos pero no las fotos, porque
// no había ninguna liga que copiar y nadie se dio cuenta hasta que se vieron
// las tarjetas con el degradado.
//
// Esto las decodifica, las sube al bucket y las deja registradas en sinc_media,
// que es de donde lee el escaparate. Es una herramienta de migración: se puede
// volver a llamar sin miedo —no duplica— y solo la puede usar el equipo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB  = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const BUCKET = "sincretico";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}

/* Solo el equipo, o el servidor. Esto lee y escribe contenido publicado. */
async function puede(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  if (jwt === SRK) return true;
  if (jwt === ANON || jwt.startsWith("sb_publishable_")) return false;
  const r = await fetch(`${SB}/rest/v1/rpc/es_equipo_casa`, {
    method: "POST",
    headers: { apikey: ANON || SRK, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((x) => x.ok ? x.json() : false).catch(() => false);
  return r === true;
}

/* «Taller · Valida tu Idea» y «Taller – Valida tu Idea» son el mismo evento:
   los separan un punto medio y una raya. Se comparan sin adornos. */
function llano(s: string) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function bytesDe(dataUri: string) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUri ?? "");
  if (!m) return null;
  const bin = atob(m[2]);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return { tipo: m[1], bytes: b };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);
  if (!(await puede(req))) return json({ error: "Solo el equipo de casa" }, 401);

  const exp = await rest("op_experiencias?select=id,nombre&formato=eq.evento");
  if (!exp.ok) return json({ error: "no pudimos leer las experiencias" }, 500);

  const ate = await rest("ateneo_cine_eventos?select=titulo,foto_url");
  if (!ate.ok) return json({ error: "no pudimos leer los eventos del Ateneo" }, 500);

  const porTitulo = new Map<string, string>();
  for (const e of ate.body ?? []) {
    if (e.foto_url) porTitulo.set(llano(e.titulo), e.foto_url);
  }

  const hechas: string[] = [], saltadas: string[] = [], fallos: string[] = [];

  for (const e of exp.body ?? []) {
    /* Si ya tiene foto, no se toca: esto se puede llamar mil veces. */
    const ya = await rest(`sinc_media?select=id&experiencia_id=eq.${e.id}&tipo=eq.foto&limit=1`);
    if (ya.ok && ya.body?.length) { saltadas.push(e.nombre + " (ya tenía)"); continue; }

    const uri = porTitulo.get(llano(e.nombre));
    if (!uri) { saltadas.push(e.nombre + " (sin cartel en el Ateneo)"); continue; }

    const img = bytesDe(uri);
    if (!img) { fallos.push(e.nombre + " (el cartel no es una imagen legible)"); continue; }

    const ext = img.tipo === "image/png" ? "png" : img.tipo === "image/webp" ? "webp" : "jpg";
    const ruta = `ateneo/${e.id}/${Date.now()}-cartel.${ext}`;

    const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": img.tipo,
                 "x-upsert": "true", "cache-control": "public, max-age=31536000" },
      body: img.bytes,
    });
    if (!up.ok) { fallos.push(e.nombre + " (" + up.status + " al subir)"); continue; }

    const url = `${SB}/storage/v1/object/public/${BUCKET}/${ruta}`;
    const ins = await rest("sinc_media", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        experiencia_id: e.id, tipo: "foto", url, storage_path: ruta,
        etiqueta: "header", alt: e.nombre, bytes: img.bytes.length,
        origen: "ateneo", estado: "listo", orden: 0,
        created_by: "sinc-fotos-ateneo",
      }),
    });
    if (!ins.ok) { fallos.push(e.nombre + " (no se pudo registrar)"); continue; }
    hechas.push(e.nombre);
  }

  return json({ ok: true, subidas: hechas, saltadas, fallos });
});
