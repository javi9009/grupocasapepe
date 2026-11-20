// op-cotizacion — la cotización (factura proforma) de una ODC de conciliación.
//
// Javi, 20-nov-2026: «genera un nuevo botón en la ODC que diga Generar
// Cotización y saca la info de todos los servicios generados, el precio neto y
// el IVA y total al final, con el logo de Casa Pepe y la info de una especie
// de factura proforma. Y nos muestra un PDF para que se descargue y una opción
// de "enviar a" que pide un correo para mandarlo con CC».
//
// Por qué existe: hasta hoy, para mandarle a un touroperador lo que se le va a
// cobrar había que armarlo a mano en un correo. Lo que se armaba a mano salía
// distinto cada vez y nunca coincidía del todo con lo conciliado — que es
// exactamente como nace una discusión de dinero. Esto saca el documento de la
// misma fuente que la conciliación: las líneas de servicio, una por una.
//
// La regla del IVA, la de siempre: en la línea se guarda el NETO y el impuesto
// se suma al final. El precio pactado con el touroperador lleva el IVA dentro,
// así que meterlo tal cual como neto lo cobra dos veces. Eso fue lo que torció
// octubre de Capital Bus.
//
// Entrada: { ticket_id, enviar_a?, cc?[], nota? }
// Salida:  { ok, pdf_b64, archivo, folio, total, enviado }
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { quienLlama } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY");
const LOGO = "https://grupocasapepe.netlify.app/img/casapepe/casapepe_color.png";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const api = (p: string) =>
  fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

const pesos = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function dia(f: string | null): string {
  if (!f) return "—";
  const p = String(f).slice(0, 10).split("-");
  return `${+p[2]} ${MES[+p[1] - 1]} ${p[0]}`;
}
/* El acento no existe en WinAnsi y pdf-lib revienta al dibujarlo. Se quita
   solo del PDF: en la base y en el correo los nombres van enteros. */
