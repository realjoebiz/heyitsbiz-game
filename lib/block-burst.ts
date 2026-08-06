export const COLS = 12;
export const ROWS = 20;

export const COLORS = ['red', 'green', 'blue'] as const;
export type BlockColor = (typeof COLORS)[number];
export type Cell = BlockColor | null;
export type Grid = Cell[][];

export type GameStatus = 'playing' | 'won' | 'stuck';

export type GameState = {
  grid: Grid;
  status: GameStatus;
  score: number;
  moves: number;
};

function randColor(): BlockColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

export function createGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => randColor())
  );
}

export function createGame(): GameState {
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = createGrid();
    if (hasValidMove(grid)) {
      return { grid, status: 'playing', score: 0, moves: 0 };
    }
  }
  const grid = createGrid();
  return { grid, status: hasValidMove(grid) ? 'playing' : 'stuck', score: 0, moves: 0 };
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function getGroup(grid: Grid, row: number, col: number): { row: number; col: number }[] {
  const color = grid[row]?.[col];
  if (!color) return [];

  const group: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const stack = [{ row, col }];

  while (stack.length > 0) {
    const cell = stack.pop()!;
    const key = `${cell.row},${cell.col}`;
    if (seen.has(key)) continue;
    if (!inBounds(cell.row, cell.col) || grid[cell.row]![cell.col] !== color) continue;
    seen.add(key);
    group.push(cell);
    stack.push(
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 }
    );
  }

  return group;
}

export function isValidClick(grid: Grid, row: number, col: number): boolean {
  return getGroup(grid, row, col).length >= 2;
}

export function hasValidMove(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r]![c] && isValidClick(grid, r, c)) return true;
    }
  }
  return false;
}

export function isGridCleared(grid: Grid): boolean {
  return grid.every((row) => row.every((cell) => cell === null));
}

function compactColumnsDown(grid: Grid): Grid {
  const next: Grid = Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));

  for (let c = 0; c < COLS; c++) {
    const stack: BlockColor[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = grid[r]![c];
      if (cell) stack.push(cell);
    }
    for (let i = 0; i < stack.length; i++) {
      next[ROWS - 1 - i]![c] = stack[i]!;
    }
  }

  return next;
}

function compactColumnsLeft(grid: Grid): Grid {
  const next: Grid = Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
  let writeCol = 0;

  for (let c = 0; c < COLS; c++) {
    const hasBlock = grid.some((row) => row[c] !== null);
    if (!hasBlock) continue;
    for (let r = 0; r < ROWS; r++) {
      next[r]![writeCol] = grid[r]![c] ?? null;
    }
    writeCol += 1;
  }

  return next;
}

export function removeGroupAndCollapse(grid: Grid, row: number, col: number): Grid {
  const group = getGroup(grid, row, col);
  if (group.length < 2) return grid;

  const next = grid.map((r) => [...r]);
  for (const { row: gr, col: gc } of group) {
    next[gr]![gc] = null;
  }

  return compactColumnsLeft(compactColumnsDown(next));
}

export function clickCell(state: GameState, row: number, col: number): GameState {
  if (state.status !== 'playing') return state;
  if (!isValidClick(state.grid, row, col)) return state;

  const removed = getGroup(state.grid, row, col).length;
  const grid = removeGroupAndCollapse(state.grid, row, col);
  const score = state.score + removed * removed;
  const moves = state.moves + 1;

  let status: GameStatus = 'playing';
  if (isGridCleared(grid)) status = 'won';
  else if (!hasValidMove(grid)) status = 'stuck';

  return { grid, status, score, moves };
}

export function newGame(): GameState {
  return createGame();
}
