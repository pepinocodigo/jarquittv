const socket=io();
const state={myId:null,myName:'',roomCode:'',hostId:null,players:[],isHost:false,tool:'pen',color:'#000000',brushSize:8,drawing:false,lastX:0,lastY:0,submitted:false,scores:{},gameMode:'draw'};
const hist={stack:[],idx:-1,max:50};
const gHist={stack:[],idx:-1,max:50};
const S={login:document.getElementById('screen-login'),lobby:document.getElementById('screen-lobby'),drawing:document.getElementById('screen-drawing'),guess:document.getElementById('screen-guess'),results:document.getElementById('screen-results'),guessOver:document.getElementById('screen-guess-over')};
function show(n){Object.values(S).forEach(s=>s.classList.remove('active'));S[n].classList.add('active');}
function toast(msg,t=''){const c=document.getElementById('toast-container');const el=document.createElement('div');el.className='toast'+(t?' '+t:'');el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),3500);}

/* ── COLOR WHEEL ── */
let colorWheelTarget='main';
function buildColorWheel(canvasEl,previewEl,onPick){
  const size=200;canvasEl.width=size;canvasEl.height=size;
  const ctx=canvasEl.getContext('2d');
  const cx=size/2,cy=size/2,r=size/2-4;
  for(let angle=0;angle<360;angle++){
    const start=(angle-1)*Math.PI/180;
    const end=(angle+1)*Math.PI/180;
    const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    grad.addColorStop(0,'white');
    grad.addColorStop(0.5,`hsl(${angle},100%,50%)`);
    grad.addColorStop(1,'black');
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,end);
    ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  }
  canvasEl.onclick=(e)=>{
    const rect=canvasEl.getBoundingClientRect();
    const x=e.clientX-rect.left,y=e.clientY-rect.top;
    const px=ctx.getImageData(Math.round(x*(size/rect.width)),Math.round(y*(size/rect.height)),1,1).data;
    const hex='#'+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    onPick(hex);
    previewEl.style.background=hex;
  };
}

function openColorWheel(target){
  colorWheelTarget=target;
  const modal=document.getElementById('color-wheel-modal');
  modal.classList.remove('hidden');
  const wcanvas=document.getElementById('wheel-canvas');
  const wprev=document.getElementById('wheel-preview');
  buildColorWheel(wcanvas,wprev,(hex)=>{
    if(colorWheelTarget==='main')setColor(hex);
    else setGColor(hex);
  });
}
document.getElementById('btn-open-wheel').addEventListener('click',()=>openColorWheel('main'));
document.getElementById('gbtn-open-wheel').addEventListener('click',()=>openColorWheel('guess'));
document.getElementById('wheel-close').addEventListener('click',()=>document.getElementById('color-wheel-modal').classList.add('hidden'));

/* ── PALETTE ── */
const PAL=['#000000','#FFFFFF','#94a3b8','#475569','#ef4444','#f97316','#f59e0b','#eab308','#22c55e','#10b981','#06b6d4','#3b82f6','#8b5cf6','#a855f7','#ec4899','#f43f5e','#84cc16','#14b8a6','#6366f1','#0ea5e9','#fde68a','#bbf7d0','#bfdbfe','#fecaca','#7f1d1d','#1e3a5f','#14532d','#312e81','#78350f','#1e1b4b'];
function buildPalette(id,onPick,activeColor){const c=document.getElementById(id);c.innerHTML='';PAL.forEach(h=>{const s=document.createElement('div');s.className='swatch';s.style.background=h;s.title=h;if(h===activeColor)s.classList.add('on');s.addEventListener('click',()=>onPick(h));c.appendChild(s);});}
function setColor(h){state.color=h;document.getElementById('color-preview').style.background=h;document.querySelectorAll('#color-palette .swatch').forEach(s=>s.classList.toggle('on',s.title===h));document.getElementById('wheel-preview').style.background=h;if(state.tool==='eyedropper'||state.tool==='eraser')setTool('pen');}
function setGColor(h){state.color=h;document.getElementById('gcolor-preview').style.background=h;document.querySelectorAll('#gcolor-palette .swatch').forEach(s=>s.classList.toggle('on',s.title===h));document.getElementById('wheel-preview').style.background=h;if(state.tool==='eyedropper'||state.tool==='eraser')setTool('pen');}

/* ── HISTORY ── */
function saveH(h,cv,ct){h.stack=h.stack.slice(0,h.idx+1);h.stack.push(ct.getImageData(0,0,cv.width,cv.height));if(h.stack.length>h.max)h.stack.shift();h.idx=h.stack.length-1;updUndoBtns();}
function undoH(h,cv,ct){if(h.idx<=0)return;h.idx--;ct.putImageData(h.stack[h.idx],0,0);updUndoBtns();}
function redoH(h,cv,ct){if(h.idx>=h.stack.length-1)return;h.idx++;ct.putImageData(h.stack[h.idx],0,0);updUndoBtns();}
function updUndoBtns(){
  document.getElementById('btn-undo').disabled=hist.idx<=0;
  document.getElementById('btn-redo').disabled=hist.idx>=hist.stack.length-1;
  document.getElementById('gbtn-undo').disabled=gHist.idx<=0;
  document.getElementById('gbtn-redo').disabled=gHist.idx>=gHist.stack.length-1;
}

