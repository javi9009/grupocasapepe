/* tel-pais.js — el WhatsApp con su bandera, y obligatorio.
   Javi, 4-oct-2026: «no pongas los cels opcionales, ponlo y con el dropdown de
   nacionalidad». Un teléfono sin lada no sirve para escribirle a nadie: el
   huésped de fuera teclea su número de casa y nadie lo puede contactar. Aquí se
   elige país —México primero, que es la mayoría— y el número se guarda ya en
   formato internacional. */
(function (global) {
  var PAISES = [
    ['MX', 'México', '52'], ['US', 'Estados Unidos', '1'], ['CA', 'Canadá', '1'],
    ['ES', 'España', '34'], ['AR', 'Argentina', '54'], ['BR', 'Brasil', '55'],
    ['CO', 'Colombia', '57'], ['CL', 'Chile', '56'], ['PE', 'Perú', '51'],
    ['UY', 'Uruguay', '598'], ['EC', 'Ecuador', '593'], ['CR', 'Costa Rica', '506'],
    ['GT', 'Guatemala', '502'], ['PA', 'Panamá', '507'], ['DO', 'R. Dominicana', '1'],
    ['CU', 'Cuba', '53'], ['VE', 'Venezuela', '58'], ['BO', 'Bolivia', '591'],
    ['PY', 'Paraguay', '595'], ['HN', 'Honduras', '504'], ['SV', 'El Salvador', '503'],
    ['NI', 'Nicaragua', '505'], ['PR', 'Puerto Rico', '1'],
    ['GB', 'Reino Unido', '44'], ['FR', 'Francia', '33'], ['DE', 'Alemania', '49'],
    ['IT', 'Italia', '39'], ['PT', 'Portugal', '351'], ['NL', 'Países Bajos', '31'],
    ['BE', 'Bélgica', '32'], ['CH', 'Suiza', '41'], ['AT', 'Austria', '43'],
    ['IE', 'Irlanda', '353'], ['SE', 'Suecia', '46'], ['NO', 'Noruega', '47'],
    ['DK', 'Dinamarca', '45'], ['FI', 'Finlandia', '358'], ['PL', 'Polonia', '48'],
    ['CZ', 'Chequia', '420'], ['GR', 'Grecia', '30'], ['RO', 'Rumanía', '40'],
    ['RU', 'Rusia', '7'], ['TR', 'Turquía', '90'], ['IL', 'Israel', '972'],
    ['AU', 'Australia', '61'], ['NZ', 'Nueva Zelanda', '64'], ['JP', 'Japón', '81'],
    ['KR', 'Corea del Sur', '82'], ['CN', 'China', '86'], ['IN', 'India', '91'],
    ['ZA', 'Sudáfrica', '27'], ['MA', 'Marruecos', '212']
  ];

  function bandera(iso) {
    return String.fromCodePoint.apply(null, iso.toUpperCase().split('')
      .map(function (c) { return 127397 + c.charCodeAt(0); }));
  }

  function monta(caja, op) {
    op = op || {};
    var id = op.id || ('tp' + Math.random().toString(36).slice(2, 7));
    var caj = typeof caja === 'string' ? document.getElementById(caja) : caja;
    if (!caj) return null;

    caj.innerHTML =
      '<div class="tp-fila">' +
        '<select class="tp-pais" id="' + id + '-p" aria-label="País">' +
          PAISES.map(function (p) {
            return '<option value="' + p[2] + '" data-iso="' + p[0] + '">' +
                   bandera(p[0]) + ' ' + p[1] + ' +' + p[2] + '</option>';
          }).join('') +
        '</select>' +
        '<input class="tp-num" id="' + id + '-n" type="tel" inputmode="tel" ' +
          'maxlength="18" required placeholder="' + (op.ejemplo || '55 1234 5678') + '">' +
      '</div>';

    if (!document.getElementById('tp-css')) {
      var s = document.createElement('style'); s.id = 'tp-css';
      s.textContent =
        /* EL DESPLEGABLE SE VESTÍA SOLO. Javi, 10-oct-2026: «configura el diseño
           del dropdown del teléfono». Heredaba el <select> del sistema —borde
           oscuro, otra altura, otra tipografía— al lado de un campo con la
           cara de Sincrético. Se le pone la misma ropa que al resto: mismo
           borde, mismo radio, misma altura, y el mismo halo al foco. */
        '.tp-fila{display:flex;gap:8px;align-items:stretch}' +
        '.tp-fila .tp-pais{flex:0 0 auto;max-width:46%;font:inherit;font-size:14px;' +
          'color:var(--tinta,#1E1A16);background:var(--blanco,#fff);' +
          'border:1.5px solid var(--linea,#E6DFD6);border-radius:9px;' +
          'padding:11px 30px 11px 12px;line-height:1.2;' +
          '-webkit-appearance:none;-moz-appearance:none;appearance:none;cursor:pointer;' +
          'background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'11\' height=\'7\' viewBox=\'0 0 11 7\'%3E%3Cpath d=\'M1 1l4.5 4.5L10 1\' fill=\'none\' stroke=\'%236E665C\' stroke-width=\'1.6\' stroke-linecap=\'round\'/%3E%3C/svg%3E");' +
          'background-repeat:no-repeat;background-position:right 11px center}' +
        '.tp-fila .tp-pais:focus{outline:none;border-color:var(--naranja,#F2682A);' +
          'box-shadow:0 0 0 3px var(--naranja-suave,#FDE7DC)}' +
        '.tp-fila .tp-num{flex:1;min-width:0}' +
        '@media(max-width:380px){.tp-fila{flex-wrap:wrap}.tp-fila .tp-pais{max-width:none;width:100%}}';
      document.head.appendChild(s);
    }

    var sel = document.getElementById(id + '-p');
    var num = document.getElementById(id + '-n');

    /* Si el huésped pega su número con lada («+34 600…»), se reconoce y se
       coloca el país solo, en vez de dejarle un +34 duplicado. */
    num.addEventListener('blur', function () {
      var v = num.value.trim();
      if (v.indexOf('+') !== 0) return;
      var d = v.replace(/[^0-9]/g, '');
      var cands = PAISES.slice().sort(function (a, b) { return b[2].length - a[2].length; });
      for (var i = 0; i < cands.length; i++) {
        if (d.indexOf(cands[i][2]) === 0) {
          sel.value = cands[i][2];
          num.value = d.slice(cands[i][2].length);
          return;
        }
      }
    });

    return {
      valor: function () {
        var d = (num.value || '').replace(/[^0-9]/g, '');
        return d ? '+' + sel.value + d : '';
      },
      pais: function () {
        var o = sel.options[sel.selectedIndex];
        return o ? o.getAttribute('data-iso') : null;
      },
      /* 7 dígitos es el número corto más corto que existe; por debajo de eso
         no es un teléfono, es un error de dedo. */
      valido: function () {
        return (num.value || '').replace(/[^0-9]/g, '').length >= 7;
      },
      foco: function () { num.focus(); },
      input: num
    };
  }

  global.telPais = { monta: monta, paises: PAISES };
})(window);
