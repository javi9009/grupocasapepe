/* La lista del día, en cuanto cierra la venta.
   Javi, 1-nov-2026: «cuando esa hora llegue le mandas correo para enviarle la
   info de las reservas del día (si hay) con toda la info de la que disponemos
   de cada cliente: nombre, pax, status de pago, cel, mail, nacionalidad, hotel
   o punto de recogida. También le dejas el botón para entrar a programación».

   El corte no se calcula aquí: lo da sinc_cierres_pendientes(), que usa la
   misma sinc_cierre_at que la disponibilidad. Dos cuentas distintas para lo
   mismo es como se acaba mandando el correo cuando todavía se puede reservar.

   Va a la operadora, a los guías asignados y al buzón de la casa. El cliente
   no: a él ya le llegó su boleto, y esta lista lleva los datos de los demás.
   Se marca cierre_aviso_at al mandarlo, así que no sale dos veces por mucho
   que el cron corra cada cuarto de hora.

   EL GUÍA DE ESTA LISTA VENÍA DEL PADRÓN EQUIVOCADO. Javi, 5-nov-2026.
   Resulta que hay dos padrones de guías en la base. La pantalla de
   programación (operador.html) asigna el guía desde la vista v_mis_guias, que
   es tour_operador_usuarios filtrada; o sea que lo que sinc_salidas.guia_ids
   guarda son ids de tour_operador_usuarios, y el teléfono de esa tabla está en
   la columna `whatsapp`. Los correos, en cambio, llevaban desde el principio
   buscando esos ids en public.guias, que es otro padrón, anterior, con su
   columna `telefono`. Y los ids de una tabla no aparecen nunca en la otra: de
   las seis salidas con guía asignado del último mes, las seis traían ids que
   no existen en `guias`. La pantalla y los correos miraban tablas distintas
   porque crecieron por separado -el padrón viejo con las fichas de guía de la
   web, el nuevo con el alta de gente de touroperadora- y nadie había cruzado
   los dos caminos hasta que hizo falta un teléfono.
   Aquí el guía no lo resuelve esta función: lo arma el SQL de
   sinc_cierres_pendientes(), así que el arreglo -la cascada
   tour_operador_usuarios y luego guias- vive ahí, y ahí se añadió también el
   teléfono, que antes ni se pedía. Lo único que cambia de este lado es que ese
   teléfono se pinta: este correo es el que prepara la salida, y quien lo lee
   acaba teniendo que llamar al guía.

   «YA DEPOSITADO» ERA MENTIRA EN LOS TOURS DE DOS COBROS. Javi, 6-nov-2026.
   En un tour de dos cobros -Capital Bus, por ejemplo- el huésped nos paga por
   tarjeta sólo nuestra comisión y le liquida el resto al operador al llegar. La
   columna de pago decía «ya depositado» y el importe que ponía debajo era el de
   nuestra comisión: el operador leía que tenía su dinero cuando lo que tenía
   era un huésped al que había que cobrarle $861.20 en el punto de encuentro.
   Ahora esa columna dice las dos cosas -lo que ya entró y lo que falta por
   cobrar- y arriba va el total a cobrar en la salida, que es el número por el
   que se pregunta. Los reintentos de pago que no pasaron tampoco salen ya en la
   lista; eso se arregló en sinc_cierres_pendientes(). */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const SRK    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY");
const FROM   = "Sincretico <no-reply@casapepe.mx>";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const tenue = (t: string) => `<span style="color:#A49B8C">${esc(t)}</span>`;

/* EL TELÉFONO COMO LO ESCRIBIÓ QUIEN DIO EL ALTA, Y COMO LO PIDE wa.me.
   Javi, 5-nov-2026. Copiada tal cual de sinc-recordatorio y sinc-ya-llegue
   para que las cuatro funciones del circuito se comporten igual: si una abre
   WhatsApp y otra abre una pestaña en blanco con el mismo número, el guía
   jura que el sistema falla a ratos y nadie encuentra por qué.
   En esta base los teléfonos están guardados de formas distintas: unos con
   diez dígitos sueltos -celular mexicano sin país- y otros con once o doce, o
   sea que algunos ya traen el 52 y otros no. wa.me no perdona eso: sin código
   de país la liga se abre en blanco. Así que al de diez dígitos se le pone el
   52 delante y al que ya trae más se le respeta lo que haya -si alguien guardó
   un número de fuera de México, su prefijo es el bueno, no el nuestro-. En el
   correo se pinta además el número tal como está guardado, para quien no usa
   WhatsApp. */
function waTel(tel: unknown) {
  const d = String(tel ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  return d.length === 10 ? "52" + d : d;
}

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  let b: any = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { ok: r.ok, status: r.status, body: b };
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(f: string) {
  const p = String(f).split("-");
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  const dd = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][d.getDay()];
  return `${dd} ${+p[2]} de ${MESES[+p[1] - 1]}`;
}
const hhmm = (t: unknown) => String(t ?? "").slice(0, 5);
const pesos = (n: unknown) => "$" + Math.round(Number(n ?? 0)).toLocaleString("es-MX");

