import { randomInt } from 'node:crypto';
import { CHARACTERS } from './characters.js';

const d6 = () => randomInt(1, 7);
const alive = room => room.players.filter(p => p.alive);
const log = (room, message) => { room.log.push(message); if (room.log.length > 250) room.log.shift(); };
const enemies = (room, player) => alive(room).filter(p => p.id !== player.id);
const pickTargets = (room, player, ids = []) => {
  // Furtividade impede que o jogador seja escolhido como alvo de habilidades direcionadas.
  return [...new Set(ids)].map(id => enemies(room, player).find(p => p.id === id))
    .filter(p => p && !p.defenses.stealth);
};
function randomConfusedTargets(room, player, count) {
  // Confusão pode escolher qualquer vivo, inclusive o próprio usuário; Furtividade ainda protege os demais.
  const candidates = alive(room).filter(x => x.id === player.id || !x.defenses.stealth);
  if (!candidates.length || count <= 0) return [];
  return Array.from({ length: count }, () => candidates[randomInt(candidates.length)]);
}
function isTurnActor(room, p, playerId) {
  return room.controllerId ? room.controllerId === playerId : p?.id === playerId;
}
function grantTurnDefense(p, key) {
  p.defenses[key] = true;
  // A defesa permanece durante a rodada dos adversários e termina no fim do próximo turno do dono.
  p.defenses[`${key}UntilTurn`] = (p.turnCount || 0) + 1;
}
const targetAt = (targets, index = 0) => targets[index] || null;

export function publicState(room) {
  return {
    code: room.code, hostId: room.hostId, status: room.status, round: room.round,
    current: room.current, controllerId: room.controllerId || null, winner: room.winner || null,
    players: room.players.map(p => ({
      id: p.id, name: p.name, character: p.character, hp: p.hp, maxHp: p.maxHp,
      alive: p.alive, dice: p.dice, shields: p.shields, statuses: { ...p.statuses },
      defenses: { ...p.defenses }, ready: p.ready, roses: p.roses || 0,
      bullets: p.bullets || 0, arrows:p.statuses.arrows||0, bolhinhas:p.statuses.bolhinhas||0, eggWait:p.statuses.eggWait??null, strength: p.statuses.strength || 0,
      connected: p.connected !== false, superReady: canUseSuper(p), minions: p.minions.map(m => ({ name:m.name, hp:m.hp, alive:m.alive, shields:m.shields }))
    })), log: room.log.slice(-80)
  };
}

export function createPlayer(id, name) {
  return { id, name, character:null, ready:false, connected:true, alive:true, hp:0, maxHp:0,
    shields:0, statuses:{}, defenses:{}, dice:[], acted:false, extraDice:0, nextDice:0,
    minions:[], turnCount:0 };
}

