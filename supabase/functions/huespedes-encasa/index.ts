// huespedes-encasa (v2): lista ligera de huéspedes en casa HOY (Cloudbeds)
// con cache stale-while-revalidate en public.huespedes_cache (igual patrón que reporte-dia).
//
// Contención 27-sep-2026: hace falta sesión iniciada (cualquier cuenta del
// grupo, voluntarios incluidos: es la bitácora de SoyPepe). Sin sesión, nada.
import { quienLlama, noAutorizado } from "./equipo.ts";

const BASE=Deno.env.get('CLOUDBEDS_BASE_URL')??'https://hotels.cloudbeds.com/api/v1.2';
const TZ='America/Mexico_City';
const CACHE_TTL_SEG=15*60;
const VALID=new Set(['confirmed','checked_in','checked_out']);
const PROP:Record<string,{keyEnv:string;id?:string;idEnv?:string}>={
  '45e69775-d877-4507-a9e1-a45bd3400dc5':{keyEnv:'CLOUDBEDS_API_KEY',id:'10668'},
  'febfbef6-7fd1-4b45-84d9-13533e8dcb72':{keyEnv:'CLOUDBEDS_API_KEY_PUEBLA',idEnv:'CLOUDBEDS_PROPERTY_ID_PUEBLA'},
};
const DEF='45e69775-d877-4507-a9e1-a45bd3400dc5';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const J=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
function hoyTZ(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function addD(iso:string,n:number){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function sf(v:unknown){return String(v??'').slice(0,10);}
function supaIdDe(prop:string|undefined){return (prop&&PROP[prop])?prop:DEF;}

const SUPA_URL=Deno.env.get('SUPABASE_URL')??'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';

async function leerCache(supaId:string,fecha:string):Promise<{payload:Record<string,unknown>;updated_at:string}|null>{
  if(!SUPA_URL||!SERVICE_KEY)return null;
  try{
    const url=`${SUPA_URL}/rest/v1/huespedes_cache?property_id=eq.${supaId}&fecha=eq.${fecha}&select=payload,updated_at`;
    const r=await fetch(url,{headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});
    if(!r.ok)return null;
    const rows=(await r.json()) as Array<{payload:Record<string,unknown>;updated_at:string}>;
    if(!rows.length)return null;
    return rows[0];
  }catch(_e){return null;}
}
async function escribirCache(supaId:string,fecha:string,payload:Record<string,unknown>):Promise<void>{
  if(!SUPA_URL||!SERVICE_KEY)return;
  try{
    await fetch(`${SUPA_URL}/rest/v1/huespedes_cache?on_conflict=property_id,fecha`,{
      method:'POST',
      headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({property_id:supaId,fecha,payload,updated_at:new Date().toISOString()}),
    });
  }catch(_e){/*noop*/}
}

async function calcular(key:string,pid:string,hoy:string):Promise<Record<string,unknown>>{
  const from=addD(hoy,-30), to=addD(hoy,1);
  const out:Array<{nombre:string}>=[]; const seen=new Set<string>();
  let page=1;
  while(page<=50){
    const url=new URL(`${BASE}/getReservations`);
    url.searchParams.set('propertyID',pid);
    url.searchParams.set('checkInFrom',from); url.searchParams.set('checkInTo',to);
    url.searchParams.set('pageSize','100'); url.searchParams.set('pageNumber',String(page));
    const r=await fetch(url.toString(),{headers:{Authorization:`Bearer ${key}`}});
    const j=await r.json().catch(()=>({success:false}));
    if(!j.success)break;
    const data=(j.data as Array<Record<string,unknown>>)??[];
    for(const x of data){
      const st=String(x.status??'').toLowerCase(); if(!VALID.has(st))continue;
      const ci=sf(x.startDate), co=sf(x.endDate);
      if(!(ci<=hoy&&hoy<co))continue; // en casa esta noche
      const armado=(`${x.guestFirstName??''} ${x.guestLastName??''}`).trim();
      const nombre=(String(x.guestName??'').trim()) || armado || 'Huésped';
      const k=nombre.toLowerCase(); if(k&&!seen.has(k)){seen.add(k);out.push({nombre});}
    }
    if(data.length<100)break; page++;
  }
  out.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  return {ok:true,fecha:hoy,huespedes:out};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  const q=await quienLlama(req);
  if(!q.servidor && !q.uid) return noAutorizado('Hay que iniciar sesión.');
  try{
    let prop:string|undefined; let force=false;
    try{const b=await req.json();if(b&&typeof b.prop==='string')prop=b.prop;if(b&&(b.force===true||b.refresh===true))force=true;}catch(_e){/*noop*/}
    try{const u=new URL(req.url);if(u.searchParams.has('force')||u.searchParams.has('refresh'))force=true;}catch(_e){/*noop*/}
    // Forzar la recarga contra Cloudbeds solo desde el equipo (o el cron).
    if(force && !q.equipo) force=false;

    const supaId=supaIdDe(prop);
    const cfg=PROP[supaId];
    const key=Deno.env.get(cfg.keyEnv);
    let pid=cfg.id; if(!pid&&cfg.idEnv)pid=Deno.env.get(cfg.idEnv)??undefined;
    const hoy=hoyTZ();
    if(!key||!pid)return J({ok:false,no_conectado:true,huespedes:[]});

    if(!force){
      const cache=await leerCache(supaId,hoy);
      if(cache){
        const edadSeg=Math.round((Date.now()-new Date(cache.updated_at).getTime())/1000);
        if(edadSeg<CACHE_TTL_SEG){
          return J({...cache.payload,cached:true,stale:false,edad_seg:edadSeg,updated_at:cache.updated_at});
        }
        try{
          // @ts-ignore EdgeRuntime existe en Supabase Edge
          EdgeRuntime.waitUntil((async()=>{const fresco=await calcular(key,pid!,hoy);await escribirCache(supaId,hoy,fresco);})());
        }catch(_e){/*noop*/}
        return J({...cache.payload,cached:true,stale:true,edad_seg:edadSeg,updated_at:cache.updated_at});
      }
    }

    const fresco=await calcular(key,pid,hoy);
    await escribirCache(supaId,hoy,fresco);
    return J({...fresco,cached:false,stale:false,edad_seg:0,updated_at:new Date().toISOString()});
  }catch(e){return J({ok:false,error:String(e),huespedes:[]},500);}
});
