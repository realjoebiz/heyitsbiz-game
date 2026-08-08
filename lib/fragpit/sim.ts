import { castRay, isWall, MAP, moveWithCollision, SPAWNS } from './map';
import {
  FRAG_LIMIT,
  MATCH_SECONDS,
  MAX_HEALTH,
  MOVE_SPEED,
  PLAYER_RADIUS,
  TICK_HZ,
  type EntityPublic,
  type KillFeedItem,
  type PlayerInput,
  type ProjectilePublic,
  type Weapon,
} from './types';

export type PlayerState = {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  yaw: number;
  health: number;
  frags: number;
  alive: boolean;
  weapon: Weapon;
  fireCooldown: number;
  respawnAt: number;
  input: PlayerInput;
  spawnIndex: number;
};

export type Projectile = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

export type MatchState = {
  tick: number;
  timeLeft: number;
  players: PlayerState[];
  projectiles: Projectile[];
  killFeed: KillFeedItem[];
  winnerIds: string[];
  finished: boolean;
  nextProjectileId: number;
  nextKillId: number;
};

const emptyInput = (): PlayerInput => ({
  forward: false,
  back: false,
  left: false,
  right: false,
  fire: false,
  weapon: 'rail',
  yaw: 0,
});

export function createMatch(players: Omit<PlayerState, 'x' | 'y' | 'yaw' | 'health' | 'frags' | 'alive' | 'weapon' | 'fireCooldown' | 'respawnAt' | 'input' | 'spawnIndex'>[]): MatchState {
  const state: MatchState = {
    tick: 0,
    timeLeft: MATCH_SECONDS,
    players: [],
    projectiles: [],
    killFeed: [],
    winnerIds: [],
    finished: false,
    nextProjectileId: 1,
    nextKillId: 1,
  };

  players.forEach((p, i) => {
    const spawn = SPAWNS[i % SPAWNS.length]!;
    state.players.push({
      ...p,
      x: spawn.x,
      y: spawn.y,
      yaw: spawn.yaw,
      health: MAX_HEALTH,
      frags: 0,
      alive: true,
      weapon: 'rail',
      fireCooldown: 0,
      respawnAt: 0,
      input: { ...emptyInput(), yaw: spawn.yaw },
      spawnIndex: i,
    });
  });

  return state;
}

export function setPlayerInput(state: MatchState, id: string, input: PlayerInput) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p || p.isBot) return;
  p.input = {
    forward: !!input.forward,
    back: !!input.back,
    left: !!input.left,
    right: !!input.right,
    fire: !!input.fire,
    weapon: input.weapon === 'rocket' ? 'rocket' : 'rail',
    yaw: Number.isFinite(input.yaw) ? input.yaw : p.yaw,
  };
}

function respawn(state: MatchState, p: PlayerState) {
  const spawn = SPAWNS[p.spawnIndex % SPAWNS.length]!;
  // try a few spawns away from enemies
  let best = spawn;
  let bestDist = -1;
  for (let i = 0; i < SPAWNS.length; i++) {
    const s = SPAWNS[(p.spawnIndex + i) % SPAWNS.length]!;
    let minD = Infinity;
    for (const o of state.players) {
      if (o.id === p.id || !o.alive) continue;
      minD = Math.min(minD, Math.hypot(o.x - s.x, o.y - s.y));
    }
    if (minD > bestDist) {
      bestDist = minD;
      best = s;
    }
  }
  p.x = best.x;
  p.y = best.y;
  p.yaw = best.yaw;
  p.health = MAX_HEALTH;
  p.alive = true;
  p.fireCooldown = 0.3;
  p.input = { ...emptyInput(), yaw: best.yaw };
}

function damage(
  state: MatchState,
  victim: PlayerState,
  amount: number,
  attackerId: string,
  weapon: Weapon
) {
  if (!victim.alive || state.finished) return;
  victim.health -= amount;
  if (victim.health > 0) return;

  victim.alive = false;
  victim.health = 0;
  victim.respawnAt = state.tick + TICK_HZ * 2;
  const killer = state.players.find((p) => p.id === attackerId);
  if (killer && killer.id !== victim.id) {
    killer.frags += 1;
  } else if (killer && killer.id === victim.id) {
    killer.frags = Math.max(0, killer.frags - 1);
  }
  state.killFeed.unshift({
    id: `k${state.nextKillId++}`,
    killer: killer?.name ?? '???',
    victim: victim.name,
    weapon,
    t: state.tick,
  });
  state.killFeed = state.killFeed.slice(0, 6);

  if (killer && killer.frags >= FRAG_LIMIT) {
    state.finished = true;
    state.winnerIds = [killer.id];
  }
}

