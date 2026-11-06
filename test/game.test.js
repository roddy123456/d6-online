import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, startGame, playDie, playSuper, canUseSuper, targetCountFor, resetToLobby, publicState, applyMysteryRollPassive } from '../server/game.js';
import { CHARACTERS } from '../server/characters.js';

function roomWith(chars=['Cavaleiro','Smoke']) {
  const players=chars.map((ch,i)=>{const p=createPlayer(`p${i}`,`Jogador ${i+1}`);p.character=ch;return p;});
  return {code:'ABCDE',hostId:'p0',status:'lobby',round:0,current:0,winner:null,players,log:[]};
}

test('escudos antigos são zerados quando o jogador inicia seu próximo turno',()=>{
  const r=roomWith();startGame(r);
  const p=r.players[0];p.shields=17;p.dice=[1,2];
  // Move o turno ao adversário e retorna ao primeiro jogador através de uma ação válida.
  playDie(r,'p0',2,[]);
  assert.equal(r.current,1);
  // O adversário executa uma ação que não precisa de alvo.
  r.players[1].dice=[1,2];
  playDie(r,'p1',1,[]);
  assert.equal(r.current,0);
  assert.equal(p.shields,0);
});

test('fim da partida identifica vencedor e permite voltar à seleção',()=>{
  const r=roomWith();startGame(r);
  r.players[1].hp=1;
  // Força um ataque de 6 do Cavaleiro.
  r.players[0].dice=[3,3];
  playDie(r,'p0',3,['p1']);
  assert.equal(r.status,'finished');
  assert.equal(r.winner,'p0');
  assert.match(r.log.join('\n'),/venceu a partida/);
  resetToLobby(r);
  assert.equal(r.status,'lobby');
  assert.equal(r.winner,null);
  assert.equal(r.players[0].character,null);
  assert.equal(r.players[1].character,null);
});

test('efeitos de veneno são processados no fim do turno do afetado',()=>{
  const r=roomWith(['Smoke','Cavaleiro']);startGame(r);
  const target=r.players[1];target.statuses.poison=4;
  // Smoke usa furtividade; a vez passa para o alvo e ele usa uma habilidade.
  r.players[0].dice=[1,2];
  playDie(r,'p0',1,[]);
  const hpBefore=target.hp;
  r.players[1].dice=[1,2];
  playDie(r,'p1',2,[]);
  assert.equal(target.hp,hpBefore-4);
  assert.equal(target.statuses.poison,2);
  assert.match(r.log.join('\n'),/Veneno causou 4/);
});

test('Mistério executa uma habilidade copiada em vez de apenas registrar uma mensagem pendente',()=>{
  const r=roomWith(['Mistério','Cavaleiro']);startGame(r);
  r.players[0].dice=[5,1];
  playDie(r,'p0',5,['p1'],'p1');
  assert.match(r.log.join('\n'),/escolheu copiar Cavaleiro/);
  assert.doesNotMatch(r.log.join('\n'),/efeito de cópia avançado pendente/);
});

test('estado público informa o vencedor',()=>{
  const r=roomWith();startGame(r);r.status='finished';r.winner='p0';
  assert.equal(publicState(r).winner,'p0');
});


test('Super fica disponível como ação opcional e não substitui automaticamente a habilidade',()=>{
  const r=roomWith();startGame(r);
  const p=r.players[0];p.dice=[3,4];
  assert.equal(canUseSuper(p),true);
  assert.equal(targetCountFor(p,'super'),1);
  // A habilidade normal 3 continua sendo escolhida separadamente.
  playDie(r,'p0',3,['p1']);
  assert.doesNotMatch(r.log.join('\n'),/SUPER de Jogador 1/);
});

test('Super pode ser ativada explicitamente quando a combinação está pronta',()=>{
  const r=roomWith();startGame(r);
  const p=r.players[0];p.dice=[3,4];
  playSuper(r,'p0',['p1']);
  assert.match(r.log.join('\n'),/SUPER de Jogador 1/);
  assert.equal(p.acted,true); // ação consumiu o turno
  assert.equal(r.current,1);
});

test('habilidades sem alvo não exigem seleção; ataques exigem alvo',()=>{
  const r=roomWith();startGame(r);
  r.players[0].dice=[2,3];
  assert.equal(targetCountFor(r.players[0],'skill',2),0);
  assert.throws(()=>playDie(r,'p0',3,[]),/exige 1 alvo/);
});


