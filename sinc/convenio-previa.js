/* EL CONVENIO DE VERDAD, ANTES DE QUE EXISTA LA FICHA.
 * ---------------------------------------------------------------------------
 * Javi, 29-oct-2026: «tenemos que cambiar el que se ve en pantalla por el
 * nuevo que hiciste ayer».
 *
 * El paso 7 del alta enseñaba un resumen escrito a mano: ocho titulares con lo
 * esencial. Estaba bien como aperitivo y mal como contrato, porque lo que se
 * firma es otro documento —veintidós cláusulas y cinco anexos— que hasta ahora
 * el ateneísta no veía hasta después de darse de alta, desde su portal. Firmar
 * un resumen y recibir luego el texto largo es firmar a ciegas.
 *
 * Así que aquí se arma el MISMO documento, con el MISMO texto y las MISMAS
 * reglas que usa `operador-contrato` cuando lo genera de verdad:
 *
 *   plantilla  ->  condicionales(caps)  ->  rellenar(datos)  ->  md2html
 *
 * La plantilla sale de `sinc_convenio_plantilla()`, que devuelve lo que hay en
 * `op_contrato_plantilla`. Una sola fuente: si mañana se cambia una cláusula,
 * cambia en los dos sitios a la vez, porque es el mismo renglón de la base.
 *
 * Lo que NO hace: no firma, no guarda, no crea folio. Es la lectura previa. El
 * documento con folio y acuse lo sigue creando la función de siempre, que es
 * la única que escribe.
 *
 * Por qué está duplicado el md2html: la función vive en Deno, del otro lado de
 * la red, y necesita una sesión y un operador_id que en el alta todavía no
 * existen. Portarlo es tres docenas de líneas; abrirle una puerta pública a la
 * función para que acepte datos sueltos sería una puerta que escribe.
 */