function heal(p, amount) { if (p.alive && amount > 0) { const before=p.hp; p.hp=Math.min(p.maxHp,p.hp+amount); return p.hp-before; } return 0; }
function addShield(p, amount) { if (amount > 0) p.shields += amount; }
function addStatus(p, key, amount) {
  if (amount <= 0) return;
  // Congelamento é um estado binário: no máximo um turno congelado pendente.
  if (key === 'freeze') { p.statuses.freeze = 1; return; }
  p.statuses[key] = (p.statuses[key] || 0) + amount;
}
function killCheck(room, p) {
  if (p.hp > 0 || !p.alive) return;
  p.hp = 0;
  p.alive = false;
  log(room, `☠️ ${p.name} foi eliminado!`);
  // A passiva do Cupido vincula as duas vidas: a morte de um amante elimina o outro.
  const loverId = p.statuses?.loverId;
  if (loverId) {
    const lover = room.players.find(x => x.id === loverId);
    if (lover?.alive) {
      lover.hp = 0;
      log(room, `💔 ${lover.name} também foi eliminado pela ligação dos amantes!`);
      killCheck(room, lover);
    }
  }
}
function damage(room, attacker, target, amount, { piercing=false, direct=true } = {}) {
  if (!target?.alive || amount <= 0) return 0;
  // Furtividade e Intangibilidade não podem ser ignoradas por ataques perfurantes.
  // Efeitos contínuos (Veneno, Fogo, Sangramento e Ferimentos) continuam causando dano.
  if (direct && target.character === 'Cogumelóide' && (attacker?.statuses?.confusion || 0) > 0) {
    target.statuses._receivedAttack = true;
    log(room, `🍄 ${target.name} não pode ser atingido por um jogador Confuso!`);
    return 0;
  }
  if (direct && target.defenses.stealth) {
    target.statuses._receivedAttack = true;
    log(room, `🌫️ ${target.name} evitou o ataque com Furtividade!`);
    return 0;
  }
  if (direct && target.defenses.intangible) {
    target.statuses._receivedAttack = true;
    log(room, `👻 ${target.name} ignorou o dano com Intangibilidade!`);
    return 0;
  }
  if (direct && target.character === 'Viking') { addStatus(target,'wound',amount); log(room, `🩸 ${target.name} converteu ${amount} de dano direto em Ferimentos.`); return 0; }
  target.statuses._receivedAttack = true;
  if (!direct && target.defenses.immuneDamageTurn) return 0;
  let dealt = amount;
  if (!piercing) {
    if (target.defenses.resistance) {
      dealt = Math.ceil(dealt / 2);
      target.defenses.resistance = false;
      log(room, `🛡️ Resistência de ${target.name} foi consumida.`);
    }
    const blocked = Math.min(target.shields, dealt);
    target.shields -= blocked; dealt -= blocked;
    if (blocked) log(room, `🛡️ ${target.name} bloqueou ${blocked} de dano.`);
  }
  if (dealt > 0) {
    target.hp -= dealt; target.statuses._receivedDamage = true;
    log(room, `💥 ${target.name} recebeu ${dealt} de dano!`);
    killCheck(room, target);
  }
  const thorns = target.defenses.thorns || 0;
  if (dealt > 0 && thorns > 0 && attacker?.alive && attacker.id !== target.id) {
    log(room, `🌵 Espinhos causaram ${thorns} de dano em ${attacker.name}!`);
    damage(room, target, attacker, thorns, { direct:false });
  }
  return dealt;
}
function attack(room, attacker, target, base, hits=1, piercing=false) {
  if (!attacker?.alive || !target?.alive) return;
  piercing = piercing || !!attacker.defenses.piercing || !!attacker.defenses.permanentPiercing;
  const strength = attacker.statuses.strength || 0;
  const permanentStrength = attacker.statuses.permanentStrength || 0;
  const weakness = attacker.statuses.weakness || 0;
  const percent = attacker.character === 'Pistoleiro'
    ? (attacker.statuses.pistoleiroBonus || 0) + (attacker.statuses.damageBonus || 0)
    : 0;
  let dealtAny = false;
  for (let i=0; i<hits && target.alive; i++) {
    const raw = Math.max(0, base + strength + permanentStrength - weakness);
    // No Pistoleiro, o percentual define a fração do dano-base causada: 25% de 12 = 3.
    const amount = attacker.character === 'Pistoleiro'
      ? Math.floor(raw * percent / 100)
      : raw;
    const dealt = damage(room, attacker, target, amount, { piercing });
    if (dealt > 0) dealtAny = true;
    if (attacker.character === 'Fera' && target.alive && amount > 0) { const w=amount*(attacker.statuses.doubleWounds?2:1); addStatus(target,'wound',w); log(room, `🩸 Passiva da Fera aplicou ${w} Ferimentos em ${target.name}.`); }
  }
  // Força e Fraqueza duram uma ação de ataque inteira (inclusive multi-hit).
  if (strength > 0) attacker.statuses.strength = 0;
  if (weakness > 0) attacker.statuses.weakness = 0;
  // A passiva do Pistoleiro é permanente e acumulativa; apenas bônus temporários são consumidos.
  if (dealtAny && attacker.character === 'Pistoleiro') {
    attacker.statuses.damageBonus = 0;
  }
}
function evolveDragon(room,p) {
  if (!p.alive || p.character !== 'Dragão (ovo)') return;
  p.character='Dragão (adulto)'; p.maxHp=35+5*enemies(room,p).length; p.hp=p.maxHp;
  log(room, `🐉 ${p.name} evoluiu para Dragão adulto com ${p.maxHp} HP!`);
}
function startTurn(room, p) {
  if (!p.alive) return;
  p.shields = 0;
  p.statuses._receivedAttack = false;
  p.statuses._receivedDamage = false;
  const armor = p.defenses.armor || 0;
  if (armor > 0) { addShield(p, armor); p.defenses.armor = Math.max(0, armor - 1); log(room, `🛡️ ${p.name} converteu ${armor} de Armadura em Escudos.`); }
  p.turnCount++;
  if (p.character === 'Dragão (ovo)') { p.statuses.eggWait=Math.max(0,(p.statuses.eggWait??9)-1); if(p.statuses.eggWait===0) evolveDragon(room,p); }
  if (p.character === 'Pistoleiro') {
    p.statuses.pistoleiroBonus = (p.statuses.pistoleiroBonus || 0) + 25;
    log(room, `🤠 ${p.name} ganhou +25% na passiva do Pistoleiro (agora ${p.statuses.pistoleiroBonus}%).`);
  }
  if (p.character === 'Espartano') p.statuses.spartanPassive = Math.max(1, (p.statuses.spartanPassive || 1) - 2);
}
function finishDefenses(room, p) {
  if (!p.alive) return;
  for (const key of ['stealth','intangible']) {
    const until = p.defenses[`${key}UntilTurn`];
    if (p.defenses[key] && (until == null || p.turnCount >= until)) p.defenses[key] = false;
    if (!p.defenses[key]) delete p.defenses[`${key}UntilTurn`];
  }
  if (p.defenses.thorns > 0) p.defenses.thorns = Math.max(0, p.defenses.thorns - 2);
}
function endTurnEffects(room, p, diceSum=0) {
  if (!p.alive) { finishDefenses(room,p); return; }
  let n = p.statuses.regeneration || 0;
  if (n > 0) { heal(p,n); log(room, `💚 ${p.name} regenerou ${n} de vida.`); p.statuses.regeneration = Math.max(0,n-1); }
  n = p.statuses.curse || 0;
  if (n > 0) { const value=Math.max(0,n-diceSum); if(value){log(room,`👻 Maldição causou ${value} de dano em ${p.name}.`);damage(room,null,p,value,{direct:false});} }
  n = p.statuses.poison || 0;
  if (p.alive && n > 0) {
    log(room, `☠️ Veneno causou ${n} de dano em ${p.name}.`); damage(room,null,p,n,{direct:false});
    p.statuses.poison = p.statuses.smokePoison ? Math.max(1,n-2) : Math.ceil(n/2);
  }
  n = p.statuses.fire || 0;
  if (p.alive && n > 0) { log(room, `🔥 Fogo causou ${n} de dano em ${p.name}.`); damage(room,null,p,n,{direct:false}); p.statuses.fire = Math.max(0,n-1); }
  n = p.statuses.wound || 0;
  if (p.alive && n > 0) { log(room,`🩸 Ferimentos causaram ${n} de dano em ${p.name}.`); damage(room,null,p,n,{direct:false}); p.statuses.wound=0; }
  n = p.statuses.bleeding || 0;
  if (p.alive && n > 0) { log(room,`🩸 Sangramento causou ${n} de dano em ${p.name}.`); damage(room,null,p,n,{direct:false}); }
  n = p.statuses.erosion || 0;
  if (n > 0) p.statuses.erosion = Math.max(0,n-1);
  if (p.statuses._receivedAttack && !p.statuses._receivedDamage) { p.statuses.bleeding=0; log(room,`🩸 O Sangramento de ${p.name} foi removido!`); }
  p.statuses._receivedAttack=false; p.statuses._receivedDamage=false;
  finishDefenses(room,p);
}
function chooseTarget(room, p, targets, index=0) { return targetAt(targets,index); }

