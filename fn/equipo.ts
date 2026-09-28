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
    method: "POST", headers: { apikey: ANON || PUB || SRV, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: "{}",
  }).then((r) => r.ok ? r.json() : false).catch(() => false);
  return { servidor: false, equipo: eq === true, email: String(u.email).toLowerCase(), jwt, uid: String(u.id ?? "") };
}
export function noAutorizado(msg = "Hay que entrar con tu cuenta de colaborador.") {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status: 401, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" } });
}
