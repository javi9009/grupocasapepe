// apepe-salida-tarde — late checkout, de la recamarista al cobro.
//
// El circuito que pidió Javi, y el orden importa:
//   1. La recamarista entra a limpiar, ve que el huésped dejó sus cosas y toca un
//      botón. Eso es TODO lo que hace: no negocia, no pone precio, no promete nada.
//   2. Recepción ve la marca y decide QUÉ le ofrece: una hora de cortesía, hasta las
//      15:00, hasta las 17:00, o que se quede la noche entera.
//   3. Al huésped le llega la pregunta con esas opciones y elige.
//   4. Recepción cobra.
//
// EL PRECIO SALE DE SU NOCHE, NO DE UNA TARIFA SUELTA. 25% y 50% de lo que pagó por
// la noche que acaba de dormir. Se calcula al OFRECER y se congela ahí: si el motor
// de tarifas se mueve a media tarde, al huésped no se le cambia el precio que ya vio.
//
// ops: marcar (recamarista) · dia (equipo) · ofrecer (recepción) · ver (huésped, token)
//      · elegir (huésped, token) · cobrar (recepción)
// Javi, 28-sep.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PUB = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = { cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"} };
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (o: unknown, s=200) => new Response(JSON.stringify(o), { status:s, headers:{ ...cors, "Content-Type":"application/json" } });

/* Lo que cuesta cada opción, en tanto por uno de la noche que durmió. */
const TARIFA = { h1: 0, h15: 0.25, h17: 0.50 };
const ETIQ: Record<string,string> = {
  h1: "Una hora más", h15: "Hasta las 15:00", h17: "Hasta las 17:00", extender: "Quedarte la noche",
};

async function rest(p:string, init:RequestInit={}){ const r=await fetch(SB+"/rest/v1/"+p,{...init,headers:{...H,...(init.headers||{})}}); const t=await r.text(); if(!r.ok) throw new Error(p+" "+r.status+" "+t.slice(0,140)); return t?JSON.parse(t):null; }
async function cbGet(key:string, path:string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }
function mxHoy(off=0){ const d=new Date(Date.now()-6*3600*1000); d.setUTCDate(d.getUTCDate()+off); return d.toISOString().slice(0,10); }
function mxHora(){ const d=new Date(Date.now()-6*3600*1000); return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0"); }

/* Quién llama. El equipo entra con su sesión; el huésped, sólo con el token de su
   reserva —que no le sirve para ver ni tocar la de nadie más. */
async function equipo(req:Request){
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!jwt || jwt===ANON || jwt===PUB || jwt.startsWith("sb_publishable_")) return null;
  if(jwt===SRK) return "servidor";
  const u=await fetch(`${SB}/auth/v1/user`,{headers:{apikey:ANON||PUB||SRK,Authorization:"Bearer "+jwt}}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!u?.email) return null;
  const eq=await fetch(`${SB}/rest/v1/rpc/es_equipo_casa`,{method:"POST",headers:{apikey:ANON||PUB||SRK,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},body:"{}"}).then(r=>r.ok?r.json():false).catch(()=>false);
  return eq===true ? String(u.email).toLowerCase() : null;
}
async function porToken(tok:string){ try{ const j=await rest(`apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`); return Array.isArray(j)&&j[0]?j[0]:null; }catch{ return null; } }