/* ── CANVAS (draw mode) ── */
const canvas=document.getElementById('drawing-canvas');
const ctx=canvas.getContext('2d',{willReadFrequently:true});
function resizeCanvas(){const a=document.querySelector('#screen-drawing .canvas-wrap');if(!a)return;const sz=Math.min(a.clientWidth-24,a.clientHeight-24,680);canvas.width=sz;canvas.height=sz;ctx.fillStyle='#fff';ctx.fillRect(0,0,sz,sz);hist.stack=[];hist.idx=-1;saveH(hist,canvas,ctx);updUndoBtns();}
function gpos(e,cv){const r=cv.getBoundingClientRect();const sx=cv.width/r.width,sy=cv.height/r.height;const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)*sx,y:(cy-r.top)*sy};}

function pickColor(cv,ct,x,y){const px=ct.getImageData(Math.round(x),Math.round(y),1,1).data;return'#'+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');}

function sdown(e){if(state.submitted)return;e.preventDefault();state.drawing=true;const{x,y}=gpos(e,canvas);
  if(state.tool==='eyedropper'){const h=pickColor(canvas,ctx,x,y);setColor(h);setTool('pen');state.drawing=false;return;}
  if(state.tool==='fill'){fill(Math.round(x),Math.round(y),state.color,canvas,ctx);saveH(hist,canvas,ctx);state.drawing=false;return;}
  state.lastX=x;state.lastY=y;ctx.beginPath();ctx.arc(x,y,state.brushSize/2,0,Math.PI*2);ctx.fillStyle=state.tool==='eraser'?'#fff':state.color;ctx.fill();}
function smove(e){if(!state.drawing||state.submitted||state.tool==='fill'||state.tool==='eyedropper')return;e.preventDefault();const{x,y}=gpos(e,canvas);ctx.beginPath();ctx.moveTo(state.lastX,state.lastY);ctx.lineTo(x,y);ctx.strokeStyle=state.tool==='eraser'?'#fff':state.color;ctx.lineWidth=state.brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();state.lastX=x;state.lastY=y;}
function send(e){if(state.drawing&&state.tool!=='fill'&&state.tool!=='eyedropper')saveH(hist,canvas,ctx);state.drawing=false;}
canvas.addEventListener('mousedown',sdown);canvas.addEventListener('mousemove',smove);canvas.addEventListener('mouseup',send);canvas.addEventListener('mouseleave',send);canvas.addEventListener('touchstart',sdown,{passive:false});canvas.addEventListener('touchmove',smove,{passive:false});canvas.addEventListener('touchend',send);

/* ── CANVAS (guess mode) ── */
const gcanvas=document.getElementById('guess-canvas');
const gctx=gcanvas.getContext('2d',{willReadFrequently:true});
let isDrawer=false;
function resizeGCanvas(){const a=document.querySelector('#screen-guess .canvas-wrap');if(!a)return;const sz=Math.min(a.clientWidth-24,a.clientHeight-24,600);gcanvas.width=sz;gcanvas.height=sz;gctx.fillStyle='#fff';gctx.fillRect(0,0,sz,sz);gHist.stack=[];gHist.idx=-1;saveH(gHist,gcanvas,gctx);updUndoBtns();}
let glastX=0,glastY=0,gdrawing=false;
function gsdown(e){if(!isDrawer)return;e.preventDefault();gdrawing=true;const{x,y}=gpos(e,gcanvas);
  if(state.tool==='eyedropper'){const h=pickColor(gcanvas,gctx,x,y);setGColor(h);setTool('pen');gdrawing=false;return;}
  if(state.tool==='fill'){fill(Math.round(x),Math.round(y),state.color,gcanvas,gctx);saveH(gHist,gcanvas,gctx);socket.emit('guess:stroke',{type:'fill',x:Math.round(x),y:Math.round(y),color:state.color,w:gcanvas.width,h:gcanvas.height});gdrawing=false;return;}
  glastX=x;glastY=y;gctx.beginPath();gctx.arc(x,y,state.brushSize/2,0,Math.PI*2);gctx.fillStyle=state.tool==='eraser'?'#fff':state.color;gctx.fill();
  socket.emit('guess:stroke',{type:'dot',x,y,size:state.brushSize,color:state.tool==='eraser'?'#fff':state.color,w:gcanvas.width,h:gcanvas.height});}
function gsmove(e){if(!gdrawing||!isDrawer||state.tool==='fill'||state.tool==='eyedropper')return;e.preventDefault();const{x,y}=gpos(e,gcanvas);gctx.beginPath();gctx.moveTo(glastX,glastY);gctx.lineTo(x,y);gctx.strokeStyle=state.tool==='eraser'?'#fff':state.color;gctx.lineWidth=state.brushSize;gctx.lineCap='round';gctx.lineJoin='round';gctx.stroke();
  socket.emit('guess:stroke',{type:'line',x1:glastX,y1:glastY,x2:x,y2:y,size:state.brushSize,color:state.tool==='eraser'?'#fff':state.color,w:gcanvas.width,h:gcanvas.height});
  glastX=x;glastY=y;}
function gsend(){if(gdrawing&&state.tool!=='fill'&&state.tool!=='eyedropper')saveH(gHist,gcanvas,gctx);gdrawing=false;}
gcanvas.addEventListener('mousedown',gsdown);gcanvas.addEventListener('mousemove',gsmove);gcanvas.addEventListener('mouseup',gsend);gcanvas.addEventListener('mouseleave',gsend);gcanvas.addEventListener('touchstart',gsdown,{passive:false});gcanvas.addEventListener('touchmove',gsmove,{passive:false});gcanvas.addEventListener('touchend',gsend);

/* ── RECEIVE STROKES (spectator) ── */
socket.on('guess:stroke',(s)=>{
  const scaleX=gcanvas.width/s.w,scaleY=gcanvas.height/s.h;
  if(s.type==='dot'){gctx.beginPath();gctx.arc(s.x*scaleX,s.y*scaleY,s.size/2,0,Math.PI*2);gctx.fillStyle=s.color;gctx.fill();}
  else if(s.type==='line'){gctx.beginPath();gctx.moveTo(s.x1*scaleX,s.y1*scaleY);gctx.lineTo(s.x2*scaleX,s.y2*scaleY);gctx.strokeStyle=s.color;gctx.lineWidth=s.size;gctx.lineCap='round';gctx.lineJoin='round';gctx.stroke();}
  else if(s.type==='fill'){fill(Math.round(s.x*scaleX),Math.round(s.y*scaleY),s.color,gcanvas,gctx);}
});
socket.on('guess:clearCanvas',()=>{gctx.fillStyle='#fff';gctx.fillRect(0,0,gcanvas.width,gcanvas.height);gHist.stack=[];gHist.idx=-1;saveH(gHist,gcanvas,gctx);});

/* ── FLOOD FILL ── */
function h2a(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255];}
function cmatch(a,b,t=16){return Math.abs(a[0]-b[0])<=t&&Math.abs(a[1]-b[1])<=t&&Math.abs(a[2]-b[2])<=t&&Math.abs(a[3]-b[3])<=t;}
function fill(sx,sy,hex,cv,ct){const w=cv.width,h=cv.height,id=ct.getImageData(0,0,w,h),d=id.data;const gi=(x,y)=>{const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];};const tg=gi(sx,sy),fl=h2a(hex);if(cmatch(tg,fl,4))return;const vis=new Uint8Array(w*h),q=[sx+sy*w];vis[sx+sy*w]=1;while(q.length){const p=q.pop(),x=p%w,y=(p/w)|0,i=p*4;d[i]=fl[0];d[i+1]=fl[1];d[i+2]=fl[2];d[i+3]=fl[3];for(const n of[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]){if(n<0||vis[n])continue;if(cmatch(gi(n%w,(n/w)|0),tg)){vis[n]=1;q.push(n);}}}ct.putImageData(id,0,0);}

