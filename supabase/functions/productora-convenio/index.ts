// productora-convenio — mandarle a la productora el convenio para que lo firme.
//
// Desde el 6-oct-2026 el convenio firmado es lo que le abre la puerta: sin él no
// se publica ningún evento suyo ni se le manda un cliente (ver tercero_candado).
// Hasta hoy la única manera de que lo firmara era que alguien le pasara la liga
// de su portal por WhatsApp. Esto lo manda por correo, deja constancia de a quién
// y cuándo, y de paso habilita el convenio si todavía no lo estaba —firmar exige
// que la ficha tenga una versión puesta, y eso se olvidaba.
//
// Una sola puerta: el equipo de casa con su sesión. La productora no se manda el
// convenio a sí misma.
import { quienLlama, noAutorizado } from "./equipo.ts";
import { marco, remitente, respondeA } from "./correo.ts";

const SB  = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
/* Remitente y «responder a» por marca: ver correo.ts. Javi, 10-oct-2026. */
const FROM = remitente("ateneo");
const PORTAL = "https://casapepe.mx/productora.html";
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

async function rest(p: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + p, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(p + " " + r.status + " " + t.slice(0, 160));
  return t ? JSON.parse(t) : null;
}

function correoHtml(nombre: string, liga: string, falta: string[]) {
  return marco({
    marca: "ateneo",
    avance: "Tu convenio, para leerlo y firmarlo desde tu portal. Es el paso que falta para publicar.",
    saludo: nombre || null,
    titulo: "Tu convenio con el Ateneo, para leerlo y firmarlo",
    cuerpo: [
      "El Ateneo de Virreyes es el espacio de eventos, cine y coworking de Grupo Casa Pepe, en Izazaga 8. Te escribimos porque vas a producir con nosotros y este es el paso que falta antes de abrir tu primer evento.",
      "El convenio no tiene letra chica: deja claro quién responde de qué. <b>Tú produces tu evento; nosotros ponemos el espacio y el canal de venta.</b> Léelo entero y, si estás de acuerdo, fírmalo ahí mismo con el dedo o el ratón.",
    ],
    boton: { texto: "Leer y firmar el convenio", liga: liga + "#convenio" },
    nota: falta.length
      ? `Para poder publicar nos falta además: <b>${falta.map(esc).join("</b>, <b>")}</b>. Lo completas en tu portal, en «Mi cuenta», cuando puedas.`
      : null,
    despues: "Esa misma liga es tu portal y no caduca: desde ahí das de alta tus eventos, pides las salas y ves tus ventas. Guárdala.",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return J({ ok: false, error: "POST only" }, 405);

  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado("Esto lo manda el equipo de casa.");

  try {
    const b: any = await req.json().catch(() => ({}));
    const id = String(b.productora_id || "").trim();
    if (!id) return J({ ok: false, error: "falta la productora" }, 400);

    const rows = await rest(`productoras?id=eq.${encodeURIComponent(id)}&select=id,nombre_comercial,email,email_notificaciones,portal_token,contrato_version,contrato_firmado_at&limit=1`);
    const p = Array.isArray(rows) && rows[0];
    if (!p) return J({ ok: false, error: "no encuentro esa productora" }, 404);
    if (p.contrato_firmado_at) return J({ ok: false, error: "ya lo tiene firmado" }, 409);

    const para = String(p.email_notificaciones || p.email || "").trim();
    if (!para) return J({ ok: false, error: "no tiene correo: ponle uno en su ficha y vuelve a intentarlo" }, 400);
    if (!p.portal_token) return J({ ok: false, error: "no tiene liga de portal todavía" }, 400);

    /* Firmar exige que la ficha tenga una versión puesta; si nadie la escribió,
       se toma la de la plantilla activa en vez de mandarla a una pantalla que le
       va a decir «tu convenio todavía no está habilitado». */
    if (!p.contrato_version) {
      let ver = "v3-2026-10";
      try {
        const pl = await rest(`prod_contrato_plantilla?activo=is.true&select=version&order=version.desc&limit=1`);
        if (Array.isArray(pl) && pl[0]?.version) ver = String(pl[0].version);
      } catch { /* la de por defecto sirve */ }
      await rest(`productoras?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ contrato_version: ver }),
      });
    }

    /* Lo que le falta además del convenio, para decírselo en el mismo correo y no
       en tres. Lo contesta la misma función que aplica el candado. */
    let falta: string[] = [];
    try {
      const c = await rest(`rpc/tercero_candado`, {
        method: "POST", body: JSON.stringify({ p_tipo: "productora", p_id: id }),
      });
      falta = ((c?.bloquea || []) as any[]).filter((x) => x.clave !== "convenio").map((x) => String(x.que));
    } catch { /* el correo sale igual */ }

    const liga = `${PORTAL}?t=${encodeURIComponent(String(p.portal_token))}`;
    if (!RESEND) return J({ ok: false, error: "no hay llave de correo configurada" }, 503);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [para], reply_to: respondeA("ateneo"),
        subject: "Tu convenio con el Ateneo de Virreyes, para firmarlo",
        /* El nombre del saludo va vacío si no lo hay: con el valor por defecto
           de antes el correo empezaba con «Hola Hola». */
        html: correoHtml(String(p.nombre_comercial || ""), liga, falta),
      }),
    });
    if (!r.ok) return J({ ok: false, error: `no salió el correo (${r.status})` }, 502);

    await rest(`productoras?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        convenio_enviado_at: new Date().toISOString(),
        convenio_enviado_a: para,
        convenio_enviado_por: q.email || "equipo",
      }),
    });

    return J({ ok: true, a: para, mensaje: `Convenio mandado a ${para}.` });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: String(e) }, 500);
  }
});