window.convenioPrevia = (function () {
  'use strict';

  var SB  = 'https://rehophywchakfapivsbh.supabase.co';
  var KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --- markdown sencillo a HTML. Copiado regla por regla del de la función:
         sólo ** es negrita (los guiones bajos son los espacios en blanco del
         contrato y no deben volverse cursiva), el `> REVISAR:` se salta, el
         `---` da <hr>, los `#` dan encabezados hasta h5, los `-`/`*` dan
         lista, y las filas de pipes dan tabla —la plantilla trae 59—. --- */
  function md2html(md) {
    var out = [], lista = false, tabla = false;
    function fmt(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
    function celdas(l) {
      return l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
    }
    function cerrarLista() { if (lista) { out.push('</ul>'); lista = false; } }
    function cerrarTabla() { if (tabla) { out.push('</tbody></table>'); tabla = false; } }

    var lineas = String(md || '').split(/\r?\n/);
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i].trim();
      if (!l) { cerrarLista(); cerrarTabla(); continue; }
      if (l.indexOf('> REVISAR:') === 0) continue;
      if (l === '---') { cerrarLista(); cerrarTabla(); out.push('<hr>'); continue; }
      if (/^\|/.test(l)) {
        if (/^\|[\s|:-]+\|?$/.test(l)) continue;
        cerrarLista();
        if (!tabla) { out.push('<table><tbody>'); tabla = true; }
        out.push('<tr>' + celdas(l).map(function (c) { return '<td>' + fmt(c) + '</td>'; }).join('') + '</tr>');
        continue;
      }
      cerrarTabla();
      if (l.charAt(0) === '#') {
        cerrarLista();
        var n = Math.min((l.match(/^#+/) || ['#'])[0].length + 1, 5);
        out.push('<h' + n + '>' + fmt(l.replace(/^#+\s*/, '')) + '</h' + n + '>');
        continue;
      }
      if (/^[-*]\s+/.test(l)) {
        if (!lista) { out.push('<ul>'); lista = true; }
        out.push('<li>' + fmt(l.replace(/^[-*]\s+/, '')) + '</li>');
        continue;
      }
      cerrarLista();
      out.push('<p>' + fmt(l) + '</p>');
    }
    cerrarLista(); cerrarTabla();
    return out.join('\n');
  }

  /* Un dato que falta deja una raya visible, no un hueco mudo: así se ve que
     ahí falta algo en vez de leer una frase coja. */
  function rellenar(md, datos) {
    return String(md).replace(/\{\{([A-Z0-9_]+)\}\}/g, function (_m, k) {
      var v = datos[k];
      return (v === undefined || v === null || String(v) === '') ? '__________' : String(v);
    });
  }

  /* Los bloques por capacidad. Se resuelven ANTES de rellenar, porque un
     bloque que se cae se lleva sus marcadores con él. El salto de línea se
     captura y se devuelve cuando el bloque se queda: sin eso los quince
     bloques que viven dentro de una fila de tabla se pegan unos a otros en un
     solo renglón y la tabla deja de ser una tabla. */
  function condicionales(md, caps) {
    function tiene(k) { return caps.indexOf(k) >= 0; }
    var t = String(md);
    for (var i = 0; i < 12; i++) {
      var antes = t;
      t = t.replace(/\[\[SOLO:([a-z_]+)\]\]([\s\S]*?)\[\[\/SOLO\]\](\n?)/g,
        function (_m, k, cuerpo, nl) { return tiene(String(k)) ? cuerpo + nl : ''; });
      t = t.replace(/\[\[NO:([a-z_]+)\]\]([\s\S]*?)\[\[\/NO\]\](\n?)/g,
        function (_m, k, cuerpo, nl) { return tiene(String(k)) ? '' : cuerpo + nl; });
      if (t === antes) break;
    }
    /* Marca suelta —una apertura sin su cierre—: se borra la marca y se deja el
       texto. Un contrato con `[[SOLO:x]]` impreso es peor que uno con un
       párrafo de más. */
    return t.replace(/\[\[\/?(?:SOLO|NO):?[a-z_]*\]\]/g, '');
  }

  function fechaLarga(d) {
    try {
      return d.toLocaleDateString('es-MX',
        { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
    } catch (_) { return d.toISOString().slice(0, 10); }
  }

  /* La plantilla se pide UNA vez y se guarda: el paso se repinta a cada tecla
     que escribe en «quién firma», y no se va a pedir el contrato entero por
     cada letra. */
  var CACHE = null;
  async function carga() {
    if (CACHE) return CACHE;
    var r = await fetch(SB + '/rest/v1/rpc/sinc_convenio_plantilla', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!r.ok) throw new Error('no se pudo leer la plantilla (' + r.status + ')');
    var j = await r.json();
    var f = (j && j[0]) || null;
    if (!f || !f.cuerpo_md) throw new Error('no hay plantilla cargada');
    CACHE = f;
    return f;
  }

  /* LAS CASAS, EN EL CONVENIO. El marcador {{CASAS}} existía en la plantilla y
     salía en blanco porque la función que la rellena no tenía de dónde
     sacarlas. Aquí sí: las acaba de escribir en el paso de «Tu hotel». */
  function tablaCasas(D) {
    var l = (D.casas || []).filter(function (c) { return (c.nombre || '').trim(); });
    if (!l.length) return '';
    var tot = 0;
    var filas = l.map(function (c) {
      var q = parseInt(c.cuartos, 10) || 0; tot += q;
      return '| ' + c.nombre.trim() + ' | ' + (q ? q : '__________') + ' |';
    });
    return '| Casa | Cuartos |\n| :---- | :---- |\n' + filas.join('\n') +
           '\n| **Total** | **' + tot + '** |';
  }

  function tipoPersona(t) {
    return t === 'moral' ? 'Moral'
      : (t === 'fisica' ? 'Física con actividad empresarial'
      : (t === 'fisica_sin' ? 'Física sin actividad empresarial' : ''));
  }

  /* Los números son los MISMOS que el paso de «¿Cómo te pagamos?» acaba de
     enseñar, y los mismos que `alta_ateneista` escribe en la ficha. Si aquí se
     escribieran otros, el convenio contradiría la pantalla anterior. */
  function datosDe(D, identificacion) {
    var caps = D.capacidades || [];
    var hoy = new Date();
    var casas = (D.casas || []).filter(function (c) { return (c.nombre || '').trim(); });
    var cuartos = D.hotel_tipo === 'grupo'
      ? casas.reduce(function (a, c) { return a + (parseInt(c.cuartos, 10) || 0); }, 0)
      : (parseInt(D.cuartos, 10) || '');
    return {
      FOLIO: 'se asigna al firmar',
      FECHA: fechaLarga(hoy),
      ATENEISTA: D.nombre_comercial || '',
      OPERADOR: D.nombre_comercial || '',
      RAZON_SOCIAL: D.razon_social || '',
      TIPO_PERSONA: tipoPersona(D.tipo_persona),
      IDENTIFICACION: identificacion || '',
      RFC: D.rfc || '',
      CURP: D.curp || '',
      NACIONALIDAD: D.nacionalidad || '',
      CIUDAD: D.ciudad || '',
      DOMICILIO: D.ciudad || '',
      PLAZA: String(D.sede || '') === 'puebla' ? 'Puebla' : 'Ciudad de México',
      FIRMANTE: D.contrato_firmante || '',
      REPRESENTANTE: D.administrador || D.contrato_firmante || '',
      EMAIL: D.email || '',
      EMAIL_NOTIFICACIONES: D.email_notificaciones || D.email || '',
      WHATSAPP: D.whatsapp || '',
      WEB: D.web || D.instagram || '',
      POLIZA: D.tiene_poliza === true
        ? [D.poliza_aseguradora, D.poliza_numero, D.poliza_vigencia ? 'vigente hasta ' + D.poliza_vigencia : '']
            .filter(Boolean).join(' · ') || 'Póliza propia declarada en el alta.'
        : 'Sin póliza propia al firmar. Se obliga a contratarla y entregarla dentro de los 30 días naturales siguientes (cláusula SÉPTIMA); mientras tanto opera bajo su propio riesgo.',
      CAPACIDADES: caps.join(' · '),
      HOTEL_TIPO: D.hotel_tipo === 'grupo' ? 'Un grupo o cadena de hoteles' : 'Un hotel',
      CUARTOS: cuartos === '' ? '' : String(cuartos),
      CASAS: tablaCasas(D),
      COBRO_EXPERIENCIAS: D.pago_experiencias === 'dos_cobros'
        ? 'EL PONTIGU cobra el anticipo al reservar y EL ATENEÍSTA cobra el resto el día de la actividad.'
        : 'El cobro cae en la cuenta de Stripe de EL ATENEÍSTA y la comisión se retiene en el mismo cargo.',
      CUENTA: D.pago_experiencias === 'dos_cobros'
        ? 'No hace falta cuenta registrada: EL ATENEÍSTA cobra el resto directamente el día de la actividad.'
        : 'La cuenta bancaria que EL ATENEÍSTA registre en su cuenta de Stripe. EL PONTIGU no la captura ni la conserva. Por conectar desde su portal.',
      BANCO: '', CLABE: '', TITULAR_CUENTA: '', CONTADOR: '',
      RNT: 'No declarado',
      COMISION: '25%',
      COMISION_EVENTOS: '35%',
      COMISION_ARTESANIA: '35%',
      PCT_VIAJES_ARTESANIA: '5%',
      COMISION_ESPACIOS: '',
      PCT_CONCIERGE: '10%',
      PCT_HOTEL: '5%',
      PCT_PLATAFORMA: '10%',
      PCT_SERVICIOS_EVENTO: '10%',
      HORAS_CONFIRMACION: '4',
      QUIEN_FACTURA: 'EL ATENEÍSTA',
      EXPERIENCIAS: 'Todavía no hay actividades cargadas. Se agregan a este anexo conforme se publiquen.',
      ESPACIOS: '', MODULOS: '',
      FECHA_FIRMA: '', FECHA_FIRMA_OPERADOR: ''
    };
  }

  /* Devuelve el HTML del convenio con los datos del alta, o lanza. Quien llama
     decide qué hacer si falla —en el alta, quedarse con el resumen—, porque
     quedarse sin paso 7 sería peor que leer un resumen. */
  async function arma(D, identificacion) {
    var pla = await carga();
    var caps = (D.capacidades && D.capacidades.length) ? D.capacidades : ['experiencias'];
    return {
      version: pla.version,
      html: md2html(rellenar(condicionales(pla.cuerpo_md, caps), datosDe(D, identificacion)))
    };
  }

  return { arma: arma, carga: carga, md2html: md2html,
           rellenar: rellenar, condicionales: condicionales };
})();