test('Mistério só pede alvo quando a habilidade copiada pede',()=>{
  const r=roomWith(['Mistério','Cavaleiro']);startGame(r);
  const p=r.players[0];
  p.statuses.mysteryCopy='Smoke';
  assert.equal(targetCountFor(p,'skill',2,'Smoke'),1);
  assert.equal(targetCountFor(p,'skill',1,'Feiticeiro'),0);
});

test('Super do Guns N Roses depende das duas rosas necessárias',()=>{
  const r=roomWith(["Guns N' Roses",'Cavaleiro']);startGame(r);
  const p=r.players[0];p.dice=[2,5];p.statuses.roses=1;
  assert.equal(canUseSuper(p),false);
  p.statuses.roses=2;
  assert.equal(canUseSuper(p),true);
});

test('Fraqueza é consumida depois de uma ação de ataque',()=>{
  const r=roomWith(['Smoke','Cavaleiro']);startGame(r);
  const smoke=r.players[0], knight=r.players[1];
  smoke.dice=[5,1];playDie(r,'p0',5,['p1']);
  assert.equal(knight.statuses.weakness,8);
  knight.dice=[3,1];const hp=smoke.hp;playDie(r,'p1',3,['p0']);
  assert.equal(smoke.hp,hp);
  assert.equal(knight.statuses.weakness,0);
});

test('Mistério escolhe um jogador vivo e copia a habilidade do personagem escolhido',()=>{
  const r=roomWith(['Mistério','Lenhador','Cavaleiro']);startGame(r);
  const mystery=r.players[0], target=r.players[2];
  mystery.dice=[2,5];const hp=target.hp;
  playDie(r,'p0',2,['p2'],'p1');
  assert.equal(target.hp,hp-6);
  assert.equal(mystery.statuses.mysteryCopy,'Lenhador');
  assert.match(r.log.join('\n'),/escolheu copiar Lenhador/);
});

test('Monge começa com um dado e mantém o turno após habilidades 1–3',()=>{
  const r=roomWith(['Monge','Cavaleiro']);startGame(r);
  const monk=r.players[0];
  assert.equal(monk.dice.length,1);
  monk.dice=[1];playDie(r,'p0',1,[]);
  assert.equal(r.current,0);
  assert.equal(monk.acted,false);
  assert.equal(monk.dice.length,1);
  assert.equal(monk.statuses.rolledCount,2);
  monk.dice=[4];playDie(r,'p0',4,['p1']);
  assert.equal(r.current,1);
});

test('Pistoleiro acumula +25% permanente por turno; bônus de habilidade é temporário',()=>{
  const r=roomWith(['Pistoleiro','Cavaleiro']);startGame(r);
  const gun=r.players[0], enemy=r.players[1];
  assert.equal(gun.statuses.pistoleiroBonus,25);
  gun.dice=[1,4];playDie(r,'p0',4,[]);
  enemy.dice=[1,2];playDie(r,'p1',2,[]);
  assert.equal(gun.statuses.pistoleiroBonus,50);
  gun.dice=[2,3];const hp=enemy.hp;playDie(r,'p0',2,['p1']);
  assert.equal(enemy.hp,hp-6); // 75% de 8 = 6 (50% passiva + 25% temporário)
  assert.equal(gun.statuses.pistoleiroBonus,50); // passiva não é consumida
  assert.equal(gun.statuses.damageBonus,0); // bônus temporário é consumido
});

test('Cavaleiro: habilidade 1 causa 4 dano e habilidade 2 acumula Força permanente',()=>{
  const r=roomWith(['Cavaleiro','Smoke']);startGame(r);
  const knight=r.players[0], enemy=r.players[1];
  knight.dice=[1,2];const hp=enemy.hp;playDie(r,'p0',1,['p1']);
  assert.equal(enemy.hp,hp-4);
  enemy.dice=[1,2];playDie(r,'p1',1,[]);
  knight.dice=[2,3];playDie(r,'p0',2,[]);
  assert.equal(knight.statuses.permanentStrength,2);
  enemy.dice=[2,4];playDie(r,'p1',2,['p0']);
  knight.dice=[3,4];const hp2=enemy.hp;playDie(r,'p0',3,['p1']);
  assert.equal(enemy.hp,hp2-8); // 6 base + 2 Força permanente
  assert.equal(knight.statuses.permanentStrength,2);
});

