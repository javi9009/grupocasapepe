// tanfos — «Los Olvidados», el lost & found. La función se sigue llamando así
// porque su URL ya está en las pantallas y en los correos que ya salieron.
//
//   accion=buscar       { prop, habitacion, fecha }  -> quién dormía ahí, con su correo
//   accion=previo       { objeto_id }                -> lo que se le mandaría, para validarlo
//   accion=avisar       { objeto_id }                -> lo manda por correo Y por APePe
//   accion=vencimientos { }                          -> lo que cumple plazo, a la jefa de front
//
// Dos reglas que no se negocian y por eso viven aquí y no en la pantalla:
//
//  1. ESTA FUNCIÓN NUNCA DONA NADA. `vencimientos` avisa y pone la lista
//     delante de una persona; donar es siempre un clic de la jefa de front.
//  2. Lo de valor alto y los documentos o el dinero no entran en el reloj de
//     los siete días: le aparecen a la jefa de front enseguida (lf_config:
//     dias_valor_alto = 1, dias_documento = 0) y `puede_donarse` sale en
//     false, así que el botón de donar no existe para ellos. Los custodia
//     front directamente, no la bolsita.
//  3. NADA SALE HACIA EL HUÉSPED SIN QUE UNA PERSONA LO LEA. Por eso hay
//     `previo` y por eso `avisar` es una llamada aparte.
import { quienLlama, noAutorizado, CORS_EQUIPO as CORS } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("TANFOS_FROM") || "Casa Pepe <hola@casapepe.mx>";
const TZ = "America/Mexico_City";

const PROPS: Record<string, { supaId: string; keyEnv: string; id?: string; idEnv?: string; casa: string }> = {
  cdmx: { supaId: "45e69775-d877-4507-a9e1-a45bd3400dc5", keyEnv: "CLOUDBEDS_API_KEY", id: "10668", casa: "Casa Pepe CDMX" },
  puebla: { supaId: "febfbef6-7fd1-4b45-84d9-13533e8dcb72", keyEnv: "CLOUDBEDS_API_KEY_PUEBLA", idEnv: "CLOUDBEDS_PROPERTY_ID_PUEBLA", casa: "Casa Pepe Puebla" },
};
const porSupaId = (id: string) => Object.keys(PROPS).find((k) => PROPS[k].supaId === id) ?? "cdmx";
const VIVAS = new Set(["confirmed", "checked_in", "checked_out", "not_confirmed", "pending"]);

const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const hoyTZ = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const mas = (f: string, d: number) => new Date(Date.parse(f + "T12:00:00Z") + d * 86400000).toISOString().slice(0, 10);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : null;
}

async function cb(key: string, ep: string, params: Record<string, string>) {
  const u = new URL(`${CB}/${ep}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${key}` } });
  return await r.json().catch(() => ({ success: false }));
}

