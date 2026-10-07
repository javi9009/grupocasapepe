// tanfos-huesped — la página que abre el huésped desde el aviso de Los Olvidados
// (correo o APePe). Se sigue llamando tanfos-huesped porque su URL ya está en
// correos que salieron y en los avisos de APePe: cambiarla los rompería.
//
// Pública a propósito (verify_jwt = false): el huésped ya se fue y no tiene
// cuenta. La llave es el token del objeto, que es aleatorio de 18 bytes y solo
// sirve para ESE objeto. No devuelve datos de la reserva ni el correo: solo la
// foto firmada y la descripción de la cosa, que ya venían en su correo.
//
// El botón del correo NO guarda nada: lleva aquí con ?r= y aquí se confirma con
// un POST. Hay clientes de correo que abren los enlaces solos para previsualizar
// y no queremos que un antivirus decida que el huésped renuncia a su cartera.
const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TZ = "America/Mexico_City";

const RESP: Record<string, { et: string; conf: string; grac: string }> = {
  voy: {
    et: "Voy a por ello",
    conf: "Te lo guardamos en recepción con tu nombre.",
    grac: "Perfecto. Te lo guardamos en recepción con tu nombre. Pregúntale por él a recepción cuando llegues.",
  },
  envio: {
    et: "Mándenmelo",
    conf: "Nos dices a qué dirección y lo dejamos listo para la mensajería que mandes.",
    grac: "Listo. Escríbenos a hola@casapepe.mx con la dirección y el servicio de mensajería que vas a mandar, y lo tenemos empaquetado y esperando.",
  },
  no: {
    et: "No me interesa",
    conf: "Lo damos por perdido y se dona.",
    grac: "Hecho. Lo donamos a la fundación con la que trabajamos. Gracias por decírnoslo.",
  },
};

const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };
const hoyTZ = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const mas = (f: string, d: number) => new Date(Date.parse(f + "T12:00:00Z") + d * 86400000).toISOString().slice(0, 10);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return t ? JSON.parse(t) : null;
}

