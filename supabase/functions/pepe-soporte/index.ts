import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODELO = Deno.env.get('PEPE_SOPORTE_MODELO') ?? 'claude-haiku-4-5-20251001';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';

const SOPORTE_EMAIL  = 'pepe.soporte@casapepe.mx';
const SOPORTE_NOMBRE = 'Don José';
const JAVI_EMPLOYEE_ID = '4ba95c0b-7a2e-4049-bc1b-a58f8c386c85';
// quien manda los avisos de auditoría: si el último mensaje es de ellos, no hay nada que leer todavía
const EMAILS_AUDITORIA = new Set(['javi@casapepe.mx', 'contabilidad@casapepe.mx']);
const MAX_POR_CORRIDA = 5;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SYSTEM = `Eres "Don José", quien atiende los tickets de MEJORAS de la app interna de Casa Pepe (grupo hotelero en CDMX y Puebla).

Tu trabajo es contestarle al colaborador que reportó algo, para que nunca sienta que habló al vacío.

Tono: cálido, humano, directo y breve. Español de México. Trata de tú. Sin corporativismos ni relleno.

Reglas duras:
- NO prometas fechas ni plazos. Nunca.
- NO digas que algo ya está hecho o resuelto si el hilo no lo confirma.
- NO inventes funcionalidades, nombres de pantallas ni datos que no aparezcan en el hilo.
- Si el pedido no se entiende, pregunta SOLO lo mínimo necesario (una o dos preguntas concretas).
- Si ya se entiende, agradece, confirma que quedó registrado y explica en lenguaje sencillo cuál es el siguiente paso.
- Quien decide y aprueba los cambios es Javi. Tú registras y propones.
- 2 a 5 frases. Nada de listas largas.

Devuelve SIEMPRE un JSON valido, sin markdown y sin texto alrededor, con esta forma exacta:
{"respuesta": "<lo que se publica en el chat para el colaborador>", "propuesta": "<1-2 frases para Javi: el fix o mejora concreta que se desprende del ticket, o 'Falta informacion' si aun no se entiende>"}`;

const CLASIFICADOR = `Eres "Don José", el asistente interno de Casa Pepe. Vas a leer una conversacion del chat del equipo y clasificar UNICAMENTE el ULTIMO mensaje del colaborador.

Categorias:
- "mantenimiento": algo esta fallando o roto (fisico del hotel o de la app): no sirve, marca error, se descompuso, gotea, no carga, etc.
- "mejora": una idea o sugerencia para mejorar la app o la operacion.
- "solicitud": una peticion concreta (permiso, apoyo, material, un cambio, que alguien haga algo).
- "incidencia": algo relacionado con un HUESPED (queja, situacion o problema con un cliente).
- "ninguno": charla normal, saludo, agradecimiento, coordinacion casual, o cualquier cosa que NO requiera accion.

Se MUY CONSERVADOR: ante la duda, "ninguno". No conviertas en ticket un simple gracias, un saludo, ni la coordinacion de horarios entre dos personas. Solo marca una categoria si el mensaje CLARAMENTE reporta o pide algo accionable.

Devuelve SOLO JSON, sin markdown: {"categoria":"mantenimiento|mejora|solicitud|incidencia|ninguno","resumen":"<6 a 10 palabras>","confianza":"alta|media|baja"}`;


