// apepe-extender — "¿me puedo quedar una noche más?", contestado en serio.
//
// Lo que el huésped pregunta no es si hay camas: es si tiene que hacer la maleta.
// Así que el motor no devuelve "sí/no", devuelve una ESCALERA de sitios donde puede
// dormir, ordenada por lo que le cuesta —primero en comodidad, luego en dinero:
//
//   1. Su misma cama. Cero mudanza.
//   2. Su misma cama, moviendo al que llegaba a ella (sólo si LLEGA ese día: al que
//      ya viene durmiendo ahí no se le toca).
//   3. Otra cama de su mismo dormitorio. Mismo precio. Prefiere su nivel —las pares
//      son bajas y las impares altas— pero si no hay, la alta también vale.
//   4. Otro dormitorio al mismo precio.
//   5. Otro tipo de dormitorio, o una privada, por precio de menor a mayor.
//
// LA REGLA DE LAS PERSONAS: mover de cama está bien cuando la reserva es de UNO. Si
// son dos o más, se mueve la reserva ENTERA o no se mueve: no se parte un grupo por
// dormitorios distintos. Por eso todo se calcula pidiendo tantas camas libres como
// camas tiene la reserva, y las mismas todas las noches del tramo.
//
// Y todo lo que no sea su misma cama lleva el mismo aviso: que deje sus cosas
// juntas, porque quien lo muda es Housekeeping y no puede andar recogiendo.
//
// Precio: tarifa viva de Cloudbeds de esa noche, con el 15% de SuperPepe.
// Javi, 28-sep.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const PROP: Record<string,{keyEnv:string;id?:string;idEnv?:string}> = { cdmx:{keyEnv:"CLOUDBEDS_API_KEY",id:"10668"}, puebla:{keyEnv:"CLOUDBEDS_API_KEY_PUEBLA",idEnv:"CLOUDBEDS_PROPERTY_ID_PUEBLA"} };
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const J = (o: unknown, s=200) => new Response(JSON.stringify(o), { status:s, headers:{ ...cors, "Content-Type":"application/json" } });
const SUPERPEPE = 0.15;
const MAX_NOCHES = 7;
/* Ya no hay puerta de entrada. Estaba abierto sólo los dos últimos días y Javi
   tiene razón: hay quien lo pide con dos días de antelación, y quien el segundo día
   de una estancia de diez ya sabe que se queda más. Cerrarlo antes de tiempo sólo
   conseguía que preguntaran en recepción lo que la app podía contestarles sola.
   La única puerta que queda es la de salida. Javi, 29-sep. */
const CIERRA_HORA = 12;
const AVISO_MUDANZA = "Deja tus cosas juntas y listas: te las mueve Housekeeping.";

