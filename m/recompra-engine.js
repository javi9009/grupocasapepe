(function(){
/* ═══ Motor de la recompra · fuente única ══════════════════════════════════
   Lo usan /m/plan-recompra.html (el modelo completo) y /m/socios-gobierno.html
   (la opción S2 de cada socio). Si cambias un número, cámbialo AQUÍ.
   ════════════════════════════════════════════════════════════════════════ */
/* ── Los datos ────────────────────────────────────────────────────────────────
   Utilidad distribuible del modulador, ya con la remodelación: al EBITDA del
   operador se le suman Sincrético y Puebla, se le resta el corporativo, y sobre
   ese CONSOLIDADO se descuentan la reserva del 15% y el impuesto del 14% neto
   del crédito fiscal. El FLC es esa utilidad menos la deuda comprometida.
   Sincrético entra con el EBITDA de su modelo financiero (escenario base) al
   51% que le toca a HBR — versión del modelo del 25-sep-2026 (gerente general
   desde el mes 13; tours por hotel bajando de 3.46 a 2.03 hasta los 100 hoteles). */
var U={2027:2310813,2028:6852099,2029:8516809,2030:8802970,2031:9610322,
       2032:10491921,2033:11467470,2034:12547727,2035:13744716,2036:15071884};
var ANIOS=Object.keys(U).map(Number).sort(function(a,b){return a-b;});

/* Cuadro post-refundación: 348,600 acciones.
   La Serie D SÍ cobra dividendo. El supuesto: vestea el 75% de su tope de 69,720
   acciones —52,290— y las otras 17,430 se cancelan. Eso mueve los dos
   denominadores a la vez: la base que cobra sube y el total diluido baja.
   El remanente sin suscribir (69,302) no cobra, pero sí participaría en una venta. */
var SERIE_D=69720, VEST=0.75;
var SERIE_D_VIVA=SERIE_D*VEST;                 // 52,290 que cobran y valen
var BASE=209578+SERIE_D_VIVA;                  // 261,868 con derechos económicos
var ACC={jj:74346, pitao:43854, ae:22729, lj:22529, pontigu:19411, aldo:14416,
         starseeker:8907, struchture:3386};

/* Lo aportado dentro de cada vehículo. El Pontigu se reconoce en acta por
   $7,518,290.26 —lo que de verdad pusieron sus socios— y Javier Puente absorbe
   los $140,000 de diferencia contra lo que HBR le reconoce al vehículo. */
var PON_TODO=7518290, STR_TODO=4195000;

/* Quién sale. El capital es el EXHIBIDO por cada persona; las acciones solo
   determinan el % de dividendo mientras cobra. Guiot y Manzanilla están en los
   dos vehículos: cuentan como dos socios y cobran dos porciones del bote. */
var SALEN=[
 {k:'Starseeker, S.L.U.', n:'Joaquín Canals', v:'Starseeker', cap:3384307, acc:8907,  tot:3384307},
 {k:'Aldo Gelover Escamilla', n:'Aldo Gelover Escamilla', v:'directo',    cap:5579666, acc:14416, tot:5579666},
 {k:'PON-ANGEL', n:'Ángel Álvarez Cadavieco', v:'El Pontigu', cap:500000,  acc:19411, tot:PON_TODO},
 {k:'PON-CASADO', n:'Pedro Miguel Casado', v:'El Pontigu', cap:500000,  acc:19411, tot:PON_TODO},
 {k:'PON-MANZA', n:'Jorge León Manzanilla Cañizares', v:'El Pontigu',cap:500000,  acc:19411, tot:PON_TODO},
 {k:'PON-NABORI', n:'Nabori Medina Berrios', v:'El Pontigu', cap:500000,  acc:19411, tot:PON_TODO},
 {k:'PON-GUIOT', n:'Daniel Guiot Vial', v:'El Pontigu', cap:500000,  acc:19411, tot:PON_TODO},
 {k:'PON-ROBLEDO', n:'Marcos Robledo Gómez', v:'El Pontigu', cap:320000,  acc:19411, tot:PON_TODO},
 {k:'PON-AVELINO', n:'Avelino Fernández García', v:'El Pontigu', cap:209924,  acc:19411, tot:PON_TODO},
 {k:'PON-CALVE', n:'Esther Calvé Mortes', v:'El Pontigu', cap:200000,  acc:19411, tot:PON_TODO},
 {k:'PON-SANDRA', n:'Sandra Luz Sierra Arellano', v:'El Pontigu', cap:200000,  acc:19411, tot:PON_TODO},
 {k:'PON-MONICA', n:'Mónica Franco Mendoza', v:'El Pontigu', cap:100000,  acc:19411, tot:PON_TODO},
 {k:'STR-PPGA', n:'Pedro Pablo González Aguirregomezcorta', v:'Struchture',cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-MANZA', n:'Jorge León Manzanilla Cañizares', v:'Struchture',cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-CLAUSELL', n:'Alejandra Clausell Narro', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-GUIOT', n:'Daniel Guiot Vial', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-JFV', n:'Jaime Fernández-Villaverde Narvaiza', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-VERGARA', n:'Carlos Ramón Vergara', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-TONI', n:'Antonio Aguirregomezcorta', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-BOSCH', n:'María del Mar Bosch Vega', v:'Struchture', cap:450000,  acc:3386,  tot:STR_TODO},
 {k:'STR-JPSANTO', n:'Juan Pablo Santoveña Domenech', v:'Struchture', cap:225000,  acc:3386,  tot:STR_TODO},
 {k:'STR-FSANTO', n:'Francisco Santoveña Domenech', v:'Struchture', cap:225000,  acc:3386,  tot:STR_TODO}
];
/* Quién se queda y cobra dividendo. Los refundadores pagan la recompra. */
var QUEDAN=[
 {n:'Juan José Cué de la Fuente',  acc:74346, frac:1, ref:1, cap:1650000},
 {n:'PITAO · Jordi Sastre',        acc:43854, frac:1, ref:1, cap:6662464},
 {n:'AE Future · Estanislao Masiá',acc:22729, frac:1, ref:1, cap:3453746},
 {n:'Luis Javier Cué de la Fuente',acc:22529, frac:1, ref:1, cap:500000},
 /* lo que queda dentro de cada vehículo tras salir los suyos */
 {n:'El Pontigu (Javier, Estanis, Borchi, Óscar)', acc:19411, frac:3988366/PON_TODO, ref:0, cap:3988366},
 {n:'Struchture (Cejudo y Javier)',                acc:3386,  frac:145000/STR_TODO,  ref:0, cap:145000},
 {n:'Serie D · vesting de Javier Puente',          acc:SERIE_D_VIVA, frac:1, ref:0, cap:1547333}
];

/* Valuación de referencia a 2030, la misma que usa el panel de gobierno. Sirve
   para valorar lo que conserva el socio que NO vende: su participación sigue
   viva y eso no aparece en el dividendo. */
var VALFUT=60000000;
/* El dividendo se reparte solo entre las 209,578 acciones con derechos económicos,
   pero el VALOR de la participación va sobre las 348,600 TOTALMENTE DILUIDAS: en
   una venta participan también la Serie D y el remanente sin suscribir. Por eso el
   residual se calcula con otro denominador que el dividendo. */
var TOTDIL=348600-SERIE_D*(1-VEST);            // 331,170 tras cancelar lo que no vestea
/* Un peso de 2034 no vale lo que uno de 2027. Todo lo que sigue se mide también
   a valor presente: el que sale cobra antes, y eso vale. */
var DESC=3.5;   /* inflación · lo que se deprecia el dinero, no costo de oportunidad */
var money=function(v){ return '$'+Math.round(v).toLocaleString('es-MX'); };
var mC=function(v){ var a=Math.abs(v);
  return a>=1e6 ? '$'+(v/1e6).toFixed(2)+' M' : a>=1e3 ? '$'+Math.round(v/1e3)+' k' : money(v); };
var pc=function(v,d){ return (v*100).toFixed(d==null?2:d)+'%'; };

/* El motor. Cada año: el bote se divide entre los socios que todavía tienen
   saldo, cada uno le suma su % de dividendo, y el pago se topa al saldo que le
   falta. Lo que sobra va a dividendo; los refundadores absorben la recompra. */
function corrida(cfg){ return corridaCon(SALEN, QUEDAN, cfg); }
/* El mismo motor, pero sobre listas cualesquiera: así se puede simular qué
   pasaría si un socio que hoy se queda decidiera salir. */
function corridaCon(SALEN, QUEDAN, cfg){
  cfg=cfg||{};
  var BOTE=cfg.BOTE!=null?cfg.BOTE:0.25,
      PNv =cfg.PNv !=null?cfg.PNv :22.89,
      DEUDA=cfg.DEUDA!=null?cfg.DEUDA:750000;
  var dil=1-PNv/100;
  var est=SALEN.map(function(s){
    return {pct:(s.acc/BASE)*dil*(s.cap/s.tot), saldo:s.cap, cobra:0, liq:null}; });
  var qest=QUEDAN.map(function(q){ return {pct:(q.acc/BASE)*dil*q.frac, div:0}; });
  var refP=QUEDAN.reduce(function(t,q,i){ return t + (q.ref?qest[i].pct:0); },0);
  var filas=ANIOS.map(function(a){
    var flc=U[a]-DEUDA;
    var act=est.map(function(e,i){ return i; }).filter(function(i){ return est[i].saldo>1; });
    var f={anio:a, flc:flc, n:act.length, bote:act.length?BOTE/act.length:0, pago:{}, tasa:{}, saldo:{}, div:{}};
    var usado=0;
    act.forEach(function(i){
      var tasa=f.bote+est[i].pct;
      var p=Math.min(Math.max(0,tasa*flc), est[i].saldo);
      est[i].saldo-=p; est[i].cobra+=p; usado+=p;
      if(est[i].saldo<1 && est[i].liq===null) est[i].liq=a;
      f.pago[i]=p; f.tasa[i]=tasa; f.saldo[i]=est[i].saldo;
    });
    f.remod=(PNv/100)*flc;
    var noRef=0;
    QUEDAN.forEach(function(q,i){ if(q.ref) return;
      var d=qest[i].pct*flc; f.div[i]=d; qest[i].div+=d; noRef+=d; });
    f.bolsa=flc-usado-f.remod-noRef;
    QUEDAN.forEach(function(q,i){ if(!q.ref) return;
      var d=refP>0 ? f.bolsa*(qest[i].pct/refP) : 0; f.div[i]=d; qest[i].div+=d; });
    f.usado=usado; f.noRef=noRef;
    return f;
  });
  return {filas:filas, est:est, qest:qest};
}

function simularFn(h, cfg){
  if(!h || !h.cap) return null;
  var nuevo={k:'__sim', n:h.n, v:h.v||'hipótesis', cap:h.cap, acc:h.acc, tot:h.tot||h.cap};
  var S2=SALEN.concat([nuevo]);
  var Q2=QUEDAN.map(function(q){ return {n:q.n, acc:q.acc, frac:q.frac, ref:q.ref, cap:q.cap}; });
  if(h.quita) Q2=Q2.filter(function(q){ return q.n!==h.quita; });
  else if(h.dentroDe) Q2.forEach(function(q){
    if(q.n===h.dentroDe) q.frac=Math.max(0, q.frac - h.cap/(h.tot||h.cap)); });
  var idx=S2.length-1, R=corridaCon(S2,Q2,cfg), e=R.est[idx], filas=[];
  R.filas.forEach(function(f){
    if(f.pago[idx]==null) return;
    filas.push({anio:f.anio, flc:f.flc, n:f.n, bote:f.bote, tasa:f.tasa[idx],
                pago:f.pago[idx], saldo:f.saldo[idx]});
  });
  return {i:idx, socio:nuevo, cobra:e.cobra, liq:e.liq, filas:filas, hipotetico:true, h:h};
}

/* ── Las tres puertas ───────────────────────────────────────────────────────
   REFUNDAR  · exhibe su compromiso, conserva todas sus acciones y sigue siendo
               refundador: cobra su parte de la bolsa que queda tras pagar la
               recompra. Invierte lo exhibido MÁS la suscripción.
   DILUIRSE  · se queda pero no suscribe: sus acciones son solo las vigentes y
               deja de ser refundador, así que cobra prorrata intacta —ni paga
               la recompra ni participa del sobrante. Invierte solo lo exhibido.
   SALIRSE   · recompra al 100% del capital exhibido, sin prima ni dividendo.
   Los múltiplos son NOMINALES: no descuentan la depreciación del dinero. */
function comparativaFn(h, cfg){
  if(!h || !h.quita) return null;
  var iq=-1; QUEDAN.forEach(function(q,i){ if(q.n===h.quita) iq=i; });
  if(iq<0) return null;

  var base=corridaCon(SALEN,QUEDAN,cfg);
  var Qd=QUEDAN.map(function(q){ return {n:q.n, acc:q.acc, frac:q.frac, ref:q.ref, cap:q.cap}; });
  Qd[iq].acc=h.acc; Qd[iq].ref=0;
  var dil=corridaCon(SALEN,Qd,cfg);
  var sal=simularFn(h,cfg), pag={};
  if(sal) sal.filas.forEach(function(r){ pag[r.anio]=r.pago; });

  var invRef=(h.cap||0)+(h.susc||0), invDil=h.cap||0;
  function acum(n, get){ var t=0; for(var i=0;i<n && i<ANIOS.length;i++) t+=get(i)||0; return t; }
  return [4,6,8].map(function(n){
    var flc=acum(n,function(i){ return base.filas[i].flc; });
    var r=acum(n,function(i){ return base.filas[i].div[iq]; });
    var d=acum(n,function(i){ return dil.filas[i].div[iq]; });
    var x=acum(n,function(i){ return pag[ANIOS[i]]; });
    return {anios:n, hasta:ANIOS[Math.min(n,ANIOS.length)-1], flc:flc, flcAnio:flc/n,
      ref:{cobra:r, inv:invRef, mult:invRef?r/invRef:0, anio:r/n},
      dil:{cobra:d, inv:invDil, mult:invDil?d/invDil:0, anio:d/n},
      sal:{cobra:x, inv:invDil, mult:invDil?x/invDil:0, anio:x/n}};
  });
}

/* Lo que se ve desde fuera. Todo lo demás queda encerrado aquí dentro para no
   pisar los globales de los módulos que cargan este archivo. */
window.RECOMPRA={
  SALEN:SALEN, QUEDAN:QUEDAN, U:U, ANIOS:ANIOS, BASE:BASE, TOTDIL:TOTDIL,
  VALFUT:VALFUT, DESC:DESC, SERIE_D:SERIE_D, SERIE_D_VIVA:SERIE_D_VIVA, VEST:VEST,
  PON_TODO:PON_TODO, STR_TODO:STR_TODO, ACC:ACC,
  money:money, mC:mC, pc:pc, corrida:corrida, REFTOT:348600, REFPPS:22.19343,
  /* ── Escenario: ¿y si saliera un socio que hoy se queda? ─────────────────
     Lo que recupera es lo EXHIBIDO, no lo comprometido: si no suscribe, esa
     parte ni se le devuelve ni le cuenta para el dividendo. Por eso cada
     hipótesis lleva sus acciones y su capital ya netos de la suscripción
     pendiente. Es una estimación para ese socio: el plan del resto no se toca. */
  HIPOTESIS:{
    'PITAO, S.A.P.I. de C.V.':        {n:'PITAO · Jordi Sastre',        cap:6034057, acc:15539, tot:6034057, quita:'PITAO · Jordi Sastre',         susc:628407,  accSusc:28315, accTot:43854},
    'AE Future, S.A. de C.V.':        {n:'AE Future · Estanislao Masiá',cap:3128193, acc:8061,  tot:3128193, quita:'AE Future · Estanislao Masiá', susc:325553,  accSusc:14668, accTot:22729},
    'Juan José Cué de la Fuente':     {n:'Juan José Cué de la Fuente',  cap:1150000, acc:51815, tot:1150000, quita:'Juan José Cué de la Fuente',    susc:500000,  accSusc:22531, accTot:74346},
    'Luis Javier Cué de la Fuente':   {n:'Luis Javier Cué de la Fuente',cap:500000,  acc:22529, tot:500000,  quita:'Luis Javier Cué de la Fuente',  susc:0,       accSusc:0, accTot:22529}
  },
  /* h = {n,cap,acc,tot} + quita (sale entero de QUEDAN) o dentroDe (baja la
     fracción que le queda al vehículo). Devuelve lo mismo que socio(). */
  simular:simularFn,
  /* Las tres puertas de un socio de HBR, medidas a 4, 6 y 8 años. */
  comparativa:comparativaFn,
  __simular:function(h, cfg){
    if(!h || !h.cap) return null;
    var nuevo={k:'__sim', n:h.n, v:h.v||'hipótesis', cap:h.cap, acc:h.acc, tot:h.tot||h.cap};
    var S2=SALEN.concat([nuevo]);
    var Q2=QUEDAN.map(function(q){ return {n:q.n, acc:q.acc, frac:q.frac, ref:q.ref, cap:q.cap}; });
    if(h.quita) Q2=Q2.filter(function(q){ return q.n!==h.quita; });
    else if(h.dentroDe) Q2.forEach(function(q){
      if(q.n===h.dentroDe) q.frac=Math.max(0, q.frac - h.cap/(h.tot||h.cap)); });
    var idx=S2.length-1, R=corridaCon(S2,Q2,cfg), e=R.est[idx], filas=[];
    R.filas.forEach(function(f){
      if(f.pago[idx]==null) return;
      filas.push({anio:f.anio, flc:f.flc, n:f.n, bote:f.bote, tasa:f.tasa[idx],
                  pago:f.pago[idx], saldo:f.saldo[idx]});
    });
    return {i:idx, socio:nuevo, cobra:e.cobra, liq:e.liq, filas:filas, hipotetico:true, h:h};
  },
  /* La corrida de un socio concreto, por nombre. Devuelve null si no sale. */
  socio:function(clave, vehiculo, cfg){
    var idx=-1;
    for(var i=0;i<SALEN.length;i++){
      if(SALEN[i].k!==clave && SALEN[i].n!==clave) continue;
      if(vehiculo && SALEN[i].v!==vehiculo) continue;
      idx=i; break;
    }
    if(idx<0) return null;
    var R=corrida(cfg), e=R.est[idx], filas=[];
    R.filas.forEach(function(f){
      if(f.pago[idx]==null) return;
      filas.push({anio:f.anio, flc:f.flc, n:f.n, bote:f.bote, tasa:f.tasa[idx],
                  pago:f.pago[idx], saldo:f.saldo[idx]});
    });
    return {i:idx, socio:SALEN[idx], cobra:e.cobra, liq:e.liq, filas:filas};
  }
};
})();
