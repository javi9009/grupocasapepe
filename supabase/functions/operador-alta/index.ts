import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
// remitente de Sincrético. Mientras no exista el correo propio, sale del de Javi.
const FROM = Deno.env.get("SINCRETICO_FROM") || "Sincrético <javi@casapepe.mx>";
// a dónde contesta quien reciba el correo. Por omisión, al mismo de siempre.
const REPLY = Deno.env.get("SINCRETICO_REPLY_TO") || "javi@casapepe.mx";
const BASE = Deno.env.get("SINCRETICO_BASE_URL") || "https://grupocasapepe.netlify.app";
const AVISO = Deno.env.get("SINCRETICO_AVISO_CDMX") || "experience.cdmx@casapepe.mx";  /* avisos de experiencias, 16-oct-2026 */
/* El alta de Puebla la atiende Ale, no la recepción de CDMX.
   Javi, 20-oct-2026, al abrir la plataforma de Puebla. */
const AVISO_PUEBLA = Deno.env.get("SINCRETICO_AVISO_PUEBLA") || "experience.puebla@casapepe.mx";

const SEDES: Record<string, { nombre: string; donde: string }> = {
  cdmx:   { nombre: "Ciudad de México", donde: "de la Ciudad de México" },
  puebla: { nombre: "Puebla",           donde: "de Puebla y Cholula" },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

/* Sincretico se presenta solo. El grupo va abajo, en el pie, y en ningun otro
   sitio del correo. */
const marco = (cuerpo: string) =>
  `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B16">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#137A56;font-weight:800">Sincrético</div>
    ${cuerpo}
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #E2DCCF;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#A49B8C;font-weight:600">Una empresa de Grupo Casa Pepe</div>
  </div></body></html>`;

const boton = (liga: string, texto: string) =>
  `<p style="margin:0 0 20px"><a href="${liga}" style="display:inline-block;background:#137A56;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">${texto}</a></p>`;

/* Quien lleno el formulario de la web SI nos dio sus datos. */
function correoPedido(alias: string, liga: string) {
  return marco(`
    <h1 style="font-size:23px;margin:8px 0 10px">Hola ${esc(alias)}, ya quedó tu alta</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px">Recibimos tus datos. El siguiente paso es contarnos de tu empresa y de los tours que quieres subir. Se hace desde esta liga, sin contraseña:</p>
    ${boton(liga, "Continuar mi alta")}
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 6px">Ten a la mano, si los tienes: RFC, tu póliza de responsabilidad civil y los días y horarios de tus tours. Si te falta alguno, se puede llenar después.</p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Y recuerda: por ser operador de Sincrético te vuelves Ateneísta, con condiciones especiales en el coworking del Ateneo Turístico.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">Si no reconoces este correo, ignóralo. La liga es personal, no la compartas.</p>`);
}

/* Se dio de alta el solo, y resulta que ya teniamos su anuncio fichado. */
function correoPedidoConFicha(alias: string, liga: string, tours: number) {
  const n = tours === 1 ? "una experiencia tuya" : `${tours} experiencias tuyas`;
  return marco(`
    <h1 style="font-size:23px;margin:8px 0 10px">Hola ${esc(alias)}, ya quedó tu alta</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 14px">Recibimos tus datos. Y algo mejor: ya teníamos ${n} apuntadas de lo que publicas, así que no empiezas de cero.</p>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 16px"><b>No hemos publicado nada</b>: están en borrador, esperando a que las revises tú. Entra y dinos qué se queda, qué se corrige y qué falta.</p>
    ${boton(liga, "Ver lo que ya tenemos de ti")}
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 6px">Ten a la mano, si los tienes: RFC, tu póliza de responsabilidad civil y los días y horarios de tus tours. Si te falta alguno, se puede llenar después.</p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Y recuerda: por ser operador de Sincrético te vuelves Ateneísta, con condiciones especiales en el coworking del Ateneo Turístico.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">La liga es personal, no la compartas.</p>`);
}

/* Al que invitamos nosotros no nos pidió nada: se lo decimos así, sin fingir
   que hubo una solicitud suya. Y se le dice de donde sacamos su informacion.
   La plaza que se nombra es la suya: a un operador de Puebla no se le dice
   que vendemos experiencias de la Ciudad de México. */
function correoInvitado(alias: string, liga: string, sede: string) {
  const donde = (SEDES[sede] ?? SEDES.cdmx).donde;
  return marco(`
    <h1 style="font-size:23px;margin:8px 0 10px">${esc(alias)}, te queremos en Sincrético</h1>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 14px">No nos conoces todavía: somos Sincrético, y vendemos experiencias ${donde} desde la recepción de nuestros hoteles y con nuestros concierges.</p>
    <p style="font-size:15px;line-height:1.6;color:#3A3630;margin:0 0 14px">Vimos lo que publicas y nos gustó, así que te dejamos una ficha ya empezada con lo que aparece en tu anuncio público. <b>No hemos publicado nada</b>: está en borrador, esperando a que la revises tú.</p>
    ${boton(liga, "Ver lo que armamos")}
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 6px">Entras sin contraseña. Adentro decides qué se queda, qué se corrige y si quieres seguir. Si no te interesa, no hagas nada y aquí se acaba.</p>
    <p style="font-size:13.5px;line-height:1.6;color:#6B6459;margin:0 0 20px">Si prefieres que borremos lo que tenemos de ti, responde a este correo y lo hacemos.</p>
    <p style="font-size:12px;color:#A49B8C;line-height:1.5;margin:0">La liga es personal, no la compartas.</p>`);
}

async function enviar(to: string, asunto: string, html: string) {
  if (!RESEND) return { ok: false, error: "falta RESEND_API_KEY" };
  if (!FROM) return { ok: false, error: "falta SINCRETICO_FROM" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: asunto, html, reply_to: REPLY || undefined }),
  });
  if (!r.ok) return { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

/* Ya lo teniamos fichado?
   87 de los 92 touroperadores de la base llegaron por benchmark: su ficha ya
   existe, con sus tours en borrador, esperando a que aparezca su dueno. Si el
   que se da de alta por la web es uno de ellos, hay que engancharlo a SU ficha
   y no crearle una vacia al lado. Se empareja SOLO por correo exacto: por
   nombre parecido acabariamos ensenandole los tours de otra empresa.

   OJO CON LA SEDE: solo se engancha si la ficha que teniamos es de la MISMA
   plaza que eligio al darse de alta. Hay empresas con el mismo nombre y el
   mismo dueno en las dos ciudades -Hiking y Hiking Puebla, sin ir mas lejos-,
   y meter el alta de Puebla dentro de la ficha de CDMX seria colarle sus tours
   al tablero equivocado. Javi, 20-oct-2026. */
async function fichaQueYaTeniamos(email: string, sede: string) {
  /* entre comillas: hay correos con + y con guiones que si no rompen el or() */
  const e = encodeURIComponent(`"${email.replace(/"/g, "")}"`);
  const r = await rest(
    `tour_operadores?select=id,nombre_comercial,estado,sede&or=(email.eq.${e},email_notificaciones.eq.${e})&limit=1`,
  );
  if (!r.ok) return null;
  const op = (await r.json())[0];
  if (!op) return null;
  if (String(op.sede ?? "cdmx") !== sede) return null;   // misma empresa, otra plaza: ficha aparte
  const c = await rest(
    `op_experiencias?select=id&operador_id=eq.${op.id}&preficha_fuente=not.is.null&limit=200`,
  );
  const tours = c.ok ? (await c.json()).length : 0;
  return { id: op.id as string, nombre: op.nombre_comercial as string, tours };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const nombre = String(b.nombre ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!nombre) return json({ error: "falta el nombre" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "correo inválido" }, 400);

  /* LA PLAZA DONDE VA A VENDER. Javi, 20-oct-2026: «primero tienen que escoger
     si están en Puebla o en Ciudad de México». Las altas viejas y cualquier
     cliente que no la mande caen en cdmx, que es donde estaba todo hasta hoy. */
  const sede = SEDES[String(b.sede ?? "").trim().toLowerCase()] ? String(b.sede).trim().toLowerCase() : "cdmx";

  const origen = String(b.origen ?? "web").slice(0, 40);
  const invitado = origen === "perfil_operador" || origen === "invitacion";

  const fila = {
    nombre,
    apellidos: String(b.apellidos ?? "").trim() || null,
    alias: String(b.alias ?? "").trim() || null,
    email,
    celular: String(b.celular ?? "").trim() || null,
    cowork_interes: !!b.cowork_interes,
    sede,
    origen,
  };

  /* Si ya teniamos su ficha, el alta nace enganchada a ella: asi la contrasena
     lo mete en SU operador con sus tours, en vez de crearle uno vacio. */
  const ya = invitado ? null : await fichaQueYaTeniamos(email, sede);

  const ins = await rest("tour_operador_altas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(ya ? { ...fila, operador_id: ya.id } : fila),
  });
  if (!ins.ok) return json({ error: "no se pudo guardar", detalle: (await ins.text()).slice(0, 200) }, 500);
  const alta = (await ins.json())[0];

  const alias = (fila.alias || nombre).split(" ")[0];
  const liga = `${BASE}/alta-touroperador.html?t=${alta.token}`;
  const env = invitado
    ? await enviar(email, `${alias}, te dejamos algo listo en Sincrético`, correoInvitado(alias, liga, sede))
    : ya && ya.tours
    ? await enviar(email, `${alias}, ya teníamos tus experiencias apuntadas`, correoPedidoConFicha(alias, liga, ya.tours))
    : await enviar(email, `${alias}, continúa tu alta en Sincrético`, correoPedido(alias, liga));

  await rest(`tour_operador_altas?id=eq.${alta.id}`, {
    method: "PATCH",
    body: JSON.stringify(env.ok ? { correo_enviado_at: new Date().toISOString(), correo_error: null } : { correo_error: env.error }),
  });

  /* El aviso va a quien lleva esa plaza. */
  const aviso = sede === "puebla" ? AVISO_PUEBLA : AVISO;
  if (aviso && RESEND) {
    await enviar(aviso, invitado ? `Liga de alta mandada a: ${nombre}` : `Alta nueva de touroperador (${SEDES[sede].nombre}): ${nombre}`,
      marco(`<p>${invitado ? "Se le mandó su liga a un operador que invitamos nosotros." : "Llegó un alta desde la web."}</p><p><b>${esc(nombre)} ${esc(fila.apellidos ?? "")}</b><br>${esc(email)}<br>${esc(fila.celular ?? "sin celular")}<br>Plaza: <b>${esc(SEDES[sede].nombre)}</b><br>Coworking: ${fila.cowork_interes ? "sí le interesa" : "no"}</p><p>${ya ? `Se engancho a la ficha que ya teniamos: <b>${esc(ya.nombre)}</b>, con ${ya.tours} experiencia(s) en borrador.` : "No teniamos ficha suya: empieza de cero."}</p><p><a href="${liga}">Su liga</a></p>`));
  }

  return json({ ok: true, id: alta.id, sede, correo: env.ok, motivo: env.ok ? null : env.error,
                ya_teniamos: ya ? { nombre: ya.nombre, tours: ya.tours } : null });
});
