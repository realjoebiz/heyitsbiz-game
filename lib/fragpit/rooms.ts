import { randomBytes, randomUUID } from 'crypto';
import { nextBotName, botThink } from './bots';
import { createMatch, getMapGrid, setPlayerInput, tickMatch, toPublicPlayers, toPublicProjectiles, type MatchState } from './sim';
import {
  FRAG_LIMIT,
  MAX_HUMANS,
  PLAYER_COLORS,
  TARGET_PLAYERS,
  TICK_MS,
  type ClientMsg,
  type PlayerInput,
  type RoomPhase,
  type ServerMsg,
  type Snapshot,
} from './types';

export type ClientSocket = {
  send: (data: string) => void;
  close: () => void;
};

type Human = {
  id: string;
  token: string;
  name: string;
  color: string;
  socket: ClientSocket | null;
};

type Room = {
  id: string;
  hostId: string;
  phase: RoomPhase;
  humans: Human[];
  match: MatchState | null;
  message: string;
  tickTimer: ReturnType<typeof setInterval> | null;
  createdAt: number;
};

const rooms = new Map<string, Room>();
const tokenToRoom = new Map<string, string>();

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

function cleanName(raw: string) {
  return (raw || 'Player').trim().slice(0, 14) || 'Player';
}

function snapshotFor(room: Room, youId: string): Snapshot {
  const match = room.match;
  return {
    type: 'state',
    roomId: room.id,
    phase: room.phase,
    hostId: room.hostId,
    youId,
    tick: match?.tick ?? 0,
    timeLeft: match?.timeLeft ?? 0,
    fragLimit: FRAG_LIMIT,
    players:
      match?.players.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        yaw: p.yaw,
        health: p.health,
        frags: p.frags,
        alive: p.alive,
        color: p.color,
        isBot: p.isBot,
        weapon: p.weapon,
      })) ??
      room.humans.map((h) => ({
        id: h.id,
        name: h.name,
        x: 0,
        y: 0,
        yaw: 0,
        health: 100,
        frags: 0,
        alive: true,
        color: h.color,
        isBot: false,
        weapon: 'rail' as const,
      })),
    projectiles: match ? toPublicProjectiles(match) : [],
    killFeed: match?.killFeed ?? [],
    winnerIds: match?.winnerIds ?? [],
    message: room.message,
    map: getMapGrid(),
  };
}

function broadcast(room: Room) {
  for (const h of room.humans) {
    if (!h.socket) continue;
    try {
      h.socket.send(JSON.stringify(snapshotFor(room, h.id)));
    } catch {
      /* ignore */
    }
  }
}

function send(socket: ClientSocket, msg: ServerMsg) {
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    /* ignore */
  }
}

function stopTick(room: Room) {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
}

function startMatch(room: Room) {
  stopTick(room);
  const names = room.humans.map((h) => h.name);
  const roster: { id: string; name: string; color: string; isBot: boolean }[] = room.humans.map(
    (h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      isBot: false,
    })
  );

  let botI = 0;
  while (roster.length < TARGET_PLAYERS) {
    const name = nextBotName([...names, ...roster.map((r) => r.name)]);
    roster.push({
      id: `bot-${room.id}-${botI++}`,
      name,
      color: PLAYER_COLORS[roster.length % PLAYER_COLORS.length]!,
      isBot: true,
    });
  }

  room.match = createMatch(roster);
  room.phase = 'playing';
  room.message = 'Frag limit 10 · 3:00 — fight!';
  broadcast(room);

  room.tickTimer = setInterval(() => {
    if (!room.match || room.phase !== 'playing') return;
    tickMatch(room.match, botThink);
    if (room.match.finished) {
      room.phase = 'finished';
      const winners = room.match.players
        .filter((p) => room.match!.winnerIds.includes(p.id))
        .map((p) => p.name)
        .join(' & ');
      room.message = `Match over — ${winners || 'nobody'} wins.`;
      stopTick(room);
    }
    broadcast(room);
  }, TICK_MS);
}

