/* EL CUESTIONARIO DE IMPACTO DE LA EMPRESA.
   Javi, 26-oct-2026: «preguntas finales de impacto: adapta el formulario y el
   diseño». Esto es el catálogo del diseño (Impacto Empresa.dc.html) traído tal
   cual, con sus dos juegos de preguntas —ateneísta y hotel— y el mapeo de cada
   respuesta a metas de los ODS.

   POR QUÉ EL CATÁLOGO VIVE AQUÍ Y NO EN LA BASE. Las preguntas se van a mover
   -se añade una, se reescribe otra- y la tabla no debería moverse con ellas.
   En `impacto_respuestas` se guarda sólo la clave y lo contestado; qué
   significa cada clave lo dice este archivo. Si mañana se retira una pregunta,
   lo contestado no se pierde: deja de pintarse.

   NOSOTROS ELEGIMOS EL INDICADOR, ÉL CONTESTA. Nadie tiene que saberse los
   ODS: contesta cómo trabaja y aquí se traduce. Es la frase del diseño y es
   la razón de que las preguntas estén en castellano de taller y no de informe.

   Los ODS son de Naciones Unidas. La cuenta es nuestra, con lo que el
   ateneísta declara; que salga aquí no significa que la ONU la respalde. */
(function(){
'use strict';

var C = {1:'#E5243B',2:'#DDA63A',3:'#4C9F38',4:'#C5192D',5:'#FF3A21',6:'#26BDE2',
         7:'#FCC30B',8:'#A21942',9:'#FD6925',10:'#DD1367',11:'#FD9D24',12:'#BF8B2E',
         13:'#3F7E44',14:'#0A97D9',15:'#56C02B',16:'#00689D',17:'#19486A'};

var GN = ['Fin de la pobreza','Hambre cero','Salud y bienestar','Educación de calidad',
  'Igualdad de género','Agua limpia','Energía limpia','Trabajo decente y crecimiento',
  'Industria e innovación','Menos desigualdades','Ciudades y comunidades sostenibles',
  'Producción y consumo responsables','Acción por el clima','Vida submarina',
  'Vida de ecosistemas terrestres','Paz y justicia','Alianzas'];

/* El nombre de cada meta en palabras, no en jerga. */
var TN = {'2.1':'Que nadie pase hambre','3.9':'Salud sin contaminación',
  '4.4':'Competencias para el empleo','4.7':'Educar para la sostenibilidad',
  '5.5':'Mujeres en el liderazgo','6.3':'Tratar y reusar agua','6.4':'Usar el agua con eficiencia',
  '7.2':'Energía renovable','8.5':'Empleo pleno y salario digno','8.6':'Jóvenes con empleo',
  '8.8':'Derechos laborales','8.9':'Turismo que crea empleo y cultura local',
  '10.2':'Inclusión de todas las personas','11.4':'Proteger el patrimonio cultural',
  '11.6':'Menos impacto en la ciudad','11.7':'Espacios para todas las personas',
  '12.2':'Usar bien los recursos','12.3':'Menos comida tirada','12.5':'Menos residuos',
  '12.6':'Empresas que reportan','12.7':'Comprar con criterio','13.3':'Acción climática',
  '14.1':'Menos basura al mar','15.3':'Recuperar la tierra','16.6':'Instituciones transparentes',
  '17.17':'Alianzas con la comunidad'};

/* Los cinco compromisos de Glasgow, y qué pregunta los enciende. */
var GLASGOW = [
  {k:'medir',    n:'Medir',     why:'Medir la huella de lo que haces',            de:['huella']},
  {k:'descarb',  n:'Descarbonizar', why:'Bajar las emisiones de tu operación',    de:['oficina','energia','plastico']},
  {k:'regenerar',n:'Regenerar', why:'Devolverle algo a la naturaleza y al barrio',de:['reinv','residuos','agua']},
  {k:'colaborar',n:'Colaborar', why:'Hacerlo con otros, no en solitario',          de:['dirige','compras']},
  {k:'financiar',n:'Financiar', why:'Poner dinero detrás del compromiso',          de:['reinv']}
];

var ATENEISTA = [
  {k:'equipo', q:'¿Cómo le pagas a la gente que trabaja contigo?',
   why:'Durante todo el año, no en un tour.',
   opts:[['Nómina con prestaciones',['8.5','8.8']],['Por salida, con factura',['8.5']],
         ['Honorarios sin contrato',[]],['Voluntarios',[]]]},
  {k:'viven', q:'¿Dónde vive la mayoría de tu equipo?',
   why:'Que el sueldo se quede donde se trabaja es lo que evita el desplazamiento.',
   opts:[['En los barrios donde opera',['8.9','11.4']],['En la misma ciudad',['8.9']],
         ['Fuera de la ciudad',[]]]},
  {k:'dirige', q:'¿Quién dirige la empresa?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Mujeres',['5.5']],['Jóvenes',['8.6']],['Personas indígenas o migrantes',['10.2']],
         ['Una cooperativa o colectivo',['17.17']]]},
  {k:'compras', q:'De lo que gasta la empresa al año, ¿cuánto es con proveedores locales?',
   why:'Insumos, transporte, papelería, mantenimiento: todo lo que no es un tour.',
   opts:[['Casi nada',[]],['25%',['12.7']],['50%',['12.7']],['75%',['12.7','8.9']],
         ['Casi todo',['12.7','8.9']]],
   monto:{k:'gasto', et:'GASTO ANUAL DE LA EMPRESA', unidad:'al año'}},
  {k:'impuestos', q:'¿Facturas y pagas impuestos en México?',
   why:'Lo que se paga aquí sostiene lo público del lugar que visitas.',
   opts:[['Sí, factura todo',['16.6']],['En parte',['16.6']],['Todavía no',[]]]},
  {k:'oficina', q:'Tu oficina y tu operación diaria', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Energía renovable',['7.2','13.3']],['Sin oficina propia',['13.3']],
         ['Separamos residuos',['12.5']],['Limpiamos o restauramos un espacio',['11.4']]]},
  {k:'huella', q:'¿Mides la huella de carbono de la empresa?',
   why:'Es el primer compromiso de Glasgow.',
   opts:[['Sí, cada año',['13.3']],['Una vez',['13.3']],
         ['Compensamos con bonos certificados',['13.3']],['No todavía',[]]]},
  {k:'forma', q:'¿En qué formas a tu equipo?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Idiomas',['4.4']],['Primeros auxilios',['4.4']],
         ['Historia y patrimonio',['4.7','11.4']],['Sostenibilidad',['4.7']]]},
  {k:'reinv', q:'¿Reinviertes parte de lo que ganas en la comunidad?',
   why:'Escuela, fondo del barrio, becas, mantenimiento.',
   opts:[['Sí, un monto fijo al año',['11.4','17.17']],['Sí, un % de las utilidades',['11.4','17.17']],
         ['No todavía',[]]],
   monto:{k:'reinvMonto', et:'CUÁNTO AL AÑO', unidad:'al año'}},
  {k:'glasgow', q:'¿Ya firmaste la Declaración de Glasgow?',
   why:'Ya contestaste lo más difícil. Firmar es una carta compromiso que se renueva cada año.',
   opts:[['Sí, ya firmamos',['13.3','17.17']],['Estamos en eso',[]],['No todavía',[]]]}
];

