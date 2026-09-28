// Quién es el que compra.
//
// Antes de pagar un tour hay que tener una cuenta, y el correo de esa cuenta
// tiene que estar confirmado: el boleto viaja con un QR y si el correo está mal
// escrito nadie entra a ningún lado. Hay dos caminos:
//
//   Google  — no pasa por aquí. Lo resuelve Supabase Auth en el navegador, y
//             el correo viene confirmado de origen.
//   Correo  — pasa por aquí. Mandamos seis cifras, y cuando las teclea le
//             devolvemos una sesión de verdad.
//
// El código NUNCA se guarda: se guarda su huella (SHA-256 del correo, el código
// y un secreto del proyecto). Quien lea la tabla no puede entrar en la cuenta
// de nadie, ni siquiera nosotros.
//
// verify_jwt=false a propósito: esto es justo lo que usa quien todavía no tiene
// sesión. Lo que lo sostiene son los límites de abajo, no una llave.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB     = Deno.env.get("SUPABASE_URL")!;
const SRK    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM   = Deno.env.get("SINCRETICO_FROM") || "Sincrético <no-reply@casapepe.mx>";
const REPLY  = Deno.env.get("SINCRETICO_REPLY_TO") || "javi@casapepe.mx";

/* Cuánto aguanta cada cosa. */
const VIVE_MIN      = 10;  // minutos que vale el código
const ESPERA_SEG    = 45;  // entre un código y el siguiente, al mismo correo
const POR_HORA      = 5;   // códigos por correo y hora
const INTENTOS_MAX  = 6;   // fallos antes de quemar el código

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
async function admin(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

/* La huella del código. El secreto del proyecto va dentro, así que una copia de
   la tabla no sirve de nada sin él. */
async function huella(email: string, codigo: string) {
  const d = new TextEncoder().encode(`${email.toLowerCase()}|${codigo}|${SRK}`);
  const h = await crypto.subtle.digest("SHA-256", d);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function correoValido(x: string) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x) && x.length <= 254;
}
/* Para enseñarle a qué buzón fue sin escribirlo entero en pantalla. */
function tapa(email: string) {
  const [u, d] = email.split("@");
  const v = u.length <= 2 ? u[0] + "·" : u.slice(0, 2) + "·".repeat(Math.min(u.length - 2, 6));
  return `${v}@${d}`;
}

const marco = (cuerpo: string) =>
  `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B16">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#137A56;font-weight:800">Sincrético</div>
    ${cuerpo}
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #E2DCCF;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#A49B8C;font-weight:600">Una empresa de Grupo Casa Pepe</div>
  </div></body></html>`;

function correoCodigo(codigo: string) {
  return marco(`
    <h1 style="font-size:23px;margin:8px 0 10px">Tu código es ${esc(codigo)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Tecléalo en la pantalla donde lo pediste para confirmar que este correo es tuyo. Hace falta porque aquí te va a llegar tu boleto con el QR, y ese QR es el que te deja entrar.</p>
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.24em;background:#fff;border:1px solid #E2DCCF;border-radius:12px;padding:18px;text-align:center;margin:0 0 18px">${esc(codigo)}</div>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Vale ${VIVE_MIN} minutos y se usa una sola vez.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">Si no lo pediste tú, no hagas nada: sin el código nadie entra, y este correo no da acceso a nada por sí solo.</p>`);
}