function applySkill(room, p, die, targets, { characterOverride=null, noCombo=false } = {}) {
  const n=Number(die), ch=characterOverride || p.character, t=chooseTarget(room,p,targets), t2=chooseTarget(room,p,targets,1);
  const say=s=>log(room,`${p.name}: ${s}`);
  const wound=(target,value)=>addStatus(target,'wound',value);
  switch(ch) {
    case 'Cavaleiro':
      if(n===1&&t)attack(room,p,t,4); else if(n===2)p.statuses.permanentStrength=(p.statuses.permanentStrength||0)+2; else if(n===3&&t)attack(room,p,t,6); else if(n===4)p.defenses.resistance=true; else if(n===5)addShield(p,20); else if(n===6&&t)attack(room,p,t,9); break;
    case 'Smoke':
      if(n===1)grantTurnDefense(p,'stealth');
      else if([2,4,6].includes(n)&&t){addStatus(t,'poison',n);t.statuses.smokePoison=true;}
      else if(n===3){damage(room,p,p,2,{direct:false});addShield(p,25);}
      else if(n===5&&t)addStatus(t,'weakness',8); break;
    case 'Lenhador':
      if(n===2&&t)attack(room,p,t,6); else if(n===3)addStatus(p,'strength',3); else if(n===4&&t)attack(room,p,t,8); else if(n===5&&t)attack(room,p,t,10); else if(n===6){p.defenses.resistance=true;p.defenses.piercing=true;} break;
    case 'Mistério': {
      const copied=characterOverride || p.statuses.mysteryCopy;
      if (!copied || copied === 'Mistério') throw new Error('Escolha um personagem vivo para copiar.');
      say(`copiou a habilidade ${n} de ${copied}!`);
      applySkill(room,p,n,targets,{characterOverride:copied});
      break;
    }
    case 'Feiticeiro':
      if(n===1)addShield(p,8); else if(n===2&&t)attack(room,p,t,3); else if(n===3&&!noCombo){say('ativou Combo e poderá usar o novo resultado.');}
      else if(n===4&&t)addStatus(t,'freeze',1); else if(n===5&&t){addStatus(t,'poison',3);addStatus(t,'curse',2);} else if(n===6)p.nextDice=6; break;
    case "Guns N' Roses":
      p.statuses.roses ||= 0; p.statuses.bullets ||= 0;
      if(n===1){p.statuses.roses++;addShield(p,5);} else if(n===2){p.statuses.roses+=2;addShield(p,4);} else if(n===3){addShield(p,8);heal(p,2);} else if(n===4&&p.statuses.roses>=3){p.statuses.roses-=3;addStatus(p,'regeneration',5);} else if(n===5&&p.statuses.roses>=1){p.statuses.roses--;p.defenses.immuneDamageTurn=true;} else if(n===6&&p.statuses.bullets>=1&&t){p.statuses.bullets--;attack(room,p,t,25);} break;
    case 'Monge':
      if(n===1)addStatus(p,'regeneration',p.statuses.rolledCount||1);
      else if(n===2&&t)attack(room,p,t,2);
      else if(n===3)addShield(p,3);
      else if(n===4){addStatus(p,'strength',4);if(t)addStatus(t,'weakness',4);}
      else if(n===5)addShield(p,5);
      else if(n===6&&t)attack(room,p,t,6);
      break;
    case 'Narval':
      if(n===1)heal(p,4); else if(n===2){addStatus(p,'freeze',1);p.defenses.thorns=(p.defenses.thorns||0)+7;} else if(n===3&&t)attack(room,p,t,3,1,true); else if(n===4)addShield(p,7); else if(n===5&&t){const values=['shields','armor','thorns'];let stolen=0;for(const key of values){const v=key==='shields'?t.shields:(t.defenses[key]||0);if(v>0){if(key==='shields')t.shields=0;else t.defenses[key]=0;if(key==='shields')p.shields+=v;else p.defenses[key]=(p.defenses[key]||0)+v;stolen+=v;}}if(t.defenses.resistance){p.defenses.resistance=true;t.defenses.resistance=false;stolen++;}if(t.defenses.stealth){grantTurnDefense(p,'stealth');t.defenses.stealth=false;stolen++;}say(stolen?`roubou defesas de ${t.name}.`:`${t.name} não tinha defesas para roubar.`);} else if(n===6&&t)attack(room,p,t,6,1,true); break;
    case 'Espartano':
      p.statuses.spartanPassive ??= 1;
      if(n===1)p.statuses.spartanPassive=Math.max(1,Math.min(5,p.statuses.spartanPassive+(randomInt(0,2)?1:-1)));
      else if(n===2&&t)attack(room,p,t,3,2); else if(n===3&&t)attack(room,p,t,2,3); else if(n===4)p.statuses.spartanPassive=Math.min(5,p.statuses.spartanPassive+3); else if(n===5)addShield(p,5); else if(n===6)p.statuses.spartanPassive=Math.min(5,p.statuses.spartanPassive+4); break;
    case 'Pistoleiro':
      if(n===1){p.defenses.luck=true;p.statuses.misfortune=true;} else if(n===2&&t)attack(room,p,t,8); else if(n===3&&t)attack(room,p,t,12); else if(n===4)p.statuses.damageBonus=(p.statuses.damageBonus||0)+25; else if(n===5)grantTurnDefense(p,'stealth'); else if(n===6)p.statuses.damageBonus=(p.statuses.damageBonus||0)+50; break;
    case 'Cupido':
      if(n===1&&t)addStatus(t,'freeze',1); else if([2,4].includes(n))grantTurnDefense(p,'intangible'); else if(n===3)p.statuses.superUses=(p.statuses.superUses??1)+1; else if(n===5&&t)attack(room,p,t,t.statuses.lover?12:4); else if(n===6&&t)attack(room,p,t,9); break;
    case 'Necromante':
      if(n===1)for(const m of p.minions.filter(x=>x.name==='Esqueleto'&&x.alive))m.bonus=(m.bonus||0)+1;
      else if(n===2)for(const m of p.minions.filter(x=>x.name==='Esqueleto'&&x.alive))m.hp+=4;
      else if(n===3||n===6){p.minions.push({name:'Esqueleto',hp:12,alive:true,shields:0,statuses:{},defenses:{}});say('invocou um Esqueleto!');}
      else if(n===4)addShield(p,15); else if(n===5&&t)addStatus(t,'weakness',5); break;
    case 'Fera':
      if(n===1){addStatus(p,'freeze',1);heal(p,8);addStatus(p,'strength',2);} else if(n===2&&t)attack(room,p,t,2,3); else if(n===3)p.defenses.resistance=true; else if(n===4){if(t)attack(room,p,t,5);if(t2)attack(room,p,t2,5);} else if(n===5)addShield(p,12); else if(n===6){damage(room,p,p,d6(),{direct:false});if(t)addStatus(t,'bleeding',8);} break;
    case 'Caçadora':
      if(n===1){addShield(p,4);grantTurnDefense(p,'stealth');} else if(n===2&&t)attack(room,p,t,7); else if(n===3&&t){const x=d6();wound(t,3*x);say(`aplicou ${3*x} Ferimentos (${x} × 3).`);} else if(n===4)p.defenses.resistance=true; else if(n===5&&t)addStatus(t,'erosion',d6()); else if(n===6&&t){const other=p.dice[1] ?? d6();t.statuses.traps ||= {};t.statuses.traps[other]=other;say(`armadilha preparada para o dado ${other} de ${t.name}.`);} break;
    case 'Mago':
      if(n===1&&t){const hits=d6();attack(room,p,t,1,hits);}
      else if(n===2)addShield(p,12);
      else if(n===3){const excess=Math.max(0,p.hp+7-p.maxHp);heal(p,7);if(excess&&t)attack(room,p,t,excess);}
      else if(n===4)p.statuses.permanentStrength=(p.statuses.permanentStrength||0)+1;
      else if(n===5){addShield(p,7);grantTurnDefense(p,'stealth');}
      else if(n===6)p.statuses.comboNext=true; break;
    case 'Arqueira':
      p.statuses.arrows ||= 0;
      if(n===1)p.statuses.arrows++;
      else if(n===2)grantTurnDefense(p,'stealth');
      else if(n===3&&t){const spent=Math.min(3,p.statuses.arrows);if(spent>0){p.statuses.arrows-=spent;attack(room,p,t,8*spent);}}
      else if(n===4)p.statuses.arrows+=2;
      else if(n===5){grantTurnDefense(p,'stealth');grantTurnDefense(p,'intangible');}
      else if(n===6&&t&&p.statuses.arrows>=6){const spent=p.statuses.arrows;p.statuses.arrows=0;attack(room,p,t,8*spent);} break;
    case 'Cogumelóide':
      if(n===1)for(const x of enemies(room,p))addStatus(x,'poison',3);
      else if(n===2){grantTurnDefense(p,'stealth');for(const x of enemies(room,p))addStatus(x,'confusion',1);}
      else if(n===3){grantTurnDefense(p,'stealth');grantTurnDefense(p,'intangible');}
      else if(n===4)p.defenses.freezeAttacker=true;
      else if(n===5&&t){addStatus(t,'hypnosis',1);t.statuses.hypnosisBy=p.id;log(room,`🌀 ${p.name} hipnotizou ${t.name}; controlará o próximo turno dele.`);}
      else if(n===6)for(const x of enemies(room,p)){addStatus(x,'poison',5);addStatus(x,'confusion',1);} break;
    case 'Samurai':
      if(n===1&&t)addStatus(t,'bleeding',4);
      else if(n===2&&t)attack(room,p,t,6);
      else if(n===3||n===6)grantTurnDefense(p,'stealth');
      else if(n===4){addShield(p,4);if(t)addStatus(t,'bleeding',4);}
      else if(n===5&&t){attack(room,p,t,5);addStatus(t,'bleeding',5);} break;
    case 'Assassino':
      if(n===1)grantTurnDefense(p,'stealth');
      else if(n===2&&t)attack(room,p,t,12);
      else if(n===3&&t){t.shields=0;attack(room,p,t,8);}
      else if(n===4)grantTurnDefense(p,'intangible');
      else if(n===5&&t)attack(room,p,t,t.shields>0?20:5);
      else if(n===6)p.statuses.doubleAttackNext=true; break;
    case 'Viking':
      if(n===1&&t){addStatus(t,'wound',9);addStatus(t,'bleeding',2);}
      else if(n===2){p.statuses.wound=Math.max(0,(p.statuses.wound||0)-4);say('removeu até 4 Ferimentos.');}
      else if(n===3&&t){addStatus(t,'freeze',1);addStatus(p,'strength',1);}
      else if(n===4){p.statuses.wound=Math.max(0,(p.statuses.wound||0)-5);p.statuses.delayDamage=true;}
      else if(n===5)addStatus(p,'strength',2);
      else if(n===6&&t)attack(room,p,t,2,3); break;
    case 'Palhaço':
      p.statuses.bolhinhas ??= 1;
      if(n===1&&t){attack(room,p,t,p.statuses.bolhinhas,1);p.statuses.bolhinhas+=2;}
      else if(n===2||n===3){grantTurnDefense(p,'intangible');p.statuses.bolhinhas=Math.max(0,p.statuses.bolhinhas-1);}
      else if(n===4){addShield(p,2*p.statuses.bolhinhas);p.statuses.bolhinhas++;}
      else if(n===5&&t){attack(room,p,t,2*p.statuses.bolhinhas);p.statuses.bolhinhas=Math.max(0,p.statuses.bolhinhas-1);}
      else if(n===6)for(const x of alive(room))addStatus(x,'misfortune',1); break;
    case 'Gangster':
      if(n===1)addStatus(p,'freeze',1);
      else if(n===2)for(const x of enemies(room,p))attack(room,p,x,4);
      else if(n===3)heal(p,3);
      else if(n===4&&t){const before=t.hp;attack(room,p,t,6);if(t.hp<before){addStatus(t,'freeze',1);addStatus(t,'confusion',1);}}
      else if(n===5)heal(p,5);
      else if(n===6){for(const x of alive(room))if(x.dice?.includes(6))addStatus(x,'freeze',1);} break;
    case 'Dragão (ovo)':
      if(n===3)grantTurnDefense(p,'intangible');
      else if(n===4)p.defenses.resistance=true;
      else if(n===5)addShield(p,5);
      else if(n===6){for(const x of enemies(room,p))addStatus(x,'fire',1);if(p.dice?.includes(6)&&p.statuses.previousRollSix)p.statuses.eggWait=Math.max(0,(p.statuses.eggWait??9)-3);if(p.statuses.eggWait===0)evolveDragon(room,p);} break;
    case 'Dragão (adulto)':
      if(n===2)addShield(p,20);
      else if(n===3&&t){attack(room,p,t,11);attack(room,p,t,7);attack(room,p,t,3);}
      else if(n===4){p.statuses={...Object.fromEntries(Object.entries(p.statuses).filter(([k])=>!['poison','bleeding','wound','fire','curse','confusion','weakness'].includes(k))),strength:p.statuses.strength||0};p.defenses.resistance=true;}
      else if(n===5&&t){attack(room,p,t,5);addStatus(t,'fire',2);}
      else if(n===6)for(const x of enemies(room,p))addStatus(x,'fire',1); break;
  }
  if(ch==='Mistério') return;
  log(room,`${p.name} (${p.character}${characterOverride ? ` copiando ${characterOverride}` : ''}) usou habilidade ${n}.`);
}


