// apepe-doc — archiva documentos del check-in en el bucket PRIVADO apepe-docs y los sirve por URL firmada.
//  procesar {checkin_id}: genera el contrato PDF, sube ID/firma/acompañantes al bucket, guarda rutas, BORRA el base64,
//    (si hay reserva) sube a Cloudbeds (apepe-cb-subir), y manda el correo de check-in confirmado (apepe-correo).
//  ver {checkin_id}: devuelve srcs listos para <img>/<a> (URL firmada si ya se archivó, o el base64 de la fila si aún no).
//
// Contención 27-sep-2026:
//  - "ver" (pasaportes, INE, firmas) solo para el equipo.
//  - "procesar" lo dispara el propio huésped al terminar su check-in (sin sesión):
//    se permite solo para un check-in creado hace menos de 30 min y aún no archivado.
import { quienLlama, noAutorizado } from "./equipo.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "apepe-docs";
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{ ...CORS, "Content-Type":"application/json" } });
const H = { apikey: SRV, Authorization:`Bearer ${SRV}` };

function dataUrlBytes(u: string){ const i=u.indexOf(","); const meta=u.slice(5,i); const b64=u.slice(i+1);
  const bytes=Uint8Array.from(atob(b64), c=>c.charCodeAt(0)); const mime=meta.split(";")[0]||"application/octet-stream"; return { bytes, mime }; }
function ext(mime: string){ return mime.indexOf("png")>=0?"png":(mime.indexOf("jpeg")>=0||mime.indexOf("jpg")>=0?"jpg":"bin"); }

async function leer(id: string){
  const u=`${SB_URL}/rest/v1/apepe_checkin?id=eq.${encodeURIComponent(id)}&select=id,firma,acompanantes,doc_datos,created_at&limit=1`;
  const j=await fetch(u,{headers:H}).then(r=>r.json()).catch(()=>[]); return Array.isArray(j)&&j[0]?j[0]:null;
}
async function subir(path: string, bytes: Uint8Array, mime: string){
  const r=await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`,{ method:"POST", headers:{ ...H, "Content-Type":mime, "x-upsert":"true" }, body:new Blob([bytes as BlobPart]) });
  if(!r.ok){ throw new Error(`subir ${path}: ${r.status} ${await r.text()}`); } return path;
}
async function firmar(path: string, expires=300){
  const r=await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${path}`,{ method:"POST", headers:{ ...H, "Content-Type":"application/json" }, body:JSON.stringify({ expiresIn:expires }) });
  const j=await r.json().catch(()=>({})); if(!j.signedURL) return null; return `${SB_URL}/storage/v1${j.signedURL}`;
}
async function patch(id: string, doc_datos: any, acompanantes: any, firma: any){
  const body:any={ doc_datos }; if(acompanantes!==undefined) body.acompanantes=acompanantes; if(firma!==undefined) body.firma=firma;
  await fetch(`${SB_URL}/rest/v1/apepe_checkin?id=eq.${encodeURIComponent(id)}`,{ method:"PATCH", headers:{ ...H, "Content-Type":"application/json", Prefer:"return=minimal" }, body:JSON.stringify(body) });
}
async function llamar(fn: string, body: any){ try{ return await fetch(`${SB_URL}/functions/v1/${fn}`,{ method:"POST", headers:{ ...H, "Content-Type":"application/json" }, body:JSON.stringify(body) }).then(r=>r.json()); }catch(e){ return { ok:false, error:String(e) }; } }

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return J({ ok:false, error:"POST only" },405);
  let body:any={}; try{ body=await req.json(); }catch{}
  const id=String(body.checkin_id||""); if(!id) return J({ ok:false, error:"falta checkin_id" },400);
  const accion=String(body.accion||"ver");
  const row=await leer(id); if(!row) return J({ ok:false, error:"check-in no encontrado" },404);
  const dd=row.doc_datos||{}; const acs=Array.isArray(row.acompanantes)?row.acompanantes:[];

  const q = await quienLlama(req);

  if(accion==="procesar"){
    const recien = row.created_at && (Date.now() - new Date(row.created_at).getTime()) < 30*60*1000;
    if(!q.equipo && !(recien && !dd.archivado)) return noAutorizado();
    const paths:any = dd.paths || {};
    try{
      const pr=await llamar("apepe-contrato-pdf", { checkin_id:id });
      if(pr&&pr.ok&&pr.pdf_b64){ const bytes=Uint8Array.from(atob(pr.pdf_b64), c=>c.charCodeAt(0)); paths.contrato=await subir(`${id}/contrato.pdf`, bytes, "application/pdf"); }
      let firmaNew=row.firma;
      if(typeof row.firma==="string" && row.firma.startsWith("data:image")){ const {bytes,mime}=dataUrlBytes(row.firma); paths.firma=await subir(`${id}/firma.${ext(mime)}`, bytes, mime); firmaNew=null; }
      let ddNew={...dd};
      if(typeof dd.id_foto==="string" && dd.id_foto.startsWith("data:image")){ const {bytes,mime}=dataUrlBytes(dd.id_foto); paths.id_principal=await subir(`${id}/id-principal.${ext(mime)}`, bytes, mime); delete ddNew.id_foto; }
      const acsNew=acs.map((a:any)=>({...a}));
      for(let i=0;i<acsNew.length;i++){ const f=acsNew[i].id_foto; if(typeof f==="string" && f.startsWith("data:image")){ const {bytes,mime}=dataUrlBytes(f); acsNew[i].id_path=await subir(`${id}/id-acomp-${i+1}.${ext(mime)}`, bytes, mime); delete acsNew[i].id_foto; } }
      ddNew.paths=paths; ddNew.archivado=true; ddNew.archivado_at=new Date().toISOString();
      await patch(id, ddNew, acsNew, firmaNew);
      let cloudbeds=null; if(ddNew.reserva_id){ cloudbeds=await llamar("apepe-cb-subir", { checkin_id:id }); }
      const correo = await llamar("apepe-correo", { checkin_id:id, tipo:"checkin-confirmado" });
      // Al huésped no se le devuelven rutas internas.
      return q.equipo ? J({ ok:true, archivado:true, paths, acomp:acsNew.length, cloudbeds, correo }) : J({ ok:true, archivado:true });
    }catch(e){ return J({ ok:false, error:"no se pudo archivar" },500); }
  }

  if(!q.equipo) return noAutorizado();

  if(dd.archivado && dd.paths){
    const p=dd.paths;
    const [firma_url,id_url,contrato_url]=await Promise.all([
      p.firma?firmar(p.firma):Promise.resolve(null), p.id_principal?firmar(p.id_principal):Promise.resolve(null), p.contrato?firmar(p.contrato):Promise.resolve(null),
    ]);
    const acomp=await Promise.all(acs.map(async(a:any)=>({ nombre:a.nombre, url: a.id_path?await firmar(a.id_path):null })));
    return J({ ok:true, archivado:true, firma_url, id_principal_url:id_url, contrato_url, acomp });
  }
  return J({ ok:true, archivado:false, firma_url: row.firma||null, id_principal_url: dd.id_foto||null, contrato_url:null,
    acomp: acs.map((a:any)=>({ nombre:a.nombre, url:a.id_foto||null })) });
});
