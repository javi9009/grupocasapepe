// corp-correo — manda la cotización corporativa al cliente y el aviso a Javi.
//
// Javi, 21-nov-2026, probando el cotizador: «no me llegó ninguna cotización».
// La solicitud se guardaba bien -el folio salía en pantalla- pero el correo
// no existía todavía. Esto es ese correo.
//
// LA PUERTA. La llama el front con la clave pública, así que no puede ser un
// cañón de correos: sólo atiende una cotización que exista, que se haya
// creado hace menos de diez minutos y a la que no se le haya mandado ya el
// suyo. Después de eso, se marca y no se repite.
//
// Entrada: { cotizacion_id }  ·  Salida: { ok, enviado_a }
const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY");
const AVISO = ["javi@casapepe.mx"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const api = (p: string) =>
  fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);
const pesos = (n: unknown) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const dia = (f: string | null) => {
  if (!f) return "fecha por definir";
  const p = String(f).slice(0, 10).split("-");
  return `${+p[2]} de ${MES[+p[1] - 1]} de ${p[0]}`;
};
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.cotizacion_id || "");
    if (!id) return J({ ok: false, error: "Falta la cotización" }, 400);

    const [c] = await api(`corp_cotizaciones?id=eq.${id}&select=*`);
    if (!c) return J({ ok: false, error: "No encuentro esa cotización" }, 404);
    if (c.correo_at) return J({ ok: true, ya: true, enviado_a: [c.email] });
    if (Date.now() - new Date(c.created_at).getTime() > 10 * 60 * 1000) {
      return J({ ok: false, error: "Esa cotización ya no es reciente." }, 409);
    }

    const lineas = await api(
      `corp_cotizacion_lineas?cotizacion_id=eq.${id}&version=eq.${c.version}&select=*&order=orden`);
    const reglas = await api(`corp_reglas?select=clave,valor`);
    const R: Record<string, string> = {};
    (reglas as Array<{ clave: string; valor: string }>).forEach((r) => (R[r.clave] = r.valor));
    const wa = String(R["whatsapp_seguimiento"] || "+525549305703").replace(/[^0-9]/g, "");
    const antPct = Number(c.anticipo_pct || R["anticipo_pct"] || 30);
    const anticipo = Number(c.total || 0) * antPct / 100;

    const GRUPOS: Record<string, string> = {
      transporte: "Transporte", experiencia: "Experiencia", lugar: "Lugar",
      ab: "Alimentos y bebidas", extras: "Extras",
    };
    type L = { etapa: string; nombre: string; cantidad: number; modo: string; importe: number | null };
    const porCotizar: string[] = [];
    let filas = "";
    Object.keys(GRUPOS).forEach((g) => {
      const del = (lineas as L[]).filter((l) => l.etapa === g);
      if (!del.length) return;
      filas += `<tr><td colspan="2" style="padding:14px 0 4px;font-family:Arial,sans-serif;font-size:11px;
        letter-spacing:.09em;text-transform:uppercase;color:#6e665c">${GRUPOS[g]}</td></tr>`;
      del.forEach((l) => {
        if (l.importe === null) porCotizar.push(l.nombre);
        filas += `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #e6dfd6">${esc(l.nombre)}
            <div style="font-size:13px;color:#6e665c">${Number(l.cantidad) || 1} · ${esc(l.modo || "")}</div></td>
          <td style="padding:6px 0;border-bottom:1px solid #e6dfd6;text-align:right;white-space:nowrap">
            ${l.importe === null ? "Por cotizar" : pesos(l.importe)}</td></tr>`;
      });
    });

    if (!RESEND) return J({ ok: false, error: "sin RESEND_API_KEY" }, 500);

    const htmlCliente = `<div style="font-family:Georgia,serif;font-size:15px;color:#20201e;line-height:1.55;max-width:640px">
      <p style="font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#6e665c;margin:0">Sincrético · Eventos para empresas</p>
      <h1 style="font-family:Arial,sans-serif;font-size:26px;text-transform:uppercase;margin:6px 0 4px">Tu cotización</h1>
      <p style="margin:0 0 16px;color:#6e665c">${esc(c.folio)} · ${esc(c.empresa)}</p>
      <p>Hola${c.contacto ? " " + esc(c.contacto) : ""}: esto es lo que armaron en la página, con
      <b>${c.personas} personas</b> para el <b>${dia(c.fecha1)}</b>${c.hora1 ? ` a las <b>${String(c.hora1).slice(0,5)}</b>` : ""}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">${filas}
        <tr><td style="padding:12px 0 2px">Subtotal sin IVA</td><td style="padding:12px 0 2px;text-align:right">${pesos(c.subtotal)}</td></tr>
        <tr><td style="padding:2px 0">IVA</td><td style="padding:2px 0;text-align:right">${pesos(c.iva)}</td></tr>
        <tr><td style="padding:10px 0 0;border-top:2px solid #1e1a16;font-family:Arial,sans-serif;
            font-weight:bold;text-transform:uppercase">Total</td>
          <td style="padding:10px 0 0;border-top:2px solid #1e1a16;text-align:right;
            font-family:Arial,sans-serif;font-size:22px;font-weight:bold">${pesos(c.total)}</td></tr>
      </table>
      ${porCotizar.length ? `<p style="background:#f6ebd5;color:#8c6212;border-radius:9px;padding:11px 13px;margin:16px 0 0">
        <b>Esto te lo confirmamos a mano</b> y todavía no está sumado: ${porCotizar.map(esc).join(", ")}.</p>` : ""}
      <p style="background:#e4f1fa;border-radius:9px;padding:13px 15px;margin:16px 0 0">
        <b>Apartas tu fecha con un depósito del ${antPct}%: ${pesos(anticipo)}.</b><br>
        Respóndenos a este correo o escríbenos por WhatsApp y te pasamos el link de pago.</p>
      <p style="margin:16px 0 0">¿Dudas? Escríbenos al
        <a href="https://wa.me/${wa}?text=${encodeURIComponent("Hola, mi folio es " + c.folio)}">+${wa}</a>.</p>
      <p style="margin:18px 0 0;color:#6e665c;font-size:13px">Los precios son estimados y pueden ajustarse al
      confirmar disponibilidad. Sincrético · Grupo Casa Pepe.</p></div>`;

    const htmlJavi = `<div style="font-family:Georgia,serif;font-size:15px;color:#20201e;line-height:1.55">
      <p style="font-size:17px;margin:0 0 12px"><b>${esc(c.empresa)}</b> pidió una cotización · <b>${esc(c.folio)}</b></p>
      <table style="border-collapse:collapse;font-size:15px">
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Contacto</td><td>${esc(c.contacto)} · ${esc(c.email)}${c.telefono ? " · " + esc((c.lada || "") + " " + c.telefono) : ""}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Cuándo</td><td>${dia(c.fecha1)}${c.hora1 ? " · " + String(c.hora1).slice(0,5) : ""}${c.fecha2 ? ` (2ª opción: ${dia(c.fecha2)})` : ""}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Personas</td><td><b>${c.personas}</b></td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Transporte</td><td>${esc(c.modo_transporte || "—")}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b6b63">Total</td><td><b>${pesos(c.total)}</b> · anticipo ${pesos(anticipo)}</td></tr>
      </table>
      ${c.idea ? `<p style="background:#f6f3ec;border-left:4px solid #1f4d36;padding:10px 13px;margin:14px 0 0">${esc(c.idea)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px">${filas}</table>
      <p style="margin:14px 0 0;color:#6b6b63;font-size:13px">Está en el funnel, en «Solicitud».</p></div>`;

    const manda = (to: string[], subject: string, html: string, reply?: string) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Sincretico <no-reply@casapepe.mx>", to, subject, html,
          ...(reply ? { reply_to: reply } : {}),
        }),
      });

    const r1 = await manda([c.email], `Tu cotización ${c.folio} · Sincrético`, htmlCliente, "javi@casapepe.mx");
    const ok1 = r1.ok; const err = ok1 ? null : await r1.text();
    await manda(AVISO, `Nueva cotización ${c.folio} · ${c.empresa} · ${c.personas} personas`, htmlJavi, c.email);

    await fetch(`${SB}/rest/v1/corp_cotizaciones?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(ok1 ? { correo_at: new Date().toISOString() } : { correo_error: String(err).slice(0, 400) }),
    }).catch(() => {});

    if (!ok1) return J({ ok: false, error: err }, 500);
    return J({ ok: true, enviado_a: [c.email, ...AVISO] });
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
