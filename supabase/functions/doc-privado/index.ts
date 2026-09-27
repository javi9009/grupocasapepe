// doc-privado — sirve los documentos de socios desde el bucket privado socios-docs
// (carpeta web/) a quien tenga sesión de socio o del equipo (puede_docs_socios).
//
// Contención 27-sep-2026: estos documentos (deck y modelo de Uruguay 86, reporte a
// socios, avalúo y planos) estaban publicados como archivos estáticos en Netlify,
// legibles por cualquiera con la URL. La página pública ahora es un cascarón que
// pide el documento aquí con la sesión.
//
//   GET /doc-privado?f=/m/socios-deck-uruguay.html   -> text/html
//   GET /doc-privado?f=/docs/uruguay/Planos_Uruguay_86.pdf -> application/pdf
import { quienLlama, permisoBase, noAutorizado } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

const PERMITIDOS: Record<string, string> = {
  "/m/socios-deck-uruguay.html": "text/html; charset=utf-8",
  "/m/modelo-uruguay.html": "text/html; charset=utf-8",
  "/reporte-socios.html": "text/html; charset=utf-8",
  "/ui/reporte-socios.html": "text/html; charset=utf-8",
  "/docs/uruguay/Avaluo_CMI_Uruguay_86.pdf": "application/pdf",
  "/docs/uruguay/Planos_Uruguay_86.pdf": "application/pdf",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  let f = u.searchParams.get("f") ?? "";
  if (!f && req.method === "POST") { try { f = String((await req.json()).f ?? ""); } catch { /* noop */ } }
  f = f.replace(/\.html?$/, ".html");
  if (!f.startsWith("/")) f = "/" + f;
  if (!/\.(html|pdf)$/.test(f)) f = f + ".html";
  const mime = PERMITIDOS[f];
  if (!mime) return new Response(JSON.stringify({ ok: false, error: "documento no disponible" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });

  const q = await quienLlama(req);
  if (!q.servidor && !(await permisoBase(q, "puede_docs_socios"))) return noAutorizado("Este documento es solo para socios y equipo. Inicia sesión.");

  const r = await fetch(`${SB}/storage/v1/object/socios-docs/web${f}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
  if (!r.ok) return new Response(JSON.stringify({ ok: false, error: "no se pudo leer el documento" }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  return new Response(r.body, { headers: { ...CORS, "Content-Type": mime, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
});