/* Lo que falta por cobrarle a este huésped en la salida. En un tour de dos
   cobros es el neto del operador; en los demás, lo que no se haya pagado. */
function porCobrar(c: any) {
  const resto = Number(c.pago_resto ?? 0);
  if (c.cobro_dividido && resto > 0) return resto;
  if (String(c.pago_estado ?? "") === "pagado") return 0;
  if (String(c.pago_estado ?? "") === "sin_cobro") return 0;
  return Number(c.pago_total ?? c.total ?? 0);
}

/* El estado de pago en dos palabras, que es lo que se pregunta en la puerta:
   ¿ya está cobrado o hay que cobrarle? Y si hay que cobrarle, cuánto. */
function pago(c: any) {
  const e = String(c.pago_estado ?? "");
  const falta = porCobrar(c);

  /* Dos cobros: lo que entró es nuestra comisión, no su dinero. Decirle «ya
     depositado» y nada más es mandarlo al punto de encuentro sin cobrar. */
  if (c.cobro_dividido && falta > 0) {
    const anticipo = e === "pagado"
      ? `anticipo pagado ${pesos(c.pago_total)}`
      : `anticipo SIN pagar ${pesos(c.pago_total)}`;
    return `<b style="color:#8C6212">cóbrale ${pesos(falta)}</b><br>${tenue(anticipo)}`;
  }

  if (e === "pagado")     return `<b style="color:#1D6B4A">ya depositado</b><br>${tenue(pesos(c.pago_total))}`;
  if (e === "sin_cobro")  return `<b>gratuito</b>`;
  if (e === "en_destino") return `<b style="color:#8C6212">cobrar en la salida</b><br>${tenue(pesos(c.pago_total))}`;
  return `<b style="color:#8C6212">pendiente de cobro</b>` + (e ? `<br>${tenue(e)}` : "");
}

function tel(c: any) {
  const crudo = String(c.telefono ?? "").trim();
  if (!crudo) return tenue("sin teléfono");
  const limpio = crudo.replace(/[^0-9+]/g, "");
  return `<a href="tel:${esc(limpio)}" style="color:#C9501A;text-decoration:none;white-space:nowrap">${esc(crudo)}</a>`;
}
function correo(c: any) {
  const e = String(c.email ?? "").trim();
  return e ? `<a href="mailto:${esc(e)}" style="color:#C9501A;text-decoration:none">${esc(e)}</a>` : tenue("sin correo");
}
function recogida(c: any) {
  const d = String(c.recogida ?? "").trim();
  if (!d) return tenue("punto de encuentro");
  const h = hhmm(c.pickup_hora);
  return esc(d) + (h ? `<br><b>${esc(h)}</b>` : "");
}

/* El guía, con su número cuando lo hay. El que no dejó teléfono sale sólo con
   su nombre: no se pone «sin teléfono» en esta línea porque aquí el guía no es
   una fila de una tabla que haya que cuadrar, es una frase corrida. */
function unGuia(g: any) {
  const nom = String(g?.nombre ?? "").trim();
  const crudo = String(g?.telefono ?? "").trim();
  const wa = waTel(crudo);
  if (!nom && !wa) return "";
  if (!wa) return esc(nom);
  return `${esc(nom || "guía")} · <a href="https://wa.me/${esc(wa)}" style="color:#C9501A;text-decoration:none;white-space:nowrap">${esc(crudo)}</a>`;
}

function tabla(cl: any[]) {
  const th = (t: string) =>
    `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #137A56;font-size:12px;` +
    `text-transform:uppercase;letter-spacing:.04em;color:#6B6459">${esc(t)}</th>`;
  const td = (v: string) =>
    `<td style="padding:7px 10px;border-bottom:1px solid #E2DCCF;vertical-align:top">${v}</td>`;
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;margin:4px 0 14px">` +
    `<thead><tr>${["Quién","Pax","Pago","Teléfono","Correo","País","Recogida"].map(th).join("")}</tr></thead><tbody>` +
    cl.map((c) =>
      `<tr>${td(`<b>${esc(c.nombre ?? "—")}</b><br>${tenue(String(c.folio ?? ""))}`)}` +
      `${td(String(c.pax ?? 1))}${td(pago(c))}${td(tel(c))}${td(correo(c))}` +
      `${td(c.pais ? esc(c.pais) : tenue("—"))}${td(recogida(c))}</tr>`
    ).join("") + `</tbody></table>`;
}

