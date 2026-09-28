// apepe-winback — cambio de fuente OTA→directa con 15%. Recepción / Liz.
// FLUJO: Javi/el huésped CANCELA en Booking; nosotros LEEMOS status=canceled y RECIÉN ahí generamos la directa (postReservation, mismo cuarto, −15%). NUNCA cancelamos nosotros.
// Requiere sesión de recepción (permiso 'editar' PAG-HUE-RECEP). Doble candado: apepe_config apepe_winback_activo != 'true' => MODO PRUEBA (solo lee estatus + arma plan, NO crea reserva). Idempotente por op_key=ota_rid.
// PRUEBA por reserva: apepe_winback_test_ids (json array) — esas reservas se tratan como canceladas por Booking para demo; SIEMPRE modo prueba, nunca crean.
//
// EL PRECIO NO SE LEE DE LA RESERVA CANCELADA. Cuando Booking cancela, Cloudbeds deja
// la reserva en total 0. Como el −15% se calculaba sobre ese total, la directa salía
// a 0: justo en el momento de crearla se nos había borrado el precio sobre el que
// prometimos el descuento. El precio bueno es el que se le preconfirmó al huésped y
// quedó guardado en apepe_winback cuando la reserva todavía valía algo. Si no hay ni
// uno ni otro, NO se crea nada: más vale que recepción lo capture a mano que regalar
// una noche. Javi, 28-sep.
const CB="https://hotels.cloudbeds.com/api/v1.2";
const SB=Deno.env.get("SUPABASE_URL")!; const SRK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H={apikey:SRK,Authorization:"Bearer "+SRK,"Content-Type":"application/json"};
const PROP:Record<string,{keyEnv:string;id?:string;idEnv?:string}>={cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"},puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"}};
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function rest(p:string,init:RequestInit={}){ const r=await fetch(SB+"/rest/v1/"+p,{...init,headers:{...H,...(init.headers||{})}}); const t=await r.text(); if(!r.ok) throw new Error(p+" "+r.status+" "+t.slice(0,140)); return t?JSON.parse(t):null; }
async function rpc(fn:string,b:unknown){ const r=await fetch(SB+"/rest/v1/rpc/"+fn,{method:"POST",headers:H,body:JSON.stringify(b)}); return r.ok?await r.json():null; }
async function cfgv(c:string){ try{ const x=await rest(`apepe_config?clave=eq.${c}&select=valor&limit=1`); return Array.isArray(x)&&x[0]?String(x[0].valor||""):""; }catch{ return ""; } }
async function cfgList(c:string):Promise<string[]>{ try{ const v=await cfgv(c); const a=JSON.parse(v||"[]"); return Array.isArray(a)?a.map(String):[]; }catch{ return []; } }
async function quien(req:Request){ const tok=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim(); if(!tok||tok===SRK) return null; const r=await fetch(SB+"/auth/v1/user",{headers:{apikey:SRK,Authorization:"Bearer "+tok}}); if(!r.ok) return null; const u=await r.json(); return String(u?.email||"").toLowerCase()||null; }
async function cbGet(key:string,path:string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }
async function cbForm(key:string,endpoint:string,form:Record<string,string>,method="POST"){ const body=new URLSearchParams(form).toString(); const r=await fetch(`${CB}/${endpoint}`,{method,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body}); const t=await r.text(); let j:any={}; try{ j=JSON.parse(t); }catch{ j={raw:t.slice(0,200)}; } return {status:r.status, ok:r.ok&&j?.success!==false, j}; }

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  try{
    const em=await quien(req); if(!em) return J({ok:false,error:"necesitas sesión"},401);
    const perm=await rpc("permiso_efectivo",{p_email:em,p_pagina:"PAG-HUE-RECEP"}); if(perm!=="editar") return J({ok:false,error:"sin permiso"},403);
    const b=await req.json().catch(()=>({} as any));
    const rid=String(b.reservation_id||""); const prop=String(b.prop||"cdmx"); const op=String(b.op||"check");
    if(!rid) return J({ok:false,error:"falta reservation_id"},400);
    const cfgp=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfgp.keyEnv); const pid=cfgp.id??Deno.env.get(cfgp.idEnv??"");
    if(!key||!pid) return J({ok:false,error:"sin credenciales"},502);
    const testIds=await cfgList("apepe_winback_test_ids"); const esTest=testIds.includes(rid);
    const gr=await cbGet(key,`getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`); const d=gr?.data??gr;
    if(!d||!d.reservationID) return J({ok:false,error:"reserva no encontrada"},404);
    const status=String(d.status||""); const fuente=esTest?"Booking.com":String(d.sourceName||d.source||"");
    const rooms=[...(Array.isArray(d.assigned)?d.assigned:[]),...(Array.isArray(d.unassigned)?d.unassigned:[])]; const r0=rooms[0]||{};
    const totalVivo=Number(d.total||0); const desde=d.startDate||""; const hasta=d.endDate||"";
    const gl=d.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[]; const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{};
    const nombre=[main.guestFirstName,main.guestLastName].filter(Boolean).join(" ")||d.guestName||"";
    const op_key=`${rid}`;

    /* El precio que vale es el que se le prometió al huésped, no el que queda en una
       reserva ya cancelada. Leemos lo preconfirmado antes de mirar el total vivo. */
    let guardado:any=null;
    try{ const g=await rest(`apepe_winback?op_key=eq.${encodeURIComponent(op_key)}&select=precio_ota,precio_directo,estado,new_reservation_id&limit=1`); if(Array.isArray(g)&&g[0]) guardado=g[0]; }catch{}
    const precioOtaGuardado=Number(guardado?.precio_ota||0);
    const precio_ota = totalVivo>0 ? totalVivo : precioOtaGuardado;
    const precio_directo = Number(guardado?.precio_directo||0) > 0
      ? Number(guardado.precio_directo)
      : Math.round(precio_ota*0.85*100)/100;
    const precio_de = totalVivo>0 ? "reserva" : (precioOtaGuardado>0 ? "preconfirmado" : "ninguno");

    const plan={ ota_reservation_id:rid, property:prop, fuente, nombre, roomTypeID:String(r0.roomTypeID||""), roomTypeName:r0.roomTypeName||"", roomID:String(r0.roomID||""), desde, hasta, adults:Number(r0.adults||1), children:Number(r0.children||0), precio_ota, precio_directo, precio_de, descuento:"15%" };

    // idempotencia: ya generada (no aplica a las de prueba)
    if(!esTest && guardado?.estado==="generada" && guardado?.new_reservation_id){
      return J({ok:true, estado:"generada", ya:true, new_reservation_id:guardado.new_reservation_id, plan});
    }

    if(!/cancel/i.test(status) && !esTest){
      return J({ ok:true, estado:"activa", status, fuente, plan, mensaje:`La reserva sigue ${status} en el canal. Primero cancela en ${fuente||"la OTA"} y, cuando Cloudbeds la marque como cancelada, vuelve a tocar "Ya cancelé".` });
    }

    const activo=String(await cfgv("apepe_winback_activo")).toLowerCase()==="true";
    if(op!=="aplicar" || !activo || esTest){
      if(!esTest){ try{ await rest(`apepe_winback`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({op_key,ota_reservation_id:rid,property:prop,estado:"cancelada_lista",precio_ota,precio_directo,detalle:{plan,status},por:em,updated_at:new Date().toISOString()})}); }catch{} }
      const msg = esTest ? `PRUEBA: reserva de demo (se trata como cancelada por Booking). Ésta es la directa que se crearía con −15%. No se crea nada.` : (activo?"op=check: no creé nada":"MODO PRUEBA (apepe_winback_activo=false): la reserva ya está cancelada; esto es la directa que crearía con −15%. Aún NO se crea.");
      return J({ ok:true, estado:"cancelada_lista", status, plan, modo:"prueba", prueba_demo:esTest, mensaje: msg });
    }

    /* Candado de dinero: sin precio no se crea. Una directa a 0 es una noche regalada
       que además ensucia el ADR, y se arregla mucho peor que capturarla a mano. */
    if(!(precio_directo>0)){
      return J({ ok:false, estado:"sin_precio",
        error:"No hay precio: la reserva cancelada ya no trae total y no quedó un preconfirmado guardado. Crea la directa a mano en Cloudbeds con la tarifa que le prometiste.",
        plan },409);
    }

    // === CREACIÓN REAL (activo=true, op=aplicar, status=canceled, NO test) ===
    const form:Record<string,string>={ propertyID:String(pid), startDate:desde, endDate:hasta, guestFirstName:String(main.guestFirstName||nombre||"Huésped"), guestLastName:String(main.guestLastName||"."), guestCountry:String(main.guestCountry||"MX"), guestEmail:String(main.guestEmail||""), "rooms[0][roomTypeID]":plan.roomTypeID, "rooms[0][quantity]":"1", "adults[0][roomTypeID]":plan.roomTypeID, "adults[0][quantity]":String(plan.adults), sourceName:"Directa (winback)", paymentMethod:"credit_card", status:"confirmed" };
    const body=new URLSearchParams(form).toString();
    const cr=await fetch(`${CB}/postReservation`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body}); const cj=await cr.json().catch(()=>({}));
    if(!(cr.ok&&cj?.success!==false)){ try{ await rest(`apepe_winback`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({op_key,ota_reservation_id:rid,property:prop,estado:"error",precio_ota,precio_directo,detalle:{paso:"postReservation",resp:cj},por:em,updated_at:new Date().toISOString()})}); }catch{} return J({ok:false, estado:"error", error:"no se pudo crear la directa", detalle:cj},502); }
    const newId=String(cj?.reservationID||cj?.data?.reservationID||"");

    /* postReservation no manda tarifa: Cloudbeds le pone la del día, que no es la que
       le prometimos. Releemos lo que quedó y cuadramos el folio al precio pactado con
       un ajuste, que es el mismo camino que ya usa el upgrade. */
    let ajuste:any={aplicado:false};
    if(newId){
      const nd=await cbGet(key,`getReservation?reservationID=${encodeURIComponent(newId)}&propertyID=${pid}`);
      const totalNuevo=Number((nd?.data??nd)?.total||0);
      const dif=Math.round((precio_directo-totalNuevo)*100)/100;
      if(Math.abs(dif)>=1){
        const a=await cbForm(key,"postAdjustment",{propertyID:String(pid),reservationID:newId,amount:String(dif),description:`Tarifa directa winback −15% (antes ${precio_ota})`});
        ajuste={aplicado:a.ok, de:totalNuevo, a:precio_directo, dif, resp:a.ok?undefined:a.j};
      } else { ajuste={aplicado:true, de:totalNuevo, a:precio_directo, dif:0, nota:"ya coincidía"}; }
    }

    try{ await rest(`apepe_winback`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({op_key,ota_reservation_id:rid,property:prop,new_reservation_id:newId,estado:"generada",precio_ota,precio_directo,detalle:{plan,cb:cj,ajuste},por:em,updated_at:new Date().toISOString()})}); }catch{}
    return J({ ok:true, estado:"generada", new_reservation_id:newId, plan, ajuste,
      mensaje: ajuste.aplicado
        ? `Directa creada (${newId}) a ${precio_directo}. Asigna el cuarto y arrastra la garantía en recepción.`
        : `Directa creada (${newId}), pero el folio quedó en ${ajuste.de} y no se pudo ajustar a ${precio_directo}. Cuádralo a mano en Cloudbeds.` });
  }catch(e){ console.error(e); return J({ok:false,error:String(e)},500); }
});
