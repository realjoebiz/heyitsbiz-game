import { createRoom, pruneRooms } from '@/lib/realmino/rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  pruneRooms();
  let name = 'Host';
  try {
    const body = (await req.json()) as { name?: string };
    if (body.name) name = body.name;
  } catch {
    /* empty body ok */
  }
  const { room, token } = createRoom(name);
  return Response.json({ room, token });
}
