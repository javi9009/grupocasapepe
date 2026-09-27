// cfdi-cargar — recibe las filas del Excel de CFDI recibidos del SAT y las deja
// en ctb_cfdi, ligadas a proveedor y con su cuenta contable heredada.
// El navegador parsea el .xlsx (SheetJS) y manda JSON; aqui solo se valida e inserta.
//
// Contención 27-sep-2026: solo quien tiene acceso a finanzas (tiene_acceso_finanzas)
// o dirección. Antes un POST anónimo metía CFDI y proveedores falsos en contabilidad.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { quienLlama, permisoBase, noAutorizado } from "./equipo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/^"+|"+$/g, "");
  return s === "" ? null : s;
};
const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado();
  const finanzas = (await permisoBase(q, "tiene_acceso_finanzas")) || (await permisoBase(q, "es_admin_seguridad"));
  if (!finanzas) return noAutorizado("Solo finanzas o dirección pueden cargar CFDI.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key, { auth: { persistSession: false } });

  let body: { filas?: Record<string, unknown>[]; rfc_receptor?: string; subido_por?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON invalido" }, 400); }

  const filas = body.filas ?? [];
  if (!Array.isArray(filas) || filas.length === 0) return json({ error: "Sin filas" }, 400);
  if (filas.length > 5000) return json({ error: "Maximo 5000 filas por carga" }, 400);

  const rows: Record<string, unknown>[] = [];
  const rechazadas: { fila: number; motivo: string }[] = [];

  filas.forEach((r, i) => {
    const uuid = txt(pick(r, "UUID", "uuid"));
    if (!uuid || !/^[0-9a-fA-F-]{36}$/.test(uuid)) {
      rechazadas.push({ fila: i + 2, motivo: "UUID ausente o invalido" });
      return;
    }
    const rfcEm = txt(pick(r, "RFC emisor", "rfc_emisor"));
    if (!rfcEm) { rechazadas.push({ fila: i + 2, motivo: "Sin RFC emisor" }); return; }

    const metodo = String(pick(r, "Metodo pago", "Método pago", "metodo_pago") ?? "");
    const estado = String(pick(r, "Estado", "estado") ?? "").toUpperCase();
    const fecha = txt(pick(r, "Fecha emision", "Fecha emisión", "fecha_emision"));

    rows.push({
      uuid: uuid.toLowerCase(),
      rfc_receptor: txt(pick(r, "RFC receptor", "rfc_receptor")) ?? body.rfc_receptor ?? null,
      rfc_emisor: rfcEm,
      razon_emisor: txt(pick(r, "Razon emisor", "Razón emisor", "razon_emisor")),
      tipo: String(pick(r, "Tipo", "tipo") ?? "I").trim().charAt(0).toUpperCase(),
      serie: txt(pick(r, "Serie")),
      folio: txt(pick(r, "Folio")),
      fecha_emision: fecha,
      periodo_anio: fecha ? Number(fecha.slice(0, 4)) : null,
      periodo_mes: fecha ? Number(fecha.slice(5, 7)) : num(pick(r, "Periodo")),
      uso_cfdi: txt(pick(r, "Uso CFDI")),
      metodo_pago: metodo.includes("PPD") ? "PPD" : metodo.includes("PUE") ? "PUE" : null,
      forma_pago: txt(pick(r, "Forma pago")),
      condiciones_pago: txt(pick(r, "Condiciones de pago")),
      moneda: txt(pick(r, "Moneda")) ?? "MXN",
      subtotal: num(pick(r, "SubTotal", "subtotal")),
      descuento: num(pick(r, "Descuento")),
      iva_16: num(pick(r, "IVA Trasladado 16%", "IVA Trasladado", "iva_16")),
      iva_0: num(pick(r, "IVA Trasladado 0%")),
      iva_exento: num(pick(r, "IVA Exento")),
      iva_retenido: num(pick(r, "IVA Retenido")),
      isr_retenido: num(pick(r, "ISR Retenido")),
      total: num(pick(r, "Total", "total")),
      estado: estado.includes("VIGENTE") ? "VIGENTE" : (estado || "VIGENTE"),
      conceptos: txt(pick(r, "Conceptos"))?.slice(0, 500) ?? null,
      claves_prodserv: txt(pick(r, "Claves de productos"))?.slice(0, 300) ?? null,
    });
  });

  if (rows.length === 0) return json({ error: "Ninguna fila valida", rechazadas }, 400);

  let insertados = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const lote = rows.slice(i, i + 500);
    const { error } = await db.from("ctb_cfdi").upsert(lote, { onConflict: "uuid", ignoreDuplicates: true });
    if (error) return json({ error: error.message, insertados }, 500);
    insertados += lote.length;
  }

  const { data: post, error: eRpc } = await db.rpc("ctb_cfdi_postproceso");
  if (eRpc) return json({ ok: true, insertados, rechazadas, aviso: "Cargado, pero fallo el postproceso: " + eRpc.message });

  return json({ ok: true, recibidas: filas.length, insertados, rechazadas, postproceso: post, por: q.email });
});
