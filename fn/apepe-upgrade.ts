// apepe-upgrade — upgrades ANTES del check-in, alineado a REVENUE MANAGEMENT.
// Precio del upgrade = tarifa viva del cuarto destino en Cloudbeds (por noche) x curva de anticipación  − valor ya pagado del cuarto actual.
//   >7 días: x0.85 | 7..1 días: crescendo (config) | día de checkin: min(actual x1.30, rack).  PISO DURO: Aggressive-3 (ladder[3]) de pricing_recomendaciones por cuarto/noche.
//
// EL HUÉSPED FIRMA Y EL UPGRADE SE APLICA SOLO. La tarjeta está en garantía desde que
// reservó, así que no hay nada que esperar de recepción: el huésped confirma el precio,
// ve su nueva habitación, la firma —y esa firma es lo que autoriza el cargo— y ahí mismo
// se mueve el cuarto en Cloudbeds y se carga al folio.
// Por eso hay dos pasos y no uno: 'confirmar' cierra el precio y devuelve el resumen para
// que lo lea antes de firmar; 'firmar' guarda la firma y aplica. Esta función no toca
// Cloudbeds con sus propias manos: llama a apepe-upgrade-aplicar, que es donde vive esa
// lógica (y donde está aprendido que putReservation sólo contesta a PUT). Javi, 28-sep.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = { cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"} };
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (o: unknown, s=200) => new Response(JSON.stringify(o), { status:s, headers:{ ...cors, "Content-Type":"application/json" } });
async function rest(path: string, init: RequestInit = {}) { const r=await fetch(SB+"/rest/v1/"+path,{ ...init, headers:{ ...H, ...(init.headers||{}) } }); const t=await r.text(); if(!r.ok) throw new Error(path+" "+r.status+" "+t.slice(0,120)); return t?JSON.parse(t):null; }
async function cfgv(clave: string){ try{ const c=await rest(`apepe_config?clave=eq.${clave}&select=valor&limit=1`); return Array.isArray(c)&&c[0]?String(c[0].valor||""):""; }catch{ return ""; } }
async function tokenLookup(tok: string){ try{ const j=await rest(`apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`); return Array.isArray(j)&&j[0]?j[0]:null; }catch{ return null; } }
async function cbGet(key: string, path: string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }
function dormNombre(beds:number,gen:string){ const g=gen==="fem"?"femenino":gen==="queer"?"queer":"mixto"; return `Dormitorio de ${beds} camas ${g}`; }
function limpiar(s:any){ let t=String(s||""); t=t.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&aacute;/g,"á").replace(/&eacute;/g,"é").replace(/&iacute;/g,"í").replace(/&oacute;/g,"ó").replace(/&uacute;/g,"ú").replace(/&ntilde;/g,"ñ").replace(/&[a-z]+;/g," ").replace(/\s+/g," ").trim(); return t.slice(0,420); }
function cfgRoom(cfg:any,id:string){ const s=String(id); if(cfg.privada_entrada&&String(cfg.privada_entrada.id)===s) return cfg.privada_entrada; const su=(cfg.suites||[]).find((x:any)=>String(x.id)===s); return su||null; }
function specsFor(cfg:any,tipos:any,id:string){ const s=String(id); const d=(cfg.dorms||{})[s]; if(d) return { pax:Number(d.beds||0), bano:"1 baño compartido", privado:false }; const t=tipos[s]||{}; let max=Number(t.max||0); if(!max){ const cr=cfgRoom(cfg,s); max=cr?Number(cr.pax||2):2; } return { pax:max, bano:"1 baño privado", privado:true }; }
function nightsBetween(desde:string,hasta:string){ const out:string[]=[]; try{ let d=new Date(desde+"T12:00:00"); const end=new Date(hasta+"T12:00:00"); while(d<end && out.length<60){ out.push(d.toISOString().slice(0,10)); d=new Date(d.getTime()+86400000); } }catch{} return out.length?out:[desde]; }
function diasHasta(desde:string){ try{ const t=new Date(new Date().toISOString().slice(0,10)+"T12:00:00"); const d=new Date(desde+"T12:00:00"); return Math.round((d.getTime()-t.getTime())/86400000); }catch{ return 99; } }

