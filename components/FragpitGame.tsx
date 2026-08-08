'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { renderFrame } from '@/lib/fragpit/render';
import type { ClientMsg, PlayerInput, ServerMsg, Snapshot, Weapon } from '@/lib/fragpit/types';
import { playSound } from '@/lib/sounds';

function wsUrl() {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/fragpit/ws`;
}

export function FragpitGame() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const inputRef = useRef<PlayerInput>({
    forward: false,
    back: false,
    left: false,
    right: false,
    fire: false,
    weapon: 'rail',
    yaw: 0,
  });
  const keysRef = useRef<Set<string>>(new Set());
  const yawRef = useRef(0);
  const rafRef = useRef(0);

  snapRef.current = snap;

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return wsRef.current;
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setError('Connection failed.');
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.type === 'error') {
        setError(msg.message);
        playSound('error');
        return;
      }
      if (msg.type === 'joined') {
        setError('');
        playSound('click');
        return;
      }
      if (msg.type === 'state') {
        const prev = snapRef.current;
        setSnap(msg);
        const you = msg.players.find((p) => p.id === msg.youId);
        if (you) {
          const wasDead = prev?.players.find((p) => p.id === msg.youId)?.alive === false;
          if (msg.phase === 'lobby' || msg.phase === 'finished' || (you.alive && wasDead)) {
            yawRef.current = you.yaw;
          }
        }
      }
    };
    return ws;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // input + pointer lock while playing
  useEffect(() => {
    if (snap?.phase !== 'playing') return;

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === 'Digit1') inputRef.current.weapon = 'rail';
      if (e.code === 'Digit2') inputRef.current.weapon = 'rocket';
      if (e.code === 'KeyR') {
        inputRef.current.weapon = (inputRef.current.weapon === 'rail' ? 'rocket' : 'rail') as Weapon;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      yawRef.current += e.movementX * 0.0025;
    };
    const onDown = () => {
      inputRef.current.fire = true;
    };
    const onUp = () => {
      inputRef.current.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    const inputInterval = setInterval(() => {
      const keys = keysRef.current;
      inputRef.current.forward = keys.has('KeyW') || keys.has('ArrowUp');
      inputRef.current.back = keys.has('KeyS') || keys.has('ArrowDown');
      inputRef.current.left = keys.has('KeyA') || keys.has('ArrowLeft');
      inputRef.current.right = keys.has('KeyD') || keys.has('ArrowRight');
      inputRef.current.yaw = yawRef.current;
      if (keys.has('Space')) inputRef.current.fire = true;
      send({ type: 'input', input: { ...inputRef.current } });
    }, 50);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      clearInterval(inputInterval);
    };
  }, [snap?.phase, send]);

  // render loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const s = snapRef.current;
      if (canvas && s?.phase === 'playing') {
        const you = s.players.find((p) => p.id === s.youId);
        if (you) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
              canvas.width = Math.floor(w * dpr);
              canvas.height = Math.floor(h * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const view = { ...you, yaw: yawRef.current };
            renderFrame(ctx, w, h, view, s.players, s.projectiles, s.map);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const doCreate = () => {
    setError('');
    const ws = connect();
    const go = () => send({ type: 'create', name: name || 'Host' });
    if (ws.readyState === WebSocket.OPEN) go();
    else ws.addEventListener('open', go, { once: true });
  };

  const doJoin = () => {
    setError('');
    const ws = connect();
    const go = () => send({ type: 'join', roomId: joinCode, name: name || 'Player' });
    if (ws.readyState === WebSocket.OPEN) go();
    else ws.addEventListener('open', go, { once: true });
  };

  const you = snap?.players.find((p) => p.id === snap.youId);
  const isHost = snap && you && snap.hostId === you.id;
  const mins = snap ? Math.floor(snap.timeLeft / 60) : 0;
  const secs = snap ? Math.floor(snap.timeLeft % 60) : 0;

  if (!snap) {
    return (
      <div className="game-shell fp-shell">
        <header className="game-header">
          <div>
            <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
              ← Games
            </Link>
            <p className="game-kicker">heyitsbiz</p>
            <h1 className="game-title">Fragpit</h1>
          </div>
        </header>
        <p className="fp-lead">
          Retro deathmatch. WASD, mouse look, rail + rockets. Bots fill the pit to 3.
        </p>
        <div className="fp-lobby">
          <label className="rm-field">
            <span>Your name</span>
            <input
              className="decoy-input"
              value={name}
              maxLength={14}
              placeholder="Fragster"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="button" className="game-btn" onClick={doCreate}>
            Create room
          </button>
          <div className="rm-join-row">
            <input
              className="decoy-input"
              value={joinCode}
              maxLength={6}
              placeholder="ROOM"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button type="button" className="game-btn" disabled={!joinCode} onClick={doJoin}>
              Join
            </button>
          </div>
          {error ? <p className="rm-error">{error}</p> : null}
          <p className="rm-muted">{connected ? 'Link up.' : 'Connecting on create/join…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-shell fp-shell">
      <header className="game-header">
        <div>
          <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
            ← Games
          </Link>
          <p className="game-kicker">heyitsbiz</p>
          <h1 className="game-title">Fragpit</h1>
        </div>
        <div className="game-stats">
          <span>
            Room <strong>{snap.roomId}</strong>
          </span>
          {snap.phase === 'playing' ? (
            <span>
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          ) : null}
        </div>
      </header>

      <p className="fp-status">{snap.message}</p>
      {error ? <p className="rm-error">{error}</p> : null}

      <ul className="rm-players">
        {snap.players.map((p) => (
          <li key={p.id} style={{ borderColor: p.color }}>
            <span className="rm-dot" style={{ background: p.color }} />
            {p.name}
            {p.isBot ? ' (bot)' : ''}
            {p.id === snap.hostId ? ' ★' : ''}
            <strong>{p.frags}</strong>
          </li>
        ))}
      </ul>

      {snap.phase === 'lobby' || snap.phase === 'finished' ? (
        <div className="fp-lobby-wait">
          {snap.phase === 'lobby' ? (
            <p>
              Code <strong className="rm-code">{snap.roomId}</strong> — start with 1–3 humans; bots fill
              to 3.
            </p>
          ) : (
            <p>{snap.winnerIds.includes(snap.youId) ? 'You win!' : 'Match over.'}</p>
          )}
          {isHost ? (
            <button
              type="button"
              className="game-btn"
              onClick={() => {
                playSound('click');
                send({ type: 'start' });
              }}
            >
              {snap.phase === 'finished' ? 'Play again' : 'Start match'}
            </button>
          ) : (
            <p className="rm-muted">Waiting for host…</p>
          )}
        </div>
      ) : null}

      {snap.phase === 'playing' ? (
        <div className="fp-stage">
          <canvas
            ref={canvasRef}
            className="fp-canvas"
            tabIndex={0}
            onClick={() => canvasRef.current?.requestPointerLock()}
          />
          <div className="fp-hud">
            <span>HP {you?.health ?? 0}</span>
            <span>{you?.weapon === 'rocket' ? 'ROCKET' : 'RAIL'} (1/2)</span>
            <span>
              Frags {you?.frags ?? 0}/{snap.fragLimit}
            </span>
          </div>
          <div className="fp-feed">
            {snap.killFeed.map((k) => (
              <div key={k.id}>
                {k.killer} ✕ {k.victim}
              </div>
            ))}
          </div>
          <p className="fp-hint">Click canvas for mouse look · WASD · LMB/Space fire · 1/2 weapons</p>
        </div>
      ) : null}

      <footer className="rm-footer-actions">
        <button
          type="button"
          className="game-btn game-btn-ghost"
          onClick={() => {
            send({ type: 'leave' });
            wsRef.current?.close();
            setSnap(null);
          }}
        >
          Leave
        </button>
      </footer>
    </div>
  );
}
