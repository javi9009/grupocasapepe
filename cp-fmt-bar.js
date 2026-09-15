/* cp-fmt-bar.js — Barra de formato flotante del Grupo Casa Pepe.
   Mismo look e iconos que el editor <editor-texto>. Se auto-engancha a cualquier
   elemento contenteditable="true" (gob-ed, decks, recuadros del reporte). No toca
   el guardado de cada página. Superficie contenteditable heredada (usa execCommand
   con styleWithCSS); el editor Tiptap completo vive en <editor-texto>/cp-editor.js. */
(function(){
  if (window.__cpFmtBar) return; window.__cpFmtBar = true;
  var bar=null, curCE=null;
  var IC={
   undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
   redo:'<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>',
   alignL:'<path d="M3 6h18M3 12h12M3 18h15"/>', alignC:'<path d="M3 6h18M6 12h12M4 18h16"/>',
   alignR:'<path d="M3 6h18M9 12h12M6 18h15"/>', alignJ:'<path d="M3 6h18M3 12h18M3 18h18"/>',
   ul:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/>',
   ol:'<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 4v4M3 8h2"/><path d="M3 12h2l-2 3h2"/>',
   indent:'<path d="M3 6h18M7 12h14M7 18h14M3 10v4l3-2z"/>', outdent:'<path d="M3 6h18M7 12h14M7 18h14M6 10v4l-3-2z"/>',
   link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
   clear:'<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="m10 11 4 4m0-4-4 4"/>',
   emoji:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'
  };
  function svg(p){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'; }
  function css(){ if(document.getElementById('cpp-fmt2-css')) return; var s=document.createElement('style'); s.id='cpp-fmt2-css';
    s.textContent='.cpp-fmt-bar{position:fixed;z-index:100000;display:none;gap:2px;align-items:center;flex-wrap:wrap;background:#1f1b14;padding:5px;border-radius:11px;box-shadow:0 8px 26px rgba(0,0,0,.4);max-width:min(94vw,560px)}'
    +'.cpp-fmt-bar button{min-width:28px;height:28px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:#f0ead9;cursor:pointer;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center}'
    +'.cpp-fmt-bar button:hover{background:#3a342a}.cpp-fmt-bar button b{font-weight:800}.cpp-fmt-bar button i{font-style:italic}.cpp-fmt-bar button u{text-decoration:underline}.cpp-fmt-bar button s{text-decoration:line-through}'
    +'.cpp-fmt-bar .sep{width:1px;height:20px;background:#4a4038;margin:0 2px}'
    +'.cpp-fmt-bar select{height:28px;border:0;border-radius:7px;background:#3a342a;color:#f0ead9;font:inherit;font-size:12px;padding:0 4px;cursor:pointer}'
    +'.cpp-fmt-bar input[type=color]{width:28px;height:28px;border:0;border-radius:7px;background:#3a342a;padding:2px;cursor:pointer}'
    +'.cpp-fmt-pop{position:fixed;z-index:100001;background:#1f1b14;border-radius:10px;padding:6px;box-shadow:0 8px 26px rgba(0,0,0,.4);display:none;flex-wrap:wrap;gap:3px;max-width:230px}'
    +'.cpp-fmt-pop button{font-size:18px;background:transparent;border:0;color:#fff;cursor:pointer;width:32px;height:30px;border-radius:6px}.cpp-fmt-pop button:hover{background:#3a342a}'
    +'@media(max-width:760px){.cpp-fmt-bar{left:50%!important;transform:translateX(-50%);bottom:14px!important;top:auto!important;justify-content:center}}';
    document.head.appendChild(s); }
  function cmd(c,v){ try{ document.execCommand('styleWithCSS',false,true);}catch(_e){} try{ document.execCommand(c,false,v||null); }catch(e){} if(curCE){ try{curCE.focus();}catch(_e){} } }
  function btn(html,title,fn){ var el=document.createElement('button'); el.type='button'; el.title=title; el.setAttribute('aria-label',title); el.innerHTML=html; el.addEventListener('mousedown',function(ev){ev.preventDefault();fn();}); return el; }
  function sep(){ var d=document.createElement('span'); d.className='sep'; return d; }
  var EMO='😀 😊 🤝 👍 🙏 🎉 🔥 ✅ ❌ ⚠️ 💡 📌 📅 💰 📈 📉 🏨 🍽️ 🎭 ⭐ ❤️ 🚀 🟢 🟡 🟠 🔴 🛡️ 🎯'.split(' ');
  function ensureBar(){
    if(bar) return bar; css();
    bar=document.createElement('div'); bar.className='cpp-fmt-bar cpp-ec';
    var st=document.createElement('select'); st.title='Estilo';
    [['P','Normal'],['H1','Título 1'],['H2','Título 2'],['H3','Título 3'],['H4','Título 4'],['BLOCKQUOTE','Cita']].forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; st.appendChild(op); });
    st.addEventListener('change',function(){ cmd('formatBlock','<'+st.value+'>'); });
    bar.appendChild(btn(svg(IC.undo),'Deshacer',function(){cmd('undo');}));
    bar.appendChild(btn(svg(IC.redo),'Rehacer',function(){cmd('redo');}));
    bar.appendChild(sep()); bar.appendChild(st); bar.appendChild(sep());
    bar.appendChild(btn('<b>B</b>','Negrita',function(){cmd('bold');}));
    bar.appendChild(btn('<i>I</i>','Cursiva',function(){cmd('italic');}));
    bar.appendChild(btn('<u>U</u>','Subrayado',function(){cmd('underline');}));
    bar.appendChild(btn('<s>S</s>','Tachado',function(){cmd('strikeThrough');}));
    bar.appendChild(btn('x²','Superíndice',function(){cmd('superscript');}));
    bar.appendChild(btn('x₂','Subíndice',function(){cmd('subscript');}));
    var col=document.createElement('input'); col.type='color'; col.title='Color de texto'; col.value='#2a2118'; col.addEventListener('input',function(){cmd('foreColor',col.value);}); bar.appendChild(col);
    var hi=document.createElement('input'); hi.type='color'; hi.title='Resaltado'; hi.value='#fff3a3'; hi.addEventListener('input',function(){cmd('hiliteColor',hi.value);}); bar.appendChild(hi);
    bar.appendChild(sep());
    bar.appendChild(btn(svg(IC.alignL),'Izquierda',function(){cmd('justifyLeft');}));
    bar.appendChild(btn(svg(IC.alignC),'Centrar',function(){cmd('justifyCenter');}));
    bar.appendChild(btn(svg(IC.alignR),'Derecha',function(){cmd('justifyRight');}));
    bar.appendChild(btn(svg(IC.alignJ),'Justificar',function(){cmd('justifyFull');}));
    bar.appendChild(sep());
    bar.appendChild(btn(svg(IC.ul),'Viñetas',function(){cmd('insertUnorderedList');}));
    bar.appendChild(btn(svg(IC.ol),'Numerada',function(){cmd('insertOrderedList');}));
    bar.appendChild(btn(svg(IC.outdent),'Reducir sangría',function(){cmd('outdent');}));
    bar.appendChild(btn(svg(IC.indent),'Aumentar sangría',function(){cmd('indent');}));
    bar.appendChild(sep());
    bar.appendChild(btn(svg(IC.link),'Enlace',function(){ var u=prompt('Dirección del enlace (https://…)'); if(u){cmd('createLink',u);} }));
    var pop=document.createElement('div'); pop.className='cpp-fmt-pop cpp-ec';
    EMO.forEach(function(em){ var e=document.createElement('button'); e.type='button'; e.textContent=em; e.addEventListener('mousedown',function(ev){ev.preventDefault();cmd('insertText',em);pop.style.display='none';}); pop.appendChild(e); });
    document.body.appendChild(pop);
    var emb=btn(svg(IC.emoji),'Emoji',function(){ if(pop.style.display==='flex'){pop.style.display='none';return;} var r=emb.getBoundingClientRect(); pop.style.display='flex'; pop.style.left=Math.max(6,Math.min(window.innerWidth-236,r.left))+'px'; pop.style.top=(r.bottom+6)+'px'; }); bar.appendChild(emb);
    bar.appendChild(btn(svg(IC.clear),'Limpiar formato',function(){cmd('removeFormat');}));
    document.body.appendChild(bar); return bar;
  }
  function isCE(el){ return el && el.getAttribute && el.getAttribute('contenteditable')==='true'; }
  function place(){ if(!bar) return; var sel=window.getSelection(); if(window.innerWidth<=760){ bar.style.left=''; bar.style.top=''; return; }
    try{ if(sel && sel.rangeCount){ var rect=sel.getRangeAt(0).getBoundingClientRect(); if(rect && (rect.width||rect.height)){ var bw=bar.offsetWidth||360; var x=Math.max(8,Math.min(window.innerWidth-bw-8,rect.left+rect.width/2-bw/2)); var y=rect.top-bar.offsetHeight-8; if(y<6)y=rect.bottom+8; bar.style.left=x+'px'; bar.style.top=y+'px'; return; } } }catch(e){}
    if(curCE){ var r=curCE.getBoundingClientRect(); bar.style.left=Math.max(8,r.left)+'px'; bar.style.top=Math.max(6,r.top-40)+'px'; } }
  function showBar(el){ curCE=el; var b=ensureBar(); b.style.display='flex'; place(); }
  document.addEventListener('focusin',function(e){ if(isCE(e.target)) showBar(e.target); });
  document.addEventListener('keyup',function(e){ if(isCE(e.target)&&bar&&bar.style.display==='flex') place(); });
  document.addEventListener('mouseup',function(){ if(isCE(document.activeElement)&&bar&&bar.style.display==='flex') place(); });
  document.addEventListener('focusout',function(){ setTimeout(function(){ var a=document.activeElement;
    if(bar && !(a&&a.closest&&a.closest('.cpp-fmt-bar')) && !(a&&a.closest&&a.closest('.cpp-fmt-pop')) && !isCE(a)){ bar.style.display='none'; var p=document.querySelector('.cpp-fmt-pop'); if(p)p.style.display='none'; } },150); });
})();
