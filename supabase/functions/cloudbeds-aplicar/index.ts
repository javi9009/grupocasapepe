// Aplica en Cloudbeds SOLO propuestas en estado 'aprobada'.
//
// Contención 27-sep-2026: además de sesión real, quien llama necesita el permiso
// 'tarifas_cuartos' (tabla acceso_delicado). Antes bastaba cualquier cuenta,
// incluida una de touroperador creada en autoservicio.
import { quienLlama, puedeDelicado, noAutorizado } from "./equipo.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-cb-key",
  "access-control-allow-methods": "POST, OPTIONS",
};
const API = "https://hotels.cloudbeds.com/api/v1.2";
const no = (e: string, s = 401) => Response.json({ ok: false, error: e }, { status: s, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- cerrojo 1: sesión de persona del equipo con permiso de tarifas (o servidor) ---
  const q = await quienLlama(req);
  if (!q.equipo) return no("hace falta sesion iniciada");
  if (!(await puedeDelicado(q, "tarifas_cuartos"))) return no("sin permiso para aplicar tarifas", 403);
  const quien = q.servidor ? "operacion de servidor" : q.email;

  // --- cerrojo 2: llave de Cloudbeds ---
  const secreto = Deno.env.get("CLOUDBEDS_API_KEY") ?? "";
  const cbKey = secreto.startsWith("cbat_") ? secreto : (req.headers.get("x-cb-key") ?? "");
  if (!cbKey.startsWith("cbat_")) return no("sin llave de Cloudbeds configurada");

  let body: any = {};
  try { body = await req.json(); } catch { /* vacio */ }
  const ids: number[] = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];

  const H = { apikey: srv, Authorization: `Bearer ${srv}`, "Content-Type": "application/json" };
  const filtro = ids.length ? `&id=in.(${ids.join(",")})` : "";
  const pend = await (await fetch(`${url}/rest/v1/cp_propuesta?select=*&estado=eq.aprobada${filtro}`, { headers: H })).json();
  if (!Array.isArray(pend) || !pend.length) {
    return Response.json({ ok: true, aplicadas: 0, nota: "no hay propuestas aprobadas" }, { headers: CORS });
  }

  const hechas: any[] = [];
  for (const p of pend) {
    const propertyID = p.propiedad_id === 2 ? "201759" : "10668";
    const form = new URLSearchParams({
      propertyID,
      "rates[0][rateID]": String(p.rate_id),
      "rates[0][interval][0][startDate]": p.fecha_estancia,
      "rates[0][interval][0][endDate]": p.fecha_estancia,
      "rates[0][interval][0][rate]": String(p.bar_propuesta),
    });
    let estado = "fallida", job = "", res = "";
    try {
      const r = await fetch(`${API}/putRate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cbKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const j = await r.json().catch(() => ({}));
      res = JSON.stringify(j).slice(0, 250);
      if (r.ok && j?.success) { estado = "aplicada"; job = String(j.jobReferenceID ?? ""); }
    } catch (e) { res = String(e).slice(0, 250); }

    await fetch(`${url}/rest/v1/rpc/cp_propuesta_resultado`, {
      method: "POST", headers: H,
      body: JSON.stringify({ p_id: p.id, p_estado: estado, p_job: job, p_resultado: `${quien} · ${res}` }),
    });
    hechas.push({ id: p.id, codigo: p.codigo, fecha: p.fecha_estancia, de: p.bar_actual, a: p.bar_propuesta, estado });
  }

  return Response.json({
    ok: true, por: quien,
    aplicadas: hechas.filter((h) => h.estado === "aplicada").length,
    fallidas: hechas.filter((h) => h.estado !== "aplicada").length,
    detalle: hechas,
  }, { headers: CORS });
});
