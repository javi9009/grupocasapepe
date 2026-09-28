// apepe-upgrade-aplicar — EJECUTA el upgrade (mueve el cuarto + registra el cargo).
// Dos maneras de entrar, y sólo dos:
//   1) Recepción, con sesión y permiso 'editar' en PAG-HUE-RECEP. Es la vía manual,
//      para los casos raros y para reintentar lo que falló.
//   2) INTERNA, con la service key y via='firma_huesped': la usa apepe-upgrade después
//      de comprobar el token de la reserva y guardar la firma del huésped. La service
//      key no sale nunca del servidor, así que nadie más puede entrar por aquí.
// Antes esto exigía siempre que alguien de recepción dijera "ya lo cobré". Ya no hace
// falta: la tarjeta está en garantía desde la reserva, así que lo que autoriza el
// cargo es la firma del huésped aceptando su nueva habitación. Javi, 28-sep.
// Reglas: misma pax, mismo tipo de tarifa (mismo rateID). No sube a un cuarto que no le cabe a la reserva. Precios POR NOCHE (monto = por_noche x noches). Idempotente por (reserva + target).
// body: {reservation_id|resv, prop, target_id, monto?, op?:'plan'|'aplicar', via?}
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = { cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"} };
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (o: unknown, s=200) => new Response(JSON.stringify(o), { status:s, headers:{ ...cors, "Content-Type":"application/json" } });
async function rest(path: string, init: RequestInit = {}) { const r=await fetch(SB+"/rest/v1/"+path,{ ...init, headers:{ ...H, ...(init.headers||{}) } }); const t=await r.text(); if(!r.ok) throw new Error(path+" "+r.status+" "+t.slice(0,160)); return t?JSON.parse(t):null; }
async function rpc(fn: string, b: unknown){ const r=await fetch(SB+"/rest/v1/rpc/"+fn,{method:"POST",headers:H,body:JSON.stringify(b)}); return r.ok?await r.json():null; }
async function cfgv(clave: string){ try{ const c=await rest(`apepe_config?clave=eq.${clave}&select=valor&limit=1`); return Array.isArray(c)&&c[0]?String(c[0].valor||""):""; }catch{ return ""; } }
async function quien(req: Request){ const tok=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim(); if(!tok||tok===SRK) return null; const r=await fetch(SB+"/auth/v1/user",{headers:{apikey:SRK,Authorization:"Bearer "+tok}}); if(!r.ok) return null; const u=await r.json(); return String(u?.email||"").toLowerCase()||null; }
async function tokenLookup(tok: string){ try{ const j=await rest(`apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`); return Array.isArray(j)&&j[0]?j[0]:null; }catch{ return null; } }
async function cbGet(key: string, path: string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }
// OJO con el verbo: cada endpoint de Cloudbeds acepta el suyo. Por eso `method` es un parámetro y no una constante.
async function cbForm(key: string, endpoint: string, form: Record<string,string>, method = "POST"){ const body=new URLSearchParams(form).toString(); const r=await fetch(`${CB}/${endpoint}`,{method,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body}); const t=await r.text(); let j:any={}; try{ j=JSON.parse(t); }catch{ j={raw:t.slice(0,200)}; } return {status:r.status, ok:r.ok&&j?.success!==false, j}; }
function cfgRoom(cfg:any,id:string){ const s=String(id); if(cfg.privada_entrada&&String(cfg.privada_entrada.id)===s) return {...cfg.privada_entrada, clase:"privada"}; const su=(cfg.suites||[]).find((x:any)=>String(x.id)===s); if(su) return {...su, clase:"suite"}; if((cfg.dorms||{})[s]) return {...cfg.dorms[s], id:s, clase:"dorm"}; return null; }

async function contexto(rid:string, prop:string){
  const cfgp=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfgp.keyEnv); const pid=cfgp.id??Deno.env.get(cfgp.idEnv??"");
  if(!key||!pid) throw new Error("sin credenciales");
  const gr=await cbGet(key, `getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
  const d=gr?.data??gr; if(!d||!d.reservationID) throw new Error("reserva no encontrada");
  const rooms=[...(Array.isArray(d.assigned)?d.assigned:[]),...(Array.isArray(d.unassigned)?d.unassigned:[])];
  const r0=rooms[0]||{};
  const cur=String(r0.roomTypeID||""); const curName=r0.roomTypeName||""; const curUnit=String(r0.roomID||r0.roomName||"");
  const rateID=String(r0.rateID||d.rateID||""); const adults=Number(r0.adults||0)||Number(d.adults||0)||1; const children=Number(r0.children||0)||0;
  let paxParty=0; for(const r of rooms){ paxParty += Number(r.adults||0)+Number(r.children||0); } if(!paxParty) paxParty=adults+children;
  const total=Number(d.total||0); const desde=d.startDate||""; const hasta=d.endDate||""; const estado=String(d.status||""); const subId=String(r0.subReservationID||r0.reservationRoomID||"");
  let noches=1; try{ const n=Math.round((new Date(hasta+"T12:00:00").getTime()-new Date(desde+"T12:00:00").getTime())/86400000); if(n>0) noches=n; }catch{}
  const av=await cbGet(key, `getAvailableRoomTypes?propertyID=${pid}&startDate=${desde}&endDate=${hasta}&rooms=1&adults=1`);
  const ad=av?.data??av; let list:any[]=[]; if(Array.isArray(ad)){ for(const p of ad){ if(Array.isArray(p.propertyRooms)) list=list.concat(p.propertyRooms); else if(p.roomTypeID) list.push(p); } }
  const avail:Record<string,{avail:boolean;rate:number}>={}; for(const x of list){ avail[String(x.roomTypeID)]={ avail:Number(x.roomsAvailable||0)>0, rate:Number(x.roomRate||0) }; }
  const rt=await cbGet(key, `getRoomTypes?propertyID=${pid}`); const rtArr=Array.isArray(rt?.data)?rt.data:[]; const maxOf:Record<string,number>={}; const nameOf:Record<string,string>={};
  for(const t of rtArr){ maxOf[String(t.roomTypeID)]=Number(t.maxGuests||0); nameOf[String(t.roomTypeID)]=String(t.roomTypeName||""); }
  let cfg:any={}; try{ cfg=JSON.parse(await cfgv(`apepe_upgrade_${prop}`)||"{}"); }catch{}
  return { key, pid, cur, curName, curUnit, rateID, adults, children, paxParty, total, desde, hasta, noches, estado, subId, avail, maxOf, nameOf, cfg };
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  try{
    const b = await req.json().catch(()=>({} as any));
    const authTok=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    /* La service key sólo la tienen nuestras propias funciones, y sólo apepe-upgrade
       la usa aquí —después de validar el token de la reserva y guardar la firma—, así
       que esta puerta no la puede empujar nadie desde fuera. */
    const interno = authTok===SRK && String(b.via||"")==="firma_huesped";
    const em = interno ? "app · firma del huésped" : await quien(req);
    if(!em) return J({ok:false,error:"necesitas sesión"},401);
    if(!interno){
      const perm = await rpc("permiso_efectivo",{p_email:em,p_pagina:"PAG-HUE-RECEP"});
      if(perm!=="editar") return J({ok:false,error:"no tienes permiso para aplicar upgrades"},403);
    }
    let rid=String(b.reservation_id||""); let prop=String(b.prop||"cdmx");
    if(!rid && b.resv){ const row=await tokenLookup(String(b.resv)); if(row){ rid=String(row.reservation_id); prop=row.property||"cdmx"; } }
    const target_id=String(b.target_id||""); const op=String(b.op||"plan");
    if(!rid||!target_id) return J({ok:false,error:"falta reservation_id o target_id"},400);

    const ctx = await contexto(rid, prop);
    const tgt = cfgRoom(ctx.cfg, target_id);
    if(!tgt) return J({ok:false,error:"ese target no está en la configuración de upgrades"},400);
    const clase = tgt.clase; const N = Math.max(1, ctx.noches);

    // validaciones de negocio
    const problemas:string[]=[];
    if(ctx.estado && !/confirmed|not_confirmed/i.test(ctx.estado)) problemas.push(`la reserva está en estado ${ctx.estado} (el upgrade es antes del check-in)`);
    const maxT = ctx.maxOf[target_id]||Number(tgt.pax||0);
    if(maxT && ctx.paxParty>maxT) problemas.push(`no cabe: la reserva es de ${ctx.paxParty} pax y ${tgt.nombre||target_id} admite ${maxT}`);
    const a = ctx.avail[target_id]||{avail:false,rate:0};
    if(!a.avail) problemas.push("ese cuarto no tiene disponibilidad para las fechas");

    // monto (POR NOCHE x noches)
    let monto = Number(b.monto||0); let monto_noche = 0;
    if(clase==="privada" && !monto){ monto = Math.max(0, Math.round((a.rate||0) - ctx.total)); monto_noche = Math.round(monto/N); }
    // Ordenamos por created_at, no por id: el id de apepe_upgrade_puja es un uuid, así que id.desc no es cronológico y podía devolvernos una oferta vieja en lugar de la última que cerró el huésped.
    if(!monto){ try{ const acc=await rest(`apepe_upgrade_puja?reservation_id=eq.${encodeURIComponent(rid)}&target=eq.${target_id}&decision=in.(confirmado,acepta)&select=bid,created_at&order=created_at.desc&limit=1`); if(Array.isArray(acc)&&acc[0]){ monto_noche=Number(acc[0].bid||0); monto=monto_noche*N; } }catch{} }
    if(!monto_noche && monto) monto_noche=Math.round(monto/N);
    if(!monto || monto<=0) problemas.push("no hay monto válido (ni oferta confirmada ni diferencia de tarifa)");

    // Idempotencia: solo cuentan los estados que YA se aplicaron en Cloudbeds. 'por_cobrar'/'por_firmar' es justo lo que venimos a aplicar, así que no bloquean.
    const op_key = `${rid}:${target_id}`;
    try{ const ya=await rest(`apepe_upgrade_aplicado?op_key=eq.${encodeURIComponent(op_key)}&estado=in.(aplicado,aplicado_sin_cargo)&select=id,to_room,monto,estado,created_at&limit=1`); if(Array.isArray(ya)&&ya[0]) return J({ok:true, ya_aplicado:true, registro:ya[0]}); }catch{}

    const plan = { reservation_id:rid, property:prop, clase, from_room:ctx.cur, from_room_nombre:ctx.curName, from_unit:ctx.curUnit, to_room:target_id, to_room_nombre:tgt.nombre||ctx.nameOf[target_id]||"", monto, monto_noche, noches:N, rate_id:ctx.rateID, mantiene_pax:ctx.paxParty, mantiene_tarifa:ctx.rateID||"(sin cambio)", desde:ctx.desde, hasta:ctx.hasta };

    const activo = String(await cfgv("apepe_upgrade_activo")).toLowerCase()==="true";

    if(op!=="aplicar" || !activo || problemas.length){
      const estado = problemas.length? "bloqueado" : "simulado";
      try{ await rest(`apepe_upgrade_aplicado`, { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body: JSON.stringify({ op_key, reservation_id:rid, property:prop, clase, from_room:ctx.cur, to_room:target_id, monto, rate_id:ctx.rateID, estado, detalle:{plan,problemas}, aplicado_por:em, updated_at:new Date().toISOString() }) }); }catch{}
      return J({ ok:problemas.length===0, modo: activo?"prueba_op":"prueba", ejecutado:false, problemas, plan, nota: problemas.length? "no se puede aplicar todavía" : (activo? "op=plan: no ejecuté nada" : "MODO PRUEBA (apepe_upgrade_activo=false): esto es lo que aplicaría, sin tocar Cloudbeds") });
    }

    // === EJECUCIÓN REAL ===
    const form:Record<string,string> = { propertyID:String(ctx.pid), reservationID:rid, "rooms[0][roomTypeID]":target_id, "rooms[0][quantity]":"1", "rooms[0][adults]":String(ctx.adults), "rooms[0][children]":String(ctx.children), checkoutDate:ctx.hasta };
    if(ctx.rateID) form["rooms[0][rateID]"]=ctx.rateID;
    // NO LO CAMBIES A POST: putReservation de Cloudbeds solo contesta al verbo PUT. Llamado por POST devuelve {"error":"Unknown method.","status":false} y el cuarto se queda como estaba (nos pasó en una prueba real).
    const mv = await cbForm(ctx.key, "putReservation", form, "PUT");
    if(!mv.ok){ const detalle={paso:"putReservation", status:mv.status, resp:mv.j}; try{ await rest(`apepe_upgrade_aplicado`, { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body: JSON.stringify({ op_key, reservation_id:rid, property:prop, clase, from_room:ctx.cur, to_room:target_id, monto, rate_id:ctx.rateID, estado:"error", detalle, aplicado_por:em, updated_at:new Date().toISOString() }) }); }catch{} return J({ok:false, ejecutado:false, error:"no se pudo mover el cuarto", detalle},502); }

    const desc = `Upgrade a ${plan.to_room_nombre||target_id} (APePe)`;
    // postAdjustment sí es POST.
    const adj = await cbForm(ctx.key, "postAdjustment", { propertyID:String(ctx.pid), reservationID:rid, amount:String(monto), description:desc });
    const estadoFinal = adj.ok? "aplicado" : "aplicado_sin_cargo";
    try{ await rest(`apepe_upgrade_aplicado`, { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body: JSON.stringify({ op_key, reservation_id:rid, property:prop, clase, from_room:ctx.cur, to_room:target_id, to_room_unit:null, monto, rate_id:ctx.rateID, estado:estadoFinal, detalle:{plan, mover:mv.j, cargo:adj.j}, aplicado_por:em, updated_at:new Date().toISOString() }) }); }catch{}
    return J({ ok:true, ejecutado:true, modo:"real", estado:estadoFinal, plan, cargo_ok:adj.ok, cargo_detalle:adj.ok?"":adj.j });
  }catch(e){ console.error(e); return J({ok:false,error:String(e)},500); }
});
