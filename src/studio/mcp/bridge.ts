import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {createMcpHub} from './hub.ts';
import {acceptWebSocket} from './socket.ts';

const readBody = (request: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let text = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { text += chunk; if (text.length > 1e6) reject(Error('Body too large')); });
  request.on('end', () => resolve(text));
  request.on('error', reject);
});

function send(response: ServerResponse, status: number, headers: Record<string, string>, body: unknown) {
  response.statusCode = status;
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(body == null ? undefined : JSON.stringify(body));
}

// The building studio serves /__studio/mcp and the site editor /__studio/site-mcp, each
// with its own model and tab, so working in one never takes the other's connection.
export function studioMcp(base = '/__studio/mcp', serverName = 'sillamae-studio'): Plugin {
  const hub = createMcpHub(serverName);
  return {
    name: 'studio-mcp' + base.replaceAll('/', '-'),
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.on('upgrade', (request, socket, head) => {
        if ((request.url ?? '').split('?')[0] !== base + '/session') return;
        let slot: {message(value: unknown): void; close(): void} | null = null;
        const link = acceptWebSocket(request, socket, head, {message: value => slot?.message(value), close: () => slot?.close()});
        if (link) slot = hub.attach({send: value => link.send(value)});
      });
      server.middlewares.use(base, (request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        if (path !== '/' && path !== '') { next(); return; }
        void (async () => {
          const raw = request.method === 'POST' ? await readBody(request) : '';
          let body: unknown = undefined;
          if (raw) {
            try { body = JSON.parse(raw); }
            catch { send(response, 400, {'content-type': 'application/json'}, {jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}); return; }
          }
          const session = request.headers['mcp-session-id'];
          const result = await hub.http(request.method ?? 'GET', Array.isArray(session) ? session[0] : session, body);
          send(response, result.status, result.headers, result.body);
        })().catch(error => send(response, 500, {'content-type': 'application/json'}, {jsonrpc: '2.0', id: null, error: {code: -32603, message: error instanceof Error ? error.message : String(error)}}));
      });
    },
  };
}
