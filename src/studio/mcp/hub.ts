import {randomUUID} from 'node:crypto';

interface Rpc {id?: unknown; method?: string; params?: unknown}

// One model and one editor tab at a time; name is what the client sees as the server.
export function createMcpHub(serverName = 'sillamae-studio') {
  let tab: {send(message: unknown): void} | null = null;
  let client: {id: string; name: string; seen: number} | null = null;
  let seq = 0;
  const pending = new Map<number, {done(value: unknown): void; fail(error: Error): void}>();

  function failPending() {
    for (const [id, wait] of pending) { pending.delete(id); wait.fail(Error('disconnected')); }
  }
  function settle(id: number, run: (wait: {done(value: unknown): void; fail(error: Error): void}) => void) {
    const wait = pending.get(id);
    if (!wait) return;
    pending.delete(id);
    run(wait);
  }
  function ask(method: string, params: unknown) {
    const link = tab;
    if (!link) return Promise.reject(Error('disconnected'));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => settle(id, wait => wait.fail(Error('disconnected'))), 20000);
      pending.set(id, {
        done(value) { clearTimeout(timer); resolve(value); },
        fail(error) { clearTimeout(timer); reject(error); },
      });
      link.send({kind: 'call', id, method, params});
    });
  }
  const json = (id: unknown, payload: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) => ({status, headers: {'content-type': 'application/json', ...headers}, body: {jsonrpc: '2.0', id, ...payload}});

  return {
    attach(link: {send(message: unknown): void}) {
      if (tab && tab !== link) tab.send({kind: 'replaced'});
      tab = link;
      if (client) link.send({kind: 'client', attached: true, name: client.name});
      return {
        message(value: unknown) {
          if (!value || typeof value !== 'object') return;
          const message = value as {kind?: string; id?: unknown; result?: unknown; message?: string};
          if (typeof message.id !== 'number') return;
          if (message.kind === 'reply') settle(message.id, wait => wait.done(message.result));
          if (message.kind === 'fail') settle(message.id, wait => wait.fail(Error(typeof message.message === 'string' ? message.message : 'disconnected')));
        },
        close() { if (tab !== link) return; tab = null; failPending(); },
      };
    },
    async http(method: string, session: string | undefined, body: unknown, now = Date.now()): Promise<{status: number; headers: Record<string, string>; body: unknown}> {
      if (method === 'DELETE') {
        if (client && session === client.id) { client = null; tab?.send({kind: 'client', attached: false}); }
        return {status: 204, headers: {} as Record<string, string>, body: null};
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(null, {error: {code: -32600, message: 'Invalid request'}}, 400);
      const rpc = body as Rpc;
      if (rpc.id === undefined) return {status: 202, headers: {} as Record<string, string>, body: null};
      if (rpc.method === 'initialize') {
        if (client && now - client.seen < 30000 && session !== client.id) return json(rpc.id, {error: {code: -32000, message: 'A model is already connected'}}, 409);
        const info = rpc.params && typeof rpc.params === 'object' && 'clientInfo' in rpc.params ? (rpc.params as {clientInfo?: {name?: unknown}}).clientInfo : undefined;
        const name = typeof info?.name === 'string' ? info.name : 'model';
        if (!client || session !== client.id) client = {id: randomUUID(), name, seen: now};
        else { client.name = name; client.seen = now; }
        tab?.send({kind: 'client', attached: true, name: client.name});
        return json(rpc.id, {result: {protocolVersion: '2024-11-05', capabilities: {tools: {listChanged: true}}, serverInfo: {name: serverName, version: '1'}}}, 200, {'mcp-session-id': client.id});
      }
      if (!client || session !== client.id) return json(rpc.id, {error: {code: -32001, message: 'No model session'}});
      client.seen = now;
      if (rpc.method !== 'tools/list' && rpc.method !== 'tools/call') return json(rpc.id, {error: {code: -32601, message: 'Method not found'}});
      try {
        const result = await ask(rpc.method, rpc.params);
        return json(rpc.id, {result});
      } catch (error) {
        const message = error instanceof Error && error.message !== 'disconnected' ? error.message : 'disconnected';
        if (rpc.method === 'tools/list') return json(rpc.id, {error: {code: -32002, message: 'disconnected'}});
        return json(rpc.id, {result: {content: [{type: 'text', text: JSON.stringify({error: message})}], isError: true}});
      }
    },
  };
}
