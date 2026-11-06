/* ============================================================
   cp-dialogo.js — Preguntar sin pop-up del navegador
   Grupo Casa Pepe · 27-oct-2026

     <script src="/cp-dialogo.js" defer></script>

   Javi, desde siempre: «nunca pop-ups del navegador; ese
   "grupocasapepe.netlify.app dice" rompe la casa». Y en la noche
   de la traduccion salio la otra mitad del problema: confirm() y
   alert() se escriben en espanol y no hay manera de traducirlos,
   porque los pinta el navegador, no nosotros. Asi que las tres
   preguntas se hacen aqui dentro, en la pagina, con nuestra letra
   y en el idioma que toque.

   Tres funciones, las tres devuelven una promesa:

     await cpPregunta('¿Borramos la foto?')        → true / false
     await cpAviso('No se pudo guardar.')          → undefined
     await cpPide('¿Como se llama la casa?', '')   → texto / null

   Opciones de cpPregunta: {si, no, grave}. `grave:true` pone el
   boton de confirmar en rojo (borrar, quitar, cancelar).
   Opciones de cpPide: {si, no, marca} (`marca` = placeholder).

   El texto se traduce solo: si la pantalla carga sinc-i18n.js o
   apepe/idioma.js, se pasa por su diccionario. Si no, sale tal cual.
   Los saltos de linea del texto se respetan.
   ============================================================ */
