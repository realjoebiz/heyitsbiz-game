import { hasLineOfSight } from './map';
import type { MatchState, PlayerState } from './sim';

const BOT_NAMES = ['Scrap', 'Null', 'Hex', 'Glitch', 'Static'];

export function nextBotName(existing: string[]): string {
  for (const n of BOT_NAMES) {
    if (!existing.includes(n)) return n;
  }
  return `Bot${existing.length + 1}`;
}

/** Simple chase / strafe / shoot AI. */
export function botThink(state: MatchState, bot: PlayerState) {
  let target: PlayerState | null = null;
  let best = Infinity;
  for (const o of state.players) {
    if (o.id === bot.id || !o.alive) continue;
    const d = Math.hypot(o.x - bot.x, o.y - bot.y);
    if (d < best) {
      best = d;
      target = o;
    }
  }

  bot.input.forward = false;
  bot.input.back = false;
  bot.input.left = false;
  bot.input.right = false;
  bot.input.fire = false;

  if (!target) {
    bot.input.yaw += 0.04;
    bot.input.forward = true;
    return;
  }

  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const desired = Math.atan2(dy, dx);
  let diff = desired - bot.input.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  bot.input.yaw += Math.max(-0.12, Math.min(0.12, diff));

  const los = hasLineOfSight(bot.x, bot.y, target.x, target.y);
  const dist = best;

  if (dist > 4.5) {
    bot.input.forward = true;
  } else if (dist < 2.2) {
    bot.input.back = true;
  } else {
    // strafe
    if (state.tick % 40 < 20) bot.input.left = true;
    else bot.input.right = true;
    if (state.tick % 17 === 0) bot.input.forward = true;
  }

  bot.input.weapon = dist < 3.5 ? 'rocket' : 'rail';

  if (los && Math.abs(diff) < 0.18) {
    bot.input.fire = true;
  } else if (!los) {
    // wander toward last known — nudge forward
    bot.input.forward = true;
    if (state.tick % 30 === 0) bot.input.yaw += (Math.random() - 0.5) * 0.8;
  }
}