test('passiva negativa do Mistério aplica 3 Maldição quando a soma dos dados é 7',()=>{
  const r=roomWith(['Mistério','Cavaleiro']);startGame(r);
  const mystery=r.players[0];mystery.dice=[1,6];mystery.statuses.curse=0;delete mystery.statuses._mysterySevenSignature;
  assert.equal(applyMysteryRollPassive(r,mystery),true);
  assert.equal(mystery.statuses.curse,3);
  assert.match(r.log.join('\n'),/recebeu 3 de Maldição/);
});

test('Mistério não possui mais Super',()=>{
  const r=roomWith(['Mistério','Cavaleiro']);startGame(r);
  const mystery=r.players[0];mystery.dice=[1,6];
  assert.equal(canUseSuper(mystery),false);
  assert.equal(CHARACTERS.Mistério.super,undefined);
});

test('Caçadora, Necromante e Espartano ficam temporariamente fora da seleção',()=>{
  assert.equal(Object.hasOwn(CHARACTERS,'Caçadora'),false);
  assert.equal(Object.hasOwn(CHARACTERS,'Necromante'),false);
  assert.equal(Object.hasOwn(CHARACTERS,'Espartano'),false);
});

test('Congelamento não acumula: mesmo aplicado duas vezes permanece em 1',()=>{
  const r=roomWith(['Feiticeiro','Cavaleiro','Lenhador']);startGame(r);
  const wizard=r.players[0], target=r.players[2];
  wizard.dice=[4,4];
  playDie(r,'p0',4,['p2']);
  assert.equal(target.statuses.freeze,1);
});

test('Super do Cupido elimina os dois amantes quando um deles morre',()=>{
  const r=roomWith(['Cupido','Cavaleiro','Lenhador']);startGame(r);
  const cupid=r.players[0], loverA=r.players[1], loverB=r.players[2];
  cupid.dice=[3,1];
  playSuper(r,'p0',['p1','p2']);
  assert.equal(loverA.statuses.loverId,'p2');
  assert.equal(loverB.statuses.loverId,'p1');
  loverB.hp=1;
  loverA.dice=[3,1];
  playDie(r,'p1',3,['p2']);
  assert.equal(loverA.alive,false);
  assert.equal(loverB.alive,false);
  assert.equal(r.status,'finished');
  assert.equal(r.winner,'p0');
});

test('Feiticeiro usa a habilidade 3 para rerrolar e continua com o dado restante',()=>{
  const r=roomWith(['Feiticeiro','Cavaleiro']);startGame(r);
  const wizard=r.players[0];
  wizard.dice=[3,1];
  playDie(r,'p0',3,[]);
  assert.equal(r.current,0);
  assert.equal(wizard.acted,false);
  assert.equal(wizard.dice.length,2);
  assert.equal(wizard.dice.includes(1),true);
  assert.ok(wizard.dice.every(d=>d>=1&&d<=6));
  playDie(r,'p0',1,[]);
  assert.equal(r.current,1);
});

test('passiva da Fera aplica Ferimentos uma única vez por golpe',()=>{
  const r=roomWith(['Fera','Cavaleiro']);startGame(r);
  const fera=r.players[0], alvo=r.players[1];
  fera.dice=[2,1];
  playDie(r,'p0',2,['p1']);
  assert.equal(alvo.hp,alvo.maxHp-6);
  assert.equal(alvo.statuses.wound,6);
});

test('dano direto contra Viking vira Ferimento sem reduzir HP',()=>{
  const r=roomWith(['Cavaleiro','Viking']);startGame(r);
  const v=r.players[1];r.players[0].dice=[1,2];
  playDie(r,'p0',1,['p1']);
  assert.equal(v.hp,v.maxHp);
  assert.equal(v.statuses.wound,4);
});

test('ovo do Dragão evolui imediatamente quando a redução zera a espera',()=>{
  const r=roomWith(['Dragão (ovo)','Cavaleiro']);startGame(r);
  const egg=r.players[0];egg.statuses.eggWait=3;egg.statuses.previousRollSix=true;egg.dice=[6,2];
  playDie(r,'p0',6,[]);
  assert.equal(egg.character,'Dragão (adulto)');
  assert.equal(egg.maxHp,40);
  assert.equal(egg.hp,40);
});

test('Hipnose permite ao Cogumelóide controlar a ação do turno do alvo',()=>{
  const r=roomWith(['Cogumelóide','Cavaleiro']);startGame(r);
  r.players[0].dice=[5,1];
  playDie(r,'p0',5,['p1']);
  assert.equal(r.current,1);
  assert.equal(r.controllerId,'p0');
  r.players[1].dice=[2,4];
  assert.throws(()=>playDie(r,'p1',2,[]),/Não é sua vez/); // o hipnotizado não pode agir
  playDie(r,'p0',2,[]);
  assert.equal(r.players[1].statuses.hypnosis,undefined);
  assert.equal(r.controllerId,null);
  assert.equal(r.current,0);
});

