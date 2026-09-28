/* Sincrético · el idioma del huésped
 * ---------------------------------------------------------------------------
 * Dos cosas, y nada más:
 *
 *   sincI18n.idioma()                   -> 'es' | 'en' | ...
 *   sincI18n.pon('en')                  -> lo fija y lo recuerda
 *   await sincI18n.aplica(tabla, filas) -> reescribe los textos de esas filas
 *
 * La idea: NO hay dos catálogos. La base sigue guardando el español, y las
 * traducciones viven aparte en la tabla i18n. La pantalla carga como siempre
 * -sinc_catalogo, la ficha, lo que sea- y luego, en una sola llamada, se le
 * pisan encima los textos del idioma del huésped. Si esa llamada falla, o si
 * a un campo le falta la traducción, lo que se ve es el español: nunca un
 * hueco. Por eso `aplica` no lanza nunca.
 *
 * Y por eso también añadir francés o alemán no toca una línea de esto: se
 * activa el idioma en i18n_idiomas, corre la función que traduce, y ya.
 *
 * Los nombres propios, las direcciones y los horarios no pasan por aquí: una
 * dirección traducida deja de servir para llegar (ver i18n_campos).
 */
(function(){
  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';
  var LLAVE = 'sinc_idioma';

  /* Lo que hay traducido hoy. Se comprueba contra esto para no pedirle a la
     base un idioma que no existe todavía. */
  var VIVOS = ['es','en'];

  var ELEGIDO = null;

  function guardado(){
    try{ var s=localStorage.getItem(LLAVE); return VIVOS.indexOf(s)>=0?s:null; }catch(_){ return null; }
  }

  /* El navegador dice 'en-GB', 'pt-BR', 'zh-Hans-CN'... solo interesa el
     primer trozo.
     Lo importante es lo que se hace con un idioma que todavía no tenemos: un
     holandés o un japonés lee inglés mucho mejor que español, así que cae a
     inglés, no a español. Solo el navegador en español pide español. Al
     principio esto caía a español y un huésped de Ámsterdam veía la pantalla
     entera en un idioma que no habla. */
  function delNavegador(){
    var l = [];
    try{ l = (navigator.languages||[navigator.language||'']).slice(); }catch(_){ l=['']; }
    for(var i=0;i<l.length;i++){
      var c = String(l[i]||'').toLowerCase().split('-')[0];
      if(!c) continue;
      if(VIVOS.indexOf(c)>=0) return c;
      /* Idioma que no tenemos: inglés, que es la lengua franca del viaje. */
      return VIVOS.indexOf('en')>=0 ? 'en' : null;
    }
    return null;
  }

  function resuelve(){
    if(ELEGIDO) return ELEGIDO;
    /* Una URL con ?lang= manda sobre todo: así el concierge puede pasarle al
       huésped un enlace ya en su idioma. */
    try{
      var p = new URLSearchParams(location.search).get('lang');
      if(p){ p=String(p).toLowerCase().split('-')[0];
             if(VIVOS.indexOf(p)>=0){ ELEGIDO=p; recuerda(p); return p; } }
    }catch(_){}
    ELEGIDO = guardado() || delNavegador() || 'es';
    return ELEGIDO;
  }

  function recuerda(l){ try{ localStorage.setItem(LLAVE,l); }catch(_){} }

  function pon(l){
    l = String(l||'').toLowerCase().split('-')[0];
    if(VIVOS.indexOf(l)<0) return resuelve();
    ELEGIDO = l; recuerda(l);
    try{ document.documentElement.lang = l; }catch(_){}
    return l;
  }

  /* Reescribe en sitio los textos de `filas` (array de objetos con .id, o la
     clave que se le diga). Una sola llamada para todas las filas de la
     pantalla, no una por tarjeta. */
  async function aplica(tabla, filas, opc){
    opc = opc || {};
    var idi = opc.idioma || resuelve();
    if(idi==='es' || !filas || !filas.length) return filas;
    var clave = opc.clave || 'id';

    var ids = [];
    for(var i=0;i<filas.length;i++){
      var v = filas[i] && filas[i][clave];
      if(v!=null && ids.indexOf(String(v))<0) ids.push(String(v));
    }
    if(!ids.length) return filas;

    var t;
    try{
      var r = await fetch(SB+'/rest/v1/rpc/i18n_textos',{
        method:'POST',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_tabla:tabla,p_ids:ids,p_idioma:idi})
      });
      if(!r.ok) return filas;          /* se queda el español, que es correcto */
      t = await r.json();
    }catch(_){ return filas; }
    if(!t || !t.length) return filas;

    /* fila_id -> { campo: texto } */
    var mapa = {};
    for(var k=0;k<t.length;k++){
      var f=t[k]; if(!f||!f.texto) continue;
      (mapa[f.fila_id] = mapa[f.fila_id] || {})[f.campo] = f.texto;
    }

    for(var j=0;j<filas.length;j++){
      var fila = filas[j], id = fila && fila[clave];
      var tr = id!=null ? mapa[String(id)] : null;
      if(!tr) continue;
      for(var campo in tr){
        if(!Object.prototype.hasOwnProperty.call(tr,campo)) continue;
        /* La pantalla no siempre llama al campo como la tabla: el escaparate
           sirve la promo pegada a la experiencia y la llama promo_etiqueta.
           `campos` traduce ese nombre. */
        var destino = (opc.campos && opc.campos[campo]) || campo;
        /* Solo se pisa lo que la fila ya traía: si la pantalla no muestra ese
           campo, no se le inventa uno. Y se guarda el español al lado, por si
           alguien quiere enseñar el original. */
        if(fila[destino]===undefined) continue;
        if(fila.__es===undefined) fila.__es={};
        fila.__es[destino]=fila[destino];
        fila[destino]=tr[campo];
      }
      fila.__idioma=idi;
    }
    return filas;
  }

  /* Azúcar para una sola ficha. */
  async function aplicaUna(tabla, fila, opc){
    if(!fila) return fila;
    await aplica(tabla,[fila],opc);
    return fila;
  }

  /* El conmutador. Lo pinta el propio ayudante para que no haya tres copias
     del mismo botón en tres pantallas. Cambiar de idioma recarga: es una vez
     por visita, y recargar es más honesto que repintar media pantalla y
     dejarse un texto sin cambiar. */
  var CSS = '.sincIdi{display:inline-flex;gap:0;border:1.5px solid rgba(255,255,255,.35);'
    + 'border-radius:999px;overflow:hidden;flex:none}'
    + '.sincIdi button{font-family:Oswald,system-ui,sans-serif;font-weight:600;font-size:11px;'
    + 'letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border:0;cursor:pointer;'
    + 'background:transparent;color:inherit;opacity:.65;line-height:1.6}'
    + '.sincIdi button.on{background:#F2682A;color:#fff;opacity:1}'
    + '.sincIdi.claro{border-color:#E6DFD6}'
    + '.sincIdi.claro button{color:#6E665C}';

  function conmutador(donde){
    var el = typeof donde === 'string' ? document.getElementById(donde) : donde;
    if(!el) return;
    if(!document.getElementById('sincIdiCss')){
      var st=document.createElement('style'); st.id='sincIdiCss'; st.textContent=CSS;
      document.head.appendChild(st);
    }
    var hoy = resuelve();
    el.className = 'sincIdi' + (el.getAttribute('data-claro')!=null ? ' claro' : '');
    el.innerHTML = '';
    VIVOS.forEach(function(l){
      var b=document.createElement('button');
      b.type='button'; b.textContent=l.toUpperCase();
      b.setAttribute('lang',l);
      b.setAttribute('aria-label', l==='es'?'Español':'English');
      if(l===hoy) b.className='on';
      b.onclick=function(){
        if(l===resuelve()) return;
        pon(l);
        /* Se conserva todo lo que traía la URL -la reserva, el código del
           hotel- y solo se fija el idioma. */
        try{
          var u=new URL(location.href); u.searchParams.set('lang',l);
          location.replace(u.toString());
        }catch(_){ location.reload(); }
      };
      el.appendChild(b);
    });
  }

  /* Se apunta qué idioma pide el navegador del huésped -solo el código, un
     contador agregado, ni quién ni cuándo- para que dentro de unos meses el
     tercer idioma se elija con datos y no a ojo. Si falla, da igual: esto no
     puede romper una pantalla. */
  var APUNTADO = false;
  function apunta(pantalla){
    if(APUNTADO) return; APUNTADO = true;
    var crudo = '';
    try{ crudo = (navigator.languages && navigator.languages[0]) || navigator.language || ''; }catch(_){}
    if(!crudo) return;
    try{
      fetch(SB+'/rest/v1/rpc/i18n_apunta_navegador',{
        method:'POST', keepalive:true,
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_idioma:String(crudo),p_pantalla:pantalla||'otra'})
      }).catch(function(){});
    }catch(_){}
  }

  window.sincI18n = {
    idioma: resuelve,
    pon: pon,
    vivos: function(){ return VIVOS.slice(); },
    aplica: aplica,
    aplicaUna: aplicaUna,
    conmutador: conmutador,
    apunta: apunta,
    /* Para que el <html lang> diga la verdad desde el primer pintado. */
    marca: function(){ try{ document.documentElement.lang = resuelve(); }catch(_){} }
  };
  window.sincI18n.marca();
})();
