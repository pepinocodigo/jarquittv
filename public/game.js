const socket=io();
const state={myId:null,myName:'',roomCode:'',hostId:null,players:[],isHost:false,tool:'pen',color:'#000000',brushSize:8,drawing:false,lastX:0,lastY:0,submitted:false,scores:{}};
const history={stack:[],index:-1,max:50};
const S={login:document.getElementById('screen-login'),lobby:document.getElementById('screen-lobby'),drawing:document.getElementById('screen-drawing'),results:document.getElementById('screen-results')};
function show(n){Object.values(S).forEach(s=>s.classList.remove('active'));S[n].classList.add('active');}
function toast(msg,t=''){const c=document.getElementById('toast-container');const el=document.createElement('div');el.className='toast'+(t?' '+t:'');el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),3500);}
const PAL=['#000000','#FFFFFF','#94a3b8','#475569','#ef4444','#f97316','#f59e0b','#eab308','#22c55e','#10b981','#06b6d4','#3b82f6','#8b5cf6','#a855f7','#ec4899','#f43f5e','#84cc16','#14b8a6','#6366f1','#0ea5e9','#fde68a','#bbf7d0','#bfdbfe','#fecaca','#7f1d1d','#1e3a5f','#14532d','#312e81','#78350f','#1e1b4b'];
function buildPalette(){const c=document.getElementById('color-palette');c.innerHTML='';PAL.forEach(h=>{const s=document.createElement('div');s.className='swatch';s.style.background=h;s.title=h;if(h===state.color)s.classList.add('on');s.addEventListener('click',()=>setColor(h));c.appendChild(s);});}
function setColor(h){state.color=h;document.getElementById('color-preview').style.background=h;document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('on',s.title===h));if(state.tool==='eraser')setTool('pen');}
const canvas=document.getElementById('drawing-canvas');
const ctx=canvas.getContext('2d',{willReadFrequently:true});

function saveHistory(){
  history.stack=history.stack.slice(0,history.index+1);
  history.stack.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  if(history.stack.length>history.max)history.stack.shift();
  history.index=history.stack.length-1;
  updUndoBtns();
}
function undo(){
  if(history.index<=0)return;
  history.index--;
  ctx.putImageData(history.stack[history.index],0,0);
  updUndoBtns();
}
function redo(){
  if(history.index>=history.stack.length-1)return;
  history.index++;
  ctx.putImageData(history.stack[history.index],0,0);
  updUndoBtns();
}
function updUndoBtns(){
  document.getElementById('btn-undo').disabled=history.index<=0;
  document.getElementById('btn-redo').disabled=history.index>=history.stack.length-1;
}

function resizeCanvas(){const a=document.querySelector('.canvas-wrap');if(!a)return;const sz=Math.min(a.clientWidth-24,a.clientHeight-24,680);canvas.width=sz;canvas.height=sz;ctx.fillStyle='#fff';ctx.fillRect(0,0,sz,sz);history.stack=[];history.index=-1;saveHistory();updUndoBtns();}
function gpos(e){const r=canvas.getBoundingClientRect();const sx=canvas.width/r.width,sy=canvas.height/r.height;const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)*sx,y:(cy-r.top)*sy};}
function sdown(e){if(state.submitted)return;e.preventDefault();state.drawing=true;const{x,y}=gpos(e);if(state.tool==='fill'){fill(Math.round(x),Math.round(y),state.color);saveHistory();return;}state.lastX=x;state.lastY=y;ctx.beginPath();ctx.arc(x,y,state.brushSize/2,0,Math.PI*2);ctx.fillStyle=state.tool==='eraser'?'#fff':state.color;ctx.fill();}
function smove(e){if(!state.drawing||state.submitted||state.tool==='fill')return;e.preventDefault();const{x,y}=gpos(e);ctx.beginPath();ctx.moveTo(state.lastX,state.lastY);ctx.lineTo(x,y);ctx.strokeStyle=state.tool==='eraser'?'#fff':state.color;ctx.lineWidth=state.brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();state.lastX=x;state.lastY=y;}
function send(e){if(state.drawing&&state.tool!=='fill'){saveHistory();}state.drawing=false;}
canvas.addEventListener('mousedown',sdown);canvas.addEventListener('mousemove',smove);canvas.addEventListener('mouseup',send);canvas.addEventListener('mouseleave',send);canvas.addEventListener('touchstart',sdown,{passive:false});canvas.addEventListener('touchmove',smove,{passive:false});canvas.addEventListener('touchend',send);

document.addEventListener('keydown',(e)=>{
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
  if(e.ctrlKey&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo();}
});

