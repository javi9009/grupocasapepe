// GENERAR LAS MINIATURAS QUE FALTAN. Javi, 27-oct-2026.
//
// Cada foto se guarda recortada en vertical (900x1200) y en horizontal
// (1600x900). El sitio público pedía los tamaños de tarjeta al redimensionador
// de Supabase, que se cobra por imagen distinta transformada al mes: 368 de
// 100 incluidas. Desde hoy el recortador guarda también una miniatura de
// 600x800 al subir, pero las fotos que ya existían no la tenían.
//
// Esto se la hace una sola vez: pide la miniatura al redimensionador -esas
// transformaciones se pagan una vez- y guarda el resultado como un archivo
// más. A partir de ahí nadie vuelve a transformar nada.
//
// POR DEFECTO SÓLO LAS DE EXPERIENCIAS PUBLICADAS, que son las únicas que
// alguien ve. Las otras son borradores y fichas en cartera, y cuando se
// publiquen ya nacerán con su miniatura desde el recortador.
//
// LAS ROTAS PRIMERO. Javi, 27-oct-2026: «no se ve esta foto de este tour».
// mini() sólo cambia la letra cuando el nombre acaba en _v.jpg, así que la
// única foto que se ve ROTA por no tener miniatura es justo ésa: el navegador
// pide un archivo que no está. Las demás sin miniatura se sirven enteras y se
// ven bien. Por eso `rotas: true` se queda con las que acaban en _v.jpg y no
// tienen _t: son las que urgen, y son pocas.
//
// Se llama en tandas:  POST /mini-backfill  {"limite": 100}
//                      POST /mini-backfill  {"limite": 100, "rotas": true}
//                      POST /mini-backfill  {"limite": 100, "todas": true}
const SB   = Deno.env.get('SUPABASE_URL')!;
const KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'sincretico';

const cab = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// El nombre de la miniatura, al lado de su vertical. Un recorte vertical acaba
// en _v.jpg y sólo se le cambia la letra; cualquier otro nombre lleva el sufijo
// antes de la extensión. Las dos reglas son excluyentes: encadenarlas dejaba
// nombres como "foto_t_t.jpg".
function rutaMini(p: string): string {
  if (/_v\.jpg$/i.test(p)) return p.replace(/_v\.jpg$/i, '_t.jpg');
  return p.replace(/\.(jpg|jpeg|png|webp)$/i, '_t.jpg');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  let limite = 50, todas = false, rotas = false;
  try {
    const b = await req.json();
    if (b && Number(b.limite) > 0) limite = Math.min(Number(b.limite), 200);
    if (b && b.todas === true) todas = true;
    if (b && b.rotas === true) { rotas = true; todas = true; }
  } catch (_) {}

  const filtro = (todas
    ? 'select=id,storage_path'
    : 'select=id,storage_path,op_experiencias!inner(estado)&op_experiencias.estado=eq.publicada')
    + (rotas ? '&storage_path=like.*_v.jpg' : '');
  const r = await fetch(`${SB}/rest/v1/sinc_media?${filtro}&tipo=eq.foto&url_t=is.null&storage_path=not.is.null&order=created_at.desc&limit=${limite}`, { headers: cab });
  if (!r.ok) return resp({ error: `no se pudo leer la lista: ${await r.text()}` }, 500);
  const filas: { id: string; storage_path: string }[] = await r.json();

  let hechas = 0;
  const fallos: string[] = [];

  for (const f of filas) {
    try {
      const src = `${SB}/storage/v1/render/image/public/${BUCKET}/${f.storage_path}?width=600&quality=72&resize=cover`;
      const img = await fetch(src);
      if (!img.ok) { fallos.push(`${f.id}: el redimensionador respondió ${img.status}`); continue; }
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.length < 500) { fallos.push(`${f.id}: vino vacía`); continue; }

      const ruta = rutaMini(f.storage_path);
      const sube = await fetch(`${SB}/storage/v1/object/${BUCKET}/${ruta}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: bytes,
      });
      if (!sube.ok) { fallos.push(`${f.id}: el almacén la rechazó (${sube.status})`); continue; }

      // Y la fila de vuelta: un PATCH que no toca nada también contesta que sí.
      const pat = await fetch(`${SB}/rest/v1/sinc_media?id=eq.${f.id}`, {
        method: 'PATCH',
        headers: { ...cab, Prefer: 'return=representation' },
        body: JSON.stringify({ url_t: `${SB}/storage/v1/object/public/${BUCKET}/${ruta}`, storage_path_t: ruta }),
      });
      const fila = pat.ok ? await pat.json() : null;
      if (!fila || !fila.length) { fallos.push(`${f.id}: la base no dejó guardarla`); continue; }
      hechas++;
    } catch (e) {
      fallos.push(`${f.id}: ${(e as Error).message}`);
    }
  }

  const q = await fetch(`${SB}/rest/v1/sinc_media?${filtro}&tipo=eq.foto&url_t=is.null&storage_path=not.is.null&limit=1`, { headers: { ...cab, Prefer: 'count=exact' } });
  const quedan = Number((q.headers.get('content-range') || '/0').split('/')[1] || 0);

  return resp({ miradas: filas.length, hechas, quedan, solo_publicadas: !todas, solo_rotas: rotas, fallos: fallos.slice(0, 20) });
});

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
}
function resp(b: unknown, s = 200) {
  return new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors(), 'Content-Type': 'application/json' } });
}
