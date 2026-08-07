import { getSnapshot, realminoBus, setConnected } from '@/lib/realmino/rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = (url.searchParams.get('roomId') || '').trim().toUpperCase();
  const token = url.searchParams.get('token') || '';

  if (!roomId || !token) {
    return Response.json({ error: 'roomId and token required.' }, { status: 400 });
  }

  const initial = getSnapshot(roomId, token);
  if (!initial?.you) {
    return Response.json({ error: 'Room not found or bad token.' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const eventName = `room:${roomId}`;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | undefined;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };

      const pushState = () => {
        const snap = getSnapshot(roomId, token);
        if (!snap) {
          send('gone', { ok: false });
          cleanup();
          return;
        }
        send('state', snap);
      };

      const onUpdate = () => pushState();

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        realminoBus.off(eventName, onUpdate);
        setConnected(roomId, token, false);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      setConnected(roomId, token, true);
      send('ready', { ok: true });
      pushState();
      realminoBus.on(eventName, onUpdate);

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, 12_000);

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
