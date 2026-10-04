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
    /* La barra lateral sigue siendo la barra lateral: arriba el logo y el
       selector de propiedad -que antes se borraban al montar el menu nuevo, y
       Javi se quedaba sin poder cambiar de hotel-, y debajo el menu. */
    '.m2wrap{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg2,#f7f6f1)}',
    '.m2head{flex:0 0 auto;padding:1rem .75rem 0}',
    '.m2head .projsel{margin:.55rem 0 .7rem}',   /* por si vuelve al aside */
    '.m2{display:flex;flex:1 1 auto;min-height:0;background:var(--bg2,#f7f6f1);position:relative}',
    '.m2 *{box-sizing:border-box}',
    /* --- el riel de categorías --- */
    '.m2-cat{flex:0 0 auto;width:210px;border-right:1px solid var(--bd,rgba(0,0,0,.1));',
    '  overflow-y:auto;padding:10px 8px;transition:width .16s ease;background:var(--bg2,#f7f6f1)}',
    '.m2.catmin .m2-cat{width:56px;padding:10px 4px}',
    '.m2-cat .it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;',
    '  cursor:pointer;color:var(--txt2,#5f5e5a);font-size:13.5px;line-height:1.2;white-space:nowrap}',
    '.m2-cat .it .ic{flex:0 0 22px;text-align:center;font-size:17px}',
    '.m2-cat .it .tx{overflow:hidden;text-overflow:ellipsis}',
    '.m2 .it.off{opacity:.38;cursor:default}',
    '.m2 .it.off:hover{background:transparent}',
    '.m2 .it .cand{margin-left:auto;font-size:11px;opacity:.75}',
    '.m2.catmin .m2-cat .it .tx{display:none}',
    '.m2-cat .it:hover{background:var(--bg3,#f1efe8)}',
    '.m2-cat .it.on{background:var(--m2suave);color:var(--m2fuerte);font-weight:600}',
    '.m2-cat .it.salir{margin-top:14px;border-top:1px solid var(--bd,rgba(0,0,0,.1));',
    '  border-radius:0;padding-top:12px;color:var(--txt3,#888780);font-size:12.5px}',
    /* Encogido a iconos, nadie se acuerda de qué es cada uno. Al pasar el
       ratón el riel se abre entero, y lo hace FLOTANDO encima: si empujara la
       pantalla, el contenido bailaría cada vez que pasas por encima sin
       querer. Javi, 1-oct. */
    '.m2.catmin .m2-cat:hover{position:absolute;left:0;top:0;bottom:0;width:210px;padding:10px 8px;',
    '  z-index:40;box-shadow:6px 0 24px -10px rgba(30,26,22,.45)}',
    '.m2.catmin .m2-cat:hover .it .tx{display:inline}',
    '@media (hover:none){ .m2.catmin .m2-cat:hover{position:static;width:56px;padding:10px 4px;box-shadow:none}',
    '  .m2.catmin .m2-cat:hover .it .tx{display:none} }',
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
    /* Una subcategoría con cosas dentro ya no se lleva la columna entera: se
       abre aquí mismo y empuja hacia abajo a sus hermanas, para que todo se
       alcance sin perder de vista dónde estás. Javi, 3-oct. */
    '.m2-sub .it .fl{margin-left:auto;opacity:.45;font-size:11px;transition:transform .15s ease}',
    '.m2-sub .it.abierto{color:var(--m2fuerte);font-weight:600}',
    '.m2-sub .it.abierto .fl{transform:rotate(90deg);opacity:.85}',
    '.m2-sub .nido{margin:1px 0 5px 15px;padding-left:9px;',
    '  border-left:1px solid var(--bd,rgba(0,0,0,.13))}',
    '.m2-sub .nido .it{font-size:13px;padding:7px 9px}',
    '.m2-sub .atras{display:flex;align-items:center;gap:7px;padding:6px 10px;margin-bottom:4px;cursor:pointer;',
    '  color:var(--txt2,#5f5e5a);font-size:12.5px;border-radius:8px}',
    '.m2-sub .atras:hover{background:var(--bg3,#f1efe8)}',
    /* --- los tiradores, siempre en el mismo sitio --- */
    '.m2-tira{position:absolute;bottom:10px;left:10px;display:flex;gap:6px;z-index:3}',
    '.m2-tira button{border:1px solid var(--bd,rgba(0,0,0,.12));background:#fff;color:var(--txt2,#5f5e5a);',
    '  width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:13px;line-height:1}',
    '.m2-tira button:hover{background:var(--bg3,#f1efe8)}',
    '.m2{position:relative}',
    /* --- en el telefono la barra mide 248 px: las dos columnas juntas (422)
       no caben y la segunda se quedaba fuera de la pantalla, que es por lo que
       "no funcionaba". Aqui se ve una columna a la vez, como en Supabase. --- */
    '@media(max-width:760px){',
    '  .m2.movil .m2-cat,.m2.movil .m2-sub{width:100%;border-right:0;padding:10px 8px}',
    '  .m2.movil .m2-cat .it .tx{display:inline}',
    '  .m2.movil .m2-tira{display:none}',
    '  .m2.movil .m2-sub .atras{background:var(--bg3,#f1efe8);font-weight:600}',
    '}'
  ].join('');

  var D = null;          // datos y ganchos
  var hijos = {};        // codigo -> [nodos]
  var porCod = {};
  var estado = { cat:null, rama:null, activa:null, catmin:false, submin:false, vista:'cat',
               abiertos:{} };   // qué cajones de la columna están desplegados
  var cabecera = null;   // logo + selector de propiedad, prestados del <aside>
  var MQ = (window.matchMedia ? window.matchMedia('(max-width:760px)') : null);
  function esMovil(){ return !!(MQ && MQ.matches); }

  /* El archivo, sin la pestaña: '/m/pedidos.html?tab=aprobar' -> '/m/pedidos.html' */
  function archivo(r){ return String(r||'').split('#')[0].split('?')[0]; }
  /* 'Aprobar pedidos' es la pestaña de dentro de Pedidos, no una pantalla
     aparte: si apunta al mismo archivo que su padre, vive en Accesos (para dar
     el permiso) pero no ocupa un renglón del menú. Lo mismo con las pestañas de
     Desayunos y con los Horarios de voluntarios dentro de Horarios.
     PERO un hijo que añade un #ancla o una ?pestaña NO es un duplicado: es un
     sitio concreto dentro de una pantalla larga, y es justo para lo que sirve
     el menú. Esta regla se estaba comiendo Resultados, Ventas y Deuda dentro
     de Reporte de Resultados, y Socios se quedaba sin nada que enseñar.
     Javi, 1-oct: "en socios falta Resultados". */
  function esPestana(n){
    var p = porCod[n.parent_codigo];
    if (!(p && p.ruta && n.ruta)) return false;
    if (archivo(p.ruta) !== archivo(n.ruta)) return false;
    var dentro = function(r){ var i=String(r||'').search(/[#?]/); return i<0 ? '' : String(r).slice(i); };
    return dentro(p.ruta) === dentro(n.ruta);
  }
  /* APAGADO, NO ESCONDIDO. Javi, 4-oct-2026: «lo que sí podrían ver es el menú
     general pero apagado, para que vean qué hay creado pero no tienen acceso».
     Esconder una pantalla hace que nadie sepa que existe y acaben pidiéndola
     por WhatsApp; dejarla en gris dice «esto existe, no es para ti» y de paso
     enseña lo que hay montado. El permiso de verdad no cambia: el renglón no
     abre nada y la pantalla sigue cerrada por su lado. */
  function apagado(n){
    return !!D.mostrarApagado && !D.puedeVer(n.codigo);
  }
  function esVisible(n){
    if (esPestana(n)) return false;
    if (n.tipo === 'contenedor') return (hijos[n.codigo]||[]).some(esVisible);
    if (n.tipo === 'pendiente') return D.puedeVer(n.codigo) || D.verPendientes;
    /* Un renglón sin ruta y sin nada dentro no abre nada: al tocarlo no pasa
       absolutamente nada, que es peor que no estar en el menú. Le pasaba a
       «Residencias», que se quedó cuando sus pantallas se apagaron. Mientras
       el menú era de seis probadores daba igual; ahora lo ve toda la casa.
       Javi, 1-oct. */
    if (!n.ruta && !(hijos[n.codigo]||[]).some(esVisible)) return false;
    return D.puedeVer(n.codigo) || apagado(n);
  }
  function hijosVisibles(cod){
    var ord = function(x){ return (x==null || x==='') ? 99 : Number(x); };
    return (hijos[cod]||[]).filter(esVisible).sort(function(a,b){ return ord(a.orden)-ord(b.orden); });
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
    var movil = esMovil();
    caja.innerHTML = '';
    var wrap = el('div','m2wrap');
    if (cabecera) wrap.appendChild(cabecera);
    var raiz = el('div','m2'+(movil?' movil':'')
                        +(!movil&&estado.catmin?' catmin':'')
                        +(!movil&&estado.submin?' submin':''));
    var t = color(porCod[estado.cat] || {});
    raiz.style.setProperty('--m2fuerte', t.fuerte);
    raiz.style.setProperty('--m2suave', t.suave);

    /* 1 · las categorías. En el teléfono sólo cuando toca verlas. */
    if (!movil || estado.vista === 'cat') {
      var cat = el('nav','m2-cat');
      hijosVisibles(null).forEach(function(n){
        var p = parte(n);
        var apg = apagado(n) && !hijosVisibles(n.codigo).some(function(h){ return D.puedeVer(h.codigo); });
        var it = el('div','it'+(n.codigo===estado.cat?' on':'')+(apg?' off':''),
          '<span class="ic">'+esc(p.ic)+'</span><span class="tx">'+esc(p.tx)+'</span>'
          +(apg?'<span class="cand">\u00b7</span>':'')
          +(movil?'<span style="margin-left:auto;opacity:.5">›</span>':''));
        it.title = apg ? (p.tx+' — no tienes acceso') : p.tx;
        it.onclick = function(){
          if (apg) return;
          estado.cat = n.codigo; estado.rama = n.codigo; estado.submin = false;
          estado.catmin = false; estado.vista = 'sub';
          estado.abiertos = {};   // otra área, cajones cerrados
          /* Y se abre lo que esa categoría es: su propia pantalla si la tiene,
             y si no el tablero de su grupo. Antes sólo desplegaba, y había que
             dar un segundo clic para que pasara algo. */
          var d = atajo(n), h = hijosVisibles(d.codigo);
          /* Si el atajo bajó a un grupo con cosas dentro, la columna se planta
             ahí. Si bajó hasta una pantalla suelta —un área de una sola página,
             como RH → Horarios—, la columna se queda en el área: plantarse en
             la pantalla dejaba la columna vacía. */
          if (d.codigo !== n.codigo && hijosVisibles(d.codigo).length) estado.rama = d.codigo;
          if (d.ruta) { estado.activa = d.codigo; D.abrir(d.ruta, parte(d).tx, migaja(d)); }
          else if (h.length) { estado.activa = null; D.abrir('/m/hub.html?nodo=' + encodeURIComponent(d.codigo), parte(d).tx, migaja(d)); }
          pinta();
        };
        cat.appendChild(it);
      });
      /* La puerta de salida, dentro del propio menú: el botón de la barra de
         arriba se pierde en el teléfono y quien probaba el menú nuevo se
         quedaba sin manera evidente de volver. */
      if (D.volverViejo) {
        var sal = el('div','it salir','<span class="ic">↩︎</span><span class="tx">Menú de siempre</span>');
        sal.title = 'Volver al menú de siempre';
        sal.onclick = function(){ D.volverViejo(); };
        cat.appendChild(sal);
      }
      raiz.appendChild(cat);
    }

    /* 2 · la columna de la rama abierta */
    if (!movil || estado.vista === 'sub') {
      var sub = el('nav','m2-sub');
      var nodoRama = porCod[estado.rama];
      if (nodoRama) {
        var padre = porCod[nodoRama.parent_codigo];
        if (padre) {
          var atras = el('div','atras','← '+esc(parte(padre).tx));
          atras.onclick = function(){ estado.rama = padre.codigo; pinta(); };
          sub.appendChild(atras);
        } else if (movil) {
          /* En el teléfono la raíz también necesita puerta de salida: si no,
             se entra a una categoría y ya no se puede volver a la lista. */
          var vuelve = el('div','atras','← '+esc(T_CATS));
          vuelve.onclick = function(){ estado.vista = 'cat'; pinta(); };
          sub.appendChild(vuelve);
        }
        sub.appendChild(el('div','tit', esc(parte(nodoRama).tx)));
        /* Se dibuja recursivamente: cada cajón abierto mete a sus hijos justo
           debajo, indentados, y las hermanas siguen ahí abajo. */
        (function renglones(cod, host){
          hijosVisibles(cod).forEach(function(n0){
            var d = atajo(n0);                       // un grupo de uno es esa cosa
            var p = parte(n0);                       // pero el nombre es el de arriba
            var dentro = hijosVisibles(d.codigo);
            var pend = (d.tipo === 'pendiente') || (!d.ruta && !dentro.length);
            var apg = apagado(n0) && !dentro.some(function(h){ return D.puedeVer(h.codigo); });
            var abierto = !!estado.abiertos[d.codigo];
            var it = el('div','it'+(d.codigo===estado.activa?' on':'')+(pend?' pend':'')
                               +(apg?' off':'')+(abierto?' abierto':''),
              '<span class="ic">'+esc(p.ic)+'</span><span>'+esc(p.tx)+'</span>'
              +(apg?'<span class="cand">\u00b7</span>':'')
              +(dentro.length?'<span class="fl">\u203A</span>':''));
            if (apg) it.title = p.tx+' — no tienes acceso';
            if (!pend && !apg) it.onclick = function(){ elige(n0); };
            host.appendChild(it);
            if (dentro.length && abierto){
              var nido = el('div','nido');
              renglones(d.codigo, nido);
              host.appendChild(nido);
            }
          });
        })(nodoRama.codigo, sub);
      }
      raiz.appendChild(sub);
    }

    /* 3 · los tiradores: mismo sitio, siempre (en el teléfono estorban) */
    if (!movil) {
      var tira = el('div','m2-tira');
      var b1 = el('button', null, estado.catmin ? '»' : '«');
      b1.title = estado.catmin ? 'Mostrar categorías' : 'Encoger categorías';
      b1.onclick = function(){ estado.catmin = !estado.catmin; pinta(); };
      var b2 = el('button', null, estado.submin ? '▸' : '◂');
      b2.title = estado.submin ? 'Mostrar el submenú' : 'Ocultar el submenú';
      b2.onclick = function(){ estado.submin = !estado.submin; pinta(); };
      tira.appendChild(b1); tira.appendChild(b2);
      raiz.appendChild(tira);
    }

    wrap.appendChild(raiz);
    caja.appendChild(wrap);
  }
  var T_CATS = 'Todas las áreas';

  /* Qué pasa al elegir algo de la columna. */
  /* Un grupo con UNA sola cosa dentro no es un grupo: es esa cosa con un paso
     de mas. Se baja hasta encontrar algo que de verdad se abra —una pantalla,
     o un grupo con varias—, y se abre eso. Javi, 1-oct: "si la categoría sólo
     tiene una subcategoría no la muestres, abre directamente la página". */
  function atajo(n){
    var v = 0;
    while (n && !n.ruta && v++ < 6) {
      var h = hijosVisibles(n.codigo);
      if (h.length !== 1) break;
      n = h[0];
    }
    return n;
  }

  function elige(n){
    n = atajo(n);
    var conHijos = hijosVisibles(n.codigo);
    /* Lo que tiene dentro se despliega AQUÍ, en su sitio, empujando abajo a las
       hermanas; la columna ya no baja un escalón ni se lleva por delante al
       resto. Y el centro enseña el tablero de ese cajón, para que desde la
       misma pantalla se alcance todo. Javi, 3-oct. */
    if (conHijos.length) {
      var yaEstaba = !!estado.abiertos[n.codigo];
      estado.abiertos[n.codigo] = !yaEstaba;
      if (!yaEstaba) {
        /* Al abrirlo se enseña lo suyo: su pantalla si la tiene, y si no el
           tablero con lo que lleva dentro. Al cerrarlo no se toca el centro:
           plegar un cajón no debería sacarte de donde estás leyendo. */
        if (n.ruta) { estado.activa = n.codigo; D.abrir(n.ruta, parte(n).tx, migaja(n)); }
        else { estado.activa = null; D.abrir('/m/hub.html?nodo=' + encodeURIComponent(n.codigo), parte(n).tx, migaja(n)); }
      }
      pinta();
      return;
    }
    if (n.ruta) {
      estado.activa = n.codigo;
      estado.catmin = !esMovil();
      D.abrir(n.ruta, parte(n).tx, migaja(n));
      pinta();
    }
  }
  /* Al entrar por fuera (un cuadrito del tablero, un enlace profundo) hay que
     dejar abiertos los cajones por los que se baja, o el renglón activo queda
     escondido dentro de uno cerrado. */
  function abreCadena(n){
    var c = porCod[n.parent_codigo], v = 0;
    while (c && v++ < 8 && c.codigo !== estado.rama) {
      estado.abiertos[c.codigo] = true;
      c = porCod[c.parent_codigo];
    }
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
    estado.cat = raizDe(n); estado.rama = estado.cat;
    estado.vista = 'sub'; abreCadena(n); elige(n); return true;
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
    /* El <aside> trae el logo recien pintado por index.html. Se toma prestado
       (no se clona: asi conserva sus manejadores) para que siga arriba del menu.
       El selector de ubicacion ya NO esta aqui: desde el 4-oct-2026 vive en el
       header, que es donde Javi queria verlo. La linea que lo buscaba se deja
       porque no estorba y porque si alguien lo devuelve al aside, se vuelve a
       tomar solo. */
    cabecera = null;
    var trozos = [];
    ['.brand','.projsel'].forEach(function(q){
      var e = op.caja.querySelector(q); if (e) trozos.push(e);
    });
    if (trozos.length) {
      /* Un <div> de verdad, no un fragmento: el fragmento se vacia al insertarlo
         y en el siguiente repintado la cabecera desaparecia. */
      cabecera = el('div','m2head');
      trozos.forEach(function(e){ cabecera.appendChild(e); });
    }

    /* Inicio = SOLO las categorías: la 2ª columna arranca cerrada. Al tocar una
       categoría se abre su tablero de subcategorías. Javi, 3-oct. */
    estado.cat = null; estado.rama = null;
    estado.activa = null; estado.catmin = false; estado.submin = true;
    estado.vista = 'cat';
    pinta();
    if (MQ && !MQ._cpm2) { MQ._cpm2 = true;
      var alGirar = function(){ if (D) pinta(); };
      if (MQ.addEventListener) MQ.addEventListener('change', alGirar);
      else if (MQ.addListener) MQ.addListener(alGirar);
    }
    window.addEventListener('message', function(ev){
      if (ev && ev.data && ev.data.tipo === 'cp-menu2-abre' && ev.data.codigo) abreCodigo(ev.data.codigo);
    });
  }

  window.cpMenu2 = { montar: montar, abreCodigo: abreCodigo };
})();
