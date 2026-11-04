import {translate} from '../i18n.ts';
import type {StudioHost} from './host.ts';
import {createSession} from './session.ts';

export interface McpStatus {
  sharing: boolean;
  attached: boolean;
  replaced: boolean;
  reads: string[];
  writes: string[];
}

export function connectStudio(host: StudioHost, onStatus: (status: McpStatus) => void) {
  let session = createSession(host);
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempts = 0;
  let attached = false;
  const snapshot = (extra?: Partial<McpStatus>): McpStatus => {
    const profile = session.profile();
    return {
      sharing: !stopped, attached: !stopped && attached, replaced: false,
      reads: Object.entries(profile.read).filter(([, on]) => on).map(([name]) => name),
      writes: Object.entries(profile.write).filter(([, on]) => on).map(([name]) => name),
      ...extra,
    };
  };
  const open = () => {
    if (stopped) return;
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/__studio/mcp/session');
    socket = ws;
    ws.onopen = () => { attempts = 0; attached = false; ws.send(JSON.stringify({kind: 'hello'})); onStatus(snapshot()); };
    ws.onmessage = event => {
      let message: Record<string, unknown>;
      try { message = JSON.parse(String(event.data)) as Record<string, unknown>; }
      catch { return; }
      if (message.kind === 'client') { attached = !!message.attached; onStatus(snapshot()); return; }
      if (message.kind === 'replaced') { stopped = true; attached = false; ws.close(); onStatus(snapshot({sharing: false, replaced: true})); return; }
      if (message.kind !== 'call' || typeof message.id !== 'number' || typeof message.method !== 'string') return;
      const id = message.id, method = message.method, params = message.params;
      void session.call(method, params).then(result => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({kind: 'reply', id, result}));
        onStatus(snapshot());
      }).catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({kind: 'fail', id, message: text}));
      });
    };
    ws.onclose = () => {
      if (socket !== ws || stopped) return;
      socket = null;
      attached = false;
      attempts += 1;
      onStatus(snapshot());
      if (attempts < 5) window.setTimeout(open, 1000);
      else { stopped = true; onStatus(snapshot({sharing: false, attached: false})); }
    };
  };
  onStatus(snapshot());
  open();
  return {
    disconnect() {
      stopped = true;
      attached = false;
      session.kill();
      socket?.close();
      socket = null;
      onStatus(snapshot({sharing: false, attached: false}));
    },
    connect() {
      stopped = false;
      attempts = 0;
      attached = false;
      session = createSession(host);
      open();
    },
  };
}

export function paintMcp(status: McpStatus, nodes: {status: HTMLElement; channels: HTMLElement; toggle: HTMLElement}) {
  nodes.status.textContent = translate(status.replaced ? 'Another studio tab took the session' : status.attached ? 'Model connected' : status.sharing ? 'Waiting for a model' : 'Studio is not shared');
  nodes.channels.textContent = translate('Reads') + ': ' + status.reads.join(', ') + ' · ' + translate('Writes') + ': ' + status.writes.join(', ');
  nodes.toggle.textContent = translate(status.sharing ? 'Disconnect' : 'Connect');
}
