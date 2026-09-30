/* cp-menu2.js — el menú de tres niveles, al estilo del de Supabase.
 *
 * EL PROBLEMA QUE RESUELVE. El menú de siempre es plano: un acordeón de áreas
 * con todas las pantallas dentro. Con cien pantallas ya no cabe, y cuando una
 * de ellas te lleva a otra -de Productoras a la ficha de un evento- te quedas
 * sin saber de dónde venías ni cómo volver.
 *
 * LA FORMA, tal como la dictó Javi (30-sep):
 *   1. CATEGORÍA (riel de la izquierda). No abre nada: despliega.
 *   2. SUBCATEGORÍA (columna de al lado). Sí abre. Y puede hacer dos cosas:
 *      A) si tiene hijos, abre un tablero de cuadritos con ellos, y al elegir
 *         uno se abre la pantalla final: la columna pasa a ser la de ese grupo
 *         y la categoría se encoge a un riel de iconos;
 *      B) si no tiene hijos, abre su pantalla directamente, con las dos
 *         columnas encogidas.
 *   3. LA PANTALLA puede tener su propio menú horizontal arriba; eso es cosa
 *      suya, aquí no se toca.
 * Las dos columnas se pliegan y despliegan siempre igual y en el mismo sitio,
 * y cada rama tiñe el activo con su color (contabilidad usa el de socios).
 *
 * CÓMO SE USA. index.html lo llama cuando el interruptor «Nuevo menú» está
 * encendido:
 *     cpMenu2.montar({
 *       nodos,          // filas de `paginas` (codigo, nombre, ruta, icono,
 *                       // color, parent_codigo, orden, tipo)
 *       puedeVer,       // function(codigo) -> bool
 *       abrir,          // function(ruta, titulo, migaja)
 *       caja            // dónde se monta (el <aside> de siempre)
 *     });
 * No sabe de Supabase ni de permisos: los datos y el criterio se los dan.
 */
