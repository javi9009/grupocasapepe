import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { quienLlama, permisoBase, noAutorizado } from "./equipo.ts";

// Contención 27-sep-2026: ya no hay secreto compartido (estaba publicado en
// GitHub). Quien llama tiene que ser admin de RH (is_admin_rh) con su sesión.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function j(o: unknown, s: number) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function welcomeHtml(nombre: string, email: string, password: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#2a2118;max-width:640px"><p>Hola ${nombre||''},</p><p>Ya tienes tu acceso a la <b>plataforma digital de Casa Pepe</b>.</p><div style="background:#fbf7ef;border:1px solid #e6dcc8;border-radius:12px;padding:16px;margin:14px 0"><div style="color:#b9852b;font-weight:700;text-transform:uppercase;font-size:12px">Tu acceso</div><div style="margin-top:8px;background:#fff;border:1px dashed #d9a441;border-radius:9px;padding:10px">Usuario: <b>${email}</b><br>Contraseña temporal: <b>${password}</b> (te recomendamos cambiarla al entrar)</div><div style="margin-top:10px">Portal del equipo · SoyPepe: <a href="https://grupocasapepe.netlify.app/soypepe/">grupocasapepe.netlify.app/soypepe</a><br>Dashboard (si tu rol lo incluye): <a href="https://grupocasapepe.netlify.app">grupocasapepe.netlify.app</a></div></div><p>Cualquier duda, escribe a <a href="mailto:javi@casapepe.mx">javi@casapepe.mx</a>.</p><p>Un abrazo,<br><b>Casa Pepe</b></p></div>`;
}

async function sendWelcome(nombre: string, email: string, password: string) {
  try {
    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return { ok:false, detail:'Falta RESEND_API_KEY' };
    const from = Deno.env.get('RESEND_FROM') || 'Casa Pepe <javi@casapepe.mx>';
    const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
      body: JSON.stringify({ from, to:[email], subject:'Tu acceso a la plataforma Casa Pepe', html: welcomeHtml(nombre, email, password) }) });
    const out = await r.json().catch(()=>({}));
    if (!r.ok) return { ok:false, detail: JSON.stringify(out).slice(0,200) };
    return { ok:true };
  } catch (e) { return { ok:false, detail:String(e) }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const q = await quienLlama(req);
    if (!q.equipo || !(await permisoBase(q, 'is_admin_rh'))) return noAutorizado('Solo RH puede crear accesos.');

    const { email, password, employee_id, notify = true, notify_only = false } = await req.json();
    if (!email || !password || (!employee_id && !notify_only)) return j({ error: 'Faltan datos (email, password, employee_id)' }, 400);
    if (String(password).length < 8) return j({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
    const mail = String(email).trim().toLowerCase();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession:false } }
    );

    if (notify_only) {
      const { data: lg } = await admin.from('empleado_login').select('nombre_display,nombre_completo').ilike('email', mail).maybeSingle();
      const nom = (lg && (lg.nombre_display || lg.nombre_completo)) || '';
      const sent = await sendWelcome(nom, mail, password);
      return j({ ok: sent.ok, notificado: sent.ok, detail: sent.detail || null }, sent.ok ? 200 : 502);
    }

    const { data: emp } = await admin.from('employees').select('nombre,nombre_display').eq('id', employee_id).maybeSingle();
    if (!emp) return j({ error: 'No existe ese trabajador (employee_id).' }, 404);

    const { data: yale } = await admin.from('empleado_login').select('email').eq('employee_id', employee_id).maybeSingle();
    if (yale) return j({ error: 'Este trabajador ya tiene acceso (' + (yale.email||'sin correo') + ').' }, 409);

    const { data: created, error: e1 } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true });
    if (e1) {
      const m = (e1.message||'').toLowerCase();
      if (m.includes('already') || m.includes('registered') || m.includes('exists'))
        return j({ error: 'Ese correo ya tiene una cuenta. Usa otro correo o pide al trabajador que recupere su contraseña.' }, 409);
      return j({ error: 'No se pudo crear la cuenta: ' + e1.message }, 400);
    }
    const userId = created.user.id;

    const { error: e2 } = await admin.from('empleado_login').upsert(
      { user_id: userId, employee_id, email: mail, activo: true,
        nombre_display: emp.nombre_display || null, nombre_completo: emp.nombre || null, alta_completa: true },
      { onConflict: 'user_id' },
    );
    if (e2) { await admin.auth.admin.deleteUser(userId); return j({ error: 'Cuenta creada pero falló el vínculo: ' + e2.message }, 400); }

    await admin.from('employees').update({ user_id: userId, email: mail, alta_etapa: 'activo', estatus: 'activo' }).eq('id', employee_id);
    try {
      await admin.from('notificaciones').insert({
        employee_id, user_id: userId, titulo: '¡Bienvenido a Casa Pepe! 🎉',
        cuerpo: `Hola ${emp.nombre_display || emp.nombre || ''}, tu cuenta ya está lista. Aquí verás tus horarios, tu expediente y más. ¡Bienvenido al equipo!`,
        icono: '🎉', leido: false
      });
    } catch(_) {}

    let notificado = false, notif_detail = null;
    if (notify) {
      const sent = await sendWelcome(emp.nombre_display || emp.nombre || '', mail, password);
      notificado = sent.ok; notif_detail = sent.detail || null;
    }

    return j({ ok: true, user_id: userId, email: mail, nombre_display: emp.nombre_display, notificado, notif_detail, por: q.email }, 200);
  } catch (err) {
    return j({ error: String(err) }, 500);
  }
});
