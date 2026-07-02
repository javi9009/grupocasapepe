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

  function esc(s){ return (''+(s==null?'':s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // La tarjeta "Clases" abre un POP-UP (como el de comidas), no una página nueva
  function openClasesModal(){
    if(document.getElementById('clsOv')) return;
    var ov=document.createElement('div'); ov.id='clsOv';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;display:flex;align-items:center;justify-content:center;padding:12px';
    var card=document.createElement('div'); card.style.cssText='width:520px;max-width:96vw;height:84vh;background:#f4ecdd;border-radius:20px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.45);position:relative';
    var fr=document.createElement('iframe'); fr.src='clases.html?embed=1'; fr.style.cssText='width:100%;height:100%;border:0;display:block';
    var cl=document.createElement('button'); cl.textContent='✕'; cl.setAttribute('aria-label','Cerrar');
    cl.style.cssText='position:absolute;top:10px;right:12px;z-index:2;background:#fff;border:1px solid #eadfce;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15)';
    cl.onclick=function(){ ov.remove(); };
    card.appendChild(fr); card.appendChild(cl); ov.appendChild(card);
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
  }
  function ensureClasesIntercept(){
    if(window.__clsDocHook) return; window.__clsDocHook=true;
    document.addEventListener('click',function(e){
      var n=e.target;
      for(var k=0;k<5 && n;k++){
        var tt=(n.textContent||'').toLowerCase().replace(/[^a-záéíóúñ]/g,'');
        if(tt==='clases'){ e.preventDefault(); e.stopImmediatePropagation(); openClasesModal(); return; }
        n=n.parentElement;
      }
    }, true);
  }

  // Renombrar la pestaña "Academia" -> "PepeQuiz" con tipografía Clarendon
  function renameTab(){
    var b=document.querySelector('[data-tab="academia"]');
    if(b && b.textContent.trim().toLowerCase()==='academia'){
      b.textContent='PepeQuiz';
      b.style.fontFamily="'Clarendon','Roboto Slab',Georgia,serif";
    }
  }

  // Toma el panel de Notificaciones y renderiza la lista propia con borrado por-notificación.
  function takeoverNotifs(sb){
    if(document.getElementById('myNotifWrap')) return true;
    var hs=document.querySelectorAll('h1,h2,h3'), h=null;
    for(var i=0;i<hs.length;i++){ if((hs[i].textContent||'').trim().toLowerCase()==='notificaciones' && hs[i].offsetParent!==null){ h=hs[i]; break; } }
    if(!h) return false;
    // ocultar la lista original del portal (hermanos posteriores al título)
    var sib=h.nextElementSibling;
    while(sib){ sib.style.display='none'; sib=sib.nextElementSibling; }
    var wrap=document.createElement('div'); wrap.id='myNotifWrap'; wrap.style.cssText='margin-top:8px';
    h.parentNode.insertBefore(wrap, h.nextSibling);
    renderMyNotifs(sb, wrap);
    return true;
  }
  function renderMyNotifs(sb, wrap){
    wrap.innerHTML='<div style="font-size:12px;color:#9a8c85;margin-bottom:6px">Tus avisos de Casa Pepe</div><div style="text-align:center;color:#9a8c85;padding:12px">Cargando…</div>';
    sb.from('notificaciones').select('id,titulo,cuerpo,icono,leido,created_at').order('created_at',{ascending:false}).then(function(r){
      var data=(r&&r.data)||[];
      var head='<div style="font-size:12px;color:#9a8c85;margin-bottom:6px">Tus avisos de Casa Pepe</div>';
      if(!data.length){ wrap.innerHTML=head+'<div style="text-align:center;color:#9a8c85;padding:18px">No tienes notificaciones. 🔕</div>'; return; }
      var html=head;
      data.forEach(function(n){
        html+='<div data-nid="'+n.id+'" style="display:flex;gap:10px;align-items:flex-start;padding:10px 2px;border-bottom:1px solid rgba(0,0,0,.08)">'
          +'<span style="font-size:18px;line-height:1.3">'+(n.icono||'🔔')+'</span>'
          +'<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">'+esc(n.titulo||'')+'</div>'
          +'<div style="font-size:13px;opacity:.8">'+esc(n.cuerpo||'')+'</div>'
          +'<div style="font-size:11px;opacity:.55;margin-top:2px">'+new Date(n.created_at).toLocaleString('es-MX')+'</div></div>'
          +'<button data-del="'+n.id+'" title="Borrar" style="background:none;border:none;color:#b03434;font-size:20px;line-height:1;cursor:pointer;padding:0 4px">×</button>'
        +'</div>';
      });
      wrap.innerHTML=html;
      [].slice.call(wrap.querySelectorAll('[data-del]')).forEach(function(btn){
        btn.onclick=function(){
          var id=btn.getAttribute('data-del'); btn.disabled=true; btn.textContent='…';
          sb.from('notificaciones').delete().eq('id',id).then(function(){
            var row=wrap.querySelector('[data-nid="'+id+'"]'); if(row) row.parentNode.removeChild(row);
            if(!wrap.querySelector('[data-nid]')) wrap.innerHTML=head+'<div style="text-align:center;color:#9a8c85;padding:18px">No tienes notificaciones. 🔕</div>';
          }).catch(function(){ btn.disabled=false; btn.textContent='×'; });
        };
      });
    });
  }
  function run(){
    ensureSb(function(){
      if(!window.supabase||!window.supabase.createClient) return;
      var sb=window.supabase.createClient(SBURL,ANON);
      sb.auth.getSession().then(function(r){
        var session=r&&r.data&&r.data.session; if(!session) return;
        // poller siempre activo: renombrar pestaña + tomar el panel de notificaciones (borrado por-notificación)
        var t2=0, iv2=setInterval(function(){ renameTab(); ensureClasesIntercept(); takeoverNotifs(sb); if(++t2>600) clearInterval(iv2); },1000);
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
  ready(function(){ ensureClasesIntercept(); setTimeout(run,800); });
})();
