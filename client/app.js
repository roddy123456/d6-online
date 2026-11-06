const socket=io();
const $=id=>document.getElementById(id);
let state=null,myId=null,roomCode=null,characters={},pendingAction=null,selectedTargets=new Set();
let soundEnabled=true,audioCtx=null,lastLogCount=0,lastCurrent=null,rollAnimationToken=0;
const dieFaces={1:'⚀',2:'⚁',3:'⚂',4:'⚃',5:'⚄',6:'⚅'};
const oneTarget={
 'Cavaleiro':[1,3,6],'Smoke':[2,4,5],'Lenhador':[2,4,5],'Feiticeiro':[2,4,5],
 "Guns N' Roses":[6],'Monge':[2,4,6],'Narval':[3,5,6],'Espartano':[2,3],
 'Pistoleiro':[2,3],'Cupido':[1,5,6],'Necromante':[5],'Fera':[2,4,6],
 'Caçadora':[2,3,5,6], 'Mago':[1,3], 'Arqueira':[3,6], 'Cogumelóide':[5], 'Samurai':[1,2,4,5], 'Assassino':[2,3,5], 'Viking':[1,3,6], 'Palhaço':[1,5], 'Gangster':[4], 'Dragão (adulto)':[3,5]
};
function targetCount(action,die,copyCharacter=null){
 const p=state?.players?.[state.current];if(!p)return 0;
 if(action==='super')return ({Cavaleiro:1,Smoke:1,Lenhador:1,Monge:1,Narval:1,Pistoleiro:1,Cupido:2})[p.character]||0;
 const ch=p.character==='Mistério'?(copyCharacter||p.statuses?.mysteryCopy):p.character;
 if(!ch)return 0;
 if(!(oneTarget[ch]||[]).includes(Number(die)))return 0;
 return ch==='Fera'&&Number(die)===4?2:1;
}
function tone(freq,duration=0.12,type='sine',volume=0.045,delay=0){
 if(!soundEnabled)return;
 try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
 const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime+delay);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+delay+duration);o.connect(g);g.connect(audioCtx.destination);o.start(audioCtx.currentTime+delay);o.stop(audioCtx.currentTime+delay+duration);
 }catch{}
}
function sound(kind){
 if(kind==='roll'){[440,550,660].forEach((f,i)=>tone(f,.08,'triangle',.035,i*.055));}
 else if(kind==='attack'){tone(150,.16,'sawtooth',.06);tone(90,.2,'triangle',.035,.08);}
 else if(kind==='super'){[392,494,587,784].forEach((f,i)=>tone(f,.22,'sine',.05,i*.09));}
 else if(kind==='win'){[523,659,784,1046].forEach((f,i)=>tone(f,.32,'triangle',.05,i*.14));}
 else if(kind==='click')tone(700,.045,'square',.018);
}
socket.on('connect',()=>{$('connection').textContent='Conectado';myId=socket.id;});
socket.on('disconnect',()=>{$('connection').textContent='Desconectado';});
socket.on('created',x=>{roomCode=x.code;$('home').classList.add('hidden');$('game').classList.remove('hidden');$('code').textContent=x.code;});
socket.on('state',s=>{
 const old=state;state=s;roomCode=s.code;$('home').classList.add('hidden');$('game').classList.remove('hidden');$('code').textContent=s.code;$('phase').textContent=s.status==='lobby'?'Aguardando jogadores':s.status==='playing'?`Rodada ${s.round}`:'Partida encerrada';
 if(old&&s.log.length>old.log.length){const fresh=s.log.slice(old.log.length).join(' ');if(/SUPER/.test(fresh))sound('super');else if(/recebeu .* dano|ataque|Ferimentos causaram|Veneno causou/.test(fresh))sound('attack');}
 if(old?.status!=='finished'&&s.status==='finished')sound('win');
 const newTurn=s.status==='playing'&&(!old||old.status!=='playing'||old.current!==s.current);
 if(newTurn)sound('roll');
 if(!old||old.current!==s.current||old.status!==s.status)pendingAction=null;
 render();
 if(s.log.length && (!old || s.log.length>old.log.length)){const event=s.log[s.log.length-1];showEvent(event);}
 if(newTurn)animateDiceRoll();
});

