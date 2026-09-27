// vac-asignar — gerencia asigna vacaciones desde el editor de horarios.
// Crea la solicitud APROBADA; el trigger vac_aprobada_sync descuenta saldo y pinta 'Vacaciones' en horarios.
//
// Contención 27-sep-2026: sin secreto compartido (estaba en GitHub). Quien llama
// tiene que ser gerente o más (es_gerente_o_mas) con su sesión.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { quienLlama, permisoBase, noAutorizado } from "./equipo.ts";

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const j=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const q = await quienLlama(req);
    if(!q.equipo || !(await permisoBase(q,'es_gerente_o_mas'))) return noAutorizado('Solo gerencia asigna vacaciones.');

    const { employee_id, fecha_inicio, fecha_fin, asignado_por } = await req.json();
    if(!employee_id||!fecha_inicio) return j({error:'Faltan datos (employee_id, fecha_inicio)'},400);
    const fin=(fecha_fin||fecha_inicio);
    if(fin<fecha_inicio) return j({error:'La fecha fin no puede ser antes del inicio'},400);

    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});

    const {data:emp}=await admin.from('employees').select('id,nombre,nombre_display').eq('id',employee_id).maybeSingle();
    if(!emp) return j({error:'No existe ese trabajador'},404);

    // días: naturales menos 1 de descanso por cada 7 (regla Casa Pepe)
    const nat=Math.round((new Date(fin+'T00:00:00Z').getTime()-new Date(fecha_inicio+'T00:00:00Z').getTime())/864e5)+1;
    const dias=Math.max(1, nat - Math.floor(nat/7));

    const {data:saldo}=await admin.from('vacaciones_saldo').select('id,dias_pendientes').eq('employee_id',employee_id).eq('estado','vigente').order('fecha_fin_periodo',{ascending:false}).limit(1).maybeSingle();

    const {error:e1}=await admin.from('vacaciones_solicitudes').insert({
      employee_id, fecha_inicio, fecha_fin:fin, dias_solicitados:dias, saldo_id:(saldo?saldo.id:null),
      estado:'aprobada', resuelto_at:new Date().toISOString(),
      notas:'Asignada desde horarios por gerencia ('+(asignado_por||q.email)+')',
      respuesta:'Vacaciones asignadas por tu jefe 🌴'
    });
    if(e1) return j({error:'No se pudo asignar: '+e1.message},400);

    let saldo_restante:number|null=null, saldo_insuficiente=false;
    if(saldo){
      const {data:s2}=await admin.from('vacaciones_saldo').select('dias_pendientes').eq('id',saldo.id).maybeSingle();
      if(s2){ saldo_restante=Number(s2.dias_pendientes); saldo_insuficiente=saldo_restante<0; }
    }
    return j({ok:true, nombre:(emp.nombre_display||emp.nombre), dias, naturales:nat, saldo_restante, saldo_insuficiente, sin_saldo:!saldo});
  }catch(err){ return j({error:String(err)},500); }
});
