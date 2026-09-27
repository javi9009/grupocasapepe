import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Webhook Stripe del Ateneo.
//  - Pago de función (cine/teatro): marca la reserva pagada y emite boletos + QR + correo.
//  - Pago de plan de coworking (metadata.tipo='plan'): marca pagada la solicitud de ateneo_reservas.
//
// Contención 27-sep-2026: si falta STRIPE_WEBHOOK_SECRET la función NO procesa
// nada (antes aceptaba cualquier JSON sin firma y marcaba reservas como pagadas).
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json'}});
async function verifyStripe(raw:string,sigHeader:string,secret:string){
  try{const parts:Record<string,string>={};sigHeader.split(',').forEach(kv=>{const i=kv.indexOf('=');if(i>0)parts[kv.slice(0,i).trim()]=kv.slice(i+1).trim();});if(!parts.t||!parts.v1)return false;
    // Tolerancia de 5 min contra repetición de eventos viejos.
    const t=Number(parts.t); if(!t||Math.abs(Date.now()/1000-t)>300) return false;
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(parts.t+'.'+raw));
    const hex=[...new Uint8Array(mac)].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hex.length!==parts.v1.length) return false;
    let d=0; for(let i=0;i<hex.length;i++) d|=hex.charCodeAt(i)^parts.v1.charCodeAt(i); return d===0;}catch(_){return false;}
}
Deno.serve(async (req)=>{
  if(req.method!=='POST')return json({ok:false,error:'method'},405);
  const raw=await req.text(); const sig=req.headers.get('stripe-signature')||''; const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if(!secret) return json({ok:false,error:'webhook sin STRIPE_WEBHOOK_SECRET configurado'},503);
  if(!(await verifyStripe(raw,sig,secret))) return json({ok:false,error:'bad signature'},400);
  let evt:any={}; try{evt=JSON.parse(raw);}catch(_){return json({ok:false,error:'bad json'},400);}
  const type=String(evt.type||'');
  if(type!=='checkout.session.completed' && type!=='checkout.session.async_payment_succeeded') return json({ok:true,ignored:type});
  const s=(evt.data&&evt.data.object)||{};
  if(s.payment_status && s.payment_status!=='paid') return json({ok:true,pending:s.payment_status});
  const meta=s.metadata||{};
  const rid=s.client_reference_id||meta.reserva_id||null;
  const email=(s.customer_details&&s.customer_details.email)||s.customer_email||null;
  const URL=Deno.env.get('SUPABASE_URL')!, KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(URL,KEY,{auth:{persistSession:false}});

  // --- plan de coworking ---
  if(String(meta.tipo||'')==='plan'){
    if(!rid) return json({ok:true,note:'plan sin reserva',plan:meta.plan_slug||null});
    const importe=(typeof s.amount_total==='number')?(s.amount_total/100):null;
    const patch:Record<string,unknown>={estado:'confirmado',estado_pago:'pagado'};
    if(importe!=null){ patch.apartado=importe; }
    const {error:ue}=await admin.from('ateneo_reservas').update(patch).eq('id',rid);
    if(ue)return json({ok:false,error:'update plan: '+ue.message},500);
    return json({ok:true,plan:meta.plan_slug||null,reserva:rid});
  }

  // --- función de cine / teatro ---
  let reserva:any=null;
  if(rid){ const {data}=await admin.from('ateneo_cine_reservas').select('*').eq('id',rid).maybeSingle(); reserva=data; }
  if(!reserva && email){ const {data}=await admin.from('ateneo_cine_reservas').select('*').ilike('email',email).eq('estado_pago','pendiente').order('created_at',{ascending:false}).limit(1); reserva=(data&&data[0])||null; }
  if(!reserva) return json({ok:true,note:'reserva no encontrada',rid,email});
  if(reserva.estado_pago!=='pagado'){ const {error:ue}=await admin.from('ateneo_cine_reservas').update({estado:'pagado',estado_pago:'pagado'}).eq('id',reserva.id); if(ue)return json({ok:false,error:'update: '+ue.message},500); }
  // Emitir boletos + correo
  let emit=null;
  try{ const r=await fetch(URL+'/functions/v1/cine-emitir-boletos',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY},body:JSON.stringify({reserva_id:reserva.id})}); emit=await r.json().catch(()=>null); }catch(e){ emit={error:String(e)}; }
  return json({ok:true,reserva:reserva.id,emit});
});
