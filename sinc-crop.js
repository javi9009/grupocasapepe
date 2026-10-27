/* Sincrético · Recortador de fotos, sin librerías ni dependencias.
   Sale del fl_crop.js de Flylike; aquí va con la marca de Sincrético, en
   español de México, y con un ayudante para subir a Supabase Storage.

   Uso mínimo:
     sincCrop.open(fileOUrl, function(r){ r = {vBlob,hBlob,vName,hName} });
     sincCrop.open(fileOUrl, {only:'v'}, cb);     // un solo recorte

   Subir (hace el recorte y lo deja en Storage, devuelve las dos URLs):
     sincCrop.subir(file, {sb, key, token, bucket, ruta}, function(err,r){
       // r = {vUrl,hUrl,vPath,hPath}
     });

   Por qué dos versiones y no una: la tarjeta es vertical y el hero es
   horizontal. Si guardas una sola, una de las dos sale cortada por la mitad
   y nadie entiende por qué. Se recorta una vez, se guardan las dos, y cada
   sitio pide la que le toca.

   La casilla "Mostrar la foto completa" VIENE DESMARCADA. Javi, 26-oct-2026:
   «¿puedes hacer que al subirlas las centres automáticamente? ¿podrías ajustar
   el sistema de fotos para que no haya ninguna con los bordes blancos?».
   Antes venía marcada para que nadie dijera "me cortaste la foto", y el precio
   fue el contrario: tarjetas con franjas color hueso arriba y abajo -una foto
   de Mixquic llegó a tener 278 píxeles de banda a cada lado- en el escaparate
   y en la app. Ahora la foto llena el marco y sale centrada sola; quien de
   verdad necesite verla entera, marca la casilla. */