/* Lo que pagó por la noche que acaba de dormir. Ahí está el 25% y el 50%. */
async function baseNoche(key:string, pid:string, rid:string, fecha:string){
  const g=await cbGet(key,`getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
  const d=g?.data??g; if(!d?.reservationID) return { base:0, d:null };
  const rooms=[...(Array.isArray(d.assigned)?d.assigned:[]),...(Array.isArray(d.unassigned)?d.unassigned:[])];
  const anoche=(()=>{ const x=new Date(fecha+"T12:00:00Z"); x.setUTCDate(x.getUTCDate()-1); return x.toISOString().slice(0,10); })();
  let base=0;
  for(const rm of rooms){
    const dr=rm.dailyRates||rm.detailedRoomRates||{};
    if(Array.isArray(dr)){ const f=dr.find((x:any)=>String(x.date)===anoche); if(f) base+=Number(f.rate||0); }
    else if(dr && typeof dr==="object"){ if(dr[anoche]!=null) base+=Number(dr[anoche]||0); }
  }
  /* Si la reserva no desglosa por noche, el promedio de la estancia es mejor que
     nada — y mejor que el total, que multiplicaría el cobro por las noches. */
  if(!base){
    const tot=Number(d.total||0);
    let n=1; try{ n=Math.max(1,Math.round((new Date(String(d.endDate)+"T12:00:00Z").getTime()-new Date(String(d.startDate)+"T12:00:00Z").getTime())/86400000)); }catch{}
    base=Math.round(tot/n);
  }
  return { base:Math.round(base), d };
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  try{
    const b:any=await req.json().catch(()=>({}));
    const op=String(b.op||"ver");
    const em=await equipo(req);

    // ===== HUÉSPED: sólo con el token de su reserva =====
    if(op==="ver" || op==="elegir"){
      const t=String(b.token||b.resv||""); if(!t) return J({ok:false,error:"falta el token"},400);
      const row=await porToken(t); if(!row) return J({ok:false,error:"token no válido"},404);
      const rid=String(row.reservation_id);
      let st:any=null;
      try{ const r=await rest(`apepe_salida_tarde?reservation_id=eq.${encodeURIComponent(rid)}&estado=in.(ofrecida,elegida,cobrada)&select=*&order=fecha.desc&limit=1`); st=Array.isArray(r)&&r[0]?r[0]:null; }catch{}
      if(!st) return J({ ok:true, hay:false });

      if(op==="ver"){
        const opciones=Object.keys(st.ofrece||{}).filter(k=>(st.ofrece||{})[k])
          .map(k=>({ clave:k, etiqueta:ETIQ[k]||k, precio: k==="extender"?null:Number((st.precios||{})[k]||0) }));
        return J({ ok:true, hay:true, estado:st.estado, elegida:st.elegida, monto:Number(st.monto||0),
          hora:mxHora(), cuarto:st.cuarto, opciones,
          mensaje:`Hoy era tu día de salida y ya son las ${mxHora()}. Nuestra ama de llaves está revisando tu cuarto y vio que tus cosas siguen ahí.` });
      }

      // elegir
      if(st.estado==="cobrada") return J({ok:true, ya:true, estado:"cobrada", mensaje:"Eso ya está pagado."});
      const k=String(b.opcion||"");
      if(!(st.ofrece||{})[k]) return J({ok:false,error:"esa opción no está disponible"},409);
      const monto = k==="extender" ? 0 : Number((st.precios||{})[k]||0);
      await rest(`apepe_salida_tarde?id=eq.${st.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ estado:"elegida", elegida:k, elegida_at:new Date().toISOString(), monto, updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"elegida", elegida:k, etiqueta:ETIQ[k]||k, monto,
        mensaje: k==="extender"
          ? "Perfecto. Mira tus opciones en «¿Te quedas más?» y te la apartamos."
          : (monto>0
              ? `Listo: ${ETIQ[k]}. Son $${monto}, que pasas a pagar en recepción.`
              : `Listo: ${ETIQ[k]}. Va por nuestra cuenta.`) });
    }

    // ===== EQUIPO =====
    if(!em) return J({ok:false,error:"hay que entrar con tu cuenta de colaborador"},401);

    /* La recamarista. Un botón y ya: ni precios ni promesas, que eso lo decide
       recepción. Lo único que dice es "sus cosas siguen aquí". */
    if(op==="marcar"){
      const rid=String(b.reservation_id||""); const prop=String(b.prop||"cdmx");
      if(!rid) return J({ok:false,error:"falta la reserva"},400);
      const fecha=String(b.fecha||mxHoy());
      const op_key=`${rid}:${fecha}`;
      try{ const ya=await rest(`apepe_salida_tarde?op_key=eq.${encodeURIComponent(op_key)}&select=id,estado&limit=1`);
        if(Array.isArray(ya)&&ya[0]) return J({ok:true, ya:true, estado:ya[0].estado, mensaje:"Ya estaba avisado. Recepción lo tiene."}); }catch{}
      await rest(`apepe_salida_tarde`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify({ op_key, reservation_id:rid, property:prop, fecha,
          cuarto:String(b.cuarto||""), huesped:String(b.huesped||""),
          estado:"marcada", marcada_por:em, nota_recamarera:String(b.nota||"")||null,
          updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"marcada", mensaje:"Avisado. Recepción decide qué le ofrece y te dice." });
    }

    /* El día: salidas de hoy de Cloudbeds, con lo que ya está marcado. Es lo que ve
       la recamarista en su teléfono y lo que ve recepción en su tablero. */
    if(op==="dia"){
      const prop=String(b.prop||"cdmx"); const fecha=String(b.fecha||mxHoy());
      const cfg=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfg.keyEnv); const pid=cfg.id??Deno.env.get(cfg.idEnv??"");
      if(!key||!pid) return J({ok:false,error:"sin credenciales"},502);
      const u=new URL(`${CB}/getReservations`); u.searchParams.set("propertyID",String(pid));
      u.searchParams.set("checkOutFrom",fecha); u.searchParams.set("checkOutTo",fecha); u.searchParams.set("pageSize","100");
      let salidas:any[]=[];
      try{ const r=await fetch(u.toString(),{headers:{Authorization:`Bearer ${key}`}}); const j=await r.json().catch(()=>({})); salidas=Array.isArray(j.data)?j.data:[]; }catch{}
      salidas=salidas.filter((x:any)=>!/cancel|no_show/i.test(String(x.status||"")));
      let marcas:any[]=[];
      try{ marcas=await rest(`apepe_salida_tarde?fecha=eq.${fecha}&property=eq.${prop}&select=*&order=marcada_at.desc`)||[]; }catch{}
      const porRid:Record<string,any>={}; for(const m of marcas) porRid[String(m.reservation_id)]=m;

      /* Las extensiones que el huésped ya cerró en la app y están esperando el cobro.
         Van aquí porque si no, no las ve NADIE: la app le dice "pasa a recepción a
         pagar" y recepción no tenía dónde enterarse. Es el mismo agujero que tenía el
         upgrade — el trato cerrado con el huésped y muerto en una tabla. Javi, 29-sep. */
      const hace7=mxHoy(-7);
      let extensiones:any[]=[];
      try{ extensiones=await rest(
        `apepe_extension?property=eq.${prop}&estado=in.(por_cobrar,error,cobrado)` +
        `&updated_at=gte.${hace7}T00:00:00Z&select=*&order=updated_at.desc&limit=40`)||[]; }catch{}

      /* Quién es cada quien: la extensión sólo guarda el id de la reserva. */
      const faltan=extensiones.filter((e:any)=>!porRid[String(e.reservation_id)]).slice(0,15);
      const nombres:Record<string,string>={};
      await Promise.all(faltan.map(async (e:any)=>{
        const d=await cbGet(key, `getReservation?reservationID=${encodeURIComponent(String(e.reservation_id))}&propertyID=${pid}`);
        const r=d?.data??d;
        const gl=r?.guestList&&typeof r.guestList==="object"?Object.values(r.guestList) as any[]:[];
        const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{};
        nombres[String(e.reservation_id)]=[main.guestFirstName,main.guestLastName].filter(Boolean).join(" ")||String(r?.guestName||"");
      }));

      return J({ ok:true, fecha, hora:mxHora(),
        salidas: salidas.map((x:any)=>({ reservation_id:String(x.reservationID), nombre:x.guestName||"",
          desde:x.startDate||"", hasta:x.endDate||"", estado_cb:String(x.status||""),
          marca: porRid[String(x.reservationID)]||null })),
        marcas,
        extensiones: extensiones.map((e:any)=>({ ...e,
          huesped: nombres[String(e.reservation_id)] || (porRid[String(e.reservation_id)]||{}).huesped || "" })) });
    }

    /* Recepción: elige qué se le ofrece y con eso se le avisa al huésped. Aquí es
       donde se congelan los precios. */
    if(op==="ofrecer"){
      const id=Number(b.id||0); if(!id) return J({ok:false,error:"falta el id"},400);
      let st:any=null;
      try{ const r=await rest(`apepe_salida_tarde?id=eq.${id}&select=*&limit=1`); st=Array.isArray(r)&&r[0]?r[0]:null; }catch{}
      if(!st) return J({ok:false,error:"no existe"},404);
      const prop=String(st.property||"cdmx");
      const cfg=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfg.keyEnv); const pid=cfg.id??Deno.env.get(cfg.idEnv??"");
      if(!key||!pid) return J({ok:false,error:"sin credenciales"},502);

      const { base, d } = await baseNoche(key,String(pid),String(st.reservation_id),String(st.fecha));
      const ofrece={ h1:!!b.h1, h15:!!b.h15, h17:!!b.h17, extender:!!b.extender };
      if(!ofrece.h1 && !ofrece.h15 && !ofrece.h17 && !ofrece.extender) return J({ok:false,error:"no elegiste ninguna opción"},400);
      const precios={ h1:0, h15:Math.round(base*TARIFA.h15), h17:Math.round(base*TARIFA.h17) };

      const gl=d?.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[];
      const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{};
      const nombre=[main.guestFirstName,main.guestLastName].filter(Boolean).join(" ")||st.huesped||"";

      await rest(`apepe_salida_tarde?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ estado:"ofrecida", ofrece, precios, base_noche:base,
          huesped:nombre||st.huesped, ofrecida_por:em, ofrecida_at:new Date().toISOString(),
          updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"ofrecida", base_noche:base, precios, ofrece,
        mensaje:`Listo. ${nombre||"El huésped"} ve sus opciones en la app.` });
    }

    /* Cobrar la extensión. La noche ya está apartada en Cloudbeds y el folio ya
       cuadrado; lo único que faltaba era que alguien dijera que el dinero entró. */
    if(op==="cobrar_extension"){
      const id=Number(b.id||0); if(!id) return J({ok:false,error:"falta el id"},400);
      await rest(`apepe_extension?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ estado:"cobrado", cobrado_por:em, cobrado_at:new Date().toISOString(), updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"cobrado" });
    }

    if(op==="cobrar"){
      const id=Number(b.id||0); if(!id) return J({ok:false,error:"falta el id"},400);
      await rest(`apepe_salida_tarde?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ estado:"cobrada", cobrado_por:em, cobrado_at:new Date().toISOString(), updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"cobrada" });
    }

    if(op==="cerrar"){
      const id=Number(b.id||0); if(!id) return J({ok:false,error:"falta el id"},400);
      await rest(`apepe_salida_tarde?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({ estado:"cerrada", updated_at:new Date().toISOString() })});
      return J({ ok:true, estado:"cerrada" });
    }

    return J({ok:false,error:"op no reconocida"},400);
  }catch(e){ console.error(e); return J({ok:false,error:String(e)},500); }
});
