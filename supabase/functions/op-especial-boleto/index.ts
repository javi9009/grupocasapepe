// op-especial-boleto — manda el boleto de un servicio especial.
//
// Javi, 21-nov-2026: «este servicio una vez enviado a cocina está confirmado y
// procede como cualquier otro, con el QR -debes de solicitar el mail del
// cliente- y los botones de llegó». Y sobre cuántos: «lo que decida quien lo
// crea; si quiere uno por persona ha de meter nombre y mail».
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
// la de siempre -una vez si el boleto es del grupo, una por cada quien si el
// servicio se confirmó por persona-. Un portero, no un segundo correo que
// mañana diría otra cosa.
//
// Entrada: { dado_id }  ·  Salida: { ok, modo, mandados, fallos, enviado_a }
import { quienLlama, CORS_EQUIPO, noAutorizado } from "./equipo.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const J = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS_EQUIPO, "Content-Type": "application/json" } });
const api = (p: string) =>
  fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);

type Res = { id: string; email: string | null; nombre: string | null; ref_externa: string | null; folio: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_EQUIPO });
  try {
    const q = await quienLlama(req);
    if (!q.jwt) return noAutorizado("Hay que entrar con tu cuenta.");

    const body = await req.json().catch(() => ({}));
    const id = String(body.dado_id || "");
    if (!id) return J({ ok: false, error: "Falta el servicio" }, 400);

    const [d] = await api(`op_servicios_dados?id=eq.${id}&select=id,operador_id,salida_id,reserva_id`);
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

    /* TODAS LAS RESERVAS DE ESTE SERVICIO. Comparten la raíz del código
       -ESP-96FEBE- y, cuando van por persona, llevan su número detrás. Se
       buscan por ahí y no por reserva_id, que sólo guarda la primera. */
    const [primera] = await api(`sinc_reservas?id=eq.${d.reserva_id}&select=ref_externa,folio`);
    const raiz = String(primera?.ref_externa || "").split("-").slice(0, 2).join("-");
    let lista: Res[] = [];
    if (raiz.startsWith("ESP-")) {
      lista = await api(`sinc_reservas?salida_id=eq.${d.salida_id}` +
        `&ref_externa=like.${encodeURIComponent(raiz)}*&cancelada_at=is.null` +
        `&select=id,email,nombre,ref_externa,folio&order=ref_externa`);
    }
    if (!lista.length) {
      lista = await api(`sinc_reservas?id=eq.${d.reserva_id}&select=id,email,nombre,ref_externa,folio`);
    }

    const conCorreo = lista.filter((r) => !!r.email && String(r.email).includes("@"));
    if (!conCorreo.length) {
      return J({ ok: false, error: "Falta el correo del contacto del grupo." }, 409);
    }

    const mandados: string[] = [];
    const fallos: Array<{ a: string; por: string }> = [];
    for (const r of conCorreo) {
      try {
        const env = await fetch(`${SB}/functions/v1/sinc-boletos-enviar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SRV}`, apikey: SRV, "Content-Type": "application/json" },
          body: JSON.stringify({ reserva_id: r.id }),
        });
        const j = await env.json().catch(() => ({}));
        if (env.ok && j?.ok !== false) mandados.push(String(r.email));
        else fallos.push({ a: String(r.email), por: String(j?.error || env.status) });
      } catch (e) {
        fallos.push({ a: String(r.email), por: String((e as Error).message) });
      }
    }

    if (!mandados.length) {
      return J({ ok: false, error: "No salió ningún boleto: " + (fallos[0]?.por ?? "sin motivo") }, 500);
    }
    return J({
      ok: true,
      modo: conCorreo.length > 1 ? "persona" : "grupo",
      codigo: raiz || primera?.ref_externa || primera?.folio,
      mandados: mandados.length, enviado_a: mandados.join(", "),
      fallos,
    });
  } catch (e) {
    return J({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
