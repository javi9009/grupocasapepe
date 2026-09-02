// push-notif — envía Web Push a un colaborador cuando le entra una notificación.
//
// Lo llama el trigger notificaciones_push_trg (pg_net) en cada INSERT de
// public.notificaciones, así que cubre TODO lo que ya escribe ahí: nómina,
// vacaciones, tareas, contratos, bonos, buzón de dirección, housekeeping...
// El chat tiene su propia función (push-chat) porque no pasa por esa tabla.
//
// Body: { employee_id?, user_id?, titulo, cuerpo, icono?, url?, tag? }
// Cabecera: x-cpp-secret (el mismo valor que manda el trigger).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = 'BE1A8YAVdUnW0_y7zFiURL0As5fTFkbYy2Z0A30KnOOYQI5w4MF-LLUGk5saVuscA0991BGXKiM57BHshQQdKFQ'
const VAPID_PRIVATE = '6Xle19H6n6DsFIwr460G1Y8er_Uea0nxFV7QGZt_wwo'
const SECRET = 'cpp-push-2026'
try { webpush.setVapidDetails('mailto:javi@casapepe.mx', VAPID_PUBLIC, VAPID_PRIVATE) } catch (_e) { /* noop */ }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cpp-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(o: unknown, st = 200) {
  return new Response(JSON.stringify(o), { status: st, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.headers.get('x-cpp-secret') !== SECRET) return json({ error: 'no autorizado' }, 401)

    const b = await req.json().catch(() => ({} as Record<string, unknown>))
    const employeeId = b.employee_id ? String(b.employee_id) : null
    const userId = b.user_id ? String(b.user_id) : null
    if (!employeeId && !userId) return json({ sent: 0, reason: 'sin destinatario' })

    const titulo = String(b.titulo || 'Casa Pepe').slice(0, 120)
    const cuerpo = String(b.cuerpo || '').slice(0, 300)
    const icono = String(b.icono || '')
    const url = String(b.url || '/soypepe/')
    const tag = String(b.tag || 'cpp-' + Date.now())

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Todas las suscripciones vivas de esa persona (puede tener varios teléfonos).
    const subs: Record<string, any> = {}
    if (employeeId) {
      const r = await sb.from('push_subscriptions').select('*').eq('employee_id', employeeId).eq('activo', true)
      for (const s of r.data || []) subs[s.endpoint] = s
    }
    if (userId) {
      const r = await sb.from('push_subscriptions').select('*').eq('user_id', userId).eq('activo', true)
      for (const s of r.data || []) subs[s.endpoint] = s
    }
    // Red de seguridad: si se dio de alta antes de que cargara la sesión, su
    // fila puede no traer employee_id ni user_id. La buscamos por correo.
    if (!Object.keys(subs).length) {
      let correo: string | null = null
      if (employeeId) {
        const r = await sb.from('empleado_login').select('user_id').eq('employee_id', employeeId).limit(1)
        const uid = r.data && r.data[0] && r.data[0].user_id
        if (uid) {
          const u = await sb.auth.admin.getUserById(uid)
          correo = (u.data && u.data.user && u.data.user.email) || null
        }
      } else if (userId) {
        const u = await sb.auth.admin.getUserById(userId)
        correo = (u.data && u.data.user && u.data.user.email) || null
      }
      if (correo) {
        const r = await sb.from('push_subscriptions').select('*').eq('email', correo.toLowerCase()).eq('activo', true)
        for (const s of r.data || []) subs[s.endpoint] = s
      }
    }
    const lista = Object.values(subs)
    if (!lista.length) return json({ sent: 0, reason: 'sin telefonos dados de alta' })

    // El numerito del icono: lo que le queda sin leer.
    let badge = 0
    try {
      const q = sb.from('notificaciones').select('id', { count: 'exact', head: true }).eq('leido', false)
      const r = employeeId ? await q.eq('employee_id', employeeId) : await q.eq('user_id', userId!)
      badge = r.count || 0
    } catch (_e) { /* el badge es un extra, nunca frena el aviso */ }

    const payload = JSON.stringify({
      title: (icono ? icono + ' ' : '') + titulo,
      body: cuerpo,
      icon: 'https://grupocasapepe.netlify.app/soypepe/icon-192.png',
      url,
      tag,
      badge,
    })

    let sent = 0, gone = 0
    for (const s of lista as any[]) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try {
        await webpush.sendNotification(sub as any, payload, { TTL: 86400, urgency: 'high' } as any)
        sent++
      } catch (err: any) {
        const code = err && err.statusCode
        if (code === 404 || code === 410) {
          try { await sb.from('push_subscriptions').update({ activo: false }).eq('id', s.id) } catch (_e) { /* noop */ }
          gone++
        }
      }
    }
    return json({ sent, gone, targets: lista.length, badge })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
