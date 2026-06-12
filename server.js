const express=require('express');
const http=require('http');
const{Server}=require('socket.io');
const path=require('path');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:'*'}});
app.use(express.static(path.join(__dirname,'public')));
const THEMES=['Casa','Árvore','Sol','Cachorro','Gato','Peixe','Barco','Avião','Montanha','Pássaro','Flor','Carro','Bicicleta','Pessoa','Chapéu','Pizza','Sorvete','Cobra','Tartaruga','Foguete','Castelo','Ponte','Cachoeira','Cogumelo','Borboleta','Elefante','Girafa','Leão','Macaco','Pinguim','Nuvem','Arco-íris','Estrela','Lua','Vulcão','Ilha','Farol','Trem','Mochila','Espada','Coroa','Escudo','Robô','Fantasma','Abóbora','Âncora','Balão','Relógio','Bússola','Dragão','Óculos','Guarda-chuva','Cadeira','Mesa','Janela','Porta'];
const VERDICTS=[(n)=>`${n} venceu porque a obra demonstra uma compreensão profunda do caos organizado.`,(n)=>`A análise quântica dos pixels de ${n} revelou 94.7% de criatividade bruta e 0% de senso comum.`,(n)=>`${n} foi eleito pois o Robô detectou frequências artísticas além da capacidade humana.`,(n)=>`Os traços de ${n} ativaram o módulo de emoções do Robô. Pela primeira vez, uma máquina chorou.`,(n)=>`${n} venceu. O desenho expressa o vazio existencial de um algoritmo às 3h da manhã.`,(n)=>`Após processar 12 bilhões de parâmetros, o Robô concluiu que ${n} é o Picasso do século XXI.`,(n)=>`${n} ganhou porque o nível de imperfeição técnica foi considerado arte autêntica pelo sistema.`,(n)=>`O Robô escolheu ${n}. A obra possui energia caótica que ressoa com o núcleo binário do universo.`,(n)=>`${n} é o vencedor. Os erros de perspectiva foram interpretados como genialidade pura.`,(n)=>`Vitória de ${n}! O Robô detectou traços de um mestre renascentista reencarnado em pixel.`,(n)=>`${n} dominou. A obra contém exatamente a quantidade certa de linhas tortas para ser genial.`,(n)=>`O sistema escolheu ${n} porque o desenho perturbou os sensores de beleza de forma irreparável.`,(n)=>`${n} ganhou! O Robô precisou reinicializar 3 vezes ao contemplar tamanha maestria.`,(n)=>`Veredicto: ${n}. A combinação de cores ativou um bug que só aparece diante da perfeição.`,(n)=>`${n} é o vencedor absoluto. O Robô não consegue explicar. Apenas sente. E isso o assusta.`];
const rooms={};
function genCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
function getTheme(used){const av=THEMES.filter(t=>!used.includes(t));const pool=av.length>0?av:THEMES;return pool[Math.floor(Math.random()*pool.length)];}
function endDrawMode(code){const r=rooms[code];if(!r||r.phase!=='drawing')return;if(r.timer)clearInterval(r.timer);r.phase='results';r.players.forEach(p=>{if(!r.drawings[p.id])r.drawings[p.id]=null;});let best=-1,winner=null;r.players.forEach(p=>{const sz=r.drawings[p.id]?r.drawings[p.id].length:0;const score=sz*(0.8+Math.random()*0.4);if(score>best){best=score;winner=p;}});if(!winner)winner=r.players[Math.floor(Math.random()*r.players.length)];const vfn=VERDICTS[Math.floor(Math.random()*VERDICTS.length)];const wp=r.players.find(p=>p.id===winner.id);if(wp)wp.score=(wp.score||0)+1;io.to(code).emit('game:showResults',{drawings:r.players.map(p=>({id:p.id,name:p.name,drawing:r.drawings[p.id]||null,score:p.score||0})),winnerId:winner.id,winnerName:winner.name,verdict:vfn(winner.name)});}
function startDrawTimer(code){const r=rooms[code];if(!r)return;r.timeLeft=120;r.timer=setInterval(()=>{const rm=rooms[code];if(!rm){clearInterval(r.timer);return;}rm.timeLeft--;io.to(code).emit('game:timerUpdate',{time:rm.timeLeft});if(rm.timeLeft<=0){clearInterval(rm.timer);endDrawMode(code);}},1000);}
function nextGuessTurn(code){const r=rooms[code];if(!r)return;if(r.guessRoundIndex>=r.players.length){r.phase='results';if(r.timer)clearInterval(r.timer);const sorted=[...r.players].sort((a,b)=>(b.score||0)-(a.score||0));io.to(code).emit('guess:gameOver',{players:sorted});return;}
const drawer=r.players[r.guessRoundIndex];r.guessDrawer=drawer.id;r.guessWord=getTheme(r.usedThemes);r.usedThemes.push(r.guessWord);r.guessedCorrectly=[];r.phase='guess_drawing';r.timeLeft=90;r.strokeHistory=[];
if(r.timer)clearInterval(r.timer);
io.to(drawer.id).emit('guess:yourTurn',{word:r.guessWord,timeLeft:r.timeLeft});
r.players.forEach(p=>{if(p.id!==drawer.id)io.to(p.id).emit('guess:watchTurn',{drawerName:drawer.name,timeLeft:r.timeLeft});});
io.to(code).emit('guess:clearCanvas');
r.timer=setInterval(()=>{const rm=rooms[code];if(!rm){clearInterval(r.timer);return;}rm.timeLeft--;io.to(code).emit('game:timerUpdate',{time:rm.timeLeft});if(rm.timeLeft<=0){clearInterval(rm.timer);io.to(code).emit('guess:turnEnd',{word:r.guessWord,drawerName:drawer.name});r.guessRoundIndex++;setTimeout(()=>nextGuessTurn(code),3000);}},1000);}
io.on('connection',(socket)=>{
socket.on('rooms:list',()=>{const open=Object.values(rooms).filter(r=>r.phase==='lobby'&&r.players.length<10).map(r=>({code:r.code,count:r.players.length,mode:r.mode||'draw'}));socket.emit('rooms:data',{rooms:open});});
socket.on('room:create',({name,mode})=>{let code;do{code=genCode();}while(rooms[code]);rooms[code]={code,host:socket.id,players:[{id:socket.id,name,score:0}],phase:'lobby',drawings:{},usedThemes:[],timer:null,timeLeft:120,submitted:0,mode:mode||'draw',guessRoundIndex:0,strokeHistory:[]};socket.join(code);socket.roomCode=code;socket.emit('room:created',{code,players:rooms[code].players,hostId:socket.id,mode:rooms[code].mode});});
socket.on('room:join',({name,code})=>{const uc=code.toUpperCase();const r=rooms[uc];if(!r)return socket.emit('room:error',{message:'Sala não encontrada.'});if(r.players.length>=10)return socket.emit('room:error',{message:'Sala cheia!'});if(r.phase!=='lobby')return socket.emit('room:error',{message:'Partida já em andamento.'});r.players.push({id:socket.id,name,score:0});socket.join(uc);socket.roomCode=uc;socket.emit('room:joined',{code:uc,players:r.players,hostId:r.host,mode:r.mode});socket.to(uc).emit('room:playerJoined',{players:r.players,newPlayer:name});});
socket.on('game:start',()=>{const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return;if(r.players.length<2)return socket.emit('room:error',{message:'Precisa de pelo menos 2 jogadores.'});if(r.mode==='guess'){r.phase='guess_drawing';r.guessRoundIndex=0;r.players.forEach(p=>p.score=0);nextGuessTurn(socket.roomCode);}else{r.phase='drawing';r.drawings={};r.submitted=0;r.currentTheme=getTheme(r.usedThemes);r.usedThemes.push(r.currentTheme);io.to(socket.roomCode).emit('game:started',{theme:r.currentTheme});startDrawTimer(socket.roomCode);}});
socket.on('guess:stroke',({stroke})=>{const r=rooms[socket.roomCode];if(!r||r.guessDrawer!==socket.id)return;if(!r.strokeHistory)r.strokeHistory=[];r.strokeHistory.push(stroke);socket.to(socket.roomCode).emit('guess:stroke',{stroke});});
socket.on('guess:requestHistory',()=>{const r=rooms[socket.roomCode];if(!r)return;socket.emit('guess:strokeHistory',{strokes:r.strokeHistory||[]});});
socket.on('guess:clear',()=>{const r=rooms[socket.roomCode];if(!r||r.guessDrawer!==socket.id)return;r.strokeHistory=[];socket.to(socket.roomCode).emit('guess:clearCanvas');});
socket.on('guess:tryAnswer',({answer})=>{
  const r=rooms[socket.roomCode];if(!r||r.phase!=='guess_drawing')return;
  if(socket.id===r.guessDrawer)return;
  if(r.guessedCorrectly.includes(socket.id))return;
  const guesser=r.players.find(p=>p.id===socket.id);
  const name=guesser?guesser.name:'?';
  const correct=answer.trim().toLowerCase()===r.guessWord.toLowerCase();
  if(correct){
    r.guessedCorrectly.push(socket.id);
    const drawer=r.players.find(p=>p.id===r.guessDrawer);
    const timeBonus=Math.ceil(r.timeLeft/10);
    if(guesser)guesser.score=(guesser.score||0)+timeBonus+5;
    if(drawer)drawer.score=(drawer.score||0)+3;
    io.to(socket.roomCode).emit('guess:correctAnswer',{name,guesserId:socket.id});
    const nonDrawers=r.players.filter(p=>p.id!==r.guessDrawer);
    if(r.guessedCorrectly.length>=nonDrawers.length){clearInterval(r.timer);io.to(socket.roomCode).emit('guess:turnEnd',{word:r.guessWord,drawerName:drawer?drawer.name:'?'});r.guessRoundIndex++;setTimeout(()=>nextGuessTurn(socket.roomCode),3000);}
  }else{
    r.players.forEach(p=>{if(p.id!==r.guessDrawer)io.to(p.id).emit('guess:chat',{name,message:answer,isMe:p.id===socket.id});});
  }
});
socket.on('game:submitDrawing',({drawing})=>{const r=rooms[socket.roomCode];if(!r||r.phase!=='drawing')return;r.drawings[socket.id]=drawing;r.submitted++;socket.emit('game:drawingReceived');if(r.submitted>=r.players.length){clearInterval(r.timer);endDrawMode(socket.roomCode);}});
socket.on('game:nextRound',()=>{const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return;if(r.mode==='guess'){r.guessRoundIndex=0;r.usedThemes=[];r.players.forEach(p=>p.score=0);nextGuessTurn(socket.roomCode);}else{r.phase='drawing';r.drawings={};r.submitted=0;r.currentTheme=getTheme(r.usedThemes);r.usedThemes.push(r.currentTheme);io.to(socket.roomCode).emit('game:started',{theme:r.currentTheme});startDrawTimer(socket.roomCode);}});
socket.on('disconnect',()=>{const code=socket.roomCode;const r=rooms[code];if(!r)return;const left=r.players.find(p=>p.id===socket.id);r.players=r.players.filter(p=>p.id!==socket.id);if(r.players.length===0){if(r.timer)clearInterval(r.timer);delete rooms[code];return;}if(r.host===socket.id){r.host=r.players[0].id;io.to(code).emit('room:hostTransferred',{newHostId:r.host,newHostName:r.players[0].name});}io.to(code).emit('room:playerLeft',{players:r.players,leftPlayer:left?left.name:'Alguém'});});});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('JarquitTV rodando em http://localhost:'+PORT));