// Animação de rolagem visual: os dados ficam parados enquanto os números mudam por ~1 s.
function animateDiceRoll(){
 const token=++rollAnimationToken;
 const p=state?.players?.[state.current];
 if(!p?.dice?.length)return;
 const buttons=[...document.querySelectorAll('#dice .die')];
 buttons.forEach((button,i)=>{button.classList.add('rolling');button.disabled=true;});
 const started=Date.now();
 const timer=setInterval(()=>{
  if(token!==rollAnimationToken){clearInterval(timer);return;}
  const elapsed=Date.now()-started;
  buttons.forEach((button,i)=>{
   const value=elapsed>=940?p.dice[i]:1+Math.floor(Math.random()*6);
   const face=button.querySelector('span'),number=button.querySelector('small');
   if(face)face.textContent=dieFaces[value];if(number)number.textContent=String(value);
  });
  if(elapsed>=1000){
   clearInterval(timer);
   buttons.forEach(button=>button.classList.remove('rolling'));
   const current=state?.players?.[state.current];
   buttons.forEach(button=>button.disabled=!(current?.id===myId&&!current.acted&&!pendingAction));
  }
 },65);
}
socket.on('errorMessage',m=>{$('error').textContent=m;});
fetch('/api/characters').then(r=>r.json()).then(data=>{characters=data;for(const n of Object.keys(data)){const o=document.createElement('option');o.value=n;o.textContent=`${n} · ${data[n].hp} HP`;$('character').append(o);}});
$('create').onclick=()=>socket.emit('createRoom',{name:$('name').value});
$('join').onclick=()=>socket.emit('joinRoom',{code:$('roomCode').value.trim(),name:$('name').value});
$('character').onchange=()=>socket.emit('chooseCharacter',{character:$('character').value});
$('start').onclick=()=>socket.emit('startGame');
$('returnLobby').onclick=()=>socket.emit('returnToLobby');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$('copy').textContent='Copiado!';}catch{$('copy').textContent=roomCode;}};
$('soundToggle').onclick=()=>{soundEnabled=!soundEnabled;$('soundToggle').textContent=soundEnabled?'🔊 Som ligado':'🔇 Som desligado';$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)sound('click');};
const characterMarks={'Cavaleiro':'⚔️','Smoke':'🌫️','Lenhador':'🪓','Mistério':'🎭','Feiticeiro':'🔮',"Guns N\' Roses":'🌹','Monge':'🥋','Narval':'🦄','Pistoleiro':'🤠','Cupido':'💘','Fera':'🐺','Mago':'🧙','Arqueira':'🏹','Cogumelóide':'🍄','Samurai':'🗡️','Assassino':'🗡️','Viking':'🪓','Palhaço':'🤡','Gangster':'🎩','Dragão (ovo)':'🥚','Dragão (adulto)':'🐉','Espartano':'🛡️','Necromante':'💀','Caçadora':'🏹'};
function showEvent(message){const toast=$('eventToast');if(!toast)return;toast.textContent=message;toast.classList.remove('show');void toast.offsetWidth;toast.classList.add('show');}
function playerCard(p){
 const div=document.createElement('div');div.className='player'+(p.alive===false?' eliminated':'');const h=document.createElement('strong');h.className='player-name';h.textContent=p.name+(p.id===state.hostId?' 👑':'');const s=document.createElement('small');s.className='character-tag';s.textContent=p.character?`${characterMarks[p.character]||'🎲'} ${p.character}`:'🎲 Escolhendo personagem';div.append(h,s);
 if(state.status!=='lobby'){const hp=document.createElement('small');hp.textContent=`${p.alive?'❤️ '+p.hp+'/'+p.maxHp+' HP':'☠️ Eliminado'} · 🛡️ ${p.shields||0}`;div.append(hp);const bar=document.createElement('div');bar.className='hp';const i=document.createElement('i');i.style.width=`${p.maxHp?Math.max(0,p.hp/p.maxHp*100):0}%`;bar.append(i);div.append(bar);
 const active=Object.entries(p.statuses||{}).filter(([k,v])=>!k.startsWith('_')&&v&&v!==false&&v!==0);const defs=Object.entries(p.defenses||{}).filter(([k,v])=>!k.endsWith('UntilTurn')&&v&&v!==0);if(active.length||defs.length){const effects=document.createElement('small');effects.className='player-effects';effects.textContent=[...active.map(([k,v])=>`${k}: ${v===true?'ativo':v}`),...defs.map(([k,v])=>`${k}: ${v===true?'ativo':v}`)].join(' · ');div.append(effects);}}
 return div;
}
function showTargetStage(title,hint,needed,eligiblePlayers,showSkills=false){
 $('targetWrap').classList.remove('hidden');$('targetTitle').textContent=title;$('targetHint').textContent=hint;
 $('targets').replaceChildren();selectedTargets.clear();
 const preview=$('copyPreview');preview.replaceChildren();preview.classList.toggle('hidden',!showSkills);
 eligiblePlayers.forEach(x=>{
  const wrap=document.createElement('div');wrap.className=showSkills?'copy-choice':'';
  const b=document.createElement('button');b.className='target';b.textContent=`${x.name} · ${x.character||''} · ${x.hp} HP`;
  b.onclick=()=>{if(selectedTargets.has(x.id)){selectedTargets.delete(x.id);b.classList.remove('selected');}else if(selectedTargets.size<needed){selectedTargets.add(x.id);b.classList.add('selected');} $('confirmAction').disabled=selectedTargets.size!==needed;};
  wrap.append(b);
  if(showSkills){const info=characters[x.character];const list=document.createElement('div');list.className='copy-skills';(info?.skills||[]).forEach((skill,i)=>{const line=document.createElement('span');line.textContent=`${i+1}. ${skill}`;list.append(line);});wrap.append(list);}
  (showSkills?preview:$('targets')).append(wrap);
 });
 $('confirmAction').disabled=true;document.querySelectorAll('.die').forEach(el=>el.disabled=true);$('useSuper').disabled=true;
 $('skillHint').textContent=hint;
}
function beginAction(action,die){
 const p=state.players[state.current];pendingAction={action,die,needed:0,stage:null,copyPlayerId:null};selectedTargets.clear();
 if(p.character==='Mistério'&&action==='skill'){
  pendingAction.stage='copy';
  const eligible=state.players.filter(x=>x.alive&&x.id!==p.id&&x.character&&x.character!=='Mistério');
  showTargetStage('Mistério: escolha quem copiar','Veja as seis habilidades de cada personagem e escolha qual conjunto deseja copiar.',1,eligible,true);return;
 }
 const needed=targetCount(action,die);pendingAction.needed=needed;
 if(needed===0 || (p.statuses?.confusion||0)>0){executePending();return;}
 pendingAction.stage='targets';
 showTargetStage(needed===1?'Escolha 1 alvo':'Escolha 2 alvos',`Esta ação exige ${needed} alvo(s). Selecione ${needed} adversário(s) e confirme.`,needed,state.players.filter(x=>x.alive&&x.id!==p.id&&!x.defenses?.stealth));
}
function executePending(){
 if(!pendingAction)return;
 if(pendingAction.stage==='copy'){
  if(selectedTargets.size!==1)return;
  pendingAction.copyPlayerId=[...selectedTargets][0];
  const source=state.players.find(x=>x.id===pendingAction.copyPlayerId);selectedTargets.clear();
  const needed=targetCount('skill',pendingAction.die,source?.character)||0;pendingAction.needed=needed;
  if(needed===0 || (state.players[state.current].statuses?.confusion||0)>0){pendingAction.stage=null;executePending();return;}
  pendingAction.stage='targets';
  showTargetStage(needed===1?'Escolha 1 alvo':'Escolha 2 alvos',`Você copiou ${source.character}. Agora escolha ${needed} alvo(s) para a habilidade.`,needed,state.players.filter(x=>x.alive&&x.id!==state.players[state.current].id&&!x.defenses?.stealth));
  return;
 }
 const a=pendingAction,ids=[...selectedTargets];
 if(a.needed&&ids.length!==a.needed)return;
 if(a.action==='super')socket.emit('useSuper',{targetIds:ids});else socket.emit('useDie',{die:a.die,targetIds:ids,copyPlayerId:a.copyPlayerId});
 sound(a.action==='super'?'super':'click');pendingAction=null;selectedTargets.clear();$('targetWrap').classList.add('hidden');
}
$('confirmAction').onclick=executePending;
function render(){
 const lobby=state.status==='lobby',finished=state.status==='finished';
 $('lobby').classList.toggle('hidden',!lobby);$('battle').classList.toggle('hidden',lobby||finished);$('finished').classList.toggle('hidden',!finished);
 $('playersLobby').replaceChildren(...state.players.map(playerCard));$('start').classList.toggle('hidden',myId!==state.hostId);$('start').disabled=state.players.length<2||state.players.some(p=>!p.character);
 if(lobby){$('character').value='';return;}
 if(finished){const winner=state.players.find(p=>p.id===state.winner);$('winnerText').textContent=winner?`${winner.name}, com ${winner.character}, venceu a partida!`:'A partida terminou sem vencedor.';$('finishedHint').textContent=myId===state.hostId?'Você pode iniciar uma nova seleção de personagens.':'Aguardando o anfitrião voltar à seleção de personagens.';$('returnLobby').classList.toggle('hidden',myId!==state.hostId);return;}
 $('playersBattle').replaceChildren(...state.players.map(playerCard));
 const p=state.players[state.current],mine=(state.controllerId?state.controllerId===myId:p?.id===myId)&&state.status==='playing';
 $('turnTitle').textContent=p?`Vez de ${p.name}`:'Turno';
 $('turnHint').textContent=state.controllerId===myId?`Você está controlando ${p.name} por Hipnose. Escolha uma habilidade dele.`:(state.controllerId&&p?.id===myId)?'Você foi hipnotizado: seu turno está sendo controlado por outro jogador.':mine?'Sua vez: escolha uma habilidade ou use sua Super disponível.':'Aguardando o jogador atual…';
 $('targetWrap').classList.toggle('hidden',!pendingAction);
 $('dice').replaceChildren();
 if(p?.dice){p.dice.forEach(d=>{const b=document.createElement('button');b.className='die';b.innerHTML=`<span>${dieFaces[d]}</span><small>${d}</small>`;b.disabled=!mine||p.acted||!!pendingAction;b.title=`Usar habilidade ${d}`;b.onclick=()=>beginAction('skill',d);$('dice').append(b);});}
 const superBtn=$('useSuper');superBtn.classList.toggle('hidden',!p?.superReady);superBtn.disabled=!mine||p.acted||!!pendingAction;superBtn.onclick=()=>beginAction('super',null);
 const info=p?.character&&characters[p.character];$('skills').replaceChildren();
 if(info){info.skills.forEach((skill,i)=>{const card=document.createElement('div');card.className='skill-card';card.classList.toggle('available',!!mine&&!p.acted&&!pendingAction&&p.dice.includes(i+1));const die=document.createElement('div');die.className='skill-die';die.textContent=dieFaces[i+1];const num=document.createElement('b');num.textContent=i+1;const desc=document.createElement('span');desc.textContent=skill;card.append(die,num,desc);$('skills').append(card);});
 $('skillHint').textContent=`${p.character} · ${p.hp}/${p.maxHp} HP · ${p.statuses?.roses||0} rosas · ${p.statuses?.bullets||0} balas${p.character==='Mistério'?' · Escolha um personagem vivo ao usar uma habilidade':''}${p.character==='Pistoleiro'?` · Passiva: ${p.statuses?.pistoleiroBonus||0}% · Bônus: ${p.statuses?.damageBonus||0}%`:''}`;
 }else $('skillHint').textContent='';
 $('log').replaceChildren(...state.log.slice().reverse().map(line=>{const d=document.createElement('div');d.textContent=line;return d;}));
}
