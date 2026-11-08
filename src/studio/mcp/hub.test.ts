import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createMcpHub} from './hub.ts';
import {acceptWebSocket} from './socket.ts';

test('a second model is refused until the first disconnects, and a missing tab reports disconnected', async () => {
  const hub = createMcpHub();
  const sent: {kind?: string; id?: number}[] = [];
  const tab = hub.attach({send: message => sent.push(message as {kind?: string; id?: number})});
  const first = await hub.http('POST', undefined, {jsonrpc: '2.0', id: 1, method: 'initialize', params: {clientInfo: {name: 'cursor'}}});
  assert.equal(first.status, 200);
  assert.equal((first.body as {result: {serverInfo: {name: string}}}).result.serverInfo.name, 'sillamae-studio', 'the server keeps its own name, not the client\'s');
  const id = first.headers['mcp-session-id'];
  assert.equal(sent.at(-1)?.kind, 'client');
  const second = await hub.http('POST', undefined, {jsonrpc: '2.0', id: 2, method: 'initialize', params: {}});
  assert.equal(second.status, 409);

  const pending = hub.http('POST', id, {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'look', arguments: {}}});
  const call = sent.find(message => message.kind === 'call');
  assert.ok(call?.id);
  tab.message({kind: 'reply', id: call.id, result: {content: [{type: 'text', text: '{}'}]}});
  const answered = await pending;
  assert.equal(answered.status, 200);

  tab.close();
  const missed = await hub.http('POST', id, {jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'look'}});
  const body = missed.body as {result: {content: {text: string}[]}};
  assert.equal(JSON.parse(body.result.content[0].text).error, 'disconnected');

  await hub.http('DELETE', id, undefined);
  const again = await hub.http('POST', undefined, {jsonrpc: '2.0', id: 5, method: 'initialize', params: {}});
  assert.equal(again.status, 200);
});

test('the studio socket receives a text frame', async () => {
  const server = createServer();
  const messages: unknown[] = [];
  server.on('upgrade', (request, socket, head) => {
    acceptWebSocket(request, socket, head, {message: value => messages.push(value), close() {}});
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const socket = new WebSocket('ws://127.0.0.1:' + address.port + '/__studio/mcp/session');
  await new Promise<void>((resolve, reject) => { socket.addEventListener('open', () => resolve()); socket.addEventListener('error', () => reject(Error('socket failed'))); });
  socket.send(JSON.stringify({kind: 'hello'}));
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(messages, [{kind: 'hello'}]);
  socket.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
