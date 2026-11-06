import fs from 'node:fs';
import zlib from 'node:zlib';
import {loadDtm} from './dtm.ts';
import {georeference, type OsmExtract} from './geo.ts';
import {sillamae} from '../src/city/sillamae/index.ts';
import type {SceneData} from '../src/engine/types.ts';

// Lakes traced from the land board's orthophoto, 1 m a pixel in EPSG:3301. Open water is its
// darkest ground, but so are shadows and forest, which the terrain model tells apart: it
// flattens water, so a real body is level across almost all of its area.
const WMS = 'https://kaart.maaamet.ee/wms/fotokaart', BOX = {west: 712600, east: 714700, south: 6588800, north: 6590800};
const DARK = [42, 48, 70], MIN_BODY = 3000, MIN_LAKE = 30000, MIN_HOLE = 200, BRIDGE = 5, LEVEL_SPREAD = .12, ABOVE_LEVEL = .7; // square metres, metres
const SHEEN_LEVEL = .7, SHEEN_BRIGHT = 240; // metres; summed brightness
// Pixels, summed brightness range: tree shadow is mottled, open water is not. The service's palette
// steps flat water by over 30, so the limit sits above that.
const SMOOTH = 7, FLAT_PHOTO = 45;
// Water the trace cannot see, local metres: the Kesk outflow foams white and the highway intake
// tower's roof is bright. An outflow is drawn out northwards by stretch, up to the pond. Only low
// ground is carved: the dam beside each must stand.
const CARVED: {at: [number, number]; level: number; radius: number; stretch: number}[] = [{at: [-714.3, -312.2], level: 5.12, radius: 8, stretch: 3}, {at: [-327.3, 587.5], level: 14.1, radius: 19, stretch: 1}];

function decodePng(bytes: Buffer) {
  let at = 8, width = 0, height = 0, type = 0, palette: Buffer | null = null;
  const data: Buffer[] = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString('latin1', at + 4, at + 8), body = bytes.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || body[12] || ![2, 3, 6].includes(type)) throw new Error(`Unsupported PNG: depth ${body[8]}, colour ${type}, interlace ${body[12]}`);
    }
    if (kind === 'PLTE') palette = body;
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const channels = type === 6 ? 4 : type === 3 ? 1 : 3, raw = zlib.inflateSync(Buffer.concat(data)), stride = width * channels, out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], from = y * (stride + 1) + 1, to = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[to + x - channels] : 0, b = y ? out[to + x - stride] : 0, c = y && x >= channels ? out[to + x - stride - channels] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[to + x] = raw[from + x] + predicted;
    }
  }
  if (type !== 3) return {width, height, channels, pixels: out};
  const rgb = Buffer.alloc(width * height * 3);
  for (let k = 0; k < width * height; k++) palette!.copy(rgb, k * 3, out[k] * 3, out[k] * 3 + 3);
  return {width, height, channels: 3, pixels: rgb};
}

function regions(mask: Uint8Array, width: number, visit: (cells: number[]) => void) {
  const seen = new Uint8Array(mask.length), stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || !mask[start]) continue;
    const cells: number[] = [];
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const k = stack.pop()!, i = k % width;
      cells.push(k);
      for (const n of [i > 0 ? k - 1 : -1, i + 1 < width ? k + 1 : -1, k - width, k + width])
        if (n >= 0 && n < mask.length && mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
    visit(cells);
  }
}

function grow(mask: Uint8Array, width: number, height: number, by: number) {
  const out = mask.slice();
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    if (!mask[j * width + i]) continue;
    for (let b = Math.max(0, j - by); b <= Math.min(height - 1, j + by); b++) for (let a = Math.max(0, i - by); a <= Math.min(width - 1, i + by); a++)
      if ((a - i) ** 2 + (b - j) ** 2 <= by * by) out[b * width + a] = 1;
  }
  return out;
}

const size = {width: BOX.east - BOX.west, height: BOX.north - BOX.south};
const url = `${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=EESTIFOTO&STYLES=&SRS=EPSG:3301&BBOX=${BOX.west},${BOX.south},${BOX.east},${BOX.north}&WIDTH=${size.width}&HEIGHT=${size.height}&FORMAT=image/png`;
const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
const {width, height, channels, pixels} = decodePng(Buffer.from(await response.arrayBuffer()));
if (width !== size.width || height !== size.height) throw new Error(`Orthophoto is ${width}x${height}, expected ${size.width}x${size.height}`);

const scene: SceneData = JSON.parse(fs.readFileSync('data/source/scene.json', 'utf8'));
const osm: OsmExtract = JSON.parse(fs.readFileSync('data/source/osm.json', 'utf8'));
const georef = georeference(osm, scene, sillamae), m = georef.geo.toGrid, terrain = loadDtm(m), det = m[0] * m[4] - m[1] * m[3];
const heightAt = (k: number) => {
  const a = BOX.west + k % width + .5 - m[2], b = BOX.north - Math.floor(k / width) - .5 - m[5];
  return terrain((m[4] * a - m[1] * b) / det, (m[0] * b - m[3] * a) / det);
};