function tryFire(state: MatchState, p: PlayerState) {
  if (!p.alive || p.fireCooldown > 0 || !p.input.fire) return;
  p.weapon = p.input.weapon;

  if (p.weapon === 'rail') {
    p.fireCooldown = 0.55;
    const range = 18;
    let hitDist = range;
    let hitPlayer: PlayerState | null = null;
    const cos = Math.cos(p.yaw);
    const sin = Math.sin(p.yaw);

    const wall = castRay(p.x, p.y, p.yaw, range);
    hitDist = wall.dist;

    for (const o of state.players) {
      if (o.id === p.id || !o.alive) continue;
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const along = dx * cos + dy * sin;
      if (along < 0.2 || along > hitDist) continue;
      const perp = Math.abs(dx * -sin + dy * cos);
      if (perp < PLAYER_RADIUS + 0.12 && along < hitDist) {
        hitDist = along;
        hitPlayer = o;
      }
    }
    if (hitPlayer) damage(state, hitPlayer, 55, p.id, 'rail');
    return;
  }

  // rocket
  p.fireCooldown = 0.75;
  const speed = 8;
  state.projectiles.push({
    id: `p${state.nextProjectileId++}`,
    ownerId: p.id,
    x: p.x + Math.cos(p.yaw) * 0.45,
    y: p.y + Math.sin(p.yaw) * 0.45,
    vx: Math.cos(p.yaw) * speed,
    vy: Math.sin(p.yaw) * speed,
    life: 2.5,
  });
}

function explode(state: MatchState, x: number, y: number, ownerId: string) {
  const radius = 1.6;
  for (const o of state.players) {
    if (!o.alive) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d > radius) continue;
    const falloff = 1 - d / radius;
    const dmg = Math.round(80 * falloff);
    if (dmg > 0) damage(state, o, dmg, ownerId, 'rocket');
  }
}

export function tickMatch(state: MatchState, botThink: (state: MatchState, bot: PlayerState) => void) {
  if (state.finished) return;

  const dt = 1 / TICK_HZ;
  state.tick += 1;
  state.timeLeft = Math.max(0, state.timeLeft - dt);

  for (const p of state.players) {
    if (p.isBot && p.alive) botThink(state, p);

    if (!p.alive) {
      if (state.tick >= p.respawnAt) respawn(state, p);
      continue;
    }

    p.yaw = p.input.yaw;
    p.weapon = p.input.weapon;
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);

    let mx = 0;
    let my = 0;
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    if (p.input.forward) {
      mx += c;
      my += s;
    }
    if (p.input.back) {
      mx -= c;
      my -= s;
    }
    if (p.input.left) {
      mx += s;
      my -= c;
    }
    if (p.input.right) {
      mx -= s;
      my += c;
    }
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx = (mx / len) * MOVE_SPEED * dt;
      my = (my / len) * MOVE_SPEED * dt;
      const next = moveWithCollision(p.x, p.y, mx, my, PLAYER_RADIUS);
      p.x = next.x;
      p.y = next.y;
    }

    tryFire(state, p);
  }

  // projectiles
  const remain: Projectile[] = [];
  for (const proj of state.projectiles) {
    proj.life -= dt;
    const nx = proj.x + proj.vx * dt;
    const ny = proj.y + proj.vy * dt;
    if (proj.life <= 0) continue;

    if (isWall(nx, ny)) {
      explode(state, proj.x, proj.y, proj.ownerId);
      continue;
    }

    let hit = false;
    for (const o of state.players) {
      if (!o.alive || o.id === proj.ownerId) continue;
      if (Math.hypot(o.x - nx, o.y - ny) < PLAYER_RADIUS + 0.15) {
        explode(state, nx, ny, proj.ownerId);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    proj.x = nx;
    proj.y = ny;
    remain.push(proj);
  }
  state.projectiles = remain;

  if (!state.finished && state.timeLeft <= 0) {
    state.finished = true;
    const max = Math.max(...state.players.map((p) => p.frags), 0);
    state.winnerIds = state.players.filter((p) => p.frags === max).map((p) => p.id);
  }
}

export function toPublicPlayers(state: MatchState): EntityPublic[] {
  return state.players.map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    yaw: p.yaw,
    health: p.health,
    frags: p.frags,
    alive: p.alive,
    color: p.color,
    isBot: p.isBot,
    weapon: p.weapon,
  }));
}

export function toPublicProjectiles(state: MatchState): ProjectilePublic[] {
  return state.projectiles.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
  }));
}

export function getMapGrid() {
  return MAP;
}
