import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { quienLlama, puedeDelicado, noAutorizado } from "./equipo.ts";

// Contención 27-sep-2026: solo RH/dirección (permiso 'salarios') autoriza altas.
// Antes bastaba un employee_id para cambiar salario, rol y área de cualquiera.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Prefijo de ID maestro por propiedad
const PREFIJO: Record<string, string> = {
  '45e69775-d877-4507-a9e1-a45bd3400dc5': 'HOSTMX', // CDMX
  'febfbef6-7fd1-4b45-84d9-13533e8dcb72': 'HOSTPL', // Puebla
  '3e10a9ea-4913-4f7c-86ef-0c829caa851d': 'HOSTVR', // Virreyes
  'fde2f615-2c65-40fa-9df3-6336b5ab312c': 'CORP',   // Corporativo
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const q = await quienLlama(req);
    if (!q.equipo || !(await puedeDelicado(q, 'salarios'))) return noAutorizado('Solo RH o dirección pueden autorizar altas.');

    const b = await req.json();
    const employee_id = (b.employee_id||'').trim();          // uuid de employees.id
    const autorizado_por = (b.autorizado_por||'').trim() || q.email || null;
    if (!employee_id) return json({ ok:false, error:'Falta employee_id.' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, svc, { auth:{ persistSession:false } });

    const { data:emp, error:ge } = await admin.from('employees')
      .select('id, empleado_id, nombre, apellido, nombre_display, property_id, alta_etapa, estatus, alta_historial')
      .eq('id', employee_id).maybeSingle();
    if (ge || !emp) return json({ ok:false, error:'Ficha no encontrada.' }, 404);

    // Idempotente: si ya tiene ID maestro, no lo regeneramos
    let empleado_id = emp.empleado_id;
    if (!empleado_id) {
      const prefijo = PREFIJO[emp.property_id] || 'HOST';
      const { data:rows } = await admin.from('employees')
        .select('empleado_id').ilike('empleado_id', prefijo+'%');
      let max = 0;
      for (const r of (rows||[])) {
        const m = String(r.empleado_id||'').match(new RegExp('^'+prefijo+'(\\d+)$'));
        if (m) { const n = parseInt(m[1],10); if (n>max) max=n; }
      }
      const base: Record<string, number> = { 'HOSTMX':100, 'HOSTPL':400, 'HOSTVR':500, 'CORP':1 };
      const next = Math.max(max, base[prefijo] || 1) + 1;
      empleado_id = prefijo + String(next).padStart(3, '0');
    }

    // Campos que el admin puede capturar al autorizar (paso 2/3 en un golpe)
    const upd: Record<string, unknown> = { empleado_id, alta_etapa: 'autorizado' };
    const opt = ['rol','area','area_2','property_id','salario_bruto','prueba_planta','fecha_inicio_labores','salario_desde','tipo_contrato','contrato_categoria','horas_semanales','sede'];
    for (const k of opt) if (b[k] !== undefined && b[k] !== null && b[k] !== '') upd[k] = b[k];
    if (b.bono_puntualidad !== undefined) upd.bono_puntualidad = !!b.bono_puntualidad;
    if (upd.salario_bruto && !upd.salario_desde && b.fecha_inicio_labores) upd.salario_desde = b.fecha_inicio_labores;

    const hist = Array.isArray(emp.alta_historial) ? emp.alta_historial : [];
    hist.push({ etapa:'autorizado', at:new Date().toISOString(), por:autorizado_por, empleado_id });
    upd.alta_historial = hist;

    const { error:ue } = await admin.from('employees').update(upd).eq('id', employee_id);
    if (ue) return json({ ok:false, error:'No se pudo autorizar: '+ue.message }, 400);

    // Cerrar la incidencia de alta pendiente
    await admin.from('incidencias').update({ resuelto:true })
      .eq('employee_id', employee_id).eq('tipo','alta_colaborador').eq('resuelto', false);

    return json({ ok:true, employee_id, empleado_id, alta_etapa:'autorizado' });
  } catch (e) {
    return json({ ok:false, error:String((e as Error).message||e) }, 500);
  }
});
