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

  function injectCuentaBtn(n){
    if(document.getElementById('firmaCuentaBtn')) return true;
    // Ancla preferida: el botón "Cerrar sesión" de Mi cuenta (texto estable). Insertamos justo antes.
    var anchor=null, nodes=document.querySelectorAll('button,a,div,span,h1,h2,h3,.ssub,.stitle,section');
    for(var i=0;i<nodes.length;i++){
      var t=(nodes[i].textContent||'').trim().toLowerCase();
      if(t==='cerrar sesión'||t==='cerrar sesion'){ anchor=nodes[i]; break; }
      if(t==='tus datos y documentos'||(t.indexOf('datos y documentos')>=0&&t.length<60)){ anchor=nodes[i]; }
    }
    if(!anchor) return false;
    // solo cuando Mi cuenta está visible
    if(anchor.offsetParent===null) return false;
    var b=document.createElement('a');
    b.id='firmaCuentaBtn'; b.href='firmar.html';
    b.style.cssText='display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0;background:#1d9e75;color:#fff;text-decoration:none;font:700 15px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:14px;border-radius:12px';
    b.innerHTML='✍️ Documentos por firmar'+(n>0?(' <span style="background:#fff;color:#b03434;border-radius:999px;padding:0 8px;margin-left:4px">'+n+'</span>'):'');
    var host=anchor.parentElement||document.body;
    host.insertBefore(b,anchor);
    return true;
  }

  // Botón "Borrar todas" en el panel de Notificaciones (RLS limita a las propias)
  function injectNotifDelete(sb){
    if(document.getElementById('notifDelAll')) return true;
    var hdr=null, hs=document.querySelectorAll('h1,h2,h3');
    for(var i=0;i<hs.length;i++){ var t=(hs[i].textContent||'').trim().toLowerCase(); if(t==='notificaciones'&&hs[i].offsetParent!==null){ hdr=hs[i]; break; } }
    if(!hdr) return false;
    var b=document.createElement('button');
    b.id='notifDelAll'; b.type='button'; b.textContent='🗑 Borrar todas';
    b.style.cssText='margin:8px 0;background:#fff;color:#b03434;border:1px solid #e7c3b6;border-radius:10px;padding:8px 12px;font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer';
    b.onclick=function(){
      if(!window.confirm('¿Borrar todas tus notificaciones?')) return;
      b.disabled=true; b.textContent='Borrando…';
      sb.from('notificaciones').delete().not('id','is',null).then(function(){ location.reload(); }).catch(function(){ b.disabled=false; b.textContent='🗑 Borrar todas'; });
    };
    hdr.parentNode.insertBefore(b, hdr.nextSibling);
    return true;
  }
  function run(){
    ensureSb(function(){
      if(!window.supabase||!window.supabase.createClient) return;
      var sb=window.supabase.createClient(SBURL,ANON);
      sb.auth.getSession().then(function(r){
        var session=r&&r.data&&r.data.session; if(!session) return;
        // poller siempre activo para el botón de borrar notificaciones
        var t2=0, iv2=setInterval(function(){ injectNotifDelete(sb); if(++t2>180) clearInterval(iv2); },1000);
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
                var tries=0, iv=setInterval(function(){ injectCuentaBtn(n); if(++tries>60) clearInterval(iv); },500);
              }
            });
          });
        });
      }).catch(function(){});
    });
  }
  ready(function(){ setTimeout(run,800); });
})();
