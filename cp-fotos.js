/* LA CARPETA DE CONTENIDO — cp-fotos.js
   Javi, 21-nov-2026: «que TODAS las opciones de "subir foto" de la plataforma
   también tengan la opción de "subir desde carpeta de contenido" y que permita
   buscar las fotos que tenemos subidas y clicar en "seleccionar esta"».

   Antes, cada pantalla que pedía una foto la pedía otra vez: había que subirla
   de nuevo aunque ya estuviera arriba. Así se llena el almacén de duplicados y
   la misma piñata acaba viéndose distinta en cada sitio.

   Esto es una pieza sola para toda la plataforma. Una pantalla la enciende con
   una línea y ya tiene el buscador:

       <script src="/cp-fotos.js"></script>
       var urls = await cpFotos.elige({varias:true});   // [] si cancelan

   No guarda nada ni toca la base: devuelve las ligas y quien la llamó decide
   qué hacer con ellas. El índice es la vista v_fotos_todas, que no copia
   fotos: apunta a las que ya están en la fototeca, en las experiencias, en los
   espacios, en la carta, en los vehículos y en los extras.

   Nunca abre un diálogo del navegador: el modal es de la casa. */
(function(){
  if(window.cpFotos) return;

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var CACHE = null;          /* el índice se pide una vez por sesión */
  var CSS_PUESTO = false;

  function esc(t){ return String(t==null?'':t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Si la pantalla ya tiene sesión, se usa; si no, la llave pública basta:
     la vista es de lectura y las fotos ya son públicas. */
  function token(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && /sb-.*-auth-token/.test(k)){
          var v=JSON.parse(localStorage.getItem(k)||'null');
          var s=v&&(v.currentSession||v);
          if(s&&s.access_token) return s.access_token;
        }
      }
    }catch(_){}
    return KEY;
  }

  async function indice(){
    if(CACHE) return CACHE;
    var r=await fetch(SB+'/rest/v1/v_fotos_todas?select=*&limit=2000',
      {headers:{apikey:KEY,'Authorization':'Bearer '+token()}});
    if(!r.ok) throw new Error('No se pudo leer la carpeta de contenido ('+r.status+')');
    var ls=await r.json();
    /* La misma foto puede estar en dos sitios: se enseña una vez. */
    var vistas={}, out=[];
    (ls||[]).forEach(function(f){
      if(!f.url || vistas[f.url]) return;
      vistas[f.url]=1; out.push(f);
    });
    CACHE=out; return out;
  }

  function estilos(){
    if(CSS_PUESTO) return; CSS_PUESTO=true;
    var e=document.createElement('style');
    e.textContent=
      '.cpf-velo{position:fixed;inset:0;background:rgba(26,22,18,.6);z-index:9000;'+
        'display:flex;align-items:center;justify-content:center;padding:16px}'+
      '.cpf-caja{background:#FBF7F1;border-radius:16px;width:100%;max-width:900px;'+
        'max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.32)}'+
      '.cpf-cab{padding:16px 18px 10px;border-bottom:1px solid #E6DED2;position:relative}'+
      '.cpf-cab h3{margin:0 0 2px;font-size:19px;color:#1A1612}'+
      '.cpf-cab p{margin:0;font-size:12.5px;color:#8A7D6C}'+
      '.cpf-x{position:absolute;top:12px;right:14px;width:32px;height:32px;border:0;'+
        'border-radius:50%;background:#fff;font-size:19px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14)}'+
      '.cpf-filtros{display:flex;gap:8px;flex-wrap:wrap;padding:10px 18px 0}'+
      '.cpf-chip{border:1px solid #E6DED2;background:#fff;border-radius:999px;padding:5px 12px;'+
        'font-size:12.5px;cursor:pointer;color:#5A5044}'+
      '.cpf-chip.on{background:#F2682A;border-color:#F2682A;color:#fff;font-weight:600}'+
      '.cpf-busca{margin:10px 18px 0;width:calc(100% - 36px);padding:9px 12px;border-radius:10px;'+
        'border:1px solid #E6DED2;font-size:14px;background:#fff}'+
      '.cpf-rejilla{flex:1;overflow:auto;display:grid;gap:10px;padding:14px 18px 18px;'+
        'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}'+
      '.cpf-f{border:1px solid #E6DED2;border-radius:11px;overflow:hidden;background:#fff;'+
        'cursor:pointer;text-align:left;padding:0;display:flex;flex-direction:column}'+
      '.cpf-f.on{border-color:#F2682A;box-shadow:0 0 0 2px rgba(242,104,42,.28)}'+
      '.cpf-f i{display:block;height:104px;background:#F1EBE2 center/cover no-repeat}'+
      '.cpf-f span{display:block;padding:7px 9px;font-size:12.5px;color:#1A1612;line-height:1.25}'+
      '.cpf-f em{display:block;font-style:normal;font-size:11px;color:#9A8E7E;margin-top:2px}'+
      '.cpf-pie{border-top:1px solid #E6DED2;padding:12px 18px;display:flex;gap:10px;'+
        'align-items:center;justify-content:flex-end;background:#F5EFE6;border-radius:0 0 16px 16px}'+
      '.cpf-pie .cuenta{margin-right:auto;font-size:12.5px;color:#8A7D6C}'+
      '.cpf-btn{border:0;background:#F2682A;color:#fff;border-radius:10px;padding:9px 16px;'+
        'font-size:13.5px;font-weight:600;cursor:pointer}'+
      '.cpf-btn[disabled]{opacity:.45;cursor:default}'+
      '.cpf-btn.fan{background:#fff;color:#1A1612;border:1px solid #E6DED2}'+
      '.cpf-vacio{grid-column:1/-1;padding:26px 0;text-align:center;color:#8A7D6C;font-size:13.5px}';
    document.head.appendChild(e);
  }

  /* Devuelve las ligas elegidas. Array vacío si cierran sin elegir. */
  function elige(op){
    op=op||{};
    var varias=!!op.varias;
    estilos();
    return new Promise(function(listo){
      var velo=document.createElement('div');
      velo.className='cpf-velo';
      velo.innerHTML=
        '<div class="cpf-caja" role="dialog" aria-modal="true" aria-label="Carpeta de contenido">'+
          '<div class="cpf-cab"><h3>Carpeta de contenido</h3>'+
            '<p>Las fotos que ya tenemos subidas. '+
            (varias?'Puedes marcar varias.':'Elige una.')+'</p>'+
            '<button class="cpf-x" aria-label="Cerrar">×</button></div>'+
          '<div class="cpf-filtros"></div>'+
          '<input class="cpf-busca" placeholder="Buscar por nombre…" aria-label="Buscar">'+
          '<div class="cpf-rejilla"><div class="cpf-vacio">Abriendo la carpeta…</div></div>'+
          '<div class="cpf-pie"><span class="cuenta"></span>'+
            '<button class="cpf-btn fan" data-no>Cancelar</button>'+
            '<button class="cpf-btn" data-si disabled>Seleccionar</button></div>'+
        '</div>';
      document.body.appendChild(velo);

      var rejilla=velo.querySelector('.cpf-rejilla');
      var filtros=velo.querySelector('.cpf-filtros');
      var busca=velo.querySelector('.cpf-busca');
      var cuenta=velo.querySelector('.cuenta');
      var bSi=velo.querySelector('[data-si]');
      var TODAS=[], FILTRO='', ELEGIDAS=[];

      function cierra(v){
        document.removeEventListener('keydown',tecla);
        try{ velo.remove(); }catch(_){ }
        listo(v||[]);
      }
      function tecla(ev){ if(ev.key==='Escape'){ ev.stopPropagation(); cierra([]); } }
      document.addEventListener('keydown',tecla);
      velo.querySelector('.cpf-x').onclick=function(){ cierra([]); };
      velo.querySelector('[data-no]').onclick=function(){ cierra([]); };
      velo.onclick=function(ev){ if(ev.target===velo) cierra([]); };
      bSi.onclick=function(){ cierra(ELEGIDAS.slice()); };

      function pinta(){
        var q=String(busca.value||'').trim().toLowerCase();
        var ls=TODAS.filter(function(f){
          if(FILTRO && f.de!==FILTRO) return false;
          if(!q) return true;
          return (String(f.titulo||'')+' '+String(f.grupo||'')).toLowerCase().indexOf(q)>=0;
        });
        rejilla.innerHTML = ls.length
          ? ls.map(function(f){
              var on=ELEGIDAS.indexOf(f.url)>=0;
              return '<button type="button" class="cpf-f'+(on?' on':'')+'" data-u="'+esc(f.url)+'">'+
                '<i style="background-image:url('+encodeURI(f.url)+')"></i>'+
                '<span>'+esc(f.titulo)+'<em>'+esc(f.grupo||f.de_nombre)+
                (on?' · elegida':'')+'</em></span></button>'; }).join('')
          : '<div class="cpf-vacio">Aquí no hay ninguna foto con eso. '+
            'Prueba con otra palabra, o súbela desde tu equipo.</div>';
        Array.prototype.forEach.call(rejilla.querySelectorAll('[data-u]'),function(b){
          b.onclick=function(){
            var u=b.getAttribute('data-u'), i=ELEGIDAS.indexOf(u);
            if(varias){ if(i>=0) ELEGIDAS.splice(i,1); else ELEGIDAS.push(u); }
            else ELEGIDAS = (i>=0) ? [] : [u];
            pinta();
          };});
        cuenta.textContent = ELEGIDAS.length
          ? (ELEGIDAS.length===1?'1 foto elegida':ELEGIDAS.length+' fotos elegidas')
          : (ls.length+(ls.length===1?' foto':' fotos'));
        bSi.disabled = !ELEGIDAS.length;
        bSi.textContent = ELEGIDAS.length>1 ? ('Seleccionar estas '+ELEGIDAS.length) : 'Seleccionar esta';
      }

      busca.oninput=pinta;

      indice().then(function(ls){
        TODAS=ls;
        var grupos={}; ls.forEach(function(f){ grupos[f.de]=f.de_nombre; });
        filtros.innerHTML='<button type="button" class="cpf-chip on" data-de="">Todas · '+ls.length+'</button>'+
          Object.keys(grupos).map(function(k){
            var n=ls.filter(function(f){return f.de===k;}).length;
            return '<button type="button" class="cpf-chip" data-de="'+esc(k)+'">'+
              esc(grupos[k])+' · '+n+'</button>'; }).join('');
        Array.prototype.forEach.call(filtros.querySelectorAll('[data-de]'),function(b){
          b.onclick=function(){
            FILTRO=b.getAttribute('data-de');
            Array.prototype.forEach.call(filtros.querySelectorAll('.cpf-chip'),function(c){
              c.classList.toggle('on', c===b); });
            pinta();
          };});
        pinta();
        try{ busca.focus(); }catch(_){}
      }).catch(function(e){
        rejilla.innerHTML='<div class="cpf-vacio">'+esc(e.message)+'</div>';
      });
    });
  }

  window.cpFotos={ elige:elige, recarga:function(){ CACHE=null; } };
})();
