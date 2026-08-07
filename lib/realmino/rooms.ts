import { randomBytes, randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { emptyBoard, listLegalPlacements, placeTile, scoreBoard } from './board';
import { buildDeck, roundsForPlayerCount, shuffle } from './deck';
import {
  PLAYER_COLORS,
  type Cell,
  type Rotation,
  type RoomPublic,
  type Tile,
} from './types';

export type Player = {
  id: string;
  token: string;
  name: string;
  color: string;
  board: Cell[][];
  score: number;
  pendingTile: Tile | null;
  connected: boolean;
};

type Room = {
  id: string;
  hostId: string;
  status: RoomPublic['status'];
  players: Player[];
  maxPlayers: number;
  deck: Tile[];
  round: number;
  totalRounds: number;
  draftLine: Tile[];
  draftOrder: string[];
  draftIndex: number;
  placeOrder: string[];
  placeIndex: number;
  /** tile number → player id who claimed it this round */
  claims: Map<number, string>;
  winnerIds: string[];
  message: string;
  createdAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __realminoBus: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __realminoRooms: Map<string, Room> | undefined;
}

export const realminoBus: EventEmitter = globalThis.__realminoBus ?? new EventEmitter();
realminoBus.setMaxListeners(0);
globalThis.__realminoBus = realminoBus;

const rooms: Map<string, Room> = globalThis.__realminoRooms ?? new Map();
globalThis.__realminoRooms = rooms;

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

function publish(roomId: string) {
  realminoBus.emit(`room:${roomId}`, roomId);
}

function getRoom(id: string): Room | null {
  return rooms.get(id.toUpperCase()) ?? null;
}

function playerByToken(room: Room, token: string): Player | null {
  return room.players.find((p) => p.token === token) ?? null;
}

function toPublic(room: Room, forToken?: string): RoomPublic {
  const you = forToken ? playerByToken(room, forToken) : null;
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      connected: p.connected,
      hasPending: !!p.pendingTile,
    })),
    maxPlayers: room.maxPlayers,
    round: room.round,
    totalRounds: room.totalRounds,
    draftLine: room.draftLine,
    claims: Object.fromEntries(room.claims),
    draftOrder: room.draftOrder,
    draftIndex: room.draftIndex,
    placeOrder: room.placeOrder,
    placeIndex: room.placeIndex,
    you: you
      ? {
          id: you.id,
          token: you.token,
          pendingTile: you.pendingTile,
          board: you.board,
        }
      : undefined,
    winnerIds: room.winnerIds,
    message: room.message,
  };
}

function dealDraft(room: Room) {
  const n = room.players.length;
  const dealt: Tile[] = [];
  for (let i = 0; i < n; i++) {
    const t = room.deck.pop();
    if (!t) break;
    dealt.push(t);
  }
  dealt.sort((a, b) => a.number - b.number);
  room.draftLine = dealt;
  room.claims = new Map();
  room.draftIndex = 0;
  room.placeOrder = [];
  room.placeIndex = 0;
  room.status = 'draft';
  room.message =
    room.round === 1
      ? 'Draft: claim a tile (low → high decides next turn order).'
      : `Round ${room.round}/${room.totalRounds} — draft a tile.`;
}

function beginPlace(room: Room) {
  // Place order = draft line order among claimed tiles (already sorted low→high)
  const order: string[] = [];
  for (const tile of room.draftLine) {
    const pid = room.claims.get(tile.number);
    if (pid) order.push(pid);
  }
  room.placeOrder = order;
  room.placeIndex = 0;
  room.status = 'place';
  room.draftLine = [];
  room.message = 'Place your tile on your kingdom (or discard if stuck).';
  advancePlaceIfNeeded(room);
}

function advancePlaceIfNeeded(room: Room) {
  while (room.status === 'place' && room.placeIndex < room.placeOrder.length) {
    const pid = room.placeOrder[room.placeIndex]!;
    const player = room.players.find((p) => p.id === pid);
    if (!player?.pendingTile) {
      room.placeIndex += 1;
      continue;
    }
    const legal = listLegalPlacements(player.board, player.pendingTile);
    if (legal.length === 0) {
      // Auto-discard when impossible
      player.pendingTile = null;
      room.placeIndex += 1;
      room.message = `${player.name} discarded (no legal spot).`;
      continue;
    }
    return;
  }

  if (room.status === 'place' && room.placeIndex >= room.placeOrder.length) {
    finishRound(room);
  }
}

function finishRound(room: Room) {
  for (const p of room.players) {
    p.score = scoreBoard(p.board);
    p.pendingTile = null;
  }

  // Next draft order = previous place order (who had lower tiles goes first)
  room.draftOrder = [...room.placeOrder];

  if (room.round >= room.totalRounds || room.deck.length < room.players.length) {
    finishGame(room);
    return;
  }

  room.round += 1;
  dealDraft(room);
}

function finishGame(room: Room) {
  for (const p of room.players) p.score = scoreBoard(p.board);
  const max = Math.max(...room.players.map((p) => p.score));
  room.winnerIds = room.players.filter((p) => p.score === max).map((p) => p.id);
  room.status = 'finished';
  const names = room.players
    .filter((p) => room.winnerIds.includes(p.id))
    .map((p) => p.name)
    .join(' & ');
  room.message = `Game over — ${names} win${room.winnerIds.length === 1 ? 's' : ''} with ${max}.`;
}

function cleanName(raw: string) {
  return raw.trim().slice(0, 16) || 'Player';
}

