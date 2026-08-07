export type Terrain = 'wheat' | 'forest' | 'water' | 'grass' | 'swamp' | 'mine';

export type Half = {
  terrain: Terrain;
  crowns: number;
};

export type Tile = {
  id: string;
  number: number;
  a: Half;
  b: Half;
};

export type Rotation = 0 | 1 | 2 | 3;

/** One board cell — castle, terrain, or empty. */
export type Cell =
  | { kind: 'empty' }
  | { kind: 'castle' }
  | { kind: 'terrain'; terrain: Terrain; crowns: number };

export type PlayerPublic = {
  id: string;
  name: string;
  color: string;
  score: number;
  connected: boolean;
  hasPending: boolean;
};

export type RoomPhase = 'lobby' | 'draft' | 'place' | 'finished';

export type RoomPublic = {
  id: string;
  hostId: string;
  status: RoomPhase;
  players: PlayerPublic[];
  maxPlayers: number;
  round: number;
  totalRounds: number;
  draftLine: Tile[];
  /** tile number → player id who claimed it this round */
  claims: Record<number, string>;
  draftOrder: string[]; // player ids in pick order
  draftIndex: number;
  placeOrder: string[];
  placeIndex: number;
  you?: {
    id: string;
    token: string;
    pendingTile: Tile | null;
    board: Cell[][];
  };
  winnerIds: string[];
  message: string;
};

export const BOARD = 5;
export const CASTLE = Math.floor(BOARD / 2);

export const TERRAIN_HEX: Record<Terrain, string> = {
  wheat: '#e8c547',
  forest: '#2d8a4e',
  water: '#3b82c4',
  grass: '#7cb342',
  swamp: '#6b5b3e',
  mine: '#6b7280',
};

export const PLAYER_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#f472b6'];