// suma los peldanos (piso=Aggressive-3, rack=P9) leyendo la corrida mas reciente por noche de pricing_recomendaciones
async function pricingRungs(roomId:string, nights:string[], floorRung:number, rackRung:number){
  if(!nights.length) return {floor:0, rack:0, hay:false};
  let rows:any[]=[]; try{ rows = await rest(`pricing_recomendaciones?room_id=eq.${encodeURIComponent(roomId)}&fecha=in.(${nights.join(",")})&select=fecha,ladder,run_date&order=run_date.desc&limit=400`) || []; }catch{ rows=[]; }
  const seen:Record<string,boolean>={}; let floor=0, rack=0, n=0;
  for(const r of rows){ const f=String(r.fecha); if(seen[f]) continue; const L=Array.isArray(r.ladder)?r.ladder:[]; if(L.length>=rackRung){ seen[f]=true; floor+=Number(L[floorRung-1]||0); rack+=Number(L[rackRung-1]||0); n++; } }
  return {floor, rack, hay:n===nights.length && n>0};
}

async function computeUpgrade(ctx:any, op:any, curva:any){
  const R=Number(op.R||0); const D=Number(ctx.total||0); const dias=ctx.diasOut;
  const fr=Number(curva.floor_rung||3), rr=Number(curva.rack_rung||9);
  const rg=await pricingRungs(String(op.target.id), ctx.nights, fr, rr);
  let target_total;
  if(dias>7) target_total = R*(Number(curva.gt7)||0.85);
  else if(dias>=1) target_total = R*(Number(curva["d"+dias])|| Number(curva.d1) || 0.70);
  else target_total = Math.min(D*(Number(curva.checkin_mult)||1.30), (rg.rack||R));
  if(rg.hay && rg.floor) target_total = Math.max(target_total, rg.floor);
  const upgrade_stay = Math.max(0, Math.round(target_total - D));
  const per_night = Math.max(0, Math.round(upgrade_stay/Math.max(1,ctx.noches)));
  return { upgrade_stay, per_night, target_total:Math.round(target_total), floor:rg.floor, rack:rg.rack, piso_ok:rg.hay, dias, R };
}

