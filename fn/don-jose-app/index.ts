import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODELO        = Deno.env.get('PEPE_SOPORTE_MODELO') ?? 'claude-haiku-4-5-20251001';
const HOOK_SECRET   = 'cpp-donjose-2026';

const JOSE_EMAIL  = 'don.jose@casapepe.mx';
const JOSE_NOMBRE = 'Don José';
const BOTS = new Set([JOSE_EMAIL, 'eloy.queda@casapepe.mx', 'pepe.soporte@casapepe.mx']);

const PROPS: Record<string,string> = {
  '45e69775-d877-4507-a9e1-a45bd3400dc5': 'Casa Pepe CDMX',
  '3e10a9ea-4913-4f7c-86ef-0c829caa851d': 'Ateneo Virreyes',
  'febfbef6-7fd1-4b45-84d9-13533e8dcb72': 'Casa Pepe Puebla',
};
const NIVELES = new Set(['bloqueo','recompone','mejora']);

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SYSTEM = `Eres "Don Jose", el que recibe los reportes de la app del Grupo Casa Pepe. Llevas anos resolviendo broncas de operacion y sabes que un reporte bien tomado se arregla rapido.

Tu trabajo: cuando un companero te dice que algo de la app no le sirve, le fallo, o quiere una mejora, le sacas un ticket claro para que direccion lo pueda priorizar SIN tener que volver a preguntarle nada.

Tono: calido, breve, de tu, espanol de Mexico. Una o dos frases. Pregunta SOLO lo que falte, de UNA cosa a la vez. Nunca pidas dos datos en el mismo mensaje.

Lo que necesitas sacar:
- modulo: en que parte de la app pasa (el checador, comidas, pedidos, pricing, incidencias, room service, PepeQuiz, el mapa de disparidad, accesos, etc.). Si no lo sabe nombrar, con que te describa la pantalla basta.
- necesita: que necesita o que esta pasando, en concreto.
- antes_o_nuevo: "antes" si algo que YA funcionaba dejo de funcionar; "nuevo" si es algo que nunca ha estado y lo esta pidiendo.
- impacto: que tanto le estorba, sobre todo para dar servicio al huesped. Pregunta algo como: "esto te impide trabajar ahorita, o puedes seguir mientras lo arreglamos?".
- propiedad: de que propiedad habla (CDMX, Virreyes o Puebla). En el contexto te digo la que trae seleccionada; confirma solo si parece de otra.

Con todo eso TU clasificas el NIVEL (no se lo preguntes, lo decides tu):
- "bloqueo": no puede hacer su trabajo por esto; el servicio al huesped esta en riesgo (p.ej. no puede ver quien viene a comer, no puede checar entrada).
- "recompone": algo que deberia funcionar esta fallando, pero puede seguir trabajando mientras tanto (p.ej. no le aparece un filtro, un dato no se actualiza, no reconoce a unos usuarios).
- "mejora": no esta roto; pide algo nuevo o una mejora (p.ej. "por que no ponemos verde la app", "me gustaria una seccion de notas").

Reglas:
- Si ya tienes modulo, necesita, antes_o_nuevo y entiendes el impacto, cierra: pon completo=true y "respuesta":"Te dejo el ticket abajo; si esta bien, dale Enviar y le llega a direccion."
- Mientras falte algo, completo=false y pide SOLO el siguiente dato. NUNCA digas que dejas el ticket abajo si completo es false.
- Si adjuntan una captura (hay_foto=true en el contexto), tomala como parte del reporte y no vuelvas a pedir que te describan lo que ya se ve en la imagen.

Devuelve SIEMPRE SOLO un JSON valido, sin markdown y sin texto fuera del JSON, con esta forma exacta:
{"respuesta":"<lo que le dices>","completo":true|false,"ficha":{"modulo":"","necesita":"","antes_o_nuevo":"antes|nuevo|","impacto":"","propiedad":"","nivel":"bloqueo|recompone|mejora","titulo":""}}
- LLENA la ficha en CADA respuesta con lo mejor que tengas hasta ahora.
- "titulo": un resumen de 4 a 8 palabras del problema (p.ej. "No aparece el filtro de CDMX").
- completo=true SOLO cuando tengas modulo, necesita, antes_o_nuevo y un nivel valido.`;

