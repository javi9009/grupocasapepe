/* SI LA MINIATURA NO ESTÁ, LA FOTO ENTERA. Javi, 27-oct-2026: «no se ve esta
   foto de este tour». mini() cambia _v.jpg por _t.jpg dando por hecho que la
   miniatura existe, y había 31 verticales que nunca la tuvieron: el navegador
   pedía un archivo que no está y dejaba el hueco roto, sin aviso ninguno.
   Desde la url no se puede saber si está, así que se corrige cuando falla: si
   una _t.jpg no carga, se pide la vertical, que siempre está. Cuesta una
   petición fallida y no cuesta ni un hueco. */
if(!window.__miniRespaldo){ window.__miniRespaldo=1;
  document.addEventListener('error',function(e){
    var t=e.target;
    if(!t||t.tagName!=='IMG'||!t.src||t.getAttribute('data-respaldo'))return;
    if(!/_t\.jpg($|\?|#)/i.test(t.src))return;
    t.setAttribute('data-respaldo','1');
    t.src=t.src.replace(/_t\.jpg/i,'_v.jpg');
  },true);
}

/* LA GALERÍA, UNA SOLA VEZ.
 *
 * Javi, 3-oct-2026: «ok a tener dos salidas, la de clientes en general y la de
 * clientes de un hotel, pero tenemos que unificar la información que sale desde
 * una bbdd y una estructura de presentar la info en las galerías. La que más me
 * gusta es la de la APePe: mantén esa estructura en la web».
 *
 * Así que esto es esa estructura, escrita una vez: filas horizontales por
 * CATEGORÍA, con el rótulo y su «Ver todas →», y fichas de 172px con los datos
 * que de verdad deciden —cuánto dura, en qué idioma, cuántos caben, qué cuesta
 * y qué impacto tiene—. Lo que cambia entre las dos salidas es qué filas trae
 * la base, no cómo se pintan.
 *
 * La fuente es una: sinc_escaparate(hotel, dias, ciudad, prueba). Devuelve
 * experiencias, eventos del Ateneo y pases de coworking con la MISMA forma de
 * fila y con su categoría y su tipo guardados (no adivinados). Con hotel, manda
 * el buffet que ese hotel escogió.
 *
 *   sincVitrina.monta('idDelDiv', {
 *     hotel:'barrio-hostel',   // o null para la salida de público general
 *     ciudad:'CDMX', dias:90, prueba:false,
 *     solo:['shows','ateneo'], // opcional: sólo esas filas
 *     calladoSiVacio:true,     // opcional: sin fila, sin hueco
 *     qs:'&app=1&resv=...',    // lo que haya que arrastrar en cada liga
 *     base:'/sinc/',           // opcional: delante de cada liga (fuera de /sinc/)
 *     verTodas:'todas.html'    // a dónde va el «Ver todas →» de cada fila
 *   })  ->  Promise<{filas, items}>
 */
window.sincVitrina = (function () {
  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  /* Idioma: si la pantalla cargó sinc-i18n.js, el escaparate traduce el
     contenido de la base y sus rótulos; si no, se queda en español (nunca
     un hueco). T() pasa un texto fijo por el diccionario; EN() dice si toca
     traducir; FE() da los nombres de día/mes del idioma vivo. */
  function T(s){ try{ return (window.sincI18n && sincI18n.t) ? sincI18n.t(s) : s; }catch(_){ return s; } }
  function EN(){ try{ return !!(window.sincI18n && sincI18n.idioma && sincI18n.idioma() !== 'es'); }catch(_){ return false; } }
  function FE(){ try{ if(window.sincI18n && sincI18n.fechas) return sincI18n.fechas(); }catch(_){} return null; }

  /* Los stickers se cuelgan de la carpeta de ESTE archivo, no de la raíz: el
     escaparate también se sirve por casapepe.mx/sincretico/, donde /img/ no
     existe. La regla /sinc/img/apepe/* de _redirects cierra el círculo. */
  var ST = (function () {
    try {
      var sc = document.currentScript && document.currentScript.src;
      if (sc) return sc.replace(/[^/]*$/, '') + 'img/apepe/stickers/';
    } catch (_) {}
    return '/img/apepe/stickers/';
  })();

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '';
    n = Number(n);
    return n === 0 ? T('Gratis') : '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }
  /* La miniatura está guardada al lado de cada vertical (_t.jpg): se cambia la
     letra en vez de pedírsela al redimensionador, que se cobra por imagen
     distinta al mes. Lo que no es un recorte nuestro se deja tal cual. */
  function mini(u, ancho) {
    if (!u || u.indexOf('/storage/v1/object/public/') < 0) return u;
    if (ancho <= 600 && /_v\.jpg$/i.test(u)) return u.replace(/_v\.jpg$/i, '_t.jpg');
    return u;
  }

  /* Sin foto no se pone un hueco gris ni una inicial gigante: se pone el
     sticker de la casa que le toque por el nombre. Dice de qué va y parece una
     decisión. (Mismo criterio que la portada de la APePe.) */
  var STICKERS = [
    [/teotihuac/i,'teotihuacan.webp'], [/globo/i,'globo.webp'],
    [/bike|bici/i,'frida-bicicleta-a.webp'], [/mariachi|noche mexicana/i,'bongos.webp'],
    [/malinche|iztacc|volc|nevado/i,'volcanes.webp'], [/tolantongo|temazcal|aguas/i,'temazcal.webp'],
    [/mezcal|margarita|pulque/i,'mezcal.webp'], [/molcajete|ma[ií]z|tortilla|cocina/i,'molcajete.webp'],
    [/food|mercado|comida|taco/i,'mercado.webp'], [/lucha|arena/i,'blue-demon-a.webp'],
    [/loter[ií]a|albur|slang|nahuatl|chingar/i,'carga-sorjuana-luchador.webp'],
    [/xochimilco|trajinera/i,'xochimilco.webp'], [/coyoac|frida/i,'frida.webp'],
    [/chapultepec|bosque|parque/i,'alameda.webp'], [/centro|z[óo]calo|catedral/i,'puerta-cdmx.webp'],
    [/roma|condesa/i,'condesa.webp'], [/cholula|puebla|atlixco/i,'cholula-puebla.webp'],
    [/guadalupe|villa/i,'villa-guadalupe.webp'], [/bellas artes|palacio/i,'bellas-artes.webp'],
    [/podcast|ensayo|coworking|day pass|semanal|escritor|literar/i,'fotografo.webp'],
    [/teatro|concierto|funci[óo]n/i,'bongos.webp']
  ];
  function stickerDe(n) {
    n = String(n || '');
    for (var i = 0; i < STICKERS.length; i++) if (STICKERS[i][0].test(n)) return STICKERS[i][1];
    return 'sello-cdmx.webp';
  }
  function tapa(nombre, portada) {
    return portada
      ? '<img src="' + esc(mini(portada, 420)) + '" alt="" loading="lazy">'
      : '<span class="ini"><img src="' + esc(ST + stickerDe(nombre)) + '" alt="" loading="lazy"></span>';
  }

  var DIAS  = ['dom','lun','mar','mié','jue','vie','sáb'];
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function deYmd(s) { var p = String(s).slice(0,10).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function cuando(f, h) {
    if (!f) return '';
    var d = deYmd(f), hoy = new Date(); hoy.setHours(0,0,0,0);
    var dif = Math.round((d - hoy) / 86400000);
    var hh = h ? ' ' + String(h).slice(0,5) : '';
    var fe = FE();
    var dias = (fe && fe.cortos) || DIAS, meses = (fe && fe.meses) || MESES;
    if (dif === 0) return T('Hoy') + hh;
    if (dif === 1) return T('Mañana') + hh;
    if (dif > 1 && dif < 7) return dias[d.getDay()] + ' ' + d.getDate() + hh;
    return d.getDate() + ' ' + meses[d.getMonth()] + hh;
  }
  function dur(m) {
    m = Number(m || 0); if (!m) return '';
    var h = Math.floor(m / 60), mm = m % 60;
    return '⏱ ' + (h ? h + ' h' : '') + (mm ? (h ? ' ' : '') + mm + ' min' : '');
  }

  /* ---------- el estilo, inyectado una vez ---------- */
  var CSS = ''
  /* EL TÍTULO MANDA EN SU SECCIÓN. Javi, 19-oct-2026: «dale más importancia a
     la sección». Doce píxeles en gris no son un título: son una etiqueta, y
     dejaban la portada como una lista de cosas sin jerarquía. Ahora el nombre
     va grande y en tinta —es lo primero que se lee— y lo que lo acompaña baja
     de peso para que se note quién manda. */
  + '.sv-lab{font-family:Oswald,sans-serif;text-transform:uppercase;font-size:20px;'
  +   'letter-spacing:.015em;color:var(--tinta);margin:26px 0 0;display:flex;'
  +   'align-items:baseline;justify-content:space-between;gap:10px;line-height:1.1}'
  + '.sv-lab b{font-weight:700}'
  + '.sv-lab a{font-family:Inter,system-ui,sans-serif;text-transform:none;letter-spacing:0;'
  +   'font-size:12.5px;font-weight:600;color:var(--naranja-oscuro);text-decoration:none;white-space:nowrap}'
  + '.sv-dice{color:var(--gris);font-size:13px;line-height:1.45;margin:5px 0 0}'
  + '.sv-carr{display:flex;gap:10px;margin-top:10px;overflow-x:auto;scroll-snap-type:x proximity;'
  +   '-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}'
  + '.sv-carr::-webkit-scrollbar{display:none}'
  + '.sv-f{flex:0 0 172px;scroll-snap-align:start;background:var(--blanco);'
  +   'border:1px solid var(--linea);border-radius:14px;overflow:hidden;text-decoration:none;'
  +   'color:var(--tinta);box-shadow:var(--sombra);display:flex;flex-direction:column}'
  + '.sv-f:active{transform:scale(.99)}'
  /* LA PUERTA, AL FINAL DEL RIEL. Javi, 29-oct-2026: «en estas galerías pon el
     estilo de ver colección completa, quita lo de ver todo». El enlace gris de
     la cabecera competía con el nombre de la sección y nadie lo leía; el
     cartón oscuro del final llega solo, empujado por el dedo, justo cuando se
     acabó lo que hay. Mismo gesto que la vitrina de temporada. */
  + '.sv-fin{flex:0 0 clamp(128px,38vw,160px);scroll-snap-align:center;display:flex;'
  +   'align-items:center;justify-content:center;text-align:center;padding:18px 14px;'
  +   'border-radius:14px;background:var(--tinta);color:#FDF6EA;text-decoration:none;'
  +   'font-family:Oswald,sans-serif;font-weight:600;font-size:12.5px;letter-spacing:.05em;'
  +   'text-transform:uppercase;line-height:1.3}'
  + '.sv-fin:active{transform:scale(.99)}'
  /* LA FILA DE FIESTA. Javi, 19-oct-2026: «pon la tarjeta de estas fiestas al
     doble de grande y pura foto y fecha y hora».
     Un cartel de concierto ya trae dentro el nombre, el grupo y la noche: la
     ficha de debajo repetía con peor letra lo que la imagen dice mejor. Así
     que aquí la tarjeta es el cartel entero, al doble, y encima sólo la
     fecha. */
  + '.sv-fila[data-cat="shows"] .sv-f{flex:0 0 72%;max-width:340px}'
  + '.sv-fila[data-cat="shows"] .sv-f .im{aspect-ratio:4/5}'
  /* Javi, 20-oct-2026: «el apartado de fiesta no tiene título ni fecha» —
     «fecha sí». Se fue el nombre con la ficha, y una foto de neón sin nombre
     no se busca ni se cuenta a nadie. Vuelve el nombre, solo: el precio, los
     cupos y los ODS siguen fuera, que para eso está la ficha. */
  + '.sv-fila[data-cat="shows"] .sv-f .cu{padding:10px 12px 12px;gap:0}'
  + '.sv-fila[data-cat="shows"] .sv-f .nm{font-size:15px}'
  + '.sv-fila[data-cat="shows"] .sv-f .datos,'
  + '.sv-fila[data-cat="shows"] .sv-f .sv-ods,'
  + '.sv-fila[data-cat="shows"] .sv-f .pie{display:none}'
  + '.sv-fila[data-cat="shows"] .sv-f .hora{left:auto;right:9px;bottom:9px;font-size:13px;padding:5px 11px}'
  + '.sv-f .im{position:relative;aspect-ratio:4/3;background:var(--hueso);overflow:hidden}'
  + '.sv-f .im img{width:100%;height:100%;object-fit:cover;display:block}'
  + '.sv-f .im .ini{position:absolute;inset:0;display:flex;align-items:center;'
  +   'justify-content:center;background:linear-gradient(135deg,var(--hueso),var(--naranja-suave))}'
  + '.sv-f .im .ini img{width:64%;height:64%;object-fit:contain;'
  +   'filter:drop-shadow(0 4px 10px rgba(30,26,22,.18))}'
  + '.sv-f .hora{position:absolute;left:7px;bottom:7px;background:rgba(30,26,22,.82);color:#fff;'
  +   'font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.04em;padding:3px 7px;border-radius:999px}'
  + '.sv-f .eti{position:absolute;left:7px;top:7px;background:var(--magenta);color:#fff;'
  +   'font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;'
  +   'padding:3px 7px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.3)}'
  + '.sv-f .sellimp{position:absolute;top:7px;right:7px;display:inline-flex;align-items:center;'
  +   'gap:4px;background:#A9784F;color:#fff;font-family:Oswald,sans-serif;font-weight:700;'
  +   'font-size:10px;letter-spacing:.03em;padding:3px 7px 3px 5px;border-radius:999px;'
  +   'box-shadow:0 1px 1px rgba(30,26,22,.18),0 6px 14px -8px rgba(30,26,22,.6)}'
  + '.sv-f .sellimp svg{width:11px;height:11px;flex:none;display:block}'
  + '.sv-f .sellimp b{font-weight:700;color:#fff}'
  + '.sv-f .sellimp i{font-style:normal;color:rgba(255,255,255,.85);font-weight:500}'
  + '.sv-f .sellimp.n2{background:#2F6B3C}'
  + '.sv-f .sellimp.n3{background:#1C4E80}'
  + '.sv-f .cu{padding:9px 10px 11px;display:flex;flex-direction:column;gap:3px;flex:1}'
  /* El nombre no pasa de dos renglones: el que tenga `nombre_corto` cabe en
     uno, y el que no, al menos no empuja el precio fuera de sitio. */
  + '.sv-f .nm{font-weight:700;font-size:13px;line-height:1.25;overflow:hidden;'
  +   'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
  + '.sv-f .datos{display:flex;flex-wrap:wrap;gap:3px 8px;color:var(--gris);font-size:11px;'
  +   'line-height:1.3;margin-top:1px}'
  + '.sv-f .pie{margin-top:auto;padding-top:6px;display:flex;align-items:center;'
  +   'justify-content:space-between;gap:8px;min-height:23px}'
  /* EL PRECIO, EN UN RENGLÓN. Javi, 29-oct-2026: «el free entry ponlo en 1
     fila no en 2». «Entrada libre» son dos palabras y el pie las partía en
     dos renglones porque el nombre del sitio le robaba el ancho. Ahora el
     precio no se parte nunca y quien cede es el de la derecha, que es un dato
     de apoyo: cabe en dos renglones y, si no cabe, se corta con puntos. */
  + '.sv-f .pr{font-family:Oswald,sans-serif;font-size:13.5px;color:var(--naranja-oscuro);'
  +   'white-space:nowrap;flex:none}'
  + '.sv-f .pr s{color:var(--tenue);font-size:11.5px;margin-left:4px}'
  + '.sv-f .qn{font-size:10.5px;color:var(--tenue);text-align:right;line-height:1.2;'
  +   'min-width:0;flex:1 1 auto;overflow:hidden;display:-webkit-box;'
  +   '-webkit-line-clamp:2;-webkit-box-orient:vertical}'
  + '.sv-ods{display:flex;gap:3px;flex-wrap:wrap;margin-top:2px}'
  + '.sv-ods i{width:19px;height:19px;border-radius:5px;font-style:normal;'
  +   'font-family:Oswald,sans-serif;font-size:10.5px;color:#fff;display:flex;'
  +   'align-items:center;justify-content:center;line-height:1}'
  + '.sv-vacio{color:var(--tenue);font-size:12.5px;padding:14px 0}';

  function estilo() {
    if (document.getElementById('sv-css')) return;
    var s = document.createElement('style');
    s.id = 'sv-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* El color oficial de cada ODS vive en la base; si no llega, gris. */
  var ODS = {};
  async function cargaOds() {
    try {
      var r = await fetch(SB + '/rest/v1/v_ods_publico?select=ods,color,nombre',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (r.ok) (await r.json()).forEach(function (o) { ODS[Number(o.ods)] = o; });
    } catch (_) {}
  }

  /* EL SELLO DE IMPACTO VIVE AQUI, no solo en la portada de la tienda. Javi,
     27-oct-2026: «no veo los iconos en las fotos». Y tenia razon: el sello
     estaba puesto en `marco()` de sinc/index.html, que construye la promo, la
     grande y la de rejilla -pero las filas de tours de la portada, y las de la
     APePe, son ESTA vitrina, que es otro componente. El dato es el mismo:
     v_sinc_impacto_producto, que sale de sinc_desglose_precio, el mismo
     reparto que la ficha ensena al huesped.
     Solo las experiencias: un evento o un pase no tienen desglose. */
  var IMP = {};
  async function cargaImpacto() {
    try {
      var r = await fetch(SB + '/rest/v1/v_sinc_impacto_producto?select=producto_id,pct,pesos',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (r.ok) (await r.json()).forEach(function (x) { IMP[String(x.producto_id)] = x; });
    } catch (_) {}
  }
  /* EL NOMBRE CORTO DE LA PORTADA. Javi, 29-oct-2026: «permite que solo haya
     una línea de texto en el nombre corto de la portada, en la descripción
     pongamos el título completo» y, sobre la inauguración de Rubén Puerto,
     «pon de título corto Mundomón by Rubén Puerto».
     El nombre entero sigue viviendo en la base y manda en la ficha; lo que se
     guarda en `nombre_corto` es cómo se llama la pieza cuando sólo caben tres
     palabras. Se pide aparte en vez de ensanchar `sinc_escaparate` -que es el
     mismo gesto que los ODS y el sello de impacto-, y se pega a la fila ANTES
     de traducir, porque el traductor sólo pisa campos que la fila ya trae. */
  var CORTO = {};
  async function cargaCortos() {
    try {
      var r = await fetch(SB + '/rest/v1/v_sinc_nombre_corto?select=id,nombre_corto',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (r.ok) (await r.json()).forEach(function (x) { CORTO[String(x.id)] = x.nombre_corto; });
    } catch (_) {}
  }

  function mundo() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path>'
      + '<path d="M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"></path></svg>';
  }
  /* Arranca en 50 (Javi, 27-oct) y se calla por encima de 100: un 157% no es
     un tour generosisimo, es un costeo mal puesto. El color se decide con el
     MISMO numero redondeado que se ensena, o el sello se contradice solo. */
  function selloImp(x) {
    if (!x || x.fuente !== 'experiencia') return '';
    var d = IMP[String(x.id)]; if (!d) return '';
    var p = Number(d.pct); if (!isFinite(p) || p < 45 || p > 75) return '';
    var pr = p;  /* el mismo numero que el desglose, con su decimal */
    var n = pr >= 65 ? ' n3' : (pr >= 55 ? ' n2' : '');
    var pe = Number(d.pesos);
    return '<span class="sellimp' + n + '" title="' + esc(pr) + '% '
      + esc(T('de lo que pagas se queda en la comunidad'))
      + (isFinite(pe) && pe > 0 ? ', ' + esc(money(pe)) + ' ' + esc(T('por persona')) : '') + '">'
      + mundo() + '<b>' + esc(pr) + '%</b>'
      + (isFinite(pe) && pe > 0 ? '<i>' + esc(money(pe)) + '</i>' : '') + '</span>';
  }

  function chips(x) {
    var d = [];
    if (x.fuente === 'experiencia') {
      if (x.duracion_min) d.push(dur(x.duracion_min));
      if (Array.isArray(x.idiomas) && x.idiomas.length)
        /* «Esp/Ing» se quedaba igual en inglés: el recorte a tres letras se
           hacía sobre el nombre en español. Ahora se traduce y luego se
           recorta, así que en inglés sale «Spa/Eng». Javi, 29-oct-2026. */
        d.push('💬 ' + x.idiomas.map(function (i) { return String(T(i)).slice(0,3); }).join('/'));
      /* El cupo sólo si es chico: Javi —«no pongas grupo máximo si supera las
         10 personas»—, porque un tope de 20 no promete un grupo pequeño. */
      if (x.cupo_max && x.cupo_max <= 10) d.push('👥 ' + T('máx ') + x.cupo_max);
    } else if (x.fuente === 'evento') {
      if (x.cupo_max) d.push('👥 ' + x.cupo_max + T(' lugares'));
      if (x.duracion_min) d.push(dur(x.duracion_min));
    } else if (x.fuente === 'pase') {
      /* El pase de coworking no tiene tabla de traducciones -su «Por un dia»
         sale de una vista, no de ateneo_planes-, asi que el resumen se busca
         en el diccionario de la interfaz, donde si esta. Sin entrada devuelve
         el espanol, que es el respaldo de siempre. 27-oct-2026. */
      if (x.resumen) d.push('📅 ' + T(x.resumen));
    }
    return d.length
      ? '<span class="datos">' + d.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</span>'
      : '';
  }

  function odsChips(x) {
    var l = x.ods_lista;
    if (!Array.isArray(l) || !l.length) return '';
    return '<span class="sv-ods">' + l.slice(0,4).map(function (n) {
      var o = ODS[Number(n)] || {};
      return '<i style="background:' + esc(o.color || '#6E665C') + '" title="' +
             esc(o.nombre || ('Objetivo ' + n)) + '">' + n + '</i>';
    }).join('') + '</span>';
  }

  /* `base` existe porque las ligas vienen RELATIVAS de la base ('exp.html?id=…'):
     sirven tal cual dentro del escaparate, pero desde la portada de la APePe
     -que vive en /apepe/- habria que resolverlas contra otra carpeta. */
  function ficha(x, qs, base) {
    var liga = (base || '') + x.liga + (qs || '');
    /* UN ESPACIO QUE SE RENTA POR HORAS NO TIENE FECHA, y es lo unico de la
       vitrina que llega sin ella: una sala de ensayo, un estudio de grabacion.
       Sin esto la tarjeta salia muda arriba y con el precio a secas, como si
       200 fuera lo que cuesta entrar. 14-oct-2026. */
    var porHoras = (x.fuente === 'evento' && !x.proxima_fecha);
    /* «Free Walking Tour» son tres palabras que no distinguen nada —hay cuatro
       que empiezan igual— y parten el nombre de verdad en dos renglones. Se
       abrevia solo en la tarjeta; la ficha conserva su nombre entero. */
    var corto = function(n){
      return String(n||'').replace(/^\s*free\s+walking\s+tour\s*[·:\-–—]?\s*/i,'FWT ')
                          .replace(/\s{2,}/g,' ').trim();
    };
    var badge = x.fuente === 'pase'
      ? (x.precio_lista ? '<span class="eti">' + esc(T('Lanzamiento')) + '</span>' : '')
      : (x.proxima_fecha ? '<span class="hora">' + esc(cuando(x.proxima_fecha, x.proxima_hora)) + '</span>'
         : (porHoras ? '<span class="hora">' + esc(T('Por horas')) + '</span>' : ''));
    /* Cero pesos es entrada libre, no «$0»: el precio en cero se lee como un
       fallo de la pantalla. Javi, 29-oct-2026. */
    var pr = (x.gratis || Number(x.precio) === 0)
      ? T('Entrada libre')
      : (x.precio != null
          ? money(x.precio) + (porHoras ? T(' la hora') : '')
            + (x.precio_lista && Number(x.precio_lista) > Number(x.precio)
              ? '<s>' + money(x.precio_lista) + '</s>' : '')
          : '');
    return '<a class="sv-f" href="' + esc(liga) + '">'
      + '<span class="im">' + tapa(x.nombre, x.portada) + badge + selloImp(x) + '</span>'
      + '<span class="cu">'
      +   '<span class="nm">' + esc(x.nombre_corto || corto(x.nombre)) + '</span>'
      +   chips(x) + odsChips(x)
      +   '<span class="pie">'
      +     (pr ? '<span class="pr">' + pr + '</span>' : '<span></span>')
      +     (x.quien ? '<span class="qn">' + esc(x.quien) + '</span>' : '')
      +   '</span>'
      + '</span></a>';
  }

  function fila(cat, items, o) {
    /* El Ateneo va en UN bloque, sin dividir —Javi: «es todo el mismo
       espacio»—, ordenado por lo que tiene fecha y luego los pases. */
    /* LAS FIESTAS NO TIENEN «VER TODAS». El buscador de todas.html sólo mira
       experiencias, y una fiesta es un evento: el chip se aplicaba y salía
       «0 de 8». Javi, 19-oct-2026: «¿quién dijo fiesta es un nuevo filtro?».
       Mientras no haya cartelera de eventos, la fila no manda a ningún sitio
       vacío: lo que hay es lo que se ve. */
    /* Javi, 29-oct-2026: el «Ver todas →» sale de la cabecera y se convierte en
       el cartón del final del riel. Mismas reglas de antes sobre quién lo
       tiene y quién no. */
    var ver = (!cat.es_ateneo && cat.slug !== 'shows' && o.verTodas)
      ? '<a class="sv-fin" href="' + esc(o.verTodas + '?cat=' + encodeURIComponent(cat.slug) + (o.qs || '')) + '">'
        + '<span>' + esc(T('Ver todas')) + '</span></a>'
      : '';
    return '<div class="sv-fila" data-cat="' + esc(cat.slug) + '">'
      + '<div class="sv-lab"><b>' + (cat.icono ? esc(cat.icono) + ' ' : '') + esc(T(cat.nombre)) + '</b></div>'
      + (cat.dice ? '<p class="sv-dice">' + esc(T(cat.dice)) + '</p>' : '')
      + '<div class="sv-carr">' + items.map(function (x) { return ficha(x, o.qs, o.base); }).join('') + ver + '</div>'
      + '</div>';
  }

  async function monta(id, o) {
    o = o || {};
    estilo();
    var caja = document.getElementById(id);
    if (!caja) return { filas: 0, items: 0 };

    var items = [];
    try {
      var r = await fetch(SB + '/rest/v1/rpc/sinc_escaparate', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_hotel: o.hotel || null,
          p_dias: o.dias || 90,
          p_ciudad: o.ciudad === undefined ? 'CDMX' : o.ciudad,
          p_prueba: !!o.prueba
        })
      });
      if (!r.ok) throw new Error(T('La base respondió ') + r.status);
      items = await r.json();
    } catch (x) {
      caja.innerHTML = '<div class="sv-vacio">' + esc(T('No pudimos cargar el catálogo. ')) + esc(x.message) + '</div>';
      return { filas: 0, items: 0, error: x.message };
    }
    /* Con `solo` se pide un trozo del escaparate: la portada de la APePe
       enseña los shows y el Ateneo donde antes no salía ninguno de los dos, y
       la fuente sigue siendo la misma consulta. */
    if (o.solo && o.solo.length) {
      items = items.filter(function (x) {
        return o.solo.indexOf(x.categoria_slug || 'otras') >= 0 ||
               (o.solo.indexOf('ateneo') >= 0 && !!x.es_ateneo);
      });
    }
    if (!items.length) {
      if (o.calladoSiVacio) { caja.innerHTML = ''; return { filas: 0, items: 0 }; }
      caja.innerHTML = '<div class="sv-vacio">' + esc(T('Todavía no hay nada publicado por aquí.')) + '</div>';
      return { filas: 0, items: 0 };
    }

    /* El nombre corto se pega ANTES del traductor: `aplica` sólo pisa campos
       que la fila ya trae, así que si llegara después, el huésped en inglés
       vería el corto en español. */
    await cargaCortos();
    items.forEach(function (x) {
      var c = CORTO[String(x.id)];
      if (c) x.nombre_corto = c;
    });

    /* Idioma del huésped: se le pisan encima los textos de la base por fuente
       (experiencia→op_experiencias, evento→eventos). aplica nunca lanza y sólo
       pisa lo que la fila ya trae (x.nombre); si falta la traducción, queda el
       español.

       Y los pases del Ateneo SÍ tienen traducción: vive en `ateneo_planes`,
       con el slug por llave -«semanal» → «Weekly Plan»-, que es justo el `id`
       que sirve el escaparate. Sin esta línea el huésped en inglés leía «Plan
       Semanal» y «Plan Day Pass» en mitad de una fila ya traducida.
       Javi, 29-oct-2026. */
    if (EN() && window.sincI18n && sincI18n.aplica) {
      try {
        var exps = [], evts = [], pases = [];
        items.forEach(function (x) {
          if (x.fuente === 'experiencia') exps.push(x);
          else if (x.fuente === 'evento') evts.push(x);
          else if (x.fuente === 'pase') pases.push(x);
        });
        await Promise.all([
          exps.length ? sincI18n.aplica('op_experiencias', exps, { clave: 'id' }) : null,
          evts.length ? sincI18n.aplica('eventos', evts, { clave: 'id' }) : null,
          pases.length ? sincI18n.aplica('ateneo_planes', pases, { clave: 'id' }) : null
        ]);
      } catch (_) { /* nunca romper la vitrina por el idioma */ }
    }

    await Promise.all([cargaOds(), cargaImpacto()]);

    /* Se agrupa por categoría respetando el orden que manda la base, y las del
       Ateneo se van al final sean las que sean. */
    var porCat = {}, orden = [];
    items.forEach(function (x) {
      var k = x.categoria_slug || 'otras';
      if (!porCat[k]) {
        porCat[k] = {
          cat: { slug: k, nombre: x.categoria || 'Otras experiencias', dice: x.categoria_dice,
                 icono: x.categoria_icono, orden: x.categoria_orden == null ? 999 : x.categoria_orden,
                 es_ateneo: !!x.es_ateneo },
          items: []
        };
        orden.push(k);
      }
      porCat[k].items.push(x);
    });
    orden.sort(function (a, b) {
      var A = porCat[a].cat, B = porCat[b].cat;
      return (A.es_ateneo ? 1 : 0) - (B.es_ateneo ? 1 : 0) || A.orden - B.orden ||
             A.nombre.localeCompare(B.nombre);
    });

    caja.innerHTML = orden.map(function (k) {
      return fila(porCat[k].cat, porCat[k].items, o);
    }).join('');

    return { filas: orden.length, items: items.length };
  }

  /* `estilo` se exporta para que otra pantalla pueda usar la misma tarjeta sin
     montar una vitrina entera: la ficha publica de una productora enseña sus
     eventos, y tienen que verse igual que en el escaparate. */
  return { monta: monta, ficha: ficha, tapa: tapa, cuando: cuando,
           money: money, estilo: estilo, mini: mini };
})();
