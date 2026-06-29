/* Soy Pepe · widget de documentos por firmar
   Inyecta un aviso al entrar y un botón en "Mi cuenta" cuando hay documentos pendientes.
   Autocontenido: no depende del JS del portal. Toda la firma vive en firmar.html. */
(function(){
  var SBURL='https://rehophywchakfapivsbh.supabase.co';
  var ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaG9waHl3Y2hha2ZhcGl2c2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzOTU3MDgsImV4cCI6MjA5Njk3MTcwOH0.kntapjLdn0jUr62pre6uqFaf2RPfun6-DujIkshVd8Y';

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function ensureSb(cb){
    if(window.supabase&&window.supabase.createClient) return cb();
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload=cb; s.onerror=function(){}; document.head.appendChild(s);
  }

  function injectBanner(n){
    if(document.getElementById('firmaPill')) { document.getElementById('firmaPillN').textContent=n; return; }
    var a=document.createElement('a');
    a.id='firmaPill'; a.href='firmar.html';
    a.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:9999;background:#b03434;color:#fff;text-decoration:none;font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:11px 16px;border-radius:999px;box-shadow:0 6px 22px rgba(0,0,0,.28);display:flex;align-items:center;gap:8px;max-width:92vw';
    a.innerHTML='✍️ Tienes <b id="firmaPillN" style="margin:0 2px">'+n+'</b> documento'+(n>1?'s':'')+' por firmar →';
    document.body.appendChild(a);
  }

  function injectCuentaBtn(){
    if(document.getElementById('firmaCuentaBtn')) return true;
    // busca la tarjeta de "Mi cuenta / Tus datos y documentos"
    var anchor=null, nodes=document.querySelectorAll('h1,h2,h3,.ssub,.stitle,div,section');
    for(var i=0;i<nodes.length;i++){
      var t=(nodes[i].textContent||'').trim().toLowerCase();
      if(t==='tus datos y documentos' || (t.indexOf('datos y documentos')>=0 && t.length<60)){ anchor=nodes[i]; break; }
    }
    if(!anchor) return false;
    var host=anchor.closest('.card')||anchor.parentElement;
    var b=document.createElement('a');
    b.id='firmaCuentaBtn'; b.href='firmar.html';
    b.style.cssText='display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;background:#1d9e75;color:#fff;text-decoration:none;font:700 15px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:14px;border-radius:12px';
    b.innerHTML='✍️ Documentos por firmar';
    host.appendChild(b);
    return true;
  }

  function run(){
    ensureSb(function(){
      if(!window.supabase||!window.supabase.createClient) return;
      var sb=window.supabase.createClient(SBURL,ANON);
      sb.auth.getSession().then(function(r){
        var session=r&&r.data&&r.data.session; if(!session) return;
        sb.auth.getUser().then(function(u){
          var uid=u&&u.data&&u.data.user&&u.data.user.id; if(!uid) return;
          sb.from('employees').select('id').eq('user_id',uid).limit(1).then(function(er){
            var emp=er&&er.data&&er.data[0]; if(!emp) return;
            Promise.all([
              sb.from('contratos').select('id').eq('employee_id',emp.id).eq('estatus','enviado_pendiente_firma'),
              sb.from('actas_administrativas').select('id').eq('employee_id',emp.id).is('firma_url',null)
            ]).then(function(res){
              var c=(res[0].data||[]).length, a=(res[1].data||[]).length, n=c+a;
              // el botón de Mi cuenta lo intentamos siempre (aunque n=0 no lo ponemos para no estorbar)
              if(n>0){
                injectBanner(n);
                var tries=0, iv=setInterval(function(){ if(injectCuentaBtn()||++tries>40) clearInterval(iv); },400);
              }
            });
          });
        });
      }).catch(function(){});
    });
  }
  ready(function(){ setTimeout(run,800); });
})();
