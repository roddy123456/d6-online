# D6 Online — revisão candidata (06/11/2026)

## Alterações verificadas nesta revisão
- Corrigida a duplicação da passiva da Fera: cada golpe aplica Ferimentos uma vez por hit.
- Removidos blocos `case` duplicados e inalcançáveis de Mago, Arqueira, Cogumelóide, Samurai, Assassino, Viking, Palhaço, Gangster e Dragão.
- Viking converte dano direto recebido em Ferimentos; dano por efeitos contínuos continua sendo processado normalmente.
- Hipnose do Cogumelóide: o controlador assume o turno do alvo hipnotizado; o alvo perde o controle desse turno. A Super aplica o efeito aos adversários.
- Dragão ovo evolui imediatamente ao atingir espera zero e recebe HP atual/máximo do adulto conforme inimigos vivos.
- Cura limitada ao HP máximo; exceção do Mago converte excesso da cura da habilidade 3 em dano.
- Congelamento não acumula; Super do Cupido mantém vínculo de morte dos amantes; Combo do Feiticeiro/Monge mantém a ação no turno.
- Identificação visual do personagem ao lado do nome do jogador, com ícone e etiqueta; toast de evento no topo da tela; cartões e estados de eliminação refinados.
- Exposição pública de recursos de personagem (flechas, bolinhas e contador do ovo) para a interface.

## Testes
- `node --check server/game.js`: aprovado.
- `node --check client/app.js`: aprovado.
- `node --test`: 25 testes aprovados.
- Foi tentado `npm ci --ignore-scripts`, mas a instalação excedeu o tempo limite deste ambiente. Portanto, não foi possível executar um teste de integração com servidor Socket.IO/browser neste ambiente.

## Limitações conhecidas — não declarar como versão completa dos 56
- O cadastro desta base contém 21 entradas de personagem, incluindo as duas formas do Dragão; não contém os 56 kits completos.
- A seleção manual do gasto de Flechas da Arqueira ainda não está implementada: as habilidades usam automaticamente o máximo permitido pela regra atual.
- A escolha entre dano e Fogo na habilidade 1 do Mago ainda precisa de uma regra de seleção explícita na interface.
- O efeito de Combo global do Mago e o adiamento do dano da habilidade 4 do Viking precisam de uma definição/implementação adicional e testes dedicados.
- A habilidade 6 do Gangster usa os resultados de dados armazenados dos jogadores; a interpretação de “quem rolou 6 neste turno” precisa ser testada em uma partida multiplayer real.
- Testes com várias conexões reais e renderização visual em navegador não foram executados.

## Execução local
Requer Node.js 20 ou superior.

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```
Abra `http://localhost:3000` no navegador. Para multiplayer local, use janelas/perfis diferentes e entre na mesma sala.


## Correção posterior — Furtividade e Intangibilidade (2026-11-06)
- Corrigido o ciclo de duração: as defesas concedidas durante uma ação não são mais apagadas no fim da mesma ação; permanecem ativas durante a rodada adversária e expiram no fim do próximo turno do próprio jogador.
- Furtividade agora também impede seleção como alvo na interface e é validada novamente no servidor.
- Intangibilidade agora anula dano direto enquanto ativa; efeitos contínuos continuam sendo processados normalmente.
- Adicionados testes específicos para duração, bloqueio de alvo, dano direto e efeitos contínuos.
- Verificação após a correção: 28/28 testes automatizados passaram; `node --check` passou para servidor e cliente.
