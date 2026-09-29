/* APePe se acordaba de quién eres sólo mientras la liga estuviera en la barra
   de direcciones.
   El huésped recibe su liga una vez —por correo o por WhatsApp—, entra, y a
   partir de ahí navega: toca «Welcome», vuelve al inicio, instala la app en su
   teléfono. En cualquiera de esos pasos el `?resv=` se pierde, y con él la
   identidad: ¿Upgrade?, el check-in, «Yo» y los Vnums dejaban de funcionar.
   El botón de upgrade no estaba roto — es que la app ya no sabía de quién era.

   Esto lo arregla en un sitio y para todas las pantallas: la primera vez que
   la liga trae el token se guarda, y a partir de ahí se repone en la URL antes
   de que corra el código de la pantalla. Así cada pantalla lo sigue leyendo
   donde siempre lo ha leído y no hay que tocar ninguna.

   Se carga en el <head>, síncrono y antes que nada: si corriera después, el
   código de la pantalla ya habría mirado una URL sin token.
   Javi, 28-sep. */
(function () {
  'use strict';
  var CLAVES = { resv: 'apepe_resv', sol: 'apepe_sol' };

  /* Sólo un uuid. Si alguien pega cualquier cosa en la barra, no se guarda:
     un token inventado no abre nada y ensuciaría el teléfono para siempre. */
  function bueno(v) {
    v = String(v == null ? '' : v).trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : '';
  }
  function lee(k) { try { return bueno(localStorage.getItem(k)); } catch (_) { return ''; } }
  function guarda(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  var p, cambio = false, vals = {};
  try { p = new URLSearchParams(location.search); } catch (_) { p = null; }

  Object.keys(CLAVES).forEach(function (nom) {
    var k = CLAVES[nom];
    var deLaUrl = p ? bueno(p.get(nom)) : '';
    if (deLaUrl) {
      /* Liga nueva en el aparato: lo que supiéramos de la anterior -su fecha de
         salida- no vale para ésta. */
      if (deLaUrl !== lee(k)) {
        ['apepe_resv_hasta','apepe_resv_visto'].forEach(function(x){
          try { localStorage.removeItem(x); } catch (_) {} });
      }
      guarda(k, deLaUrl); vals[nom] = deLaUrl; return;
    }
    var guardado = lee(k);
    if (guardado && p) { p.set(nom, guardado); cambio = true; }
    vals[nom] = guardado;
  });

  /* Reponerlo en la URL —sin recargar— es lo que hace que las pantallas que ya
     existen funcionen sin cambiarles una línea. */
  if (cambio) {
    try {
      var q = p.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    } catch (_) {}
  }

  /* La ciudad del huésped (CDMX / Puebla). Llega una vez por la liga
     (?ciudad= / ?sede=) y se recuerda en el aparato, para que la app entera
     —mapa, PepeGO, Experiencias— la respete sin arrastrarla en cada enlace.
     Es el primer paso de "la ciudad sale de la reserva". */
  var sede = '';
  try {
    var _s = (p && (p.get('ciudad') || p.get('sede'))) || '';
    _s = String(_s).trim().toLowerCase();
    if (_s) { sede = /pue|chol|atlix|tlax/.test(_s) ? 'puebla' : 'cdmx';
              localStorage.setItem('apepe_sede', sede); }
    else { sede = localStorage.getItem('apepe_sede') || ''; }
  } catch (_) {}

  /* CUÁNDO SE OLVIDA.
     Guardar el token para siempre tiene su precio: en un aparato compartido -el
     de recepción, el de la sala- el siguiente que entra sin su propia liga
     hereda la reserva del anterior, con sus fechas y sus papeles. Así que la
     liga guardada se olvida sola dos días después del checkout.
     La que viene escrita en la URL no se toca nunca: si alguien la abre, la
     abre a propósito.
     La fecha de salida se pregunta una vez al día y se apunta, para que los
     demás arranques lo resuelvan sin red. */
  var GRACIA_DIAS = 2;
  var SB_FN = 'https://rehophywchakfapivsbh.supabase.co/functions/v1/apepe-reserva';
  var KEY   = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  function hoyISO(){ try{ return new Date().toISOString().slice(0,10); }catch(_){ return ''; } }
  function pasado(hasta){
    try{
      var f = Date.parse(String(hasta)+'T23:59:59Z');
      return !!f && (Date.now() - f) > GRACIA_DIAS*86400000;
    }catch(_){ return false; }
  }
  function olvidaTodo(){
    Object.keys(CLAVES).forEach(function(n){ try{ localStorage.removeItem(CLAVES[n]); }catch(_){} });
    ['apepe_resv_hasta','apepe_resv_visto','apepe_modo','sinc_resv_sesion']
      .forEach(function(k){ try{ localStorage.removeItem(k); }catch(_){} });
    vals = {};
  }
  function revisaCaducidad(){
    if (!vals.resv) return;
    /* Olvidar sólo se olvida la liga HEREDADA del aparato (cambio === la
       repusimos nosotros). La que el huésped trae escrita en la URL se respeta
       siempre; de ella sólo apuntamos la fecha, para los arranques de después. */
    var hasta=''; try{ hasta = localStorage.getItem('apepe_resv_hasta')||''; }catch(_){}
    if (cambio && hasta && pasado(hasta)) {
      olvidaTodo();
      try{ var u=new URL(location.href); u.searchParams.delete('resv');
           history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); }catch(_){}
      return;
    }
    var visto=''; try{ visto = localStorage.getItem('apepe_resv_visto')||''; }catch(_){}
    if (hasta && visto === hoyISO()) return;   /* ya se preguntó hoy */
    try{ localStorage.setItem('apepe_resv_visto', hoyISO()); }catch(_){}
    var tok = vals.resv;
    fetch(SB_FN, { method:'POST',
      headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' },
      body: JSON.stringify({ resv: tok }) })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var h = j && j.ok && j.reserva ? j.reserva.hasta : '';
        if (!h) return;
        try{ localStorage.setItem('apepe_resv_hasta', h); }catch(_){}
        if (cambio && pasado(h)) { olvidaTodo(); }
      })
      .catch(function(){});
  }
  try{ revisaCaducidad(); }catch(_){}

  window.apepeResv = {
    token: function () { return vals.resv || ''; },
    sol: function () { return vals.sol || ''; },
    sede: function () { return sede || ''; },
    /* Lo que hay que pegarle a una liga interna para no perder la identidad. */
    qs: function () {
      if (vals.resv) return '?resv=' + encodeURIComponent(vals.resv);
      if (vals.sol) return '?sol=' + encodeURIComponent(vals.sol);
      return '';
    },
    /* Para cuando el huésped se va: el siguiente que agarre el teléfono no
       hereda su reserva. */
    olvida: olvidaTodo
  };
})();
