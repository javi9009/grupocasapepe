// apepe-extender — "¿me puedo quedar una noche más?", contestado en serio.
//
// La pregunta del huésped no es si hay cuartos: es si puede quedarse SIN MOVERSE de
// su cama. Por eso esto no se resuelve mirando disponibilidad y ya. Hay tres capas:
//
//   1) ¿Hay sitio? Se lo preguntamos a getAvailableRoomTypes, que es el motor de
//      disponibilidad de Cloudbeds. Es la única fuente que no se equivoca.
//   2) ¿Hay sitio EN SU CAMA? Eso ya es cosa nuestra: hay que mirar cama por cama
//      quién duerme dónde cada noche. Lo sacamos de las reservas con detalle de
//      tarifa, que traen roomID y las noches exactas.
//   3) Si su cama la tiene ocupada alguien que LLEGA, todavía se puede: movemos al
//      que llega a otra cama libre del mismo dormitorio. Pero respetando alta o baja
//      —las pares son bajas y las impares altas—, porque a nadie le hace gracia
//      reservar una baja y encontrarse arriba.
//
// Cuando la capa 2 no alcanza para estar seguros, NO inventamos: le decimos que
// puede extender pero que a lo mejor le cambiamos de cama. Prometerle su cama y luego
// moverlo es peor que avisarle antes.
//
// Precio: la tarifa viva de Cloudbeds de esa noche, con el 15% de SuperPepe.
// Ventana: desde 2 días antes de su salida hasta las 12:00 del día de salida. Pasada
// esa hora ya no es extensión, es late checkout, y eso lo decide recepción.
// Javi, 28-sep.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = { cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"} };
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (o: unknown, s=200) => new Response(JSON.stringify(o), { status:s, headers:{ ...cors, "Content-Type":"application/json" } });
const SUPERPEPE = 0.15;          // el mismo 15% de siempre
const MAX_NOCHES = 7;            // hasta dónde ofrecemos
const ABRE_DIAS_ANTES = 2;       // "dos días antes de su checkout" — Javi
const CIERRA_HORA = 12;          // a las 12:00 deja de ser extensión

async function rest(path: string, init: RequestInit = {}) { const r=await fetch(SB+"/rest/v1/"+path,{ ...init, headers:{ ...H, ...(init.headers||{}) } }); const t=await r.text(); if(!r.ok) throw new Error(path+" "+r.status+" "+t.slice(0,140)); return t?JSON.parse(t):null; }
async function tokenLookup(tok: string){ try{ const j=await rest(`apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`); return Array.isArray(j)&&j[0]?j[0]:null; }catch{ return null; } }
async function cbGet(key: string, path: string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }

/* Hora de la Ciudad de México sin librerías: el servidor corre en UTC y aquí la
   diferencia manda, porque el corte de las 12:00 decide si esto es una extensión o
   un late checkout. */
