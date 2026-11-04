export const CHARACTERS = {
  'Cavaleiro': {hp:35, skills:['Nada','+2 Força','Causar 6 dano','Resistência','20 Escudos','Causar 9 dano'], super:[3,4], passive:'Nenhuma'},
  'Smoke': {hp:25, skills:['Furtividade','2 Veneno','2 dano próprio e 25 Escudos','4 Veneno','8 Fraqueza','6 Veneno'], super:[2,5], passive:'Veneno aplicado por Smoke cai 2 por turno (mínimo 1)'},
  'Lenhador': {hp:35, skills:['Nada','6 dano','+3 Força','8 dano','10 dano','Resistência e Perfurante'], super:[4,5], passive:'Nenhuma'},
  'Mistério': {hp:25, skills:['Copiar habilidade 1','Copiar habilidade 2','Copiar habilidade 3','Copiar habilidade 4','Copiar habilidade 5','Copiar habilidade 6'], super:'sum7', passive:'Com dados iguais, copia uma passiva'},
  'Feiticeiro': {hp:30, skills:['8 Escudos','3 dano','Rerrolar dado (Combo)','Congelar inimigo','3 Veneno + 2 Maldição','6 dados no próximo turno'], super:[3,6], passive:'Dados iguais permitem repetir a habilidade'},
  "Guns N' Roses": {hp:25, skills:['+1 Rosa e 5 Escudos','+2 Rosas e 4 Escudos','8 Escudos e cura 2','Gastar 3 Rosas: 5 Regeneração','Gastar 1 Rosa: imune a dano/status danoso no turno','Gastar 1 Bala: 25 dano'], super:[2], passive:'Rosas e Balas são moedas'},
  'Monge': {hp:35, skills:['Rerrolar: Regeneração por dado rolado (Combo)','Rerrolar: 2 dano (Combo)','Rerrolar: 3 Escudos (Combo)','+4 Força e 4 Fraqueza','5 Escudos','6 dano'], super:'threeDiceAnd6', passive:'Usa apenas 1 dado; habilidades 1–3 permitem rerrolar e usar o novo resultado'},
  'Narval': {hp:25, skills:['Cura 4','Congelar a si e +7 Espinhos','3 dano Perfurante','7 Escudos','Roubar defesas','6 dano Perfurante'], super:[3,6], passive:'Espinhos: atacante recebe espinhos; caem 2 por turno'},
  'Espartano': {hp:30, skills:['Alterar dois números em +1/-1','3 dano duas vezes','2 dano três vezes','+3 Passiva','5 Escudos','+4 Passiva'], super:[4,6], passive:'Antes de receber dano, chance de bloquear conforme valor (1–5)'},
  'Pistoleiro': {hp:25, skills:['Sorte e Azar','8 dano','12 dano','+25% passiva','Furtividade','+50% passiva'], super:[1,6], passive:'Dano extra percentual; segunda passiva evita morte uma vez'},
  'Cupido': {hp:25, skills:['Congelar jogador','Intangibilidade','+1 uso do Super','Intangibilidade','4 dano (12 no amante)','9 dano'], super:[3], passive:'Amantes morrem juntos; habilidade 3 prepara sequência'},
  'Necromante': {hp:20, skills:['Esqueletos +1 nos números','Cura 4 em cada Esqueleto','Invocar Esqueleto','15 Escudos','5 Fraqueza','Invocar Esqueleto'], super:[2,2], passive:'Invoca Esqueletos (12 HP)'},
  'Fera': {hp:25, skills:['Congelar a si, cura 8 e +2 Força','2 dano três vezes','Resistência','5 dano em dois inimigos','12 Escudos','Perder D6 HP e aplicar 8 Sangramento'], super:[2,4], passive:'Ataque direto causa Ferimentos; Super dobra esses Ferimentos'},
  'Caçadora': {hp:20, skills:['4 Escudos e Furtividade','7 dano','3 aplicações de X Ferimentos','Resistência','D6 Erosão','Armadilha em dado X'], super:[3,6], passive:'Começa com Lobo (10 HP)'}
};