async function enviar(to: string, asunto: string, html: string) {
  if (!RESEND) return { ok: false, error: "falta RESEND_API_KEY" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: asunto, html, reply_to: REPLY || undefined }),
  });
  if (!r.ok) return { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 180)}` };
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const accion = String(b.accion ?? "").trim();
  const email  = String(b.email ?? "").trim().toLowerCase();
  if (!correoValido(email)) return json({ error: "Ese correo no se ve bien escrito" }, 400);

  /* ---------- mandar el código ---------- */
  if (accion === "enviar") {
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const q = await rest(
      `sinc_codigos?select=created_at&email=eq.${encodeURIComponent(email)}&created_at=gte.${desde}&order=created_at.desc`,
    );
    const previos: Array<{ created_at: string }> = q.ok ? await q.json() : [];
    if (previos.length >= POR_HORA) {
      return json({ error: "Pediste muchos códigos seguidos. Espera un rato e inténtalo otra vez." }, 429);
    }
    if (previos[0] && Date.now() - new Date(previos[0].created_at).getTime() < ESPERA_SEG * 1000) {
      return json({ error: "Acabamos de mandarte uno. Revisa tu correo antes de pedir otro." }, 429);
    }

    const codigo = String(Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000)).padStart(6, "0");
    const ins = await rest("sinc_codigos", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email,
        huella: await huella(email, codigo),
        expira_at: new Date(Date.now() + VIVE_MIN * 60_000).toISOString(),
      }),
    });
    if (!ins.ok) return json({ error: "No pudimos preparar el código. Inténtalo otra vez." }, 500);

    const m = await enviar(email, `Tu código de Sincrético: ${codigo}`, correoCodigo(codigo));
    if (!m.ok) {
      console.error("correo", m.error);
      return json({ error: "No pudimos mandarte el correo. Inténtalo en un momento." }, 502);
    }
    return json({ ok: true, enviado_a: tapa(email), vive_min: VIVE_MIN });
  }

  /* ---------- comprobarlo y devolver sesión ---------- */
  if (accion === "verificar") {
    const codigo = String(b.codigo ?? "").replace(/\D/g, "");
    if (codigo.length !== 6) return json({ error: "El código son seis cifras" }, 400);

    const q = await rest(
      `sinc_codigos?select=id,huella,expira_at,intentos,usado_at&email=eq.${encodeURIComponent(email)}` +
      `&usado_at=is.null&order=created_at.desc&limit=1`,
    );
    const fila = q.ok ? (await q.json())[0] : null;
    if (!fila) return json({ error: "Pide un código nuevo: ese ya no vale." }, 410);
    if (new Date(fila.expira_at).getTime() < Date.now()) {
      return json({ error: "Ese código ya caducó. Pide uno nuevo." }, 410);
    }
    if (Number(fila.intentos) >= INTENTOS_MAX) {
      await rest(`sinc_codigos?id=eq.${fila.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ usado_at: new Date().toISOString() }),
      });
      return json({ error: "Demasiados intentos. Pide un código nuevo." }, 429);
    }

    if (fila.huella !== await huella(email, codigo)) {
      await rest(`sinc_codigos?id=eq.${fila.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ intentos: Number(fila.intentos) + 1 }),
      });
      const quedan = INTENTOS_MAX - Number(fila.intentos) - 1;
      return json({ error: quedan > 0 ? `Ese código no es. Te quedan ${quedan} intentos.` : "Ese código no es." }, 401);
    }

    /* Acertó: se quema el código antes de nada, para que no sirva dos veces. */
    await rest(`sinc_codigos?id=eq.${fila.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ usado_at: new Date().toISOString() }),
    });

    /* La cuenta: si no existe, nace aquí y nace con el correo confirmado —
       acaba de demostrarlo tecleando el código. */
    const ex = await admin(`admin/users?filter=${encodeURIComponent(email)}`);
    const lista = ex.ok ? ((await ex.json())?.users ?? []) : [];
    const ya = lista.find((u: { email?: string }) => (u.email ?? "").toLowerCase() === email);
    if (!ya) {
      const c = await admin("admin/users", {
        method: "POST",
        body: JSON.stringify({ email, email_confirm: true, user_metadata: { origen: "sincretico" } }),
      });
      if (!c.ok) {
        console.error("alta", (await c.text()).slice(0, 200));
        return json({ error: "No pudimos abrir tu cuenta. Inténtalo otra vez." }, 500);
      }
    }

    /* El pase de entrada. El navegador lo cambia por una sesión de verdad con
       verifyOtp; aquí no viaja ninguna contraseña. */
    const g = await admin("admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", email }),
    });
    if (!g.ok) {
      console.error("generate_link", (await g.text()).slice(0, 200));
      return json({ error: "No pudimos abrirte la sesión. Inténtalo otra vez." }, 500);
    }
    const link = await g.json();
    const token_hash = link?.hashed_token ?? link?.properties?.hashed_token;
    if (!token_hash) return json({ error: "No pudimos abrirte la sesión. Inténtalo otra vez." }, 500);

    return json({ ok: true, token_hash });
  }

  return json({ error: "acción desconocida" }, 400);
});
