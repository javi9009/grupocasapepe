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
    /* LA REJILLA QUE SE APLASTABA. Javi, 27-nov-2026, con captura: la carpeta
       enseñaba 249 rayas en vez de 249 fotos. Cada tarjeta es un botón con
       overflow:hidden, y a un elemento así la rejilla le permite encogerse
       hasta cero: con 249 filas en una caja de alto fijo, las encogió todas y
       sólo quedaba el borde. grid-auto-rows:max-content le prohibe encogerlas;
       el scroll lo pone la rejilla, que es para lo que está. */
    e.textContent=
      '.cpf-velo{position:fixed;inset:0;background:rgba(26,22,18,.6);z-index:9000;'+
        'display:flex;align-items:center;justify-content:center;padding:16px}'+
      '.cpf-caja{background:#FBF7F1;border-radius:16px;width:100%;max-width:980px;'+
        'height:min(88vh,820px);display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.32)}'+
      '.cpf-cab{padding:16px 18px 10px;border-bottom:1px solid #E6DED2;position:relative;flex:none}'+
      '.cpf-cab h3{margin:0 0 2px;font-size:19px;color:#1A1612}'+
      '.cpf-cab p{margin:0;font-size:12.5px;color:#8A7D6C}'+
      '.cpf-x{position:absolute;top:12px;right:14px;width:32px;height:32px;border:0;'+
        'border-radius:50%;background:#fff;font-size:19px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.14)}'+
      '.cpf-barra{flex:none;padding:10px 18px 12px;border-bottom:1px solid #EFE8DD}'+
      '.cpf-filtros{display:flex;gap:8px;flex-wrap:wrap}'+
      '.cpf-chip{border:1px solid #E6DED2;background:#fff;border-radius:999px;padding:5px 12px;'+
        'font-size:12.5px;cursor:pointer;color:#5A5044}'+
      '.cpf-chip.on{background:#F2682A;border-color:#F2682A;color:#fff;font-weight:600}'+
      '.cpf-busca{margin-top:10px;width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;'+
        'border:1px solid #E6DED2;font-size:14px;background:#fff}'+
      '.cpf-busca:focus{outline:none;border-color:#F2682A;box-shadow:0 0 0 3px #FDE7DC}'+
      '.cpf-rejilla{flex:1;min-height:0;overflow:auto;display:grid;gap:14px;padding:16px 18px 20px;'+
        'grid-template-columns:repeat(auto-fill,minmax(168px,1fr));'+
        'grid-auto-rows:max-content;align-content:start}'+
      '.cpf-f{position:relative;border:1px solid #E6DED2;border-radius:12px;overflow:hidden;background:#fff;'+
        'cursor:pointer;text-align:left;padding:0;display:flex;flex-direction:column;'+
        'transition:border-color .12s,box-shadow .12s,transform .12s}'+
      '.cpf-f:hover{border-color:#D9CBB8;box-shadow:0 6px 16px -10px rgba(30,26,22,.45);transform:translateY(-1px)}'+
      '.cpf-f:focus-visible{outline:none;box-shadow:0 0 0 3px #FDE7DC;border-color:#F2682A}'+
      '.cpf-f.on{border-color:#F2682A;box-shadow:0 0 0 2px rgba(242,104,42,.35)}'+
      '.cpf-img{position:relative;display:block;aspect-ratio:4/3;background:#F1EBE2}'+
      '.cpf-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}'+
      '.cpf-img .rota{position:absolute;inset:0;display:none;align-items:center;justify-content:center;'+
        'padding:10px;text-align:center;font-size:11.5px;color:#9A8E7E}'+
      '.cpf-f.sinvista .cpf-img img{display:none}'+
      '.cpf-f.logo .cpf-img{background:#fff}'+
      '.cpf-f.logo .cpf-img img{object-fit:contain;padding:16px 14px 12px;box-sizing:border-box}'+
      '.cpf-f.sinvista .cpf-img .rota{display:flex}'+
      '.cpf-de{position:absolute;left:8px;top:8px;background:rgba(30,26,22,.62);color:#fff;'+
        'font-size:10.5px;font-weight:600;letter-spacing:.02em;padding:2px 7px;border-radius:999px}'+
      '.cpf-ok{position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:50%;'+
        'background:#F2682A;color:#fff;font-size:14px;font-weight:700;display:none;'+
        'align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)}'+
      '.cpf-f.on .cpf-ok{display:flex}'+
      '.cpf-txt{display:block;padding:8px 10px 9px}'+
      '.cpf-tit{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;'+
        'font-size:12.5px;color:#1A1612;line-height:1.3;font-weight:600}'+
      '.cpf-gru{display:block;margin-top:2px;font-size:11px;color:#9A8E7E;'+
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.cpf-pie{flex:none;border-top:1px solid #E6DED2;padding:12px 18px;display:flex;gap:10px;'+
        'align-items:center;justify-content:flex-end;background:#F5EFE6;border-radius:0 0 16px 16px}'+
      '.cpf-pie .cuenta{margin-right:auto;font-size:12.5px;color:#8A7D6C}'+
      '.cpf-btn{border:0;background:#F2682A;color:#fff;border-radius:10px;padding:9px 16px;'+
        'font-size:13.5px;font-weight:600;cursor:pointer}'+
      '.cpf-btn[disabled]{opacity:.45;cursor:default}'+
      '.cpf-btn.fan{background:#fff;color:#1A1612;border:1px solid #E6DED2}'+
      '.cpf-vacio{grid-column:1/-1;padding:26px 0;text-align:center;color:#8A7D6C;font-size:13.5px}'+
      '@media (max-width:560px){.cpf-rejilla{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}'+
        '.cpf-velo{padding:0}.cpf-caja{height:100%;max-height:none;border-radius:0}}'+
      '@media (prefers-reduced-motion:reduce){.cpf-f{transition:none}.cpf-f:hover{transform:none}}';
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
          '<div class="cpf-barra"><div class="cpf-filtros"></div>'+
          '<input class="cpf-busca" placeholder="Buscar por nombre…" aria-label="Buscar"></div>'+
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

      /* LA MINIATURA. 249 fotos a tamaño completo son decenas de megas para
         elegir una. Las que viven en nuestro Storage se piden ya recortadas a
         360 px (Supabase las redimensiona: 11 KB en vez de 103). Las de fuera
         se piden tal cual. Y todas con loading=lazy: sólo se baja lo que se ve. */
      function mini(u){
        var m=String(u||'').match(/^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+)$/);
        return m ? (m[1]+'/storage/v1/render/image/public/'+m[2]+'?width=360&height=270&resize=cover&quality=70') : u;
      }
      /* Un logo no se recorta: se ve entero sobre blanco. Recortado a la caja,
         «Coca-Cola» se lee «ca-Col» y «Red Bull» se lee «ed Bu». */
      function esLogo(f){
        return /marca|logo/i.test(String(f.grupo||'')) || /\/marcas\//i.test(String(f.url||'')) ||
               /\.svg(\?|$)/i.test(String(f.url||''));
      }
      function tarjeta(f){
        var on=ELEGIDAS.indexOf(f.url)>=0, logo=esLogo(f);
        return '<button type="button" class="cpf-f'+(on?' on':'')+(logo?' logo':'')+'" data-u="'+esc(f.url)+'" title="'+esc(f.titulo||'')+'">'+
          '<span class="cpf-img"><img loading="lazy" decoding="async" alt="" src="'+esc(logo?f.url:mini(f.url))+'" data-o="'+esc(f.url)+'">'+
            '<span class="rota">Sin vista previa</span>'+
            '<span class="cpf-de">'+esc(f.de_nombre||'')+'</span>'+
            '<span class="cpf-ok" aria-hidden="true">✓</span></span>'+
          '<span class="cpf-txt"><span class="cpf-tit">'+esc(f.titulo||'Sin nombre')+'</span>'+
            '<span class="cpf-gru">'+esc(f.grupo||f.de_nombre||'')+'</span></span></button>';
      }
      /* Si la miniatura falla se prueba la original; si también falla, se dice
         en vez de dejar un hueco gris que parece que está cargando. */
      function vigilaImagenes(){
        Array.prototype.forEach.call(rejilla.querySelectorAll('img[data-o]'),function(im){
          im.onerror=function(){
            var o=im.getAttribute('data-o');
            if(o && im.getAttribute('src')!==o){ im.setAttribute('src',o); return; }
            var b=im.closest('.cpf-f'); if(b) b.classList.add('sinvista');
          };
        });
      }
      function pie(nVisibles){
        cuenta.textContent = ELEGIDAS.length
          ? (ELEGIDAS.length===1?'1 foto elegida':ELEGIDAS.length+' fotos elegidas')
          : (nVisibles+(nVisibles===1?' foto':' fotos'));
        bSi.disabled = !ELEGIDAS.length;
        bSi.textContent = ELEGIDAS.length>1 ? ('Seleccionar estas '+ELEGIDAS.length) : 'Seleccionar esta';
      }
      var VISIBLES=0;
      /* Elegir ya no redibuja la rejilla: sólo cambia la marca. Antes cada clic
         repintaba las 249 tarjetas y las fotos parpadeaban. */
      function marca(){
        Array.prototype.forEach.call(rejilla.querySelectorAll('[data-u]'),function(b){
          var on=ELEGIDAS.indexOf(b.getAttribute('data-u'))>=0;
          b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
        });
        pie(VISIBLES);
      }
      function pinta(){
        var q=String(busca.value||'').trim().toLowerCase();
        var ls=TODAS.filter(function(f){
          if(FILTRO && f.de!==FILTRO) return false;
          if(!q) return true;
          return (String(f.titulo||'')+' '+String(f.grupo||'')).toLowerCase().indexOf(q)>=0;
        });
        VISIBLES=ls.length;
        rejilla.innerHTML = ls.length
          ? ls.map(tarjeta).join('')
          : '<div class="cpf-vacio">Aquí no hay ninguna foto con eso. '+
            'Prueba con otra palabra, o súbela desde tu equipo.</div>';
        rejilla.scrollTop=0;
        vigilaImagenes();
        Array.prototype.forEach.call(rejilla.querySelectorAll('[data-u]'),function(b){
          b.onclick=function(){
            var u=b.getAttribute('data-u'), i=ELEGIDAS.indexOf(u);
            if(varias){ if(i>=0) ELEGIDAS.splice(i,1); else ELEGIDAS.push(u); }
            else ELEGIDAS = (i>=0) ? [] : [u];
            marca();
          };
          /* Con una sola foto, doble clic es elegir y cerrar. */
          if(!varias) b.ondblclick=function(){ cierra([b.getAttribute('data-u')]); };
        });
        marca();
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
