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
   51% que le toca a HBR — actualizado el 25-sep-2026. */
var U={2027:1824090,2028:6012511,2029:6121834,2030:6981860,2031:7614547,
       2032:8406336,2033:9288033,2034:10270215,2035:11364716,2036:12584784};
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
function corrida(cfg){
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

/* Lo que se ve desde fuera. Todo lo demás queda encerrado aquí dentro para no
   pisar los globales de los módulos que cargan este archivo. */
window.RECOMPRA={
  SALEN:SALEN, QUEDAN:QUEDAN, U:U, ANIOS:ANIOS, BASE:BASE, TOTDIL:TOTDIL,
  VALFUT:VALFUT, DESC:DESC, SERIE_D:SERIE_D, SERIE_D_VIVA:SERIE_D_VIVA, VEST:VEST,
  PON_TODO:PON_TODO, STR_TODO:STR_TODO, ACC:ACC,
  money:money, mC:mC, pc:pc, corrida:corrida,
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
