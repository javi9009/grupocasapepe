// apepe-contrato-pdf — renderiza el contrato REAL de Casa Pepe (con datos del huésped + firma) a PDF.
// Entrada: {checkin_id} (lee la fila) o {data:{...}} para prueba. Devuelve {ok, pdf_b64, bytes}.
//
// Contención 27-sep-2026: solo el equipo o el servidor (apepe-doc la llama con
// service_role). Antes cualquiera generaba el PDF con documento y firma del huésped.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { quienLlama, noAutorizado } from "./equipo.ts";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{ ...CORS, "Content-Type":"application/json" } });

const POL = [
  "Price includes one cocktail at happy hour (7-8pm), Café de Olla at check-in, one daily 2h walking tour and one city map.",
  "All access to the hostel must be checked in at the front desk without exception.",
  "All services or items must be paid for at the time of use.",
  "Late check-out after 12pm carries a 50% surcharge of the reservation; after 5pm the full night is charged.",
  "Confirmed reservations: a No-Show is held until 12pm the next day; without notice the reservation is cancelled and charged in full.",
  "Unconfirmed reservations are held until 3pm on the arrival day; without a valid credit card as guarantee the reservation is cancelled.",
  "Casa Pepe and its collaborators are not responsible for any physical or psychological damage the guest may suffer during the stay.",
  "Lost & Found items are stored for 1 month; unclaimed items are donated or disposed of. Any shipment is the guest's responsibility.",
  "Each guest must deposit valuables in the room safe boxes; reported thefts are investigated by the corresponding authorities.",
  "It is strictly forbidden to exchange bedrooms and lockers without the hotel administration's consent.",
  "Missing or damaged items not reported at arrival or room delivery must be covered at checkout and are the guest's responsibility.",
  "Visitors are forbidden in the bedrooms. Failure to comply carries a penalty of $600 MXN.",
  "Each guest must leave doors, windows and water outlets closed when leaving the room.",
  "A 'Do not disturb' sign not removed before 1pm means the room is not serviced until the following day.",
  "Removing towels or any decoration or room-service object is strictly forbidden; the guest authorizes Casa Pepe to charge the amount to the card left as guarantee.",
  "Hanging clothes on balconies or railings carries a penalty of $2,000 MXN.",
  "Pets are not allowed without authorization (except assistance animals; never in shared dorms). Penalty $400 MXN.",
  "The guest must behave with decency and morality within the establishment.",
  "Any sexual acts in shared spaces, dormitories or common areas are prohibited and are cause for immediate expulsion.",
  "Parties including alcoholic beverages or drugs are strictly forbidden. Penalty $3,000 MXN and immediate expulsion.",
  "Smoking is prohibited in common areas and inside the rooms. Penalty $2,000 MXN.",
  "I authorize any Lost & Found or damage found in my room, and any remaining balance (changes, penalties, activities or nights), to be charged to my credit/debit card left as guarantee.",
  "A lost or damaged key is $200 MXN and a lost or damaged towel is $200 MXN.",
  "It is strictly forbidden to nail or hang portraits, pictures or objects on the walls.",
  "Do not bring into the room substances whose odor creates an unpleasant atmosphere for other guests.",
  "If the guest deliberately breaks the rules, the manager, with the assistance of the authorities if warranted, may require immediate expulsion.",
  "Matters not covered here follow the Federal Law of Tourism and other applicable provisions of the host country.",
  "At check-in luggage is sanitized with a specialized dry-steam machine. Casa Pepe may change bed linen and curtains for hygiene at any time. Open food or drinks left in the room may be removed and disposed of for hygiene.",
];
const REMEMBER = "To remember: Check-in 3pm - Check-out 12pm - Breakfast 7-11am. Valid original Passport or National ID required for every guest. Rest time begins at 11pm unless a special event is announced. Food and alcoholic beverages are prohibited in the bedrooms. Use the lockers and safe boxes for your valuables.";
const RISK = "I understand I am responsible for all risks of participating in aerial and floor acrobatic disciplines, including damage to clothing, falls, physical injury, accident or death. I hereby release and hold harmless Hostal Boutique Republica de Uruguay (Casa Pepe Ciudad de Mexico) and anyone working there from any claim related to my participation in tours or activities on or off the premises, including first aid or medical treatment. This agreement is binding upon me, my estate and representatives. By my signature I certify I have read and understood these risks and voluntarily accept this agreement.";

