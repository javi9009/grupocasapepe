// equipo.ts — quién llama a una función edge.
//
// Se copia igual en cada función (Supabase despliega cada función con sus
// propios archivos). La verdad de "quién es del equipo" vive en la base:
// es_equipo_casa() y puede_delicado(area). Aquí solo se pregunta.
//
//   const q = await quienLlama(req);
//   if (!q.equipo) return noAutorizado();
//
// Pasan: service_role (llamadas entre funciones y cron) y usuarios cuya sesión
// la base reconoce como equipo. No pasan: clave anónima, clave publicable ni
// sesiones de touroperadores, voluntarios o cuentas sueltas.

const SB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PUB = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

export type Quien = { servidor: boolean; equipo: boolean; email: string; jwt: string; uid: string };

export async function quienLlama(req: Request): Promise<Quien> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const nadie: Quien = { servidor: false, equipo: false, email: "", jwt: "", uid: "" };
  if (!jwt) return nadie;
  if (jwt === SRV) return { servidor: true, equipo: true, email: "servidor", jwt, uid: "" };
  if (jwt === ANON || jwt === PUB || jwt.startsWith("sb_publishable_")) return nadie;

  const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON || PUB || SRV, Authorization: `Bearer ${jwt}` } })
    .then((r) => r.ok ? r.json() : null).catch(() => null);
  if (!u?.email) return nadie;

  const eq = await fetch(`${SB}/rest/v1/rpc/es_equipo_casa`, {
    method: "POST",
    headers: { apikey: ANON || PUB || SRV, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.ok ? r.json() : false).catch(() => false);

  return { servidor: false, equipo: eq === true, email: String(u.email).toLowerCase(), jwt, uid: String(u.id ?? "") };
}

export const CORS_EQUIPO = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function noAutorizado(msg = "Hay que entrar con tu cuenta de colaborador.") {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 401, headers: { ...CORS_EQUIPO, "Content-Type": "application/json" },
  });
}