const dark = new Uint8Array(width * height);
for (let k = 0; k < dark.length; k++) {
  const r = pixels[k * channels], g = pixels[k * channels + 1], b = pixels[k * channels + 2];
  dark[k] = r < DARK[0] && g < DARK[1] && b < DARK[2] && b >= r - 2 ? 1 : 0;
}
const flat: {cells: number[]; level: number}[] = [];
regions(dark, width, cells => {
  if (cells.length < MIN_BODY) return;
  const heights = cells.flatMap(k => heightAt(k) ?? []).sort((a, b) => a - b), level = heights[heights.length >> 1];
  if (heights.length && level - heights[heights.length >> 4] < LEVEL_SPREAD) flat.push({cells, level});
});

const brightness = (k: number) => pixels[k * channels] + pixels[k * channels + 1] + pixels[k * channels + 2];
const smooth = (k: number) => {
  const i = k % width, j = Math.floor(k / width);
  if (i < SMOOTH || j < SMOOTH || i >= width - SMOOTH || j >= height - SMOOTH) return false;
  let low = Infinity, high = -Infinity;
  for (let b = -SMOOTH; b <= SMOOTH; b += 2) for (let a = -SMOOTH; a <= SMOOTH; a += 2) { const v = brightness(k + b * width + a); low = Math.min(low, v); high = Math.max(high, v); }
  return high - low < FLAT_PHOTO;
};

// A footbridge splits a lake into two parts at one level: joined, it runs on beneath the deck.
const levels: number[] = [];
for (const body of flat) if (!levels.some(l => Math.abs(l - body.level) < LEVEL_SPREAD)) levels.push(body.level);
const bodies = new Uint8Array(width * height), list: {level: number; area: number; replacesSurvey: boolean}[] = [];
for (const level of levels) {
  const own = new Uint8Array(width * height);
  // Forest shadow joins the lake in the photo, but stands metres above its surface. Where the
  // terrain model is high and the photo is smooth, the terrain model is wrong: it has a ridge in the south lake.
  for (const body of flat) if (Math.abs(body.level - level) < LEVEL_SPREAD) for (const k of body.cells) if ((heightAt(k) ?? level) < level + ABOVE_LEVEL || smooth(k)) own[k] = 1;
  // Sun sheen lifts open water past DARK. Flat ground that is smooth and blue beside the lake is still lake.
  const sheen = new Uint8Array(width * height);
  for (let k = 0; k < sheen.length; k++) {
    if (own[k]) { sheen[k] = 1; continue; }
    const h = heightAt(k), g = pixels[k * channels + 1], b = pixels[k * channels + 2];
    if (h !== null && Math.abs(h - level) < SHEEN_LEVEL && b >= g && brightness(k) < SHEEN_BRIGHT && smooth(k)) sheen[k] = 1;
  }
  regions(sheen, width, cells => {
    if (cells.some(k => own[k])) for (const k of cells) own[k] = 1;
  });
  const joined = grow(own, width, height, BRIDGE), holes = joined.map(v => 1 - v);
  regions(holes, width, cells => {
    if (cells.length < MIN_HOLE) for (const k of cells) joined[k] = 1;
  });
  // Shrinks back to the traced edge, leaving only what the gap closing added.
  const outside = joined.map(v => 1 - v), margin = grow(outside, width, height, BRIDGE);
  let area = 0;
  for (let k = 0; k < joined.length; k++) if (own[k] || (joined[k] && !margin[k])) { bodies[k] = list.length + 1; area++; }
  // Under a tree canopy the photo sees less water than there is, so only open lakes overrule the survey.
  list.push({level, area, replacesSurvey: area >= MIN_LAKE});
}

const [ox, oz] = sillamae.frame.origin;
for (const {at: [x, z], level, radius, stretch} of CARVED) {
  const cx = m[0] * (x + ox) + m[1] * (z + oz) + m[2] - BOX.west, cy = BOX.north - (m[3] * (x + ox) + m[4] * (z + oz) + m[5]), body = list.findIndex(b => Math.abs(b.level - level) < LEVEL_SPREAD) + 1;
  for (let j = Math.floor(cy - radius * stretch); j <= cy + radius; j++) for (let i = Math.floor(cx - radius); i <= cx + radius; i++)
    if (Math.hypot(i - cx, Math.min(0, j - cy) / stretch + Math.max(0, j - cy)) <= radius && !bodies[j * width + i] && (heightAt(j * width + i) ?? level) < level + ABOVE_LEVEL) bodies[j * width + i] = body;
}

fs.writeFileSync('data/source/water-bodies.bin.gz', zlib.gzipSync(Buffer.from(bodies.buffer), {level: 9}));
fs.writeFileSync('data/source/water-bodies.json', JSON.stringify({source: 'Maa- ja Ruumiamet orthophoto WMS EESTIFOTO', crs: 'EPSG:3301', fetched: new Date().toISOString().slice(0, 10), west: BOX.west, north: BOX.north, width, height, cell: 1, rows: 'north to south', bodies: list}, null, 2) + '\n');
console.log(list.map(b => `${(b.area / 10000).toFixed(1)} ha at ${b.level.toFixed(2)} m${b.replacesSurvey ? '' : ' (kept with the survey)'}`).join('; '));
