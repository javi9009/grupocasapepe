/* ============================================================
   CP-FOTO · UNA FOTO QUE YA NO ESTÁ NO ES UN CUADRO ROTO
   Javi, 29-oct-2026: «acabo de borrar fotos para liberar espacio y se
   descompusieron varias».

   Lo que se descompuso no fue la base: fue lo que enseña la pantalla.
   Borrar un archivo del almacén no avisa a las filas que lo citaban, así
   que la liga sigue ahí y el navegador pinta su icono de imagen rota —el
   papel desgarrado—, que es la forma más fea de decir «esto se perdió».

   Esto no arregla la foto; arregla la cara que pone la pantalla cuando no
   la encuentra: esconde la imagen y deja el hueco con el fondo de la casa.
   La tarjeta sigue entera, con su nombre, su oficio y sus cifras, que es
   lo que de verdad importaba de esa comunidad.

   Se cuelga en una línea y no hay que tocar ninguna etiqueta <img>:

     <script src="/cp-foto.js" defer></script>

   Funciona con las que ya están y con las que pinte el JavaScript después,
   porque no recorre el documento: escucha. El evento 'error' de una imagen
   no burbujea, pero sí baja en captura, así que un solo oyente en la raíz
   se entera de todas, incluidas las que aún no existen.
   ============================================================ */
(function(){
  'use strict';
  if (window.__cpFoto) return;            /* por si dos pantallas lo cuelgan */
  window.__cpFoto = true;

  var CSS =
    '.cp-sinfoto{position:relative;background:var(--crema2,#F1EBE1)}' +
    '.cp-sinfoto::after{content:"";position:absolute;left:50%;top:50%;' +
      'width:22px;height:18px;margin:-9px 0 0 -11px;border-radius:3px;' +
      'border:1.5px solid var(--linea,#DCD3C6);' +
      'box-shadow:inset 0 -6px 0 -4px var(--linea,#DCD3C6);opacity:.85}' +
    'img.cp-rota{display:none!important}';

  function hoja(){
    try{
      var s=document.createElement('style');
      s.setAttribute('data-de','cp-foto');
      s.textContent=CSS;
      (document.head||document.documentElement).appendChild(s);
    }catch(_){}
  }
  if (document.head) hoja();
  else document.addEventListener('DOMContentLoaded', hoja);

  document.addEventListener('error', function(e){
    var el = e && e.target;
    if (!el || el.tagName !== 'IMG') return;
    if (el.classList.contains('cp-rota')) return;     /* ya atendida */
    /* Una imagen sin src no es una foto perdida: es una que aún no empieza. */
    if (!el.getAttribute('src')) return;
    el.classList.add('cp-rota');
    /* El hueco lo pinta quien lo reservó. Si el padre no tiene tamaño propio
       -un <td>, un renglón de texto-, no se le pone fondo: quedaría una
       mancha del ancho de la fila. */
    var p = el.parentElement;
    if (!p) return;
    try{
      var r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height <= 420) p.classList.add('cp-sinfoto');
    }catch(_){}
  }, true);   /* true = captura: así llegan los errores de las imágenes */
})();
