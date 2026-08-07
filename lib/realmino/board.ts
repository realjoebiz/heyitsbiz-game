import { BOARD, CASTLE, type Cell, type Half, type Rotation, type Tile } from './types';

export function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD }, (_, y) =>
    Array.from({ length: BOARD }, (_, x) =>
      x === CASTLE && y === CASTLE ? { kind: 'castle' as const } : { kind: 'empty' as const }
    )
  );
}

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => ({ ...c })));
}

/** Offset of half B relative to half A for a rotation. */
export function bOffset(rotation: Rotation): { dx: number; dy: number } {
  if (rotation === 0) return { dx: 1, dy: 0 };
  if (rotation === 1) return { dx: 0, dy: 1 };
  if (rotation === 2) return { dx: -1, dy: 0 };
  return { dx: 0, dy: -1 };
}

export function tileCells(x: number, y: number, rotation: Rotation) {
  const { dx, dy } = bOffset(rotation);
  return [
    { x, y, which: 'a' as const },
    { x: x + dx, y: y + dy, which: 'b' as const },
  ];
}

function inBounds(x: number, y: number) {
  return x >= 0 && x < BOARD && y >= 0 && y < BOARD;
}

function neighbors(x: number, y: number) {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ].filter((p) => inBounds(p.x, p.y));
}

function matches(half: Half, cell: Cell): boolean {
  if (cell.kind === 'castle') return true;
  if (cell.kind === 'terrain') return cell.terrain === half.terrain;
  return false;
}

export function canPlace(board: Cell[][], tile: Tile, x: number, y: number, rotation: Rotation): boolean {
  const cells = tileCells(x, y, rotation);
  for (const c of cells) {
    if (!inBounds(c.x, c.y)) return false;
    const cell = board[c.y]![c.x]!;
    if (cell.kind !== 'empty') return false;
  }

  let touchesKingdom = false;
  let hasMatch = false;

  for (const c of cells) {
    const half = c.which === 'a' ? tile.a : tile.b;
    for (const n of neighbors(c.x, c.y)) {
      // skip the other half of this same tile
      if (cells.some((o) => o.x === n.x && o.y === n.y)) continue;
      const cell = board[n.y]![n.x]!;
      if (cell.kind === 'empty') continue;
      touchesKingdom = true;
      if (matches(half, cell)) hasMatch = true;
    }
  }

  // First tile after castle must touch castle (touchesKingdom) with match (castle matches all)
  return touchesKingdom && hasMatch;
}

export function placeTile(board: Cell[][], tile: Tile, x: number, y: number, rotation: Rotation): Cell[][] | null {
  if (!canPlace(board, tile, x, y, rotation)) return null;
  const next = cloneBoard(board);
  const cells = tileCells(x, y, rotation);
  for (const c of cells) {
    const half = c.which === 'a' ? tile.a : tile.b;
    next[c.y]![c.x] = { kind: 'terrain', terrain: half.terrain, crowns: half.crowns };
  }
  return next;
}

export function scoreBoard(board: Cell[][]): number {
  const seen = Array.from({ length: BOARD }, () => Array(BOARD).fill(false));
  let total = 0;

  for (let y = 0; y < BOARD; y++) {
    for (let x = 0; x < BOARD; x++) {
      const cell = board[y]![x]!;
      if (cell.kind !== 'terrain' || seen[y]![x]) continue;

      const terrain = cell.terrain;
      let size = 0;
      let crowns = 0;
      const stack = [{ x, y }];
      seen[y]![x] = true;

      while (stack.length) {
        const cur = stack.pop()!;
        const here = board[cur.y]![cur.x]!;
        if (here.kind !== 'terrain' || here.terrain !== terrain) continue;
        size += 1;
        crowns += here.crowns;
        for (const n of neighbors(cur.x, cur.y)) {
          if (seen[n.y]![n.x]) continue;
          const nc = board[n.y]![n.x]!;
          if (nc.kind === 'terrain' && nc.terrain === terrain) {
            seen[n.y]![n.x] = true;
            stack.push(n);
          }
        }
      }

      total += size * crowns;
    }
  }

  return total;
}

/** List legal placements for UI hints (cap for perf). */
export function listLegalPlacements(board: Cell[][], tile: Tile) {
  const out: { x: number; y: number; rotation: Rotation }[] = [];
  for (let y = 0; y < BOARD; y++) {
    for (let x = 0; x < BOARD; x++) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        if (canPlace(board, tile, x, y, rotation)) out.push({ x, y, rotation });
      }
    }
  }
  return out;
}
