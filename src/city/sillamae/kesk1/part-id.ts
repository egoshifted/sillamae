const helpers = new Set(['partId', 'emit', 'box', 'block', 'edge', 'beam', 'window', 'ring', 'apron', 'plaque']);
const counts = new Map<string, number>();
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let authored: number[] | null = null;

function vlq(segment: string) {
  const fields: number[] = [];
  let value = 0, shift = 0;
  for (let i = 0; i < segment.length; i++) {
    let digit = alphabet.indexOf(segment[i]);
    if (digit < 0) continue;
    const cont = digit & 32;
    digit &= 31;
    value += digit << shift;
    if (cont) { shift += 5; continue; }
    const negative = value & 1;
    value >>= 1;
    fields.push(negative ? -value : value);
    value = 0;
    shift = 0;
  }
  return fields;
}

// Vite serves the model with generated line numbers. The id has to name the authored line.
export function sourceLines(mappings: string) {
  const lines: number[] = [];
  let sourceLine = 0, generated = 0;
  for (const row of mappings.split(';')) {
    generated++;
    if (!row) continue;
    let onRow = 0;
    for (const segment of row.split(',')) {
      const fields = vlq(segment);
      if (fields.length < 3) continue;
      sourceLine += fields[2];
      onRow = sourceLine + 1;
    }
    if (onRow) lines[generated] = onRow;
  }
  return lines;
}

function loadMap(moduleUrl: string) {
  authored = [];
  if (typeof XMLHttpRequest === 'undefined') return;
  const xhr = new XMLHttpRequest();
  xhr.open('GET', moduleUrl, false);
  xhr.send();
  if (xhr.status !== 200) return;
  const marker = 'sourceMappingURL=data:application/json;base64,';
  const at = xhr.responseText.lastIndexOf(marker);
  if (at < 0) return;
  const json = JSON.parse(atob(xhr.responseText.slice(at + marker.length).trim())) as {mappings: string};
  authored = sourceLines(json.mappings);
}

export function partId(moduleUrl: string) {
  if (!authored) loadMap(moduleUrl);
  const frames = (new Error().stack ?? '').split('\n');
  let site = 'kesk1/model.ts';
  for (const frame of frames) {
    const hit = /\/src\/(.+?\.ts)(?:\?[^:)]*)?:(\d+):\d+/.exec(frame);
    if (!hit || !hit[1].endsWith('kesk1/model.ts')) continue;
    const name = /at\s+(?:[\w.]+\.)?(\w+)\s*\(/.exec(frame)?.[1] ?? /(\w+)@/.exec(frame)?.[1] ?? '';
    if (!name || helpers.has(name)) continue;
    const line = authored?.[Number(hit[2])] ?? Number(hit[2]);
    site = `src/${hit[1]}:${line}`;
    break;
  }
  const n = (counts.get(site) ?? 0) + 1;
  counts.set(site, n);
  return n === 1 ? site : `${site}#${n}`;
}