/* ── TOOLS ── */
function setTool(t){state.tool=t;
  document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tool-'+t)?.classList.add('active');
  document.getElementById('gtool-'+t)?.classList.add('active');
  const cur=t==='fill'?'cell':t==='eyedropper'?'crosshair':'crosshair';
  canvas.style.cursor=cur;gcanvas.style.cursor=cur;}

document.getElementById('tool-pen').addEventListener('click',()=>setTool('pen'));
document.getElementById('tool-eraser').addEventListener('click',()=>setTool('eraser'));
document.getElementById('tool-fill').addEventListener('click',()=>setTool('fill'));
document.getElementById('tool-eyedropper').addEventListener('click',()=>setTool('eyedropper'));
document.getElementById('gtool-pen').addEventListener('click',()=>setTool('pen'));
document.getElementById('gtool-eraser').addEventListener('click',()=>setTool('eraser'));
document.getElementById('gtool-fill').addEventListener('click',()=>setTool('fill'));
document.getElementById('gtool-eyedropper').addEventListener('click',()=>setTool('eyedropper'));

document.getElementById('btn-undo').addEventListener('click',()=>undoH(hist,canvas,ctx));
document.getElementById('btn-redo').addEventListener('click',()=>redoH(hist,canvas,ctx));
document.getElementById('gbtn-undo').addEventListener('click',()=>undoH(gHist,gcanvas,gctx));
document.getElementById('gbtn-redo').addEventListener('click',()=>redoH(gHist,gcanvas,gctx));

