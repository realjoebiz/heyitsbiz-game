'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  COLS,
  ROWS,
  clickCell,
  getGroup,
  isValidClick,
  newGame,
  type BlockColor,
  type GameState,
} from '@/lib/block-burst';
import { playSound } from '@/lib/sounds';

const COLOR_CLASS: Record<BlockColor, string> = {
  red: 'bb-red',
  green: 'bb-green',
  blue: 'bb-blue',
  yellow: 'bb-yellow',
};

export function ColorBlocksGame() {
  const [game, setGame] = useState<GameState>(() => newGame());
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const hoverKeys = useMemo(() => {
    if (!hover || game.status !== 'playing' || !isValidClick(game.grid, hover.row, hover.col)) {
      return new Set<string>();
    }
    return new Set(getGroup(game.grid, hover.row, hover.col).map(({ row, col }) => `${row},${col}`));
  }, [hover, game]);

  const onCellClick = useCallback(
    (row: number, col: number) => {
      if (!isValidClick(game.grid, row, col)) {
        playSound('error');
        return;
      }
      playSound('click');
      setGame((g) => {
        const next = clickCell(g, row, col);
        if (next.status === 'won') playSound('win');
        return next;
      });
    },
    [game.grid]
  );

  const restart = () => {
    playSound('click');
    setGame(newGame());
    setHover(null);
  };

  return (
    <div className="game-shell">
      <header className="game-header">
        <div>
          <p className="game-kicker">heyitsbiz</p>
          <h1 className="game-title">Color Blocks</h1>
        </div>
        <div className="game-stats">
          <span>
            Score <strong>{game.score}</strong>
          </span>
          <span>
            Moves <strong>{game.moves}</strong>
          </span>
          <button type="button" className="game-btn" onClick={restart}>
            New game
          </button>
        </div>
      </header>

      {game.status === 'won' ? (
        <p className="game-banner game-banner-win">Grid cleared — you win!</p>
      ) : null}
      {game.status === 'stuck' ? (
        <p className="game-banner game-banner-over">No valid moves left — game over</p>
      ) : null}

      <p className="game-hint">
        {COLS}×{ROWS} grid · click groups of 2+ matching colours · blocks fall down then left
      </p>

      <div className="game-board-wrap">
        <div
          className="block-burst-grid"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          }}
          role="grid"
          aria-label="Color block puzzle"
        >
          {game.grid.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              const valid = cell !== null && isValidClick(game.grid, r, c);
              const inHover = hoverKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  disabled={!cell || game.status !== 'playing'}
                  className={[
                    'block-burst-cell',
                    cell ? COLOR_CLASS[cell] : 'bb-empty',
                    valid ? 'bb-valid' : cell ? 'bb-invalid' : '',
                    inHover ? 'bb-hover' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onCellClick(r, c)}
                  onMouseEnter={() => setHover({ row: r, col: c })}
                  onMouseLeave={() => setHover(null)}
                  aria-label={cell ? `${cell} block` : 'empty'}
                />
              );
            })
          )}
        </div>
      </div>

      <footer className="game-footer">
        <a href="https://pc.heyitsbiz.com">Play on BIZ-PC</a>
        <span>·</span>
        <a href="https://heyitsbiz.com">heyitsbiz.com</a>
      </footer>
    </div>
  );
}
