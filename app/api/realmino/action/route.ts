import { act, type Action } from '@/lib/realmino/rooms';
import type { Rotation } from '@/lib/realmino/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: {
    roomId?: string;
    token?: string;
    action?: Action['type'];
    tileNumber?: number;
    x?: number;
    y?: number;
    rotation?: Rotation;
  } = {};

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const roomId = (body.roomId || '').trim().toUpperCase();
  const token = body.token || '';
  if (!roomId || !token || !body.action) {
    return Response.json({ error: 'Missing roomId, token, or action.' }, { status: 400 });
  }

  let action: Action;
  switch (body.action) {
    case 'start':
      action = { type: 'start' };
      break;
    case 'draft':
      if (typeof body.tileNumber !== 'number') {
        return Response.json({ error: 'tileNumber required.' }, { status: 400 });
      }
      action = { type: 'draft', tileNumber: body.tileNumber };
      break;
    case 'place':
      if (
        typeof body.x !== 'number' ||
        typeof body.y !== 'number' ||
        typeof body.rotation !== 'number'
      ) {
        return Response.json({ error: 'x, y, rotation required.' }, { status: 400 });
      }
      action = {
        type: 'place',
        x: body.x,
        y: body.y,
        rotation: body.rotation as Rotation,
      };
      break;
    case 'discard':
      action = { type: 'discard' };
      break;
    case 'leave':
      action = { type: 'leave' };
      break;
    default:
      return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const result = act(roomId, token, action);
  if ('error' in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
