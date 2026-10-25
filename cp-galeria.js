/* Grupo Casa Pepe · El gestor de fotos y video, uno solo para todos.

   Javi, 23-oct-2026, mirando la ficha del evento: «aquí has de mejorar el
   editor como tienes en la página del touroperador», y la lista de lo que
   tiene que hacer:
     zona de subida de archivos · subir por liga (varias) · botón de subir todo
     · avisar qué subió y qué no · ajustar foto por foto al subirlas · botón de
     terminar ajuste · zona de archivos subidos · selector de principal o
     secundaria · mover y ordenar · y el editor de ancho, alto y centrado que
     ya existe por foto.

   Por qué un archivo aparte y no otra copia pegada en la ficha del evento:
   porque ya hay dos galerías —la del touroperador y la de la experiencia— y
   cada vez que se toca una, las otras se quedan atrás. Eso es exactamente lo
   que lleva semanas pasando. Aquí la pantalla pone los datos y esto pone la
   interfaz; cuando haya que mejorar algo, se mejora una vez.

   LA COLA ES LA IDEA. Antes se elegía un archivo y empezaba a subir solo, con
   el recortador saltando encima. Ahora se sueltan todos, se ven, se acomodan
   los que uno quiera, y se sube cuando se dice. Quien está preparando un
   evento tiene cinco fotos y un cartel, no una.

   Uso:
     cpGaleria.monta({
       el:   'idDelContenedor',
       modo: 'evento',                 // decide los textos y el recorte
       api:  fotoApi,                  // ({imagen|ligas|quitar|orden}) -> {fotos:[…]}
       lee:  function(){ return EVFOTOS; },
       pon:  function(f){ EVFOTOS=f; },
       tras: function(){ … }           // opcional, al terminar cualquier cambio
     });

   `api` es la misma función que ya usaba la pantalla. Esto no inventa una
   puerta nueva al servidor: usa la que hay. */
