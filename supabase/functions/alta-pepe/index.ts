import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// alta-pepe — "Ya soy Pepe": un colaborador se crea su cuenta desde SoyPepe.
//
// Contención 27-sep-2026: la cuenta SOLO se enlaza a una ficha de empleado si
// el correo con el que se registra es el que RH tiene en esa ficha (y la ficha
// no tiene ya cuenta). Antes se enlazaba por el nombre que la persona elegía en
// un menú: cualquiera creaba una cuenta "de" cualquier empleado y pasaba a ser
// del equipo, con acceso a su expediente y a todo lo interno.
// Si el correo no coincide, la cuenta se crea pero sin enlace: RH la enlaza
// desde el alta de trabajador.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function tc(s: string) {
  return (s||'').replace(/_/g,' ').trim().split(/\s+/)
    .map(w => w ? w.charAt(0).toUpperCase()+w.slice(1).toLowerCase() : w).join(' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const b = await req.json();
    const picked = (b.nombre_display||'').trim();
    const nombre_completo = (b.nombre_completo||'').trim();
    const nickname = (b.nickname||'').trim();
    const email = (b.email||'').trim().toLowerCase();
    const celular = (b.celular||'').trim();
    const celular_confirmado = !!b.celular_confirmado;
    const password = b.password||'';
    const device_id = (b.device_id||'').trim();
    const employee_id_in = (b.employee_id||'').trim();
    if (!picked || !nombre_completo || !email || !password || password.length < 8)
      return json({ ok:false, error:'Faltan datos o la contraseña es muy corta (mínimo 8).' }, 400);

    const display = nickname ? tc(nickname) : picked;

    const url = Deno.env.get('SUPABASE_URL')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, svc, { auth: { persistSession:false } });

    // La ficha candidata: la que eligió (o la que resuelve el nombre), pero solo
    // se enlaza si su correo en RH es este mismo y aún no tiene cuenta.
    let candidata: { id: string; email: string | null; user_id: string | null } | null = null;
    if (employee_id_in) {
      const { data:e } = await admin.from('employees').select('id,email,user_id').eq('id', employee_id_in).maybeSingle();
      candidata = e ?? null;
    }
    if (!candidata) {
      const { data:e } = await admin.from('employees').select('id,email,user_id').eq('nombre_display', picked).limit(1).maybeSingle();
      candidata = e ?? null;
    }
    const enlaza = !!candidata && !candidata.user_id && !!candidata.email && candidata.email.trim().toLowerCase() === email;
    const employee_id = enlaza ? candidata!.id : null;

    const { data:cu, error:ce } = await admin.auth.admin.createUser({
      email, password, email_confirm:true,
      user_metadata:{ nombre_completo, nickname, nombre_display: display }
    });
    if (ce) {
      const m = (ce.message||'').toLowerCase();
      if (m.includes('already') || m.includes('registered') || m.includes('exists'))
        return json({ ok:false, error:'Ese correo ya tiene una cuenta. Inicia sesión con tu contraseña.' }, 409);
      return json({ ok:false, error:'No se pudo crear la cuenta.' }, 400);
    }
    const user_id = cu.user.id;

    const row = { user_id, employee_id, email, activo:true, nombre_display: display, nombre_completo,
      nickname: nickname||null, celular: celular||null, celular_confirmado,
      device_id: device_id||null, device_bound_at: device_id ? new Date().toISOString() : null,
      alta_completa: enlaza };
    const { error:ue } = await admin.from('empleado_login').upsert(row, { onConflict:'user_id' });
    if (ue) { await admin.auth.admin.deleteUser(user_id); return json({ ok:false, error:'No se pudo guardar tu perfil.' }, 400); }

    if (enlaza && employee_id) {
      if (display !== picked) {
        await admin.from('horarios').update({ nombre_display: display, employee_id }).eq('nombre_display', picked);
      } else {
        await admin.from('horarios').update({ employee_id }).eq('nombre_display', picked);
      }
      const upd: Record<string, unknown> = { user_id, nombre_display: display };
      if (celular) upd.telefono = celular;
      await admin.from('employees').update(upd).eq('id', employee_id);
    }

    return json({
      ok:true, employee_id, nombre_display: display, nombre: nombre_completo, enlazada: enlaza,
      aviso: enlaza ? null : 'Tu cuenta quedó creada. Como el correo no coincide con el de tu ficha, RH la enlazará; mientras tanto verás solo lo general.',
    });
  } catch (e) {
    return json({ ok:false, error:String((e as Error).message||e) }, 500);
  }
});
