export type Weapon = 'rail' | 'rocket';

export type PlayerInput = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  weapon: Weapon;
  yaw: number; // radians
};

export type EntityPublic = {
  id: string;
  name: string;
  x: number;
  y: number;
  yaw: number;
  health: number;
  frags: number;
  alive: boolean;
  color: string;
  isBot: boolean;
  weapon: Weapon;
};

export type ProjectilePublic = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type KillFeedItem = {
  id: string;
  killer: string;
  victim: string;
  weapon: Weapon;
  t: number;
};

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export type Snapshot = {
  type: 'state';
  roomId: string;
  phase: RoomPhase;
  hostId: string;
  youId: string;
  tick: number;
  timeLeft: number;
  fragLimit: number;
  players: EntityPublic[];
  projectiles: ProjectilePublic[];
  killFeed: KillFeedItem[];
  winnerIds: string[];
  message: string;
  map: number[][];
};

export type ClientMsg =
  | { type: 'create'; name: string }
  | { type: 'join'; roomId: string; name: string }
  | { type: 'start' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'leave' };

export type ServerMsg =
  | Snapshot
  | { type: 'error'; message: string }
  | { type: 'joined'; roomId: string; token: string; youId: string };

export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const MOVE_SPEED = 3.2; // cells per second
export const PLAYER_RADIUS = 0.28;
export const MAX_HEALTH = 100;
export const FRAG_LIMIT = 10;
export const MATCH_SECONDS = 180;
export const TARGET_PLAYERS = 3;
export const MAX_HUMANS = 3;

export const PLAYER_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#f472b6', '#84cc16'];
