/* ============================================================
   puerta.js — lo que toda entrada del Grupo tiene que ofrecer.

   Cada propiedad conserva su propia puerta, con su marca: quien opera
   con Sincrético no tiene por qué ver que entra a Casa Pepe. Lo que se
   comparte es el comportamiento, no el aspecto:

     · entrar con Google (o Facebook, el dia que se encienda)
     · recuperar contraseña
     · darse de alta, en la clase que corresponde a esa puerta

   Los proveedores no estan escritos a mano: se leen de /auth/v1/settings,
   asi que encender Facebook en Supabase los hace aparecer solos.

   Uso:
     CPPuerta.extras({ el:'donde', portal:'sincretico', url:SB, key:KEY });
     // si la pagina ya tiene cliente de supabase-js, pasalo como sb:
     CPPuerta.extras({ el:'gate-extras', portal:'ateneo', sb:sb, url:SB_URL, key:SB_KEY });
   ============================================================ */
(function(){
  var PROVS={google:'Continuar con Google', facebook:'Continuar con Facebook'};

  var TEMAS={
    casapepe  :{color:'#137A56', alta:'Date de alta aquí'},
    sincretico:{color:'#C9501A', alta:'Date de alta como touroperadora'},
    ateneo    :{color:'#557B28', alta:'Date de alta en el Ateneo'},
    socios    :{color:'#906A6F', alta:'Pide tu acceso'}
  };

  function css(oscuro, color){
    return '.cpp-x{margin-top:16px;font-size:13.5px}'
      +'.cpp-x .sep{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:11px;'
      +'text-transform:uppercase;letter-spacing:1px;opacity:.65}'
      +'.cpp-x .sep::before,.cpp-x .sep::after{content:"";flex:1;height:1px;background:currentColor;opacity:.25}'
      +'.cpp-x .soc{display:block;width:100%;padding:10px 12px;margin-bottom:8px;border-radius:9px;'
      +'font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;'
      +(oscuro?'background:#f4ecdd;color:#241f18;border:1px solid rgba(255,255,255,.18)'
              :'background:#fff;color:#221f1a;border:1px solid rgba(0,0,0,.14)')+'}'
      +'.cpp-x .soc:disabled{opacity:.6;cursor:default}'
      +'.cpp-x .ligas{margin-top:12px;text-align:center;line-height:1.9}'
      +'.cpp-x .ligas a{color:'+color+';font-weight:600;text-decoration:none;cursor:pointer}'
      +'.cpp-x .ligas a:hover{text-decoration:underline}'
      +'.cpp-x .rec{margin-top:10px;display:none}'
      +'.cpp-x .rec.on{display:block}'
      +'.cpp-x .rec input{width:100%;padding:10px 11px;border-radius:9px;font:inherit;font-size:14px;'
      +(oscuro?'background:#16130f;color:#f4ecdd;border:1px solid #3a3228'
              :'background:#fff;color:#221f1a;border:1px solid rgba(0,0,0,.18)')+'}'
      +'.cpp-x .rec button{width:100%;margin-top:8px;padding:10px;border:0;border-radius:9px;'
      +'background:'+color+';color:#fff;font:inherit;font-weight:700;cursor:pointer}'
      +'.cpp-x .dice{margin-top:9px;font-size:13px;line-height:1.5}';
  }

  async function proveedores(url, key){
    try{
      var r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});
      if(!r.ok) return [];
      var j=await r.json(), ext=j.external||{};
      return Object.keys(PROVS).filter(function(k){ return ext[k]===true; });
    }catch(e){ return []; }
  }

  async function extras(o){
    var caja = (typeof o.el==='string') ? document.getElementById(o.el) : o.el;
    if(!caja) return;
    var tema = TEMAS[o.portal] || TEMAS.casapepe;
    var color = o.color || tema.color;
    var oscuro = !!o.oscuro;
    var url = o.url, key = o.key, sb = o.sb || null;

    if(!document.getElementById('cpp-x-css')){
      var st=document.createElement('style');
      st.id='cpp-x-css'; st.textContent=css(oscuro,color);
      document.head.appendChild(st);
    }

    var provs = await proveedores(url, key);
    var html='<div class="cpp-x">';
    if(provs.length){
      html+='<div class="sep"><span>o</span></div>';
      html+=provs.map(function(p){
        return '<button type="button" class="soc" data-prov="'+p+'">'+PROVS[p]+'</button>';
      }).join('');
    }
    html+='<div class="ligas">'
      +'<a data-rec="1">¿Olvidaste tu contraseña?</a><br>'
      +'¿No tienes cuenta? <a href="/entrar.html?p='+encodeURIComponent(o.portal)+'">'+tema.alta+'</a>'
      +'</div>'
      +'<div class="rec"><input type="email" placeholder="tu@correo.com" autocomplete="email">'
      +'<button type="button">Mandarme el enlace</button><div class="dice"></div></div>'
      +'</div>';
    caja.innerHTML=html;

    /* --- entrar con proveedor --- */
    caja.querySelectorAll('.soc').forEach(function(b){
      b.onclick=async function(){
        b.disabled=true;
        var vuelta = o.vuelta || location.href.split('#')[0];
        if(sb){
          var r=await sb.auth.signInWithOAuth({provider:b.dataset.prov,options:{redirectTo:vuelta}});
          if(r && r.error){ b.disabled=false; dice(r.error.message,true); }
        }else{
          location.href = url+'/auth/v1/authorize?provider='+b.dataset.prov
                        +'&redirect_to='+encodeURIComponent(vuelta);
        }
      };
    });

    /* --- recuperar contraseña --- */
    var rec=caja.querySelector('.rec');
    var dicho=caja.querySelector('.rec .dice');
    function dice(t, mal){ dicho.innerHTML=t; dicho.style.color = mal ? '#b03434' : color; }
    caja.querySelector('[data-rec]').onclick=function(){
      rec.classList.add('on');
      var i=rec.querySelector('input');
      // si la persona ya escribio su correo arriba, se reaprovecha
      var arriba=document.querySelector('input[type=email]');
      if(arriba && arriba!==i && arriba.value) i.value=arriba.value;
      i.focus();
    };
    rec.querySelector('button').onclick=async function(){
      var i=rec.querySelector('input'), correo=(i.value||'').trim().toLowerCase();
      if(!/.+@.+\..+/.test(correo)){ dice('Ese correo no parece válido.',true); return; }
      this.disabled=true; this.textContent='Mandando…';
      var destino = location.origin + '/';   // el panel es quien sabe pedir la nueva contraseña
      try{
        if(sb){ await sb.auth.resetPasswordForEmail(correo,{redirectTo:destino}); }
        else{
          await fetch(url+'/auth/v1/recover',{method:'POST',
            headers:{apikey:key,'Content-Type':'application/json'},
            body:JSON.stringify({email:correo})});
        }
      }catch(e){}
      dice('Te mandamos un enlace a <b>'+correo+'</b>. Ábrelo y pones tu contraseña nueva.');
      this.textContent='Enviado';
    };
  }

  /* Vuelta del proveedor en las paginas que no usan supabase-js: GoTrue
     devuelve los tokens en el trozo de despues de la almohadilla. */
  function sesionDeLaUrl(){
    try{
      var h=(location.hash||'').replace(/^#/,'');
      if(!h || h.indexOf('access_token=')<0) return null;
      var q=new URLSearchParams(h), t=q.get('access_token');
      if(!t) return null;
      var s={access_token:t, refresh_token:q.get('refresh_token')||'',
             token_type:q.get('token_type')||'bearer',
             expires_in:parseInt(q.get('expires_in')||'3600',10)};
      history.replaceState(null,'',location.pathname+location.search);
      return s;
    }catch(e){ return null; }
  }

  window.CPPuerta={ extras:extras, proveedores:proveedores, sesionDeLaUrl:sesionDeLaUrl };
})();
