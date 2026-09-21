/* cp-acceso.js — Filtro de UBICACIÓN (cascada por árbol) para el Grupo Casa Pepe.
   Inclúyelo en TODA página que muestre datos por propiedad:
     <script src="/cp-acceso.js"></script>
   API (window.cpAcceso):
     await cpAcceso.ubicaciones()          -> array de proyectos permitidos, o null = no filtrar (fail-open)
     await cpAcceso.permite('cdmx')        -> boolean
     await cpAcceso.filtra(lista, x=>x.sede) -> lista filtrada por ubicación
     await cpAcceso.scopeSelect('#sel')    -> poda opciones de un <select> de propiedad
     cpAcceso.toProy('CDMX')               -> 'cdmx'
   Reglas: Dirección ve todo (el server devuelve las 5). Si no hay sesión o el array
   viene vacío, NO filtra (fail-open) para no romper la página. */
(function(){
  var SB='https://rehophywchakfapivsbh.supabase.co';
  var KEY='sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  /* Portero: un touroperador no tiene nada que hacer en el panel del Grupo.
     Si el correo de la sesión está dado de alta como usuario de un touroperador,
     lo mandamos a su portal de Sincrético y esta página no se pinta. */
  (function portero(){
    try{
      var tk=null;
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&/sb-.*-auth-token/.test(k)){
          var v=JSON.parse(localStorage.getItem(k)||'null');
          var ss=v&&(v.currentSession||v);
          if(ss&&ss.access_token){tk=ss.access_token;break;}
        }
      }
      if(!tk)return;
      if(/\/operador\.html/.test(location.pathname))return;
      fetch(SB+'/rest/v1/rpc/es_operador_externo',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:'{}'})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(x){ if(x===true) location.replace('/operador.html'); })
      .catch(function(){});
    }catch(_){}
  })();

  function tokEmail(){ try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&/sb-.*-auth-token/.test(k)){ var v=JSON.parse(localStorage.getItem(k)||'null'); var s=v&&(v.currentSession||v); var e=s&&s.user&&s.user.email; if(e) return String(e).toLowerCase(); } } }catch(_){} return ''; }
  function toProy(s){ s=(s||'').toString().toLowerCase().trim();
    if(s.indexOf('cdmx')>=0||s.indexOf('mexico')>=0||s.indexOf('méxico')>=0||s==='mex'||s==='df') return 'cdmx';
    if(s.indexOf('puebla')>=0||s==='pue') return 'puebla';
    if(s.indexOf('virrey')>=0||s.indexOf('ateneo')>=0||s==='vir') return 'virreyes';
    if(s.indexOf('sincr')>=0) return 'sincretico';
    if(s.indexOf('corp')>=0) return 'corp';
    return (['cdmx','puebla','virreyes','sincretico','corp'].indexOf(s)>=0)?s:'';
  }
  var _cache=undefined;
  async function ubicaciones(){
    if(_cache!==undefined) return _cache;
    var em=tokEmail(); if(!em){ _cache=null; return null; }
    try{
      var r=await fetch(SB+'/rest/v1/rpc/mis_ubicaciones',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({p_email:em})});
      if(!r.ok){ _cache=null; return null; }
      var a=await r.json();
      _cache=(Array.isArray(a)&&a.length)?a:null;
      return _cache;
    }catch(_){ _cache=null; return null; }
  }
  var _dir=undefined;
  async function esDireccion(){
    if(_dir!==undefined) return _dir;
    var em=tokEmail(); if(!em){ _dir=false; return false; }
    try{ var r=await fetch(SB+'/rest/v1/rpc/puede_ver_corp',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:'{}'}); if(!r.ok){_dir=false;return false;} var a=await r.json(); _dir=(a===true); return _dir; }catch(_){ _dir=false; return false; }
  }
  async function permite(proy){ var u=await ubicaciones(); if(!u) return true; return u.indexOf(toProy(proy))>=0; }
  async function filtra(list,getSede){ var u=await ubicaciones(); if(!u||!Array.isArray(list)) return list; var dir=await esDireccion(); getSede=getSede||function(x){return x&&(x.sede||x.proyecto||x.propiedad);}; return list.filter(function(x){ var p=toProy(getSede(x)); if(!p) return true; if(p==='corp' && !dir) return false; return u.indexOf(p)>=0; }); }
  async function scopeSelect(sel){ if(typeof sel==='string') sel=document.querySelector(sel); if(!sel) return; var u=await ubicaciones(); if(!u) return; Array.prototype.slice.call(sel.options).forEach(function(o){ var p=toProy(o.getAttribute('data-proy'))||toProy(o.value)||toProy(o.textContent); if(p&&u.indexOf(p)<0) o.remove(); }); if(sel.selectedIndex<0&&sel.options.length) sel.selectedIndex=0; try{ sel.dispatchEvent(new Event('change')); }catch(_){} }
  // Auto-init: cualquier <select data-cp-ubic> se poda solo al cargar
  function auto(){ document.querySelectorAll('select[data-cp-ubic]').forEach(function(s){ scopeSelect(s); }); }
  if(document.readyState!=='loading') auto(); else document.addEventListener('DOMContentLoaded',auto);
  /* Pantalla de "entra primero". Una pantalla de /m/ abierta directa —un enlace
     guardado, el teléfono— no tiene sesión, la base contesta vacío y se queda
     con ceros o con un "no se pudo cargar" que parece un error nuestro. Esto lo
     dice claro y devuelve al panel, que al entrar te trae de vuelta aquí.
     Es opt-in: la página llama cpAcceso.exige() si de verdad necesita sesión. */
  function sinSesion(){
    if(document.getElementById('cp-sin-sesion')) return;
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',sinSesion); return;
    }
    /* Va como capa encima, no reemplazando el documento: así no importa si la
       página termina de pintarse después; el aviso sigue mandando. */
    var vuelta=encodeURIComponent(location.pathname+location.search);
    var d=document.createElement('div');
    d.id='cp-sin-sesion';
    d.setAttribute('style','position:fixed;inset:0;z-index:2147483647;background:#FBF7F2;'+
      'color:#1E1A16;font-family:Inter,system-ui,-apple-system,sans-serif;'+
      'display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto');
    d.innerHTML=
      '<div style="max-width:470px;text-align:center">'+
      '<div style="font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:21px;'+
      'text-transform:uppercase;letter-spacing:.04em">Entra primero al panel</div>'+
      '<p style="color:#6E665C;font-size:14px;line-height:1.6;margin:12px 0 22px">'+
      'Esta pantalla lee los datos con tu sesión, y en este navegador no hay ninguna '+
      'abierta. Pasa al abrir el enlace directo desde el teléfono o desde un favorito. '+
      'Entra al panel y te devolvemos aquí.</p>'+
      '<a href="/index.html?volver='+vuelta+'" style="display:inline-block;'+
      'font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:13px;text-transform:uppercase;'+
      'letter-spacing:.05em;padding:12px 22px;border-radius:9px;background:#F2682A;'+
      'color:#fff;text-decoration:none">Ir al panel</a></div>';
    document.body.appendChild(d);
  }
  /* true = hay sesión y la página puede seguir. false = ya se pintó el aviso. */
  function exige(){
    if(tokEmail()) return true;
    /* Dentro del panel la página va en un iframe y la sesión la tiene el padre:
       ahí no hay nada que avisar. */
    if(window.top!==window.self) return true;
    sinSesion(); return false;
  }

  window.cpAcceso={ubicaciones:ubicaciones,permite:permite,filtra:filtra,scopeSelect:scopeSelect,toProy:toProy,tokEmail:tokEmail,esDireccion:esDireccion,exige:exige,sinSesion:sinSesion};
})();