function ahoraMX(){ const d=new Date(Date.now()-6*3600*1000); return { fecha:d.toISOString().slice(0,10), hora:d.getUTCHours(), min:d.getUTCMinutes() }; }
function masDias(iso:string, n:number){ const d=new Date(iso+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function diffDias(a:string,b:string){ try{ return Math.round((new Date(b+"T12:00:00Z").getTime()-new Date(a+"T12:00:00Z").getTime())/86400000); }catch{ return 0; } }

/* El número de cama vive dentro del nombre del cuarto en Cloudbeds: "4MD(241)".
   De ahí sale todo lo demás: la paridad dice si es alta o baja. */
function camaDe(roomName:string){ const m=/\((\d+)\)/.exec(String(roomName||"")); if(!m) return null; const n=Number(m[1]); if(!isFinite(n)) return null; return n; }
function nivelDe(cama:number|null){ if(cama==null) return ""; return (cama%2===0) ? "baja" : "alta"; }

/* getRooms viene paginado y sin paginar miente: devuelve un solo tipo de cuarto y
   parece que la casa tiene veinte camas. */
async function inventario(key:string, pid:string){
  const out:any[]=[];
  for(let p=1;p<=8;p++){
    const j=await cbGet(key, `getRooms?propertyID=${pid}&pageSize=100&pageNumber=${p}`);
    const d=j?.data??[]; let n=0;
    if(Array.isArray(d)) for(const blk of d){ const rs=Array.isArray(blk?.rooms)?blk.rooms:(blk?.roomID?[blk]:[]); for(const r of rs){ out.push(r); n++; } }
    if(n<100) break;
  }
  return out.map((r:any)=>({ roomID:String(r.roomID||""), roomName:String(r.roomName||""), roomTypeID:String(r.roomTypeID||""),
                             isPrivate:!!r.isPrivate, cama:camaDe(r.roomName), nivel:nivelDe(camaDe(r.roomName)) }))
            .filter((r:any)=>r.roomID);
}

/* Quién duerme en qué cama y qué noches. detailedRoomRates trae las noches exactas
   de cada cuarto de cada reserva, que es justo el grano que hace falta. */
async function ocupacion(key:string, pid:string, desde:string, hasta:string){
  const mapa:Record<string,Record<string,any>>={};  // roomID -> fecha -> {rid, llega}
  let incompleto=false;
  for(let p=1;p<=6;p++){
    let j:any={};
    try{ j=await cbGet(key, `getReservationsWithRateDetails?propertyID=${pid}&resultsFrom=${desde}&resultsTo=${hasta}&pageSize=100&pageNumber=${p}`); }
    catch{ incompleto=true; break; }
    const d=Array.isArray(j?.data)?j.data:[];
    for(const r of d){
      const st=String(r.status||"");
      if(/cancel|no_show|void/i.test(st)) continue;      // esas no ocupan
      const rooms=Array.isArray(r.rooms)?r.rooms:[];
      for(const rm of rooms){
        const roomID=String(rm.roomID||""); if(!roomID) continue;
        const det=rm.detailedRoomRates||{};
        for(const f of Object.keys(det)){
          if(!mapa[roomID]) mapa[roomID]={};
          mapa[roomID][f]={ rid:String(r.reservationID||""), llega:String(r.startDate||""), sale:String(r.endDate||""), nombre:String(r.guestName||"") };
        }
      }
    }
    if(d.length<100) break;
  }
  return { mapa, incompleto };
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return J({ok:false,error:"POST only"},405);
  try{
    const b:any = await req.json().catch(()=>({}));
    let rid=String(b.reservation_id||""); let prop=String(b.prop||"cdmx");
    if(!rid && (b.resv||b.token)){ const row=await tokenLookup(String(b.resv||b.token)); if(row){ rid=String(row.reservation_id); prop=row.property||"cdmx"; } }
    if(!rid) return J({ok:false,error:"falta la reserva"},400);

    const cfgp=PROP[prop]||PROP.cdmx; const key=Deno.env.get(cfgp.keyEnv); const pid=cfgp.id??Deno.env.get(cfgp.idEnv??"");
    if(!key||!pid) return J({ok:false,error:"sin credenciales"},502);

    const gr=await cbGet(key,`getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
    const d=gr?.data??gr; if(!d||!d.reservationID) return J({ok:false,error:"reserva no encontrada"},404);
    const status=String(d.status||"");
    const rooms=[...(Array.isArray(d.assigned)?d.assigned:[]),...(Array.isArray(d.unassigned)?d.unassigned:[])];
    const r0=rooms[0]||{};
    const miTipo=String(r0.roomTypeID||""); const miTipoNombre=String(r0.roomTypeName||"");
    const miCuarto=String(r0.roomID||"");   const miCuartoNombre=String(r0.roomName||"");
    const miCama=camaDe(miCuartoNombre);    const miNivel=nivelDe(miCama);
    const salida=String(d.endDate||"");     const llegada=String(d.startDate||"");
    const adults=Number(r0.adults||1)||1;   const children=Number(r0.children||0)||0;

    const hoy=ahoraMX();
    const faltan=diffDias(hoy.fecha, salida);
    const abierto = faltan<=ABRE_DIAS_ANTES && (faltan>0 || (faltan===0 && hoy.hora<CIERRA_HORA));
    const base = {
      ok:true, reserva:{ id:rid, property:prop, llegada, salida, estado:status,
        cuarto:{ tipo:miTipo, tipo_nombre:miTipoNombre, unidad:miCuarto, unidad_nombre:miCuartoNombre, cama:miCama, nivel:miNivel } },
      ventana:{ abierta:abierto, faltan_dias:faltan, abre_el:masDias(salida,-ABRE_DIAS_ANTES), cierra:`${CIERRA_HORA}:00 del ${salida}`, ahora:`${hoy.fecha} ${String(hoy.hora).padStart(2,"0")}:${String(hoy.min).padStart(2,"0")}` },
    };

    if(!abierto){
      const tarde = faltan===0 && hoy.hora>=CIERRA_HORA;
      return J({ ...base, opciones:[],
        motivo: tarde ? "tarde" : "pronto",
        mensaje: tarde
          ? "Ya pasaron las 12:00 de tu día de salida, así que esto ya no es una extensión. Pregúntanos en recepción por un late checkout."
          : `Podrás pedir tu extensión desde el ${masDias(salida,-ABRE_DIAS_ANTES)}.` });
    }

    /* === 1) ¿HAY SITIO Y A CUÁNTO? UNA CONSULTA POR NOCHE. ===
       getAvailableRoomTypes devuelve el roomRate del RANGO ENTERO, no el de una noche.
       Pedidas las siete noches de golpe contestaba 3150 para una cama de dormitorio —que
       son los siete días a 450— y con eso le habríamos cobrado siete noches por una.
       Igual con la disponibilidad: el número del rango es el de las camas libres LAS
       SIETE noches, así que una sola noche llena tapaba las otras seis. */
    const hasta = masDias(salida, MAX_NOCHES);
    const nochesCand:string[]=[]; for(let k=0;k<MAX_NOCHES;k++) nochesCand.push(masDias(salida,k));
    const porNoche = await Promise.all(nochesCand.map(async (n)=>{
      const av = await cbGet(key, `getAvailableRoomTypes?propertyID=${pid}&startDate=${n}&endDate=${masDias(n,1)}&rooms=1&adults=1`);
      const ad=av?.data??av; let lista:any[]=[];
      if(Array.isArray(ad)){ for(const p of ad){ if(Array.isArray(p.propertyRooms)) lista=lista.concat(p.propertyRooms); else if(p.roomTypeID) lista.push(p); } }
      const m:Record<string,{n:number;rate:number;nombre:string}>={};
      for(const x of lista){ m[String(x.roomTypeID)]={ n:Number(x.roomsAvailable||0), rate:Number(x.roomRate||0), nombre:String(x.roomTypeName||"") }; }
      return m;
    }));
    const disp = porNoche[0]||{};
    const miDisp = disp[miTipo]||{n:0,rate:0,nombre:miTipoNombre};

    // === 2) ¿EN SU CAMA? ===
    const inv = await inventario(key, pid);
    const camasDelTipo = inv.filter((r:any)=>r.roomTypeID===miTipo);
    const oc = await ocupacion(key, pid, masDias(salida,-30), hasta);

    function libre(roomID:string, noche:string){ return !(oc.mapa[roomID]||{})[noche]; }
    function quien(roomID:string, noche:string){ return (oc.mapa[roomID]||{})[noche]||null; }

    const noches:any[]=[];
    for(let k=0;k<MAX_NOCHES;k++){
      const noche = nochesCand[k];
      const dn = porNoche[k]||{};
      const mio = dn[miTipo]||{n:0,rate:0,nombre:miTipoNombre};
      const hayTipo = mio.n>0;                        // el motor dice que esa noche queda algo de su tipo
      const miCamaLibre = miCuarto ? libre(miCuarto, noche) : false;
      const ocupa = miCuarto ? quien(miCuarto, noche) : null;
      /* Que el que la ocupa LLEGUE ese día es lo que la hace movible: si ya viene
         durmiendo ahí de antes, moverlo es sacarlo de su cama, no reubicar una
         llegada. */
      const esLlegada = !!(ocupa && ocupa.llega===noche);
      const huecos = camasDelTipo.filter((c:any)=> c.roomID!==miCuarto && libre(c.roomID,noche));
      const huecosMismoNivel = huecos.filter((c:any)=> c.nivel===nivelDe(camaDe(miCuartoNombre)));
      /* Para reubicar al que llega hay que ofrecerle SU nivel, no el primero libre. */
      const nivelDelQueLlega = ocupa ? miNivel : "";
      const reubicables = huecos.filter((c:any)=> !nivelDelQueLlega || c.nivel===nivelDelQueLlega);

      let modo="", cama_destino=null, mover=null;
      if(!hayTipo){ modo="sin_sitio"; }
      else if(miCamaLibre){ modo="misma_cama"; cama_destino=miCuarto; }
      else if(esLlegada && reubicables.length){ modo="misma_cama_moviendo"; cama_destino=miCuarto; mover={ a:reubicables[0].roomName, rid:ocupa?.rid||"" }; }
      else if(huecosMismoNivel.length){ modo="otra_cama"; cama_destino=huecosMismoNivel[0].roomID; }
      else if(huecos.length){ modo="otra_cama"; cama_destino=huecos[0].roomID; }
      else { modo = oc.incompleto ? "quiza" : "sin_sitio"; }

      const tarifa = Number(mio.rate||0);
      const precio = Math.round(tarifa*(1-SUPERPEPE));
      noches.push({ noche, modo,
        cama_destino, cama_destino_nombre: (camasDelTipo.find((c:any)=>c.roomID===cama_destino)||{}).roomName || "",
        mueve_a_otro: mover, tarifa, precio, ahorro: Math.round(tarifa-precio),
        libre_en_el_tipo: mio.n });
    }

    /* Se ofrecen noches seguidas: extender la 3 sin la 1 y la 2 no existe. */
    const ofrecibles:any[]=[]; let acum=0;
    for(const n of noches){ if(n.modo==="sin_sitio") break; acum+=n.precio; ofrecibles.push({ ...n, noches:ofrecibles.length+1, total:acum }); }

    // === 3) Si le toca cambiarse de cama, el upgrade es una salida mejor que aguantarse ===
    let upgrade:any=null;
    const cambiaCama = ofrecibles.length && ofrecibles[0].modo!=="misma_cama" && ofrecibles[0].modo!=="misma_cama_moviendo";
    if(ofrecibles.length){
      let mejor:any=null;
      for(const [tid,v] of Object.entries<any>(disp)){
        if(tid===miTipo || !v.n) continue;
        if(v.rate<=miDisp.rate) continue;                 // upgrade es subir, no bajar
        if(!mejor || v.rate<mejor.rate) mejor={ tid, ...v };   // el más barato de los que suben
      }
      if(mejor) upgrade={ tipo:mejor.tid, nombre:mejor.nombre, tarifa:mejor.rate,
        precio:Math.round(mejor.rate*(1-SUPERPEPE)),
        aviso:"Es otra habitación, así que tendríamos que cambiarte de cuarto." };
    }

    return J({ ...base,
      cama_libre_en_el_tipo: miDisp.n, tarifa_noche: miDisp.rate, descuento:"15% SuperPepe",
      datos_completos: !oc.incompleto,
      camas_del_tipo: camasDelTipo.length,
      opciones: ofrecibles, upgrade, cambia_cama: cambiaCama,
      pax:{ adults, children },
      mensaje: ofrecibles.length
        ? (cambiaCama ? "Puedes quedarte, pero tendríamos que cambiarte de cama." : "Puedes quedarte en tu misma cama.")
        : "Para esas noches ya no nos queda sitio en tu dormitorio." });
  }catch(e){ console.error(e); return J({ok:false,error:String(e)},500); }
});