async function rest(p: string, init: RequestInit = {}) { const r=await fetch(SB+"/rest/v1/"+p,{ ...init, headers:{ ...H, ...(init.headers||{}) } }); const t=await r.text(); if(!r.ok) throw new Error(p+" "+r.status+" "+t.slice(0,140)); return t?JSON.parse(t):null; }
async function tokenLookup(tok: string){ try{ const j=await rest(`apepe_reserva_token?token=eq.${encodeURIComponent(tok)}&select=reservation_id,property&limit=1`); return Array.isArray(j)&&j[0]?j[0]:null; }catch{ return null; } }
async function cfgv(c:string){ try{ const x=await rest(`apepe_config?clave=eq.${c}&select=valor&limit=1`); return Array.isArray(x)&&x[0]?String(x[0].valor||""):""; }catch{ return ""; } }
async function cbGet(key: string, path: string){ const r=await fetch(`${CB}/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json().catch(()=>({})); }
// putReservation SOLO contesta a PUT; postAdjustment es POST. Por eso el verbo es parámetro.
async function cbForm(key:string, ep:string, form:Record<string,string>, method="POST"){ const body=new URLSearchParams(form).toString(); const r=await fetch(`${CB}/${ep}`,{method,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body}); const t=await r.text(); let j:any={}; try{ j=JSON.parse(t); }catch{ j={raw:t.slice(0,200)}; } return {status:r.status, ok:r.ok&&j?.success!==false, j}; }

function ahoraMX(){ const d=new Date(Date.now()-6*3600*1000); return { fecha:d.toISOString().slice(0,10), hora:d.getUTCHours(), min:d.getUTCMinutes() }; }
function masDias(iso:string, n:number){ const d=new Date(iso+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function diffDias(a:string,b:string){ try{ return Math.round((new Date(b+"T12:00:00Z").getTime()-new Date(a+"T12:00:00Z").getTime())/86400000); }catch{ return 0; } }

/* El número de cama vive dentro del nombre del cuarto: "4MD(241)". La paridad dice
   si es alta o baja. */
function camaDe(rn:string){ const m=/\((\d+)\)/.exec(String(rn||"")); if(!m) return null; const n=Number(m[1]); return isFinite(n)?n:null; }
function nivelDe(c:number|null){ if(c==null) return ""; return (c%2===0)?"baja":"alta"; }

/* Caché. El inventario y la ocupación son IGUALES para todos los huéspedes y se
   estaban releyendo enteros en cada visita: de ahí los 33 segundos. */
async function cacheLee(clave:string, segundos:number){
  try{
    const r=await rest(`apepe_cache?clave=eq.${encodeURIComponent(clave)}&select=valor,updated_at&limit=1`);
    if(!Array.isArray(r)||!r[0]) return null;
    const edad=(Date.now()-new Date(r[0].updated_at).getTime())/1000;
    return edad<=segundos ? r[0].valor : null;
  }catch{ return null; }
}
async function cacheGuarda(clave:string, valor:unknown){
  try{ await rest(`apepe_cache`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({clave, valor, updated_at:new Date().toISOString()})}); }catch{}
}

/* getRooms viene paginado y sin paginar miente: devuelve un solo tipo de cuarto.
   Las camas de la casa cambian una vez al año, así que se guardan un día. */
async function inventario(key:string, pid:string, prop:string, fresco:boolean){
  const clave=`inventario:${prop}`;
  if(!fresco){ const c=await cacheLee(clave, 86400); if(Array.isArray(c)) return c as any[]; }
  const out:any[]=[];
  for(let p=1;p<=8;p++){
    const j=await cbGet(key, `getRooms?propertyID=${pid}&pageSize=100&pageNumber=${p}`);
    const d=j?.data??[]; let n=0;
    if(Array.isArray(d)) for(const blk of d){ const rs=Array.isArray(blk?.rooms)?blk.rooms:(blk?.roomID?[blk]:[]); for(const r of rs){ out.push(r); n++; } }
    if(n<100) break;
  }
  const lista=out.map((r:any)=>({ roomID:String(r.roomID||""), roomName:String(r.roomName||""), roomTypeID:String(r.roomTypeID||""),
                             isPrivate:!!r.isPrivate, cama:camaDe(r.roomName), nivel:nivelDe(camaDe(r.roomName)) }))
            .filter((r:any)=>r.roomID);
  if(lista.length) await cacheGuarda(clave, lista);
  return lista;
}

/* Quién duerme en qué cama y qué noches. detailedRoomRates trae las noches exactas.
   Las páginas van EN PARALELO: iban una detrás de otra y cada una tarda lo suyo,
   así que tres páginas eran casi medio minuto de espera él solo. Se piden tres de
   golpe y sólo se pide el segundo grupo si el primero vino lleno. */
async function ocupacion(key:string, pid:string, prop:string, desde:string, hasta:string, fresco:boolean){
  const clave=`ocupacion:${prop}:${desde}:${hasta}`;
  if(!fresco){ const c=await cacheLee(clave, 240); if(c && (c as any).mapa) return c as any; }

  const mapa:Record<string,Record<string,any>>={}; let incompleto=false;
  const pagina=async(p:number)=>{
    try{ const j=await cbGet(key, `getReservationsWithRateDetails?propertyID=${pid}&resultsFrom=${desde}&resultsTo=${hasta}&pageSize=100&pageNumber=${p}`);
      return Array.isArray(j?.data)?j.data:[]; }
    catch{ incompleto=true; return []; }
  };
  const mete=(d:any[])=>{
    for(const r of d){
      if(/cancel|no_show|void/i.test(String(r.status||""))) continue;
      for(const rm of (Array.isArray(r.rooms)?r.rooms:[])){
        const roomID=String(rm.roomID||""); if(!roomID) continue;
        for(const f of Object.keys(rm.detailedRoomRates||{})){
          if(!mapa[roomID]) mapa[roomID]={};
          mapa[roomID][f]={ rid:String(r.reservationID||""), llega:String(r.startDate||""), sale:String(r.endDate||"") };
        }
      }
    }
  };
  const g1=await Promise.all([pagina(1),pagina(2),pagina(3)]);
  g1.forEach(mete);
  if(g1[2].length===100){ const g2=await Promise.all([pagina(4),pagina(5),pagina(6)]); g2.forEach(mete);
    if(g2[2].length===100) incompleto=true; }   // más de 600: no cabe, y hay que decirlo

  const out={ mapa, incompleto };
  if(!incompleto) await cacheGuarda(clave, out);
  return out;
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
    const misCuartos=rooms.map((r:any)=>String(r.roomID||"")).filter(Boolean);
    const miCuartoNombre=String(r0.roomName||"");
    const miNivel=nivelDe(camaDe(miCuartoNombre));
    const salida=String(d.endDate||""); const llegada=String(d.startDate||"");

    /* Cuántas camas ocupa la reserva. Es lo que hay que reservar junto si hay que
       moverlos: la regla de Javi es que un grupo no se parte. */
    const camasReserva = Math.max(1, rooms.length);
    const paxTotal = rooms.reduce((s:number,r:any)=>s+Number(r.adults||0)+Number(r.children||0),0) || 1;
    const soloUno = camasReserva===1 && paxTotal===1;

    /* El dormitorio femenino no se le ofrece a quien no puede dormir ahí. El upgrade
       ya filtraba por esto y aquí se me había pasado: la primera prueba contra la
       casa le ofreció a un huésped una cama en el femenino. El mapa de géneros es el
       mismo que usa el upgrade, para que no haya dos verdades. */
    const gl=d.guestList&&typeof d.guestList==="object"?Object.values(d.guestList) as any[]:[];
    const main=gl.find((g:any)=>g.isMainGuest)||gl[0]||{};
    const esFem=/^f/i.test(String(main.guestGender||""));
    let cfgUp:any={}; try{ cfgUp=JSON.parse(await cfgv(`apepe_upgrade_${prop}`)||"{}"); }catch{}
    const generoDe=(tid:string)=>String(((cfgUp.dorms||{})[String(tid)]||{}).gen||"");
    function puedeDormir(tid:string){
      const g=generoDe(tid);
      if(g==="fem") return esFem;            // femenino: sólo ellas
      return true;                            // mixto y queer: abiertos
    }

    const hoy=ahoraMX();
    const faltan=diffDias(hoy.fecha, salida);
    /* Abierto toda su estancia. Se cierra sólo cuando ya deja de ser una extensión:
       pasadas las 12:00 de su día de salida —ahí ya es late checkout y lo decide
       recepción— o cuando la estancia terminó. */
    const seFue = /checked_out/i.test(status);
    const abierto = !seFue && (faltan>0 || (faltan===0 && hoy.hora<CIERRA_HORA));
    const base = { ok:true, reserva:{ id:rid, property:prop, llegada, salida, estado:status,
        pax:paxTotal, camas:camasReserva, solo_uno:soloUno,
        cuarto:{ tipo:miTipo, tipo_nombre:miTipoNombre, unidad:misCuartos[0]||"", unidad_nombre:miCuartoNombre, nivel:miNivel } },
      ventana:{ abierta:abierto, faltan_dias:faltan, cierra:`${CIERRA_HORA}:00 del ${salida}`, ahora:`${hoy.fecha} ${String(hoy.hora).padStart(2,"0")}:${String(hoy.min).padStart(2,"0")}` } };

    if(/cancel|no_show/i.test(status)) return J({ ...base, escalera:[], motivo:"reserva_no_activa", mensaje:"Esta reserva ya no está activa." });
    if(!abierto){
      const tarde = !seFue && faltan<=0;
      return J({ ...base, escalera:[], motivo: tarde?"tarde":"fuera",
        mensaje: tarde
          ? "Ya pasaron las 12:00 de tu día de salida, así que esto ya no es una extensión. Pregúntanos en recepción por un late checkout."
          : "Tu estancia ya terminó. ¡Vuelve pronto!" });
    }

    /* UNA CONSULTA POR NOCHE. getAvailableRoomTypes devuelve el roomRate del RANGO
       ENTERO: pidiendo siete noches de golpe contestaba 3150 para una cama de
       dormitorio —los siete días a 450— y le habríamos cobrado siete por una. La
       disponibilidad igual: el número del rango son las camas libres LAS SIETE
       noches, así que una sola noche llena tapaba las otras seis. */
    const hasta = masDias(salida, MAX_NOCHES);
    const cand:string[]=[]; for(let k=0;k<MAX_NOCHES;k++) cand.push(masDias(salida,k));

    /* Mirar es una cosa y apartar es otra. Para mirar vale el caché —el huésped ve
       sus opciones al instante—, pero al apartar se relee todo en vivo: entre que
       abrió la pantalla y tocó el botón le pueden haber vendido la cama, y vender
       dos veces la misma noche no se arregla con una disculpa. */
    const fresco = String(b.op||"")==="pedir";

    /* Los tres bloques a la vez. Iban en fila —disponibilidad, luego inventario,
       luego ocupación— y se sumaban sus esperas: 33 segundos de pantalla en blanco
       en la primera prueba de verdad. */
    const [porNoche, inv, oc] = await Promise.all([
      Promise.all(cand.map(async (n)=>{
        const av=await cbGet(key, `getAvailableRoomTypes?propertyID=${pid}&startDate=${n}&endDate=${masDias(n,1)}&rooms=1&adults=1`);
        const ad=av?.data??av; let l:any[]=[];
        if(Array.isArray(ad)){ for(const p of ad){ if(Array.isArray(p.propertyRooms)) l=l.concat(p.propertyRooms); else if(p.roomTypeID) l.push(p); } }
        const m:Record<string,{n:number;rate:number;nombre:string}>={};
        for(const x of l) m[String(x.roomTypeID)]={ n:Number(x.roomsAvailable||0), rate:Number(x.roomRate||0), nombre:String(x.roomTypeName||"") };
        return m;
      })),
      inventario(key, pid, prop, fresco),
      /* Catorce días atrás alcanzan para pillar a quien lleva aquí una temporada sin
         arrastrar tres meses de reservas que no tocan estas noches. */
      ocupacion(key, pid, prop, masDias(salida,-14), hasta, fresco),
    ]);
    const libre=(id:string,n:string)=>!(oc.mapa[id]||{})[n];
    const quien=(id:string,n:string)=>(oc.mapa[id]||{})[n]||null;

    /* Precio de un tipo para un tramo: la tarifa de CADA noche por las camas que
       ocupa la reserva, y encima el 15%. */
    function precioTramo(tipoID:string, k:number){
      let sin=0, hay=true;
      for(let i=0;i<=k;i++){ const v=(porNoche[i]||{})[tipoID]; if(!v||v.n<camasReserva){ hay=false; break; } sin+=v.rate*camasReserva; }
      return hay ? { hay, sin:Math.round(sin), con:Math.round(sin*(1-SUPERPEPE)) } : { hay:false, sin:0, con:0 };
    }
    function camasLibres(tipoID:string, k:number, excluir:string[]){
      const tramo=cand.slice(0,k+1);
      return inv.filter((c:any)=> c.roomTypeID===tipoID && !excluir.includes(c.roomID) && tramo.every((n:string)=>libre(c.roomID,n)));
    }

    /* La escalera, para cada número de noches. */
    const escalera:any[]=[];
    for(let k=0;k<MAX_NOCHES;k++){
      const tramo=cand.slice(0,k+1);
      const alts:any[]=[];

      const pMio=precioTramo(miTipo,k);

      // 1) sus mismas camas, libres todo el tramo
      const suyasLibres = misCuartos.length>0 && misCuartos.every((id:string)=>tramo.every((n:string)=>libre(id,n)));
      if(pMio.hay && suyasLibres) alts.push({ tipo:"misma_cama", etiqueta:"Tu misma cama", detalle:miCuartoNombre,
        room_type:miTipo, camas:misCuartos, camas_nombre:[miCuartoNombre], mueve_cosas:false, sin:pMio.sin, precio:pMio.con });

      // 2) su cama, moviendo al que LLEGABA a ella (al que ya duerme ahí no se le toca)
      if(pMio.hay && !suyasLibres && soloUno){
        const id=misCuartos[0]||"";
        const chocan = tramo.map((n:string)=>quien(id,n)).filter(Boolean);
        const todosLlegan = chocan.length>0 && chocan.every((o:any)=>tramo.includes(o.llega));
        const huecos = camasLibres(miTipo,k,misCuartos);
        const suNivel = huecos.filter((c:any)=>c.nivel===miNivel);
        if(todosLlegan && (suNivel.length||huecos.length)){
          const destino=(suNivel[0]||huecos[0]);
          alts.push({ tipo:"misma_cama_moviendo", etiqueta:"Tu misma cama", detalle:miCuartoNombre+" · lo cuadramos con recepción",
            room_type:miTipo, camas:misCuartos, camas_nombre:[miCuartoNombre], mueve_cosas:false,
            mover_a_otro:{ a:destino.roomName, rid:(chocan[0] as any).rid }, sin:pMio.sin, precio:pMio.con });
        }
      }

      // 3) otra(s) cama(s) de su mismo dormitorio — mismo precio; primero su nivel
      if(pMio.hay){
        const huecos=camasLibres(miTipo,k,misCuartos);
        const ordenados=[...huecos.filter((c:any)=>c.nivel===miNivel), ...huecos.filter((c:any)=>c.nivel!==miNivel)];
        if(ordenados.length>=camasReserva){
          const eleg=ordenados.slice(0,camasReserva);
          const cambiaNivel = eleg.some((c:any)=>c.nivel!==miNivel);
          alts.push({ tipo:"mismo_dorm", etiqueta:"Otra cama en tu mismo dormitorio",
            detalle: eleg.map((c:any)=>c.roomName).join(", ") + (cambiaNivel?` · cama ${eleg[0].nivel}`:""),
            room_type:miTipo, camas:eleg.map((c:any)=>c.roomID), camas_nombre:eleg.map((c:any)=>c.roomName),
            mueve_cosas:true, sin:pMio.sin, precio:pMio.con });
        }
      }

      // 4 y 5) otros tipos — otro dormitorio o una privada, ordenados por precio
      const otros:any[]=[];
      for(const tid of Object.keys(porNoche[0]||{})){
        if(tid===miTipo) continue;
        if(!puedeDormir(tid)) continue;          // el femenino no se le ofrece a quien no puede
        const p=precioTramo(tid,k); if(!p.hay) continue;
        const huecos=camasLibres(tid,k,[]);
        const priv=(inv.find((c:any)=>c.roomTypeID===tid)||{}).isPrivate;
        /* Para una privada basta el cuarto; para un dormitorio hacen falta tantas
           camas como tiene la reserva, y juntas: el grupo no se parte. */
        const necesita = priv ? 1 : camasReserva;
        if(huecos.length<necesita) continue;
        const eleg=huecos.slice(0,necesita);
        otros.push({ tipo: priv?"privada":"otro_dorm",
          etiqueta: priv?"Habitación privada":"Otro dormitorio",
          detalle: ((porNoche[0]||{})[tid]||{}).nombre || tid,
          room_type:tid, camas:eleg.map((c:any)=>c.roomID), camas_nombre:eleg.map((c:any)=>c.roomName),
          mueve_cosas:true, sin:p.sin, precio:p.con });
      }
      otros.sort((a,b)=>a.precio-b.precio);
      alts.push(...otros);

      if(!alts.length) break;                 // sin sitio esa noche: no se ofrecen las siguientes
      /* Clave única por alternativa. Con sólo el tipo, los tres "otro dormitorio"
         compartían identidad: en la pantalla se marcaban los tres a la vez y, peor,
         al apartar el servidor cogía el primero que coincidiera — otro cuarto y otro
         precio que los que el huésped había elegido. */
      alts.forEach((a:any)=>{ a.clave = a.tipo + (a.room_type&&a.room_type!==miTipo ? (":"+a.room_type) : ""); });
      escalera.push({ noches:k+1, hasta:masDias(salida,k+1), alternativas:alts,
        mejor:alts[0], desde:Math.min(...alts.map((a:any)=>a.precio)) });
    }

    /* === PEDIRLA. La noche se aparta AHORA; el cobro lo cierra recepción. ===
       Apartarla no es un capricho: entre que acepta y que baja a recepción, el motor
       puede vender esa misma cama. Lo que espera es el dinero, no el cuarto. */
    if(String(b.op||"")==="pedir"){
      const nQ=Number(b.noches||0);
      const fila=escalera.find((e:any)=>e.noches===nQ);
      if(!fila) return J({ok:false,error:"esas noches ya no están libres", escalera},409);
      const pedida=String(b.alternativa||"");
      const alt = fila.alternativas.find((a:any)=>a.clave===pedida)
               || fila.alternativas.find((a:any)=>a.tipo===pedida)   // compatibilidad
               || fila.mejor;
      const nuevaSalida=masDias(salida,nQ);
      const op_key=`${rid}:${nuevaSalida}`;

      /* LA PUERTA SÓLO LA CIERRA LO QUE DE VERDAD PASÓ. Javi, 1-nov-2026.
         Antes filtraba por op_key a secas, así que un intento fallido quemaba la
         combinación reserva+fecha: si el huésped volvía a pedirlo, la app le
         contestaba «esa extensión ya estaba pedida» con ok:true sin haber
         apartado nada. Les pasó a los cuatro de octubre. Un error no es una
         extensión; es un intento, y se puede repetir. Mismo criterio que
         apepe-upgrade-aplicar, que ya filtraba por estado. */
      try{ const ya=await rest(`apepe_extension?op_key=eq.${encodeURIComponent(op_key)}&estado=in.(por_cobrar,sin_cargo,cobrado)&select=id,estado,monto&limit=1`);
        if(Array.isArray(ya)&&ya[0]) return J({ok:true, ya:true, estado:ya[0].estado, monto:Number(ya[0].monto||0), nueva_salida:nuevaSalida, mensaje:"Esa extensión ya estaba pedida."}); }catch{}

      const antes=Number(d.total||0);

      /* EL TRAMO ENTERO, NO SÓLO LA FECHA. Javi, 1-nov-2026.
         Mandar `checkoutDate` suelto corre la salida y deja el desglose de
         tarifas con las noches viejas: la reserva queda con cuatro noches y tres
         tarifas, y Cloudbeds contesta «Number of days not equals to number of
         day rates». Así murieron las cuatro extensiones del 22 al 28 de octubre
         —y las dos de antes salieron sin cobrar por lo mismo, sólo que entonces
         Cloudbeds todavía retarificaba solo y lo tapaba.
         Ahora va el tramo completo —las dos fechas y los cuartos— que es la
         forma documentada de cambiar fechas, y con ella Cloudbeds retarifica.
         La cama se fija con roomID en cada fila: eso es lo que evita que nos la
         cambie, que era el motivo de mandar la fecha sola. Si esa cama no está
         libre la noche nueva, Cloudbeds rechaza la llamada, que es exactamente
         lo que queremos: antes se movía al huésped en silencio. */
      const destinoTipo = String(alt.room_type||miTipo);
      const camasDestino: string[] = (Array.isArray(alt.camas)&&alt.camas.length) ? alt.camas : misCuartos;
      const mover: Record<string,string> = {
        propertyID:String(pid), reservationID:rid,
        /* LAS DOS FECHAS, O NINGUNA: tocando `rooms` con sólo checkoutDate,
           Cloudbeds responde «Parameter checkinDate is required». Lo aprendió
           apepe-upgrade-aplicar el 29-sep. La entrada no se mueve: es la suya. */
        checkinDate: llegada, checkoutDate: nuevaSalida,
      };
      /* Una fila por cama, que es como viene la reserva: un dormitorio de tres
         camas son tres entradas, no una con quantity 3. Los adultos y los
         menores se copian de la fila que ya tenía, para no reescribir el pax. */
      camasDestino.forEach((roomID:string, i:number)=>{
        const orig = rooms[i] || rooms[0] || {};
        mover[`rooms[${i}][roomTypeID]`] = destinoTipo;
        mover[`rooms[${i}][quantity]`]   = "1";
        mover[`rooms[${i}][roomID]`]     = String(roomID);
        mover[`rooms[${i}][adults]`]     = String(Number(orig.adults||1));
        mover[`rooms[${i}][children]`]   = String(Number(orig.children||0));
      });

      /* Modo ensayo: enseña lo que mandaría sin tocar Cloudbeds. Es la puerta
         por la que se prueba un cambio en el PMS sin usar a un huésped de
         conejillo. Igual que `apepe_upgrade_activo` en el upgrade. */
      if(b.simular===true) return J({ok:true, simulado:true, nueva_salida:nuevaSalida, noches:nQ,
        monto:alt.precio, alternativa:alt.etiqueta, enviaria:mover});

      const mv=await cbForm(key,"putReservation",mover,"PUT");
      if(!mv.ok){
        try{ await rest(`apepe_extension?on_conflict=op_key`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({ op_key, reservation_id:rid, property:prop, salida_antes:salida, salida_despues:nuevaSalida, noches:nQ, monto:alt.precio, tarifa_sin_dto:alt.sin, cama_antes:miCuartoNombre, estado:"error", pedido_por:"huesped", detalle:{paso:"putReservation",resp:mv.j,enviado:mover}, updated_at:new Date().toISOString() })}); }catch{}
        return J({ok:false, error:"no pudimos apartar esa noche", detalle:mv.j},502);
      }

      /* Cloudbeds cobra la noche extra a la tarifa del día; nosotros prometimos esa
         tarifa menos el 15%. Releemos el folio y cuadramos la diferencia, igual que
         en el upgrade y en el winback: el folio tiene que decir lo que le dijimos. */
      const nd=await cbGet(key,`getReservation?reservationID=${encodeURIComponent(rid)}&propertyID=${pid}`);
      const dnd=(nd?.data??nd)||{};

      /* NO BASTA CON QUE LA LLAMADA NO FALLE. `cbForm` da por buena cualquier
         respuesta que no diga success:false, y el 20-oct eso dejó pasar un
         movimiento que no movió un peso. Así que se relee la reserva y se mira
         la fecha: si la salida no es la nueva, no hubo extensión, por mucho que
         la llamada contestara que sí. */
      const salidaReal = String(dnd.endDate||"");
      if(salidaReal !== nuevaSalida){
        try{ await rest(`apepe_extension?on_conflict=op_key`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({ op_key, reservation_id:rid, property:prop, salida_antes:salida, salida_despues:nuevaSalida, noches:nQ, monto:alt.precio, tarifa_sin_dto:alt.sin, cama_antes:miCuartoNombre, estado:"error", pedido_por:"huesped", detalle:{paso:"verificacion", esperada:nuevaSalida, quedo:salidaReal, resp:mv.j, enviado:mover}, updated_at:new Date().toISOString() })}); }catch{}
        return J({ok:false, error:"Cloudbeds aceptó la llamada pero la salida no se movió", esperada:nuevaSalida, quedo:salidaReal},502);
      }

      const cobroCB=Math.round((Number(dnd.total||0)-antes)*100)/100;
      const dif=Math.round((alt.precio-cobroCB)*100)/100;
      let ajuste:any={aplicado:true, cobro_cb:cobroCB, pactado:alt.precio, dif:0};
      if(Math.abs(dif)>=1){
        /* `type` es obligatorio y no estaba: por eso las dos primeras
           extensiones se quedaron sin el descuento, con «Parameter type is
           required». Cloudbeds admite fee, tax, rate y product; va `rate`
           porque esto es ingreso de habitación —la noche a la tarifa que le
           prometimos—, no un cargo suelto. Ponerlo como `fee` lo sacaría del
           ADR y ensuciaría el revenue. */
        const a=await cbForm(key,"postAdjustment",{ propertyID:String(pid), reservationID:rid, type:"rate", amount:String(dif), description:`Extensión ${nQ} noche(s) · SuperPepe −15%` });
        ajuste={aplicado:a.ok, cobro_cb:cobroCB, pactado:alt.precio, dif, resp:a.ok?undefined:a.j};
      }

      /* La asignación ya va dentro del movimiento de arriba: las camas de
         destino viajan como `rooms[i][roomID]` en la misma llamada. Antes era
         una segunda llamada con `rooms[0][roomID]` a secas, sin roomTypeID ni
         fechas, y Cloudbeds la rechazaba con «Parameter roomTypeID is
         required» — el 20-oct el huésped que había elegido la privada nunca se
         movió, y el estado guardado ni se enteró. Una sola llamada: o se mueve
         todo o no se mueve nada. */
      const cambiaDeCama = alt.tipo!=="misma_cama" && alt.tipo!=="misma_cama_moviendo" && !!alt.camas?.length;
      const asignada:any = cambiaDeCama ? { ok:true, camas:alt.camas_nombre, en:"el mismo putReservation" } : null;

      /* La ocupación acaba de cambiar por nuestra culpa: el caché que quede ya miente. */
      try{ await rest(`apepe_cache?clave=like.ocupacion:${prop}*`,{method:"DELETE",headers:{Prefer:"return=minimal"}}); }catch{}

      /* on_conflict=op_key explícito. Aquí op_key ES la clave primaria, así que
         merge-duplicates ya resolvía bien sin decirlo; se nombra para que no
         dependa de eso quien lea esto dentro de un año. */
      try{ await rest(`apepe_extension?on_conflict=op_key`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
        op_key, reservation_id:rid, property:prop, salida_antes:salida, salida_despues:nuevaSalida, noches:nQ,
        monto:alt.precio, tarifa_sin_dto:alt.sin,
        cama_antes:miCuartoNombre, cama_despues:(alt.camas_nombre||[]).join(", ")||miCuartoNombre,
        cambio_de_cama: !!alt.mueve_cosas, movimos_a: alt.mover_a_otro||null,
        /* EL ESTADO DICE LO QUE PASÓ. Antes se escribía `por_cobrar` siempre que
           el PUT no fallara, mirase o no si el cargo había entrado, y el fallo
           quedaba enterrado en detalle.ajuste.aplicado mientras al huésped se le
           decía «¡Hecho! Pasa a recepción a pagar». `sin_cargo` es la noche
           apartada con el folio sin cuadrar: recepción tiene que cobrarla a mano. */
        estado: ajuste.aplicado ? "por_cobrar" : "sin_cargo", pedido_por:"huesped",
        detalle:{ modo:alt.tipo, etiqueta:alt.etiqueta, ajuste, asignada, pax:paxTotal, camas:camasReserva },
        updated_at:new Date().toISOString() })}); }catch{}

      const doler = alt.mueve_cosas ? ` ${AVISO_MUDANZA}` : "";
      return J({ ok:true, estado: ajuste.aplicado ? "por_cobrar" : "sin_cargo",
        cargo_ok: ajuste.aplicado, cargo_detalle: ajuste.aplicado? undefined : ajuste.resp,
        nueva_salida:nuevaSalida, noches:nQ,
        monto:alt.precio, ahorro:Math.round(alt.sin-alt.precio), donde:alt.etiqueta, detalle:alt.detalle,
        mueve_cosas:!!alt.mueve_cosas, recepcion_mueve:alt.mover_a_otro||null,
        mensaje:`¡Hecho! Te quedas ${nQ} noche${nQ>1?"s":""} más · ${alt.etiqueta}. Pasa a recepción a pagar los $${alt.precio}.${doler}` });
    }

    return J({ ...base, descuento:"15% SuperPepe", datos_completos:!oc.incompleto,
      aviso_mudanza:AVISO_MUDANZA, escalera,
      mensaje: escalera.length
        ? (escalera[0].mejor.tipo==="misma_cama" ? "Puedes quedarte en tu misma cama." : "Puedes quedarte, pero habría que moverte.")
        : "Para esas noches ya no nos queda sitio." });
  }catch(e){ console.error(e); return J({ok:false,error:String(e)},500); }
});