function cors(){ return {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-cpp-secret'}; }
function jsonResp(b: unknown, s = 200){ return new Response(JSON.stringify(b), { status:s, headers:cors() }); }
function parseObj(t: string): any|null { const l=t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(); const i=l.indexOf('{'),j=l.lastIndexOf('}'); if(i<0||j<=i)return null; try{return JSON.parse(l.slice(i,j+1));}catch{return null;} }

async function llamarIA(system:string,userMsg:string){
  const cuerpo:any={ model:MODELO, max_tokens:1200, system, messages:[{role:'user',content:userMsg}] };
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
    headers:{'content-type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body:JSON.stringify(cuerpo)});
  if(!r.ok){ throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0,300)}`); }
  const ia=await r.json();
  const crudo=(ia.content??[]).filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('\n');
  return {crudo,ia};
}
async function getUser(req: Request){
  const uc=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const {data:{user}}=await uc.auth.getUser(); return user;
}
async function empId(userId:string){ try{ const {data}=await db.from('empleado_login').select('employee_id').eq('user_id',userId).maybeSingle(); return data?.employee_id??null; }catch(_){ return null; } }
async function nombreDe(email:string){
  const {data}=await db.from('employees').select('nombre_display,nombre').ilike('email',email).maybeSingle();
  return data?.nombre_display || data?.nombre || email.split('@')[0];
}

async function getOrCreateConv(userId:string, email:string, propId:string){
  const { data: found } = await db.from('chat_conversaciones').select('id,origen_ref')
    .eq('origen','soporte-app').eq('created_by', email).limit(1).maybeSingle();
  let convId = found?.id;
  if(!convId){
    const { data: ins, error } = await db.from('chat_conversaciones').insert({
      tipo:'directo', titulo:'Reportes de la app · Don José', estado:'abierto',
      origen:'soporte-app', origen_ref: propId, created_by: email, icono:'🛠️',
      ultimo_at: new Date().toISOString() }).select('id').single();
    if(error) throw new Error('crear conv: '+error.message);
    convId = ins.id;
    const eid = await empId(userId);
    await db.from('chat_participantes').insert([
      { conversacion_id: convId, email, employee_id: eid, nombre: email },
      { conversacion_id: convId, email: JOSE_EMAIL, employee_id: null, nombre: JOSE_NOMBRE },
    ]);
    await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: JOSE_EMAIL, autor_nombre: JOSE_NOMBRE,
      cuerpo: '¡Quiubo! Soy Don José. 🛠️ Si algo de la app no te sirve, te falló, o se te ocurre una mejora, cuéntame qué pasa y yo lo convierto en un ticket para dirección. ¿En qué parte de la app es y qué necesitas?' });
  } else if(propId && found?.origen_ref !== propId){
    await db.from('chat_conversaciones').update({ origen_ref: propId }).eq('id', convId);
  }
  return convId;
}
async function listMsgs(convId:string){
  const { data } = await db.from('chat_mensajes').select('autor_email,autor_nombre,cuerpo,fotos,accion,created_at')
    .eq('conversacion_id', convId).order('created_at',{ascending:false}).limit(80);
  return (data??[]).slice().reverse();
}
function esBot(m:any){ return BOTS.has(String(m.autor_email||'').toLowerCase()); }
function parseAccion(a:any){ if(!a) return null; if(typeof a==='object') return a; try{ return JSON.parse(String(a)); }catch{ return null; } }
function esFrontera(m:any){ if(!esBot(m)) return false; const acc=parseAccion(m.accion); return !!(acc && acc.tipo==='ticket_creado'); }
function inicioBorrador(hilo:any[]){ for(let i=hilo.length-1;i>=0;i--){ if(esFrontera(hilo[i])) return i+1; } return 0; }
function fotoDelBorrador(hilo:any[]){ const start=inicioBorrador(hilo); for(let i=hilo.length-1;i>=start;i--){ const m=hilo[i]; if(m.fotos&&m.fotos.length&&!esBot(m)) return m.fotos[0]; } return null; }

async function responde(convId:string, propId:string){
  const hilo=await listMsgs(convId);
  const start=inicioBorrador(hilo);
  const hayFoto=!!fotoDelBorrador(hilo);
  const trans=hilo.slice(start)
    .map((m:any)=>`${esBot(m)?'Don José':(m.autor_nombre||m.autor_email)}: ${m.cuerpo||''}${(m.fotos&&m.fotos.length)?' [captura adjunta]':''}`).join('\n');
  const userMsg=`Propiedad seleccionada: ${PROPS[propId]||propId}\nhay_foto: ${hayFoto}\n\nConversación:\n${trans}\n\nResponde al último mensaje y decide si el ticket ya está completo.`;
  const {crudo,ia}=await llamarIA(SYSTEM,userMsg);
  const p=parseObj(crudo)||{respuesta:'¿Me repites qué necesitas?',completo:false};

  const f=p.ficha||{};
  const modulo=String(f.modulo||'').trim();
  const necesita=String(f.necesita||'').trim();
  const antesNuevo=String(f.antes_o_nuevo||'').trim().toLowerCase();
  const impacto=String(f.impacto||'').trim();
  const nivel=String(f.nivel||'').trim().toLowerCase();
  const titulo=String(f.titulo||'').trim();
  const propiedad=String(f.propiedad||'').trim();

  // Qué falta de verdad, según la ficha (no según lo que diga el modelo).
  const faltan:string[]=[];
  if(!modulo) faltan.push('¿En qué parte de la app te pasa? (el checador, comidas, pedidos, el mapa, PepeQuiz…)');
  if(!necesita) faltan.push('¿Qué necesitas o qué está pasando exactamente?');
  if(antesNuevo!=='antes' && antesNuevo!=='nuevo') faltan.push('¿Antes sí funcionaba y dejó de servir, o es algo nuevo que quieres?');
  if(!NIVELES.has(nivel)) faltan.push('Una última: ¿esto te impide trabajar ahorita, o puedes seguir mientras lo arreglamos?');
  const completa = faltan.length===0;

  let respuesta=String(p.respuesta||'Va, lo anoto.').trim();
  if(!completa && /ticha abajo|ticket abajo|dale enviar|le llega a direcci/i.test(respuesta)) respuesta=faltan[0];
  // Si ya tenemos lo necesario, cerramos claro aunque el modelo quisiera seguir preguntando.
  if(completa && !/ticket abajo|dale enviar/i.test(respuesta)) respuesta='Va, con eso tengo lo necesario. Te dejo el ticket abajo; si está bien, dale Enviar y le llega a dirección.';

  await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: JOSE_EMAIL, autor_nombre: JOSE_NOMBRE, cuerpo: respuesta });
  await db.from('chat_conversaciones').update({ ultimo_at:new Date().toISOString() }).eq('id',convId);
  try{ await db.from('soporte_log').insert({ conversacion_id: convId, respuesta, propuesta:'donjose-app', modelo: MODELO, tokens_in: ia.usage?.input_tokens??null, tokens_out: ia.usage?.output_tokens??null, ok:true }); }catch(_){}

  const ficha = completa ? { property_id:propId, sede:PROPS[propId]||propId, modulo, necesita,
      antes_o_nuevo:antesNuevo, impacto, propiedad: propiedad||PROPS[propId]||'',
      nivel, titulo, foto: fotoDelBorrador(hilo) } : null;
  return { ficha, faltan };
}

function componerMensaje(f:any){
  const existia = f.antes_o_nuevo==='antes' ? 'Sí, antes funcionaba y dejó de servir'
                : f.antes_o_nuevo==='nuevo' ? 'No, es algo nuevo que piden' : '—';
  let m = (f.modulo?('['+f.modulo+'] '):'') + (f.necesita||'');
  m += `\n\n• ¿Existía antes?: ${existia}`;
  if(f.impacto) m += `\n• Impacto / servicio al huésped: ${f.impacto}`;
  if(f.foto) m += `\n• 📷 Captura adjunta en la conversación`;
  return m.trim();
}

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return jsonResp({},200);
  try{
    if(!ANTHROPIC_KEY) return jsonResp({error:'Falta ANTHROPIC_API_KEY'},500);
    const body=await req.json().catch(()=>({}));
    const action=body.action||'open';
    const propId=String(body.property_id||'45e69775-d877-4507-a9e1-a45bd3400dc5');

    if(action==='responder'){
      if(req.headers.get('x-cpp-secret')!==HOOK_SECRET) return jsonResp({error:'no auth'},401);
      const convId=String(body.conv_id||'');
      if(!convId) return jsonResp({error:'falta conv_id'},400);
      const { data: conv } = await db.from('chat_conversaciones').select('origen,origen_ref').eq('id',convId).maybeSingle();
      if(!conv || conv.origen!=='soporte-app') return jsonResp({error:'no es una conversación de Don José (app)'},400);
      const r=await responde(convId, String(conv.origen_ref||propId));
      return jsonResp({ conv_id: convId, ...r });
    }

    const user=await getUser(req); if(!user) return jsonResp({error:'no auth'},401);
    const email=(user.email||'').toLowerCase();
    const convId=await getOrCreateConv(user.id, email, propId);

    if(action==='open') return jsonResp({ conv_id: convId, messages: await listMsgs(convId) });

    if(action==='send'){
      const text=String(body.text||'').trim();
      const foto=body.foto?String(body.foto):null;
      if(!text && !foto) return jsonResp({error:'mensaje vacío'},400);
      await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: email, autor_nombre: user.email,
        cuerpo: text || '(captura)', fotos: foto?[foto]:null });
      await db.from('chat_conversaciones').update({ ultimo_at:new Date().toISOString() }).eq('id',convId);
      const r=await responde(convId, propId);
      return jsonResp({ conv_id: convId, messages: await listMsgs(convId), ...r });
    }

    if(action==='crear_ticket'){
      const f=body.ficha||{};
      if(!f.necesita && !f.modulo) return jsonResp({error:'El ticket viene vacío'},400);
      const nombre=await nombreDe(email);
      const eid=await empId(user.id);
      const nivel = NIVELES.has(String(f.nivel)) ? String(f.nivel) : null;
      const {data:tk,error:eT}=await db.from('buzon_direccion').insert({
        tipo:'app', nivel,
        employee_id: eid,
        nombre_display: nombre,
        email,
        sede: PROPS[propId]||f.sede||null,
        property_id: propId,
        mensaje: componerMensaje(f),
        estado:'nuevo',
        conversacion_id: convId
      }).select('id').single();
      if(eT) throw new Error('crear ticket: '+eT.message);

      const cierre=`✅ Listo. Mandé tu ticket a dirección${f.titulo?(': "'+f.titulo+'"'):''}. Queda clasificado como ${nivel==='bloqueo'?'🚫 no puedes trabajar':nivel==='recompone'?'🔧 por recomponer':'💡 mejora'} y lo verán en su tablero. En cuanto lo atiendan te avisamos por aquí.`;
      await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: JOSE_EMAIL, autor_nombre: JOSE_NOMBRE,
        cuerpo: cierre, accion: JSON.stringify({ tipo:'ticket_creado', ticket: tk.id }) });
      await db.from('chat_conversaciones').update({ ultimo_at:new Date().toISOString() }).eq('id',convId);
      return jsonResp({ conv_id: convId, messages: await listMsgs(convId), ticket: { id: tk.id, nivel, titulo: f.titulo||'' } });
    }

    return jsonResp({error:'acción no válida'},400);
  }catch(err){ return jsonResp({error:String(err instanceof Error?err.message:err)},500); }
});
