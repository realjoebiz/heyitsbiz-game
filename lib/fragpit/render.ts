import { castRay } from './map';
import type { EntityPublic, ProjectilePublic } from './types';

const FOV = Math.PI / 3;

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  you: EntityPublic,
  players: EntityPublic[],
  projectiles: ProjectilePublic[],
  map: number[][]
) {
  // sky / floor
  const sky = ctx.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, '#1a1030');
  sky.addColorStop(1, '#2a1848');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h / 2);
  const floor = ctx.createLinearGradient(0, h / 2, 0, h);
  floor.addColorStop(0, '#2a2218');
  floor.addColorStop(1, '#12100c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, w, h / 2);

  const zBuffer = new Float32Array(w);

  for (let col = 0; col < w; col++) {
    const cameraX = (2 * col) / w - 1;
    const rayAngle = you.yaw + Math.atan(cameraX * Math.tan(FOV / 2));
    const hit = castRay(you.x, you.y, rayAngle);
    const dist = hit.dist * Math.cos(rayAngle - you.yaw);
    zBuffer[col] = dist;
    const lineH = Math.min(h, Math.floor(h / Math.max(0.08, dist)));
    const y0 = Math.floor((h - lineH) / 2);
    const shade = hit.side === 1 ? 0.72 : 1;
    const base = 90 + Math.floor(80 / (1 + dist * 0.35));
    ctx.fillStyle = `rgb(${Math.floor(base * shade)}, ${Math.floor(base * 0.55 * shade)}, ${Math.floor(base * 0.35 * shade)})`;
    ctx.fillRect(col, y0, 1, lineH);
  }

  // billboard entities
  type Sprite = { x: number; y: number; dist: number; color: string; label: string; kind: 'p' | 'r' };
  const sprites: Sprite[] = [];

  for (const p of players) {
    if (p.id === you.id || !p.alive) continue;
    const dx = p.x - you.x;
    const dy = p.y - you.y;
    sprites.push({
      x: p.x,
      y: p.y,
      dist: Math.hypot(dx, dy),
      color: p.color,
      label: p.name,
      kind: 'p',
    });
  }
  for (const r of projectiles) {
    sprites.push({
      x: r.x,
      y: r.y,
      dist: Math.hypot(r.x - you.x, r.y - you.y),
      color: '#ffcc44',
      label: '',
      kind: 'r',
    });
  }

  sprites.sort((a, b) => b.dist - a.dist);

  for (const sp of sprites) {
    const dx = sp.x - you.x;
    const dy = sp.y - you.y;
    const dist = sp.dist;
    if (dist < 0.15) continue;

    const angle = Math.atan2(dy, dx) - you.yaw;
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) > FOV) continue;

    const screenX = Math.floor((0.5 + a / FOV) * w);
    const size =
      sp.kind === 'r'
        ? Math.min(h * 0.2, Math.floor(h / (dist + 0.1) * 0.25))
        : Math.min(h * 0.85, Math.floor(h / (dist + 0.1) * 0.7));
    const half = Math.floor(size / 2);
    const top = Math.floor(h / 2 - size * (sp.kind === 'r' ? 0.15 : 0.35));

    // occlusion sample
    const mid = Math.max(0, Math.min(w - 1, screenX));
    if (zBuffer[mid]! < dist - 0.1) continue;

    ctx.fillStyle = sp.color;
    if (sp.kind === 'r') {
      ctx.beginPath();
      ctx.arc(screenX, top + half * 0.3, Math.max(2, half * 0.35), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(screenX - half * 0.35, top, half * 0.7, size * 0.7);
      ctx.fillStyle = '#111';
      ctx.fillRect(screenX - half * 0.15, top + size * 0.1, half * 0.3, size * 0.15);
      if (sp.label) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sp.label, screenX, top - 4);
      }
    }
  }

  // minimap
  const cell = 4;
  const mw = map[0]?.length ?? 0;
  const mh = map.length;
  const ox = 8;
  const oy = 8;
  ctx.globalAlpha = 0.75;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      ctx.fillStyle = map[y]![x] === 1 ? '#555' : '#222';
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
    }
  }
  for (const p of players) {
    if (!p.alive) continue;
    ctx.fillStyle = p.id === you.id ? '#fff' : p.color;
    ctx.fillRect(ox + p.x * cell - 1.5, oy + p.y * cell - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;

  // crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, h / 2);
  ctx.lineTo(w / 2 + 8, h / 2);
  ctx.moveTo(w / 2, h / 2 - 8);
  ctx.lineTo(w / 2, h / 2 + 8);
  ctx.stroke();
}
