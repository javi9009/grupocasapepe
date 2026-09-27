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

export async function puedeDelicado(q: Quien, area: string): Promise<boolean> {
  if (q.servidor) return true;
  if (!q.jwt) return false;
  return await fetch(`${SB}/rest/v1/rpc/puede_delicado`, {
    method: "POST",
    headers: { apikey: ANON || PUB || SRV, Authorization: `Bearer ${q.jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_area: area }),
  }).then((r) => r.ok ? r.json() : false).then((v) => v === true).catch(() => false);
}

/** Cualquier función booleana de permiso de la base (is_admin_rh, es_gerente_o_mas, tiene_acceso_finanzas…), evaluada con la sesión de quien llama. */
export async function permisoBase(q: Quien, fn: string, args: Record<string, unknown> = {}): Promise<boolean> {
  if (q.servidor) return true;
  if (!q.jwt) return false;
  return await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON || PUB || SRV, Authorization: `Bearer ${q.jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  }).then((r) => r.ok ? r.json() : false).then((v) => v === true).catch(() => false);
}

/** ¿Trae la cabecera x-integracion-token con el token guardado en privado.tokens_integracion(nombre)?
 *  Se compara en la base (trae_token_integracion lee la cabecera de ESTA llamada REST). */
export async function tokenIntegracion(req: Request, nombre: string): Promise<boolean> {
  const t = req.headers.get("x-integracion-token") ?? "";
  if (!t) return false;
  return await fetch(`${SB}/rest/v1/rpc/trae_token_integracion`, {
    method: "POST",
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json", "x-integracion-token": t },
    body: JSON.stringify({ p_nombre: nombre }),
  }).then((r) => r.ok ? r.json() : false).then((v) => v === true).catch(() => false);
}

export const CORS_EQUIPO = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-integracion-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function noAutorizado(msg = "Hay que entrar con tu cuenta de colaborador.") {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 401, headers: { ...CORS_EQUIPO, "Content-Type": "application/json" },
  });
}