export function canUseSuper(p) {
  if (p.character==="Guns N' Roses" && (p.statuses.roses||0)<2) return false;
  if (p.character==='Cupido' && (p.statuses.superUses??1)<=0) return false;
  const spec = CHARACTERS[p.character]?.super;
  if (!spec || !p.dice?.length) return false;
  const ds=[...p.dice].sort((a,b)=>a-b);
  if (Array.isArray(spec)) return spec.length===1 ? p.dice.includes(spec[0]) : ds[0]===spec[0]&&ds[1]===spec[1];
  if (spec==='threeDiceAnd6') return (p.statuses.rolledCount||p.dice.length)>=3&&p.dice.includes(6);
  if (spec==='threeSixes') return p.dice.filter(x=>x===6).length>=3;
  return false;
}
export function targetCountFor(p, action, die, copyCharacter=null) {
  const n=Number(die), ch=p.character;
  if (action==='super') return ({'Cavaleiro':1,'Smoke':1,'Lenhador':1,'Monge':1,'Narval':1,'Pistoleiro':1,'Cupido':2,'Samurai':0,'Assassino':1,'Viking':0,'Arqueira':1,'Cogumelóide':0,'Mago':1,'Palhaço':1,'Gangster':0,'Dragão (adulto)':1})[ch]||0;
  const one = {
    'Cavaleiro':[1,3,6], 'Smoke':[2,4,5], 'Lenhador':[2,4,5],
    'Mistério':[1,2,3,4,5,6], 'Feiticeiro':[2,4,5],
    "Guns N' Roses":[6], 'Monge':[2,4,6], 'Narval':[3,5,6],
    'Pistoleiro':[2,3], 'Cupido':[1,5,6],
    'Fera':[2,4,6], 'Mago':[1,3], 'Arqueira':[3,6], 'Samurai':[1,2,4,5], 'Assassino':[2,3,5], 'Viking':[1,3,6], 'Palhaço':[1,5], 'Cogumelóide':[5], 'Gangster':[4], 'Dragão (adulto)':[3,5]
  };
  const effective = ch==='Mistério' ? (copyCharacter || p.statuses.mysteryCopy || null) : ch;
  if (!effective) return 0;
  if (!(one[effective]||[]).includes(n)) return 0;
  return effective==='Fera'&&n===4 ? 2 : 1;
}