test('Furtividade dura até o fim do próximo turno do dono e impede seleção como alvo',()=>{
  const r=roomWith(['Smoke','Cavaleiro']);startGame(r);
  const smoke=r.players[0], knight=r.players[1];
  smoke.dice=[1,2];playDie(r,'p0',1,[]);
  assert.equal(smoke.defenses.stealth,true);
  knight.dice=[1,2];
  assert.throws(()=>playDie(r,'p1',1,['p0']),/exige 1 alvo/);
  assert.equal(smoke.defenses.stealth,true);
  // O Cavaleiro usa uma habilidade sem alvo; depois Smoke completa seu próximo turno.
  knight.dice=[2,3];playDie(r,'p1',2,[]);
  smoke.dice=[5,3];playDie(r,'p0',5,['p1']);
  assert.equal(smoke.defenses.stealth,false);
});

test('Intangibilidade anula completamente dano direto, inclusive ataques perfurantes',()=>{
  const r=roomWith(['Cupido','Cavaleiro']);startGame(r);
  const cupid=r.players[0], knight=r.players[1];
  cupid.dice=[2,1];playDie(r,'p0',2,[]);
  assert.equal(cupid.defenses.intangible,true);
  const hp=cupid.hp;
  // A habilidade 1 do Cavaleiro é testada com perfuração forçada no alvo.
  knight.defenses.piercing=true;
  knight.dice=[1,2];playDie(r,'p1',1,['p0']);
  assert.equal(cupid.hp,hp);
  assert.match(r.log.join('\n'),/Intangibilidade/);
});

test('Intangibilidade não protege contra efeitos contínuos',()=>{
  const r=roomWith(['Cupido','Smoke']);startGame(r);
  const cupid=r.players[0], smoke=r.players[1];
  cupid.dice=[2,1];playDie(r,'p0',2,[]);
  cupid.statuses.poison=3;
  smoke.dice=[1,2];playDie(r,'p1',1,[]);
  // O veneno é aplicado no fim do turno do próprio Cupido.
  cupid.dice=[3,4];const hp=cupid.hp;playDie(r,'p0',3,[]);
  assert.equal(cupid.hp,hp-3);
});


test('Mago rola três dados em todos os turnos',()=>{
  const r=roomWith(['Mago','Smoke']);startGame(r);
  const mage=r.players[0];
  assert.equal(mage.dice.length,3);
  mage.dice=[4,1,2];playDie(r,'p0',4,[]);
  r.players[1].dice=[1,2];playDie(r,'p1',1,[]);
  assert.equal(r.current,0);
  assert.equal(mage.dice.length,3);
});

test('Pistoleiro causa somente a fração percentual do dano-base',()=>{
  const r=roomWith(['Pistoleiro','Cavaleiro']);startGame(r);
  const gun=r.players[0], enemy=r.players[1];
  assert.equal(gun.statuses.pistoleiroBonus,25);
  gun.dice=[3,1];const hp=enemy.hp;playDie(r,'p0',3,['p1']);
  assert.equal(enemy.hp,hp-3); // 25% de 12 = 3, não 15
});

test('Confusão escolhe aleatoriamente entre todos os vivos, inclusive o próprio usuário',()=>{
  const r=roomWith(['Cavaleiro','Smoke','Lenhador']);startGame(r);
  const user=r.players[0];user.dice=[1,2];user.statuses.confusion=1;
  const before=r.players.map(p=>p.hp);
  playDie(r,'p0',1,[]);
  const damaged=r.players.map((p,i)=>before[i]-p.hp).filter(x=>x>0);
  assert.deepEqual(damaged,[4]);
  assert.equal(user.statuses.confusion,undefined);
  assert.match(r.log.join('\n'),/Confusão: os 1 alvo/);
});

test('passiva do Cogumelóide impede ataques diretos de jogadores Confusos',()=>{
  const r=roomWith(['Cavaleiro','Cogumelóide']);startGame(r);
  const confused=r.players[0], mushroom=r.players[1];
  confused.dice=[1,2];confused.statuses.confusion=1;
  const hp=mushroom.hp;
  playDie(r,'p0',1,[]);
  assert.equal(mushroom.hp,hp);
});
