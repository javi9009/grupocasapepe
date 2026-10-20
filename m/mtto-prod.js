/* mtto-prod.js — la tarjeta de productividad por técnico, en un solo sitio.
 *
 * Javi, 20-oct-2026: «en mantenimiento replícame estas gráficas de Manuel y
 * Juan (en CDMX Manuel y Juan y en Puebla el otro)... mantén los botones y
 * despliegues que tienes en las funcionalidades que te paso y los links».
 *
 * La tarjeta vivía dentro de mantenimiento.html. Copiarla al tablero habría
 * dejado la misma fórmula escrita en dos sitios, que es como acaban dos
 * pantallas diciendo cifras distintas de lo mismo. Así que vive aquí y la
 * usan las dos: mantenimiento.html y el tablero del día.
 *
 *   mttoProd.card(tecnico, tickets, puesto, lunes, otrasTareas, opts)
 *   await mttoProd.monta({ sb, propertyId, destino, semana, dia, href })
 *
 * `opts.href` es a dónde van los clics en un trabajo: en mantenimiento.html
 * abre la ficha ahí mismo (termInfo); desde el tablero, lleva al módulo.
 */
(function(){
  "use strict";
  var esc=function(s){return (s==null?"":String(s)).replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});};
  function mondayOf(d){
    var s=(typeof d==='string')?d.slice(0,10):new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'});
    var x=new Date(s+'T12:00:00Z'); var day=(x.getUTCDay()+6)%7;
    x.setUTCDate(x.getUTCDate()-day); return x.toISOString().slice(0,10);
  }
  function puestoCap(pu){
    var p=pu||{horas_semana:48,admin_horas:4,reactivo_horas:8,lectura_horas:0.5,lectura_dias:[0,1,2,3,4,5],min_preventivo_h:8};
    var lectDias=(p.lectura_dias||[]).length||0;
    var lect=(+p.lectura_horas||0)*lectDias;
    var admin=+p.admin_horas||0, react=+p.reactivo_horas||0, sem=+p.horas_semana||48;
    var minPrev=(p.min_preventivo_h==null?8:+p.min_preventivo_h);
    return { sem:sem, admin:admin, react:react, lect:lect, lectDias:lectDias, minPrev:minPrev,
             reservado:admin+react+lect, prog:Math.max(0,sem-admin-react-lect) };
  }
  var DONEP=function(t){return ["resuelto","cerrado"].indexOf(t.estado)>=0;};
  var doneWk=function(t){var d=(t.resuelto_at||t.cerrado_at||"").slice(0,10);return d?mondayOf(d):null;};