function activateSuper(room,p,targets) {
  const ds=[...p.dice].sort((a,b)=>a-b), t=targetAt(targets), ch=p.character;
  let ok=false; const spec=CHARACTERS[ch]?.super;
  if(Array.isArray(spec))ok=spec.length===1?p.dice.includes(spec[0]):ds[0]===spec[0]&&ds[1]===spec[1];
  if(spec==='threeDiceAnd6')ok=(p.statuses.rolledCount||p.dice.length)>=3&&p.dice.includes(6);
  if(spec==='threeSixes')ok=p.dice.filter(x=>x===6).length>=3;
  if(!ok)return false;
  if(ch==='Cavaleiro'){if(t)attack(room,p,t,12);p.defenses.armor=(p.defenses.armor||0)+4;}
  else if(ch==='Smoke'&&t){const old=t.statuses.poison||0;if(old>0&&randomInt(0,2)===0)t.statuses.poison=old*3;else addStatus(t,'poison',10);t.statuses.smokePoison=true;}
  else if(ch==='Lenhador'){if(randomInt(0,2))p.defenses.permanentPiercing=true;else if(t)attack(room,p,t,18);}
  else if(ch==='Feiticeiro')p.extraDice++;
  else if(ch==="Guns N' Roses"){if((p.statuses.roses||0)>=2){p.statuses.roses-=2;p.statuses.bullets=(p.statuses.bullets||0)+1;}}
  else if(ch==='Monge'&&t)attack(room,p,t,20);
  else if(ch==='Narval'&&t){attack(room,p,t,12,1,true);addStatus(t,'freeze',2);}
  else if(ch==='Espartano')p.statuses.spartanPassive=Math.min(5,(p.statuses.spartanPassive||1)+1);
  else if(ch==='Pistoleiro'){p.statuses.damageBonus=(p.statuses.damageBonus||0)+100;if(t)attack(room,p,t,16);}
  else if(ch==='Cupido'){
    if((p.statuses.superUses??1)>0){const xs=targets.length>=2?targets.slice(0,2):[];if(xs.length===2){xs[0].statuses.lover=true;xs[1].statuses.lover=true;xs[0].statuses.loverId=xs[1].id;xs[1].statuses.loverId=xs[0].id;p.statuses.superUses=(p.statuses.superUses??1)-1;log(room,`💘 ${xs[0].name} e ${xs[1].name} agora são amantes!`);}}
  }
  else if(ch==='Necromante'){for(let i=0;i<3;i++)p.minions.push({name:'Esqueleto',hp:12,alive:true,shields:0,statuses:{},defenses:{}});for(const m of p.minions.filter(x=>x.name==='Esqueleto'))m.bonus=(m.bonus||0)+2;}
  else if(ch==='Fera')p.statuses.doubleWounds=true;
  else if(ch==='Caçadora'){const wolf=p.minions.find(x=>x.name==='Lobo'&&!x.alive);if(wolf){wolf.alive=true;wolf.hp=10;}else p.defenses.thorns=(p.defenses.thorns||0)+10;}
  else if(ch==='Mago'){heal(p,10);p.maxHp+=5;p.hp=Math.min(p.maxHp,p.hp+5);}
  else if(ch==='Arqueira'){p.statuses.arrows=(p.statuses.arrows||0)+8;grantTurnDefense(p,'stealth');}
  else if(ch==='Cogumelóide'){for(const x of enemies(room,p)){addStatus(x,'hypnosis',1);x.statuses.hypnosisBy=p.id;}log(room,`🌀 ${p.name} hipnotizou todos os adversários por um turno.`);}
  else if(ch==='Samurai'){for(const x of enemies(room,p)){addStatus(x,'wound',8);addStatus(x,'bleeding',5);}}
  else if(ch==='Assassino'){p.defenses.immuneDamageTurn=true;p.statuses.immuneTurns=3;}
  else if(ch==='Viking'){addStatus(p,'strength',5);addStatus(p,'permanentStrength',1);}
  else if(ch==='Palhaço'){p.statuses.bolhinhas=(p.statuses.bolhinhas||1)+1;for(const x of enemies(room,p))attack(room,p,x,p.statuses.bolhinhas,p.statuses.bolhinhas);p.statuses.bolhinhas=1;}
  else if(ch==='Gangster'){if(p.statuses.wasFrozenLastTurn)heal(p,15);}
  else if(ch==='Dragão (adulto)'){for(const x of enemies(room,p))x.statuses.fire=999;}
  log(room,`✨ SUPER de ${p.name} (${ch}) ativado!`); return true;
}