function html(s: any, base: string) {
  const cl = (s.clientes ?? []) as any[];
  const pax = cl.reduce((a, c) => a + (Number(c.pax) || 1), 0);
  const guias = ((s.guias ?? []) as any[]).map(unGuia).filter(Boolean);
  const cobrar = cl.reduce((a, c) => a + porCobrar(c), 0);
  return `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1F1B16;max-width:720px">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6B6459;margin:0 0 6px">Sincretico · Casa Pepe</p>
    <h2 style="margin:0 0 4px;font-size:21px">Cerró la venta · ${esc(s.tour ?? "")}</h2>
    <p style="margin:0 0 16px;color:#6B6459">
      Sale el <b>${esc(fechaLarga(s.fecha))}</b> a las <b>${esc(hhmm(s.hora))}</b>${s.punto ? ` desde ${esc(s.punto)}` : ""}.
      Van <b>${pax}</b> persona${pax === 1 ? "" : "s"} en ${cl.length} reserva${cl.length === 1 ? "" : "s"}.
      ${guias.length ? `Guía: <b>${guias.join(", ")}</b>.`
                     : `<b style="color:#9E3B2E">Todavía sin guía asignado.</b>`}
    </p>
    ${cobrar > 0
      ? `<p style="margin:0 0 14px;padding:10px 14px;background:#FBF3E6;border-left:3px solid #C9501A;border-radius:4px">
           <b>Por cobrar en la salida: ${pesos(cobrar)}.</b>
           Lo que va en la columna de pago es por persona.
         </p>`
      : ""}
    ${tabla(cl)}
    <p style="margin:18px 0">
      <a href="${esc(base)}/operador.html" style="background:#C9501A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Programar guía, chofer y recogidas</a>
    </p>
    <p style="color:#A49B8C;font-size:12px">
      Este aviso sale solo, en cuanto llega la hora de cierre que tiene puesta la ficha del tour.
      Desde el botón se asigna guía y chofer, se pone la hora de recogida de cada quien y se les avisa.
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Solo POST", { status: 405 });

  const pend = await sb(`rpc/sinc_cierres_pendientes`, { method: "POST", body: "{}" });
  const lista: any[] = Array.isArray(pend.body) ? pend.body : [];
  if (!lista.length) return new Response(JSON.stringify({ ok: true, salidas: 0 }), { status: 200 });

  const cfg = await sb(`sinc_config?select=clave,valor&clave=in.(url_publica,avisos_reserva_correos,sinc_mail_activo)`);
  const C: Record<string, string> = {};
  (cfg.body ?? []).forEach((x: any) => { C[x.clave] = String(x.valor ?? ""); });
  const base   = (C["url_publica"] || "https://grupocasapepe.netlify.app").replace(/\/+$/, "");
  const activo = String(C["sinc_mail_activo"] ?? "").toLowerCase() === "true";
  const casa   = String(C["avisos_reserva_correos"] ?? "").split(/[,;\s]+/).filter((e) => e.includes("@"));

  const out: any[] = [];
  for (const s of lista) {
    const para: string[] = [];
    const mete = (e: unknown) => {
      const x = String(e ?? "").trim();
      if (x.includes("@") && !para.some((y) => y.toLowerCase() === x.toLowerCase())) para.push(x);
    };
    mete(s.operador_email);
    (s.guias ?? []).forEach((g: any) => mete(g.email));
    casa.forEach(mete);

    if (!para.length) {
      /* Sin a quién mandarlo no es un fallo del envío: es una ficha sin correo.
         Se marca igual para no reintentarlo cada cuarto de hora para siempre. */
      out.push({ salida: s.salida_id, tour: s.tour, ok: true, omitido: true, detalle: "sin destinatarios" });
      await sb(`sinc_salidas?id=eq.${s.salida_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ cierre_aviso_at: new Date().toISOString() }) });
      continue;
    }
    if (!RESEND) { out.push({ salida: s.salida_id, ok: false, detalle: "sin RESEND_API_KEY" }); continue; }

    const asunto = `Cerró la venta · ${s.tour} · ${fechaLarga(s.fecha)} ${hhmm(s.hora)}`;
    let r: Response | null = null, detalle = "";
    try {
      r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: activo ? para : casa, subject: (activo ? "" : "[PRUEBA] ") + asunto, html: html(s, base) }),
      });
      if (!r.ok) detalle = (await r.text()).slice(0, 300);
    } catch (e) { detalle = String(e).slice(0, 300); }

    const ok = !!(r && r.ok);
    out.push({ salida: s.salida_id, tour: s.tour, a: para.join(", "), ok, detalle });

    if (ok) {
      await sb(`sinc_salidas?id=eq.${s.salida_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ cierre_aviso_at: new Date().toISOString() }) });
    }
    await sb(`sinc_mail_log`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tipo: "cierre_lista", salida_id: s.salida_id, modo: activo ? "real" : "prueba",
        ok, destinatarios: para.join(", "), detalle: detalle || `${(s.clientes ?? []).length} reserva(s)` }) });
  }

  return new Response(JSON.stringify({ ok: true, salidas: lista.length, envios: out }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
