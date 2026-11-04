# D6 Online — protótipo multiplayer

Jogo web com salas privadas de 5 caracteres, 2–6 jogadores, escolha de personagens, turnos sincronizados por Socket.IO e estado autoritativo no servidor.

## Requisitos
- Node.js 20+
- npm

## Executar localmente
```bash
npm install
npm start
```
Abra http://localhost:3000 em dois navegadores/computadores na mesma rede para testar. Para teste pela internet, publique o projeto em um serviço que suporte Node.js e WebSockets (por exemplo, Render, Railway ou Fly.io). Configure `PORT` conforme a plataforma. `ALLOWED_ORIGIN` pode receber origens permitidas separadas por vírgula.

## Estado desta entrega
Esta é uma **primeira versão jogável de infraestrutura multiplayer**, não uma implementação completa e homologada de todas as regras do simulador Python. Ela inclui as 14 fichas que estavam cadastradas no notebook e um conjunto inicial de efeitos de habilidades. Algumas mecânicas avançadas ainda precisam ser integradas e testadas antes de partidas competitivas: cópia de habilidades/passivas do Mistério, seleção de alvo/decisões, sequência e combos completos, economia/super de Cupido, IA e turnos de lacaios (Lobo/Esqueletos), passivas detalhadas, efeitos por rodada e regras completas de dano/defesas.

## Segurança e limitações
- O servidor controla sala, turno, dados e aplicação de ações; o cliente não escolhe resultados de dados.
- Ainda não há autenticação, persistência de partidas, reconexão com retomada de sessão, banco de dados, ranking ou proteção anti-abuso completa.
- O estado das salas fica em memória: reiniciar o servidor encerra as partidas.
- Não há hospedagem pública criada nesta entrega. Para publicar, é necessário conectar uma conta de hospedagem e configurar o deploy.

## Endpoints
- `GET /health`: estado básico do servidor.
- `GET /api/characters`: fichas disponíveis.
