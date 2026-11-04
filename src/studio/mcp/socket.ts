import {createHash} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import type {Duplex} from 'node:stream';

export interface SocketLink {send(value: unknown): void; close(): void}

function readFrame(buffer: Buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = buffer.readUInt32BE(6);
    offset = 10;
  }
  if (buffer.length < offset + (masked ? 4 : 0) + length) return null;
  const raw = buffer.subarray(offset + (masked ? 4 : 0), offset + (masked ? 4 : 0) + length);
  const payload = Buffer.from(raw);
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  }
  return {opcode, payload, bytes: offset + (masked ? 4 : 0) + length};
}

function writeFrame(socket: Duplex, opcode: number, payload: Buffer) {
  const head = payload.length < 126 ? Buffer.from([0x80 | opcode, payload.length]) : payload.length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  if (payload.length >= 126 && payload.length < 65536) { head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(payload.length, 2); }
  if (payload.length >= 65536) { head[0] = 0x80 | opcode; head[1] = 127; head.writeUInt32BE(payload.length, 6); }
  socket.write(head);
  socket.write(payload);
}

export function acceptWebSocket(request: IncomingMessage, socket: Duplex, head: Buffer, handlers: {message(value: unknown): void; close(): void}): SocketLink | null {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string' || request.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  if (head.length) socket.unshift(head);
  let buffer = Buffer.alloc(0);
  let closed = false;
  const finish = () => { if (closed) return; closed = true; handlers.close(); };
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const frame = readFrame(buffer);
      if (!frame) return;
      buffer = buffer.subarray(frame.bytes);
      if (frame.opcode === 8) { socket.end(); return; }
      if (frame.opcode === 9) { writeFrame(socket, 0xA, frame.payload); continue; }
      if (frame.opcode !== 1) continue;
      try { handlers.message(JSON.parse(frame.payload.toString('utf8'))); }
      catch { /* A broken frame is ignored; the next call still has the tab. */ }
    }
  });
  socket.on('close', finish);
  socket.on('end', finish);
  socket.on('error', finish);
  return {
    send(value) { if (socket.writable) writeFrame(socket, 1, Buffer.from(JSON.stringify(value))); },
    close() { socket.end(); },
  };
}
