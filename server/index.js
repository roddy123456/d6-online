import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import { CHARACTERS } from './characters.js';
import { createPlayer, publicState, startGame, playDie, playSuper, resetToLobby, alive } from './game.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN?.split(',') ?? true } });
const rooms = new Map();
const code = () => { const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join(''); };
app.use(express.static(path.join(__dirname, '../client')));
app.get('/health', (_req,res)=>res.json({ok:true,rooms:rooms.size}));
app.get('/api/characters', (_req,res)=>res.json(CHARACTERS));
function emit(room){io.to(room.code).emit('state',publicState(room));}
function findRoom(socketId){return [...rooms.values()].find(r=>r.players.some(p=>p.id===socketId));}
io.on('connection',socket=>{
  socket.on('createRoom',({name}={})=>{try{
    if(typeof name!=='string'||!name.trim()||name.trim().length>20)throw new Error('Nome inválido (1–20 caracteres).');
    let c;do{c=code();}while(rooms.has(c));
    const p=createPlayer(socket.id,name.trim());const room={code:c,hostId:socket.id,status:'lobby',round:0,current:0,winner:null,players:[p],log:[]};
    rooms.set(c,room);socket.join(c);socket.emit('created',{code:c});emit(room);
  }catch(e){socket.emit('errorMessage',e.message);}});
  socket.on('joinRoom',({code:c,name}={})=>{try{
    const room=rooms.get(String(c||'').toUpperCase());if(!room)throw new Error('Sala não encontrada.');
    if(room.status!=='lobby')throw new Error('A partida já começou.');if(room.players.length>=6)throw new Error('Sala cheia (máximo 6).');
    if(typeof name!=='string'||!name.trim()||name.trim().length>20)throw new Error('Nome inválido (1–20 caracteres).');
    const p=createPlayer(socket.id,name.trim());room.players.push(p);socket.join(room.code);room.log.push(`${p.name} entrou na sala.`);emit(room);
  }catch(e){socket.emit('errorMessage',e.message);}});
  socket.on('chooseCharacter',({character}={})=>{const room=findRoom(socket.id);if(!room||room.status!=='lobby'||!CHARACTERS[character])return;const p=room.players.find(x=>x.id===socket.id);p.character=character;emit(room);});
  socket.on('startGame',()=>{const room=[...rooms.values()].find(r=>r.hostId===socket.id);if(!room||room.status!=='lobby')return;try{startGame(room);emit(room);}catch(e){socket.emit('errorMessage',e.message);}});
  socket.on('useDie',({die,targetIds=[],copyPlayerId=null}={})=>{const room=findRoom(socket.id);if(!room)return;try{playDie(room,socket.id,die,targetIds,copyPlayerId);emit(room);}catch(e){socket.emit('errorMessage',e.message);}});
  socket.on('useSuper',({targetIds=[]}={})=>{const room=findRoom(socket.id);if(!room)return;try{playSuper(room,socket.id,targetIds);emit(room);}catch(e){socket.emit('errorMessage',e.message);}});
  socket.on('returnToLobby',()=>{const room=findRoom(socket.id);if(!room||room.status!=='finished')return;if(socket.id!==room.hostId){socket.emit('errorMessage','Somente o anfitrião pode iniciar uma nova seleção.');return;}resetToLobby(room);emit(room);});
  socket.on('disconnect',()=>{for(const room of rooms.values()){const p=room.players.find(x=>x.id===socket.id);if(!p)continue;p.connected=false;if(room.status==='lobby'){room.players=room.players.filter(x=>x.id!==socket.id);if(!room.players.length)rooms.delete(room.code);else{if(room.hostId===socket.id)room.hostId=room.players[0].id;emit(room);}}else{room.log.push(`${p.name} desconectou; seu lugar permanece na partida.`);emit(room);}}});
});
const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`D6 Online em http://localhost:${port}`));