function h2a(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255];}
function cmatch(a,b,t=16){return Math.abs(a[0]-b[0])<=t&&Math.abs(a[1]-b[1])<=t&&Math.abs(a[2]-b[2])<=t&&Math.abs(a[3]-b[3])<=t;}
function fill(sx,sy,hex){const w=canvas.width,h=canvas.height,id=ctx.getImageData(0,0,w,h),d=id.data;const gi=(x,y)=>{const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];};const tg=gi(sx,sy),fl=h2a(hex);if(cmatch(tg,fl,4))return;const vis=new Uint8Array(w*h),q=[sx+sy*w];vis[sx+sy*w]=1;while(q.length){const p=q.pop(),x=p%w,y=(p/w)|0,i=p*4;d[i]=fl[0];d[i+1]=fl[1];d[i+2]=fl[2];d[i+3]=fl[3];for(const n of[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]){if(n<0||vis[n])continue;if(cmatch(gi(n%w,(n/w)|0),tg)){vis[n]=1;q.push(n);}}}ctx.putImageData(id,0,0);}
function setTool(t){state.tool=t;document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('active'));document.getElementById('tool-'+t)?.classList.add('active');canvas.style.cursor=t==='fill'?'cell':'crosshair';}
document.getElementById('tool-pen').addEventListener('click',()=>setTool('pen'));
document.getElementById('tool-eraser').addEventListener('click',()=>setTool('eraser'));
document.getElementById('tool-fill').addEventListener('click',()=>setTool('fill'));
document.getElementById('btn-undo').addEventListener('click',undo);
document.getElementById('btn-redo').addEventListener('click',redo);
const slider=document.getElementById('size-slider');
slider.addEventListener('input',()=>{state.brushSize=+slider.value;document.getElementById('size-val').textContent=slider.value;});
document.getElementById('btn-clear').addEventListener('click',()=>{const b=document.getElementById('btn-clear');b.style.background='rgba(239,68,68,0.25)';setTimeout(()=>{b.style.background='';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);saveHistory();},400);});
document.getElementById('btn-submit').addEventListener('click',()=>{if(state.submitted)return;state.submitted=true;socket.emit('game:submitDrawing',{drawing:canvas.toDataURL('image/png')});document.getElementById('sub-overlay').classList.remove('hidden');document.getElementById('btn-submit').disabled=true;});
const iname=document.getElementById('input-name');
const icode=document.getElementById('input-code');
document.getElementById('btn-create').addEventListener('click',()=>{const n=iname.value.trim();if(n.length<2){toast('Apelido precisa ter pelo menos 2 letras!','err');iname.focus();return;}state.myName=n;socket.emit('room:create',{name:n});});
document.getElementById('btn-join').addEventListener('click',()=>{const n=iname.value.trim(),c=icode.value.trim();if(n.length<2){toast('Apelido precisa ter pelo menos 2 letras!','err');iname.focus();return;}if(c.length<6){toast('Código tem 6 caracteres!','err');icode.focus();return;}state.myName=n;socket.emit('room:join',{name:n,code:c});});
icode.addEventListener('input',()=>{icode.value=icode.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
function loadRooms(){socket.emit('rooms:list');}
document.getElementById('btn-refresh').addEventListener('click',loadRooms);
socket.on('rooms:data',({rooms})=>{const l=document.getElementById('rooms-list');if(!rooms||!rooms.length){l.innerHTML='<p class="empty">Nenhuma sala aberta.</p>';return;}l.innerHTML='';rooms.forEach(r=>{const el=document.createElement('div');el.className='room-entry';el.innerHTML=`<div><div class="re-code">${r.code}</div><div class="re-count">${r.count}/10 jogadores</div></div><button class="re-btn">Entrar</button>`;el.querySelector('button').addEventListener('click',()=>{icode.value=r.code;toast('Código preenchido! Coloque seu apelido e clique Entrar.');});l.appendChild(el);});});
const AVCOLS=['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316','#3b82f6'];
function avcol(n){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);return AVCOLS[Math.abs(h)%AVCOLS.length];}
function renderLobby(){const g=document.getElementById('players-grid');g.innerHTML='';state.players.forEach(p=>{const c=document.createElement('div');c.className='pcard';if(p.id===state.hostId)c.classList.add('host');if(p.id===state.myId)c.classList.add('you');let badge='';if(p.id===state.hostId&&p.id===state.myId)badge='<span class="pbadge bhost">HOST 👑 você</span>';else if(p.id===state.hostId)badge='<span class="pbadge bhost">HOST 👑</span>';else if(p.id===state.myId)badge='<span class="pbadge byou">você</span>';c.innerHTML=`<div class="pavatar" style="background:${avcol(p.name)}">${p.name[0].toUpperCase()}</div><span class="pname">${p.name}</span>${badge}`;g.appendChild(c);});document.getElementById('player-count').textContent=state.players.length;const bs=document.getElementById('btn-start'),wm=document.getElementById('wait-msg'),mh=document.getElementById('min-hint');if(state.isHost){bs.classList.remove('hidden');wm.classList.add('hidden');bs.disabled=state.players.length<2;mh.style.display=state.players.length<2?'block':'none';}else{bs.classList.add('hidden');wm.classList.remove('hidden');mh.style.display='none';}}
document.getElementById('btn-copy').addEventListener('click',()=>{navigator.clipboard.writeText(state.roomCode).then(()=>toast('Código copiado! 📋','ok')).catch(()=>toast('Não foi possível copiar.','err'));});
document.getElementById('btn-start').addEventListener('click',()=>socket.emit('game:start'));
function updTimer(t){const el=document.getElementById('timer-val'),box=document.getElementById('timer-box');el.textContent=t;el.classList.remove('y','r');box.classList.remove('tgreen','tyellow','tred');if(t>60)box.classList.add('tgreen');else if(t>30){el.classList.add('y');box.classList.add('tyellow');}else{el.classList.add('r');box.classList.add('tred');}}
function showResults({drawings,winnerId,winnerName,verdict}){show('results');document.getElementById('robo-wrap').style.display='flex';document.getElementById('res-content').classList.add('hidden');const bar=document.getElementById('robo-prog');let p=0;const iv=setInterval(()=>{p+=1.2;bar.style.width=Math.min(p,100)+'%';if(p>=100)clearInterval(iv);},30);setTimeout(()=>{document.getElementById('robo-wrap').style.display='none';document.getElementById('res-content').classList.remove('hidden');document.getElementById('winner-name').textContent=winnerName;document.getElementById('winner-verdict').textContent='"'+verdict+'"';const gal=document.getElementById('gallery');gal.innerHTML='';drawings.forEach(d=>{const card=document.createElement('div');card.className='dcard';if(d.id===winnerId)card.classList.add('win');const cv=document.createElement('canvas');cv.width=200;cv.height=200;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,200,200);const ft=document.createElement('div');ft.className='dfoot';const au=document.createElement('span');au.className='dauthor';au.textContent=d.name;ft.appendChild(au);const pts=state.scores[d.id]||0;const bd=document.createElement('span');bd.className=d.id===winnerId?'dbadge-win':'dbadge';bd.textContent=(d.id===winnerId?'🏆 ':'')+pts+'pt';ft.appendChild(bd);card.appendChild(cv);card.appendChild(ft);gal.appendChild(card);if(d.drawing){const img=new Image();img.onload=()=>{cx.clearRect(0,0,200,200);cx.fillStyle='#fff';cx.fillRect(0,0,200,200);cx.drawImage(img,0,0,200,200);};img.src=d.drawing;}});const bn=document.getElementById('btn-next'),nw=document.getElementById('next-wait');if(state.isHost){bn.classList.remove('hidden');nw.classList.add('hidden');}else{bn.classList.add('hidden');nw.classList.remove('hidden');}},3200);}
document.getElementById('btn-next').addEventListener('click',()=>socket.emit('game:nextRound'));
socket.on('connect',()=>{state.myId=socket.id;loadRooms();});
socket.on('room:created',({code,players,hostId})=>{state.roomCode=code;state.players=players;state.hostId=hostId;state.isHost=true;document.getElementById('display-code').textContent=code;renderLobby();show('lobby');});
socket.on('room:joined',({code,players,hostId})=>{state.roomCode=code;state.players=players;state.hostId=hostId;state.isHost=socket.id===hostId;document.getElementById('display-code').textContent=code;renderLobby();show('lobby');});
socket.on('room:playerJoined',({players,newPlayer})=>{state.players=players;renderLobby();toast(newPlayer+' entrou 👋');});
socket.on('room:playerLeft',({players,leftPlayer})=>{state.players=players;renderLobby();toast(leftPlayer+' saiu');});
socket.on('room:hostTransferred',({newHostId,newHostName})=>{state.hostId=newHostId;state.isHost=socket.id===newHostId;renderLobby();toast(newHostName+' agora é o host 👑');});
socket.on('room:error',({message})=>toast(message,'err'));
socket.on('game:started',({theme})=>{state.submitted=false;resizeCanvas();document.getElementById('sub-overlay').classList.add('hidden');document.getElementById('btn-submit').disabled=false;document.getElementById('current-theme').textContent=theme;buildPalette();setTool('pen');setColor('#000000');slider.value=8;state.brushSize=8;document.getElementById('size-val').textContent='8';updTimer(120);show('drawing');});
socket.on('game:timerUpdate',({time})=>updTimer(time));
socket.on('game:showResults',({drawings,winnerId,winnerName,verdict})=>{drawings.forEach(d=>{if(!state.scores[d.id])state.scores[d.id]=d.score||0;});if(!state.scores[winnerId])state.scores[winnerId]=0;state.scores[winnerId]++;showResults({drawings,winnerId,winnerName,verdict});});
socket.on('disconnect',()=>toast('Conexão perdida. Recarregue.','err'));
window.addEventListener('resize',()=>{if(S.drawing.classList.contains('active'))resizeCanvas();});
show('login');
