// push-chat — aviso Web Push a los demás participantes de una conversación.
//
// Contención 27-sep-2026: hace falta sesión iniciada y ser participante de la
// conversación; el autor sale de la sesión, no del body (antes cualquiera podía
// mandar avisos a nombre de otro). Llaves VAPID: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// como secretos de la función; mientras no se roten, queda el par actual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { quienLlama, noAutorizado } from './equipo.ts'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || 'BE1A8YAVdUnW0_y7zFiURL0As5fTFkbYy2Z0A30KnOOYQI5w4MF-LLUGk5saVuscA0991BGXKiM57BHshQQdKFQ'
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '6Xle19H6n6DsFIwr460G1Y8er_Uea0nxFV7QGZt_wwo'
try{ webpush.setVapidDetails('mailto:javi@casapepe.mx', VAPID_PUBLIC, VAPID_PRIVATE) }catch(_e){ /* noop */ }

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
function json(o:unknown, st=200){ return new Response(JSON.stringify(o),{status:st,headers:{...cors,'Content-Type':'application/json'}}) }

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try{
    const q = await quienLlama(req)
    if(!q.servidor && !q.uid) return noAutorizado('Hay que iniciar sesión.')

    const body = await req.json().catch(()=>({}))
    const conv = body.conversacion_id
    const preview = String(body.preview||'Nuevo mensaje').slice(0,140)
    if(!conv) return json({error:'no conversacion_id'},400)
    const sb=createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: c } = await sb.from('chat_conversaciones').select('tipo,titulo').eq('id',conv).single()
    const tipo = c?.tipo || 'directo'
    const titulo = c?.titulo || ''
    const { data: parts } = await sb.from('chat_participantes').select('email,employee_id').eq('conversacion_id',conv)

    // El autor es quien tiene la sesión; y tiene que estar en la conversación.
    const autorEmail = q.servidor ? String(body.autor_email||'').toLowerCase() : q.email
    const soyParte = q.servidor || (parts||[]).some(p=> String(p.email||'').toLowerCase()===autorEmail)
    if(!soyParte) return noAutorizado('No estás en esa conversación.')
    const autorNombre = String(body.autor_nombre || autorEmail.split('@')[0] || 'Alguien').slice(0,60)

    const others = (parts||[]).filter(p=> String(p.email||'').toLowerCase() !== autorEmail)
    if(!others.length) return json({sent:0,reason:'no others'})
    const title = tipo==='directo' ? ('💬 '+autorNombre) : ('💬 '+autorNombre+(titulo?(' · '+titulo):''))
    const url='/m/mensajes.html?conv='+conv
    const icon='https://grupocasapepe.netlify.app/soypepe/icon-192.png'
    let sent=0, gone=0, targets=0
    for(const o of others){
      let subs:any[]=[]
      if(o.employee_id){ const r=await sb.from('push_subscriptions').select('*').eq('employee_id',o.employee_id).eq('activo',true); subs=r.data||[] }
      if(!subs.length && o.email){ const r=await sb.from('push_subscriptions').select('*').eq('email',o.email).eq('activo',true); subs=r.data||[] }
      targets+=subs.length
      for(const s of subs){
        const sub={endpoint:s.endpoint, keys:{p256dh:s.p256dh, auth:s.auth}}
        const payload=JSON.stringify({title, body:preview, icon, url, tag:'chat-'+conv})
        try{ await webpush.sendNotification(sub as any, payload); sent++ }
        catch(err:any){ const code=err&&err.statusCode; if(code===404||code===410){ try{ await sb.from('push_subscriptions').update({activo:false}).eq('id',s.id) }catch(_e){ /* noop */ } gone++ } }
      }
    }
    return json({sent,gone,targets,others:others.length})
  }catch(e){ return json({error:String(e)},500) }
})
