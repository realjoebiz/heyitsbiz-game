import { joinRoom, pruneRooms } from '@/lib/realmino/rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  pruneRooms();
  let body: { roomId?: string; name?: string } = {};
  try {
    body = (await req.json()) as { roomId?: string; name?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const roomId = (body.roomId || '').trim().toUpperCase();
  if (!roomId) return Response.json({ error: 'Room code required.' }, { status: 400 });

  const result = joinRoom(roomId, body.name || 'Player');
  if ('error' in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
