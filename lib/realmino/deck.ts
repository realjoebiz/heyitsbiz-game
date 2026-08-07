import type { Half, Terrain, Tile } from './types';

type Spec = [Terrain, number, Terrain, number];

/** Compact Kingdomino-style set (48 tiles, numbers 1–48). */
const SPECS: Spec[] = [
  ['wheat', 0, 'wheat', 0],
  ['wheat', 0, 'wheat', 0],
  ['forest', 0, 'forest', 0],
  ['forest', 0, 'forest', 0],
  ['forest', 0, 'forest', 0],
  ['forest', 0, 'forest', 0],
  ['water', 0, 'water', 0],
  ['water', 0, 'water', 0],
  ['water', 0, 'water', 0],
  ['grass', 0, 'grass', 0],
  ['grass', 0, 'grass', 0],
  ['swamp', 0, 'swamp', 0],
  ['wheat', 0, 'forest', 0],
  ['wheat', 0, 'water', 0],
  ['wheat', 0, 'grass', 0],
  ['wheat', 0, 'swamp', 0],
  ['forest', 0, 'water', 0],
  ['forest', 0, 'grass', 0],
  ['wheat', 1, 'forest', 0],
  ['wheat', 1, 'water', 0],
  ['wheat', 1, 'grass', 0],
  ['wheat', 1, 'swamp', 0],
  ['wheat', 1, 'mine', 0],
  ['forest', 1, 'wheat', 0],
  ['forest', 1, 'wheat', 0],
  ['forest', 1, 'wheat', 0],
  ['forest', 1, 'wheat', 0],
  ['forest', 1, 'water', 0],
  ['forest', 1, 'grass', 0],
  ['water', 1, 'wheat', 0],
  ['water', 1, 'wheat', 0],
  ['water', 1, 'forest', 0],
  ['water', 1, 'forest', 0],
  ['water', 1, 'forest', 0],
  ['water', 1, 'forest', 0],
  ['wheat', 0, 'grass', 1],
  ['water', 0, 'grass', 1],
  ['wheat', 0, 'swamp', 1],
  ['grass', 0, 'swamp', 1],
  ['mine', 1, 'wheat', 0],
  ['wheat', 0, 'grass', 2],
  ['water', 0, 'grass', 2],
  ['wheat', 0, 'swamp', 2],
  ['grass', 0, 'swamp', 2],
  ['mine', 2, 'wheat', 0],
  ['swamp', 0, 'mine', 2],
  ['swamp', 0, 'mine', 2],
  ['wheat', 0, 'mine', 3],
];

function half(terrain: Terrain, crowns: number): Half {
  return { terrain, crowns };
}

export function buildDeck(): Tile[] {
  return SPECS.map(([ta, ca, tb, cb], i) => ({
    id: `t${i + 1}`,
    number: i + 1,
    a: half(ta, ca),
    b: half(tb, cb),
  }));
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function roundsForPlayerCount(n: number): number {
  // Kingdomino: 2p uses more tiles; keep rounds so everyone places ~12 tiles
  if (n <= 2) return 12;
  return 12;
}