// La foto es privada: al correo del huésped va una URL firmada, no el bucket.
// 30 días, que es más que los plazos de reclamación.
async function fotoFirmada(path: string, dias = 30): Promise<string> {
  if (!path) return "";
  const r = await fetch(`${SB}/storage/v1/object/sign/lost-found/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: dias * 86400 }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.signedURL ? `${SB}/storage/v1${j.signedURL}` : "";
}

async function bitacora(objeto_id: string, que: string, detalle: unknown, quien: string) {
  try {
    await rest("lf_eventos", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ objeto_id, que, detalle, quien_nombre: quien }),
    });
  } catch (_e) { /* la bitácora no puede tumbar la operación */ }
}

// ---------------------------------------------------------------- 1. BUSCAR
// Quién dormía en esa habitación esa noche. Se cruza por el roomID de Cloudbeds
// que ya tenemos guardado en hk_areas, no por el nombre del cuarto: los nombres
// se escriben de diez maneras y el id es uno. En un dormitorio el que identifica
// al huésped es la CAMA, no el cuarto: son seis u ocho personas distintas, y por
// eso solo las camas y las privadas tienen cloudbeds_room_id.
async function buscarHuesped(prop: string, habitacion: string, fecha: string) {
  const cfg = PROPS[prop] ?? PROPS.cdmx;
  const key = Deno.env.get(cfg.keyEnv);
  const pid = cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  if (!key || !pid) return { ok: false, error: "sin credenciales de Cloudbeds" };

  const cod = habitacion.trim();
  const areas = await rest(
    `hk_areas?property_id=eq.${cfg.supaId}&select=codigo,nombre,tipo,cloudbeds_room_id&limit=1000`,
  ) as Array<{ codigo: string; nombre: string | null; tipo: string; cloudbeds_room_id: string | null }>;
  const area = areas.find((a) =>
    String(a.codigo ?? "").toLowerCase() === cod.toLowerCase() ||
    String(a.nombre ?? "").toLowerCase() === cod.toLowerCase()
  );
  if (area && area.tipo === "dorm") {
    return { ok: true, encontrado: false, motivo: "es un dormitorio: hace falta la cama para saber de quién es" };
  }
  const roomId = area?.cloudbeds_room_id ? String(area.cloudbeds_room_id) : "";

  // Salidas de ese día y del anterior: un objeto se encuentra al limpiar, y la
  // limpieza puede ser el mismo día de la salida o la mañana siguiente.
  const params: Record<string, string> = {
    propertyID: pid, checkOutFrom: mas(fecha, -2), checkOutTo: mas(fecha, 1), pageSize: "100",
  };
  if (roomId) params.roomIDs = roomId;
  const lista = await cb(key, "getReservations", params);
  let cands = (Array.isArray(lista?.data) ? lista.data : []).filter((x: Record<string, unknown>) => VIVAS.has(String(x.status)));
  if (cands.length > 40) cands = cands.slice(0, 40);
  if (!cands.length) return { ok: true, encontrado: false, motivo: "no hay salidas de ahí en esas fechas" };

  // El detalle es el que trae el cuarto concreto y el correo.
  const detalles = await Promise.all(cands.map(async (x: Record<string, unknown>) => {
    const d = await cb(key, "getReservation", { propertyID: pid, reservationID: String(x.reservationID) });
    return { cab: x, det: (d?.data ?? d ?? {}) as Record<string, unknown> };
  }));

  const cuartosDe = (d: Record<string, unknown>) =>
    [...(Array.isArray(d.assigned) ? d.assigned : []), ...(Array.isArray(d.unassigned) ? d.unassigned : [])] as Array<Record<string, unknown>>;

  const casa = detalles.filter(({ det }) => {
    const cs = cuartosDe(det);
    if (roomId && cs.some((c) => String(c.roomID ?? "") === roomId)) return true;
    return cs.some((c) =>
      String(c.roomName ?? "").toLowerCase() === cod.toLowerCase() ||
      String(c.roomTypeName ?? "").toLowerCase() === cod.toLowerCase()
    );
  });
  const elegido = casa[0] ?? (roomId ? null : detalles[0]);
  if (!elegido) return { ok: true, encontrado: false, motivo: "ninguna reserva de esas fechas estaba ahí" };

  const d = elegido.det;
  const gl = d.guestList && typeof d.guestList === "object" ? Object.values(d.guestList) as Array<Record<string, unknown>> : [];
  const main = gl.find((g) => g.isMainGuest) || gl[0] || {};
  const nombre = [main.guestFirstName, main.guestLastName].filter(Boolean).join(" ") || String(d.guestName ?? "") || "";
  const email = String(main.guestEmail ?? d.guestEmail ?? "");

  return {
    ok: true, encontrado: true,
    reserva_id: String(d.reservationID ?? elegido.cab.reservationID ?? ""),
    nombre, email,
    llegada: String(d.startDate ?? ""), salida: String(d.endDate ?? ""),
    varias: casa.length > 1,
  };
}

// ---------------------------------------------------------------- 2. AVISAR
function correoHtml(o: Record<string, unknown>, foto: string, base: string, cfg: Record<string, unknown>) {
  const b = (r: string, txt: string, fondo: string, color: string) =>
    `<a href="${base}?t=${encodeURIComponent(String(o.token))}&r=${r}" style="display:block;margin:0 0 10px;padding:14px 18px;border-radius:12px;background:${fondo};color:${color};text-decoration:none;font-weight:700;font-size:15px;text-align:center">${txt}</a>`;
  const dias = Number(cfg.dias_sin_reclamar ?? 7);
  const nombre = String(o.huesped_nombre ?? "").split(" ")[0] || "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f3ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2c2a26">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:28px 26px">
  <p style="margin:0 0 14px;font-size:17px;line-height:1.5">${nombre ? esc(nombre) + ", c" : "C"}reemos que esto se te quedó con nosotros.</p>
  ${foto ? `<img src="${foto}" alt="" style="width:100%;max-width:460px;border-radius:14px;display:block;margin:0 0 16px">` : ""}
  <p style="margin:0 0 6px;font-size:15px"><b>${esc(o.descripcion)}</b></p>
  <p style="margin:0 0 20px;font-size:13.5px;color:#6b665e">Lo encontramos en ${esc(o.ubicacion_texto || o.habitacion || "tu habitación")}${o.encontrado_el ? ` el ${esc(o.encontrado_el)}` : ""}. Lo tenemos guardado en recepción con tu nombre.</p>
  <p style="margin:0 0 12px;font-size:15px">¿Qué hacemos con ello?</p>
  ${b("voy", "Voy a por ello — guárdenmelo", "#1d6b52", "#fff")}
  ${b("envio", "Mándenmelo — yo pago la mensajería", "#f0ece4", "#2c2a26")}
  ${b("no", "No me interesa, dadlo por perdido", "#f0ece4", "#6b665e")}
  <p style="margin:18px 0 0;font-size:12.5px;color:#6b665e;line-height:1.55">Si no nos dices nada en ${dias} días, lo donamos a <a href="${esc(cfg.url_donacion)}" style="color:#1d6b52">${esc(cfg.destino_donacion)}</a>, que trabaja con personas en situación de calle. Preferimos que llegue a alguien antes que acabar en la basura.</p>
  <p style="margin:14px 0 0;font-size:12.5px;color:#9a948a">${esc(cfg.casa)}</p>
</div></body></html>`;
}

const ASUNTO = "¿Esto es tuyo? Se te quedó en Casa Pepe";

// Un solo sitio arma el aviso, para que lo que se valida en pantalla y lo que
// sale de verdad sean lo mismo. Si esto estuviera duplicado, el día que alguien
// cambie el texto la pantalla seguiría mostrando el viejo.
async function contenido(objeto_id: string) {
  const arr = await rest(`v_lf_objetos?id=eq.${objeto_id}&select=*&limit=1`) as Array<Record<string, unknown>>;
  const o = arr?.[0];
  if (!o) return null;
  const prop = porSupaId(String(o.property_id));
  const foto = await fotoFirmada(String(o.foto_path ?? ""));
  const html = correoHtml(o, foto, `${SB}/functions/v1/tanfos-huesped`, { ...o, casa: PROPS[prop].casa });
  return { o, html, foto, dias: Number(o.dias_sin_reclamar ?? 7) };
}

// Lo que se le va a mandar, antes de mandarlo. Nada sale sin que una persona
// lo lea: Javi lo pidió así y es lo correcto, porque el correo lleva la foto de
// algo que puede ser de otro huésped.
async function previo(objeto_id: string) {
  const c = await contenido(objeto_id);
  if (!c) return { ok: false, error: "no existe ese objeto" };
  return {
    ok: true, asunto: ASUNTO, html: c.html, dias: c.dias,
    descripcion: c.o.descripcion ?? "",
    canales: {
      correo: RESEND ? (String(c.o.huesped_email ?? "") || null) : null,
      apepe: !!String(c.o.reserva_id ?? ""),
    },
  };
}

async function avisar(objeto_id: string, quien: string) {
  const c = await contenido(objeto_id);
  if (!c) return { ok: false, error: "no existe ese objeto" };
  const o = c.o;

  // Los dos canales van por separado: que falle uno no tumba el otro. Un correo
  // rebotado no debe dejar al huésped sin el aviso de su APePe.
  let correo: string | null = null, apepe = false;
  const fallos: string[] = [];

  if (RESEND && o.huesped_email) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [String(o.huesped_email)], subject: ASUNTO, html: c.html }),
    });
    const rj = await r.json().catch(() => ({}));
    if (r.ok) correo = String(o.huesped_email);
    else fallos.push(`correo: Resend ${r.status} ${JSON.stringify(rj).slice(0, 140)}`);
  } else if (!o.huesped_email) fallos.push("no tiene correo en la reserva");
  else fallos.push("falta RESEND_API_KEY");

  if (o.reserva_id) {
    const a = await rest("rpc/lf_avisar_apepe", { method: "POST", body: JSON.stringify({ p_objeto: objeto_id }) })
      .catch((e) => ({ ok: false, error: String(e) })) as Record<string, unknown>;
    if (a?.ok) apepe = true; else fallos.push(`APePe: ${a?.error ?? "no se pudo"}`);
  } else fallos.push("sin reserva ligada: por APePe no se puede");

  if (!correo && !apepe) return { ok: false, error: fallos.join(" · ") };

  // El reloj de los siete días empieza a contar cuando se avisa, no cuando se
  // encontró: no es justo gastarle días al huésped mientras nadie le escribía.
  await rest(`lf_objetos?id=eq.${objeto_id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      estado: "avisado", aviso_at: new Date().toISOString(),
      vence_at: mas(hoyTZ(), c.dias), updated_at: new Date().toISOString(),
    }),
  });
  await bitacora(objeto_id, "avisado", { correo, apepe, fallos }, quien);
  return { ok: true, correo, apepe, fallos };
}

// ---------------------------------------------------- 3. VENCIMIENTOS
// El trabajo de verdad lo hace public.lf_vencimientos(), que es quien corre en
// el cron de las 9 de la mañana: así no hace falta meter la llave de servidor
// en el texto de un cron job. Aquí queda el botón para dispararlo a mano.
// NO DONA: cuenta lo que cumple plazo, lo apunta en la bitácora y se lo pone
// delante a la jefa de front. Donar es siempre un clic de una persona.
async function vencimientos() {
  const r = await rest("rpc/lf_vencimientos", { method: "POST", body: "{}" });
  return { ok: true, propiedades: r, nota: "esta función nunca dona: solo avisa" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = await quienLlama(req);
  if (!q.equipo) return noAutorizado();
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* el cron llama sin cuerpo */ }
  const accion = String(b.accion ?? "vencimientos");
  const quien = q.email || "equipo";
  try {
    if (accion === "buscar") {
      const prop = String(b.prop ?? "cdmx").toLowerCase() === "puebla" ? "puebla" : "cdmx";
      const hab = String(b.habitacion ?? "").trim();
      if (!hab) return J({ ok: false, error: "falta la habitación" }, 400);
      return J(await buscarHuesped(prop, hab, String(b.fecha ?? hoyTZ())));
    }
    if (accion === "previo" || accion === "avisar") {
      const id = String(b.objeto_id ?? "");
      if (!id) return J({ ok: false, error: "falta objeto_id" }, 400);
      return J(accion === "previo" ? await previo(id) : await avisar(id, quien));
    }
    if (accion === "vencimientos") return J(await vencimientos());
    return J({ ok: false, error: "acción desconocida" }, 400);
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
