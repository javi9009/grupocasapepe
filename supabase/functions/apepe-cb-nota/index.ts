// apepe-cb-nota — deja una NOTA en una reserva de Cloudbeds (postReservationNote).
//
// Javi, 19-oct-2026: lo que recepción apunta en la ficha —llaves, toallas,
// secadora, peticiones especiales— tiene que verse también desde Cloudbeds,
// que es donde mira todo el mundo. Esto no escribe nada más: ni tarifas, ni
// estados, ni documentos. Una nota y se acabó.
//
// POST { reservation_id, prop:"cdmx"|"puebla", texto }
// Sólo para el equipo: la llave de Cloudbeds no se presta.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = {
  cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"},
  puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"},
};
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);

  const q = await quienLlama(req);
  if(!q.equipo) return noAutorizado();

  let body:any={}; try{ body=await req.json(); }catch{}
  const rid=String(body.reservation_id||"").trim();
  const texto=String(body.texto||"").trim();
  const pk=String(body.prop||"cdmx").toLowerCase();
  if(!rid)   return J({ok:false,error:"falta la reserva"},400);
  if(!texto) return J({ok:false,error:"falta el texto"},400);

  const cfg=PROP[pk]; if(!cfg) return J({ok:false,error:"propiedad desconocida: "+pk},400);
  const key=Deno.env.get(cfg.keyEnv);
  const pid=cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  if(!key||!pid) return J({ok:false,error:"esa casa no tiene llave de Cloudbeds configurada"},500);

  const r=await fetch(`${CB}/postReservationNote`,{
    method:"POST",
    headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ propertyID:String(pid), reservationID:rid, note:texto.slice(0,900) }).toString(),
  });
  const j=await r.json().catch(()=>({success:false,message:"respuesta no JSON"}));
  return J({ ok:!!j.success, cloudbeds:j });
});