function safe(s: string){ return String(s==null?"":s)
  .replace(/’|‘/g,"'").replace(/“|”/g,'"').replace(/–|—/g,"-")
  .replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
  .replace(/[^\x00-\xFF]/g,"?"); }
function fEn(d: string){ try{ return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}); }catch{ return d||"-"; } }

async function leerFila(id: string){
  const u = `${SB_URL}/rest/v1/apepe_checkin?id=eq.${encodeURIComponent(id)}&select=nombre,nacionalidad,doc_tipo,doc_numero,doc_datos,acompanantes,firma,desde,hasta,noches,consentimiento,created_at&limit=1`;
  const r = await fetch(u, { headers:{ apikey:SRV, Authorization:`Bearer ${SRV}` } });
  const j = await r.json().catch(()=>[]); return Array.isArray(j)&&j[0]?j[0]:null;
}

async function construir(row: any){
  const dd = row.doc_datos || {};
  const acs = Array.isArray(row.acompanantes) ? row.acompanantes : [];
  const nombre = row.nombre || "-";
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 54, W = 595.28, H = 841.89, RIGHT = W - M, WIDTH = RIGHT - M;
  const GREEN = rgb(0.075,0.478,0.337), INK = rgb(0.12,0.106,0.086), MUT = rgb(0.42,0.39,0.35);
  let page = pdf.addPage([W,H]); let y = H - M;
  function nueva(){ page = pdf.addPage([W,H]); y = H - M; }
  function ensure(h: number){ if (y - h < M+16) nueva(); }
  function wrap(t: string, f: any, sz: number, w: number){ const ws=safe(t).split(/\s+/); const L:string[]=[]; let c=""; for(const wd of ws){ const tt=c?c+" "+wd:wd; if(f.widthOfTextAtSize(tt,sz)>w && c){ L.push(c); c=wd; } else c=tt; } if(c) L.push(c); return L; }
  function para(t: string, o: any = {}){ const sz=o.size||9.5, f=o.font||font, lh=sz*1.32, ind=o.indent||0, col=o.color||INK;
    for(const ln of wrap(t,f,sz,WIDTH-ind)){ ensure(lh); page.drawText(ln,{x:M+ind,y:y-sz,size:sz,font:f,color:col}); y-=lh; } if(o.gap!==false) y-=(o.gap||3); }
  function heading(t: string){ y-=8; ensure(16); page.drawText(safe(t),{x:M,y:y-11,size:11,font:bold,color:GREEN}); y-=17; }
  function bullet(i: number, t: string){ const sz=9, lh=sz*1.34, num=(i+1)+"."; const ind=18;
    const lines=wrap(t,font,sz,WIDTH-ind); ensure(lines.length*lh);
    page.drawText(num,{x:M,y:y-sz,size:sz,font:bold,color:MUT});
    lines.forEach((ln)=>{ page.drawText(ln,{x:M+ind,y:y-sz,size:sz,font:font,color:INK}); y-=lh; }); y-=2; }

  page.drawText("Casa Pepe Hostal Boutique",{x:M,y:y-16,size:16,font:bold,color:GREEN}); y-=20;
  page.drawText("Registration card, policies and rules - CDMX",{x:M,y:y-11,size:10,font:font,color:MUT}); y-=26;

  const acc = dd.habitacion || dd.accommodation || "Por confirmar";
  const resId = dd.reserva_id || dd.reserva || "Por confirmar";
  const rows: [string,string][] = [["Guest",nombre],["Arrival",fEn(row.desde)],["Departure",fEn(row.hasta)],["Accommodation",String(acc)],["ID Reservation",String(resId)],["Adults",String(1+acs.length)]];
  for(const [k,v] of rows){ ensure(15); page.drawText(safe(k),{x:M,y:y-9.5,size:9.5,font:bold,color:MUT}); page.drawText(safe(v),{x:M+130,y:y-9.5,size:9.5,font:font,color:INK}); y-=15; }
  y-=6; para(REMEMBER,{size:9,color:MUT});

  heading("Policies and rules");
  POL.forEach((p,i)=>bullet(i,p));
  heading("Risk physical disciplines"); para(RISK,{size:9});

  heading("I declare that I have read and accepted");
  ensure(15); page.drawText("Phone",{x:M,y:y-9.5,size:9.5,font:bold,color:MUT}); page.drawText(safe(dd.tel||dd.telefono||"-"),{x:M+130,y:y-9.5,size:9.5,font:font,color:INK}); y-=15;
  ensure(15); page.drawText("Email",{x:M,y:y-9.5,size:9.5,font:bold,color:MUT}); page.drawText(safe(dd.email||"-"),{x:M+130,y:y-9.5,size:9.5,font:font,color:INK}); y-=15;

  if(acs.length){ heading("Accompanying guests");
    acs.forEach((a: any)=>{ ensure(14); page.drawText(safe(a.nombre||"-"),{x:M,y:y-9.5,size:9.5,font:font,color:INK}); page.drawText(safe(a.email||a.tel||""),{x:M+230,y:y-9.5,size:9,font:font,color:MUT}); y-=14; }); }

  y-=10; ensure(120);
  page.drawText("Signature",{x:M,y:y-11,size:11,font:bold,color:GREEN}); y-=18;
  const firma = String(row.firma||"");
  if(firma.startsWith("data:image")){
    try{ const b64 = firma.split(",")[1]; const bytes = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
      const img = firma.indexOf("image/jpeg")>=0 ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const dw = 220, dh = dw * (img.height/img.width);
      ensure(dh+30); page.drawRectangle({x:M,y:y-dh-6,width:dw+12,height:dh+12,borderColor:rgb(0.85,0.82,0.75),borderWidth:1,color:rgb(0.99,0.98,0.96)});
      page.drawImage(img,{x:M+6,y:y-dh,width:dw,height:dh}); y-=dh+14;
    }catch(e){ para("[firma no legible]",{size:9,color:MUT}); }
  } else { para("Sin firma registrada.",{size:9,color:MUT}); }
  const acepto = row.consentimiento ? "Accepted the terms and conditions" : "Terms not accepted";
  const fecha = row.created_at ? new Date(row.created_at).toLocaleString("es-MX",{timeZone:"America/Mexico_City"}) : "";
  para(safe(nombre+"  -  "+acepto+(fecha?"  -  "+fecha:"")),{size:9,color:MUT,font:bold});

  const total = pdf.getPageCount();
  pdf.getPages().forEach((p,i)=>{ p.drawText(`Casa Pepe - Registration card    -    page ${i+1} of ${total}`,{x:M,y:24,size:7.5,font:font,color:rgb(0.64,0.61,0.55)}); });
  return await pdf.save();
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return J({ ok:false, error:"POST only" },405);
  const q = await quienLlama(req);
  if(!q.equipo) return noAutorizado();
  let body:any={}; try{ body=await req.json(); }catch{}
  let row:any = body.data || null;
  if(!row && body.checkin_id){ row = await leerFila(String(body.checkin_id)); }
  if(!row) return J({ ok:false, error:"sin checkin_id válido ni data" },400);
  try{
    const bytes = await construir(row);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return J({ ok:true, bytes: bytes.length, pdf_b64: b64 });
  }catch(e){ return J({ ok:false, error:String(e) },500); }
});
