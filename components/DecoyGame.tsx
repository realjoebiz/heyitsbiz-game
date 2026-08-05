'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DecoyShape } from '@/components/DecoyShape';
import {
  COLOUR_HEX,
  checkAnswer,
  newDecoyRound,
  type DecoyQuestion,
  type DecoySquare,
} from '@/lib/decoy';
import { playSound, playTick } from '@/lib/sounds';

const MEMORIZE_MS = 8000;
const ANSWER_MS = 15000;

type Phase = 'memorize' | 'answer' | 'won' | 'lost';

function SquareCard({
  square,
  showMemorize,
}: {
  square: DecoySquare;
  showMemorize: boolean;
}) {
  const bg = showMemorize ? '#6b6b78' : COLOUR_HEX[square.background_colour];

  return (
    <div className="decoy-square" style={{ background: bg }}>
      <div className={`decoy-layer decoy-memorize ${showMemorize ? 'is-visible' : 'is-gone'}`}>
        <span className="decoy-real">{square.real_number}</span>
      </div>

      <div className={`decoy-layer decoy-reveal ${showMemorize ? 'is-gone' : 'is-visible'}`}>
        <div className="decoy-large">
          <DecoyShape shape={square.large_shape} colour={square.large_shape_colour} size={96} />
        </div>

        <div className="decoy-stack">
          <span
            className="decoy-text-colour"
            style={{
              color: COLOUR_HEX[square.text_colour],
              background: COLOUR_HEX[square.text_colour_background_colour],
            }}
          >
            {square.text_colour.toUpperCase()}
          </span>

          <DecoyShape shape={square.inner_shape} colour={square.inner_shape_colour} size={42} />

          <span className="decoy-text-shape" style={{ color: COLOUR_HEX[square.text_shape_colour] }}>
            {square.text_shape.toUpperCase()}
          </span>
        </div>

        <span className="decoy-decoy-num" style={{ color: COLOUR_HEX[square.decoy_number_colour] }}>
          {square.decoy_number}
        </span>
      </div>
    </div>
  );
}

export function DecoyGame() {
  const [squares, setSquares] = useState<DecoySquare[]>([]);
  const [question, setQuestion] = useState<DecoyQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [answerMsLeft, setAnswerMsLeft] = useState(ANSWER_MS);
  const [memorizeSec, setMemorizeSec] = useState(8);
  const [input, setInput] = useState('');
  const [seed, setSeed] = useState(0);
  const startedAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRound = useCallback(() => {
    const round = newDecoyRound();
    setSquares(round.squares);
    setQuestion(round.question);
    setPhase('memorize');
    setAnswerMsLeft(ANSWER_MS);
    setMemorizeSec(8);
    setInput('');
    setSeed((s) => s + 1);
    startedAt.current = performance.now();
    playSound('click');
  }, []);

  useEffect(() => {
    startRound();
  }, [startRound]);

  // Memorize countdown display + transition
  useEffect(() => {
    if (phase !== 'memorize' || !question) return;
    const t = window.setTimeout(() => {
      setPhase('answer');
      startedAt.current = performance.now();
      setAnswerMsLeft(ANSWER_MS);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }, MEMORIZE_MS);

    const tick = window.setInterval(() => {
      const left = Math.max(0, MEMORIZE_MS - (performance.now() - startedAt.current));
      setMemorizeSec(Math.ceil(left / 1000));
    }, 100);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(tick);
    };
  }, [phase, question, seed]);

  // Answer countdown + tick
  useEffect(() => {
    if (phase !== 'answer') return;
    let raf = 0;
    let lastTickSec = -1;

    const loop = () => {
      const elapsed = performance.now() - startedAt.current;
      const left = Math.max(0, ANSWER_MS - elapsed);
      setAnswerMsLeft(left);

      const sec = Math.ceil(left / 1000);
      if (sec !== lastTickSec && left > 0) {
        lastTickSec = sec;
        playTick();
      }

      if (left <= 0) {
        setPhase('lost');
        playSound('error');
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, seed]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (phase !== 'answer' || !question) return;
    if (checkAnswer(input, question.expected)) {
      setPhase('won');
      playSound('win');
    } else {
      setPhase('lost');
      playSound('error');
    }
  };

  const barPct = Math.max(0, (answerMsLeft / ANSWER_MS) * 100);

  return (
    <div className="decoy-shell">
      <header className="decoy-header">
        <div>
          <Link href="/" className="decoy-back" onClick={() => playSound('click')}>
            ← Games
          </Link>
          <p className="game-kicker">heyitsbiz</p>
          <h1 className="game-title">Decoy</h1>
        </div>
        <button type="button" className="game-btn" onClick={startRound}>
          New game
        </button>
      </header>

      <p className="decoy-instruction">
        {phase === 'memorize'
          ? `Memorise each square’s real number — ${memorizeSec}s`
          : phase === 'answer'
            ? question?.prompt
            : phase === 'won'
              ? `Correct — ${question?.expected}`
              : `Time’s up / wrong — answer was ${question?.expected}`}
      </p>

      {(phase === 'answer' || phase === 'won' || phase === 'lost') && (
        <div className="decoy-timer-track" aria-hidden>
          <div
            className={`decoy-timer-bar ${phase === 'answer' ? 'is-ticking' : ''}`}
            style={{ width: `${phase === 'answer' ? barPct : 0}%` }}
          />
        </div>
      )}

      <div className="decoy-row">
        {squares.map((sq) => (
          <SquareCard
            key={`${seed}-${sq.real_number}`}
            square={sq}
            showMemorize={phase === 'memorize'}
          />
        ))}
      </div>

      {phase === 'answer' ? (
        <form className="decoy-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="decoy-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. CIRCLE GREEN"
            autoComplete="off"
            spellCheck={false}
            aria-label="Your answer"
          />
          <button type="submit" className="game-btn decoy-submit">
            Enter
          </button>
        </form>
      ) : null}

      {phase === 'won' || phase === 'lost' ? (
        <p className={`game-banner ${phase === 'won' ? 'game-banner-win' : 'game-banner-over'}`}>
          {phase === 'won' ? 'You got it' : 'Missed it'} —{' '}
          <button type="button" className="decoy-inline-btn" onClick={startRound}>
            play again
          </button>
        </p>
      ) : null}

      <p className="game-hint decoy-hint">
        First 8s: only the real number. Then decoys flood in. Answer with two words (or a number),
        space-separated.
      </p>
    </div>
  );
}
