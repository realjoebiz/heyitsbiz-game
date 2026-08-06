'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
};

export function ColorBlocksGame() {
  const [game, setGame] = useState<GameState>(() => newGame());
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const gameRef = useRef(game);
  const lastSoundMove = useRef(0);
  gameRef.current = game;

  useEffect(() => {
    if (game.moves > lastSoundMove.current) {
      playSound('click');
      if (game.status === 'won') playSound('win');
      lastSoundMove.current = game.moves;
    }
  }, [game.moves, game.status]);

  const hoverKeys = useMemo(() => {
    if (!hover || game.status !== 'playing' || !isValidClick(game.grid, hover.row, hover.col)) {
      return new Set<string>();
    }
    return new Set(getGroup(game.grid, hover.row, hover.col).map(({ row, col }) => `${row},${col}`));
  }, [hover, game]);

  const onCellClick = useCallback((row: number, col: number) => {
    const current = gameRef.current;
    if (current.status !== 'playing' || !isValidClick(current.grid, row, col)) {
      playSound('error');
      return;
    }
    const next = clickCell(current, row, col);
    gameRef.current = next;
    setGame(next);
    setHover(null);
  }, []);

  const restart = () => {
    playSound('click');
    lastSoundMove.current = 0;
    const next = newGame();
    gameRef.current = next;
    setGame(next);
    setHover(null);
  };

  return (
    <div className="game-shell">
      <header className="game-header">
        <div>
          <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
            ← Games
          </Link>
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
        {COLS}×{ROWS} · three colours · click groups of 2+ · blocks fall down, then left
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
              const valid = cell !== null && game.status === 'playing' && isValidClick(game.grid, r, c);
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
