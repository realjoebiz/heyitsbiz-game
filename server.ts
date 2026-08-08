import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { attachClient, pruneRooms } from './lib/fragpit/rooms';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '');
    if (pathname === '/api/fragpit/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const client = {
      send: (data: string) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      close: () => ws.close(),
    };
    const session = attachClient(client);
    ws.on('message', (buf) => session.onMessage(Buffer.isBuffer(buf) ? buf.toString() : String(buf)));
    ws.on('close', () => session.onClose());
    ws.on('error', () => session.onClose());
  });

  setInterval(pruneRooms, 60_000);

  server.listen(port, () => {
    console.log(`> Fragpit-ready on http://${hostname}:${port}`);
  });
});
