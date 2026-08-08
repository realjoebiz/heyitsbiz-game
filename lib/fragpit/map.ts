/** 0 = empty, 1 = wall. 16×16 arena with pillars and side corridors. */
export const MAP: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const MAP_W = MAP[0]!.length;
export const MAP_H = MAP.length;

export const SPAWNS: { x: number; y: number; yaw: number }[] = [
  { x: 2.5, y: 2.5, yaw: 0 },
  { x: 13.5, y: 2.5, yaw: Math.PI },
  { x: 2.5, y: 13.5, yaw: 0 },
  { x: 13.5, y: 13.5, yaw: Math.PI },
  { x: 8, y: 3.5, yaw: Math.PI / 2 },
  { x: 8, y: 12.5, yaw: -Math.PI / 2 },
];

export function isWall(x: number, y: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return true;
  return MAP[iy]![ix] === 1;
}

/** Circle vs grid walls (axis-separated slide). */
export function moveWithCollision(
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number
): { x: number; y: number } {
  let nx = x + dx;
  let ny = y;
  if (circleHitsWall(nx, ny, radius)) nx = x;
  ny = y + dy;
  if (circleHitsWall(nx, ny, radius)) ny = y;
  // corner case: both axes blocked
  if (circleHitsWall(nx, ny, radius)) return { x, y };
  return { x: nx, y: ny };
}

function circleHitsWall(x: number, y: number, r: number): boolean {
  const minX = Math.floor(x - r);
  const maxX = Math.floor(x + r);
  const minY = Math.floor(y - r);
  const maxY = Math.floor(y + r);
  for (let iy = minY; iy <= maxY; iy++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const solid = ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H || MAP[iy]![ix] === 1;
      if (!solid) continue;
      const closestX = Math.max(ix, Math.min(x, ix + 1));
      const closestY = Math.max(iy, Math.min(y, iy + 1));
      const ddx = x - closestX;
      const ddy = y - closestY;
      if (ddx * ddx + ddy * ddy < r * r) return true;
    }
  }
  return false;
}

/** DDA raycast until wall. Returns distance and hit side. */
export function castRay(
  ox: number,
  oy: number,
  angle: number,
  maxDist = 24
): { dist: number; side: 0 | 1; hitX: number; hitY: number } {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let mapX = Math.floor(ox);
  let mapY = Math.floor(oy);

  const deltaDistX = Math.abs(1 / (dirX || 1e-10));
  const deltaDistY = Math.abs(1 / (dirY || 1e-10));

  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;

  let sideDistX = dirX < 0 ? (ox - mapX) * deltaDistX : (mapX + 1 - ox) * deltaDistX;
  let sideDistY = dirY < 0 ? (oy - mapY) * deltaDistY : (mapY + 1 - oy) * deltaDistY;

  let side: 0 | 1 = 0;
  let dist = 0;

  for (let i = 0; i < 64; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
      dist = (mapX - ox + (1 - stepX) / 2) / (dirX || 1e-10);
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
      dist = (mapY - oy + (1 - stepY) / 2) / (dirY || 1e-10);
    }
    if (dist > maxDist) return { dist: maxDist, side, hitX: ox + dirX * maxDist, hitY: oy + dirY * maxDist };
    if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H || MAP[mapY]![mapX] === 1) {
      return { dist: Math.max(0.01, dist), side, hitX: ox + dirX * dist, hitY: oy + dirY * dist };
    }
  }
  return { dist: maxDist, side: 0, hitX: ox + dirX * maxDist, hitY: oy + dirY * maxDist };
}

export function hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return true;
  const hit = castRay(x0, y0, Math.atan2(dy, dx), dist + 0.05);
  return hit.dist >= dist - 0.15;
}