document.addEventListener('keydown',(e)=>{
  const inInput=e.target.tagName==='INPUT';if(inInput)return;
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();const active=S.drawing.classList.contains('active');active?undoH(hist,canvas,ctx):undoH(gHist,gcanvas,gctx);}
  if(e.ctrlKey&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();const active=S.drawing.classList.contains('active');active?redoH(hist,canvas,ctx):redoH(gHist,gcanvas,gctx);}
});

const slider=document.getElementById('size-slider');
slider.addEventListener('input',()=>{state.brushSize=+slider.value;document.getElementById('size-val').textContent=slider.value;});
const gslider=document.getElementById('gsize-slider');
gslider.addEventListener('input',()=>{state.brushSize=+gslider.value;document.getElementById('gsize-val').textContent=gslider.value;});

document.getElementById('btn-clear').addEventListener('click',()=>{const b=document.getElementById('btn-clear');b.style.background='rgba(239,68,68,0.25)';setTimeout(()=>{b.style.background='';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);saveH(hist,canvas,ctx);},400);});
document.getElementById('gbtn-clear').addEventListener('click',()=>{gctx.fillStyle='#fff';gctx.fillRect(0,0,gcanvas.width,gcanvas.height);saveH(gHist,gcanvas,gctx);socket.emit('guess:clear');});
document.getElementById('btn-submit').addEventListener('click',()=>{if(state.submitted)return;state.submitted=true;socket.emit('game:submitDrawing',{drawing:canvas.toDataURL('image/png')});document.getElementById('sub-overlay').classList.remove('hidden');document.getElementById('btn-submit').disabled=true;});

/* ── LOGIN ── */
const iname=document.getElementById('input-name');
const icode=document.getElementById('input-code');
let selectedMode='draw';
document.querySelectorAll('.mode-opt').forEach(el=>{el.addEventListener('click',()=>{document.querySelectorAll('.mode-opt').forEach(o=>o.classList.remove('active'));el.classList.add('active');selectedMode=el.dataset.mode;});});
document.getElementById('btn-create').addEventListener('click',()=>{const n=iname.value.trim();if(n.length<2){toast('Apelido precisa ter pelo menos 2 letras!','err');iname.focus();return;}state.myName=n;socket.emit('room:create',{name:n,mode:selectedMode});});
document.getElementById('btn-join').addEventListener('click',()=>{const n=iname.value.trim(),c=icode.value.trim();if(n.length<2){toast('Apelido precisa ter pelo menos 2 letras!','err');iname.focus();return;}if(c.length<6){toast('Código tem 6 caracteres!','err');icode.focus();return;}state.myName=n;socket.emit('room:join',{name:n,code:c});});
icode.addEventListener('input',()=>{icode.value=icode.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});

/* ── ROOMS ── */
function loadRooms(){socket.emit('rooms:list');}
document.getElementById('btn-refresh').addEventListener('click',loadRooms);
socket.on('rooms:data',({rooms})=>{const l=document.getElementById('rooms-list');if(!rooms||!rooms.length){l.innerHTML='<p class="empty">Nenhuma sala aberta.</p>';return;}l.innerHTML='';rooms.forEach(r=>{const el=document.createElement('div');el.className='room-entry';el.innerHTML=`<div><div class="re-code">${r.code}</div><div class="re-count">${r.count}/10 · <span class="re-mode">${r.mode==='guess'?'🔍 Adivinhe':'🎨 Livre'}</span></div></div><button class="re-btn">Entrar</button>`;el.querySelector('button').addEventListener('click',()=>{icode.value=r.code;toast('Código preenchido!');});l.appendChild(el);});});

/* ── LOBBY ── */
const AVCOLS=['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316','#3b82f6'];
function avcol(n){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);return AVCOLS[Math.abs(h)%AVCOLS.length];}
function renderLobby(){const g=document.getElementById('players-grid');g.innerHTML='';state.players.forEach(p=>{const c=document.createElement('div');c.className='pcard';if(p.id===state.hostId)c.classList.add('host');if(p.id===state.myId)c.classList.add('you');let badge='';if(p.id===state.hostId&&p.id===state.myId)badge='<span class="pbadge bhost">HOST 👑 você</span>';else if(p.id===state.hostId)badge='<span class="pbadge bhost">HOST 👑</span>';else if(p.id===state.myId)badge='<span class="pbadge byou">você</span>';c.innerHTML=`<div class="pavatar" style="background:${avcol(p.name)}">${p.name[0].toUpperCase()}</div><span class="pname">${p.name}</span>${badge}`;g.appendChild(c);});document.getElementById('player-count').textContent=state.players.length;const bs=document.getElementById('btn-start'),wm=document.getElementById('wait-msg'),mh=document.getElementById('min-hint');if(state.isHost){bs.classList.remove('hidden');wm.classList.add('hidden');bs.disabled=state.players.length<2;mh.style.display=state.players.length<2?'block':'none';}else{bs.classList.add('hidden');wm.classList.remove('hidden');mh.style.display='none';}}
document.getElementById('btn-copy').addEventListener('click',()=>{navigator.clipboard.writeText(state.roomCode).then(()=>toast('Código copiado! 📋','ok')).catch(()=>toast('Não foi possível copiar.','err'));});
document.getElementById('btn-start').addEventListener('click',()=>socket.emit('game:start'));

