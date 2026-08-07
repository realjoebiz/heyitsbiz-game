'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bOffset, canPlace, listLegalPlacements } from '@/lib/realmino/board';
import type { Cell, RoomPublic, Rotation, Tile } from '@/lib/realmino/types';
import { BOARD, TERRAIN_HEX } from '@/lib/realmino/types';
import { playSound } from '@/lib/sounds';

type Session = { roomId: string; token: string };

function TileFace({ tile, compact }: { tile: Tile; compact?: boolean }) {
  return (
    <div className={`rm-tile ${compact ? 'rm-tile-compact' : ''}`}>
      <span className="rm-tile-num">#{tile.number}</span>
      <div className="rm-tile-halves">
        <div className="rm-half" style={{ background: TERRAIN_HEX[tile.a.terrain] }}>
          {tile.a.crowns > 0 ? '♛'.repeat(tile.a.crowns) : ''}
        </div>
        <div className="rm-half" style={{ background: TERRAIN_HEX[tile.b.terrain] }}>
          {tile.b.crowns > 0 ? '♛'.repeat(tile.b.crowns) : ''}
        </div>
      </div>
    </div>
  );
}

function BoardView({
  board,
  interactive,
  pending,
  rotation,
  onCell,
}: {
  board: Cell[][];
  interactive?: boolean;
  pending?: Tile | null;
  rotation?: Rotation;
  onCell?: (x: number, y: number) => void;
}) {
  const legal = useMemo(() => {
    if (!interactive || !pending) return new Set<string>();
    return new Set(
      listLegalPlacements(board, pending)
        .filter((p) => p.rotation === (rotation ?? 0))
        .map((p) => `${p.x},${p.y}`)
    );
  }, [board, interactive, pending, rotation]);

  const ghost = useMemo(() => {
    if (!interactive || !pending) return null;
    return pending;
  }, [interactive, pending]);

  return (
    <div
      className="rm-board"
      style={{ gridTemplateColumns: `repeat(${BOARD}, 1fr)` }}
      role="grid"
      aria-label="Kingdom board"
    >
      {board.map((row, y) =>
        row.map((cell, x) => {
          const key = `${x},${y}`;
          let bg = '#1a1a28';
          let label = '';
          if (cell.kind === 'castle') {
            bg = '#c9a227';
            label = '⌂';
          } else if (cell.kind === 'terrain') {
            bg = TERRAIN_HEX[cell.terrain];
            label = cell.crowns > 0 ? '♛'.repeat(cell.crowns) : '';
          }

          const isLegal = legal.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`rm-cell ${isLegal ? 'rm-cell-legal' : ''} ${cell.kind === 'empty' ? 'rm-cell-empty' : ''}`}
              style={{ background: bg }}
              disabled={!interactive || !isLegal}
              onClick={() => onCell?.(x, y)}
              aria-label={`cell ${x},${y}`}
            >
              {label}
              {ghost && isLegal && rotation !== undefined ? (
                <span className="rm-ghost" aria-hidden>
                  ·
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function RealminoGame() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState<Rotation>(0);
  const esRef = useRef<EventSource | null>(null);

  const connectStream = useCallback((roomId: string, token: string) => {
    esRef.current?.close();
    const es = new EventSource(
      `/api/realmino/stream?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
    );
    esRef.current = es;
    es.addEventListener('state', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as RoomPublic;
        setRoom(data);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('gone', () => {
      setError('Room closed.');
      setSession(null);
      setRoom(null);
      es.close();
    });
    es.onerror = () => {
      /* browser will retry */
    };
  }, []);

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setRotation((r) => (((r + 1) % 4) as Rotation));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const doCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await postJson<{ room: RoomPublic; token: string }>('/api/realmino/create', {
        name: name || 'Host',
      });
      setSession({ roomId: data.room.id, token: data.token });
      setRoom(data.room);
      connectStream(data.room.id, data.token);
      playSound('click');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      playSound('error');
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await postJson<{ room: RoomPublic; token: string }>('/api/realmino/join', {
        roomId: joinCode,
        name: name || 'Player',
      });
      setSession({ roomId: data.room.id, token: data.token });
      setRoom(data.room);
      connectStream(data.room.id, data.token);
      playSound('click');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      playSound('error');
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (payload: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const data = await postJson<{ room: RoomPublic }>('/api/realmino/action', {
        roomId: session.roomId,
        token: session.token,
        ...payload,
      });
      setRoom(data.room);
      playSound('click');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      playSound('error');
    } finally {
      setBusy(false);
    }
  };

  const you = room?.you;
  const isHost = room && you && room.hostId === you.id;
  const draftTurn =
    room?.status === 'draft' && you && room.draftOrder[room.draftIndex] === you.id;
  const placeTurn =
    room?.status === 'place' && you && room.placeOrder[room.placeIndex] === you.id;

  const previewOffset = bOffset(rotation);

  if (!session || !room || !you) {
    return (
      <div className="game-shell rm-shell">
        <header className="game-header">
          <div>
            <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
              ← Games
            </Link>
            <p className="game-kicker">heyitsbiz</p>
            <h1 className="game-title">Realmino</h1>
          </div>
        </header>

        <p className="rm-lead">
          Draft domino tiles, grow a 5×5 kingdom, score regions × crowns. Online rooms — jump in.
        </p>

        <div className="rm-lobby">
          <label className="rm-field">
            <span>Your name</span>
            <input
              className="decoy-input"
              value={name}
              maxLength={16}
              placeholder="Player"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="rm-lobby-actions">
            <button type="button" className="game-btn" disabled={busy} onClick={doCreate}>
              Create room
            </button>
          </div>

          <div className="rm-join-row">
            <input
              className="decoy-input"
              value={joinCode}
              maxLength={6}
              placeholder="ROOM"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button type="button" className="game-btn" disabled={busy || !joinCode} onClick={doJoin}>
              Join
            </button>
          </div>

          {error ? <p className="rm-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="game-shell rm-shell">
      <header className="game-header">
        <div>
          <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
            ← Games
          </Link>
          <p className="game-kicker">heyitsbiz</p>
          <h1 className="game-title">Realmino</h1>
        </div>
        <div className="game-stats">
          <span>
            Room <strong>{room.id}</strong>
          </span>
          {room.status !== 'lobby' ? (
            <span>
              Round{' '}
              <strong>
                {room.round}/{room.totalRounds}
              </strong>
            </span>
          ) : null}
        </div>
      </header>

      <p className="rm-status">{room.message}</p>
      {error ? <p className="rm-error">{error}</p> : null}

      <ul className="rm-players">
        {room.players.map((p) => (
          <li key={p.id} style={{ borderColor: p.color }}>
            <span className="rm-dot" style={{ background: p.color }} />
            {p.name}
            {p.id === room.hostId ? ' ★' : ''}
            {!p.connected ? ' (away)' : ''}
            <strong>{p.score}</strong>
          </li>
        ))}
      </ul>

      {room.status === 'lobby' ? (
        <div className="rm-lobby-wait">
          <p>
            Share code <strong className="rm-code">{room.id}</strong> — need 2–4 players.
          </p>
          {isHost ? (
            <button
              type="button"
              className="game-btn"
              disabled={busy || room.players.length < 2}
              onClick={() => doAction({ action: 'start' })}
            >
              Start game
            </button>
          ) : (
            <p className="rm-muted">Waiting for host to start…</p>
          )}
        </div>
      ) : null}

      {room.status === 'draft' ? (
        <div className="rm-draft">
          <p className="rm-muted">
            {draftTurn ? 'Your pick — claim a tile.' : 'Waiting for another player to draft…'}
          </p>
          <div className="rm-draft-line">
            {room.draftLine.map((tile) => {
              const claimer = room.claims[tile.number];
              const claimerP = room.players.find((p) => p.id === claimer);
              const taken = !!claimer;
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={`rm-draft-slot ${taken ? 'rm-draft-taken' : ''} ${draftTurn && !taken ? 'rm-draft-open' : ''}`}
                  style={claimerP ? { outlineColor: claimerP.color } : undefined}
                  disabled={!draftTurn || taken || busy}
                  onClick={() => doAction({ action: 'draft', tileNumber: tile.number })}
                >
                  <TileFace tile={tile} />
                  {claimerP ? <span className="rm-claim">{claimerP.name}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {(room.status === 'place' || room.status === 'finished' || room.status === 'draft') && you ? (
        <div className="rm-play">
          <div className="rm-you-col">
            <h2>Your kingdom</h2>
            {placeTurn && you.pendingTile ? (
              <div className="rm-place-tools">
                <TileFace tile={you.pendingTile} compact />
                <p className="rm-muted">
                  Click a legal cell for the left/top half. Rotate: <kbd>R</kbd> or button.
                </p>
                <div className="rm-rotate-row">
                  <button
                    type="button"
                    className="game-btn game-btn-ghost"
                    onClick={() => setRotation((r) => (((r + 1) % 4) as Rotation))}
                  >
                    Rotate ({rotation * 90}°)
                  </button>
                  <button
                    type="button"
                    className="game-btn game-btn-ghost"
                    disabled={busy}
                    onClick={() => doAction({ action: 'discard' })}
                  >
                    Discard
                  </button>
                </div>
                <p className="rm-muted">
                  Offset B: {previewOffset.dx >= 0 ? '+' : ''}
                  {previewOffset.dx},{previewOffset.dy >= 0 ? '+' : ''}
                  {previewOffset.dy}
                </p>
              </div>
            ) : null}
            <BoardView
              board={you.board}
              interactive={!!placeTurn && !!you.pendingTile}
              pending={you.pendingTile}
              rotation={rotation}
              onCell={(x, y) => {
                if (!you.pendingTile) return;
                if (!canPlace(you.board, you.pendingTile, x, y, rotation)) {
                  playSound('error');
                  return;
                }
                doAction({ action: 'place', x, y, rotation });
              }}
            />
          </div>
        </div>
      ) : null}

      {room.status === 'finished' ? (
        <div className="rm-finish">
          <p>
            {room.winnerIds.includes(you.id) ? 'You win!' : 'Final scores above.'}
          </p>
          {isHost ? (
            <button
              type="button"
              className="game-btn"
              disabled={busy}
              onClick={() => doAction({ action: 'start' })}
            >
              Play again
            </button>
          ) : null}
        </div>
      ) : null}

      <footer className="rm-footer-actions">
        <button
          type="button"
          className="game-btn game-btn-ghost"
          onClick={() => {
            doAction({ action: 'leave' }).finally(() => {
              esRef.current?.close();
              setSession(null);
              setRoom(null);
            });
          }}
        >
          Leave room
        </button>
      </footer>
    </div>
  );
}