function runMinions(room, owner) {
  for(const m of owner.minions){if(!m.alive)continue;const die=d6();log(room,`🎲 ${m.name} de ${owner.name} rolou ${die}.`);const xs=enemies(room,owner), t=xs.length?xs[randomInt(xs.length)]:null;
    if(m.name==='Lobo'){if([1,2].includes(die))m.shields=(m.shields||0)+7;else if([3,4,5].includes(die)&&t)addStatus(t,'wound',4);else if(die===6&&owner.alive)heal(owner,2);}
    else if(m.name==='Esqueleto'){if(die===3&&t)damage(room,owner,t,3);else if(die===4)m.shields=(m.shields||0)+4;else if(die===5&&t){for(let i=0;i<3;i++)damage(room,owner,t,2);}else if(die===6)m.shields=(m.shields||0)+6;}
  }
}

export function startGame(room) {
  if(room.players.length<2)throw new Error('São necessários pelo menos 2 jogadores.');
  if(room.players.some(p=>!p.character))throw new Error('Todos precisam escolher personagem.');
  room.status='playing';room.round=1;room.current=0;room.winner=null;
  for(const p of room.players){const ch=CHARACTERS[p.character];const baseHp=p.character==='Dragão (adulto)'?35+5*(room.players.length-1):ch.hp;p.hp=baseHp;p.maxHp=baseHp;p.alive=true;p.shields=0;p.statuses={};p.defenses={};p.dice=[];p.acted=false;p.extraDice=0;p.nextDice=0;p.minions=[];if(p.character==='Dragão (ovo)')p.statuses.eggWait=9;if(p.character==='Arqueira')p.statuses.arrows=0;if(p.character==='Palhaço')p.statuses.bolhinhas=1;if(p.character==='Cupido')p.statuses.superUses=1;}
  for (const p of room.players) if (p.character === 'Pistoleiro') p.statuses.pistoleiroBonus = 0;
  log(room,'⚔️ A partida começou!');rollForCurrent(room);
}
export function applyMysteryRollPassive(room, p) {
  const signature=p?.dice?.join(',');
  if (p?.character === 'Mistério' && p.dice?.length && p.dice.reduce((a,b)=>a+b,0) === 7 && p.statuses._mysterySevenSignature!==signature) {
    p.statuses._mysterySevenSignature=signature;
    addStatus(p, 'curse', 3);
    log(room, `🎭 Passiva negativa do Mistério: ${p.name} recebeu 3 de Maldição porque a soma dos dados foi 7.`);
    return true;
  }
  return false;
}