(function () {
  'use strict';

  var COLORES = {
    socios:      { fuerte:'#C9A227', suave:'#FBF4DC' },
    operacion:   { fuerte:'#1d9e75', suave:'#E3F3EC' },
    experiencias:{ fuerte:'#F2682A', suave:'#FDE7DC' },
    ateneo:      { fuerte:'#7A4FBF', suave:'#EEE6FA' },
    revenue:     { fuerte:'#1F6FB2', suave:'#E2EEF8' },
    espiritu:    { fuerte:'#E2188E', suave:'#FBDCEE' },
    rh:          { fuerte:'#8C6212', suave:'#F6EBD5' },
    briefing:    { fuerte:'#3C3630', suave:'#EDEAE4' }
  };
  function tono(c){ return COLORES[c] || COLORES.operacion; }

  var CSS = [
    '.m2{display:flex;height:100%;min-height:0;background:var(--bg2,#f7f6f1)}',
    '.m2 *{box-sizing:border-box}',
    /* --- el riel de categorías --- */
    '.m2-cat{flex:0 0 auto;width:210px;border-right:1px solid var(--bd,rgba(0,0,0,.1));',
    '  overflow-y:auto;padding:10px 8px;transition:width .16s ease;background:var(--bg2,#f7f6f1)}',
    '.m2.catmin .m2-cat{width:56px;padding:10px 4px}',
    '.m2-cat .it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;',
    '  cursor:pointer;color:var(--txt2,#5f5e5a);font-size:13.5px;line-height:1.2;white-space:nowrap}',
    '.m2-cat .it .ic{flex:0 0 22px;text-align:center;font-size:17px}',
    '.m2-cat .it .tx{overflow:hidden;text-overflow:ellipsis}',
    '.m2.catmin .m2-cat .it .tx{display:none}',
    '.m2-cat .it:hover{background:var(--bg3,#f1efe8)}',
    '.m2-cat .it.on{background:var(--m2suave);color:var(--m2fuerte);font-weight:600}',
    /* --- la columna de subcategorías --- */
    '.m2-sub{flex:0 0 auto;width:212px;border-right:1px solid var(--bd,rgba(0,0,0,.1));',
    '  overflow-y:auto;padding:10px 8px;background:#fff;transition:width .16s ease}',
    '.m2.submin .m2-sub{width:0;padding:0;overflow:hidden;border-right:0}',
    '.m2-sub .tit{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3,#888780);',
    '  padding:4px 10px 8px;display:flex;align-items:center;gap:6px}',
    '.m2-sub .it{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;cursor:pointer;',
    '  color:var(--txt,#2c2c2a);font-size:13.5px;line-height:1.25}',
    '.m2-sub .it:hover{background:var(--bg3,#f1efe8)}',
    '.m2-sub .it.on{background:var(--m2suave);color:var(--m2fuerte);font-weight:600}',
    '.m2-sub .it.pend{color:var(--txt3,#888780);cursor:default;opacity:.7}',
    '.m2-sub .it.pend:after{content:"pendiente";margin-left:auto;font-size:9.5px;letter-spacing:.06em;',
    '  text-transform:uppercase;border:1px solid currentColor;border-radius:99px;padding:1px 5px;opacity:.8}',
    '.m2-sub .it .ic{flex:0 0 20px;text-align:center}',
    '.m2-sub .atras{display:flex;align-items:center;gap:7px;padding:6px 10px;margin-bottom:4px;cursor:pointer;',
    '  color:var(--txt2,#5f5e5a);font-size:12.5px;border-radius:8px}',
    '.m2-sub .atras:hover{background:var(--bg3,#f1efe8)}',
    /* --- los tiradores, siempre en el mismo sitio --- */
    '.m2-tira{position:absolute;bottom:10px;left:10px;display:flex;gap:6px;z-index:3}',
    '.m2-tira button{border:1px solid var(--bd,rgba(0,0,0,.12));background:#fff;color:var(--txt2,#5f5e5a);',
    '  width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:13px;line-height:1}',
    '.m2-tira button:hover{background:var(--bg3,#f1efe8)}',
    '.m2{position:relative}'
  ].join('');

  var D = null;          // datos y ganchos
  var hijos = {};        // codigo -> [nodos]
  var porCod = {};
  var estado = { cat:null, rama:null, activa:null, catmin:false, submin:false };

  function esVisible(n){
    if (n.tipo === 'contenedor') return (hijos[n.codigo]||[]).some(esVisible);
    if (n.tipo === 'pendiente') return D.puedeVer(n.codigo) || D.verPendientes;
    return D.puedeVer(n.codigo);
  }
  function hijosVisibles(cod){
    return (hijos[cod]||[]).filter(esVisible).sort(function(a,b){ return (a.orden||99)-(b.orden||99); });
  }
  function color(n){
    var c=n; var v=0;
    while(c && !c.color && v++<6) c = porCod[c.parent_codigo];
    return tono(c && c.color);
  }
  function el(t,cl,html){ var e=document.createElement(t); if(cl)e.className=cl; if(html!=null)e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  /* El nombre suele venir con su emoji delante; se separa para que el icono
     viva en su columna y el texto no lo arrastre. */
  function parte(n){
    var m = String(n.nombre||'').match(/^\s*([\p{Extended_Pictographic}←-⇿☀-➿][️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    return { ic: n.icono || (m ? m[1] : '•'), tx: m ? m[2] : String(n.nombre||'') };
  }

  function pinta(){
    var caja = D.caja;
    caja.innerHTML = '';
    var raiz = el('div','m2'+(estado.catmin?' catmin':'')+(estado.submin?' submin':''));
    var t = color(porCod[estado.cat] || {});
    raiz.style.setProperty('--m2fuerte', t.fuerte);
    raiz.style.setProperty('--m2suave', t.suave);

    /* 1 · las categorías */
    var cat = el('nav','m2-cat');
    hijosVisibles(null).forEach(function(n){
      var p = parte(n);
      var it = el('div','it'+(n.codigo===estado.cat?' on':''),
        '<span class="ic">'+esc(p.ic)+'</span><span class="tx">'+esc(p.tx)+'</span>');
      it.title = p.tx;
      it.onclick = function(){
        estado.cat = n.codigo; estado.rama = n.codigo; estado.submin = false;
        estado.catmin = false; pinta();
      };
      cat.appendChild(it);
    });
    raiz.appendChild(cat);

    /* 2 · la columna de la rama abierta */
    var sub = el('nav','m2-sub');
    var nodoRama = porCod[estado.rama];
    if (nodoRama) {
      var padre = porCod[nodoRama.parent_codigo];
      if (padre) {
        var atras = el('div','atras','← '+esc(parte(padre).tx));
        atras.onclick = function(){ estado.rama = padre.codigo; pinta(); };
        sub.appendChild(atras);
      }
      sub.appendChild(el('div','tit', esc(parte(nodoRama).tx)));
      hijosVisibles(nodoRama.codigo).forEach(function(n){
        var p = parte(n);
        var tieneHijos = hijosVisibles(n.codigo).length > 0;
        var pend = (n.tipo === 'pendiente') || (!n.ruta && !tieneHijos);
        var it = el('div','it'+(n.codigo===estado.activa?' on':'')+(pend?' pend':''),
          '<span class="ic">'+esc(p.ic)+'</span><span>'+esc(p.tx)+(tieneHijos?' ›':'')+'</span>');
        if (!pend) it.onclick = function(){ elige(n); };
        sub.appendChild(it);
      });
    }
    raiz.appendChild(sub);

    /* 3 · los tiradores: mismo sitio, siempre */
    var tira = el('div','m2-tira');
    var b1 = el('button', null, estado.catmin ? '»' : '«');
    b1.title = estado.catmin ? 'Mostrar categorías' : 'Encoger categorías';
    b1.onclick = function(){ estado.catmin = !estado.catmin; pinta(); };
    var b2 = el('button', null, estado.submin ? '▸' : '◂');
    b2.title = estado.submin ? 'Mostrar el submenú' : 'Ocultar el submenú';
    b2.onclick = function(){ estado.submin = !estado.submin; pinta(); };
    tira.appendChild(b1); tira.appendChild(b2);
    raiz.appendChild(tira);

    caja.appendChild(raiz);
  }

  /* Qué pasa al elegir algo de la columna. */
  function elige(n){
    var conHijos = hijosVisibles(n.codigo);
    if (conHijos.length) {
      /* A) grupo: tablero de cuadritos, y la columna baja un escalón */
      estado.rama = n.codigo; estado.activa = null;
      estado.catmin = true;
      D.abrir('/m/hub.html?nodo=' + encodeURIComponent(n.codigo), parte(n).tx, migaja(n));
      pinta();
      return;
    }
    /* B) pantalla: se abre, y las dos columnas se encogen */
    if (!n.ruta) return;
    estado.activa = n.codigo; estado.catmin = true;
    D.abrir(n.ruta, parte(n).tx, migaja(n));
    pinta();
  }
  function migaja(n){
    var p=[], c=porCod[n.parent_codigo], v=0;
    while(c && v++<6){ p.unshift(parte(c).tx); c=porCod[c.parent_codigo]; }
    return p.join(' · ');
  }

  /* Abrir por código desde fuera (el tablero de cuadritos avisa por postMessage
     cuando el huésped del panel pincha un cuadrito). */
  function abreCodigo(cod){
    var n = porCod[cod]; if (!n) return false;
    estado.cat = raizDe(n); estado.rama = n.parent_codigo || estado.cat;
    elige(n); return true;
  }
  function raizDe(n){ var c=n,v=0; while(c && c.parent_codigo && v++<6) c=porCod[c.parent_codigo]; return c?c.codigo:null; }

  function montar(op){
    D = op;
    porCod = {}; hijos = {};
    (op.nodos||[]).forEach(function(n){ porCod[n.codigo]=n; });
    (op.nodos||[]).forEach(function(n){
      var k = porCod[n.parent_codigo] ? n.parent_codigo : null;
      (hijos[k] = hijos[k] || []).push(n);
    });
    if (!document.getElementById('cpMenu2css')) {
      var st = document.createElement('style'); st.id='cpMenu2css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var prim = hijosVisibles(null)[0];
    estado.cat = estado.rama = prim ? prim.codigo : null;
    estado.activa = null; estado.catmin = false; estado.submin = false;
    pinta();
    window.addEventListener('message', function(ev){
      if (ev && ev.data && ev.data.tipo === 'cp-menu2-abre' && ev.data.codigo) abreCodigo(ev.data.codigo);
    });
  }

  window.cpMenu2 = { montar: montar, abreCodigo: abreCodigo };
})();