var HOTEL = [
  {k:'equipo', q:'¿Cómo contratas a tu equipo?',
   why:'Recepción, limpieza, mantenimiento, cocina: todo el año.',
   opts:[['Nómina con prestaciones',['8.5','8.8']],['Parte por honorarios',['8.5']],
         ['Por agencia o outsourcing',[]]]},
  {k:'viven', q:'¿Dónde vive la mayoría de tu equipo?',
   why:'Que el sueldo se quede cerca es lo que sostiene al barrio.',
   opts:[['En el mismo barrio',['8.9','11.4']],['En la misma ciudad',['8.9']],
         ['Lejos, más de una hora de camino',[]]]},
  {k:'compras', q:'De lo que compra el hotel, ¿cuánto es a proveedores locales?',
   why:'Desayuno, amenidades, blancos, mantenimiento, lavandería.',
   opts:[['Casi nada',[]],['25%',['12.7']],['50%',['12.7']],['75%',['12.7','8.9']],
         ['Casi todo',['12.7','8.9']]],
   monto:{k:'gasto', et:'GASTO ANUAL EN PROVEEDORES', unidad:'al año'}},
  {k:'energia', q:'¿Cómo usas la energía?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Paneles solares o luz renovable',['7.2','13.3']],['Calentador solar',['7.2','13.3']],
         ['Focos LED y sensores',['7.2']],['Tarjeta que apaga el cuarto',['7.2']]]},
  {k:'agua', q:'¿Qué haces con el agua?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Regaderas y llaves ahorradoras',['6.4']],['Cambio de toallas a petición',['6.4','12.5']],
         ['Captamos lluvia',['6.4','11.6']],['Tratamos o reusamos agua',['6.3']]]},
  {k:'residuos', q:'¿Y con la basura?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Separamos residuos',['12.5']],['Compostamos lo orgánico',['12.5','15.3']],
         ['Donamos comida o blancos',['2.1','12.3']]]},
  {k:'plastico', q:'¿Plásticos de un solo uso en el cuarto?', why:'Botellitas, amenidades, vasos.',
   opts:[['Ninguno, todo a granel',['12.5','14.1']],['Ya casi no',['12.5']],['Todavía sí',[]]]},
  {k:'huella', q:'¿Mides la huella de carbono del hotel?',
   why:'Luz, gas, agua y lavandería por noche vendida. Es el primer compromiso de Glasgow.',
   opts:[['Sí, cada año',['13.3']],['Una vez',['13.3']],
         ['Compensamos con bonos certificados',['13.3']],['No todavía',[]]]},
  {k:'accesible', q:'¿Quién puede hospedarse sin problema?', why:'Marca todo lo que aplique.', multi:true,
   opts:[['Rampa y elevador',['10.2','11.7']],['Cuarto adaptado',['10.2']],
         ['Personal que habla otro idioma',['10.2']],['Bienvenidas mascotas',[]]]},
  {k:'reinv', q:'¿Reinviertes parte de lo que ganas en el barrio?',
   why:'Escuela, fondo del barrio, becas, mantenimiento.',
   opts:[['Sí, un monto fijo al año',['11.4','17.17']],['Sí, un % de las utilidades',['11.4','17.17']],
         ['No todavía',[]]],
   monto:{k:'reinvMonto', et:'CUÁNTO AL AÑO', unidad:'al año'}},
  {k:'glasgow', q:'¿Ya firmaste la Declaración de Glasgow?',
   why:'Ya contestaste lo más difícil. Firmar es una carta compromiso que se renueva cada año.',
   opts:[['Sí, ya firmamos',['13.3','17.17']],['Estamos en eso',[]],['No todavía',[]]]}
];

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function dinero(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-MX'); }

var CSS = [
'.imp{display:flex;flex-direction:column;gap:14px;font-family:Inter,system-ui,sans-serif;color:#1E1A16}',
'.imp .cab{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}',
'.imp .cab b{font:700 20px Oswald;letter-spacing:.03em}',
'.imp .cab span{font:600 13px Inter;color:#3C3630}',
'.imp .lead{font:400 13.5px/1.5 Inter;color:#6E665C;max-width:720px}',
'.imp .barra{height:6px;border-radius:3px;background:#E6DFD6;overflow:hidden}',
'.imp .barra i{display:block;height:100%;background:#F2682A;transition:width .3s}',
'.imp .q{background:#fff;border:1.5px solid #E6DFD6;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}',
'.imp .q.falta{border-color:#F2682A}',
'.imp .q .top{display:flex;gap:12px;align-items:flex-start}',
'.imp .q .n{width:28px;height:28px;flex:none;border-radius:50%;display:grid;place-items:center;font:600 12px Inter;background:#F6EBD5;color:#8C6212}',
'.imp .q.ok .n{background:#1D6B4A;color:#fff}',
'.imp .q .tx{flex:1;min-width:0}',
'.imp .q .tx b{font:600 16px Inter;display:block}',
'.imp .q .tx span{font:400 12.5px/1.45 Inter;color:#6E665C;display:block;margin-top:2px}',
'.imp .opts{display:flex;flex-wrap:wrap;gap:7px;padding-left:40px}',
'.imp .opts button{cursor:pointer;min-height:40px;display:flex;align-items:center;padding:0 14px;border-radius:999px;font:500 14px Inter;border:1.5px solid #E6DFD6;background:#fff;color:#3C3630}',
'.imp .opts button.on{border-color:#F2682A;background:#F2682A;color:#fff}',
'.imp .monto{margin-left:40px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#FBF7F2;border:1px solid #EFE9E1;border-radius:10px;padding:10px 12px}',
'.imp .monto .et{font:600 11px Oswald;letter-spacing:.09em;color:#6E665C}',
'.imp .monto .caja{display:flex;align-items:center;border:1.5px solid #E6DFD6;border-radius:8px;background:#fff;overflow:hidden}',
'.imp .monto .caja span{padding:0 8px;color:#6E665C;font:500 14px Inter}',
'.imp .monto input{width:120px;border:none;padding:9px 6px;font-size:14px;font-weight:600;outline:none}',
'.imp .monto .out{font:600 12.5px Inter;color:#1D6B4A}',
'.imp .metas{margin-left:40px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
'.imp .metas .et{font:400 12px Inter;color:#6E665C}',
'.imp .meta{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 3px;border-radius:999px;background:#F4EFE8}',
'.imp .meta i{min-width:30px;height:22px;padding:0 5px;border-radius:5px;display:grid;place-items:center;font:700 11px Oswald;color:#fff;font-style:normal}',
'.imp .meta span{font:500 12.5px Inter}',
'.imp .panel{background:#1E1A16;color:#fff;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:16px}',
'.imp .panel .t{font:600 12px Oswald;letter-spacing:.09em;color:#C9C2B8}',
'.imp .ods{display:grid;grid-template-columns:repeat(9,1fr);gap:5px}',
'@media(max-width:560px){.imp .ods{grid-template-columns:repeat(6,1fr)}}',
'.imp .ods div{aspect-ratio:1;border-radius:6px;display:grid;place-items:center;font:700 15px Oswald;transition:background .35s}',
'.imp .pie{display:flex;gap:14px;font:400 11.5px Inter;color:#A9A096;flex-wrap:wrap}',
'.imp .glas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
'.imp .glas div{border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;background:#2A241F}',
'.imp .glas div.on{background:#1D6B4A}',
'.imp .glas b{font:600 13px Oswald;letter-spacing:.06em;display:flex;justify-content:space-between}',
'.imp .glas span{font:400 11.5px/1.4 Inter;color:#C9C2B8}',
'.imp .nota{font:400 11px/1.5 Inter;color:#A9A096}',
'.imp .guardar{display:flex;gap:9px;align-items:center;flex-wrap:wrap}'
].join('\n');

function pintaEstilos(){
  if(document.getElementById('cp-impacto-css')) return;
  var st=document.createElement('style'); st.id='cp-impacto-css'; st.textContent=CSS;
  document.head.appendChild(st);
}

/* ---------- el montaje ---------- */
/* opc = {caja, tipo:'ateneista'|'hotel', id, get(), set(), guardar()} */
function montar(opc){
  pintaEstilos();
  var caja = typeof opc.caja==='string' ? document.getElementById(opc.caja) : opc.caja;
  if(!caja) return null;
  var PRE = opc.tipo==='hotel' ? HOTEL : ATENEISTA;
  var R = opc.valores || {};

  function metasDe(q){
    var v = R[q.k];
    var sel = q.multi ? (v||[]) : (v?[v]:[]);
    var out = [];
    q.opts.forEach(function(o){ if(sel.indexOf(o[0])>=0) o[1].forEach(function(t){
      if(out.indexOf(t)<0) out.push(t); }); });
    return out;
  }
  function contestadas(){
    return PRE.filter(function(q){ var v=R[q.k];
      return q.multi ? (v&&v.length) : !!v; }).length;
  }

  function pinta(){
    var hechas=contestadas(), encendidos={}, glasOn={};
    PRE.forEach(function(q){ metasDe(q).forEach(function(t){ encendidos[parseInt(t,10)]=true; }); });
    GLASGOW.forEach(function(g){
      glasOn[g.k] = g.de.some(function(k){
        var v=R[k]; if(!v) return false;
        if(Array.isArray(v)) return v.length>0;
        return String(v).indexOf('No todavía')<0;
      });
    });
    if(String(R.glasgow||'').indexOf('Sí')===0){ GLASGOW.forEach(function(g){ glasOn[g.k]=true; }); }
    var nOds=Object.keys(encendidos).length, nGlas=GLASGOW.filter(function(g){return glasOn[g.k];}).length;

    var h='<div class="imp">';
    h+='<div class="cab"><b>MI IMPACTO · TÚ CONTESTAS, NOSOTROS ELEGIMOS EL INDICADOR</b>'+
       '<span>'+hechas+' de '+PRE.length+'</span></div>'+
       '<div class="lead">Nadie tiene que saberse los ODS. Cuenta cómo trabajas y aquí se traduce.</div>'+
       '<div class="barra"><i style="width:'+Math.round(hechas/PRE.length*100)+'%"></i></div>';

    PRE.forEach(function(q,i){
      var v=R[q.k], sel = q.multi ? (v||[]) : (v?[v]:[]);
      var hecha = sel.length>0, metas=metasDe(q);
      h+='<div class="q '+(hecha?'ok':'falta')+'">'+
        '<div class="top"><div class="n">'+(hecha?'✓':(i+1))+'</div>'+
          '<div class="tx"><b>'+esc(q.q)+'</b><span>'+esc(q.why)+'</span></div></div>'+
        '<div class="opts">'+q.opts.map(function(o){
          return '<button type="button" data-q="'+esc(q.k)+'" data-o="'+esc(o[0])+'" class="'+
            (sel.indexOf(o[0])>=0?'on':'')+'">'+esc(o[0])+'</button>'; }).join('')+'</div>';
      /* El monto solo se pide cuando la respuesta lo hace significar algo:
         preguntar cuanto gasta a quien contesto "casi nada" es pedir un dato
         que no va a usar nadie. */
      if(q.monto && metas.length){
        var m=Number(R[q.monto.k])||0;
        var pct={'25%':.25,'50%':.5,'75%':.75,'Casi todo':.9,'Casi nada':.05}[v]||0;
        h+='<div class="monto"><span class="et">'+esc(q.monto.et)+'</span>'+
           '<div class="caja"><span>$</span><input type="number" min="0" step="1000" data-m="'+
             esc(q.monto.k)+'" value="'+(m||'')+'"></div>'+
           '<span class="et" style="letter-spacing:0;text-transform:none;font-weight:400">'+esc(q.monto.unidad)+'</span>'+
           (pct&&m?'<span class="out">= '+dinero(m*pct)+' en el barrio</span>':'')+'</div>';
      }
      if(metas.length){
        h+='<div class="metas"><span class="et">Cuenta para</span>'+metas.map(function(t){
          return '<div class="meta"><i style="background:'+C[parseInt(t,10)]+'">'+esc(t)+'</i>'+
                 '<span>'+esc(TN[t]||'')+'</span></div>'; }).join('')+'</div>';
      }
      h+='</div>';
    });

    h+='<div class="panel">'+
      '<div><div class="t">LOS 17 OBJETIVOS · SE ILUMINAN CON LO QUE CONTESTAS</div>'+
      '<div class="ods" style="margin-top:9px">'+GN.map(function(n,k){
        var on=encendidos[k+1];
        return '<div title="'+esc((k+1)+' · '+n)+'" style="background:'+(on?C[k+1]:'#2A241F')+
               ';color:'+(on?'#fff':'#6E665C')+'">'+(k+1)+'</div>'; }).join('')+'</div>'+
      '<div class="pie" style="margin-top:9px"><span>'+nOds+' de 17 encendidos</span>'+
        '<span>Se encienden con lo que declaras, no con lo que te gustaría.</span></div></div>'+
      '<div style="border-top:1px solid #3C3630;padding-top:14px">'+
      '<div class="t">DECLARACIÓN DE GLASGOW · '+nGlas+' DE 5</div>'+
      '<div class="glas" style="margin-top:9px">'+GLASGOW.map(function(g){
        return '<div class="'+(glasOn[g.k]?'on':'')+'"><b>'+esc(g.n)+'<span>'+(glasOn[g.k]?'✓':'—')+'</span></b>'+
               '<span>'+esc(g.why)+'</span></div>'; }).join('')+'</div></div>'+
      '<div class="nota">Los ODS son de Naciones Unidas. Esta cuenta es nuestra, con lo que tú declaras; '+
      'que salga aquí no significa que la ONU la respalde.</div></div>';

    h+='<div class="guardar"><button type="button" class="btn" id="impGuardar">Guardar mi impacto</button>'+
       '<span class="nota" id="impEco"></span></div></div>';
    caja.innerHTML=h;
    enlaza();
  }

  function enlaza(){
    Array.prototype.forEach.call(caja.querySelectorAll('[data-q]'),function(b){
      b.onclick=function(){
        var k=b.getAttribute('data-q'), o=b.getAttribute('data-o');
        var q=PRE.filter(function(x){return x.k===k;})[0]; if(!q) return;
        if(q.multi){
          var l=(R[k]||[]).slice(), i=l.indexOf(o);
          if(i<0) l.push(o); else l.splice(i,1);
          R[k]=l;
        } else { R[k] = (R[k]===o) ? null : o; }
        pinta();
      };
    });
    Array.prototype.forEach.call(caja.querySelectorAll('[data-m]'),function(inp){
      inp.onchange=function(){ R[inp.getAttribute('data-m')] = inp.value===''?null:Number(inp.value); pinta(); };
    });
    var g=caja.querySelector('#impGuardar');
    if(g) g.onclick=function(){
      g.disabled=true; g.textContent='Guardando…';
      Promise.resolve(opc.guardar ? opc.guardar(R) : null).then(function(){
        g.disabled=false; g.textContent='Guardar mi impacto';
        var e=caja.querySelector('#impEco'); if(e) e.textContent='Guardado.';
      }).catch(function(err){
        g.disabled=false; g.textContent='Guardar mi impacto';
        var e=caja.querySelector('#impEco');
        if(e) e.textContent='No se pudo guardar: '+((err&&err.message)||err);
      });
    };
  }

  pinta();
  return { valores:function(){ return R; }, repinta:pinta };
}

/* Lo contestado se guarda una fila por pregunta, igual que hotel_impacto: asi
   una pregunta que se retire no arrastra consigo las demas. Las de varias
   respuestas se guardan separadas por « | ». */
function aFilas(entidad, id, R){
  var out=[];
  Object.keys(R).forEach(function(k){
    var v=R[k];
    if(v==null || (Array.isArray(v) && !v.length)) return;
    out.push({entidad:entidad, entidad_id:id, pregunta:k,
              valor: Array.isArray(v) ? v.join(' | ') : String(v)});
  });
  return out;
}
function deFilas(tipo, filas){
  var PRE = tipo==='hotel' ? HOTEL : ATENEISTA, R={};
  (filas||[]).forEach(function(f){
    var q=PRE.filter(function(x){return x.k===f.pregunta;})[0];
    if(q && q.multi) R[f.pregunta]=String(f.valor||'').split(' | ').filter(Boolean);
    else if(/^-?\d+(\.\d+)?$/.test(String(f.valor||''))) R[f.pregunta]=Number(f.valor);
    else R[f.pregunta]=f.valor;
  });
  return R;
}

window.cpImpacto = { montar:montar, aFilas:aFilas, deFilas:deFilas,
                     preguntas:{ateneista:ATENEISTA, hotel:HOTEL}, ods:C, metas:TN, glasgow:GLASGOW };
})();