export function createRoom(name: string): { room: RoomPublic; token: string } {
  let id = code();
  while (rooms.has(id)) id = code();

  const token = randomUUID();
  const player: Player = {
    id: randomUUID(),
    token,
    name: cleanName(name),
    color: PLAYER_COLORS[0]!,
    board: emptyBoard(),
    score: 0,
    pendingTile: null,
    connected: true,
  };

  const room: Room = {
    id,
    hostId: player.id,
    status: 'lobby',
    players: [player],
    maxPlayers: 4,
    deck: [],
    round: 0,
    totalRounds: 12,
    draftLine: [],
    draftOrder: [],
    draftIndex: 0,
    placeOrder: [],
    placeIndex: 0,
    claims: new Map(),
    winnerIds: [],
    message: 'Waiting for players. Share the room code.',
    createdAt: Date.now(),
  };

  rooms.set(id, room);
  publish(id);
  return { room: toPublic(room, token), token };
}

export function joinRoom(
  roomId: string,
  name: string
): { room: RoomPublic; token: string } | { error: string } {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };
  if (room.status !== 'lobby') return { error: 'Game already started.' };
  if (room.players.length >= room.maxPlayers) return { error: 'Room is full.' };

  const token = randomUUID();
  const player: Player = {
    id: randomUUID(),
    token,
    name: cleanName(name),
    color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length]!,
    board: emptyBoard(),
    score: 0,
    pendingTile: null,
    connected: true,
  };
  room.players.push(player);
  room.message = `${player.name} joined.`;
  publish(room.id);
  return { room: toPublic(room, token), token };
}

export function getSnapshot(roomId: string, token?: string): RoomPublic | null {
  const room = getRoom(roomId);
  if (!room) return null;
  return toPublic(room, token);
}

export function setConnected(roomId: string, token: string, connected: boolean) {
  const room = getRoom(roomId);
  if (!room) return;
  const p = playerByToken(room, token);
  if (!p) return;
  p.connected = connected;
  publish(room.id);
}

export type Action =
  | { type: 'start' }
  | { type: 'draft'; tileNumber: number }
  | { type: 'place'; x: number; y: number; rotation: Rotation }
  | { type: 'discard' }
  | { type: 'leave' };

export function act(
  roomId: string,
  token: string,
  action: Action
): { room: RoomPublic } | { error: string } {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };
  const player = playerByToken(room, token);
  if (!player) return { error: 'Not in this room.' };

  if (action.type === 'leave') {
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) {
      rooms.delete(room.id);
      return { room: toPublic(room, token) };
    }
    if (room.hostId === player.id) room.hostId = room.players[0]!.id;
    room.message = `${player.name} left.`;
    if (room.status !== 'lobby' && room.status !== 'finished') {
      room.status = 'finished';
      room.message = `${player.name} left — game ended.`;
      room.winnerIds = [];
    }
    publish(room.id);
    return { room: toPublic(room, token) };
  }

  if (action.type === 'start') {
    if (player.id !== room.hostId) return { error: 'Only the host can start.' };
    if (room.status !== 'lobby' && room.status !== 'finished') {
      return { error: 'Already in progress.' };
    }
    if (room.players.length < 2) return { error: 'Need at least 2 players.' };

    room.deck = shuffle(buildDeck());
    room.totalRounds = roundsForPlayerCount(room.players.length);
    room.round = 1;
    room.winnerIds = [];
    for (const p of room.players) {
      p.board = emptyBoard();
      p.score = 0;
      p.pendingTile = null;
    }
    room.draftOrder = shuffle(room.players.map((p) => p.id));
    dealDraft(room);
    publish(room.id);
    return { room: toPublic(room, token) };
  }

  if (action.type === 'draft') {
    if (room.status !== 'draft') return { error: 'Not drafting.' };
    const expected = room.draftOrder[room.draftIndex];
    if (expected !== player.id) return { error: 'Not your pick.' };
    const tile = room.draftLine.find((t) => t.number === action.tileNumber);
    if (!tile) return { error: 'Tile not available.' };
    if (room.claims.has(tile.number)) return { error: 'Already claimed.' };

    room.claims.set(tile.number, player.id);
    player.pendingTile = tile;
    room.draftIndex += 1;
    room.message = `${player.name} claimed #${tile.number}.`;

    if (room.draftIndex >= room.draftOrder.length) beginPlace(room);
    publish(room.id);
    return { room: toPublic(room, token) };
  }

  if (action.type === 'place') {
    if (room.status !== 'place') return { error: 'Not placing.' };
    const expected = room.placeOrder[room.placeIndex];
    if (expected !== player.id) return { error: 'Not your turn to place.' };
    if (!player.pendingTile) return { error: 'No tile to place.' };

    const next = placeTile(player.board, player.pendingTile, action.x, action.y, action.rotation);
    if (!next) return { error: 'Illegal placement.' };

    player.board = next;
    player.pendingTile = null;
    player.score = scoreBoard(player.board);
    room.placeIndex += 1;
    room.message = `${player.name} placed a tile.`;
    advancePlaceIfNeeded(room);
    publish(room.id);
    return { room: toPublic(room, token) };
  }

  if (action.type === 'discard') {
    if (room.status !== 'place') return { error: 'Not placing.' };
    const expected = room.placeOrder[room.placeIndex];
    if (expected !== player.id) return { error: 'Not your turn.' };
    if (!player.pendingTile) return { error: 'No tile.' };
    player.pendingTile = null;
    room.placeIndex += 1;
    room.message = `${player.name} discarded.`;
    advancePlaceIfNeeded(room);
    publish(room.id);
    return { room: toPublic(room, token) };
  }

  return { error: 'Unknown action.' };
}

/** Prune empty/stale lobbies occasionally. */
export function pruneRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.status === 'lobby' && now - room.createdAt > 2 * 60 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}