function techProdCard(t,tks,pu,wk,extra,opts){
  opts=opts||{};
  /* Dónde lleva tocar un trabajo. En mantenimiento.html, a su ficha; desde
     fuera, al módulo, que es donde se puede hacer algo con él. */
  var LINK = opts.href
    ? function(r){ return 'onclick="location.href=\''+opts.href+'#t='+r.id+'\'"'; }
    : function(r){ return 'onclick="termInfo(\''+r.id+'\')"'; };
  const cap=puestoCap(pu); const jorMin=(cap.sem||48)*60; const capMin=cap.prog*60||1;
  const NP='#005b80', OTR='#7A5FB0';                   // azul=no programado · morado=otras tareas (briefing/compras/admin)
  const CATLBL={reactivo:'Reactivo',correctivo:'Correctivo',preventivo:'Preventivo',administrativa:'Admin/briefing',compras:'Compras',otra:'Otra'};
  const hOtras=(extra&&extra.min)||0;                  // minutos de otras tareas validadas (sin ticket)
  const isPlan=r=>r.semana_programada&&mondayOf(r.semana_programada)===wk;
  const openWk=r=>{const d=(r.reportado_at||r.created_at||'').slice(0,10);return d&&mondayOf(d)===wk;};
  const isReal=r=>DONEP(r)&&doneWk(r)===wk;             // realizado = hecho esta semana
  const hrs=r=>r.minutos_reales||r.minutos_estimados||0;
  const mias=tks.filter(r=>r.asignado_a===t.id);
  // ASIGNADO = en el plan semanal O asignado/solicitado durante la semana
  const asignados=mias.filter(r=>isPlan(r)||isReal(r)||openWk(r));
  const realizados=mias.filter(isReal);
  const hPlan=realizados.filter(isPlan).reduce((s,r)=>s+hrs(r),0);
  const hNoPlan=realizados.filter(r=>!isPlan(r)).reduce((s,r)=>s+hrs(r),0);
  const hTotal=hPlan+hNoPlan+hOtras;                   // realizado = tickets + otras tareas validadas
  const pendEjec=Math.max(0,jorMin-hTotal);            // forecast: horas de jornada por ejecutar
  const abiertos=mias.filter(openWk);
  const porCompletar=mias.filter(r=>!['resuelto','cerrado','cancelado'].includes(r.estado));
  const progPlanMin=mias.filter(isPlan).reduce((s,r)=>s+(r.minutos_estimados||0),0);
  const capPct=Math.min(100,Math.round(progPlanMin/capMin*100));
  // eficiencia (realizados con real y estimado)
  const sumR=realizados.reduce((s,r)=>s+(r.minutos_reales||0),0), sumE=realizados.filter(r=>r.minutos_reales).reduce((s,r)=>s+(r.minutos_estimados||0),0);
  const ef=sumE?Math.round(sumR/sumE*100):null;
  const efCol=ef==null?"var(--muted)":(ef<=100?"var(--ok)":(ef<=120?"var(--warn)":"var(--bad)"));
  // barra vs jornada (48h): verde=programado, azul=no programado; tooltip con horas y trabajos
  const base=Math.max(jorMin,hTotal,1);
  const w1=Math.round(hPlan/base*100), w2=Math.round(hNoPlan/base*100), w3=Math.round(hOtras/base*100);
  const otrasDesglose=extra&&extra.byCat?Object.entries(extra.byCat).map(([k,m])=>`${CATLBL[k]||k} ${Math.round(m/60*10)/10}h`).join(' · '):'';
  const nPlan=realizados.filter(isPlan).length, nNoPlan=realizados.filter(r=>!isPlan(r)).length;
  // detalle por tipo: horas hechas/asignadas + trabajos realizados/asignados, abre cada trabajo
  const det=[['preventivo','🛠️ Preventivos'],['reactivo','⚡ Reactivos'],['correctivo','🔧 Correctivos']].map(([k,lbl])=>{
    const asg=asignados.filter(r=>r.clasificacion===k); if(!asg.length)return '';
    const hechos=asg.filter(isReal);
    const hH=hechos.reduce((s,r)=>s+hrs(r),0)/60;
    const denom=k==='preventivo'?(cap.minPrev||0):asg.reduce((s,r)=>s+(r.minutos_estimados||0),0)/60;
    const denomLbl=k==='preventivo'?`${denom.toFixed(1)}h mín`:`${denom.toFixed(1)}h asig`;
    const lista=asg.slice().sort((a,b)=>(isReal(b)?1:0)-(isReal(a)?1:0)).map(r=>{
      const d=isReal(r); const m=d?(r.minutos_reales||r.minutos_estimados||0):(r.minutos_estimados||0);
      return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:2px 0"><span style="cursor:pointer;color:var(--accent)" ${LINK(r)}>${d?'✅':'◻️'} ${esc(r.titulo||'—')}</span><span class="muted">${m?Math.round(m)+'m':'—'}</span></div>`;
    }).join('');
    const trabCol=hechos.length>=asg.length?'var(--ok)':'var(--warn)';
    return `<details style="margin:2px 0"><summary style="cursor:pointer;font-size:12px"><b>${lbl}</b> ${hH.toFixed(1)}h / ${denomLbl} · <span style="color:${trabCol}">${hechos.length}/${asg.length} trab</span></summary><div style="padding:3px 0 2px 6px">${lista}</div></details>`;
  }).join('');
  return `<div class="card"><div class="pad">
    <div style="display:flex;align-items:center;gap:8px"><b>${esc(t.nombre_display||t.nombre)}</b><span class="ef" style="margin-left:auto;color:${efCol}">${ef==null?'—':ef+'%'} ef.</span></div>
    <div class="prodrow"><span class="muted">Horas realizadas</span><span><b>${(hTotal/60).toFixed(1)}h</b> / ${(jorMin/60).toFixed(1)}h jornada</span></div>
    <div style="height:9px;background:var(--surface-2,#EFE9DD);border-radius:5px;overflow:hidden;display:flex;margin:4px 0">
      <i title="Programado: ${(hPlan/60).toFixed(1)}h · ${nPlan} trab" style="display:block;height:100%;width:${w1}%;background:var(--ok)"></i>
      <i title="No programado: ${(hNoPlan/60).toFixed(1)}h · ${nNoPlan} trab" style="display:block;height:100%;width:${w2}%;background:${NP}"></i>
      <i title="Otras tareas (briefing/compras/admin): ${(hOtras/60).toFixed(1)}h${otrasDesglose?' · '+otrasDesglose:''}" style="display:block;height:100%;width:${w3}%;background:${OTR}"></i>
    </div>
    <div class="prodrow"><span class="muted">🔮 Pendiente de ejecutar</span><span><b>${(pendEjec/60).toFixed(1)}h</b> de ${(jorMin/60).toFixed(0)}h</span></div>
    <div class="prodrow"><span class="muted">Carga vs capacidad (${cap.prog.toFixed(1)}h)</span><span>${capPct}%</span></div>
    <div class="prodrow"><span>📋 Asignados · realizados</span><span>${asignados.length} · ${realizados.length}</span></div>
    ${hOtras>0?`<div class="prodrow"><span title="${esc(otrasDesglose)}"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${OTR};margin-right:5px"></span>🗒️ Otras tareas (sin ticket)</span><span><b>${(hOtras/60).toFixed(1)}h</b></span></div>`:''}
    <div class="prodrow"><span>📂 Solicitados esta semana · por completar</span><span>${abiertos.length} · ${porCompletar.length}</span></div>
    ${det?`<details style="margin-top:6px"><summary style="cursor:pointer;font-size:12.5px;color:var(--accent)">➕ Detalle por tipo</summary><div style="margin-top:4px">${det}</div></details>`:''}
  </div></div>`;
}

  /* EL DESEMPEÑO DEL DÍA. Javi: «una opción de ver desempeño del día y que
     aparezca la gráfica del día de horas trabajadas reportadas con el color
     de lo trabajado, en lila lo pendiente entre tareas hasta su cierre
     (cuando se vaya); mientras esté laburando déjalo en blanco».
     Entonces: verde lo reportado, lila lo que quedó sin contar SÓLO cuando ya
     cerró el día, y blanco mientras sigue trabajando, porque todavía puede
     llenarlo. */
  function barraDia(t, tks, pu, dia, extraDia, cerro){
    var cap=puestoCap(pu), jor=Math.round((cap.sem||48)/6*60); // la jornada del día
    var mias=tks.filter(function(r){ return r.asignado_a===t.id; });
    var hoy=mias.filter(function(r){
      var d=(r.resuelto_at||r.cerrado_at||'').slice(0,10);
      return DONEP(r) && d===dia; });
    var min=hoy.reduce(function(s,r){ return s+(r.minutos_reales||r.minutos_estimados||0); },0)
            + (extraDia||0);
    var resto=Math.max(0, jor-min);
    var base=Math.max(jor,min,1);
    var p=function(x){ return Math.max(0,Math.min(100, x/base*100)); };
    var h=function(m){ return (Math.round(m/60*10)/10)+'h'; };
    return '<div class="mpdia">'
      +'<div class="prodrow"><span class="muted">Del día '+esc(dia)+'</span>'
        +'<span><b>'+h(min)+'</b> / '+h(jor)+(cerro?' · cerró':' · en turno')+'</span></div>'
      +'<div class="mpbar">'
        +'<i style="width:'+p(min)+'%;background:var(--ok)" title="Reportado: '+h(min)+' en '+hoy.length+' trabajos"></i>'
        +(resto>0?('<i style="width:'+p(resto)+'%;background:'+(cerro?'#7A5FB0':'transparent')
            +'" title="'+(cerro?('Entre tareas, sin reportar: '+h(resto)):'Todavía en turno')+'"></i>'):'')
      +'</div>'
      +'<div class="mpley">'+(cerro
          ? '<span><i style="background:#7A5FB0"></i>'+h(resto)+' entre tareas, sin reportar</span>'
          : '<span class="muted">En turno: lo que falta todavía puede llenarse.</span>')
      +'</div></div>';
  }

  function estilos(){
    if(document.getElementById('mttoProdCss')) return;
    var e=document.createElement('style'); e.id='mttoProdCss';
    e.textContent=
      '.mpgrid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));margin-top:10px}'
     +'.mpgrid .card{border:1px solid var(--rule,#E2DCCF);border-radius:12px;background:var(--surface,#fff)}'
     +'.mpgrid .pad{padding:12px 13px}'
     +'.mpgrid .prodrow{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:3px 0}'
     +'.mpgrid .muted{color:var(--muted,#6B6459)}'
     +'.mpgrid .ef{font-weight:700}'
     +'.mpdia{margin-top:8px;padding-top:8px;border-top:1px dashed var(--rule,#E2DCCF)}'
     +'.mpbar{height:9px;border-radius:5px;background:var(--surface-2,#EFE9DD);overflow:hidden;display:flex;margin:4px 0;'
     +'  border:1px solid var(--rule,#E2DCCF)}'
     +'.mpbar i{display:block;height:100%}'
     +'.mpley{font-size:11.5px;color:var(--muted,#6B6459)}'
     +'.mpley i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}';
    document.head.appendChild(e);
  }

  /* Trae lo que hace falta y pinta. `destino` es el id o el nodo. */
  async function monta(o){
    var sb=o.sb, prop=o.propertyId, dia=o.dia||null;
    var caja=(typeof o.destino==='string')?document.getElementById(o.destino):o.destino;
    if(!caja||!sb||!prop) return null;
    estilos();
    var wk=o.semana||mondayOf(dia||undefined);
    var dom=(function(){var d=new Date(wk+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10);})();
    var r=await Promise.all([
      sb.from('mtto_tickets').select('id,titulo,clasificacion,estado,asignado_a,asignado_nombre,minutos_estimados,minutos_reales,semana_programada,resuelto_at,cerrado_at,created_at,reportado_at').eq('property_id',prop),
      sb.from('mtto_puesto').select('*'),
      sb.from('employees').select('id,nombre,nombre_display,property_id').ilike('puesto','%mantenimiento%'),
      sb.from('mtto_tiempo').select('categoria,minutos,employee_id,fecha').eq('property_id',prop).eq('estado','validado').gte('fecha',wk).lte('fecha',dom)
    ]);
    var tks=r[0].data||[], puestos={}, tecs=(r[2].data||[]).filter(function(t){return t.property_id===prop;});
    (r[1].data||[]).forEach(function(p){ puestos[p.employee_id]=p; });
    var porEmp={}, porEmpDia={};
    (r[3].data||[]).forEach(function(x){
      var e=porEmp[x.employee_id]=porEmp[x.employee_id]||{min:0,byCat:{}};
      e.min+=(x.minutos||0); e.byCat[x.categoria]=(e.byCat[x.categoria]||0)+(x.minutos||0);
      if(dia && String(x.fecha).slice(0,10)===dia) porEmpDia[x.employee_id]=(porEmpDia[x.employee_id]||0)+(x.minutos||0);
    });
    if(!tecs.length){ caja.innerHTML='<div class="empty">Sin técnicos en esta sede.</div>'; return 0; }
    caja.innerHTML='<div class="mpgrid">'+tecs.map(function(t){
      var html=techProdCard(t,tks,puestos[t.id],wk,porEmp[t.id],{href:o.href});
      if(dia){
        /* Cerró el día si ya marcó salida: sin ese dato, se considera en
           turno hasta que termina la jornada en hora de México. */
        var cerro = o.cerrado ? !!o.cerrado[t.id]
          : (dia < new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'}));
        var dd=barraDia(t,tks,puestos[t.id],dia,porEmpDia[t.id],cerro);
        html=html.replace('</div></div>',
          '<details class="mpdet"><summary style="cursor:pointer;font-size:12.5px;color:var(--accent,#137A56);margin-top:6px">📅 Ver desempeño del día</summary>'
          +dd+'</details></div></div>');
      }
      return html;
    }).join('')+'</div>';
    return tecs.length;
  }

  window.mttoProd = { card: techProdCard, monta: monta, mondayOf: mondayOf, puestoCap: puestoCap };
})();
