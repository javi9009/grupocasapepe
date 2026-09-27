// poderes-docusign — envía por DocuSign cartas poder (gob_poderes), actas (gob_minutas) y títulos (gob_titulos) en cola.
//
// Contención 27-sep-2026: antes, sin DS_TRIGGER_SECRET configurado, cualquiera
// podía disparar envíos de DocuSign. Ahora hace falta UNA de estas tres cosas:
//   · service_role (cron / otras funciones)
//   · cabecera x-trigger igual a DS_TRIGGER_SECRET (si está configurado)
//   · sesión iniciada de cualquier cuenta del grupo (socios incluidos: son quienes
//     generan su carta poder desde mi-casa-pepe / socios-gobierno)
// Solo procesa lo que está en cola; no recibe datos del cliente.
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { quienLlama, noAutorizado } from "./equipo.ts";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const env = (k: string) => Deno.env.get(k) || "";
function pemToPkcs8(pem: string): ArrayBuffer { const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, ""); const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
async function dsToken(): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(env("DS_PRIVATE_KEY_PKCS8")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await create({ alg: "RS256", typ: "JWT" }, { iss: env("DS_INTEGRATION_KEY"), sub: env("DS_USER_ID"), aud: env("DS_OAUTH_BASE"), iat: now, exp: now + 3600, scope: "signature impersonation" }, key);
  const r = await fetch(`https://${env("DS_OAUTH_BASE")}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}` });
  const j = await r.json(); if (!j.access_token) throw new Error("DocuSign OAuth: " + JSON.stringify(j)); return j.access_token;
}
function b64html(s: string): string { return btoa(unescape(encodeURIComponent(s))); }
async function crearSobre(token: string, opts: { subject: string; docName: string; docHtml: string; signers: { name: string; email: string; anchor: string; order: number }[] }) {
  const signers = opts.signers.filter((s) => s.email && s.email.includes("@")).map((s, i) => ({ email: s.email, name: s.name, recipientId: String(i + 1), routingOrder: String(s.order || i + 1), tabs: { signHereTabs: [{ anchorString: s.anchor, anchorUnits: "pixels", anchorXOffset: "140", anchorYOffset: "-6", anchorIgnoreIfNotPresent: "true" }] } }));
  const env_def = { emailSubject: opts.subject, documents: [{ documentBase64: b64html(opts.docHtml), name: opts.docName, fileExtension: "html", documentId: "1" }], recipients: { signers }, status: "sent" };
  const r = await fetch(`${env("DS_BASE_URI")}/v2.1/accounts/${env("DS_ACCOUNT_ID")}/envelopes`, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(env_def) });
  const j = await r.json(); if (!r.ok) throw new Error("DocuSign envelope: " + JSON.stringify(j)); return j.envelopeId as string;
}
async function sbFetch(path: string, init: RequestInit = {}) { const url = env("SUPABASE_URL") + "/rest/v1/" + path; const h = Object.assign({ apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"), "Content-Type": "application/json" }, init.headers || {}); return fetch(url, { ...init, headers: h }); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const secret = env("DS_TRIGGER_SECRET");
  const porSecreto = !!secret && req.headers.get("x-trigger") === secret;
  if (!porSecreto) {
    const q = await quienLlama(req);
    if (!q.servidor && !q.uid) return noAutorizado("Hay que iniciar sesión.");
  }
  try {
    const token = await dsToken();
    const out: any = { poderes: [], minutas: [], titulos: [] };
    const pRes = await sbFetch("gob_poderes?select=*&docusign_status=eq.en_cola"); const poderes = await pRes.json();
    for (const p of (Array.isArray(poderes) ? poderes : [])) {
      try {
        const signers = [ { name: p.otorgante_nombre || "Otorgante", email: p.otorgante_email, anchor: "Firma del otorgante:", order: 1 }, { name: p.apoderado_nombre || "Apoderado", email: p.apoderado_email, anchor: "Apoderado:", order: 2 }, { name: p.testigo1_nombre || "Testigo 1", email: p.testigo1_email, anchor: "Testigo 1:", order: 3 }, { name: p.testigo2_nombre || "Testigo 2", email: p.testigo2_email, anchor: "Testigo 2:", order: 4 } ];
        const envId = await crearSobre(token, { subject: "Carta poder para asamblea — firma requerida", docName: "Carta poder", docHtml: p.doc_html || "<html><body>Carta poder</body></html>", signers });
        await sbFetch("gob_poderes?id=eq." + p.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_envelope_id: envId, docusign_status: "sent", enviar_ok: false, estado: "en_firma", updated_at: new Date().toISOString() }) });
        out.poderes.push({ id: p.id, envelopeId: envId, ok: true });
      } catch (e) { await sbFetch("gob_poderes?id=eq." + p.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_status: "error", updated_at: new Date().toISOString() }) }); out.poderes.push({ id: p.id, ok: false, error: String(e) }); }
    }
    const mRes = await sbFetch("gob_minutas?select=*&docusign_status=eq.en_cola"); const minutas = await mRes.json();
    for (const m of (Array.isArray(minutas) ? minutas : [])) {
      try {
        const fs = Array.isArray(m.firmantes) ? m.firmantes : [];
        const src = (m.textos && (m.textos.acta_final || m.textos.acta_generada_md || m.textos.convocatoria_md)) || "";
        const docHtml = src ? "<html><body><pre style='white-space:pre-wrap;font-family:Georgia,serif'>" + String(src).replace(/[<>&]/g, (c: string) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)) + "</pre></body></html>" : (m.doc_html || "<html><body>Acta</body></html>");
        const signers = fs.map((f: any, i: number) => ({ name: f.nombre || ("Firmante " + (i + 1)), email: f.email, anchor: f.nombre || "", order: i + 1 }));
        const envId = await crearSobre(token, { subject: "Acta de asamblea — firma requerida: " + (m.titulo || ""), docName: "Acta", docHtml, signers });
        await sbFetch("gob_minutas?id=eq." + m.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_envelope_id: envId, docusign_status: "sent", enviar_ok: false, updated_at: new Date().toISOString() }) });
        out.minutas.push({ id: m.id, envelopeId: envId, ok: true });
      } catch (e) { await sbFetch("gob_minutas?id=eq." + m.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_status: "error", updated_at: new Date().toISOString() }) }); out.minutas.push({ id: m.id, ok: false, error: String(e) }); }
    }
    const tRes = await sbFetch("gob_titulos?select=*&docusign_status=eq.en_cola"); const titulos = await tRes.json();
    for (const t of (Array.isArray(titulos) ? titulos : [])) {
      try {
        const fs = Array.isArray(t.firmantes) ? t.firmantes : [];
        const signers = fs.map((f: any, i: number) => ({ name: f.nombre || ("Administrador " + (i + 1)), email: f.email, anchor: f.nombre || "", order: i + 1 }));
        const envId = await crearSobre(token, { subject: "Título de acciones — firma de administrador: " + (t.titular_nombre || ""), docName: "Titulo", docHtml: t.doc_html || "<html><body>Título</body></html>", signers });
        await sbFetch("gob_titulos?id=eq." + t.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_envelope_id: envId, docusign_status: "sent", enviar_ok: false, estado: "en_firma", updated_at: new Date().toISOString() }) });
        out.titulos.push({ id: t.id, envelopeId: envId, ok: true });
      } catch (e) { await sbFetch("gob_titulos?id=eq." + t.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ docusign_status: "error", updated_at: new Date().toISOString() }) }); out.titulos.push({ id: t.id, ok: false, error: String(e) }); }
    }
    return new Response(JSON.stringify({ ok: true, ...out }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }); }
});
