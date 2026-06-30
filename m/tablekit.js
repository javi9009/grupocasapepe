/* tablekit.js — ordenar (clic en encabezado) + ampliar/reducir (arrastrar borde) en cualquier tabla.
   Guarda anchos y orden por página y columna en localStorage. Casa Pepe. */
(function(){
function tkTable(table,key){
  var saved={}; try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
  var mo=null;
  function save(){try{localStorage.setItem(key,JSON.stringify(saved))}catch(e){}}
  function headRow(){var h=table.tHead;return h?h.rows[h.rows.length-1]:null;}
  function ths(){var hr=headRow();return hr?Array.prototype.slice.call(hr.cells):[];}
  function observe(){ if(mo)mo.observe(table,{childList:true,subtree:true}); }
  function cellVal(tr,i){var td=tr.cells[i];if(!td)return '';var inp=td.querySelector('input,select,textarea');var v=inp?(inp.value||''):td.textContent;return (v||'').trim();}
  function applySort(){
    if(!saved.sort)return;var tb=table.tBodies[0];if(!tb)return;
    var rows=Array.prototype.slice.call(tb.rows);var idx=saved.sort.col,dir=saved.sort.dir==='desc'?-1:1;
    rows.sort(function(a,b){
      var x=cellVal(a,idx),y=cellVal(b,idx);
      var nx=parseFloat(x.replace(/[^0-9.\-]/g,'')),ny=parseFloat(y.replace(/[^0-9.\-]/g,''));
      var bn=!isNaN(nx)&&!isNaN(ny)&&/\d/.test(x)&&/\d/.test(y);
      var c=bn?(nx-ny):x.localeCompare(y,'es',{numeric:true,sensitivity:'base'});
      return c*dir;
    });
    if(mo)mo.disconnect();
    rows.forEach(function(r){tb.appendChild(r);});
    observe();
  }
  function applyWidths(cells){
    if(!saved.widths)return;table.style.tableLayout='fixed';
    cells.forEach(function(th,i){var w=saved.widths[i];if(w){th.style.width=w+'px';th.style.minWidth=w+'px';}});
  }
  function mark(){ths().forEach(function(th,i){var ind=th.querySelector('.tk-sort');if(ind)ind.textContent=(saved.sort&&saved.sort.col===i)?(saved.sort.dir==='asc'?'▲':'▼'):'';});}
  function build(){
    var cells=ths();if(cells.length<2)return;
    if(!saved.widths){saved.widths=cells.map(function(th){return Math.round(th.getBoundingClientRect().width)||120;});}
    applyWidths(cells);
    cells.forEach(function(th,i){
      if(th.querySelector('.tk-sort'))return;
      if(getComputedStyle(th).position==='static')th.style.position='relative';
      th.style.cursor='pointer';
      var ind=document.createElement('span');ind.className='tk-sort';ind.style.cssText='font-size:10px;color:#1d9e75;margin-left:3px';th.appendChild(ind);
      th.addEventListener('click',function(ev){
        if(ev.target.closest('.tk-rsz,.help,.help2,[data-h],.colmenu,.thsort,input,select'))return;
        var dir=(saved.sort&&saved.sort.col===i&&saved.sort.dir==='asc')?'desc':'asc';
        saved.sort={col:i,dir:dir};save();applySort();mark();
      });
      var h=document.createElement('span');h.className='tk-rsz';h.title='Arrastra para ampliar';
      h.style.cssText='position:absolute;top:0;right:0;width:8px;height:100%;cursor:col-resize';
      th.appendChild(h);
      h.addEventListener('click',function(e){e.stopPropagation();});
      h.addEventListener('mousedown',function(ev){
        ev.preventDefault();ev.stopPropagation();
        var sx=ev.pageX,sw=th.getBoundingClientRect().width;table.style.tableLayout='fixed';
        function mv(e){var w=Math.max(48,Math.round(sw+(e.pageX-sx)));th.style.width=w+'px';th.style.minWidth=w+'px';if(!saved.widths)saved.widths=[];saved.widths[i]=w;}
        function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);save();}
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });
    });
    mark();
  }
  build();applySort();
  if(window.MutationObserver){var t;mo=new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){build();applySort();},90);});observe();}
}
function run(){
  document.querySelectorAll('table').forEach(function(tbl,ti){
    if(!tbl.tHead)return; if(tbl.__tk)return; tbl.__tk=1;
    try{tkTable(tbl,'tablekit:'+location.pathname+':'+ti);}catch(e){}
  });
}
function boot(){ [500,1500,3000,6000].forEach(function(ms){setTimeout(run,ms);}); }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.tablekit=run;
})();