/* ── TIMER ── */
function updTimer(id,valId,t){const el=document.getElementById(valId),box=document.getElementById(id);el.textContent=t;el.classList.remove('y','r');box.classList.remove('tgreen','tyellow','tred');if(t>60)box.classList.add('tgreen');else if(t>30){el.classList.add('y');box.classList.add('tyellow');}else{el.classList.add('r');box.classList.add('tred');}}

/* ── CHAT (guess mode) ── */
function addChat(name,msg,type='normal'){const c=document.getElementById('chat-messages');const el=document.createElement('div');el.className='chat-msg'+(type==='correct'?' correct':type==='system'?' system':'');el.innerHTML=type==='system'?`<span>${msg}</span>`:`<strong>${name}:</strong> ${msg}`;c.appendChild(el);c.scrollTop=c.scrollHeight;}

/* ── RESULTS (draw mode) ── */
function showResults({drawings,winnerId,winnerName,verdict}){show('results');document.getElementById('robo-wrap').style.display='flex';document.getElementById('res-content').classList.add('hidden');const bar=document.getElementById('robo-prog');let p=0;const iv=setInterval(()=>{p+=1.2;bar.style.width=Math.min(p,100)+'%';if(p>=100)clearInterval(iv);},30);setTimeout(()=>{document.getElementById('robo-wrap').style.display='none';document.getElementById('res-content').classList.remove('hidden');document.getElementById('winner-name').textContent=winnerName;document.getElementById('winner-verdict').textContent='"'+verdict+'"';const gal=document.getElementById('gallery');gal.innerHTML='';drawings.forEach(d=>{const card=document.createElement('div');card.className='dcard';if(d.id===winnerId)card.classList.add('win');const cv=document.createElement('canvas');cv.width=200;cv.height=200;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,200,200);const ft=document.createElement('div');ft.className='dfoot';const au=document.createElement('span');au.className='dauthor';au.textContent=d.name;ft.appendChild(au);const pts=state.scores[d.id]||0;const bd=document.createElement('span');bd.className=d.id===winnerId?'dbadge-win':'dbadge';bd.textContent=(d.id===winnerId?'🏆 ':'')+pts+'pt';ft.appendChild(bd);card.appendChild(cv);card.appendChild(ft);gal.appendChild(card);if(d.drawing){const img=new Image();img.onload=()=>{cx.clearRect(0,0,200,200);cx.fillStyle='#fff';cx.fillRect(0,0,200,200);cx.drawImage(img,0,0,200,200);};img.src=d.drawing;}});const bn=document.getElementById('btn-next'),nw=document.getElementById('next-wait');if(state.isHost){bn.classList.remove
cat > ~/jarquittv/public/style.css << 'EOF'
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d0d14;--surf:#16162a;--elev:#1e1e3a;--brd:rgba(255,255,255,0.07);--pur:#7c3aed;--purh:#6d28d9;--purlo:rgba(124,58,237,0.18);--cyn:#06b6d4;--amb:#f59e0b;--grn:#22c55e;--red:#ef4444;--txt:#f1f5f9;--mut:#94a3b8}
html,body{height:100%;background:var(--bg);color:var(--txt);font-family:'Inter',sans-serif;font-size:15px;overflow:hidden}
.screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;pointer-events:none;transform:translateY(16px);transition:opacity .4s ease,transform .4s ease;overflow-y:auto;padding:20px 16px}
.screen.active{opacity:1;pointer-events:all;transform:translateY(0)}
#toast-container{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:var(--elev);border:1px solid var(--brd);border-left:3px solid var(--pur);color:var(--txt);padding:11px 16px;border-radius:10px;font-size:13px;font-weight:500;animation:tin .3s ease forwards;max-width:260px}
.toast.err{border-left-color:var(--red)}.toast.ok{border-left-color:var(--grn)}
@keyframes tin{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.btn{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:10px;border:none;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s,box-shadow .2s,transform .15s;user-select:none;white-space:nowrap}
.btn:active{transform:scale(0.97)}.btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
.btn.primary{background:var(--pur);color:#fff}.btn.primary:hover:not(:disabled){background:var(--purh);box-shadow:0 0 16px rgba(124,58,237,.5)}
.btn.secondary{background:var(--elev);color:var(--txt);border:1px solid var(--brd)}.btn.secondary:hover{background:#252545}
.btn.success{background:var(--grn);color:#fff}.btn.success:hover{background:#16a34a;box-shadow:0 0 16px rgba(34,197,94,.4)}
.btn.ghost{background:transparent;color:var(--mut);border:1px solid var(--brd)}.btn.ghost:hover{background:var(--elev);color:var(--txt)}
.btn.large{padding:13px 30px;font-size:15px;border-radius:12px}
.icon-btn{background:none;border:none;cursor:pointer;font-size:17px;padding:4px 6px;border-radius:6px;transition:background .2s}.icon-btn:hover{background:var(--elev)}
.hidden{display:none!important}
.orbs{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.2;animation:forb 8s ease-in-out infinite alternate}
.o1{width:380px;height:380px;background:var(--pur);top:-80px;left:-80px}
.o2{width:280px;height:280px;background:var(--cyn);bottom:-60px;right:-60px;animation-delay:2s}
.o3{width:220px;height:220px;background:var(--amb);top:50%;left:50%;margin:-110px;opacity:.1;animation-delay:4s}
@keyframes forb{from{transform:translate(0,0)}to{transform:translate(18px,18px) scale(1.08)}}
#screen-login{justify-content:center}
.login-layout{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%;max-width:880px;align-items:start}
.login-left{display:flex;flex-direction:column;gap:20px;padding:8px 0}
.logo-wrap{display:flex;align-items:center;gap:10px;font-size:40px}
.logo-title{font-family:'Fredoka One',cursive;font-size:44px;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1}
.logo-sub{color:var(--mut);font-size:13px;line-height:1.6}
.quotes{display:flex;flex-direction:column;gap:8px}
.quote{background:var(--surf);border:1px solid var(--brd);border-left:3px solid rgba(124,58,237,.4);border-radius:10px;padding:11px 14px;font-size:13px;color:var(--mut);line-height:1.5}
.quote.gold{border-left-color:var(--amb);color:var(--amb);background:rgba(245,158,11,.07);font-weight:600}
.login-right{display:flex;flex-direction:column;gap:14px}
.login-card{background:rgba(22,22,42,.92);border:1px solid var(--brd);border-radius:20px;padding:28px 24px;backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,.4)}
.card-title{font-family:'Fredoka One',cursive;font-size:21px;margin-bottom:18px}
.field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
.field label{font-size:11px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.field input,input.code-input{width:100%;background:var(--elev);border:1.5px solid rgba(124,58,237,.25);border-radius:10px;color:var(--txt);font-family:'Inter',sans-serif;font-size:15px;padding:11px 14px;outline:none;transition:border-color .2s,box-shadow .2s}
.field input:focus,input.code-input:focus{border-color:var(--pur);box-shadow:0 0 0 3px rgba(124,58,237,.2)}
.mode-selector{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mode-opt{background:var(--elev);border:2px solid var(--brd);border-radius:10px;padding:12px 10px;cursor:pointer;display:flex;flex-direction:column;gap:3px;transition:border-color .2s,background .2s}
.mode-opt span{font-size:22px}.mode-opt strong{font-size:13px;color:var(--txt)}.mode-opt small{font-size:11px;color:var(--mut)}
.mode-opt.active{border-color:var(--pur);background:var(--purlo)}.mode-opt:hover{border-color:var(--pur)}
.actions{display:flex;flex-direction:column;gap:9px}.actions .btn.primary{width:100%;justify-content:center}
.or{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px}
.or::before,.or::after{content:'';flex:1;height:1px;background:var(--brd)}
.join-row{display:flex;gap:7px}.join-row input.code-input{flex:1;text-transform:uppercase;letter-spacing:.1em;font-weight:600}.join-row .btn.secondary{flex-shrink:0}
.rooms-panel{background:rgba(22,22,42,.85);border:1px solid var(--brd);border-radius:20px;padding:18px 20px;backdrop-filter:blur(12px)}
.rooms-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:13px;font-weight:600}
#rooms-list{display:flex;flex-direction:column;gap:7px;max-height:160px;overflow-y:auto}
.empty{font-size:13px;color:var(--mut);text-align:center;padding:14px 0}
.room-entry{display:flex;align-items:center;justify-content:space-between;background:var(--elev);border:1px solid var(--brd);border-radius:10px;padding:9px 13px;transition:border-color .2s,background .2s}
.room-entry:hover{border-color:var(--pur);background:#1a1a35}
.re-code{font-family:'Fredoka One',cursive;font-size:15px;color:var(--cyn);letter-spacing:.08em}.re-count{font-size:11px;color:var(--mut)}.re-mode{color:var(--pur);font-weight:600}
.re-btn{font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;border:none;background:var(--pur);color:#fff;cursor:pointer}.re-btn:hover{background:var(--purh)}
#screen-lobby{justify-content:flex-start;padding-top:28px}
.lobby-top{width:100%;max-width:680px;margin-bottom:20px}
.lobby-title-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:5px}
.stitle{font-family:'Fredoka One',cursive;font-size:26px}
.code-box{display:flex;align-items:center;gap:7px;background:var(--elev);border:1px solid var(--brd);border-radius:10px;padding:7px 13px}
.code-lbl{font-size:11px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.code-val{font-family:'Fredoka One',cursive;font-size:19px;color:var(--cyn);letter-spacing:.1em}
.pcount{font-size:13px;color:var(--mut)}.mode-tag{color:var(--pur);font-weight:600}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;width:100%;max-width:680px}
.pcard{background:var(--surf);border:1px solid var(--brd);border-radius:14px;padding:18px 12px;display:flex;flex-direction:column;align-items:center;gap:9px;animation:cin .3s ease both}
@keyframes cin{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
.pcard.host{border-color:var(--amb)}.pcard.you{border-color:var(--pur)}
.pavatar{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:20px;color:#fff}
.pname{font-size:12px;font-weight:600;text-align:center;word-break:break-word}
.pbadge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;background:var(--elev);color:var(--mut)}
.pbadge.bhost{background:rgba(245,158,11,.18);color:var(--amb)}.pbadge.byou{background:var(--purlo);color:#a78bfa}
.lobby-foot{width:100%;max-width:680px;margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:9px}
.muted-msg{font-size:13px;color:var(--mut);text-align:center}.hint{font-size:12px;color:var(--mut);opacity:.7}
#screen-drawing,#screen-guess{justify-content:flex-start;padding:0;overflow:hidden}
.draw-header{width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 18px;background:var(--surf);border-bottom:1px solid var(--brd);flex-shrink:0}
.theme-wrap{display:flex;align-items:center;gap:9px}
.theme-lbl{font-size:11px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.theme-val{font-family:'Fredoka One',cursive;font-size:22px;animation:tpop .5s cubic-bezier(.34,1.56,.64,1) both}
@keyframes tpop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.timer{display:flex;align-items:baseline;gap:3px;background:var(--elev);border-radius:10px;padding:7px 14px;border:2px solid transparent;transition:border-color .5s}
.tgreen{border-color:var(--grn)}.tyellow{border-color:var(--amb)}
.tred{border-color:var(--red);animation:tpulse .7s ease infinite alternate}
@keyframes tpulse{from{box-shadow:0 0 0 0 rgba(239,68,68,0)}to{box-shadow:0 0 0 7px rgba(239,68,68,.2)}}
#timer-val,#guess-timer-val{font-family:'Fredoka One',cursive;font-size:32px;line-height:1;color:var(--grn);transition:color .5s;min-width:44px;text-align:center}
#timer-val.y,#guess-timer-val.y{color:var(--amb)}#timer-val.r,#guess-timer-val.r{color:var(--red)}.ts{font-size:13px;color:var(--mut);font-weight:600}
.canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:hidden}
#drawing-canvas,#guess-canvas{background:#fff;border-radius:12px;cursor:crosshair;box-shadow:0 8px 36px rgba(0,0,0,.4);touch-action:none;display:block}
.toolbar{width:100%;background:var(--surf);border-top:1px solid var(--brd);padding:9px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;flex-wrap:wrap}
.tl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tr{display:flex;gap:7px;align-items:center}
.tgroup{display:flex;align-items:center;gap:5px}
.tbtn{width:38px;height:38px;border-radius:8px;border:2px solid var(--brd);background:var(--elev);cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;transition:border-color .2s,background .2s}
.tbtn:hover{background:#252545}.tbtn.active{border-color:var(--pur);background:var(--purlo)}.tbtn:disabled{opacity:.35;cursor:not-allowed}
.slbl{font-size:11px;color:var(--mut);font-weight:600;white-space:nowrap}
#size-slider,#gsize-slider{-webkit-appearance:none;width:80px;height:4px;background:var(--elev);border-radius:2px;outline:none;cursor:pointer}
#size-slider::-webkit-slider-thumb,#gsize-slider::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--pur);cursor:pointer}
.snum{font-size:12px;font-weight:600;color:var(--mut);min-width:20px;text-align:right}
.palette{display:flex;flex-wrap:wrap;gap:4px;max-width:180px}
.swatch{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .15s,border-color .15s,box-shadow .15s;flex-shrink:0}
.swatch:hover{transform:scale(1.2)}.swatch.on{border-color:#fff;box-shadow:0 0 0 2px var(--pur);transform:scale(1.15)}
.cprev-wrap{display:flex;flex-direction:column;align-items:center;gap:3px}
.cprev{width:32px;height:32px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:#000;transition:background .2s}
.cprev-lbl{font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em}
.sub-overlay{position:absolute;inset:0;background:rgba(13,13,20,.88);display:flex;align-items:center;justify-content:center;z-index:10;backdrop-filter:blur(6px)}
.sub-card{text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.sub-card p{font-size:15px;color:var(--mut);font-weight:500}
.spinner{width:42px;height:42px;border:3px solid var(--brd);border-top-color:var(--pur);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* COLOR WHEEL MODAL */
#color-wheel-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.wheel-card{background:var(--surf);border:1px solid var(--brd);border-radius:20px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.wheel-card h3{font-family:'Fredoka One',cursive;font-size:18px}
#wheel-canvas{border-radius:50%;cursor:crosshair;box-shadow:0 4px 20px rgba(0,0,0,.4)}
.wheel-preview-row{display:flex;align-items:center;gap:12px}
#wheel-preview{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.2);background:#000}
.wheel-preview-row span{font-size:13px;color:var(--mut)}
/* GUESS LAYOUT */
.guess-layout{flex:1;display:grid;grid-template-columns:1fr 320px;gap:0;overflow:hidden;width:100%}
.guess-canvas-side{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--brd)}
.guess-chat-side{display:flex;flex-direction:column;background:var(--surf)}
.chat-header{padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--brd);color:var(--mut)}
.chat-messages{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.chat-msg{font-size:13px;color:var(--mut);line-height:1.4;padding:4px 0}
.chat-msg strong{color:var(--txt)}
.chat-msg.correct{color:var(--grn);font-weight:600;background:rgba(34,197,94,.1);padding:6px 10px;border-radius:8px}
.chat-msg.system{color:var(--cyn);font-style:italic}
.guess-input-wrap{display:flex;gap:8px;padding:12px;border-top:1px solid var(--brd)}
.guess-input-wrap input{flex:1;background:var(--elev);border:1.5px solid rgba(124,58,237,.25);border-radius:10px;color:var(--txt);font-family:'Inter',sans-serif;font-size:14px;padding:9px 12px;outline:none;transition:border-color .2s}
.guess-input-wrap input:focus{border-color:var(--pur)}
.guess-input-wrap .btn{padding:9px 14px;font-size:13px}
/* RESULTS */
#screen-results,#screen-guess-over{justify-content:flex-start;padding-top:24px;overflow-y:auto}
.res-head{width:100%;max-width:880px;margin-bottom:18px}
.robo-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding:50px 20px;width:100%;max-width:480px}
.robo-icon{font-size:60px;animation:rfloat 1.5s ease-in-out infinite alternate}
@keyframes rfloat{from{transform:translateY(0) rotate(-5deg)}to{transform:translateY(-10px) rotate(5deg)}}
.robo-txt{font-family:'Fredoka One',cursive;font-size:21px;color:var(--cyn)}
.robo-bar{width:280px;height:5px;background:var(--elev);border-radius:3px;overflow:hidden}
.robo-prog{height:100%;width:0%;background:linear-gradient(90deg,var(--pur),var(--cyn));border-radius:3px;transition:width .1s linear}
.res-content{width:100%;max-width:880px;display:flex;flex-direction:column;align-items:center;gap:18px}
.winner-banner{display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(124,58,237,.15));border:2px solid var(--amb);border-radius:20px;padding:18px 28px;width:100%;animation:win .6s cubic-bezier(.34,1.56,.64,1) both;box-shadow:0 0 36px rgba(245,158,11,.18)}
@keyframes win{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
.wcrown{font-size:38px}.winfo{display:flex;flex-direction:column;gap:2px}
.wlbl{font-size:11px;font-weight:600;color:var(--amb);text-transform:uppercase;letter-spacing:.07em}
.wname{font-family:'Fredoka One',cursive;font-size:28px}
.verdict{font-size:14px;color:var(--mut);text-align:center;font-style:italic;line-height:1.6;max-width:580px;padding:0 14px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;width:100%}
.dcard{background:var(--surf);border:2px solid var(--brd);border-radius:14px;overflow:hidden;animation:cin .4s ease both}
.dcard.win{border-color:var(--amb);animation:cin .4s ease both,wglow 1.5s ease infinite alternate}
@keyframes wglow{from{box-shadow:0 0 14px rgba(245,158,11,.22)}to{box-shadow:0 0 32px rgba(245,158,11,.5)}}
.dcard canvas{width:100%;height:auto;display:block}
.dfoot{padding:9px 12px;display:flex;align-items:center;justify-content:space-between}
.dauthor{font-size:13px;font-weight:600}
.dbadge-win{font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(245,158,11,.2);color:var(--amb)}
.dbadge{font-size:11px;font-weight:600;padding:2px 7px;border-radius:20px;background:var(--elev);color:var(--mut)}
.res-foot{display:flex;flex-direction:column;align-items:center;gap:9px;padding:10px 0 26px}
/* SCOREBOARD */
.scoreboard{width:100%;max-width:500px;display:flex;flex-direction:column;gap:10px}
.score-row{display:flex;align-items:center;gap:14px;background:var(--surf);border:1px solid var(--brd);border-radius:14px;padding:12px 18px;animation:cin .3s ease both}
.score-row.first{border-color:var(--amb);background:rgba(245,158,11,.08)}
.score-pos{font-family:'Fredoka One',cursive;font-size:20px;min-width:32px;text-align:center}
.score-name{flex:1;font-weight:600;font-size:15px}
.score-pts{font-family:'Fredoka One',cursive;font-size:18px;color:var(--cyn)}
@media(max-width:680px){.login-layout{grid-template-columns:1fr}.login-left{display:none}.palette{max-width:140px}#size-slider,#gsize-slider{width:55px}.gallery{grid-template-columns:repeat(2,1fr)}.winner-banner{padding:13px 16px;flex-wrap:wrap}.guess-layout{grid-template-columns:1fr}.guess-chat-side{max-height:200px}}
