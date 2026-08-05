'use client';

import Link from 'next/link';
import { GAMES } from '@/lib/games';
import { playSound } from '@/lib/sounds';

export function GameHub() {
  return (
    <div className="hub-shell">
      <header className="hub-header">
        <p className="game-kicker">heyitsbiz</p>
        <h1 className="hub-title">Games</h1>
        <p className="hub-sub">Pick a square. Play something sharp.</p>
      </header>

      <div className="hub-grid" role="list">
        {GAMES.map((game) => {
          const body = (
            <>
              <span className="hub-tile-accent" style={{ background: game.accent }} />
              <span className="hub-tile-title">{game.title}</span>
              <span className="hub-tile-blurb">{game.blurb}</span>
              {!game.available ? <span className="hub-tile-soon">Soon</span> : null}
            </>
          );

          if (!game.available) {
            return (
              <div key={game.slug} className="hub-tile hub-tile-locked" role="listitem" aria-disabled>
                {body}
              </div>
            );
          }

          return (
            <Link
              key={game.slug}
              href={`/${game.slug}`}
              className="hub-tile"
              role="listitem"
              onClick={() => playSound('click')}
            >
              {body}
            </Link>
          );
        })}
      </div>

      <footer className="game-footer">
        <a href="https://pc.heyitsbiz.com">Play on BIZ-PC</a>
        <span>·</span>
        <a href="https://heyitsbiz.com">heyitsbiz.com</a>
      </footer>
    </div>
  );
}
