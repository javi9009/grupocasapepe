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
  async function permite(proy){ var u=await ubicaciones(); if(!u) return true; return u.indexOf(toProy(proy))>=0; }
  async function filtra(list,getSede){ var u=await ubicaciones(); if(!u||!Array.isArray(list)) return list; getSede=getSede||function(x){return x&&(x.sede||x.proyecto||x.propiedad);}; return list.filter(function(x){ var p=toProy(getSede(x)); return !p||u.indexOf(p)>=0; }); }
  async function scopeSelect(sel){ if(typeof sel==='string') sel=document.querySelector(sel); if(!sel) return; var u=await ubicaciones(); if(!u) return; Array.prototype.slice.call(sel.options).forEach(function(o){ var p=toProy(o.getAttribute('data-proy'))||toProy(o.value)||toProy(o.textContent); if(p&&u.indexOf(p)<0) o.remove(); }); if(sel.selectedIndex<0&&sel.options.length) sel.selectedIndex=0; try{ sel.dispatchEvent(new Event('change')); }catch(_){} }
  // Auto-init: cualquier <select data-cp-ubic> se poda solo al cargar
  function auto(){ document.querySelectorAll('select[data-cp-ubic]').forEach(function(s){ scopeSelect(s); }); }
  if(document.readyState!=='loading') auto(); else document.addEventListener('DOMContentLoaded',auto);
  window.cpAcceso={ubicaciones:ubicaciones,permite:permite,filtra:filtra,scopeSelect:scopeSelect,toProy:toProy,tokEmail:tokEmail};
})();