(function(){
  var VASP=3/4, HASP=16/9;
  var OUT_V={w:900,h:1200}, OUT_H={w:1600,h:900};
  /* LA MINIATURA. Javi, 27-oct-2026. El mismo encuadre vertical a 600 px, que
     es lo más grande que pide una tarjeta del sitio. Se guarda al recortar en
     vez de pedírsela al redimensionador de Supabase, que se cobra por imagen
     distinta al mes -368 de 100 incluidas- y que llevaba meses resolviendo un
     problema que el recortador ya resolvía: estas fotos no pesan tres megas,
     pesan 245 kB. Sesenta kilobytes más por foto a cambio de la factura
     entera, y las tarjetas más ligeras que con la transformación. */
  var OUT_T={w:600,h:800};
  var FV={w:258,h:344}, FH={w:344,h:194};
  var FONDO='#F4EFE8';               /* hueso: el fondo que queda al ver la foto entera */

  function css(){
    if(document.getElementById('sinccrop-css'))return;
    var s=document.createElement('style'); s.id='sinccrop-css';
    s.textContent=[
      '.sc-ov{position:fixed;inset:0;background:rgba(30,26,22,.74);z-index:99998;display:flex;',
        'align-items:center;justify-content:center;padding:16px;',
        'font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}',
      '.sc-box{background:#FBF7F2;border-radius:14px;max-width:820px;width:100%;max-height:92vh;',
        'overflow:auto;padding:20px 22px;box-shadow:0 24px 60px -24px rgba(30,26,22,.55)}',
      '.sc-box h3{font-family:Oswald,system-ui,sans-serif;font-weight:700;text-transform:uppercase;',
        'letter-spacing:.02em;color:#1E1A16;margin:0 0 4px;font-size:19px}',
      '.sc-box .sc-hint{font-size:12.5px;color:#6E665C;line-height:1.5;margin-bottom:15px;max-width:64ch}',
      '.sc-frames{display:flex;gap:22px;flex-wrap:wrap;justify-content:center}',
      '.sc-one{text-align:center}',
      '.sc-one .sc-lbl{font-family:Oswald,system-ui,sans-serif;font-size:11px;font-weight:600;',
        'letter-spacing:.09em;text-transform:uppercase;color:#6E665C;margin-bottom:6px}',
      '.sc-vp{position:relative;overflow:hidden;border-radius:10px;background:'+FONDO+';margin:0 auto;',
        'cursor:grab;touch-action:none;box-shadow:inset 0 0 0 2px #F2682A}',
      '.sc-vp.sc-drag{cursor:grabbing}',
      '.sc-vp img{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;',
        'pointer-events:none;max-width:none}',
      '.sc-rng{width:100%;margin:9px 0 0;accent-color:#F2682A}',
      '.sc-fit{display:flex;align-items:center;gap:6px;justify-content:center;font-size:12.5px;',
        'color:#3C3630;margin:8px 0 2px;cursor:pointer}',
      '.sc-fit input{width:15px;height:15px;accent-color:#F2682A}',
      '.sc-ctr{margin-top:6px;border:1.5px solid #E6DFD6;background:#fff;color:#C9501A;border-radius:8px;',
        'padding:5px 12px;font:inherit;font-size:12px;cursor:pointer}',
      '.sc-ctr:hover{border-color:#F2682A}',
      '.sc-bar{display:flex;gap:9px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}',
      '.sc-bar button{font-family:Oswald,system-ui,sans-serif;font-weight:600;letter-spacing:.05em;',
        'text-transform:uppercase;font-size:12.5px;border-radius:9px;padding:10px 18px;cursor:pointer;',
        'border:2px solid #F2682A}',
      '.sc-ghost{background:transparent;color:#C9501A;border-color:#E6DFD6!important}',
      '.sc-ghost:hover{border-color:#F2682A!important}',
      '.sc-ok{background:#F2682A;color:#fff}',
      '.sc-ok:hover{background:#C9501A;border-color:#C9501A}',
      '.sc-ok[disabled]{opacity:.55;cursor:default}',
      '@media(max-width:560px){.sc-box{padding:16px}.sc-frames{gap:16px}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Devuelve la misma foto sin las franjas de fondo que le pusiera un recorte
     anterior, o null si no tiene ninguna -o si el navegador no deja leerla, que
     pasa cuando la imagen viene de otro sitio sin permiso-. Sólo mira el color
     exacto del fondo del recortador: una playa clara o un cielo plano no se
     confunden con una franja, porque el tono tiene que ser ése. */
  function sinBordes(img){
    var w=img.naturalWidth, h=img.naturalHeight;
    if(!w||!h) return null;
    var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    var cx=cv.getContext('2d');
    var dat;
    try{
      cx.drawImage(img,0,0);
      dat=cx.getImageData(0,0,w,h).data;
    }catch(_){ return null; }          /* canvas manchado: se deja como está */

    var R=parseInt(FONDO.substr(1,2),16), G=parseInt(FONDO.substr(3,2),16), B=parseInt(FONDO.substr(5,2),16);
    var paso=Math.max(1,Math.floor(w/40)), pasoY=Math.max(1,Math.floor(h/40));
    function esFondo(x,y){
      var i=(y*w+x)*4;
      return Math.abs(dat[i]-R)<=14 && Math.abs(dat[i+1]-G)<=14 && Math.abs(dat[i+2]-B)<=14;
    }
    function filaFondo(y){ for(var x=0;x<w;x+=paso){ if(!esFondo(x,y)) return false; } return true; }
    function colFondo(x){ for(var y=0;y<h;y+=pasoY){ if(!esFondo(x,y)) return false; } return true; }

    var arr=0; while(arr<h/2 && filaFondo(arr)) arr++;
    var aba=0; while(aba<h/2 && filaFondo(h-1-aba)) aba++;
    var izq=0; while(izq<w/2 && colFondo(izq)) izq++;
    var der=0; while(der<w/2 && colFondo(w-1-der)) der++;
    if(arr+aba<6 && izq+der<6) return null;   /* no tenía bordes */

    var nw=w-izq-der, nh=h-arr-aba;
    if(nw<80 || nh<80) return null;           /* no dejar nada raro */
    var cv2=document.createElement('canvas'); cv2.width=nw; cv2.height=nh;
    cv2.getContext('2d').drawImage(img, izq, arr, nw, nh, 0, 0, nw, nh);
    return cv2.toDataURL('image/jpeg',0.92);
  }

  function marco(img, frame, asp){
    var natW=img.naturalWidth, natH=img.naturalHeight;
    var eCubre=Math.max(frame.w/natW, frame.h/natH);
    var eEntera=Math.min(frame.w/natW, frame.h/natH);
    var st={scale:eCubre, x:0, y:0, min:eCubre, max:eCubre*4, modo:'cubre'};

    function ciñe(){
      var iw=natW*st.scale, ih=natH*st.scale;
      if(st.modo==='entera'){
        /* movimiento libre: puede quedar fondo alrededor */
        var loX=Math.min(0,frame.w-iw), hiX=Math.max(0,frame.w-iw);
        var loY=Math.min(0,frame.h-ih), hiY=Math.max(0,frame.h-ih);
        st.x=Math.min(hiX, Math.max(loX, st.x));
        st.y=Math.min(hiY, Math.max(loY, st.y));
      }else{
        /* la foto siempre tapa el marco: no se ve fondo */
        st.x=Math.min(0, Math.max(frame.w-iw, st.x));
        st.y=Math.min(0, Math.max(frame.h-ih, st.y));
      }
    }
    function centra(){ st.x=(frame.w-natW*st.scale)/2; st.y=(frame.h-natH*st.scale)/2; ciñe(); }

    var caja=document.createElement('div'); caja.className='sc-one';
    var vp=document.createElement('div'); vp.className='sc-vp';
    vp.style.width=frame.w+'px'; vp.style.height=frame.h+'px';
    var im=document.createElement('img'); im.src=img.src;
    im.style.width=natW+'px'; im.style.height=natH+'px';
    vp.appendChild(im);

    var rng=document.createElement('input');
    rng.type='range'; rng.className='sc-rng'; rng.min=1; rng.max=4; rng.step=0.01; rng.value=1;
    rng.setAttribute('aria-label','Zoom');
    var lbl=document.createElement('div'); lbl.className='sc-lbl';
    lbl.textContent=(asp===VASP?'Vertical · tarjetas':'Horizontal · portada y galería');
    var opt=document.createElement('label'); opt.className='sc-fit';
    opt.innerHTML='<input type="checkbox"> Mostrar la foto completa (deja bordes)';
    var chk=opt.querySelector('input');
    var ctr=document.createElement('button');
    ctr.type='button'; ctr.className='sc-ctr'; ctr.textContent='Centrar';

    caja.appendChild(lbl); caja.appendChild(vp); caja.appendChild(rng);
    caja.appendChild(opt); caja.appendChild(ctr);

    function pinta(){ im.style.transform='translate('+st.x+'px,'+st.y+'px) scale('+st.scale+')'; }
    function modo(){
      st.modo=chk.checked?'entera':'cubre';
      st.min=chk.checked?eEntera:eCubre;
      st.scale=st.min; rng.value=1; centra(); pinta();
    }
    chk.addEventListener('change',modo);
    ctr.addEventListener('click',function(){ centra(); pinta(); });
    modo();

    /* arrastre: dedo y ratón */
    var abajo=false,px,py;
    function pt(e){ var t=e.touches&&e.touches[0]; return {x:(t?t.clientX:e.clientX),y:(t?t.clientY:e.clientY)}; }
    function ini(e){ abajo=true; vp.classList.add('sc-drag'); var p=pt(e); px=p.x; py=p.y; e.preventDefault(); }
    function mov(e){ if(!abajo)return; var p=pt(e); st.x+=p.x-px; st.y+=p.y-py; px=p.x; py=p.y; ciñe(); pinta(); }
    function fin(){ abajo=false; vp.classList.remove('sc-drag'); }
    vp.addEventListener('mousedown',ini);
    window.addEventListener('mousemove',mov); window.addEventListener('mouseup',fin);
    vp.addEventListener('touchstart',ini,{passive:false});
    vp.addEventListener('touchmove',mov,{passive:false});
    vp.addEventListener('touchend',fin);

    function zoomA(ns){
      ns=Math.min(st.max,Math.max(st.min,ns));
      var cx=frame.w/2, cy=frame.h/2;
      var rx=(cx-st.x)/st.scale, ry=(cy-st.y)/st.scale;
      st.scale=ns; st.x=cx-rx*ns; st.y=cy-ry*ns; ciñe(); pinta();
    }
    rng.addEventListener('input',function(){ zoomA(st.min*parseFloat(rng.value)); });
    /* rueda del ratón: lo que espera cualquiera sobre una foto */
    vp.addEventListener('wheel',function(e){
      e.preventDefault();
      var f=e.deltaY<0?1.08:1/1.08;
      zoomA(st.scale*f);
      rng.value=Math.min(4,Math.max(1,st.scale/st.min));
    },{passive:false});

    function aBlob(out,cb){
      var sx=(0-st.x)/st.scale, sy=(0-st.y)/st.scale;
      var sw=frame.w/st.scale, sh=frame.h/st.scale;
      var cv=document.createElement('canvas'); cv.width=out.w; cv.height=out.h;
      var ctx=cv.getContext('2d');
      ctx.fillStyle=FONDO; ctx.fillRect(0,0,out.w,out.h);
      ctx.drawImage(img, sx,sy,sw,sh, 0,0,out.w,out.h);
      cv.toBlob(function(b){cb(b);},'image/jpeg',0.9);
    }
    return {el:caja, aBlob:aBlob};
  }

  function open(fuente, opts, cb){
    if(typeof opts==='function'){ cb=opts; opts={}; }
    opts=opts||{};
    css();
    var esArchivo=(typeof fuente!=='string');
    var url=esArchivo?URL.createObjectURL(fuente):fuente;
    var img=new Image();
    if(!esArchivo) img.crossOrigin='anonymous';

    img.onload=function(){
      /* QUITARLE LOS BORDES A UNA FOTO QUE YA LOS TRAE. Cuando se reacomoda una
         foto ya subida, la fuente es el recorte anterior, y si aquél se guardó
         con franjas de fondo -71 de las 155 fotos publicadas las tienen, alguna
         con 391 píxeles arriba y abajo de 1200- volver a recortar sería recortar
         sobre el fondo: o se cuela la franja otra vez, o hay que ampliar la foto
         y se pierde. Así que antes de enseñarla se le quitan, y lo que se
         encuadra es la foto de verdad. Javi, 26-oct-2026. */
      if(!img.__sinbordes){
        img.__sinbordes=1;
        var limpia=sinBordes(img);
        if(limpia){ img.crossOrigin=null; img.src=limpia; return; }  /* vuelve aquí ya limpia */
      }

      var ov=document.createElement('div'); ov.className='sc-ov';
      var box=document.createElement('div'); box.className='sc-box';
      box.innerHTML='<h3>'+(opts.titulo||'Acomoda la foto')+'</h3>'+
        '<div class="sc-hint">Arrástrala para encuadrarla y usa el zoom (o la rueda del ratón). '+
        'La foto <b>llena el marco</b> y sale centrada, sin bordes. Si necesitas que se vea '+
        'entera aunque queden franjas a los lados, marca «Mostrar la foto completa». '+
        'Guardamos una versión vertical para las tarjetas y una horizontal para la portada.</div>';

      var frames=document.createElement('div'); frames.className='sc-frames';
      var solo=opts.only;
      var fv=(solo==='h')?null:marco(img,FV,VASP);
      var fh=(solo==='v')?null:marco(img,FH,HASP);
      if(fv)frames.appendChild(fv.el);
      if(fh)frames.appendChild(fh.el);
      box.appendChild(frames);

      var bar=document.createElement('div'); bar.className='sc-bar';
      bar.innerHTML='<input type="file" accept="image/*" style="display:none">'+
        '<button type="button" class="sc-ghost" style="margin-right:auto">Cambiar foto</button>'+
        '<button type="button" class="sc-ghost">Cancelar</button>'+
        '<button type="button" class="sc-ok">Guardar</button>';
      box.appendChild(bar); ov.appendChild(box); document.body.appendChild(ov);

      function cierra(){
        try{document.body.removeChild(ov);}catch(e){}
        document.removeEventListener('keydown',tecla);
        if(esArchivo) URL.revokeObjectURL(url);
      }
      function tecla(e){ if(e.key==='Escape')cierra(); }
      document.addEventListener('keydown',tecla);

      var ghosts=bar.querySelectorAll('.sc-ghost');
      var inp=bar.querySelector('input[type=file]');
      ghosts[0].onclick=function(){ inp.value=''; inp.click(); };
      inp.onchange=function(e){ var f=e.target.files&&e.target.files[0]; if(!f)return; cierra(); open(f,opts,cb); };
      ghosts[1].onclick=cierra;
      ov.addEventListener('click',function(e){ if(e.target===ov) cierra(); });

      bar.querySelector('.sc-ok').onclick=function(){
        var b=this; b.disabled=true; b.textContent='Guardando…';
        var nm=esArchivo?(fuente.name||'foto'):((fuente.split('/').pop()||'foto').split('?')[0]);
        var base=nm.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,48)||'foto';
        /* EL TAMAÑO DEL ORIGINAL, QUE ES EL QUE IMPORTA. Los dos recortes
           salen siempre de 900 y de 1600 px venga de donde venga la foto, así
           que medirlos no dice nada: el aviso de «⚠ Pequeña» tiene que mirar
           lo que subió la persona. Se mide aquí, que es el único sitio donde
           la foto original está delante. */
        var res={vName:base+'_v.jpg', hName:base+'_h.jpg', tName:base+'_t.jpg',
                 srcW:img.naturalWidth||null, srcH:img.naturalHeight||null};
        /* La miniatura sale del mismo marco vertical, así que es el mismo
           encuadre: si alguien mueve la foto, la tarjeta pequeña se mueve con
           ella. Dos encuadres distintos para la misma forma sería un error
           esperando a que alguien lo note. */
        var faltan=(fv?2:0)+(fh?1:0);
        function listo(){ if(--faltan<=0){ cierra(); cb(res); } }
        try{
          if(fv) fv.aBlob(OUT_V,function(x){ res.vBlob=x; listo(); });
          if(fv) fv.aBlob(OUT_T,function(x){ res.tBlob=x; listo(); });
          if(fh) fh.aBlob(OUT_H,function(x){ res.hBlob=x; listo(); });
        }catch(err){
          b.disabled=false; b.textContent='Guardar';
          alert('Esta foto no deja recortarse (permiso de la imagen). Prueba con «Cambiar foto».');
        }
      };
    };

    img.onerror=function(){
      /* Una foto ya subida puede fallar por CORS. Se reintenta sin crossOrigin:
         se verá, aunque el canvas no la pueda exportar, y ahí sí avisamos. */
      if(!esArchivo && !img.__otra){
        img.__otra=1; img.crossOrigin=null;
        img.src=fuente+((fuente.indexOf('?')<0?'?':'&')+'r='+Date.now());
        return;
      }
      alert('No se pudo abrir la imagen.');
      if(esArchivo) URL.revokeObjectURL(url);
    };
    img.src=url;
  }

  /* Recorta y sube. cfg: {sb, key, token, bucket, ruta, only, titulo}
     'ruta' es la carpeta destino sin barra final. Devuelve cb(err,{vUrl,hUrl,...}). */
  /* Sube los dos recortes a Storage. Es la segunda mitad de subir(), suelta
     aparte porque limpiaBordes() hace lo mismo sin pasar por el recortador. */
  function subeBlobs(r, cfg, cb){
    var base=(cfg.sb||'')+'/storage/v1/object/'+(cfg.bucket||'sincretico')+'/';
    var pub =(cfg.sb||'')+'/storage/v1/object/public/'+(cfg.bucket||'sincretico')+'/';
    var sello=Date.now();
    var out={srcW:r.srcW||null, srcH:r.srcH||null}, fallo=null;

    function pon(blob,nombre,claveUrl,clavePath,next){
      if(!blob){next();return;}
      var ruta=(cfg.ruta||'suelto').replace(/\/+$/,'')+'/'+sello+'-'+nombre;
      fetch(base+ruta,{method:'POST',headers:{
        'apikey':cfg.key,'Authorization':'Bearer '+(cfg.token||cfg.key),'Content-Type':'image/jpeg'
      },body:blob}).then(function(res){
        if(!res.ok)return res.text().then(function(t){throw new Error(t.slice(0,140)||('http '+res.status));});
        out[claveUrl]=pub+ruta; out[clavePath]=ruta; next();
      }).catch(function(e){ fallo=e; next(); });
    }

    var pasos=[];
    if(r.vBlob)pasos.push(function(n){pon(r.vBlob,r.vName||'foto_v.jpg','vUrl','vPath',n);});
    if(r.tBlob)pasos.push(function(n){pon(r.tBlob,r.tName||'foto_t.jpg','tUrl','tPath',n);});
    if(r.hBlob)pasos.push(function(n){pon(r.hBlob,r.hName||'foto_h.jpg','hUrl','hPath',n);});
    (function corre(i){
      if(i>=pasos.length){ cb(fallo, fallo?null:out); return; }
      pasos[i](function(){ corre(i+1); });
    })(0);
  }

  function subir(fuente, cfg, cb){
    open(fuente, {only:cfg.only, titulo:cfg.titulo}, function(r){ subeBlobs(r, cfg, cb); });
  }

  /* ---------- quitar bordes sin preguntar nada ----------
     Javi, 26-oct-2026: «ponle el botón». Setenta y una fotos ya publicadas
     llevan franjas de fondo de cuando el recortador las guardaba enteras, y
     pasarlas una a una por el ⤢ es media tarde. Esto hace lo mismo que haría
     una persona que abre el recortador, desmarca la casilla y le da a guardar:
     le quita las franjas viejas, llena el marco centrado y sube las dos
     versiones. Sin pop-up y sin decisiones, porque no hay ninguna que tomar.

     Devuelve cb(err, res):
       res.sinBordes = true  -> la foto no tenía franjas y no se tocó nada
       res.vUrl/.hUrl        -> las versiones nuevas, ya subidas */
  function limpiaBordes(url, cfg, cb){
    var img=new Image();
    img.crossOrigin='anonymous';
    img.onerror=function(){ cb(new Error('no se pudo abrir la foto'), null); };
    img.onload=function(){
      var recorte=sinBordes(img);
      if(!recorte){ cb(null,{sinBordes:true}); return; }   /* ya estaba limpia */
      var limpia=new Image();
      limpia.onload=function(){
        /* Centrado y llenando: exactamente el modo «cubre» del recortador. */
        function corta(out,asp,cb2){
          var nw=limpia.naturalWidth, nh=limpia.naturalHeight;
          var e=Math.max(out.w/nw, out.h/nh);
          var sw=out.w/e, sh=out.h/e;
          var sx=(nw-sw)/2, sy=(nh-sh)/2;
          var cv=document.createElement('canvas'); cv.width=out.w; cv.height=out.h;
          var ctx=cv.getContext('2d');
          ctx.fillStyle=FONDO; ctx.fillRect(0,0,out.w,out.h);
          ctx.drawImage(limpia, sx,sy,sw,sh, 0,0,out.w,out.h);
          cv.toBlob(function(b){ cb2(b); },'image/jpeg',0.9);
        }
        var nm=(url.split('/').pop()||'foto').split('?')[0];
        var raiz=nm.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_')
                   .replace(/^\d+-/,'').replace(/_[vh]$/,'').slice(0,48)||'foto';
        corta(OUT_V,VASP,function(vb){
          corta(OUT_T,VASP,function(tb){
            corta(OUT_H,HASP,function(hb){
              subeBlobs({vBlob:vb,vName:raiz+'_v.jpg',
                         tBlob:tb,tName:raiz+'_t.jpg',
                         hBlob:hb,hName:raiz+'_h.jpg'},cfg,cb);
            });
          });
        });
      };
      limpia.onerror=function(){ cb(new Error('no se pudo rehacer la foto'), null); };
      limpia.src=recorte;
    };
    img.src=url+((url.indexOf('?')<0?'?':'&')+'r='+Date.now());
  }

  window.sincCrop={open:open, subir:subir, limpiaBordes:limpiaBordes};
})();