async function contexto(rid:string, prop:string){
  const cfgp=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfgp.keyEnv); const pid=cfgp.id??Deno.env.get(cfgp.idEnv??"");
  if(!key||!pid) throw new Error("sin credenciales");
  const gr=await cbGet(key, `getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
  const d=gr?.data??gr; if(!d||!d.reservationID) throw new Error("reserva no encontrada");
  const rooms=[...(Array.isArray(d.assigned)?d.assigned:[]),...(Array.isArray(d.unassigned)?d.unassigned:[])]; const r0=rooms[0]||{};
  const cur=String(r0.roomTypeID||""); const curName=r0.roomTypeName||""; const estado=String(d.status||"");
  const adults=Number(r0.adults||0)||1; const children=Number(r0.children||0)||0;
  let paxParty=0; for(const r of rooms){ paxParty += Number(r.adults||0)+Number(r.children||0); } if(!paxParty) paxParty=adults+children;
  const total=Number(d.total||0); const desde=d.startDate||""; const hasta=d.endDate||"";
  const nights=nightsBetween(desde,hasta); const noches=nights.length; const diasOut=diasHasta(desde);
  const gl=d.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[]; const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{}; const gender=String(main.guestGender||"");
  const nombre=[main.guestFirstName,main.guestLastName].filter(Boolean).join(" ")||String(d.guestName||"");
  const av=await cbGet(key, `getAvailableRoomTypes?propertyID=${pid}&startDate=${desde}&endDate=${hasta}&rooms=1&adults=1`);
  const ad=av?.data??av; let list:any[]=[]; if(Array.isArray(ad)){ for(const p of ad){ if(Array.isArray(p.propertyRooms)) list=list.concat(p.propertyRooms); else if(p.roomTypeID) list.push(p); } }
  const avail:Record<string,{avail:boolean;rate:number}>={}; for(const x of list){ avail[String(x.roomTypeID)]={ avail:Number(x.roomsAvailable||0)>0, rate:Number(x.roomRate||0) }; }
  const rt=await cbGet(key, `getRoomTypes?propertyID=${pid}`); const rtArr=Array.isArray(rt?.data)?rt.data:[];
  const tipos:Record<string,any>={};
  for(const t of rtArr){ const ph=(Array.isArray(t.roomTypePhotos)?t.roomTypePhotos:[]).map((x:any)=>typeof x==="string"?x:(x&&(x.image||x.url||x.thumb))||"").filter(Boolean); const ft=Array.isArray(t.roomTypeFeatures)?t.roomTypeFeatures:[]; tipos[String(t.roomTypeID)]={ foto:ph[0]||"", fotos:ph.slice(0,10), desc:limpiar(t.roomTypeDescription), features:ft.slice(0,8), max:Number(t.maxGuests||0) }; }
  let cfg:any={}; try{ cfg=JSON.parse(await cfgv(`apepe_upgrade_${prop}`)||"{}"); }catch{}
  return { key, pid, prop, rid, cur, curName, estado, adults, children, total, desde, hasta, nights, noches, diasOut, gender, nombre, paxParty, avail, tipos, cfg };
}

function info(tipos:any,id:string){ const t=tipos[id]||{}; return { foto:t.foto||"", fotos:t.fotos||[], desc:t.desc||"", features:t.features||[] }; }
function elegibles(ctx:any){
  const { cur, gender, avail, cfg, paxParty, tipos } = ctx;
  const dorms=cfg.dorms||{}; const esFem=/^f/i.test(gender); const tope=Math.max(paxParty,2); const out:any[]=[];
  if(dorms[cur]){
    const curBeds=dorms[cur].beds;
    for(const [tid,d0] of Object.entries<any>(dorms)){
      if(tid===cur||d0.beds>=curBeds) continue; if(d0.gen==="fem"&&!esFem) continue; if((d0.pax||1)>tope) continue;
      const a=avail[tid]||{}; const inf=info(tipos,tid); out.push({ tipo:"puja", clase:"dorm", R:Number(a.rate||0), target:{id:tid,nombre:dormNombre(d0.beds,d0.gen),beds:d0.beds,foto:inf.foto,...specsFor(cfg,tipos,tid)}, disponible:!!a.avail });
    }
    const pe=cfg.privada_entrada; if(pe && (pe.pax||2)<=tope){ const a=avail[pe.id]||{}; out.push({ tipo:"fijo", clase:"privada", R:Number(a.rate||0), target:{...specsFor(cfg,tipos,pe.id),...info(tipos,pe.id),...pe}, disponible:!!a.avail }); }
  } else if(cfg.privada_entrada && cur===String(cfg.privada_entrada.id)){
    for(const s of (cfg.suites||[])){ if((s.pax||2)>tope) continue; const a=avail[s.id]||{}; out.push({ tipo:"puja", clase:"suite", R:Number(a.rate||0), target:{...specsFor(cfg,tipos,s.id),...info(tipos,s.id),...s}, disponible:!!a.avail }); }
  }
  return out;
}

async function precios(ctx:any, ops:any[], curva:any){
  for(const op of ops){ const c=await computeUpgrade(ctx, op, curva); op.calc=c;
    if(op.tipo==="fijo"){ op.precio=c.upgrade_stay; op.precio_noche=c.per_night; op.disponible=op.disponible && c.upgrade_stay>0; }
    else { op.umbral=c.per_night; }
  }
  return ops;
}

async function registrar(rid:string,prop:string,op:any,bid:number,decision:string){ try{ await rest(`apepe_upgrade_puja`, { method:"POST", headers:{Prefer:"return=minimal"}, body: JSON.stringify({ reservation_id:rid, property:prop, bid, decision, clase:op.clase, target:String(op.target.id) }) }); }catch{} }
async function logAplicado(row:any){ try{ await rest(`apepe_upgrade_aplicado`, { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body: JSON.stringify({ ...row, updated_at:new Date().toISOString() }) }); }catch{} }

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  let b:any={}; try{ b=await req.json(); }catch{}
  let rid=String(b.reservation_id||""); let prop=String(b.prop||"cdmx");
  if(!rid && b.resv){ const row=await tokenLookup(String(b.resv)); if(row){ rid=String(row.reservation_id); prop=row.property||"cdmx"; } }
  const accion=String(b.accion|| (b.target_id?"evaluar":"opciones"));
  if(!rid) return J({ok:false,error:"falta reservation_id o resv"},400);
  let ctx:any; try{ ctx=await contexto(rid,prop); }catch(e){ return J({ok:false,error:String(e)},502); }
  let curva:any={}; try{ curva=JSON.parse(await cfgv("apepe_upgrade_curva")||"{}"); }catch{}
  const ops=await precios(ctx, elegibles(ctx), curva); const N=Math.max(1,ctx.noches);

  if(accion==="opciones"){
    const ci=info(ctx.tipos,ctx.cur); const cs=specsFor(ctx.cfg,ctx.tipos,ctx.cur); const ex=cfgRoom(ctx.cfg,ctx.cur)||{};
    return J({ ok:true, noches:N, dias_checkin:ctx.diasOut, cuarto_actual:{id:ctx.cur,nombre:ctx.curName,foto:ci.foto,...cs, m2:ex.m2, bano:ex.bano||cs.bano}, total:ctx.total, opciones:ops });
  }
  const tid=String(b.target_id||""); const bid=Number(b.bid||0);
  const op=ops.find((o:any)=>String(o.target.id)===tid);
  if(!op) return J({ ok:true, decision:"sin_upgrade", motivo:"ese upgrade no está disponible para tu reserva" });
  if(!op.disponible) return J({ ok:true, decision:"recepcion", clase:op.clase, target:op.target, pepe:"Liz", mensaje:"Justo ese cuarto no tiene disponibilidad para tus fechas. Liz, de nuestro equipo, te revisa una opción." });

  if(accion==="confirmar" || accion==="firmar"){
    let agreedStay=0;
    if(op.tipo==="fijo"){ agreedStay=op.precio; }
    else { if(!bid) return J({ok:false,error:"falta bid"},400); if(bid<op.umbral) return J({ok:true,decision:"contraoferta",umbral:op.umbral,mensaje:"Esa oferta aún no alcanza para este upgrade."}); agreedStay=bid*N; }
    const perNight = op.tipo==="fijo"? op.precio_noche : bid;
    const op_key=`${rid}:${tid}`;

    /* Si ya se aplicó, no se vuelve a cobrar por mucho que se toque el botón. */
    try{ const ya=await rest(`apepe_upgrade_aplicado?op_key=eq.${encodeURIComponent(op_key)}&estado=in.(aplicado,aplicado_sin_cargo)&select=id&limit=1`); if(Array.isArray(ya)&&ya[0]) return J({ ok:true, decision:"aplicado", ya:true, target:op.target, precio_noche:perNight, precio_total:agreedStay, mensaje:`Tu ${op.target.nombre} ya está confirmada. Te esperamos.` }); }catch{}

    const resumen={ de:ctx.curName, a:op.target.nombre, desde:ctx.desde, hasta:ctx.hasta, noches:N,
                    precio_noche:perNight, extra_total:agreedStay, ya_pagado:ctx.total, total_estancia:ctx.total+agreedStay,
                    huesped:ctx.nombre };

    if(accion==="confirmar"){
      await registrar(rid,prop,op,perNight,"confirmado");
      await logAplicado({ op_key, reservation_id:rid, property:prop, clase:op.clase, from_room:ctx.cur, to_room:tid, monto:agreedStay, estado:"por_firmar", detalle:{perNight, noches:N, calc:op.calc, resumen} });
      return J({ ok:true, decision:"por_firmar", target:op.target, precio_noche:perNight, precio_total:agreedStay, resumen,
        mensaje:"Ésta es tu nueva habitación. Fírmala para aceptarla y la dejamos hecha." });
    }

    // === FIRMAR: la firma autoriza el cargo, y con ella se aplica de una vez ===
    const firma=String(b.firma||"");
    if(!/^data:image\/(png|jpe?g);base64,/.test(firma) || firma.length<400) return J({ok:false,error:"falta tu firma"},400);
    if(firma.length>500000) return J({ok:false,error:"la firma pesa demasiado"},413);
    /* La firma primero: si el cargo falla queremos tener guardado que aceptó, no al revés. */
    try{ await rest(`apepe_upgrade_aplicado?op_key=eq.${encodeURIComponent(op_key)}`, { method:"PATCH", headers:{Prefer:"return=minimal"}, body: JSON.stringify({ firma, firmado_at:new Date().toISOString(), firmado_nombre:ctx.nombre||null, updated_at:new Date().toISOString() }) }); }catch{}

    let j:any={};
    try{
      const r=await fetch(SB+"/functions/v1/apepe-upgrade-aplicar",{ method:"POST",
        headers:{ apikey:SRK, Authorization:"Bearer "+SRK, "Content-Type":"application/json" },
        body: JSON.stringify({ op:"aplicar", via:"firma_huesped", reservation_id:rid, prop, target_id:tid, monto:agreedStay }) });
      j=await r.json().catch(()=>({}));
    }catch(e){ j={ok:false,error:String(e)}; }

    if(j?.ok && (j.ejecutado || j.ya_aplicado)){
      const sinCargo = j.estado==="aplicado_sin_cargo";
      return J({ ok:true, decision:"aplicado", target:op.target, precio_noche:perNight, precio_total:agreedStay, resumen, cargo_ok:!sinCargo,
        mensaje: sinCargo
          ? `¡Listo! Tu ${op.target.nombre} ya es tuya. El cobro lo cuadra recepción al llegar.`
          : `¡Listo! Tu ${op.target.nombre} ya está confirmada y el extra se cargó a la tarjeta de tu reserva.` });
    }
    /* No se pudo mover: quedó firmado y recepción lo ve en su tablero. No le decimos al
       huésped que está hecho, porque no lo está. */
    return J({ ok:false, decision:"pendiente_recepcion", target:op.target, precio_total:agreedStay, resumen,
      problemas: Array.isArray(j?.problemas)?j.problemas:[],
      mensaje:"Guardamos tu firma, pero no pudimos cerrar el cambio automáticamente. Recepción lo termina y te confirma al llegar." });
  }

  // EVALUAR (proponer)
  if(op.tipo==="fijo"){ return J({ ok:true, decision:"precio_fijo", clase:"privada", target:op.target, precio_noche:op.precio_noche, precio_total:op.precio, noches:N, mensaje:`Sube a ${op.target.nombre} por $${op.precio_noche} MXN por noche.` }); }
  if(!bid) return J({ ok:false, error:"falta bid" },400);
  let intento=1; try{ const prev=await rest(`apepe_upgrade_puja?reservation_id=eq.${encodeURIComponent(rid)}&target=eq.${tid}&select=id`); intento=(Array.isArray(prev)?prev.length:0)+1; }catch{}
  let decision="contraoferta", mensaje="", pepe:any=null;
  if(bid>=op.umbral){ decision="acepta"; mensaje=`¡Tu oferta encaja! Por $${bid} MXN por noche te subimos a ${op.target.nombre}.`; }
  else if(intento>=5){ decision="recepcion"; pepe="Liz"; mensaje="Vamos a dejarlo con Liz, de nuestro equipo, para proponerte algo a tu medida."; }
  else { const r=op.umbral>0?bid/op.umbral:0; mensaje = r>=0.85?"¡Estás cerquísima! Con un pelín más por noche, es tuyo." : r>=0.6?"Vas por buen camino, pero aún no llegamos. Anímate a subir tu oferta por noche." : "Esa oferta por noche se queda corta para este upgrade. Si te animas a subir bastante, lo vemos."; }
  await registrar(rid,prop,op,bid,decision);
  return J({ ok:true, decision, clase:op.clase, target:op.target, umbral:op.umbral, bid, noches:N, precio_total:bid*N, intento, mensaje, pepe });
});