function rollForCurrent(room) {
  room.controllerId=null;
  const p=room.players[room.current]; if(!p)return; p.acted=false; startTurn(room,p);
  const frozen=p.statuses.freeze||0;
  if(p.character==='Gangster')p.statuses.wasFrozenLastTurn=frozen>0;
  if(frozen>0){ if(p.statuses.hypnosis){delete p.statuses.hypnosis;delete p.statuses.hypnosisBy;} log(room,`❄️ ${p.name} está congelado e perdeu o turno.`); endTurnEffects(room,p,0); p.statuses.freeze=Math.max(0,frozen-1); runMinions(room,p); if(!finishGameIfNeeded(room)) advanceTurn(room); return; }
  const count=p.character==='Monge' ? 1 : (p.character==='Mago' ? 3+(p.extraDice||0) : (p.nextDice||2+(p.extraDice||0)));p.nextDice=0;p.dice=Array.from({length:count},d6);p.statuses.rolledCount=count;
  if((p.statuses.hypnosis||0)>0){const hypnotizer=room.players.find(x=>x.id===p.statuses.hypnosisBy&&x.alive&&x.connected!==false);if(hypnotizer){room.controllerId=hypnotizer.id;log(room,`🌀 ${hypnotizer.name} controla o turno de ${p.name} por Hipnose!`);}else{delete p.statuses.hypnosis;delete p.statuses.hypnosisBy;}}
  log(room,`🎲 Vez de ${p.name}: ${p.dice.join(' e ')}`);
  applyMysteryRollPassive(room,p);
}
function finishGameIfNeeded(room) {const xs=alive(room);if(xs.length<=1){room.status='finished';room.winner=xs[0]?.id||null;log(room,xs.length?`🏆 ${xs[0].name} (${xs[0].character}) venceu a partida!`:'🏁 A partida terminou sem vencedor.');return true;}return false;}
function advanceTurn(room) {
  if(finishGameIfNeeded(room))return;
  const previous=room.current;let idx=previous;
  do {idx=(idx+1)%room.players.length;if(idx===0)room.round++;} while(!room.players[idx].alive);
  room.current=idx;rollForCurrent(room);
}