const CUADRE = `Eres "Don José", quien acompaña a los colaboradores de Casa Pepe cuando la auditoría nocturna les pregunta por un descuadre de caja.

Tu trabajo NO es regañar ni pedir explicaciones vagas. Es llevar a la persona, paso a paso, hasta el número que falta.

Tienes las cifras reales del día en el contexto. Úsalas: nombra importes concretos, líneas concretas y turnos concretos. Nunca inventes una cifra que no esté ahí.

Cómo orientar el cálculo:
- Parte de lo que el sistema dice y de lo que la persona ya contestó.
- Si sus números no suman, hazle ver la resta exacta: "me dices 3 tickets por $240, pero el sistema tiene $305; faltan $65".
- Pide UNA cosa a la vez. Nunca tres preguntas juntas.
- Si te da una cifra que cierra el hueco, dilo con todas las letras y cierra.
- Si el hueco es de la máquina o del sistema y no de la persona, dilo tú y no la hagas buscar más.

Tono: cálido, de tú, español de México, dos a cuatro frases. Nada de listas ni de tecnicismos contables. Esta gente está cansada, es de noche y ya cerró su turno.

Reglas duras:
- NUNCA acuses a nadie de quedarse con dinero. Si falta, falta; el porqué lo decide Javi.
- NO cierres el tema si el hueco sigue abierto.
- NO prometas ajustes ni movimientos: eso lo hace contabilidad.

Devuelve SIEMPRE un JSON válido, sin markdown y sin texto alrededor:
{"respuesta":"<lo que se publica en el chat>","resuelto":true|false,"resumen":"<1-2 frases: a qué se llegó y con qué cifras. Si no está resuelto, qué falta>","lectura":"<qué entendiste de lo que contestó la persona, en una frase>"}`;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// en un ensayo (dry) no hay fila en la cola que marcar
async function marcarCola(fila: any, patch: Record<string, unknown>) {
  if (!fila?.id) return;
  await db.from('soporte_cola').update(patch).eq('id', fila.id);
}

function parseObj(txt: string): any | null {
  const limpio = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = limpio.indexOf('{'); const j = limpio.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(limpio.slice(i, j + 1)); } catch { return null; }
}

