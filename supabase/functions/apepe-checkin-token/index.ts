// apepe-checkin-token — da/crea el token opaco de una reserva para armar el link/QR de
// check-in (portal de tablet de recepción y QR del huésped). No manda correo.
//
// Contención 27-sep-2026 (segunda pasada): NO es público. El token de una reserva
// abre apepe-reserva en modo huésped (correo, teléfono, historial), así que solo lo
// entrega: el equipo con sesión, o la tablet de recepción con su llave
// (cabecera x-integracion-token = privado.tokens_integracion 'tablet-recepcion',
// que la tablet recibe en su link ?k=...).
import { quienLlama, tokenIntegracion, noAutorizado } from "./equipo.ts";
const CB="https://hotels.cloudbeds.com/api/v1.2";
const SB=Deno.env.get("SUPABASE_URL")!; const SRK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE=Deno.env.get("PANEL_URL")||"https://grupocasapepe.netlify.app";
const H={apikey:SRK,Authorization:"Bearer "+SRK,"Content-Type":"application/json"};
const PROP:Record<string,{keyEnv:string;id?:string;idEnv?:string}>={cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"},puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"}};
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-integracion-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function rest(p:string,init:RequestInit={}){ const r=await fetch(SB+"/rest/v1/"+p,{...init,headers:{...H,...(init.headers||{})}}); const t=await r.text(); if(!r.ok) throw new Error(p+" "+r.status); return t?JSON.parse(t):null; }
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  const q=await quienLlama(req);
  if(!q.equipo && !(await tokenIntegracion(req,"tablet-recepcion"))) return noAutorizado("Solo recepción (tablet con su llave) o el equipo con sesión.");
  try{
    const b=await req.json().catch(()=>({} as any));
    const rid=String(b.reservation_id||"").trim(); const prop=(String(b.prop||"cdmx").toLowerCase()==="puebla")?"puebla":"cdmx";
    if(!rid) return J({ok:false,error:"falta reservation_id"},400);
    const cfgp=PROP[prop]; const key=Deno.env.get(cfgp.keyEnv); const pid=cfgp.id??Deno.env.get(cfgp.idEnv??"");
    if(!key||!pid) return J({ok:false,error:"sin credenciales"},502);
    const gr=await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`,{headers:{Authorization:"Bearer "+key}}).then(r=>r.json()).catch(()=>({}));
    const d=gr?.data??gr; if(!d||!d.reservationID) return J({ok:false,error:"no encontramos esa reserva en "+prop.toUpperCase()},404);
    const gl=d.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[]; const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{};
    const nombre=[main.guestFirstName,main.guestLastName].filter(Boolean).join(" ")||d.guestName||"";
    let token="";
    const ex=await rest(`apepe_reserva_token?reservation_id=eq.${encodeURIComponent(rid)}&select=token&limit=1`);
    if(Array.isArray(ex)&&ex[0]) token=ex[0].token; else { token=crypto.randomUUID(); await rest(`apepe_reserva_token`,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({token,reservation_id:rid,property:prop,nota:"portal recepción / QR"})}); }
    const link=`${SITE}/apepe/checkin.html?resv=${token}`;
    return J({ ok:true, token, link, nombre, prop, desde:d.startDate||"", hasta:d.endDate||"", habitacion:(d.assigned?.[0]?.roomTypeName||d.unassigned?.[0]?.roomTypeName||"") });
  }catch(e){ return J({ok:false,error:String(e)},500); }
});
