// op-especial-boleto — manda el boleto del grupo de un servicio especial.
//
// Javi, 21-nov-2026: «este servicio una vez enviado a cocina está confirmado y
// procede como cualquier otro, con el QR -debes de solicitar el mail del
// cliente- y los botones de llegó».
//
// POR QUÉ ESTA PUERTA Y NO UNA FUNCIÓN NUEVA. El correo del boleto -con el QR
// dibujado dentro, el idioma de la reserva y el código del grupo- ya existe y
// está bien hecho: sinc-boletos-enviar. Lo que no dejaba pasar al
// touroperador era el portero: esa función sólo admite la service role o una
// sesión del equipo de la casa, y con razón, porque manda correos a huéspedes
// desde nuestro dominio.
//
// Así que esto no reimplementa el correo: comprueba que quien llama es el
// equipo o el touroperador DUEÑO de ese servicio, y recién entonces llama a
// la de siempre con la service role. Un portero, no un segundo correo que
// mañana diría otra cosa.
//
// Entrada: { dado_id }  ·  Salida: { ok, codigo, boletos, enviado_a }
import { quienLlama, CORS_EQUIPO, noAutorizado } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS_EQUIPO, "Content-Type": "application/json" } });
const api = (p: string) =>
  fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_EQUIPO });
  try {
    const q = await quienLlama(req);
    if (!q.jwt) return noAutorizado("Hay que entrar con tu cuenta.");

    const body = await req.json().catch(() => ({}));
    const id = String(body.dado_id || "");
    if (!id) return J({ ok: false, error: "Falta el servicio" }, 400);

    const [d] = await api(`op_servicios_dados?id=eq.${id}&select=id,operador_id,reserva_id`);
    if (!d) return J({ ok: false, error: "No encuentro ese servicio" }, 404);

    // Del equipo, o del touroperador dueño. Por correo: tour_operador_usuarios
    // no tiene user_id, se llave por email.
    if (!q.equipo) {
      const mio = await api(`tour_operador_usuarios?operador_id=eq.${d.operador_id}` +
        `&email=ilike.${encodeURIComponent(q.email)}&select=operador_id&limit=1`);
      if (!mio.length) return J({ ok: false, error: "Este servicio no es tuyo." }, 403);
    }

    if (!d.reserva_id) {
      return J({ ok: false, error: "Este servicio todavía no está confirmado." }, 409);
    }
    const [r] = await api(`sinc_reservas?id=eq.${d.reserva_id}&select=email,ref_externa,folio,pax`);
    if (!r?.email) {
      return J({ ok: false, error: "Falta el correo del contacto del grupo." }, 409);
    }

    const env = await fetch(`${SB}/functions/v1/sinc-boletos-enviar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SRV}`, apikey: SRV, "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: d.reserva_id }),
    });
    const j = await env.json().catch(() => ({}));
    if (!env.ok || j?.ok === false) {
      return J({ ok: false, error: j?.error || "No se pudo mandar el boleto." }, 500);
    }

    return J({
      ok: true, enviado_a: r.email, pax: r.pax,
      codigo: j.codigo_grupo || r.ref_externa || r.folio,
      boletos: j.boletos ?? null,
    });
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
