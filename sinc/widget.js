/* EL PEGOTE. Javi, 6-nov-2026: «debe de poder ser un widget también que muestre
   el recuadro de la experiencia en su web».

   Una sola etiqueta <script> en la web del touroperador, con la experiencia y
   su código en los data-, y aquí se arma el iframe. Va por iframe y no por HTML
   inyectado a propósito: así ninguna hoja de estilo ajena deforma el recuadro,
   y nada de lo que hagamos dentro puede tocar su página.

   El alto no se adivina: el recuadro lo mide por dentro y lo manda por
   postMessage; aquí sólo se obedece, y sólo a los mensajes que vienen de
   nuestro propio origen y hablan de ESTE iframe.

   Uso:
     <script src="https://grupocasapepe.netlify.app/sinc/widget.js"
             data-exp="UUID-DE-LA-EXPERIENCIA"
             data-codigo="TEKPAN-2BDE71"
             data-ancho="380"></script>
*/
(function(){
  'use strict';

  var yo = document.currentScript;
  if(!yo) return;

  var exp = (yo.getAttribute('data-exp')||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(exp)) return;

  var cod   = (yo.getAttribute('data-codigo')||'').trim();
  var ancho = (yo.getAttribute('data-ancho')||'').trim();

  /* El origen sale del src del propio script: así el pegote funciona igual en
     producción y en una rama de prueba, sin que nadie tenga que editarlo. */
  var base;
  try{ base = new URL(yo.src, location.href).origin; }catch(e){ return; }

  var q = 'id=' + encodeURIComponent(exp);
  if(cod) q += '&c=' + encodeURIComponent(cod);

  var marco = document.createElement('iframe');
  marco.src = base + '/sinc/widget.html?' + q;
  marco.title = 'Reservar esta experiencia';
  marco.loading = 'lazy';
  marco.setAttribute('scrolling','no');
  marco.setAttribute('allowtransparency','true');
  marco.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
  marco.style.cssText =
    'display:block;border:0;width:100%;' +
    (ancho ? 'max-width:' + (parseInt(ancho,10)||380) + 'px;' : 'max-width:420px;') +
    'height:520px;background:transparent;color-scheme:light;';

  /* Se cuelga donde está la etiqueta, no al final del documento: el
     touroperador pone el <script> donde quiere que salga el recuadro. */
  (yo.parentNode||document.body).insertBefore(marco, yo);

  window.addEventListener('message', function(ev){
    if(ev.origin !== base) return;
    if(ev.source !== marco.contentWindow) return;
    var d = ev.data;
    if(!d || d.sincWidget !== 'alto') return;
    var h = Number(d.alto);
    if(h > 80 && h < 4000) marco.style.height = Math.ceil(h) + 'px';
  }, false);
})();
