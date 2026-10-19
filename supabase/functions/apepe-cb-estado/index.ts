// apepe-cb-estado — marca una reserva como hospedada o salida en Cloudbeds.
//
// Javi, 19-oct-2026: «cuando le doy a guardar entrega es hacer check-in (…)
// le das y ya tendría que ir a Cloudbeds y cambiar el estado a check-in».
//
// En Cloudbeds el check-in NO es un endpoint propio: es putReservation con
// status=checked_in, por PUT. Buscar postCheckIn o putReservationStatus no da
// nada porque no existen.
//
// POST { reservation_id, prop:"cdmx"|"puebla", estado:"checked_in"|"checked_out" }
// Sólo para el equipo. Y sólo esos dos estados: cancelar o cambiar fechas de
// una reserva desde aquí sería vender o devolver inventario sin querer.
import { quienLlama, noAutorizado } from "./equipo.ts";

const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = {
  cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"},
  puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"},
};
const OK = new Set(["checked_in","checked_out"]);
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);

  const q = await quienLlama(req);
  if(!q.equipo) return noAutorizado();

  let body:any={}; try{ body=await req.json(); }catch{}
  const rid=String(body.reservation_id||"").trim();
  const estado=String(body.estado||"checked_in").trim();
  const pk=String(body.prop||"cdmx").toLowerCase();
  if(!rid) return J({ok:false,error:"falta la reserva"},400);
  if(!OK.has(estado)) return J({ok:false,error:"estado no permitido: "+estado},400);

  const cfg=PROP[pk]; if(!cfg) return J({ok:false,error:"propiedad desconocida: "+pk},400);
  const key=Deno.env.get(cfg.keyEnv);
  const pid=cfg.id ?? Deno.env.get(cfg.idEnv ?? "");
  if(!key||!pid) return J({ok:false,error:"esa casa no tiene llave de Cloudbeds configurada"},500);

  const r=await fetch(`${CB}/putReservation`,{
    method:"PUT",
    headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ propertyID:String(pid), reservationID:rid, status:estado }).toString(),
  });
  const j=await r.json().catch(()=>({success:false,message:"respuesta no JSON"}));

  /* Y que quede sellado en casa: la hora de llegada es dato nuestro, no del
     PMS, y de ella cuelga el funnel. Si Cloudbeds dijo que no, no se sella. */
  let sello=null;
  if(j && j.success && estado==="checked_in"){
    try{
      sello=await fetch(`${SB_URL}/rest/v1/rpc/apepe_llegada_marcar`,{
        method:"POST",
        headers:{ apikey:SRV, Authorization:`Bearer ${SRV}`, "Content-Type":"application/json" },
        body:JSON.stringify({ p_reserva:rid, p_por:q.email||"recepción" }),
      }).then(x=>x.json()).catch(()=>null);
    }catch(_){}
  }
  return J({ ok:!!j.success, estado, cloudbeds:j, sello });
});
