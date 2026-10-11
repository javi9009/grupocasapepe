/* EL PANEL DE COMPRA DEL BOLETO.
 *
 * Javi, 10-oct-2026: «esta segunda pantalla incorpórala a la primera». Hasta
 * ahora la ficha del evento tenía un botón que llevaba a otra pantalla a elegir
 * cuántos boletos: dos páginas para una sola decisión. Ahora el panel vive
 * dentro de la ficha y evento-compra.html solo lo envuelve, para que las ligas
 * sueltas que ya circulan sigan funcionando.
 *
 * Lo que pidió que fuera, en su orden:
 *   ¿cuántas personas vienen? · la fecha, fija · el precio, que se mueve con
 *   las personas · el desglose y el total · el código de pago · Pagar.
 *
 * Y después del Pagar: si ya está dado de alta, derecho a la tarjeta con sus
 * datos puestos; si no, el pop-up de alta (Google, o correo con sus seis
 * cifras, y luego nombre y WhatsApp) y de ahí a la tarjeta. Por eso aquí no se
 * piden nombre ni correo a mano: el boleto viaja con un QR a ese correo y uno
 * mal tecleado deja a alguien en la puerta.
 *
 * Necesita supabase-js y sinc-cuenta.js cargados antes.
 */
window.eventoCompra = (function () {
  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  /* El IVA se desglosa sólo si quien vende lo traslada de verdad: lo dice la
     base en evento_publico.iva. Una persona física sin actividad empresarial no
     es contribuyente de IVA y no puede facturar; enseñarle al comprador un
     «IVA incluido» ahí es mentirle. */
  var IVA = 0.16;
  var puesto = false;

  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function mx(n){ return '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0}); }
  function mx2(n){ return '$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  async function rpc(fn, body){
    var r = await fetch(SB+'/rest/v1/rpc/'+fn, { method:'POST',
      headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' },
      body:JSON.stringify(body||{}) });
    var j=null; try{ j=await r.json(); }catch(_){}
    return { ok:r.ok, status:r.status, data:j };
  }

  function estilos(){
    if (puesto) return; puesto = true;
    var s = document.createElement('style');
    s.textContent =
      '.ecP{font:600 13px/1.3 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--tinta);margin:0 0 9px}'+
      '.ecCant{display:flex;align-items:center;gap:14px}'+
      '.ecCant button{width:42px;height:42px;border:1.5px solid var(--linea);background:#fff;border-radius:10px;font-size:22px;line-height:1;cursor:pointer;color:var(--tinta);padding:0}'+
      '.ecCant button:hover:not(:disabled){border-color:var(--naranja);color:var(--naranja-oscuro)}'+
      '.ecCant button:disabled{opacity:.35;cursor:default}'+
      '.ecCant .n{font:700 26px/1 Oswald,sans-serif;min-width:40px;text-align:center;color:var(--tinta)}'+
      '.ecCant .q{font:400 13px/1.3 Inter,sans-serif;color:var(--gris)}'+
      '.ecT{display:flex;gap:11px;align-items:flex-start;border:1.5px solid var(--linea);border-radius:11px;padding:12px 13px;cursor:pointer;margin-bottom:9px;transition:border-color .12s}'+
      '.ecT:hover{border-color:var(--naranja)}'+
      '.ecT.on{border-color:var(--naranja);box-shadow:0 0 0 3px var(--naranja-suave)}'+
      '.ecT.ago{opacity:.45;cursor:default}'+
      '.ecT input{margin-top:3px;flex:none;width:auto}'+
      '.ecT .nm,.ecU .nm{font:600 14.5px/1.2 Oswald,sans-serif;text-transform:uppercase}'+
      '.ecT .inc,.ecU .inc{font:400 12.5px/1.4 Inter,sans-serif;color:var(--gris);margin-top:3px}'+
      '.ecT .pr,.ecU .pr{margin-left:auto;font:700 18px/1 Oswald,sans-serif;color:var(--naranja-oscuro);white-space:nowrap;padding-left:10px}'+
      '.ecT .cupo{font:400 11px/1.3 Inter,sans-serif;color:var(--gris);margin-top:4px}'+
      '.ecU{display:flex;align-items:flex-start;border:1.5px solid var(--linea);border-radius:11px;padding:12px 13px;background:var(--hueso)}'+
      '.ecSep{border:0;border-top:1px solid var(--linea);margin:16px 0}'+
      '.ecCod{display:flex;gap:8px}'+
      '.ecCod input{text-transform:uppercase}'+
      '.ecBc{flex:none;width:auto;font:600 12px/1 Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;border-radius:9px;border:1.5px solid var(--naranja);background:#fff;color:var(--naranja-oscuro);cursor:pointer}'+
      '.ecCm{font:400 13px/1.4 Inter,sans-serif;margin-top:7px}'+
      '.ecCm.ok{color:var(--ok)} .ecCm.mal{color:var(--error)}'+
      '.ecD .l{display:flex;justify-content:space-between;gap:12px;font:400 14px/1.4 Inter,sans-serif;color:var(--tinta-2);padding:5px 0}'+
      '.ecD .l.imp{color:var(--gris);font-size:12.5px}'+
      '.ecD .l.desc{color:var(--ok)}'+
      '.ecD .l.tot{border-top:1.5px solid var(--linea);margin-top:8px;padding-top:11px;align-items:baseline}'+
      '.ecD .l.tot span:first-child{font:700 15px/1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--tinta)}'+
      '.ecD .l.tot b{font:700 28px/1 Oswald,sans-serif;color:var(--tinta)}'+
      '.ecBt{display:block;width:100%;font:600 14px/1 Oswald,sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:15px;border-radius:10px;border:2px solid var(--naranja);background:var(--naranja);color:#fff;cursor:pointer;margin-top:16px;box-sizing:border-box}'+
      '.ecBt:disabled{opacity:.5;cursor:default}'+
      '.ecPie{font:400 12px/1.5 Inter,sans-serif;color:var(--gris);text-align:center;margin-top:10px}'+
      '.ecMsg{margin-top:12px;font:400 14px/1.5 Inter,sans-serif;border-radius:9px;padding:11px 13px;display:none}'+
      '.ecMsg.mal{display:block;background:var(--error-bg);color:var(--error)}'+
      '.ecMsg.bien{display:block;background:var(--ok-bg);color:var(--ok)}'+
      '.ecCal{border:1px solid var(--linea);border-radius:11px;padding:10px 12px}'+
      '.ecCal .bar{display:flex;align-items:center;gap:8px;margin-bottom:8px}'+
      '.ecCal .bar b{flex:1;text-align:center;font:700 13px/1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.04em}'+
      '.ecCal .bar button{width:30px;height:30px;border-radius:50%;border:1px solid var(--linea);background:#fff;cursor:pointer;font-size:15px;color:var(--tinta);padding:0}'+
      '.ecCal .sem,.ecCal .dd{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}'+
      '.ecCal .sem div{text-align:center;font:400 11px/1.6 Inter,sans-serif;color:var(--gris)}'+
      '.ecCal .dd button{border:1px solid transparent;border-radius:8px;padding:7px 2px;font:600 12.5px/1.2 Oswald,sans-serif;cursor:pointer;background:var(--ok-bg);color:var(--ok)}'+
      '.ecCal .dd button:disabled{background:#F2EFEA;color:var(--tenue);cursor:default;text-decoration:line-through}'+
      '.ecCal .dd button.sel{background:var(--ok);color:#fff;border-color:var(--ok)}'+
      '.ecCal .dd span{display:block}'+
      '.ecHs{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:5px;margin-top:4px}'+
      '.ecHs button{border:1px solid var(--linea);border-radius:8px;padding:8px 2px;font:600 12.5px/1 Oswald,sans-serif;cursor:pointer;background:var(--ok-bg);color:var(--ok)}'+
      '.ecHs button:disabled{background:#F6E1DD;color:#9E3B2E;cursor:default;text-decoration:line-through}'+
      '.ecHs button.on{background:var(--ok);color:#fff;border-color:var(--ok)}'+
      '.ecHs button.entre{background:#D3E8DC;color:#15543A;border-color:#7FB79A}'+
      '.ecLey{font:400 12px/1.6 Inter,sans-serif;color:var(--gris);margin-top:8px}';
    document.head.appendChild(s);
  }

  /* EV: lo que devuelve evento_publico. destino: el nodo donde se pinta. */
  function monta(destino, EV, opts){
    opts = opts || {};
    var caja = (typeof destino === 'string') ? document.getElementById(destino) : destino;
    if (!caja || !EV) return null;
    estilos();
    /* LA SALA POR HORAS. Javi, 10-oct-2026: «todos deben reservar (bien
       seleccionando fecha o directamente con numero de personas) y pasar a
       verificar usuario o alta y luego pagar. No quiero ninguno que requiera
       visto bueno o apartar lugar». El ensayo se vendia con el formulario viejo
       de dejar los datos; ahora el cliente elige dia y horas, el precio sale de
       multiplicar por la tarifa, y de ahi a la cuenta y a la tarjeta. */
    if (Number(EV.precio_por_hora||0) > 0) return porHoras(caja, EV, opts);

    var tiers = (EV.tiers || []);
    if (!tiers.length) return null;
    var LLAVE = 'sinc-compra-' + EV.id;
    var SEL = null, CANT = 1, CODEINFO = null;
    var conIva = (EV.iva !== false);
    var unico = tiers.length === 1;
    function $(i){ return caja.querySelector('#'+i); }
    function disponibles(t){ return (t.cupo==null) ? Infinity : Math.max(0,(t.cupo||0)-(t.vendidos||0)); }

    var elegir = unico
      ? '<div class="ecU"><div><div class="nm">'+esc(tiers[0].nombre||'Boleto')+'</div>'
          +(tiers[0].incluye?'<div class="inc">'+esc(tiers[0].incluye)+'</div>':'')
        +'</div><div class="pr">'+mx(tiers[0].precio)+'</div></div>'
      : tiers.map(function(t,i){
          var disp=disponibles(t), ago=disp<=0;
          return '<label class="ecT'+(ago?' ago':'')+'" data-i="'+i+'">'
            +'<input type="radio" name="ecTier"'+(ago?' disabled':'')+' value="'+i+'">'
            +'<div><div class="nm">'+esc(t.nombre||'Boleto')+'</div>'
              +(t.incluye?'<div class="inc">'+esc(t.incluye)+'</div>':'')
              +(t.cupo!=null?'<div class="cupo">'+(ago?'Agotado':(disp+' disponibles'))+'</div>':'')
            +'</div><div class="pr">'+mx(t.precio)+'</div></label>';
        }).join('');

    caja.innerHTML =
       '<h2>Tu compra</h2>'
      +'<p class="ecP">¿Cuántas personas vienen?</p>'
      +'<div class="ecCant"><button type="button" id="ecMenos">−</button>'
        +'<span class="n" id="ecN">1</span>'
        +'<button type="button" id="ecMas">+</button>'
        +'<span class="q" id="ecQ"></span></div>'
      +'<hr class="ecSep">'
      +'<p class="ecP">'+(unico?'Tu boleto':'¿Qué boleto?')+'</p>'
      + elegir
      +'<hr class="ecSep">'
      +'<label for="ecCod">¿Tienes un código de pago?</label>'
      +'<div class="ecCod"><input type="text" id="ecCod" placeholder="Ej. ATENEO2X1" autocomplete="off">'
        +'<button type="button" class="ecBc" id="ecAplicar">Aplicar</button></div>'
      +'<div class="ecCm" id="ecCm"></div>'
      +'<hr class="ecSep">'
      +'<div class="ecD" id="ecD"></div>'
      +'<button class="ecBt" id="ecPagar">Pagar</button>'
      +'<div class="ecMsg" id="ecMsg"></div>'
      +'<div class="ecPie">Pago seguro con Stripe. El cobro cae en la cuenta del productor.'
        +(conIva?'<br>Precios al público, IVA incluido.':'')+'</div>';

    if (unico) SEL = 0;
    else Array.prototype.forEach.call(caja.querySelectorAll('.ecT input'), function(r){
      r.onchange = function(){
        SEL = +r.value;
        Array.prototype.forEach.call(caja.querySelectorAll('.ecT'), function(e){
          e.classList.toggle('on', +e.getAttribute('data-i')===SEL); });
        if (CANT > disponibles(tiers[SEL])) CANT = Math.max(1, disponibles(tiers[SEL]));
        pintaCant(); recalcula();
      };
    });
    $('ecMenos').onclick = function(){ if(CANT>1){ CANT--; pintaCant(); recalcula(); } };
    $('ecMas').onclick   = function(){ var max = SEL==null?20:disponibles(tiers[SEL]); if(CANT<max){ CANT++; pintaCant(); recalcula(); } };
    $('ecAplicar').onclick = recalcula;
    $('ecCod').onkeydown = function(e){ if(e.key==='Enter'){ e.preventDefault(); recalcula(); } };
    $('ecPagar').onclick = aPagar;

    /* Lo que había elegido antes de salir a Google. */
    try {
      var prev = JSON.parse(sessionStorage.getItem(LLAVE)||'null');
      if (prev) {
        if (!unico && prev.sel!=null && tiers[prev.sel]) {
          SEL = prev.sel;
          var rb = caja.querySelector('.ecT input[value="'+SEL+'"]');
          if (rb) { rb.checked = true; rb.parentNode.classList.add('on'); }
        }
        if (prev.cant>0) CANT = prev.cant;
        if (prev.cod) $('ecCod').value = prev.cod;
      }
    } catch(_){}
    if (opts.codigo && !$('ecCod').value) $('ecCod').value = String(opts.codigo).toUpperCase();

    pintaCant(); recalcula();

    function guarda(){
      try{ sessionStorage.setItem(LLAVE, JSON.stringify({sel:SEL,cant:CANT,cod:($('ecCod')&&$('ecCod').value)||''})); }catch(_){}
    }
    function pintaCant(){
      $('ecN').textContent = CANT;
      var max = SEL==null ? Infinity : disponibles(tiers[SEL]);
      $('ecMenos').disabled = (CANT<=1);
      $('ecMas').disabled   = (CANT>=max);
      $('ecQ').textContent  = (max!==Infinity && max<10) ? ('quedan '+max) : '';
    }
    function msg(t,cls){ var m=$('ecMsg'); m.textContent=t; m.className='ecMsg '+cls; }

    /* El desglose. Nada se inventa aquí: el descuento lo dice la base y el
       total que se cobra lo vuelve a calcular ella al crear la reserva. */
    async function recalcula(){
      var d=$('ecD'), cm=$('ecCm');
      if (SEL==null) { d.innerHTML='<div class="l"><span>Elige un boleto para ver el total</span></div>';
                       $('ecPagar').disabled=true; $('ecPagar').textContent='Pagar'; return; }
      var t = tiers[SEL];
      var sub = (t.precio||0)*CANT, total = sub, etiqueta = null;
      CODEINFO = null;
      var codTxt = (($('ecCod') && $('ecCod').value) || '').trim().toUpperCase();
      if (codTxt) {
        var r = await rpc('evento_codigo_ver', {p_codigo:codTxt, p_precio_id:t.id, p_pax:CANT});
        var info = r.data;
        if (info && info.valido) {
          CODEINFO = {codigo:codTxt, total:Number(info.total)};
          sub = Number(info.subtotal); total = Number(info.total);
          etiqueta = info.etiqueta || 'Código aplicado';
          cm.textContent = etiqueta; cm.className = 'ecCm ok';
        } else {
          cm.textContent = (info && info.mensaje) || 'Ese código no aplica.'; cm.className = 'ecCm mal';
          d.innerHTML = '<div class="l"><span>'+esc(t.nombre||'Boleto')+' × '+CANT+'</span><span>'+mx(sub)+'</span></div>';
          $('ecPagar').disabled = true; $('ecPagar').textContent = 'Pagar';
          return;
        }
      } else { cm.textContent=''; cm.className='ecCm'; }

      var desc = sub - total;
      var iva  = total - (total/(1+IVA));
      d.innerHTML =
         '<div class="l"><span>'+esc(t.nombre||'Boleto')+' × '+CANT+'</span><span>'+mx2(sub)+'</span></div>'
        +(desc>0?'<div class="l desc"><span>Descuento '+esc(etiqueta||'')+'</span><span>−'+mx2(desc)+'</span></div>':'')
        +(conIva?'<div class="l imp"><span>IVA '+Math.round(IVA*100)+'% incluido</span><span>'+mx2(iva)+'</span></div>':'')
        +'<div class="l tot"><span>Total a pagar</span><b>'+mx(total)+'</b></div>';
      $('ecPagar').disabled = false;
      $('ecPagar').textContent = 'Pagar '+mx(total);
      guarda();
    }

    /* La cuenta. Si ya está dentro no se le pregunta nada. */
    async function aPagar(){
      if (SEL==null) return;
      var t = tiers[SEL], b = $('ecPagar'), txt = b.textContent;
      guarda();
      b.disabled = true; b.textContent = 'Un momento…';

      var yo = null;
      try {
        yo = await sincCuenta.exige({
          titulo: 'Entra para pagar',
          dice: 'Tu boleto lleva un QR y te llega por correo: por eso necesitamos saber que el correo es tuyo de verdad. Es una vez y ya.',
          volverA: location.href
        });
      } catch(x){ console.error('cuenta', x); }
      if (!yo) { b.disabled=false; b.textContent=txt; return; }

      msg('Apartando tu lugar…','bien');
      var r = await rpc('evento_reserva_crear', {
        p_evento_id: EV.id, p_precio_id: t.id, p_pax: CANT,
        p_nombre: (yo.nombre||'').trim(), p_email: (yo.email||'').trim(),
        p_telefono: (yo.telefono||'').trim(),
        p_codigo: (CODEINFO && CODEINFO.codigo) || ''
      });
      if (!r.ok || !r.data || r.data.error) {
        msg((r.data && r.data.error) || 'No se pudo apartar tu lugar. Intenta de nuevo.','mal');
        b.disabled=false; b.textContent=txt; return;
      }
      try{ sessionStorage.removeItem(LLAVE); }catch(_){}
      /* Entrada libre es una reserva de $0: no hay pasarela que abrir, el
         boleto con su QR ya existe. Javi: «mismo procedimiento». */
      if (r.data.sin_cobro) { location.href = 'evento-boleto.html?f='+encodeURIComponent(r.data.folio); return; }
      /* El lugar queda apartado 1 hora. El cobro cae en el Stripe del productor
         con la comisión del Ateneo, y la confirmación de verdad la da el
         webhook, no el ?pago de la URL. */
      location.href = 'evento-pago.html?res='+encodeURIComponent(r.data.folio);
    }

    return { recalcula: recalcula };
  }

  /* ---------- LA SALA POR HORAS ----------
     El cliente elige el dia en un mes y luego la hora de inicio y la de fin en
     una rejilla. Verde es que hay lugar; lo que ya esta apartado sale tachado y
     no se puede elegir. El total es horas x tarifa, y la base lo vuelve a
     calcular al crear la reserva: aqui solo se enseña. */
  function porHoras(caja, EV, opts){
    var TARIFA = Number(EV.precio_por_hora||0);
    var MIN    = Number(EV.min_horas||1);
    var H1     = hhmm(EV.hora_desde||'07:00');
    var H2     = hhmm(EV.hora_hasta||'23:00');
    var DIAS   = EV.dias_semana || null;      // 1 = lunes
    var V1     = String(EV.vigencia_desde||'').slice(0,10) || hoyYmd();
    var V2     = String(EV.vigencia_hasta||'').slice(0,10) || '';
    var OCU    = EV.ocupado || [];
    var conIva = (EV.iva !== false);
    var MES = new Date(); MES.setDate(1);
    var DIA = '', A = null, B = null;   // A y B en minutos
    function $(i){ return caja.querySelector('#'+i); }

    caja.innerHTML =
       '<h2>Aparta el espacio</h2>'
      +'<p class="ecP">¿Qué día lo necesitas?</p>'
      +'<div id="ecCalD"></div>'
      +'<hr class="ecSep">'
      +'<p class="ecP">¿De qué hora a qué hora?</p>'
      +'<div id="ecHoras"></div>'
      +'<hr class="ecSep">'
      +'<div class="ecD" id="ecD"></div>'
      +'<button class="ecBt" id="ecPagar" disabled>Pagar</button>'
      +'<div class="ecMsg" id="ecMsg"></div>'
      +'<div class="ecPie">Pago seguro con Stripe. El cobro cae en la cuenta del productor.'
        +(conIva?'<br>Precios al público, IVA incluido.':'')+'</div>';

    pintaMes(); pintaHoras(); recalcula();
    $('ecPagar').onclick = aPagar;

    function hhmm(t){ var m=String(t).match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1])*60 + (+m[2]) : 0; }
    function dosp(n){ return (n<10?'0':'')+n; }
    function txt(min){ return dosp(Math.floor(min/60))+':'+dosp(min%60); }
    function hoyYmd(){ var d=new Date(); return d.getFullYear()+'-'+dosp(d.getMonth()+1)+'-'+dosp(d.getDate()); }
    function ymd(d){ return d.getFullYear()+'-'+dosp(d.getMonth()+1)+'-'+dosp(d.getDate()); }
    function ocupadoDe(dia){
      return OCU.filter(function(o){ return String(o.dia).slice(0,10)===dia; })
                .map(function(o){ return {a:hhmm(o.desde), b:hhmm(o.hasta)}; });
    }
    function libreDia(dia){
      var l = ocupadoDe(dia), cubre = 0, i;
      for(i=H1;i<H2;i+=60){ if(!l.some(function(o){ return i<o.b && i+60>o.a; })) cubre++; }
      return cubre >= Math.ceil(MIN);
    }
    function vale(dia){
      if (dia < V1) return false;
      if (V2 && dia > V2) return false;
      if (DIAS && DIAS.length) {
        var p = dia.split('-'), d = new Date(+p[0], +p[1]-1, +p[2]);
        var dow = ((d.getDay()+6)%7)+1;            // 1 = lunes
        if (DIAS.indexOf(dow) < 0) return false;
      }
      return libreDia(dia);
    }

    function pintaMes(){
      var y=MES.getFullYear(), m=MES.getMonth();
      var prim=new Date(y,m,1), ult=new Date(y,m+1,0);
      var nom=prim.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
      var h='<div class="ecCal"><div class="bar">'
        +'<button type="button" id="ecPrev">‹</button><b>'+esc(nom)+'</b>'
        +'<button type="button" id="ecNext">›</button></div>'
        +'<div class="sem">'+['L','M','X','J','V','S','D'].map(function(d){return '<div>'+d+'</div>';}).join('')+'</div>'
        +'<div class="dd">';
      var hueco=(prim.getDay()+6)%7, i;
      for(i=0;i<hueco;i++) h+='<span></span>';
      for(i=1;i<=ult.getDate();i++){
        var f=ymd(new Date(y,m,i)), ok=vale(f);
        h+='<button type="button" '+(ok?'data-d="'+f+'"':'disabled')
          +' class="'+(f===DIA?'sel':'')+'">'+i+'</button>';
      }
      h+='</div><div class="ecLey">Verde: hay lugar. Tachado: ya está apartado o no se renta.</div></div>';
      $('ecCalD').innerHTML=h;
      $('ecPrev').onclick=function(){ MES=new Date(MES.getFullYear(),MES.getMonth()-1,1); pintaMes(); };
      $('ecNext').onclick=function(){ MES=new Date(MES.getFullYear(),MES.getMonth()+1,1); pintaMes(); };
      Array.prototype.forEach.call(caja.querySelectorAll('[data-d]'),function(b){
        b.onclick=function(){ DIA=b.getAttribute('data-d'); A=null; B=null; pintaMes(); pintaHoras(); recalcula(); };
      });
    }

    function pintaHoras(){
      var c=$('ecHoras');
      if(!DIA){ c.innerHTML='<div style="color:var(--gris);font-size:13.5px">Elige primero el día.</div>'; return; }
      var l=ocupadoDe(DIA), h='<div class="ecHs">', i;
      for(i=H1;i<H2;i+=60){
        var tom=l.some(function(o){ return i<o.b && i+60>o.a; });
        var cls = (A!=null && i===A) ? 'on' : ((A!=null && B!=null && i>A && i<B) ? 'entre' : '');
        h+='<button type="button" '+(tom?'disabled':'data-h="'+i+'"')+' class="'+cls+'">'+txt(i)+'</button>';
      }
      h+='</div><div class="ecLey">'
        +(A==null?'Toca la hora en que empiezas.':(B==null?'Ahora la hora en que terminas.':'De '+txt(A)+' a '+txt(B)+' · <button type="button" id="ecOtra" style="border:0;background:0;color:var(--ok);text-decoration:underline;cursor:pointer;padding:0;font:inherit">cambiar</button>'))
        +(MIN>1?' · mínimo '+MIN+' h':'')+'</div>';
      c.innerHTML=h;
      if($('ecOtra')) $('ecOtra').onclick=function(){ A=null; B=null; pintaHoras(); recalcula(); };
      Array.prototype.forEach.call(c.querySelectorAll('[data-h]'),function(b){
        b.onclick=function(){
          var v=Number(b.getAttribute('data-h'));
          if(A==null || B!=null){ A=v; B=null; }
          else if(v<=A){ A=v; B=null; }
          else {
            /* Que no se cuele nada ocupado entre el inicio y el fin. */
            var l2=ocupadoDe(DIA), choca=l2.some(function(o){ return A<o.b && (v+60)>o.a; });
            if(choca){ msg('Entre esas dos horas hay algo ya apartado. Elige otro tramo.','mal'); return; }
            B=v+60; msg('','');
          }
          pintaHoras(); recalcula();
        };
      });
    }

    function msg(t,cls){ var m=$('ecMsg'); if(!m) return; m.textContent=t; m.className='ecMsg '+(t?cls:''); }

    function recalcula(){
      var d=$('ecD');
      if(!DIA || A==null || B==null){
        d.innerHTML='<div class="l"><span>Elige el día y las horas para ver el total</span></div>';
        $('ecPagar').disabled=true; $('ecPagar').textContent='Pagar'; return;
      }
      var horas=(B-A)/60;
      if(horas<MIN){
        d.innerHTML='<div class="l"><span>El mínimo son '+MIN+' h</span></div>';
        $('ecPagar').disabled=true; $('ecPagar').textContent='Pagar'; return;
      }
      var total=TARIFA*horas, iva=total-(total/(1+IVA));
      d.innerHTML=
         '<div class="l"><span>'+horas+' h × '+mx(TARIFA)+' la hora</span><span>'+mx2(total)+'</span></div>'
        +'<div class="l imp"><span>'+esc(DIA)+' · '+txt(A)+'–'+txt(B)+'</span><span></span></div>'
        +(conIva?'<div class="l imp"><span>IVA '+Math.round(IVA*100)+'% incluido</span><span>'+mx2(iva)+'</span></div>':'')
        +'<div class="l tot"><span>Total a pagar</span><b>'+mx(total)+'</b></div>';
      $('ecPagar').disabled=false;
      $('ecPagar').textContent='Pagar '+mx(total);
    }

    async function aPagar(){
      if(!DIA || A==null || B==null) return;
      var b=$('ecPagar'), txtb=b.textContent;
      b.disabled=true; b.textContent='Un momento…';
      var yo=null;
      try{
        yo=await sincCuenta.exige({
          titulo:'Entra para pagar',
          dice:'Te mandamos la confirmación por correo: por eso necesitamos saber que el correo es tuyo de verdad. Es una vez y ya.',
          volverA:location.href });
      }catch(x){ console.error('cuenta',x); }
      if(!yo){ b.disabled=false; b.textContent=txtb; return; }

      msg('Apartando el espacio…','bien');
      var r=await rpc('evento_reserva_horas_crear',{
        p_evento_id:EV.id, p_dia:DIA, p_desde:txt(A)+':00', p_hasta:txt(B)+':00',
        p_nombre:(yo.nombre||'').trim(), p_email:(yo.email||'').trim(),
        p_telefono:(yo.telefono||'').trim() });
      if(!r.ok||!r.data||r.data.error){
        msg((r.data&&r.data.error)||'No se pudo apartar. Intenta de nuevo.','mal');
        b.disabled=false; b.textContent=txtb; return;
      }
      location.href='evento-pago.html?res='+encodeURIComponent(r.data.folio);
    }

    return { recalcula: recalcula };
  }

  return { monta: monta, rpc: rpc };
})();
