// apepe-cb-subir — sube el ID del huésped (postGuestDocument) y el contrato PDF (postReservationDocument) a Cloudbeds,
// y deja una NOTA en la reserva (postReservationNote) tipo Akia para que recepción lo vea en Cloudbeds.
// Idempotente: marca doc_datos.cb_subido y doc_datos.cb_nota. Lee los archivos del bucket privado apepe-docs.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "apepe-docs";
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = {
  cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"},
};
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const H = { apikey:SRV, Authorization:`Bearer ${SRV}` };

async function leer(id:string){ const u=`${SB_URL}/rest/v1/apepe_checkin?id=eq.${encodeURIComponent(id)}&select=id,nombre,doc_datos&limit=1`;
  const j=await fetch(u,{headers:H}).then(r=>r.json()).catch(()=>[]); return Array.isArray(j)&&j[0]?j[0]:null; }
async function propDeToken(tok:string){ if(!tok) return "cdmx"; const u=`${SB_URL}/rest/v1/apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=property&limit=1`;
  const j=await fetch(u,{headers:H}).then(r=>r.json()).catch(()=>[]); return (Array.isArray(j)&&j[0]&&j[0].property)||"cdmx"; }
async function bajarBucket(path:string){ const r=await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`,{headers:H}); if(!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); }
async function patch(id:string, doc_datos:any){ await fetch(`${SB_URL}/rest/v1/apepe_checkin?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{...H,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({doc_datos})}); }
async function cbUpload(endpoint:string, key:string, fields:Record<string,string>, bytes:Uint8Array, filename:string, mime:string){
  const fd=new FormData(); for(const k in fields) fd.append(k,fields[k]); fd.append("file", new Blob([bytes],{type:mime}), filename);
  const r=await fetch(`${CB}/${endpoint}`,{method:"POST",headers:{Authorization:`Bearer ${key}`},body:fd});
  const j=await r.json().catch(()=>({success:false,message:"respuesta no JSON"})); return j;
}
// POST sin archivo (form-urlencoded): p.ej. postReservationNote.
async function cbPost(endpoint:string, key:string, fields:Record<string,string>){
  const r=await fetch(`${CB}/${endpoint}`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields).toString()});
  return await r.json().catch(()=>({success:false,message:"respuesta no JSON"}));
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  let body:any={}; try{ body=await req.json(); }catch{}
  const id=String(body.checkin_id||""); if(!id) return J({ok:false,error:"falta checkin_id"},400);
  const row=await leer(id); if(!row) return J({ok:false,error:"check-in no encontrado"},404);
  const dd=row.doc_datos||{};
  const rid=String(dd.reserva_id||""); if(!rid) return J({ok:true,skipped:"sin reserva de Cloudbeds"});
  if(dd.cb_subido && dd.cb_nota && !body.forzar) return J({ok:true,ya:true,cb:dd.cb_docs||null});
  const paths=dd.paths||{}; if(!paths.contrato && !paths.id_principal) return J({ok:false,error:"sin documentos archivados (corre apepe-doc procesar primero)"},409);

  const propKey=await propDeToken(String(dd.reserva_token||""));
  const cfg=PROP[propKey]||PROP.cdmx; const key=Deno.env.get(cfg.keyEnv); const pid=cfg.id??Deno.env.get(cfg.idEnv??"");
  if(!key||!pid) return J({ok:false,error:`sin credenciales de ${propKey}`},500);

  // guestID principal
  const gr=await fetch(`${CB}/getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`,{headers:{Authorization:`Bearer ${key}`}}).then(r=>r.json()).catch(()=>({}));
  const d=gr?.data??gr; const gl=d?.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[];
  const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{}; const guestID=String(main.guestID||"");

  const out:any={ guest:null, reserva:null, nota:null };
  // 1) ID del huésped -> guest
  if(paths.id_principal && guestID && !dd.cb_subido){ const b=await bajarBucket(paths.id_principal);
    if(b){ const mime=paths.id_principal.endsWith("png")?"image/png":"image/jpeg"; out.guest=await cbUpload("postGuestDocument",key,{propertyID:String(pid),guestID},b,`ID-${row.nombre||"huesped"}.${paths.id_principal.split(".").pop()}`,mime); } }
  // 2) Contrato PDF -> reserva
  if(paths.contrato && !dd.cb_subido){ const b=await bajarBucket(paths.contrato);
    if(b){ out.reserva=await cbUpload("postReservationDocument",key,{propertyID:String(pid),reservationID:rid},b,`Contrato-CasaPepe-${rid}.pdf`,"application/pdf"); } }

  const okGuest = dd.cb_subido || !paths.id_principal || (out.guest&&out.guest.success);
  const okRes = dd.cb_subido || !paths.contrato || (out.reserva&&out.reserva.success);
  if(okGuest && okRes && !dd.cb_subido){ dd.cb_subido=true; dd.cb_subido_at=new Date().toISOString(); dd.cb_docs={guest:out.guest?.data??null,reserva:out.reserva?.data??null}; }

  // 3) Nota en la reserva (estilo Akia): recepción lo ve dentro de Cloudbeds.
  if(!dd.cb_nota){
    const fechaMx=new Date(Date.now()-6*3600*1000).toISOString().replace("T"," ").slice(0,16);
    const adjuntos:string[]=[]; if(paths.id_principal&&okGuest) adjuntos.push("ID"); if(paths.contrato&&okRes) adjuntos.push("contrato firmado");
    const partes:string[]=["✅ Check-in APePe completado "+fechaMx+" (hora CDMX)"];
    if(row.nombre) partes.push("Huésped: "+row.nombre);
    if(adjuntos.length) partes.push(adjuntos.join(" + ")+" adjuntos a la reserva");
    out.nota=await cbPost("postReservationNote",key,{propertyID:String(pid),reservationID:rid,note:partes.join(" · ")});
    if(out.nota&&out.nota.success){ dd.cb_nota=true; dd.cb_nota_at=new Date().toISOString(); }
  }

  if(dd.cb_subido || dd.cb_nota) await patch(id,dd);
  return J({ ok:okGuest&&okRes, prop:propKey, guestID, guest:out.guest, reserva:out.reserva, nota:out.nota });
});