export function playDie(room, playerId, die, targetIds=[], copyPlayerId=null) {
  if(room.status!=='playing')throw new Error('A partida não está em andamento.');
  const p=room.players[room.current];if(!p||!isTurnActor(room,p,playerId))throw new Error('Não é sua vez.');
  if(p.acted||!p.alive||!p.dice.includes(Number(die)))throw new Error('Dado inválido ou turno já utilizado.');
  let copyCharacter=null;
  if (p.character==='Mistério') {
    const source=room.players.find(x=>x.id===copyPlayerId&&x.alive&&x.id!==p.id&&x.character&&x.character!=='Mistério');
    if(!source) throw new Error('Mistério precisa escolher outro personagem vivo para copiar.');
    copyCharacter=source.character; p.statuses.mysteryCopy=copyCharacter;
  }
  const requiredTargets=targetCountFor(p,'skill',Number(die),copyCharacter);
  const confused=(p.statuses.confusion||0)>0 && requiredTargets>0;
  const targets=confused ? randomConfusedTargets(room,p,requiredTargets) : pickTargets(room,p,targetIds);
  if(requiredTargets>targets.length) throw new Error(`Esta habilidade exige ${requiredTargets} alvo(s).`);
  if(confused) log(room,`🌀 Confusão: os ${requiredTargets} alvo(s) da habilidade de ${p.name} foram escolhidos aleatoriamente.`);
  const trap=p.statuses.traps?.[Number(die)];if(trap){addStatus(p,'bleeding',trap);delete p.statuses.traps[Number(die)];log(room,`🪤 Armadilha ativada em ${p.name}: ${trap} Sangramento.`);}
  {
    if(p.character==='Feiticeiro'&&p.dice.filter(x=>x===Number(die)).length>1){const times=p.dice.filter(x=>x===Number(die)).length;for(let i=0;i<times&&p.alive;i++)applySkill(room,p,Number(die),targets);}
    else {
      if (p.character === 'Mistério') log(room, `🎭 ${p.name} escolheu copiar ${copyCharacter}.`);
      applySkill(room,p,Number(die),targets,{characterOverride:copyCharacter});
    }
  }
  if(confused){p.statuses.confusion=Math.max(0,(p.statuses.confusion||0)-1);if(!p.statuses.confusion)delete p.statuses.confusion;}
  const isMonkCombo = p.character==='Monge' && Number(die)>=1 && Number(die)<=3;
  const isWizardCombo = p.character==='Feiticeiro' && Number(die)===3;
  if(isMonkCombo || isWizardCombo) {
    const reroll=d6();
    p.statuses.rolledCount=(p.statuses.rolledCount||p.dice.length)+1;
    // O Monge só tem um dado; o Feiticeiro conserva o outro dado e troca o 3 usado pelo novo.
    if (isMonkCombo) p.dice=[reroll];
    else { const remaining=[...p.dice]; const usedIndex=remaining.indexOf(Number(die)); if(usedIndex>=0)remaining.splice(usedIndex,1); p.dice=[...remaining,reroll]; }
    p.acted=false;
    log(room,`${isMonkCombo?'🥋 Combo do Monge':'🔮 Combo do Feiticeiro'}: rolou novamente e obteve ${reroll}. Escolha a próxima habilidade.`);
    return room;
  }
  p.acted=true;
  if(room.controllerId){delete p.statuses.hypnosis;delete p.statuses.hypnosisBy;room.controllerId=null;}
  const sum=p.dice.reduce((a,b)=>a+b,0);
  p.statuses.previousRollSix = p.dice.includes(6);
  endTurnEffects(room,p,sum);
  runMinions(room,p);
  if(!finishGameIfNeeded(room))advanceTurn(room);
  return room;
}


export function playSuper(room, playerId, targetIds=[]) {
  if(room.status!=='playing') throw new Error('A partida não está em andamento.');
  const p=room.players[room.current];
  if(!p||!isTurnActor(room,p,playerId)) throw new Error('Não é sua vez.');
  if(p.acted||!p.alive) throw new Error('Seu turno já foi utilizado.');
  if(!canUseSuper(p)) throw new Error('Sua Super ainda não está disponível.');
  const targets=pickTargets(room,p,targetIds);
  const needed=targetCountFor(p,'super');
  if(targets.length<needed) throw new Error(`Sua Super exige ${needed} alvo(s).`);
  if(!activateSuper(room,p,targets)) throw new Error('Não foi possível ativar a Super.');
  p.acted=true;
  if(room.controllerId){delete p.statuses.hypnosis;delete p.statuses.hypnosisBy;room.controllerId=null;}
  const sum=p.dice.reduce((a,b)=>a+b,0);
  p.statuses.previousRollSix = p.dice.includes(6);
  endTurnEffects(room,p,sum);
  runMinions(room,p);
  if(!finishGameIfNeeded(room)) advanceTurn(room);
  return room;
}

export function skipFrozenTurn(room) {
  const p=room.players[room.current];if(!p||!p.alive)return;
  const frozen=p.statuses.freeze||0;if(frozen<=0)return;
  log(room,`❄️ ${p.name} está congelado e perdeu o turno.`);
  endTurnEffects(room,p,0);p.statuses.freeze=Math.max(0,frozen-1);runMinions(room,p);
  if(!finishGameIfNeeded(room))advanceTurn(room);
}

export function resetToLobby(room) {
  room.status='lobby';room.round=0;room.current=0;room.winner=null;room.controllerId=null;room.log=[];
  for(const p of room.players){p.character=null;p.ready=false;p.alive=true;p.hp=0;p.maxHp=0;p.shields=0;p.statuses={};p.defenses={};p.dice=[];p.acted=false;p.extraDice=0;p.nextDice=0;p.minions=[];}
  log(room,'🔄 Nova seleção de personagens.');
}

export { alive, log };
