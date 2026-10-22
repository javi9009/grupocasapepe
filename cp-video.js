/* Grupo Casa Pepe · Comprimir un video en el propio navegador, sin librerías.

   Javi, 22-oct-2026: «sube el tope y comprímelo». Las dos cosas, porque una
   sola no alcanza: el tope alto deja pasar los 30 MB de un iPhone, y esos 30 MB
   viajan en base64 —que infla un tercio más— y luego se los come el huésped
   cada vez que abre la app. Comprimir aquí los deja en dos o tres.

   Cómo, sin ffmpeg: se reproduce el video mudo, se va dibujando en un canvas
   más chico y se graba ese canvas con MediaRecorder. Es en tiempo real —un
   video de 20 segundos tarda 20 segundos— y no hay manera de que sea más
   rápido sin meter un wasm de 25 MB, que es justo lo que no queremos.

   Formato: se pide mp4 primero. Chrome y Safari lo saben grabar; Firefox no, y
   ahí sale webm, que el iPhone del huésped puede no reproducir. Cuando pasa, se
   avisa en vez de dejarlo roto en silencio.

   El audio se tira a propósito: estas portadas se reproducen solas y mudas, así
   que la pista de sonido es peso que nadie oye.

   Uso:
     cpVideo.comprime(file, {maxLado:720, kbps:1200, umbralMB:8},
       function(err, r){ r = {blob, tipo, nombre, antes, despues, comprimido, aviso} });

   Si no se puede —el navegador no sabe abrir ese códec, no hay MediaRecorder,
   o el resultado sale más gordo que el original— devuelve el archivo tal cual
   con `comprimido:false`. Nunca falla hacia un hueco. */
(function () {
  'use strict';

  var POR_DEFECTO = {
    maxLado: 720,    /* el lado largo, en píxeles */
    kbps: 1200,      /* bits de video por segundo, en miles */
    umbralMB: 8,     /* por debajo de esto no se toca: ya es ligero */
    fps: 30
  };

  /* El primero que el navegador sepa grabar. mp4 manda: es el único que
     reproduce cualquier teléfono sin preguntar.

     NUNCA 'video/mp4' a secas, y aquí está la razón, encontrada probándolo:
     un Chromium sin H.264 dice que sí a 'video/mp4' y devuelve un mp4 con VP9
     dentro. Eso es un archivo que se llama .mp4, que el servidor acepta, que
     se ve perfecto en el ordenador de quien lo subió — y que en el iPhone del
     huésped no se abre. El peor de los fallos: el que nadie ve hasta que lo ve
     un cliente. Si no hay avc1, se va a webm, que al menos no miente en el
     nombre. */
  var CANDIDATOS = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1.4D401E',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8'
  ];

  function tipoGrabable() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
    for (var i = 0; i < CANDIDATOS.length; i++) {
      try { if (MediaRecorder.isTypeSupported(CANDIDATOS[i])) return CANDIDATOS[i]; } catch (_) {}
    }
    return null;
  }

  function sinExtension(n) { return String(n || 'video').replace(/\.[^.]+$/, ''); }

  function comprime(file, opc, cb) {
    if (typeof opc === 'function') { cb = opc; opc = null; }
    var o = {};
    for (var k in POR_DEFECTO) o[k] = (opc && opc[k] != null) ? opc[k] : POR_DEFECTO[k];
    cb = cb || function () {};

    var crudo = { blob: file, tipo: file && file.type, nombre: file && file.name,
                  antes: file && file.size, despues: file && file.size, comprimido: false };

    if (!file || String(file.type || '').indexOf('video') !== 0) { cb(null, crudo); return; }
    if (file.size <= o.umbralMB * 1024 * 1024) { cb(null, crudo); return; }

    var mime = tipoGrabable();
    if (!mime || !document.createElement('canvas').captureStream) {
      crudo.aviso = 'Este navegador no sabe comprimir video. Se sube tal cual.';
      cb(null, crudo); return;
    }

    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = url;

    var acabado = false;
    function termina(err, r) {
      if (acabado) return; acabado = true;
      try { URL.revokeObjectURL(url); } catch (_) {}
      cb(err, r);
    }
    /* Si algo se atasca —un códec que el navegador acepta abrir pero no
       decodifica— no se deja al usuario mirando un «comprimiendo…» eterno:
       el original sigue siendo una respuesta válida. */
    var reloj = setTimeout(function () {
      crudo.aviso = 'La compresión tardó demasiado. Se sube el original.';
      termina(null, crudo);
    }, 1000 * 60 * 5);

    v.onerror = function () {
      clearTimeout(reloj);
      crudo.aviso = 'Este navegador no sabe abrir ese video (suele ser HEVC del iPhone). Se sube tal cual.';
      termina(null, crudo);
    };

    v.onloadedmetadata = function () {
      var W = v.videoWidth, H = v.videoHeight;
      if (!W || !H) { v.onerror(); return; }

      var k = Math.min(1, o.maxLado / Math.max(W, H));
      /* Pares los dos: un ancho impar rompe a más de un codificador. */
      var w = Math.max(2, Math.round(W * k / 2) * 2);
      var h = Math.max(2, Math.round(H * k / 2) * 2);

      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var cx = cv.getContext('2d');

      var stream, rec;
      try {
        stream = cv.captureStream(o.fps);
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: o.kbps * 1000 });
      } catch (e) {
        clearTimeout(reloj);
        crudo.aviso = 'No se pudo preparar la compresión. Se sube tal cual.';
        termina(null, crudo); return;
      }

      var trozos = [];
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) trozos.push(ev.data); };
      rec.onstop = function () {
        clearTimeout(reloj);
        /* Lo que pedimos y lo que grabó pueden no ser lo mismo: manda lo que
           dice el grabador. */
        var real = String(rec.mimeType || mime);
        var salida = new Blob(trozos, { type: real.split(';')[0] });
        /* Comprimir y acabar más gordo pasa con los videos ya muy optimizados.
           Cuando pasa, gana el original. */
        if (!salida.size || salida.size >= file.size) {
          crudo.aviso = 'Ya venía bien comprimido: se sube el original.';
          termina(null, crudo); return;
        }
        var esMp4 = /video\/mp4/.test(real);
        var esH264 = /avc1|h264/i.test(real);
        termina(null, {
          blob: salida,
          tipo: salida.type,
          nombre: sinExtension(file.name) + (esMp4 ? '.mp4' : '.webm'),
          antes: file.size,
          despues: salida.size,
          comprimido: true,
          codec: real,
          aviso: (esMp4 && esH264) ? ''
            : 'Tu navegador no sabe grabar en H.264, así que salió en WebM: en algunos iPhone puede no verse. Si puedes, súbelo desde Chrome o Safari.'
        });
      };

      function pinta() {
        if (v.ended || v.paused) return;
        cx.drawImage(v, 0, 0, w, h);
        requestAnimationFrame(pinta);
      }

      v.onended = function () { try { rec.stop(); } catch (_) {} };

      rec.start(250);
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        clearTimeout(reloj);
        try { rec.stop(); } catch (_) {}
        crudo.aviso = 'El navegador no dejó reproducir el video para comprimirlo. Se sube tal cual.';
        termina(null, crudo);
      });
      requestAnimationFrame(pinta);
    };
  }

  function mb(n) { return (Number(n || 0) / 1048576).toFixed(1); }

  window.cpVideo = { comprime: comprime, mb: mb };
})();
