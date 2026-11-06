# D6 Online

Aplicação web multiplayer para 2 a 6 jogadores, com salas privadas, seleção de personagens, turnos sincronizados por Socket.IO e estado controlado pelo servidor.

## Executar

Requer Node.js 20+.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Para jogar em dispositivos diferentes pela internet, publique em um host Node.js com suporte a WebSocket (por exemplo, Render) e compartilhe o endereço público e o código da sala.

## Melhorias desta revisão

- Botão **USAR SUPER**: a Super aparece quando a combinação de dados está disponível e é uma escolha opcional; usar um dado normal não ativa a Super automaticamente.
- A ativação da Super é validada também pelo servidor, não apenas pela interface.
- A seleção de alvos só aparece quando a habilidade escolhida exige alvo. Habilidades com dois alvos exigem dois jogadores.
- Para Mistério, o personagem copiado é definido no início do turno e mostrado na interface; a seleção de alvos acompanha a habilidade copiada.
- Interface visual refinada, destaque de Super, estados de seleção, melhor feedback visual e ajustes para celular.
- Efeitos sonoros sintetizados no navegador para rolagem, ataques, Super e vitória, com controle para ligar/desligar o som.
- Mantidas as correções anteriores de escudos, efeitos de turno, fim da partida e retorno à seleção.

## Regras ainda pendentes de confirmação/implementação

O notebook de referência registra a cópia de passiva do Mistério, mas não implementa o efeito da passiva copiada; por isso o jogo informa qual passiva foi copiada, mas não inventa como aplicá-la. Também precisam de implementação e testes próprios algumas passivas e interações avançadas (por exemplo, passiva do Espartano, amantes do Cupido, bônus/segunda passiva do Pistoleiro, Ferimentos da Fera e comportamento completo dos lacaios). Esta versão não deve ser chamada de implementação integral homologada de todas as regras.

## Testes

Execute `npm test` para rodar os testes automatizados do motor. Os testes cobrem reinício dos escudos no começo do próximo turno, anúncio do vencedor e retorno à seleção, processamento de Veneno, cópia de habilidade do Mistério, disponibilidade opcional da Super e exigência de alvos. Os testes automatizados não substituem uma partida multiplayer real em dois dispositivos.

## Limitações técnicas atuais

- Salas e partidas ficam em memória; reiniciar o servidor encerra as partidas.
- Não há autenticação, persistência, ranking nem retomada de sessão após desconexão.
- O host inicia a partida; todos escolhem um personagem.
- O deploy público precisa ser feito na conta de hospedagem do proprietário.

## Endpoints

- `GET /health`
- `GET /api/characters`


## Ajustes desta revisão

- Fraqueza é consumida após uma ação de ataque, inclusive ataques com múltiplos golpes.
- Mistério escolhe um jogador vivo (que não seja outro Mistério) e copia a habilidade correspondente do personagem escolhido.
- Pistoleiro começa com passiva em 0%; ao iniciar cada um de seus turnos, recebe +25 pontos percentuais e consome o bônus percentual ao causar dano; habilidades 4 e 6 somam seus bônus.
- Monge rola um dado por turno. As habilidades 1, 2 e 3 aplicam seu efeito e geram um novo dado sem encerrar o turno; o turno termina quando usa 4, 5 ou 6.
- Espartano, Caçadora e Necromante estão temporariamente fora da seleção. Espartano exige uma interface específica para escolher dois números e uma implementação cuidadosa da passiva defensiva; Caçadora e Necromante dependem de minions, que ainda precisam de interface e testes próprios.

Execute `npm test` para rodar os testes automatizados. Estes testes cobrem as regras listadas, mas não substituem uma partida multiplayer completa em navegadores/dispositivos separados.

## Ajustes da revisão de 05/11/2026
- Congelamento limitado a um turno pendente (não acumula).
- A ligação dos amantes do Cupido elimina o parceiro quando um deles é eliminado.
- A habilidade 3 do Feiticeiro agora gera um novo dado e mantém o turno, preservando o outro dado ainda não usado.
- Animação visual de rolagem no início de cada turno: os dados permanecem parados e os números mudam por aproximadamente 1 segundo antes de mostrar os resultados reais.
- Adicionados testes automatizados para essas três mecânicas do servidor; a animação visual foi verificada por sintaxe, mas requer teste no navegador.


## Ajustes da revisão de 05/11/2026 — kits
- Cavaleiro: habilidade 1 agora causa 4 de dano; habilidade 2 acumula +2 de Força permanente.
- Mistério: não possui mais Super. Ao rolar dois dados cuja soma seja 7, recebe automaticamente 3 de Maldição.
- Mistério mantém a passiva descrita de copiar passivas quando tira dados iguais; a aplicação efetiva dessa cópia ainda precisa de definição/implementação, pois as passivas dos personagens não estão todas modeladas de forma genérica no motor.
- Pistoleiro: a passiva de +25% por turno agora acumula permanentemente e não é consumida ao atacar. Os bônus temporários das habilidades 4 e 6 continuam sendo consumidos no primeiro ataque que causar dano.
- Os testes automatizados foram atualizados para cobrir essas regras.
