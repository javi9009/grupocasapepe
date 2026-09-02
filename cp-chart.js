/* ============================================================
   cp-chart.js — Gráficas del Grupo Casa Pepe

     <script src="/cp-chart.js" defer></script>
     cpChart.linea('#miCaja', { x:['Ene',…], series:[{nombre:'CDMX', datos:[…]}] });

   SVG puro, sin librerías: pesa nada y se ve igual en todas las
   pantallas. Mantiene la forma de siempre — ejes X/Y, puntos y
   globo con el dato — sólo que ahora una sola vez y para todos.

   Reglas que aplica solas, para no discutirlas pantalla por pantalla:
   · Los colores salen de --s1..--s5 en orden fijo. La serie 6 en
     adelante cae en "Otros" gris: nunca se inventa un color nuevo.
   · Nunca dos ejes Y. Dos magnitudes distintas = dos gráficas.
   · Con 2+ series siempre hay leyenda; con 4 o menos, además se
     etiqueta el último punto. El color nunca es la única pista.
   · Rejilla y ejes discretos; los números en tinta, no en el color
     de la serie.
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function tok(n, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return v || fb;
  }
  function serieColor(i) {
    return i < 5 ? tok('--s' + (i + 1), '#137A56') : tok('--s-otros', '#8A8175');
  }
  function caja(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return null;
    el.innerHTML = '';
    el.classList.add('cp-chart-caja');
    return el;
  }
  function svg(w, h) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    s.setAttribute('class', 'cp-chart');
    s.style.height = 'auto';
    return s;
  }
  function el(tipo, attrs) {
    var n = document.createElementNS(NS, tipo);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }
  function texto(x, y, t, cls, extra) {
    var n = el('text', Object.assign({ x: x, y: y, class: cls || 'et' }, extra || {}));
    n.textContent = t;
    return n;
  }
  function nice(max) { // techo redondo para que el eje Y no diga 8734
    if (max <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(max)));
    var r = max / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  }
  function porDefecto(v) { return v === null || v === undefined || isNaN(v) ? '—' : Number(v).toLocaleString('es-MX'); }

  /* ---------- Globo (una sola implementación para todas) ----- */
  function globo(cont) {
    var g = document.createElement('div');
    g.className = 'cp-tip';
    cont.appendChild(g);
    return {
      ver: function (html, x, y) {
        g.innerHTML = html;
        g.classList.add('ver');
        var r = cont.getBoundingClientRect();
        var gx = Math.min(Math.max(x - g.offsetWidth / 2, 4), r.width - g.offsetWidth - 4);
        g.style.left = gx + 'px';
        g.style.top = Math.max(y - g.offsetHeight - 10, 2) + 'px';
      },
      ocultar: function () { g.classList.remove('ver'); }
    };
  }

  function leyenda(cont, series, colores) {
    if (series.length < 2) return; // una serie: el título ya la nombra
    var l = document.createElement('div');
    l.className = 'cp-leyenda';
    series.forEach(function (s, i) {
      var sp = document.createElement('span');
      sp.innerHTML = '<i style="background:' + colores[i] + '"></i>' + s.nombre;
      l.appendChild(sp);
    });
    cont.appendChild(l);
  }

  /* ---------- Líneas ---------------------------------------- */
  function linea(sel, cfg) {
    var cont = caja(sel); if (!cont) return;
    cfg = cfg || {};
    var x = cfg.x || [], series = cfg.series || [], fmt = cfg.fmt || porDefecto;
    var W = 660, H = cfg.alto || 240, pL = 46, pR = 16, pT = 16, pB = 28;
    var iw = W - pL - pR, ih = H - pT - pB;
    var colores = series.map(function (s, i) { return s.color || serieColor(i); });

    var todos = [];
    series.forEach(function (s) { s.datos.forEach(function (v) { if (v !== null && !isNaN(v)) todos.push(v); }); });
    var max = nice(Math.max.apply(null, todos.concat([0])));
    var min = cfg.desdeCero === false ? Math.min.apply(null, todos) : 0;
    var esc = function (v) { return pT + ih - ((v - min) / (max - min || 1)) * ih; };
    var px = function (i) { return pL + (x.length > 1 ? (i / (x.length - 1)) * iw : iw / 2); };

    var s = svg(W, H);
    // Rejilla + eje Y (5 escalones)
    for (var k = 0; k <= 4; k++) {
      var v = min + (max - min) * k / 4, y = esc(v);
      s.appendChild(el('line', { x1: pL, y1: y, x2: W - pR, y2: y, class: 'malla' }));
      s.appendChild(texto(pL - 7, y + 3, cfg.fmtEjeY ? cfg.fmtEjeY(v) : fmt(v), 'et', { 'text-anchor': 'end' }));
    }
    s.appendChild(el('line', { x1: pL, y1: pT, x2: pL, y2: pT + ih, class: 'eje' }));
    s.appendChild(el('line', { x1: pL, y1: pT + ih, x2: W - pR, y2: pT + ih, class: 'eje' }));
    // Eje X — si hay muchos rótulos, uno de cada N para que no choquen
    var salto = Math.ceil(x.length / 12);
    x.forEach(function (et, i) {
      if (i % salto) return;
      s.appendChild(texto(px(i), H - 9, et, 'et-eje', { 'text-anchor': 'middle' }));
    });

    // Línea guía del hover
    var guia = el('line', { x1: 0, y1: pT, x2: 0, y2: pT + ih, class: 'malla', opacity: 0 });
    s.appendChild(guia);

    series.forEach(function (serie, si) {
      var d = '', abierto = false;
      serie.datos.forEach(function (v, i) {
        if (v === null || v === undefined || isNaN(v)) { abierto = false; return; }
        d += (abierto ? ' L' : ' M') + px(i) + ' ' + esc(v);
        abierto = true;
      });
      s.appendChild(el('path', {
        d: d.trim(), fill: 'none', stroke: colores[si], 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': serie.punteada ? '5 4' : null
      }));
      serie.datos.forEach(function (v, i) {
        if (v === null || v === undefined || isNaN(v)) return;
        // anillo del color del lienzo: separa puntos que se enciman
        s.appendChild(el('circle', {
          cx: px(i), cy: esc(v), r: 4, fill: colores[si],
          stroke: tok('--surface', '#fff'), 'stroke-width': 2, class: 'punto',
          'data-i': i, 'data-s': si
        }));
      });
      // etiqueta directa del último punto (hasta 4 series)
      if (series.length <= 4) {
        for (var j = serie.datos.length - 1; j >= 0; j--) {
          var uv = serie.datos[j];
          if (uv !== null && uv !== undefined && !isNaN(uv)) {
            s.appendChild(texto(px(j) + 7, esc(uv) + 3, serie.nombre, 'et-eje', { 'text-anchor': 'start', fill: colores[si] }));
            break;
          }
        }
      }
    });

    cont.appendChild(s);
    leyenda(cont, series, colores);

    // Hover: guía vertical + globo con TODAS las series de esa X
    var tip = globo(cont);
    s.addEventListener('mousemove', function (ev) {
      var r = s.getBoundingClientRect();
      var rel = ((ev.clientX - r.left) / r.width) * W;
      if (rel < pL - 6 || rel > W - pR + 6 || !x.length) { tip.ocultar(); guia.setAttribute('opacity', 0); return; }
      var i = Math.round(((rel - pL) / iw) * (x.length - 1));
      i = Math.max(0, Math.min(x.length - 1, i));
      guia.setAttribute('x1', px(i)); guia.setAttribute('x2', px(i)); guia.setAttribute('opacity', 1);
      var html = '<b>' + x[i] + '</b>';
      series.forEach(function (se, si) {
        html += '<br><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' +
          colores[si] + ';margin-right:5px"></i>' + se.nombre + ' · ' + fmt(se.datos[i]);
      });
      tip.ver(html, (px(i) / W) * r.width, ((esc(series[0].datos[i] || 0)) / H) * r.height);
    });
    s.addEventListener('mouseleave', function () { tip.ocultar(); guia.setAttribute('opacity', 0); });
  }

  /* ---------- Barras (agrupadas o apiladas) ------------------ */
  function barras(sel, cfg) {
    var cont = caja(sel); if (!cont) return;
    cfg = cfg || {};
    var x = cfg.x || [], series = cfg.series || [], fmt = cfg.fmt || porDefecto;
    var apilada = !!cfg.apilada;
    var W = 660, H = cfg.alto || 240, pL = 46, pR = 16, pT = 16, pB = 28;
    var iw = W - pL - pR, ih = H - pT - pB;
    var colores = series.map(function (s, i) { return s.color || serieColor(i); });

    var max = 0;
    x.forEach(function (_, i) {
      if (apilada) {
        var t = 0; series.forEach(function (s) { t += (s.datos[i] || 0); });
        max = Math.max(max, t);
      } else series.forEach(function (s) { max = Math.max(max, s.datos[i] || 0); });
    });
    max = nice(max);
    var esc = function (v) { return (v / (max || 1)) * ih; };
    var grupo = iw / (x.length || 1);
    var anchoBarra = apilada ? Math.min(grupo * 0.55, 34)
      : Math.min((grupo * 0.72) / (series.length || 1), 26);

    var s = svg(W, H);
    for (var k = 0; k <= 4; k++) {
      var v = max * k / 4, y = pT + ih - esc(v);
      s.appendChild(el('line', { x1: pL, y1: y, x2: W - pR, y2: y, class: 'malla' }));
      s.appendChild(texto(pL - 7, y + 3, cfg.fmtEjeY ? cfg.fmtEjeY(v) : fmt(v), 'et', { 'text-anchor': 'end' }));
    }
    s.appendChild(el('line', { x1: pL, y1: pT + ih, x2: W - pR, y2: pT + ih, class: 'eje' }));

    var tip = globo(cont);
    var lienzo = tok('--surface', '#fff');

    x.forEach(function (et, i) {
      var cx = pL + grupo * i + grupo / 2;
      s.appendChild(texto(cx, H - 9, et, 'et-eje', { 'text-anchor': 'middle' }));
      if (apilada) {
        var acum = 0;
        series.forEach(function (se, si) {
          var v = se.datos[i] || 0; if (!v) return;
          var alto = esc(v), y0 = pT + ih - esc(acum) - alto;
          var r = el('rect', {
            x: cx - anchoBarra / 2, y: y0, width: anchoBarra, height: Math.max(alto - 2, 1),
            fill: colores[si], rx: si === series.length - 1 ? 4 : 0
          });
          enlazaGlobo(r, tip, cont, s, W, H, '<b>' + et + '</b><br>' + se.nombre + ' · ' + fmt(v));
          s.appendChild(r);
          acum += v;
        });
      } else {
        var ancho = anchoBarra * series.length + 2 * (series.length - 1);
        series.forEach(function (se, si) {
          var v = se.datos[i] || 0;
          var alto = esc(v);
          var bx = cx - ancho / 2 + si * (anchoBarra + 2);
          var r = el('rect', {
            x: bx, y: pT + ih - alto, width: anchoBarra, height: Math.max(alto, 1),
            fill: colores[si], rx: 4
          });
          enlazaGlobo(r, tip, cont, s, W, H, '<b>' + et + '</b><br>' + se.nombre + ' · ' + fmt(v));
          s.appendChild(r);
        });
      }
    });

    cont.appendChild(s);
    leyenda(cont, series, colores);
  }

  function enlazaGlobo(rect, tip, cont, s, W, H, html) {
    rect.style.cursor = 'pointer';
    rect.addEventListener('mouseenter', function () {
      var r = s.getBoundingClientRect();
      var bx = (+rect.getAttribute('x') + (+rect.getAttribute('width')) / 2) / W * r.width;
      var by = (+rect.getAttribute('y')) / H * r.height;
      tip.ver(html, bx, by);
      rect.setAttribute('opacity', .82);
    });
    rect.addEventListener('mouseleave', function () { tip.ocultar(); rect.removeAttribute('opacity'); });
  }

  /* ---------- Dona (partes de un todo, máximo 5) ------------- */
  function dona(sel, cfg) {
    var cont = caja(sel); if (!cont) return;
    cfg = cfg || {};
    var datos = (cfg.datos || []).slice(0, 6), fmt = cfg.fmt || porDefecto;
    var total = datos.reduce(function (a, d) { return a + (d.val || 0); }, 0);
    var W = 300, H = 200, cx = 100, cy = 100, R = 74, r0 = 48;
    var s = svg(W, H);
    var ang = -Math.PI / 2;
    var lienzo = tok('--surface', '#fff');
    var tip = globo(cont);

    datos.forEach(function (d, i) {
      var frac = total ? (d.val || 0) / total : 0;
      var a2 = ang + frac * Math.PI * 2;
      var grande = frac > .5 ? 1 : 0;
      var p = el('path', {
        d: 'M' + (cx + R * Math.cos(ang)) + ' ' + (cy + R * Math.sin(ang)) +
           ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + (cx + R * Math.cos(a2)) + ' ' + (cy + R * Math.sin(a2)) +
           ' L' + (cx + r0 * Math.cos(a2)) + ' ' + (cy + r0 * Math.sin(a2)) +
           ' A' + r0 + ' ' + r0 + ' 0 ' + grande + ' 0 ' + (cx + r0 * Math.cos(ang)) + ' ' + (cy + r0 * Math.sin(ang)) + ' Z',
        fill: d.color || serieColor(i), stroke: lienzo, 'stroke-width': 2
      });
      p.style.cursor = 'pointer';
      (function (d, frac) {
        p.addEventListener('mouseenter', function () {
          tip.ver('<b>' + d.et + '</b><br>' + fmt(d.val) + ' · ' + (frac * 100).toFixed(1) + '%',
            cont.getBoundingClientRect().width / 2, 30);
          p.setAttribute('opacity', .82);
        });
        p.addEventListener('mouseleave', function () { tip.ocultar(); p.removeAttribute('opacity'); });
      })(d, frac);
      s.appendChild(p);
      ang = a2;
    });

    // centro: el total, que es lo que la gente busca primero
    s.appendChild(texto(cx, cy - 2, cfg.centro || fmt(total), 'et-eje',
      { 'text-anchor': 'middle', 'font-size': '18', 'font-weight': '700', fill: tok('--ink', '#1F1B16') }));
    if (cfg.centroPie) s.appendChild(texto(cx, cy + 15, cfg.centroPie, 'et', { 'text-anchor': 'middle' }));

    // leyenda a la derecha, con el valor: nunca sólo color
    datos.forEach(function (d, i) {
      var y = 30 + i * 24;
      s.appendChild(el('rect', { x: 196, y: y - 8, width: 9, height: 9, rx: 2, fill: d.color || serieColor(i) }));
      s.appendChild(texto(211, y, d.et, 'et-eje', { 'text-anchor': 'start' }));
      s.appendChild(texto(W - 6, y, fmt(d.val), 'et', { 'text-anchor': 'end' }));
    });
    cont.appendChild(s);
  }

  /* ---------- Sparkline (para KPIs) -------------------------- */
  function spark(sel, datos, cfg) {
    var cont = caja(sel); if (!cont) return;
    cfg = cfg || {};
    var W = 120, H = 28;
    var lim = datos.filter(function (v) { return v !== null && !isNaN(v); });
    var mx = Math.max.apply(null, lim), mn = Math.min.apply(null, lim);
    var s = svg(W, H);
    var d = '';
    datos.forEach(function (v, i) {
      var x = (i / (datos.length - 1 || 1)) * W;
      var y = H - 3 - ((v - mn) / ((mx - mn) || 1)) * (H - 6);
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    s.appendChild(el('path', { d: d, fill: 'none', stroke: cfg.color || serieColor(0), 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    var ultimo = datos[datos.length - 1];
    s.appendChild(el('circle', {
      cx: W, cy: H - 3 - ((ultimo - mn) / ((mx - mn) || 1)) * (H - 6), r: 2.5,
      fill: cfg.color || serieColor(0)
    }));
    cont.appendChild(s);
  }

  global.cpChart = { linea: linea, barras: barras, dona: dona, spark: spark, color: serieColor };
})(window);