(function () {
  'use strict';

  var CSS = [
    '.cpg{margin-top:4px}',
    '.cpg-zona{border:2px dashed var(--linea,#E6DFD6);border-radius:12px;padding:18px 14px;',
      'text-align:center;cursor:pointer;background:var(--blanco,#fff);transition:border-color .15s,background .15s}',
    '.cpg-zona:hover,.cpg-zona.cpg-hot{border-color:var(--naranja,#F2682A);background:var(--naranja-suave,#FDE7DC)}',
    '.cpg-zona b{display:block;font-size:14px;margin-bottom:3px}',
    '.cpg-mini{font-size:12px;color:var(--gris,#6E665C);line-height:1.5}',
    '.cpg-fila{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px}',
    '.cpg-fila textarea{flex:1;min-width:200px;min-height:52px;padding:8px 10px;border:1.5px solid var(--linea,#E6DFD6);',
      'border-radius:9px;font:inherit;font-size:13px;resize:vertical}',
    '.cpg-b{font-family:Oswald,system-ui,sans-serif;font-weight:600;letter-spacing:.04em;text-transform:uppercase;',
      'font-size:12px;border-radius:9px;padding:9px 15px;cursor:pointer;border:2px solid var(--naranja,#F2682A);',
      'background:var(--naranja,#F2682A);color:#fff;line-height:1.1}',
    '.cpg-b.cpg-fan{background:transparent;color:var(--naranja-oscuro,#C9501A);border-color:var(--linea,#E6DFD6)}',
    '.cpg-b[disabled]{opacity:.5;cursor:default}',
    '.cpg-tit{font-family:Oswald,system-ui,sans-serif;font-weight:600;font-size:11.5px;letter-spacing:.08em;',
      'text-transform:uppercase;color:var(--gris,#6E665C);margin:16px 0 7px}',
    '.cpg-rej{display:flex;gap:9px;flex-wrap:wrap}',
    '.cpg-it{width:126px;border:1px solid var(--linea,#E6DFD6);border-radius:10px;overflow:hidden;',
      'background:var(--blanco,#fff)}',
    '.cpg-it.cpg-port{border:2px solid var(--naranja,#F2682A)}',
    '.cpg-vis{position:relative;height:104px;background:var(--hueso,#F4EFE8);display:block}',
    '.cpg-vis img,.cpg-vis video{width:100%;height:100%;object-fit:cover;display:block}',
    '.cpg-eti{position:absolute;left:4px;top:4px;font:600 8.5px/1 Oswald,system-ui;letter-spacing:.06em;',
      'color:#fff;background:rgba(30,26,22,.78);padding:3px 6px;border-radius:99px}',
    '.cpg-eti.cpg-v{background:var(--magenta,#E2188E)}',
    '.cpg-port-b{position:absolute;left:4px;bottom:4px;font:600 8.5px/1 Oswald,system-ui;letter-spacing:.06em;',
      'color:#fff;background:var(--naranja,#F2682A);padding:3px 6px;border-radius:99px}',
    '.cpg-x{position:absolute;right:4px;top:4px;width:21px;height:21px;border:0;border-radius:50%;',
      'background:rgba(30,26,22,.78);color:#fff;font:700 12px/1 system-ui;cursor:pointer;display:grid;place-items:center;padding:0}',
    '.cpg-pie{padding:6px;display:flex;flex-direction:column;gap:5px}',
    '.cpg-pie select{width:100%;font:inherit;font-size:11px;padding:4px 5px;border:1px solid var(--linea,#E6DFD6);border-radius:7px}',
    '.cpg-bb{display:flex;gap:4px}',
    '.cpg-bb button{flex:1;font:inherit;font-size:11px;padding:4px 0;border:1px solid var(--linea,#E6DFD6);',
      'background:var(--blanco,#fff);border-radius:7px;cursor:pointer;line-height:1.3}',
    '.cpg-bb button:hover{border-color:var(--naranja,#F2682A)}',
    '.cpg-bb button[disabled]{opacity:.35;cursor:default}',
    '.cpg-est{font-size:11px;color:var(--gris,#6E665C);margin-top:3px;text-align:center}',
    '.cpg-ok{color:#1D6B4A}',
    '.cpg-vacio{font-size:12.5px;color:var(--gris,#6E665C)}'
  ].join('');

  function css() {
    if (document.getElementById('cpg-css')) return;
    var s = document.createElement('style');
    s.id = 'cpg-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mb(n) { return (Number(n || 0) / 1048576).toFixed(1); }
  function esVideo(f) { return String((f && f.tipo) || '') === 'video'; }

  function leeDataUri(b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(b);
    });
  }

  function monta(cfg) {
    css();
    var host = typeof cfg.el === 'string' ? document.getElementById(cfg.el) : cfg.el;
    if (!host) return null;

    var modo = cfg.modo || 'evento';
    /* Vertical para el cartel de un evento, horizontal para la tarjeta de una
       experiencia. Cada fila de la app enseña lo suyo; el recorte es lo que
       evita que la galería salga a parches. */
    var soloV = modo === 'evento';

    var COLA = [];      /* lo elegido y todavía sin subir */
    var ult = { ok: 0, fallos: [] };

    host.className = (host.className ? host.className + ' ' : '') + 'cpg';
    host.innerHTML =
      '<div class="cpg-guia cpg-mini" style="margin-bottom:10px;padding:10px 12px;' +
        'border-left:3px solid var(--naranja,#F2682A);background:var(--hueso,#F4EFE8);border-radius:0 8px 8px 0"></div>' +
      '<div class="cpg-zona" tabindex="0" role="button">' +
        '<b>Arrastra aquí tus fotos y videos</b>' +
        '<span class="cpg-mini">o toca para elegirlos · puedes soltar varios a la vez</span>' +
      '</div>' +
      '<input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" style="display:none">' +
      '<div class="cpg-fila">' +
        '<textarea placeholder="…o pega ligas de Drive o de la web, una por renglón"></textarea>' +
        '<button type="button" class="cpg-b cpg-fan cpg-ligas">Traer de las ligas</button>' +
      '</div>' +
      '<div class="cpg-cola-wrap" hidden>' +
        '<div class="cpg-tit">Por subir <span class="cpg-n"></span></div>' +
        '<div class="cpg-rej cpg-cola"></div>' +
        '<div class="cpg-fila">' +
          '<button type="button" class="cpg-b cpg-todo">Subir todo</button>' +
          '<button type="button" class="cpg-b cpg-fan cpg-limpia">Vaciar la lista</button>' +
        '</div>' +
      '</div>' +
      '<div class="cpg-parte"></div>' +
      '<div class="cpg-tit">Ya subidos</div>' +
      '<div class="cpg-rej cpg-subidos"></div>';

    var q = function (s) { return host.querySelector(s); };
    var zona = q('.cpg-zona'), file = host.querySelector('input[type=file]');

    if (window.cpVideo) q('.cpg-guia').innerHTML = window.cpVideo.queSubir(modo);
    else q('.cpg-guia').remove();

    /* ---------- la cola ---------- */
    function pintaCola() {
      var w = q('.cpg-cola-wrap');
      w.hidden = !COLA.length;
      q('.cpg-n').textContent = COLA.length ? '· ' + COLA.length : '';
      q('.cpg-cola').innerHTML = COLA.map(function (c, i) {
        return '<div class="cpg-it">' +
          '<div class="cpg-vis">' +
            (c.video ? '<video src="' + esc(c.prev) + '" muted></video>'
                     : '<img src="' + esc(c.prev) + '" alt="">') +
            '<span class="cpg-eti' + (c.video ? ' cpg-v' : '') + '">' + (c.video ? '▶ VIDEO' : 'FOTO') + '</span>' +
            '<button type="button" class="cpg-x" data-quita="' + i + '" title="Quitar de la lista">✕</button>' +
          '</div>' +
          '<div class="cpg-pie">' +
            (c.video ? '<div class="cpg-est">' + mb(c.file.size) + ' MB</div>'
                     : '<div class="cpg-bb"><button type="button" data-ajusta="' + i + '">' +
                       (c.blob ? '✓ acomodada' : '⤢ acomodar') + '</button></div>') +
            '<div class="cpg-est' + (c.estado === 'listo' ? ' cpg-ok' : '') + '">' + esc(c.estado || '') + '</div>' +
          '</div></div>';
      }).join('');

      Array.prototype.forEach.call(q('.cpg-cola').querySelectorAll('[data-quita]'), function (b) {
        b.onclick = function () { COLA.splice(Number(b.getAttribute('data-quita')), 1); pintaCola(); };
      });
      Array.prototype.forEach.call(q('.cpg-cola').querySelectorAll('[data-ajusta]'), function (b) {
        b.onclick = function () { ajusta(Number(b.getAttribute('data-ajusta'))); };
      });
    }

    /* El recortador de siempre. Su botón de guardar ES el «terminar ajuste»:
       no hace falta inventar un segundo botón que haga lo mismo. */
    function ajusta(i) {
      var c = COLA[i];
      if (!c || c.video || !window.sincCrop) return;
      window.sincCrop.open(c.file, { only: soloV ? 'v' : null, titulo: 'Acomoda la foto' }, function (r) {
        var b = r && (soloV ? (r.vBlob || r.hBlob) : (r.hBlob || r.vBlob));
        if (!b) return;                       /* cerró sin guardar: se queda como estaba */
        c.blob = b;
        try { URL.revokeObjectURL(c.prev); } catch (_) {}
        c.prev = URL.createObjectURL(b);
        pintaCola();
      });
    }

    function encola(files) {
      Array.prototype.slice.call(files || []).forEach(function (f) {
        var t = String(f.type || '');
        if (t.indexOf('image') !== 0 && t.indexOf('video') !== 0) {
          ult.fallos.push({ nombre: f.name, motivo: 'no es una foto ni un video' });
          return;
        }
        COLA.push({ file: f, video: t.indexOf('video') === 0, prev: URL.createObjectURL(f), blob: null, estado: '' });
      });
      parte();
      pintaCola();
    }

    /* ---------- subir todo ---------- */
    async function subeTodo() {
      if (!COLA.length) return;
      var b = q('.cpg-todo'); b.disabled = true;
      ult = { ok: 0, fallos: [] };

      for (var i = 0; i < COLA.length; i++) {
        var c = COLA[i];
        c.estado = 'subiendo…'; pintaCola();
        try {
          var cuerpo = c.blob || c.file;

          if (c.video && window.cpVideo) {
            c.estado = 'comprimiendo…'; pintaCola();
            var rv = await new Promise(function (res) {
              window.cpVideo.comprime(c.file, null, function (e, x) { res(x || null); });
            });
            if (rv) {
              cuerpo = rv.blob;
              c.estado = rv.comprimido ? (mb(rv.antes) + ' → ' + mb(rv.despues) + ' MB') : '';
              if (rv.aviso && !rv.comprimido) ult.fallos.push({ nombre: c.file.name, motivo: rv.aviso });
            }
          }

          /* Una foto que nadie acomodó se acomoda ahora: el recorte no es
             opcional, es lo que hace que la galería sea una galería. */
          if (!c.video && !c.blob && window.sincCrop) {
            c.estado = 'acomódala…'; pintaCola();
            var bl = await new Promise(function (res) {
              window.sincCrop.open(c.file, { only: soloV ? 'v' : null, titulo: 'Acomoda la foto (' + (i + 1) + ' de ' + COLA.length + ')' },
                function (r) { res(r && (soloV ? (r.vBlob || r.hBlob) : (r.hBlob || r.vBlob))); });
            });
            if (!bl) { ult.fallos.push({ nombre: c.file.name, motivo: 'cerraste el recortador sin acomodarla' }); c.estado = 'sin acomodar'; pintaCola(); continue; }
            cuerpo = bl;
          }

          if (cuerpo.size > 60 * 1024 * 1024) {
            ult.fallos.push({ nombre: c.file.name, motivo: 'pesa ' + mb(cuerpo.size) + ' MB y el tope son 60' });
            c.estado = 'demasiado grande'; pintaCola(); continue;
          }

          c.estado = 'subiendo…'; pintaCola();
          var j = await cfg.api({ imagen: await leeDataUri(cuerpo) });
          cfg.pon(j.fotos || []);
          ult.ok++;
          c.estado = 'listo'; c.subido = true;
        } catch (e) {
          ult.fallos.push({ nombre: c.file.name, motivo: (e && e.message) || 'no se pudo subir' });
          c.estado = 'no entró';
        }
        pintaCola();
      }

      /* Lo que entró se va de la lista; lo que no, se queda para reintentar
         sin tener que volver a buscarlo en el teléfono. */
      COLA = COLA.filter(function (c) { return !c.subido; });
      b.disabled = false;
      pintaCola(); pinta(); parte();
      /* Y QUE SE VEA. Javi, 23-oct-2026: «no me dejó verla subida». Sí la
         dejó —la foto estaba arriba— pero «Ya subidos» queda debajo de la
         cola, y en un teléfono eso es un scroll que nadie adivina. Subir algo
         y no verlo aparecer se lee como que falló. */
      if (ult.ok) {
        try { q('.cpg-subidos').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
      }
    }

    function parte() {
      var p = q('.cpg-parte');
      var h = '';
      if (ult.ok) h += '<div class="cpg-mini cpg-ok" style="margin-top:9px">✓ ' + ult.ok +
        (ult.ok === 1 ? ' archivo subido' : ' archivos subidos') + '</div>';
      if (window.cpVideo) h += window.cpVideo.noEntraron(ult.fallos);
      p.innerHTML = h;
    }

    /* ---------- lo ya subido ---------- */
    function pinta() {
      var l = (cfg.lee() || []);
      var c = q('.cpg-subidos');
      if (!l.length) { c.innerHTML = '<div class="cpg-vacio">Todavía no hay nada subido.</div>'; return; }
      c.innerHTML = l.map(function (f, i) {
        var v = esVideo(f);
        return '<div class="cpg-it' + (i === 0 ? ' cpg-port' : '') + '">' +
          '<div class="cpg-vis">' +
            (v ? '<video src="' + esc(f.url) + '" muted></video>' : '<img src="' + esc(f.url) + '" alt="">') +
            '<span class="cpg-eti' + (v ? ' cpg-v' : '') + '">' + (v ? '▶ VIDEO' : 'FOTO') + '</span>' +
            (i === 0 ? '<span class="cpg-port-b">PORTADA</span>' : '') +
            '<button type="button" class="cpg-x" data-del="' + esc(f.url) + '" title="Quitar">✕</button>' +
          '</div>' +
          '<div class="cpg-pie">' +
            '<select data-rol="' + esc(f.url) + '">' +
              '<option value="p"' + (i === 0 ? ' selected' : '') + '>Principal</option>' +
              '<option value="s"' + (i === 0 ? '' : ' selected') + '>Secundaria</option>' +
            '</select>' +
            '<div class="cpg-bb">' +
              '<button type="button" data-izq="' + i + '"' + (i === 0 ? ' disabled' : '') + ' title="Mover antes">←</button>' +
              (v ? '' : '<button type="button" data-crop="' + esc(f.url) + '" title="Ancho, alto y centrado">⤢</button>') +
              '<button type="button" data-der="' + i + '"' + (i === l.length - 1 ? ' disabled' : '') + ' title="Mover después">→</button>' +
            '</div>' +
          '</div></div>';
      }).join('');

      function urls() { return (cfg.lee() || []).map(function (x) { return x.url; }); }
      async function reordena(a, b2) {
        var u = urls(); if (b2 < 0 || b2 >= u.length) return;
        var t = u[a]; u[a] = u[b2]; u[b2] = t;
        try { var j = await cfg.api({ orden: u }); cfg.pon(j.fotos || []); pinta(); if (cfg.tras) cfg.tras(); }
        catch (e) { alert('No se pudo mover: ' + ((e && e.message) || e)); }
      }

      Array.prototype.forEach.call(c.querySelectorAll('[data-izq]'), function (b) {
        b.onclick = function () { var i = Number(b.getAttribute('data-izq')); reordena(i, i - 1); };
      });
      Array.prototype.forEach.call(c.querySelectorAll('[data-der]'), function (b) {
        b.onclick = function () { var i = Number(b.getAttribute('data-der')); reordena(i, i + 1); };
      });
      /* «Principal» no es una etiqueta guardada: es estar primero. Elegirlo la
         manda al frente, que es lo mismo y no necesita columna nueva. */
      Array.prototype.forEach.call(c.querySelectorAll('[data-rol]'), function (s) {
        s.onchange = async function () {
          var u = s.getAttribute('data-rol'), o = urls();
          var n = s.value === 'p' ? [u].concat(o.filter(function (x) { return x !== u; }))
                                 : o.filter(function (x) { return x !== u; }).concat([u]);
          try { var j = await cfg.api({ orden: n }); cfg.pon(j.fotos || []); pinta(); if (cfg.tras) cfg.tras(); }
          catch (e) { alert('No se pudo: ' + ((e && e.message) || e)); }
        };
      });
      Array.prototype.forEach.call(c.querySelectorAll('[data-del]'), function (b) {
        b.onclick = async function () {
          if (!confirm('¿Quitar este archivo?')) return;
          try { var j = await cfg.api({ quitar: b.getAttribute('data-del') }); cfg.pon(j.fotos || []); pinta(); if (cfg.tras) cfg.tras(); }
          catch (e) { alert('No se pudo quitar: ' + ((e && e.message) || e)); }
        };
      });
      /* Volver a encuadrar una que ya está arriba, sin resubirla a mano: se
         recorta, se sube la nueva, se quita la vieja y ocupa su mismo sitio. */
      Array.prototype.forEach.call(c.querySelectorAll('[data-crop]'), function (b) {
        b.onclick = function () {
          var u = b.getAttribute('data-crop'), pos = urls().indexOf(u);
          if (!window.sincCrop) return;
          window.sincCrop.open(u, { only: soloV ? 'v' : null, titulo: 'Ancho, alto y centrado' }, async function (r) {
            var bl = r && (soloV ? (r.vBlob || r.hBlob) : (r.hBlob || r.vBlob));
            if (!bl) return;
            try {
              var j = await cfg.api({ imagen: await leeDataUri(bl) });
              var nuevas = j.fotos || [], nueva = nuevas[nuevas.length - 1];
              if (nueva) {
                var j2 = await cfg.api({ quitar: u });
                var lista = (j2.fotos || []).map(function (x) { return x.url; });
                lista.splice(lista.indexOf(nueva.url), 1);
                lista.splice(pos, 0, nueva.url);
                var j3 = await cfg.api({ orden: lista });
                cfg.pon(j3.fotos || j2.fotos || nuevas);
              } else cfg.pon(nuevas);
              pinta(); if (cfg.tras) cfg.tras();
            } catch (e) { alert('No se pudo guardar el recorte: ' + ((e && e.message) || e)); }
          });
        };
      });
    }

    /* ---------- enganches ---------- */
    zona.onclick = function () { file.click(); };
    zona.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    file.onchange = function () { encola(this.files); this.value = ''; };
    ['dragenter', 'dragover'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('cpg-hot'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('cpg-hot'); });
    });
    zona.addEventListener('drop', function (e) { encola(e.dataTransfer && e.dataTransfer.files); });

    q('.cpg-todo').onclick = subeTodo;
    q('.cpg-limpia').onclick = function () { COLA = []; pintaCola(); };

    q('.cpg-ligas').onclick = async function () {
      var ta = host.querySelector('textarea');
      var ligas = String(ta.value || '').split(/[\s,]+/).filter(Boolean);
      if (!ligas.length) return;
      this.disabled = true; var t = this.textContent; this.textContent = 'Trayéndolas…';
      ult = { ok: 0, fallos: [] };
      try {
        var j = await cfg.api({ ligas: ligas });
        cfg.pon(j.fotos || []);
        ult.ok = ligas.length - (j.fallaron || 0);
        (j.detalle || []).forEach(function (d) {
          var c = String(d).split(': ');
          ult.fallos.push({ nombre: c[0], motivo: c.slice(1).join(': ') || 'no se pudo traer' });
        });
        ta.value = '';
        pinta();
      } catch (e) {
        ult.fallos.push({ nombre: 'las ligas', motivo: (e && e.message) || 'no se pudieron traer' });
      }
      parte();
      this.disabled = false; this.textContent = t;
      if (cfg.tras) cfg.tras();
    };

    pinta();
    return { pinta: pinta };
  }

  window.cpGaleria = { monta: monta };
})();