(function (global) {
  'use strict';

  /* Cualquiera de los dos diccionarios sirve; el que haya. */
  function T(s) {
    if (s == null) return '';
    s = String(s);
    try { if (global.sincI18n && global.sincI18n.t) return global.sincI18n.t(s); } catch (_) {}
    try { if (global.apepeT) return global.apepeT(s); } catch (_) {}
    return s;
  }

  var CSS = [
    '.cpd-fondo{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
      'justify-content:center;padding:18px;background:rgba(30,26,22,.46);',
      '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',
    '.cpd-caja{width:100%;max-width:420px;background:var(--blanco,var(--surface,#fff));',
      'color:var(--tinta,var(--ink,#241c14));border-radius:14px;padding:20px;',
      'box-shadow:0 1px 1px rgba(30,26,22,.06),0 24px 50px -24px rgba(30,26,22,.55);',
      'font:15px/1.45 Inter,system-ui,-apple-system,sans-serif}',
    '.cpd-txt{white-space:pre-line;margin:0 0 14px}',
    '.cpd-in{width:100%;box-sizing:border-box;font:15px/1.4 inherit;padding:10px 12px;',
      'margin:0 0 14px;color:inherit;background:var(--papel,var(--ground,#FBF7F2));',
      'border:1px solid var(--linea,var(--rule,#E6DFD6));border-radius:10px}',
    '.cpd-in:focus{outline:2px solid var(--naranja,var(--green,#C9501A));outline-offset:1px}',
    '.cpd-pie{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
    '.cpd-b{font:600 14px/1 Inter,system-ui,sans-serif;padding:11px 16px;border-radius:10px;',
      'border:1px solid transparent;cursor:pointer;min-height:42px}',
    '.cpd-b.no{background:transparent;color:var(--gris,var(--muted,#6E665C));',
      'border-color:var(--linea,var(--rule,#E6DFD6))}',
    '.cpd-b.si{background:var(--naranja,var(--green,#C9501A));color:#fff}',
    '.cpd-b.si.grave{background:var(--error,#9E3B2E)}',
    '.cpd-b:focus-visible{outline:2px solid var(--tinta,var(--ink,#241c14));outline-offset:2px}',
    '.cpd-et{display:block;font:600 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.08em;',
      'text-transform:uppercase;color:var(--gris,var(--muted,#6E665C));margin:0 0 4px}',
    '.cpd-et .cpd-in{margin-top:4px}',
    '.cpd-mal{font:13px/1.4 Inter,system-ui,sans-serif;color:var(--error,#9E3B2E);margin:0 0 10px}',
    /* El retrato: se ve el que hay, y si no hay se ve que no hay. Un campo de
       archivo a secas no dice si la persona ya tiene foto. Javi, 6-nov-2026. */
    /* El numero del telefono viene de tel-pais y se vestia con lo que hubiera
       en la pagina de debajo: al lado de los demas campos del dialogo parecia
       de otro formulario. Se le pone la misma ropa. */
    '.cpd-caja .tp-num{font:15px/1.4 inherit;padding:10px 12px;color:inherit;',
      'background:var(--papel,var(--ground,#FBF7F2));',
      'border:1px solid var(--linea,var(--rule,#E6DFD6));border-radius:10px}',
    '.cpd-caja .tp-num:focus{outline:2px solid var(--naranja,var(--green,#C9501A));outline-offset:1px}',
    '.cpd-caja .tp-pais{border-radius:10px;border-width:1px;padding-top:10px;padding-bottom:10px}',
    '.cpd-foto{display:flex;align-items:center;gap:12px;margin:4px 0 14px}',
    '.cpd-ret{width:68px;height:68px;border-radius:50%;flex:none;background-size:cover;',
      'background-position:center;border:1.5px solid var(--linea,var(--rule,#E6DFD6));',
      'background-color:var(--papel,var(--ground,#FBF7F2))}',
    '.cpd-ret.vacio{background-image:url("data:image/svg+xml;utf8,',
      '%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E',
      '%3Cg fill=%27%23C3BBAE%27%3E%3Ccircle cx=%2712%27 cy=%279%27 r=%273.6%27/%3E',
      '%3Cpath d=%27M4.8 19.2c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4z%27/%3E%3C/g%3E%3C/svg%3E");',
      'background-size:74%;background-repeat:no-repeat}',
    '@media (max-width:420px){.cpd-pie{flex-direction:column-reverse}.cpd-b{width:100%}}'
  ].join('');

  var cssPuesto = false;
  function ponCSS() {
    if (cssPuesto) return;
    cssPuesto = true;
    var s = document.createElement('style');
    s.setAttribute('data-cpd', '1');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* El barredor de idioma anda por los nodos de texto cada vez que
     cambia el DOM; el dialogo ya nace traducido, asi que no hace falta
     que lo toque, pero tampoco molesta: lo que hay dentro no es llave. */
  function monta(opc) {
    ponCSS();
    return new Promise(function (listo) {
      var fondo = document.createElement('div');
      fondo.className = 'cpd-fondo';
      fondo.setAttribute('role', 'dialog');
      fondo.setAttribute('aria-modal', 'true');

      var caja = document.createElement('div');
      caja.className = 'cpd-caja';

      var p = document.createElement('p');
      p.className = 'cpd-txt';
      p.textContent = opc.texto;
      caja.appendChild(p);

      var campo = null, campos = null, porMontar = [];
      if (opc.tipo === 'pide') {
        campo = document.createElement('input');
        campo.className = 'cpd-in';
        campo.type = 'text';
        campo.value = opc.valor == null ? '' : String(opc.valor);
        if (opc.marca) campo.placeholder = opc.marca;
        caja.appendChild(campo);
      } else if (opc.tipo === 'varios') {
        campos = [];
        opc.campos.forEach(function (c) {
          var l = document.createElement('label');
          l.className = 'cpd-et';
          l.textContent = c.et + (c.req ? ' *' : '');
          /* Elegir de una lista cerrada no es escribir. Hasta hoy todo campo
             era un <input>, asi que preguntar «¿de que casa es?» obligaba a
             teclear el nombre y a que coincidiera. Con `tipo:'select'` y
             `opciones:[[valor,texto],...]` se elige, que es lo que toca
             cuando las respuestas posibles se cuentan con los dedos.
             Javi, 5-nov-2026. */
          var i, yaPuesto = false;
          /* UNA FOTO TAMBIEN ES UN CAMPO. Javi, 6-nov-2026: la ficha del guia
             se pide desde Programacion y lleva su retrato. Un <input type=file>
             no devuelve texto sino un archivo, asi que para estos campos lo que
             sale en el resultado es el File -o null si no eligio ninguno-, y
             quien llama lo sube donde toque. */
          /* EL CELULAR, CON SU BANDERA. Javi, 6-nov-2026: «pon la opcion de
             seleccionar prefijo en el celular». Es su regla de siempre: un
             telefono sin lada no sirve para escribirle a nadie. Se reusa
             tel-pais.js, que ya hace esto en el alta y en el checkout; si la
             pantalla no lo carga, se queda un campo de texto normal y no se
             rompe nada. El valor que sale es el numero ya internacional. */
          if (c.tipo === 'tel' && global.telPais && global.telPais.monta) {
            /* Se deja el hueco y se monta DESPUES, cuando el dialogo ya esta
               en la pagina: tel-pais busca sus campos con getElementById y
               antes de eso todavia no existen. */
            var cajaT = document.createElement('div');
            l.appendChild(cajaT);
            porMontar.push({ k: c.k, caja: cajaT, valor: c.valor || '' });
            i = document.createElement('input');
            i.type = 'hidden';
            yaPuesto = true;
            l.appendChild(i);
          } else if (c.tipo === 'foto') {
            /* Lo que se ve es el retrato; el <input type=file> va escondido
               detras del boton. Devuelve el File igual que 'file'. */
            var cajaF = document.createElement('div');
            cajaF.className = 'cpd-foto';
            var ret = document.createElement('div');
            ret.className = 'cpd-ret';
            var hay = /^https?:\/\//i.test(String(c.valor || ''));
            if (hay) ret.style.backgroundImage = 'url("' + String(c.valor).replace(/["\\]/g, '') + '")';
            else ret.className += ' vacio';
            var bot = document.createElement('button');
            bot.type = 'button';
            bot.className = 'cpd-b no';
            bot.textContent = T(hay ? 'Cambiar la foto' : 'Subir una foto');
            i = document.createElement('input');
            i.type = 'file';
            i.accept = c.acepta || 'image/*';
            i.style.display = 'none';
            bot.onclick = function () { i.click(); };
            i.onchange = function () {
              var f = i.files && i.files[0];
              if (!f) return;
              try {
                ret.style.backgroundImage = 'url("' + URL.createObjectURL(f) + '")';
                ret.className = 'cpd-ret';
              } catch (_) {}
              bot.textContent = T('Cambiar la foto');
            };
            cajaF.appendChild(ret);
            cajaF.appendChild(bot);
            l.appendChild(cajaF);
          } else if (c.tipo === 'file') {
            i = document.createElement('input');
            i.className = 'cpd-in';
            i.type = 'file';
            if (c.acepta) i.accept = c.acepta;
          } else if (c.tipo === 'select') {
            i = document.createElement('select');
            i.className = 'cpd-in';
            (c.opciones || []).forEach(function (o) {
              var op = document.createElement('option');
              op.value = String(o[0]);
              op.textContent = String(o[1] == null ? o[0] : o[1]);
              i.appendChild(op);
            });
            if (c.valor) i.value = c.valor;
          } else {
            i = document.createElement('input');
            i.className = 'cpd-in';
            i.type = c.tipo;
            i.value = c.valor;
            if (c.marca) i.placeholder = c.marca;
          }
          /* El de telefono ya vive dentro de su fila con el desplegable:
             volver a colgarlo de la etiqueta lo sacaria de ahi. */
          if (!yaPuesto) l.appendChild(i);
          caja.appendChild(l);
          campos.push({ k: c.k, et: c.et, req: c.req, el: i });
        });
      }
      var aviso = document.createElement('div');
      aviso.className = 'cpd-mal';
      aviso.hidden = true;
      caja.appendChild(aviso);

      var pie = document.createElement('div');
      pie.className = 'cpd-pie';

      var bNo = null;
      if (opc.tipo !== 'aviso') {
        bNo = document.createElement('button');
        bNo.type = 'button';
        bNo.className = 'cpd-b no';
        bNo.textContent = opc.no;
        pie.appendChild(bNo);
      }

      var bSi = document.createElement('button');
      bSi.type = 'button';
      bSi.className = 'cpd-b si' + (opc.grave ? ' grave' : '');
      bSi.textContent = opc.si;
      pie.appendChild(bSi);

      caja.appendChild(pie);
      fondo.appendChild(caja);

      var antes = document.activeElement;
      function fin(v) {
        document.removeEventListener('keydown', tecla, true);
        if (fondo.parentNode) fondo.parentNode.removeChild(fondo);
        try { if (antes && antes.focus) antes.focus(); } catch (_) {}
        listo(v);
      }
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(opc.nada); }
        else if (e.key === 'Enter' && (!campo || e.target === campo) && opc.tipo !== 'varios') {
          e.preventDefault(); e.stopPropagation(); acepta();
        }
      }
      function acepta() {
        if (opc.tipo === 'varios') {
          var faltan = campos.filter(function (c) {
            if (c.el.type === 'file') return c.req && !(c.el.files && c.el.files.length);
            if (c.el._tp) return c.req && !c.el._tp.valido();
            return c.req && !c.el.value.trim();
          });
          if (faltan.length) {
            aviso.textContent = opc.falta + ' ' + faltan.map(function (c) { return c.et; }).join(', ');
            aviso.hidden = false;
            try { faltan[0].el.focus(); } catch (_) {}
            return;
          }
          var out = {};
          campos.forEach(function (c) {
            out[c.k] = (c.el.type === 'file')
              ? ((c.el.files && c.el.files[0]) || null)
              : (c.el._tp ? c.el._tp.valor() : c.el.value.trim());
          });
          fin(out);
          return;
        }
        if (opc.tipo === 'pide') fin(campo.value);
        else fin(opc.tipo === 'aviso' ? undefined : true);
      }

      bSi.onclick = acepta;
      if (bNo) bNo.onclick = function () { fin(opc.nada); };
      /* Clic en el fondo = cancelar, igual que en el resto de la casa. */
      fondo.onclick = function (e) { if (e.target === fondo) fin(opc.nada); };

      document.addEventListener('keydown', tecla, true);
      (document.body || document.documentElement).appendChild(fondo);

      /* Ya esta en la pagina: ahora si se pueden montar los telefonos. */
      porMontar.forEach(function (m) {
        var tp = global.telPais.monta(m.caja, { valor: m.valor });
        if (!tp || !tp.input) return;
        tp.input._tp = tp;
        campos.forEach(function (c) { if (c.k === m.k) c.el = tp.input; });
      });
      try { ((campos && campos[0] && campos[0].el) || campo || bSi).focus(); if (campo) campo.select(); } catch (_) {}
    });
  }

  function cpPregunta(texto, o) {
    o = o || {};
    return monta({
      tipo: 'pregunta', texto: T(texto), grave: !!o.grave, nada: false,
      si: T(o.si || (o.grave ? 'Sí, borrar' : 'Sí')), no: T(o.no || 'Cancelar')
    });
  }

  function cpAviso(texto, o) {
    o = o || {};
    return monta({ tipo: 'aviso', texto: T(texto), nada: undefined, si: T(o.si || 'Entendido') });
  }

  /* Varios campos de una vez, para las altas cortas: el alta del guia desde
     Programacion, sin salir a Mi cuenta a por ella. Devuelve un objeto con
     los valores, o null si se cancela. Javi, 27-oct-2026. */
  function cpPideVarios(texto, campos, o) {
    o = o || {};
    campos = campos || [];
    return monta({
      tipo: 'varios', texto: T(texto), nada: null,
      campos: campos.map(function (c) {
        return { k: c.k, et: T(c.et || c.k), req: !!c.req, valor: c.valor == null ? '' : String(c.valor),
                 marca: c.marca ? T(c.marca) : '', tipo: c.tipo || 'text',
                 acepta: c.acepta || '', opciones: c.opciones || null };
      }),
      si: T(o.si || 'Guardar'), no: T(o.no || 'Cancelar'),
      falta: T(o.falta || 'Falta por rellenar:')
    });
  }

  function cpPide(texto, valor, o) {
    o = o || {};
    return monta({
      tipo: 'pide', texto: T(texto), valor: valor, marca: o.marca ? T(o.marca) : '',
      nada: null, si: T(o.si || 'Guardar'), no: T(o.no || 'Cancelar')
    });
  }

  global.cpPregunta = cpPregunta;
  global.cpAviso = cpAviso;
  global.cpPide = cpPide;
  global.cpPideVarios = cpPideVarios;
  global.cpDialogo = { pregunta: cpPregunta, aviso: cpAviso, pide: cpPide, pideVarios: cpPideVarios, t: T };
})(window);