export function attachClient(socket: ClientSocket) {
  let token: string | null = null;
  let humanId: string | null = null;

  const onMessage = (raw: string) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      send(socket, { type: 'error', message: 'Bad message.' });
      return;
    }

    if (msg.type === 'create') {
      let id = code();
      while (rooms.has(id)) id = code();
      const t = randomUUID();
      const hid = randomUUID();
      const human: Human = {
        id: hid,
        token: t,
        name: cleanName(msg.name),
        color: PLAYER_COLORS[0]!,
        socket,
      };
      const room: Room = {
        id,
        hostId: hid,
        phase: 'lobby',
        humans: [human],
        match: null,
        message: 'Share the room code. Host starts when ready (bots fill to 3).',
        tickTimer: null,
        createdAt: Date.now(),
      };
      rooms.set(id, room);
      tokenToRoom.set(t, id);
      token = t;
      humanId = hid;
      send(socket, { type: 'joined', roomId: id, token: t, youId: hid });
      broadcast(room);
      return;
    }

    if (msg.type === 'join') {
      const room = rooms.get(msg.roomId.trim().toUpperCase());
      if (!room) {
        send(socket, { type: 'error', message: 'Room not found.' });
        return;
      }
      if (room.phase !== 'lobby') {
        send(socket, { type: 'error', message: 'Match already started.' });
        return;
      }
      if (room.humans.length >= MAX_HUMANS) {
        send(socket, { type: 'error', message: 'Room full (3 humans max).' });
        return;
      }
      const t = randomUUID();
      const hid = randomUUID();
      const human: Human = {
        id: hid,
        token: t,
        name: cleanName(msg.name),
        color: PLAYER_COLORS[room.humans.length % PLAYER_COLORS.length]!,
        socket,
      };
      room.humans.push(human);
      room.message = `${human.name} joined.`;
      tokenToRoom.set(t, room.id);
      token = t;
      humanId = hid;
      send(socket, { type: 'joined', roomId: room.id, token: t, youId: hid });
      broadcast(room);
      return;
    }

    if (!token || !humanId) {
      send(socket, { type: 'error', message: 'Join a room first.' });
      return;
    }

    const roomId = tokenToRoom.get(token);
    const room = roomId ? rooms.get(roomId) : null;
    if (!room) {
      send(socket, { type: 'error', message: 'Room gone.' });
      return;
    }
    const human = room.humans.find((h) => h.id === humanId);
    if (!human) return;
    human.socket = socket;

    if (msg.type === 'start') {
      if (human.id !== room.hostId) {
        send(socket, { type: 'error', message: 'Only host can start.' });
        return;
      }
      if (room.phase !== 'lobby' && room.phase !== 'finished') {
        send(socket, { type: 'error', message: 'Already playing.' });
        return;
      }
      startMatch(room);
      return;
    }

    if (msg.type === 'input') {
      if (room.phase === 'playing' && room.match) {
        setPlayerInput(room.match, human.id, msg.input as PlayerInput);
      }
      return;
    }

    if (msg.type === 'leave') {
      detachClient(socket, token);
      token = null;
      humanId = null;
    }
  };

  return {
    onMessage,
    onClose: () => {
      if (token) detachClient(socket, token);
    },
  };
}

function detachClient(socket: ClientSocket, token: string) {
  const roomId = tokenToRoom.get(token);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) {
    tokenToRoom.delete(token);
    return;
  }

  const human = room.humans.find((h) => h.token === token);
  if (human && human.socket === socket) human.socket = null;

  // remove from lobby if disconnected; mid-match keep as disconnected (no input)
  if (room.phase === 'lobby' || room.phase === 'finished') {
    room.humans = room.humans.filter((h) => h.token !== token);
    tokenToRoom.delete(token);
    if (room.humans.length === 0) {
      stopTick(room);
      rooms.delete(room.id);
      return;
    }
    if (room.hostId === human?.id) room.hostId = room.humans[0]!.id;
    room.message = `${human?.name ?? 'Player'} left.`;
    broadcast(room);
  } else if (room.phase === 'playing') {
    // if all humans gone, end room
    const anyConnected = room.humans.some((h) => h.socket);
    if (!anyConnected) {
      stopTick(room);
      for (const h of room.humans) tokenToRoom.delete(h.token);
      rooms.delete(room.id);
    }
  }
}

export function pruneRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.phase === 'lobby' && now - room.createdAt > 2 * 60 * 60 * 1000) {
      stopTick(room);
      for (const h of room.humans) tokenToRoom.delete(h.token);
      rooms.delete(id);
    }
  }
}

// re-export for tests / debugging
export { toPublicPlayers };