async function fotoFirmada(path: string): Promise<string> {
  if (!path) return "";
  const r = await fetch(`${SB}/storage/v1/object/sign/lost-found/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: H, body: JSON.stringify({ expiresIn: 7 * 86400 }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.signedURL ? `${SB}/storage/v1${j.signedURL}` : "";
}

function pagina(cuerpo: string, titulo = "Casa Pepe") {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(titulo)}</title><style>
*{box-sizing:border-box}
body{margin:0;padding:28px 16px;background:#f6f3ee;color:#2c2a26;
  font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.c{max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:30px 26px}
h1{margin:0 0 14px;font-size:21px;line-height:1.3}
p{margin:0 0 14px}
img{width:100%;border-radius:14px;display:block;margin:0 0 18px}
.d{font-weight:700;font-size:17px;margin:0 0 4px}
.s{font-size:13.5px;color:#6b665e}
button,a.b{display:block;width:100%;margin:0 0 10px;padding:15px 18px;border:none;border-radius:13px;
  font:inherit;font-weight:700;font-size:15.5px;text-align:center;text-decoration:none;cursor:pointer}
.pri{background:#1d6b52;color:#fff}
.sec{background:#f0ece4;color:#2c2a26}
.ter{background:none;color:#6b665e;text-decoration:underline;font-weight:400;font-size:14px;padding:8px}
.ok{font-size:40px;margin:0 0 10px}
.pie{margin:20px 0 0;font-size:12.5px;color:#9a948a}
</style></head><body><div class="c">${cuerpo}
<p class="pie">Casa Pepe · si algo no cuadra, escríbenos a hola@casapepe.mx</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const t = (u.searchParams.get("t") || "").trim();
  if (!t) return pagina(`<h1>Enlace incompleto</h1><p>Vuelve a abrir el enlace desde el correo que te mandamos.</p>`);

  let o: Record<string, unknown> | null = null;
  try {
    const arr = await rest(
      `lf_objetos?token=eq.${encodeURIComponent(t)}&select=id,descripcion,foto_path,habitacion,estado,respuesta,property_id&limit=1`,
    ) as Array<Record<string, unknown>>;
    o = arr?.[0] ?? null;
  } catch (_e) { /* cae en el mensaje de abajo */ }
  if (!o) {
    return pagina(`<h1>No encontramos ese objeto</h1>
      <p>Puede que ya se haya entregado o que el enlace esté caducado. Escríbenos a hola@casapepe.mx y lo miramos.</p>`);
  }

  const cerrado = ["entregado", "donado", "desechado"].includes(String(o.estado));
  const r = (u.searchParams.get("r") || "").trim();

  // ---- POST: aquí sí se guarda ----
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    const elegida = String(form?.get("r") ?? r);
    const rr = RESP[elegida];
    if (!rr) return pagina(`<h1>Algo se perdió por el camino</h1><p>Vuelve a abrir el enlace del correo.</p>`);
    if (cerrado) {
      return pagina(`<p class="ok">✓</p><h1>Esto ya está cerrado</h1>
        <p>Ese objeto ya salió de recepción. Si crees que es un error, escríbenos a hola@casapepe.mx.</p>`);
    }
    const dias = await rest(`lf_config?property_id=eq.${o.property_id}&select=dias_tras_reclamar&limit=1`)
      .then((x) => Number((x as Array<{ dias_tras_reclamar: number }>)?.[0]?.dias_tras_reclamar ?? 15))
      .catch(() => 15);
    const campos: Record<string, unknown> = {
      respuesta: elegida, respuesta_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    if (elegida === "no") {
      // El huésped renuncia, pero NO se dona aquí: queda a la vista de la jefa
      // de front, que es quien decide y quien entrega. Nada se dona solo.
      campos.estado = "sin_dueno";
    } else {
      campos.estado = "reclamado";
      campos.vence_at = mas(hoyTZ(), dias);
    }
    await rest(`lf_objetos?id=eq.${o.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos) });
    await rest("lf_eventos", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ objeto_id: o.id, que: "respuesta_huesped", detalle: { respuesta: elegida }, quien_nombre: "huésped" }),
    }).catch(() => null);
    return pagina(`<p class="ok">✓</p><h1>${esc(rr.et)}</h1><p>${esc(rr.grac)}</p>`);
  }

  // ---- GET: se muestra y se pide confirmar ----
  const foto = await fotoFirmada(String(o.foto_path ?? ""));
  const ya = o.respuesta ? `<p class="s">Ya nos habías dicho «${esc(RESP[String(o.respuesta)]?.et ?? o.respuesta)}». Si cambiaste de idea, elige otra cosa.</p>` : "";
  const cab = `${foto ? `<img src="${esc(foto)}" alt="">` : ""}
    <p class="d">${esc(o.descripcion)}</p>
    <p class="s">Lo tenemos guardado en recepción${o.habitacion ? `, apareció en ${esc(o.habitacion)}` : ""}.</p>${ya}`;

  if (cerrado) {
    return pagina(`${cab}<h1>Esto ya está cerrado</h1>
      <p>Ese objeto ya salió de recepción. Si crees que es un error, escríbenos a hola@casapepe.mx.</p>`);
  }

  const rr = RESP[r];
  if (rr) {
    const otras = Object.entries(RESP).filter(([k]) => k !== r)
      .map(([k, v]) => `<a class="ter" href="?t=${encodeURIComponent(t)}&r=${k}">o mejor: ${esc(v.et.toLowerCase())}</a>`).join("");
    return pagina(`${cab}<h1>${esc(rr.et)}</h1><p>${esc(rr.conf)}</p>
      <form method="post"><input type="hidden" name="r" value="${esc(r)}">
      <button class="pri" type="submit">Sí, confirmo</button></form>${otras}`, "¿Confirmas?");
  }

  const bs = Object.entries(RESP)
    .map(([k, v], i) => `<a class="b ${i === 0 ? "pri" : "sec"}" href="?t=${encodeURIComponent(t)}&r=${k}">${esc(v.et)}</a>`)
    .join("");
  return pagina(`${cab}<h1>¿Qué hacemos con ello?</h1>${bs}`);
});