const limpia = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, " ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const q = await quienLlama(req);
    if (!q.equipo) return J({ ok: false, error: "Esta cotización es del equipo de la casa." }, 403);

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body.ticket_id || "");
    if (!ticketId) return J({ ok: false, error: "Falta la orden" }, 400);

    const [t] = await api(`op_conciliacion_tickets?id=eq.${ticketId}&select=*`);
    if (!t) return J({ ok: false, error: "No encuentro esa orden" }, 404);

    const [op] = await api(
      `tour_operadores?id=eq.${t.operador_id}&select=nombre_comercial,razon_social,rfc,concilia_razon_social,concilia_correos`,
    );
    const lineas = await api(
      `v_op_conc_lineas?ticket_id=eq.${ticketId}&select=fecha,servicio,unidad,personas,precio_neto,neto,iva,bruto&order=fecha`,
    );
    if (!lineas.length) return J({ ok: false, error: "Esta orden todavía no tiene servicios" }, 400);

    const neto = lineas.reduce((a: number, l: any) => a + Number(l.neto || 0), 0);
    const iva = lineas.reduce((a: number, l: any) => a + Number(l.iva || 0), 0);
    const total = neto + iva;
    const pax = lineas.reduce((a: number, l: any) => a + Number(l.personas || 0), 0);
    const folio = `COT-${t.folio || String(ticketId).slice(0, 8)}`;

    /* ---------- el documento ---------- */
    const pdf = await PDFDocument.create();
    const reg = await pdf.embedFont(StandardFonts.Helvetica);
    const neg = await pdf.embedFont(StandardFonts.HelveticaBold);
    let pg = pdf.addPage([612, 792]); // carta
    let y = 740;
    const M = 50, ANCHO = 512;
    const TINTA = rgb(0.12, 0.12, 0.11);
    const SUAVE = rgb(0.45, 0.44, 0.41);
    const VERDE = rgb(0.12, 0.30, 0.21);
    const LINEA = rgb(0.86, 0.84, 0.79);

    const txt = (s: string, x: number, yy: number, size = 9.5, f = reg, c = TINTA) =>
      pg.drawText(limpia(s), { x, y: yy, size, font: f, color: c });
    const der = (s: string, xFin: number, yy: number, size = 9.5, f = reg, c = TINTA) => {
      const w = f.widthOfTextAtSize(limpia(s), size);
      pg.drawText(limpia(s), { x: xFin - w, y: yy, size, font: f, color: c });
    };
    const raya = (yy: number, c = LINEA, gr = 0.7) =>
      pg.drawLine({ start: { x: M, y: yy }, end: { x: M + ANCHO, y: yy }, thickness: gr, color: c });

    // Logo. Si no carga, el documento sale igual: un papel sin logo se entiende;
    // uno que no sale, no.
    try {
      const png = await fetch(LOGO).then((r) => (r.ok ? r.arrayBuffer() : null));
      if (png) {
        const img = await pdf.embedPng(png);
        const alto = 44, ancho = (img.width / img.height) * alto;
        pg.drawImage(img, { x: M, y: y - alto + 10, width: ancho, height: alto });
      }
    } catch (_) { /* sin logo */ }

    der("COTIZACION", M + ANCHO, y + 2, 20, neg, VERDE);
    der("Factura proforma - no es un comprobante fiscal", M + ANCHO, y - 13, 8.5, reg, SUAVE);
    der(`${folio}  ·  ${dia(new Date().toISOString())}`, M + ANCHO, y - 27, 9, neg);
    y -= 58;
    raya(y, VERDE, 1.4);
    y -= 22;

    // Emisor y cliente, lado a lado
    const colD = M + 270;
    txt("DE", M, y, 7.5, neg, SUAVE);
    txt("PARA", colD, y, 7.5, neg, SUAVE);
    y -= 14;
    txt(op?.concilia_razon_social || "Grupo Casa Pepe", M, y, 10.5, neg);
    txt(op?.nombre_comercial || "Cliente", colD, y, 10.5, neg);
    y -= 13;
    txt("Republica de Uruguay 86, Centro Historico", M, y, 8.5, reg, SUAVE);
    if (op?.rfc) txt(`RFC ${op.rfc}`, colD, y, 8.5, reg, SUAVE);
    y -= 11;
    txt("Ciudad de Mexico  ·  javi@casapepe.mx", M, y, 8.5, reg, SUAVE);
    if (op?.razon_social && !/^<+$/.test(String(op.razon_social)))
      txt(String(op.razon_social), colD, y, 8.5, reg, SUAVE);
    y -= 26;

    txt(
      `Servicios prestados del ${dia(t.semana_desde)} al ${dia(t.semana_hasta)}`,
      M, y, 9.5, neg,
    );
    y -= 20;

    // Cabecera de la tabla
    const cFecha = M, cServ = M + 78, cPax = M + 300, cPrecio = M + 370, cImp = M + ANCHO;
    raya(y + 12);
    txt("FECHA", cFecha, y, 7.5, neg, SUAVE);
    txt("SERVICIO", cServ, y, 7.5, neg, SUAVE);
    der("PERSONAS", cPax + 48, y, 7.5, neg, SUAVE);
    der("P. UNITARIO", cPrecio + 70, y, 7.5, neg, SUAVE);
    der("IMPORTE", cImp, y, 7.5, neg, SUAVE);
    y -= 7;
    raya(y);
    y -= 16;

    for (const l of lineas) {
      if (y < 150) { pg = pdf.addPage([612, 792]); y = 730; }
      txt(dia(l.fecha), cFecha, y, 9);
      const nom = String(l.servicio || "Servicio");
      txt(nom.length > 34 ? nom.slice(0, 33) + "." : nom, cServ, y, 9);
      der(String(l.personas ?? "—"), cPax + 48, y, 9);
      der(pesos(Number(l.precio_neto || 0)), cPrecio + 70, y, 9);
      der(pesos(Number(l.neto || 0)), cImp, y, 9);
      y -= 8;
      raya(y, rgb(0.94, 0.93, 0.90), 0.5);
      y -= 13;
    }

    // Totales. El neto arriba y el IVA aparte: el precio pactado ya lleva el
    // impuesto dentro, y enseñarlo separado es lo que evita cobrarlo dos veces.
    y -= 8;
    const tx = M + 300;
    txt(`${lineas.length} servicio${lineas.length === 1 ? "" : "s"}  ·  ${pax} personas`, M, y, 9, reg, SUAVE);
    der("Subtotal (sin IVA)", tx + 150, y, 9.5, reg, SUAVE);
    der(pesos(neto), cImp, y, 9.5);
    y -= 16;
    der("IVA 16%", tx + 150, y, 9.5, reg, SUAVE);
    der(pesos(iva), cImp, y, 9.5);
    y -= 10;
    pg.drawLine({ start: { x: tx, y }, end: { x: M + ANCHO, y }, thickness: 1, color: VERDE });
    y -= 18;
    der("TOTAL", tx + 150, y, 12, neg, VERDE);
    der(pesos(total), cImp, y, 13, neg, VERDE);
    y -= 34;

    if (body.nota) { txt(String(body.nota), M, y, 9); y -= 18; }
    txt("Vigencia de esta cotizacion: 15 dias naturales.", M, y, 8.5, reg, SUAVE); y -= 12;
    txt("Los importes se calculan sobre las personas efectivamente recibidas, servicio por servicio.", M, y, 8.5, reg, SUAVE); y -= 12;
    txt("Documento informativo: no ampara efectos fiscales. La factura se emite al cierre del periodo.", M, y, 8.5, reg, SUAVE);

    const bytes = await pdf.save();
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 = btoa(bin);
    const archivo = `cotizacion-${(t.folio || "odc").toLowerCase()}.pdf`;

    /* ---------- enviar, si lo piden ---------- */
    let enviado: any = null;
    const para = String(body.enviar_a || "").trim();
    if (para) {
      if (!RESEND) return J({ ok: true, pdf_b64: b64, archivo, folio, total, enviado: { ok: false, error: "sin RESEND_API_KEY" } });
      const cc = Array.isArray(body.cc) ? body.cc.filter(Boolean) : [];
      const html = `<div style="font-family:Georgia,serif;font-size:15px;color:#20201e;line-height:1.55">
        <p>Hola:</p>
        <p>Te mando la cotizacion <b>${folio}</b> por los servicios prestados
           del ${dia(t.semana_desde)} al ${dia(t.semana_hasta)}:
           ${lineas.length} servicio${lineas.length === 1 ? "" : "s"}, ${pax} personas.</p>
        <p><b>Subtotal sin IVA:</b> ${pesos(neto)}<br>
           <b>IVA 16%:</b> ${pesos(iva)}<br>
           <b>Total:</b> ${pesos(total)}</p>
        <p>Va el detalle servicio por servicio en el PDF adjunto. Es una factura proforma:
           sirve para revisar y autorizar, no ampara efectos fiscales. La factura se emite al cierre del periodo.</p>
        <p>Cualquier cosa que no cuadre, dime y lo revisamos antes de facturar.</p>
        <p>Un saludo,<br>Grupo Casa Pepe</p></div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Casa Pepe <no-reply@casapepe.mx>",
          to: [para],
          ...(cc.length ? { cc } : {}),
          reply_to: "contabilidad@casapepe.mx",
          subject: `Cotizacion ${folio} · ${op?.nombre_comercial || "servicios"} · ${pesos(total)}`,
          html,
          attachments: [{ filename: archivo, content: b64 }],
        }),
      });
      enviado = r.ok ? { ok: true, para, cc } : { ok: false, error: await r.text() };
    }

    return J({ ok: true, pdf_b64: b64, archivo, folio, neto, iva, total, servicios: lineas.length, pax, enviado });
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
