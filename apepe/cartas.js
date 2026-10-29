/* LAS CARTAS DEL HUÉSPED, EN UN SOLO SITIO.
   Javi, 29-oct-2026: «pasa a debajo de Tus pedidos el bloque de "tus cartas",
   donde aparece la margarita de cortesía y los premios». Vivían dentro de la
   billetera, que es la pantalla del saldo; pero una carta no es un saldo: es
   un papel que te dieron y que vas a enseñar en la terraza, y eso se busca
   donde está lo tuyo —la reserva, los boletos, los pedidos—. Al mudarlas, el
   dibujo y el QR se salieron de vnums.html y vinieron aquí, para que la
   pantalla que las enseñe sea una decisión de la pantalla y no una copia del
   código.

   Se usa así, con el token de la reserva:
     apepeCartas.monta('baraja', {token:RESV});
   y se puede repintar en otro idioma con el mismo id.

   El QR se dibuja sólo al voltear la carta: pintar veinte canvas que nadie ha
   mirado es trabajo tirado en un teléfono. Necesita qrcodejs cargado antes; si
   no está, la carta cae al código escrito, que el equipo de terraza también
   sabe cobrar. */
(function(){
'use strict';

var TX={
  es:{ vacio:'Aquí van a aparecer tus cartas. La primera te la damos en recepción, cuando llegues a la casa.',
       sinToken:'Ábrelo desde la liga de tu reserva, que es como sabemos quién eres.',
       tocar:'Tócala para ver el QR', usada:'Usada', caducada:'Caducó',
       enseña:'Enséñalo en la terraza', enseñaSinc:'Enséñalo al reservar',
       cobrada:'Cobrada el',
       gano:{checkin:'Por tu check-in', quiz:'Por ganar el PepeQuiz',
             viernes:'Regalo del viernes', mano:'De parte de la casa'},
       persona:'Persona',
       sinQR:'Enséñale el código de abajo a quien esté en la terraza.',
       pie:'El QR sólo vive aquí, en la app: por eso no se puede copiar ni cobrar dos veces. '+
           'Quien lo cobra es el equipo de terraza, desde su propio celular.' },
  en:{ vacio:'Your cards will show up here. The first one arrives when you check in.',
       sinToken:'Open this from your reservation link so we know who you are.',
       tocar:'Tap it to see the QR', usada:'Used', caducada:'Expired',
       enseña:'Show it at the terrace', enseñaSinc:'Show it when you book',
       cobrada:'Redeemed on',
       gano:{checkin:'For checking in', quiz:'For winning the PepeQuiz',
             viernes:'Friday gift', mano:'On the house'},
       persona:'Guest',
       sinQR:'Show the code below to the terrace team.',
       pie:'The QR only lives here, in the app — that is why it cannot be copied or redeemed '+
           'twice. The terrace team redeems it from their own phone.' }
};

var SB='https://rehophywchakfapivsbh.supabase.co';
var KEY='sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

function idioma(){
  var l=(document.documentElement.getAttribute('lang')||'').slice(0,2).toLowerCase();
  if(l==='en'||l==='es') return l;
  try{ var g=localStorage.getItem('apepe_lang'); if(g==='es'||g==='en') return g; }catch(_){}
  return /^en/i.test(navigator.language||'')?'en':'es';
}

function fecha(f){
  if(!f) return '';
  try{
    return new Date(f).toLocaleDateString(idioma()==='en'?'en-GB':'es-MX',
      {day:'numeric', month:'short'});
  }catch(_){ return String(f).slice(0,10); }
}

var puesto=false;
function estilo(){
  if(puesto) return; puesto=true;
  var c=document.createElement('style');
  c.textContent=
  /* Como las de la lotería: por delante el dibujo, se tocan y por detrás está
     el QR. Las cobradas se quedan en gris y ya no giran. */
  '.baraja{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}'+
  '.carta{perspective:1100px;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
  '.carta .gira{position:relative;width:100%;aspect-ratio:3/4.1;'+
    'transition:transform .55s cubic-bezier(.4,.1,.2,1);transform-style:preserve-3d}'+
  '.carta.vuelta .gira{transform:rotateY(180deg)}'+
  '.carta .cara{position:absolute;inset:0;backface-visibility:hidden;'+
    '-webkit-backface-visibility:hidden;border-radius:var(--radio,14px);'+
    'background:var(--blanco,#fff);border:1px solid var(--linea,#E7DECF);'+
    'box-shadow:var(--sombra,0 2px 10px rgba(30,26,22,.08));overflow:hidden;'+
    'display:flex;flex-direction:column}'+
  '.carta .cara.atras{transform:rotateY(180deg);align-items:center;justify-content:center;'+
    'padding:12px;gap:8px}'+
  '.carta .marco{height:5px;flex:none}'+
  '.carta .dib{flex:1;display:flex;align-items:center;justify-content:center;'+
    'padding:12px 10px 0;min-height:0}'+
  '.carta .dib img{max-width:100%;max-height:100%;object-fit:contain}'+
  '.carta .cara .pie{padding:8px 11px 12px;text-align:center;margin:0}'+
  '.carta .cara .pie b{display:block;font-family:"Oswald",sans-serif;text-transform:uppercase;'+
    'letter-spacing:.04em;font-size:12.5px;line-height:1.2}'+
  '.carta .cara .pie span{display:block;font-size:10.5px;color:var(--tenue,#9A8C78);margin-top:3px}'+
  '.carta .qr{width:100%;max-width:148px;aspect-ratio:1;background:#fff;display:flex;'+
    'align-items:center;justify-content:center;overflow:hidden}'+
  '.carta .qr canvas,.carta .qr img{width:100%!important;height:100%!important;display:block}'+
  '.carta .qr.falla{font-size:10.5px;color:var(--tenue,#9A8C78);text-align:center;'+
    'padding:8px;line-height:1.4}'+
  '.carta .cod{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;'+
    'font-size:13px;letter-spacing:.14em}'+
  '.carta .dato{font-size:10.5px;color:var(--tenue,#9A8C78);text-align:center;line-height:1.4}'+
  '.carta.usada .cara{filter:grayscale(1);opacity:.55}'+
  '.carta.usada{cursor:default}'+
  '.carta .sello{position:absolute;top:10px;left:50%;transform:translateX(-50%) rotate(-7deg);'+
    'font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:11px;'+
    'border:2px solid var(--gris,#6E665C);color:var(--gris,#6E665C);border-radius:6px;'+
    'padding:2px 8px;background:rgba(255,255,255,.85);z-index:2}'+
  '.cartasvacio{border:1px dashed var(--linea,#E7DECF);border-radius:var(--radio,14px);'+
    'padding:22px 18px;text-align:center;color:var(--tenue,#9A8C78);font-size:13.5px;line-height:1.6}'+
  '.cartaspie{font-size:11.5px;color:var(--tenue,#9A8C78);line-height:1.5;margin:14px 0 0}';
  document.head.appendChild(c);
}

function dibujaQR(el, codigo, t){
  if(el.getAttribute('data-listo')==='1') return;
  el.setAttribute('data-listo','1');
  try{
    if(typeof QRCode==='undefined') throw new Error('sin lector');
    new QRCode(el, { text:codigo, width:296, height:296,
      colorDark:'#1E1A16', colorLight:'#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M });
  }catch(_){
    el.classList.add('falla');
    el.textContent=t.sinQR;
  }
}

var abiertas={};

function pinta(caja, cartas){
  var t=TX[idioma()]||TX.es;
  if(!cartas.length){
    caja.className='';
    caja.innerHTML='<div class="cartasvacio">'+esc(t.vacio)+'</div>';
    return;
  }
  caja.className='baraja';
  caja.innerHTML=cartas.map(function(c){
    var viva=c.estado==='activa';
    var en=idioma()==='en';
    var titulo=en?(c.premio_en||c.premio):c.premio;
    var sello=c.estado==='usada'?t.usada:(c.estado==='caducada'?t.caducada:'');
    var comoGano=t.gano[c.origen]||t.gano.mano;
    var donde=c.donde==='terraza'?t.enseña:t.enseñaSinc;
    return '<div class="carta'+(viva?'':' usada')+(abiertas[c.codigo]?' vuelta':'')+
             '" data-c="'+esc(c.codigo)+'"'+(viva?' tabindex="0" role="button"':'')+'>'+
      (sello?'<span class="sello">'+esc(sello)+'</span>':'')+
      '<div class="gira">'+
        '<div class="cara">'+
          '<div class="marco" style="background:'+esc(c.color||'#F2682A')+'"></div>'+
          '<div class="dib">'+(c.sticker?'<img src="'+esc(c.sticker)+'" alt="" '+
            'onerror="this.style.display=\'none\'">':'')+'</div>'+
          '<div class="pie"><b>'+esc(titulo)+'</b><span>'+
            esc(viva?t.tocar:(c.usada_at?t.cobrada+' '+fecha(c.usada_at):sello))+
          '</span></div>'+
        '</div>'+
        '<div class="cara atras">'+
          (viva
            ? '<div class="qr" data-qr="'+esc(c.codigo)+'"></div>'+
              '<div class="cod">'+esc(c.codigo)+'</div>'+
              '<div class="dato">'+esc(donde)+'<br>'+esc(comoGano)+
              (c.persona>1?'<br>'+esc(t.persona)+' '+c.persona:'')+'</div>'
            : '<div class="dato" style="font-size:12px">'+esc(sello)+
              (c.usada_at?'<br>'+esc(t.cobrada)+' '+fecha(c.usada_at):'')+'</div>')+
        '</div>'+
      '</div></div>';
  }).join('');

  Array.prototype.forEach.call(caja.querySelectorAll('.carta:not(.usada)'),function(el){
    function voltea(){
      var cod=el.getAttribute('data-c');
      el.classList.toggle('vuelta');
      abiertas[cod]=el.classList.contains('vuelta');
      var cv=el.querySelector('[data-qr]');
      if(cv && el.classList.contains('vuelta')) dibujaQR(cv, cod, t);
    }
    el.onclick=voltea;
    el.onkeydown=function(ev){ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();voltea();} };
  });
}

var CACHE=null;

async function monta(id, o){
  o=o||{};
  var caja=document.getElementById(id); if(!caja) return {cartas:0};
  estilo();
  var t=TX[idioma()]||TX.es;
  var pie=o.pie?document.getElementById(o.pie):null;
  if(pie) pie.textContent=t.pie;

  var tok=o.token||'';
  if(!tok){
    caja.className='';
    caja.innerHTML='<div class="cartasvacio">'+esc(t.sinToken)+'</div>';
    return {cartas:0};
  }
  /* Repintar por cambio de idioma no vuelve a pedir nada: las cartas son las
     mismas, sólo cambia cómo se leen. */
  if(CACHE===null || o.recarga){
    try{
      var r=await fetch(SB+'/rest/v1/rpc/vnum_mis_cartas',{method:'POST',
        headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_token:tok})});
      CACHE=r.ok?(await r.json()||[]):[];
    }catch(x){
      caja.className='';
      caja.innerHTML='<div class="cartasvacio">'+esc(String((x&&x.message)||x))+'</div>';
      return {cartas:0};
    }
  }
  pinta(caja, CACHE);
  return {cartas:CACHE.length};
}

window.apepeCartas={ monta:monta };
})();
