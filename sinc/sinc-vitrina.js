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
 *     qs:'&app=1&resv=...',    // lo que haya que arrastrar en cada liga
 *     verTodas:'todas.html'    // a dónde va el «Ver todas →» de cada fila
 *   })  ->  Promise<{filas, items}>
 */
window.sincVitrina = (function () {
  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

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
    return n === 0 ? 'Gratis' : '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }
  /* Supabase redimensiona al vuelo; se pide el ancho que de verdad se ve. */
  function mini(u, ancho) {
    if (!u || u.indexOf('/storage/v1/object/public/') < 0) return u;
    return u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
           '?width=' + ancho + '&quality=72&resize=cover';
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
    if (dif === 0) return 'Hoy' + hh;
    if (dif === 1) return 'Mañana' + hh;
    if (dif > 1 && dif < 7) return DIAS[d.getDay()] + ' ' + d.getDate() + hh;
    return d.getDate() + ' ' + MESES[d.getMonth()] + hh;
  }
  function dur(m) {
    m = Number(m || 0); if (!m) return '';
    var h = Math.floor(m / 60), mm = m % 60;
    return '⏱ ' + (h ? h + ' h' : '') + (mm ? (h ? ' ' : '') + mm + ' min' : '');
  }

  /* ---------- el estilo, inyectado una vez ---------- */
  var CSS = ''
  + '.sv-lab{font-family:Oswald,sans-serif;text-transform:uppercase;font-size:12px;'
  +   'letter-spacing:.09em;color:var(--gris);margin:20px 0 2px;display:flex;'
  +   'align-items:baseline;justify-content:space-between;gap:10px}'
  + '.sv-lab b{font-weight:600}'
  + '.sv-lab a{font-family:Inter,system-ui,sans-serif;text-transform:none;letter-spacing:0;'
  +   'font-size:12.5px;font-weight:600;color:var(--naranja-oscuro);text-decoration:none;white-space:nowrap}'
  + '.sv-dice{color:var(--gris);font-size:12.5px;line-height:1.45;margin:4px 0 0}'
  + '.sv-carr{display:flex;gap:10px;margin-top:10px;overflow-x:auto;scroll-snap-type:x proximity;'
  +   '-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}'
  + '.sv-carr::-webkit-scrollbar{display:none}'
  + '.sv-f{flex:0 0 172px;scroll-snap-align:start;background:var(--blanco);'
  +   'border:1px solid var(--linea);border-radius:14px;overflow:hidden;text-decoration:none;'
  +   'color:var(--tinta);box-shadow:var(--sombra);display:flex;flex-direction:column}'
  + '.sv-f:active{transform:scale(.99)}'
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
  + '.sv-f .cu{padding:9px 10px 11px;display:flex;flex-direction:column;gap:3px;flex:1}'
  + '.sv-f .nm{font-weight:700;font-size:13px;line-height:1.25}'
  + '.sv-f .datos{display:flex;flex-wrap:wrap;gap:3px 8px;color:var(--gris);font-size:11px;'
  +   'line-height:1.3;margin-top:1px}'
  + '.sv-f .pie{margin-top:auto;padding-top:6px;display:flex;align-items:center;'
  +   'justify-content:space-between;gap:8px;min-height:23px}'
  + '.sv-f .pr{font-family:Oswald,sans-serif;font-size:13.5px;color:var(--naranja-oscuro)}'
  + '.sv-f .pr s{color:var(--tenue);font-size:11.5px;margin-left:4px}'
  + '.sv-f .qn{font-size:10.5px;color:var(--tenue);text-align:right;line-height:1.2}'
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

  function chips(x) {
    var d = [];
    if (x.fuente === 'experiencia') {
      if (x.duracion_min) d.push(dur(x.duracion_min));
      if (Array.isArray(x.idiomas) && x.idiomas.length)
        d.push('💬 ' + x.idiomas.map(function (i) { return String(i).slice(0,3); }).join('/'));
      /* El cupo sólo si es chico: Javi —«no pongas grupo máximo si supera las
         10 personas»—, porque un tope de 20 no promete un grupo pequeño. */
      if (x.cupo_max && x.cupo_max <= 10) d.push('👥 máx ' + x.cupo_max);
    } else if (x.fuente === 'evento') {
      if (x.cupo_max) d.push('👥 ' + x.cupo_max + ' lugares');
      if (x.duracion_min) d.push(dur(x.duracion_min));
    } else if (x.fuente === 'pase') {
      if (x.resumen) d.push('📅 ' + x.resumen);
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

  function ficha(x, qs) {
    var liga = x.liga + (qs || '');
    var badge = x.fuente === 'pase'
      ? (x.precio_lista ? '<span class="eti">Lanzamiento</span>' : '')
      : (x.proxima_fecha ? '<span class="hora">' + esc(cuando(x.proxima_fecha, x.proxima_hora)) + '</span>' : '');
    var pr = x.gratis
      ? 'Entrada libre'
      : (x.precio != null
          ? money(x.precio) + (x.precio_lista && Number(x.precio_lista) > Number(x.precio)
              ? '<s>' + money(x.precio_lista) + '</s>' : '')
          : '');
    return '<a class="sv-f" href="' + esc(liga) + '">'
      + '<span class="im">' + tapa(x.nombre, x.portada) + badge + '</span>'
      + '<span class="cu">'
      +   '<span class="nm">' + esc(x.nombre || '') + '</span>'
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
    var ver = (!cat.es_ateneo && o.verTodas)
      ? '<a href="' + esc(o.verTodas + '?cat=' + encodeURIComponent(cat.slug) + (o.qs || '')) + '">Ver todas &rarr;</a>'
      : '';
    return '<div class="sv-fila" data-cat="' + esc(cat.slug) + '">'
      + '<div class="sv-lab"><b>' + (cat.icono ? esc(cat.icono) + ' ' : '') + esc(cat.nombre) + '</b>' + ver + '</div>'
      + (cat.dice ? '<p class="sv-dice">' + esc(cat.dice) + '</p>' : '')
      + '<div class="sv-carr">' + items.map(function (x) { return ficha(x, o.qs); }).join('') + '</div>'
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
      if (!r.ok) throw new Error('La base respondió ' + r.status);
      items = await r.json();
    } catch (x) {
      caja.innerHTML = '<div class="sv-vacio">No pudimos cargar el catálogo. ' + esc(x.message) + '</div>';
      return { filas: 0, items: 0, error: x.message };
    }
    if (!items.length) {
      caja.innerHTML = '<div class="sv-vacio">Todavía no hay nada publicado por aquí.</div>';
      return { filas: 0, items: 0 };
    }

    await cargaOds();

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

  return { monta: monta, ficha: ficha, tapa: tapa, cuando: cuando, money: money };
})();