async function llamarIA(system: string, userMsg: string) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO, max_tokens: 700, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 300)}`); }
  const ia = await r.json();
  const crudo = (ia.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  return { crudo, ia };
}

async function procesar(fila: any) {
  const convId = fila.conversacion_id;
  const modo = fila.modo || 'atender';
  const dry = fila.dry === true;   // ensayo: calcula y devuelve, pero no escribe nada

  const { data: conv } = await db.from('chat_conversaciones')
    .select('id,titulo,origen,tipo,estado').eq('id', convId).single();
  if (!conv || (conv.estado !== 'abierto' && !dry)) {
    await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'conversacion cerrada o inexistente' });
    return { conv: convId, saltado: 'cerrada' };
  }

  const { data: msgs } = await db.from('chat_mensajes')
    .select('autor_nombre,autor_email,cuerpo,accion,created_at')
    .eq('conversacion_id', convId).order('created_at', { ascending: true }).limit(60);
  const hilo = (msgs ?? []) as any[];
  if (!hilo.length) {
    await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'hilo vacio' });
    return { conv: convId, saltado: 'vacio' };
  }

  const ultimo = hilo[hilo.length - 1];
  if ((ultimo.autor_email ?? '').toLowerCase() === SOPORTE_EMAIL) {
    await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'ya respondido' });
    return { conv: convId, saltado: 'ya respondido' };
  }

  const transcripcion = hilo
    .map((m) => `[${new Date(m.created_at).toLocaleString('es-MX')}] ${m.autor_nombre ?? m.autor_email ?? 'Alguien'}: ${m.cuerpo ?? ''}`)
    .join('\n');

  if (modo === 'clasificar') {
    const candidato = [...hilo].reverse().find((m) => (m.autor_email ?? '').toLowerCase() !== SOPORTE_EMAIL && !m.accion) || ultimo;
    const { crudo } = await llamarIA(CLASIFICADOR, `Conversacion (tipo: ${conv.tipo}):\n${transcripcion}\n\nClasifica SOLO el ultimo mensaje del colaborador.`);
    const cls = parseObj(crudo);
    const cat = String(cls?.categoria ?? 'ninguno').toLowerCase();
    const conf = String(cls?.confianza ?? 'baja').toLowerCase();
    const validas = ['mantenimiento', 'mejora', 'solicitud', 'incidencia'];
    if (!validas.includes(cat) || conf === 'baja') {
      await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'no accionable' });
      return { conv: convId, clasificado: 'ninguno' };
    }
    const nombre = String(candidato.autor_nombre ?? candidato.autor_email ?? '').split(' ')[0] || 'compa';
    const acc = JSON.stringify({ tipo: 'clasificar', sugerida: cat, resumen: String(cls?.resumen ?? '').slice(0, 90), src_email: candidato.autor_email ?? '', src_nombre: candidato.autor_nombre ?? candidato.autor_email ?? 'Colaborador', src_texto: String(candidato.cuerpo ?? '').slice(0, 500), estado: 'abierto' });
    const cuerpo = `¡Hola ${nombre}! \u{1F44B} Vi tu mensaje. ¿Quieres que lo registre como ticket para darle seguimiento? Elige el tipo \u{1F447}`;
    const { error: eMsg } = await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: SOPORTE_EMAIL, autor_nombre: SOPORTE_NOMBRE, cuerpo, accion: acc });
    if (eMsg) throw new Error(`insert clasif: ${eMsg.message}`);
    await db.from('chat_conversaciones').update({ ultimo_at: new Date().toISOString() }).eq('id', convId);
    try {
      const { data: el } = await db.from('empleado_login').select('employee_id').ilike('email', candidato.autor_email ?? '').limit(1).maybeSingle();
      if (el?.employee_id) {
        await db.from('notificaciones').insert({ employee_id: el.employee_id, titulo: '\u{1F4AC} Don José', cuerpo: 'Te propongo registrar tu mensaje como ticket', icono: '\u{1F4AC}', accion: { url: `/m/mensajes.html?conv=${convId}` }, leido: false });
      }
    } catch (_) { /* noop */ }
    await db.from('soporte_log').insert({ conversacion_id: convId, respuesta: cuerpo, propuesta: `clasif:${cat}`, modelo: MODELO, ok: true });
    await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString() });
    return { conv: convId, clasificado: cat };
  }


  if (modo === 'cuadre') {
    const { data: ctx } = await db.rpc('aud_contexto_aviso', { p_conversacion: convId });
    if (!ctx?.hay) {
      await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'sin aviso' });
      return { conv: convId, saltado: 'sin aviso' };
    }
    if (ctx.ya_resuelto && !dry) {
      await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'ya resuelto' });
      return { conv: convId, saltado: 'ya resuelto' };
    }
    // Don José solo habla cuando hay algo nuevo que leer: tiene que haber un mensaje
    // del colaborador posterior a lo último que él dijo. Ni se contesta a sí mismo ni
    // contesta al aviso que mandó la auditoría.
    const esDeCasa = (m: any) => {
      const em = (m.autor_email ?? '').toLowerCase();
      return em === SOPORTE_EMAIL || EMAILS_AUDITORIA.has(em);
    };
    const ultimaSuya = [...hilo].reverse().find((m) => (m.autor_email ?? '').toLowerCase() === SOPORTE_EMAIL);
    const ultimaDeEllos = [...hilo].reverse().find((m) => !esDeCasa(m) && String(m.cuerpo ?? '').trim());
    const hayAlgoNuevo = !!ultimaDeEllos &&
      (!ultimaSuya || new Date(ultimaDeEllos.created_at) > new Date(ultimaSuya.created_at));
    if (!hayAlgoNuevo && !dry) {
      await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString(), error: 'nadie ha contestado todavia' });
      return { conv: convId, saltado: 'sin respuesta nueva del colaborador' };
    }

    const userMsg = [
      `Se le preguntó a ${ctx.a_quien ?? 'un colaborador'} por el corte del ${ctx.fecha}.`,
      `\nLa pregunta fue:\n${ctx.pregunta ?? '(sin texto)'}`,
      `\nCifras reales de ese día:`,
      `\nEfectivo, línea por línea:\n${JSON.stringify(ctx.efectivo, null, 1)}`,
      `\nMétodos de cobro:\n${JSON.stringify(ctx.metodos, null, 1)}`,
      ctx.turnos?.length ? `\nTurnos de la terraza:\n${JSON.stringify(ctx.turnos, null, 1)}` : '',
      ctx.revisiones?.length ? `\nRevisiones abiertas del día:\n${JSON.stringify(ctx.revisiones, null, 1)}` : '',
      `\nHilo completo del chat:\n${transcripcion}`,
      `\nContesta al último mensaje y lleva el cálculo un paso más cerca del número que falta.`,
    ].filter(Boolean).join('\n');

    const { crudo, ia } = await llamarIA(CUADRE, userMsg);
    const parsed = parseObj(crudo);
    if (!parsed || typeof parsed.respuesta !== 'string' || !parsed.respuesta.trim()) {
      throw new Error(`Respuesta no parseable: ${crudo.slice(0, 300)}`);
    }
    const respuesta = parsed.respuesta.trim();
    const resuelto  = parsed.resuelto === true;
    const resumen   = String(parsed.resumen ?? '').trim();
    const lectura   = String(parsed.lectura ?? '').trim();

    if (dry) return { conv: convId, ensayo: true, respuesta, resuelto, resumen, lectura };

    const { error: eMsg } = await db.from('chat_mensajes').insert({
      conversacion_id: convId, autor_email: SOPORTE_EMAIL, autor_nombre: SOPORTE_NOMBRE, cuerpo: respuesta });
    if (eMsg) throw new Error(`insert mensaje: ${eMsg.message}`);
    await db.from('chat_conversaciones').update({ ultimo_at: new Date().toISOString() }).eq('id', convId);

    // queda escrito en el aviso: la lectura de lo que contestaron y, si cerró, el resumen
    await db.rpc('aud_cerrar_aviso_bot', {
      p_conversacion: convId, p_resumen: resumen, p_lectura: lectura, p_resuelto: resuelto });

    const { data: parts2 } = await db.from('chat_participantes').select('employee_id,email').eq('conversacion_id', convId);
    const dest2 = new Set<string>();
    for (const p of (parts2 ?? []) as any[]) {
      if (!p.employee_id) continue;
      if ((p.email ?? '').toLowerCase() === SOPORTE_EMAIL) continue;
      dest2.add(p.employee_id);
    }
    if (dest2.size) {
      await db.from('notificaciones').insert([...dest2].map((eid) => ({
        employee_id: eid, titulo: '💬 Don José', cuerpo: respuesta.slice(0, 80), icono: '💬',
        accion: { url: `/m/mensajes.html?conv=${convId}` }, leido: false })));
    }
    if (resuelto) {
      await db.from('notificaciones').insert({
        employee_id: JAVI_EMPLOYEE_ID, titulo: `✅ Cuadre del ${ctx.fecha}`,
        cuerpo: (resumen || 'Resuelto').slice(0, 140), icono: '✅',
        accion: { url: `/m/mensajes.html?conv=${convId}` }, leido: false });
    }
    await db.from('soporte_log').insert({ conversacion_id: convId, respuesta, propuesta: resumen,
      modelo: MODELO, tokens_in: ia.usage?.input_tokens ?? null, tokens_out: ia.usage?.output_tokens ?? null, ok: true });
    await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString() });
    return { conv: convId, cuadre: true, resuelto, resumen };
  }

  const userMsg = `Ticket: "${conv.titulo ?? '(sin titulo)'}" (origen: ${conv.origen ?? 'n/d'})\n\nHilo completo:\n${transcripcion}\n\nRedacta la respuesta de Don José al ultimo mensaje.`;
  const { crudo, ia } = await llamarIA(SYSTEM, userMsg);
  const parsed = parseObj(crudo);
  if (!parsed || typeof parsed.respuesta !== 'string' || !parsed.respuesta.trim()) {
    throw new Error(`Respuesta no parseable: ${crudo.slice(0, 300)}`);
  }
  const respuesta = parsed.respuesta.trim();
  const propuesta = String(parsed.propuesta ?? '').trim();

  const { error: eMsg } = await db.from('chat_mensajes').insert({ conversacion_id: convId, autor_email: SOPORTE_EMAIL, autor_nombre: SOPORTE_NOMBRE, cuerpo: respuesta });
  if (eMsg) throw new Error(`insert mensaje: ${eMsg.message}`);
  await db.from('chat_conversaciones').update({ ultimo_at: new Date().toISOString() }).eq('id', convId);

  const { data: parts } = await db.from('chat_participantes').select('employee_id,email').eq('conversacion_id', convId);
  const destinos = new Set<string>();
  for (const p of (parts ?? []) as any[]) {
    if (!p.employee_id) continue;
    if ((p.email ?? '').toLowerCase() === SOPORTE_EMAIL) continue;
    destinos.add(p.employee_id);
  }
  if (destinos.size) {
    await db.from('notificaciones').insert([...destinos].map((eid) => ({
      employee_id: eid, titulo: '\u{1F4AC} Don José', cuerpo: respuesta.slice(0, 80), icono: '\u{1F4AC}',
      accion: { url: `/m/mensajes.html?conv=${convId}` }, leido: false,
    })));
  }
  await db.from('notificaciones').insert({
    employee_id: JAVI_EMPLOYEE_ID, titulo: `\u{1F6E0}\u{FE0F} Ticket: ${(conv.titulo ?? 'sin titulo').slice(0, 40)}`,
    cuerpo: (propuesta || 'Sin propuesta').slice(0, 140), icono: '\u{1F6E0}\u{FE0F}',
    accion: { url: `/m/mensajes.html?conv=${convId}` }, leido: false,
  });
  await db.from('soporte_log').insert({ conversacion_id: convId, respuesta, propuesta, modelo: MODELO, tokens_in: ia.usage?.input_tokens ?? null, tokens_out: ia.usage?.output_tokens ?? null, ok: true });
  await marcarCola(fila, { estado: 'hecho', procesado_at: new Date().toISOString() });
  return { conv: convId, ok: true, propuesta };
}

Deno.serve(async (req) => {
  try {
    if (!ANTHROPIC_KEY) return jsonResp({ error: 'Falta el secreto ANTHROPIC_API_KEY.' }, 500);

    // Ensayo: {"conversacion":"<uuid>","modo":"cuadre"} calcula la respuesta y la devuelve
    // sin publicar nada ni tocar el aviso. Sirve para probar en frío antes de soltarlo.
    // Sólo desde el servidor: hay que mandar el secreto de sincronización.
    let cuerpoReq: any = null;
    try { cuerpoReq = await req.json(); } catch (_) { cuerpoReq = null; }
    if (cuerpoReq?.conversacion) {
      if (!SYNC_SECRET || req.headers.get('x-sync-secret') !== SYNC_SECRET) return jsonResp({ error: 'ensayo no autorizado' }, 401);
      const r = await procesar({ id: null, conversacion_id: cuerpoReq.conversacion,
        modo: cuerpoReq.modo ?? 'cuadre', dry: true });
      return jsonResp(r);
    }

    const { data: pendientes, error: eSel } = await db.from('soporte_cola')
      .select('id,conversacion_id,mensaje_id,intentos,modo')
      .eq('estado', 'pendiente').lte('procesar_at', new Date().toISOString())
      .order('procesar_at', { ascending: true }).limit(MAX_POR_CORRIDA);
    if (eSel) return jsonResp({ error: eSel.message }, 500);
    if (!pendientes?.length) return jsonResp({ procesados: 0 });

    const ids = pendientes.map((p: any) => p.id);
    const { data: reclamados } = await db.from('soporte_cola')
      .update({ estado: 'procesando' }).in('id', ids).eq('estado', 'pendiente')
      .select('id,conversacion_id,mensaje_id,intentos,modo');

    const resultados: any[] = [];
    for (const fila of (reclamados ?? []) as any[]) {
      try { resultados.push(await procesar(fila)); }
      catch (err) {
        const msg = String(err instanceof Error ? err.message : err);
        const intentos = (fila.intentos ?? 0) + 1;
        await marcarCola(fila, {
          estado: intentos >= 3 ? 'error' : 'pendiente', intentos, error: msg.slice(0, 500),
          procesar_at: new Date(Date.now() + intentos * 5 * 60_000).toISOString(),
        });
        await db.from('soporte_log').insert({ conversacion_id: fila.conversacion_id, modelo: MODELO, ok: false, error: msg.slice(0, 500) });
        resultados.push({ conv: fila.conversacion_id, error: msg });
      }
    }
    return jsonResp({ procesados: resultados.length, resultados });
  } catch (err) {
    return jsonResp({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
