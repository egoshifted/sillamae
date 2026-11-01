import fs from 'node:fs';
import zlib from 'node:zlib';
import {sillamae} from '../src/city/sillamae/index.ts';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {decodeTile, type RoadSurface, type SurveyManifest, type WorldData} from '../src/engine/data.ts';
import {triangulate} from '../src/engine/roads.ts';
import type {SceneData} from '../src/engine/types.ts';
import {georeference, type OsmExtract} from './geo.ts';
import {isCrossing, marked, roadArea} from './roads.ts';
import {MARKING, ROAD, surveyLayers} from './survey-colour.ts';

// Checks the generated road surfaces against the survey; run after `npm run data`.
// Fails on broken polygons, walls, footways on the carriageway, trees on a road
// surface or buildings off their survey contact; the rest is for review.
// Metres; EDGE skips the strip along the area's edge, where roads stop by design.
const SCAN = .5, REACH = 8, CLUSTER = 10, PAINT_TOP = .03, MISMATCH = .5, INSET = .1, EDGE = 15, RAMP = .25, WALL = 1, MAX_STEP = .3, MAX_WALL = .5, CONTACT = .3;

const scene: SceneData = JSON.parse(fs.readFileSync('data/source/scene.json', 'utf8'));
const osm: OsmExtract = JSON.parse(fs.readFileSync('data/source/osm.json', 'utf8'));
const world: WorldData = JSON.parse(fs.readFileSync('public/data/world.json', 'utf8'));
const manifest: SurveyManifest = JSON.parse(fs.readFileSync('public/data/survey.json', 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync('data/source/geometry.bin.gz'));
const surveyed = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const {layers, is} = surveyLayers(surveyed);
const {local} = georeference(osm, scene, sillamae), [ox, oz] = sillamae.frame.origin, area = roadArea(scene, sillamae);

type Ring = RoadSurface['ring'];
const shoelace = (r: Ring) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[2] - q[0] * p[2]; }, 0) / 2);
const contains = (r: Ring, x: number, z: number) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][2] > z) !== (r[j][2] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][2]) / (r[j][2] - r[i][2]) + r[i][0]) inside = !inside;
  return inside;
};
const crosses = (a: number[], b: number[], c: number[], d: number[]) => {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const index = (surfaces: RoadSurface[]) => {
  const grid = new Map<string, RoadSurface[]>();
  for (const s of surfaces) {
    const xs = s.ring.map(p => p[0]), zs = s.ring.map(p => p[2]);
    for (let x = Math.floor(Math.min(...xs) / 4); x <= Math.floor(Math.max(...xs) / 4); x++) for (let z = Math.floor(Math.min(...zs) / 4); z <= Math.floor(Math.max(...zs) / 4); z++) {
      const k = x + ',' + z;
      grid.set(k, [...grid.get(k) ?? [], s]);
    }
  }
  return (x: number, z: number) => (grid.get(Math.floor(x / 4) + ',' + Math.floor(z / 4)) ?? []).filter(s => contains(s.ring, x, z));
};
const painted = (x: number, z: number) => {
  const found = layers(x + ox, z + oz), top = found[0]?.h ?? -Infinity;
  return found.some(l => l.h > top - PAINT_TOP && (is(l.i, ROAD) || is(l.i, MARKING)));
};

// Polygons: a self-crossing ring or a triangulation larger than its ring draws wedges.
let broken = 0;
for (const s of world.roads) {
  const r = s.ring, covered = triangulate(r).reduce((sum, t) => sum + shoelace(t.map(i => r[i])), 0);
  let crossing = false;
  for (let i = 0; i < r.length && !crossing; i++) for (let j = i + 2; j < r.length; j++)
    if ((j + 1) % r.length !== i && crosses(r[i], r[(i + 1) % r.length], r[j], r[(j + 1) % r.length])) { crossing = true; break; }
  if (crossing || covered > shoelace(r) * 1.05 + 1) broken++;
}
console.log(`polygons: ${world.roads.length}, ${broken} broken`);

// Walls: a drawn triangle steeper than 1 in 1 that rises over MAX_WALL stands up out
// of the road, from a ring point that took another level's height or a triangle
// over no ground; no ground layer stack is that thick. Steep triangles rising
// MAX_STEP to MAX_WALL, and ramps steeper than 1 in 4, follow steep survey ground, as
// where ground kept at its surveyed height meets draped ground; they are listed for
// review. Slivers made steep by centimetre rounding rise less than MAX_STEP.
// Along the area's edge the rebuilt ground meets survey layers stacked above it,
// so roads leaving the area step up; those are listed apart.
const walls: string[] = [], ramps: string[] = [], edgeSteps: string[] = [];
for (const s of world.roads) for (const t of triangulate(s.ring)) {
  const [a, b, c] = t.map(i => s.ring[i]), rise = Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]);
  if (rise < MAX_STEP) continue;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, slope = Math.abs(ny) < 1e-9 ? Infinity : Math.hypot(nx, nz) / Math.abs(ny);
  const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3, where = `${s.kind} ${x.toFixed(1)},${z.toFixed(1)}`;
  if (slope <= RAMP) continue;
  if (!area.inside([x, z], -EDGE)) edgeSteps.push(where); else if (slope > WALL && rise > MAX_WALL) walls.push(where); else ramps.push(where);
}
console.log(`walls (steeper than 1 in 1, rising over ${MAX_WALL} m): ${walls.length}${walls.length ? ` (local x,z: ${walls.slice(0, 8).join('; ')})` : ''}`);
console.log(`steep ground followed (steeper than 1 in 4): ${ramps.length}${ramps.length ? ` (local x,z: ${ramps.slice(0, 5).join('; ')})` : ''}`);
console.log(`steep within ${EDGE} m of the area's edge: ${edgeSteps.length}`);

// Footways on the carriageway: points just inside each footway edge that a carriageway contains.
const carriageway = index(world.roads.filter(s => s.kind === 'carriageway'));
let onRoad = 0;
const where: string[] = [];
for (const s of world.roads) if (s.kind === 'footway') {
  // Inward is to the left of each edge on an anticlockwise ring in (x, z), to the right on a clockwise one.
  const r = s.ring, turn = Math.sign(r.reduce((sum, p, i) => { const q = r[(i + 1) % r.length]; return sum + p[0] * q[2] - q[0] * p[2]; }, 0));
  for (let i = 0; i < r.length; i++) {
    const q = r[(i + 1) % r.length], dx = q[0] - r[i][0], dz = q[2] - r[i][2], length = Math.hypot(dx, dz);
    if (length < INSET) continue;
    const x = (r[i][0] + q[0]) / 2 - dz / length * INSET * turn, z = (r[i][2] + q[2]) / 2 + dx / length * INSET * turn;
    // A footway thinner than INSET would put the point beyond its far edge.
    if (contains(r, x, z) && carriageway(x, z).length && onRoad++ < 5) where.push(`${x.toFixed(1)},${z.toFixed(1)}`);
  }
}
console.log(`footway edge points on the carriageway: ${onRoad}${where.length ? ` (local x,z: ${where.join(' ')})` : ''}`);

// Trees: no trunk may stand on a carriageway or footway.
const surface = index(world.roads.filter(s => s.kind !== 'marking'));
const treesOn = world.trees.filter(t => surface(t.p[0] - ox, t.p[1] - oz).length).map(t => `${(t.p[0] - ox).toFixed(1)},${(t.p[1] - oz).toFixed(1)}`);
console.log(`trees on a road or path: ${treesOn.length}${treesOn.length ? ` (local x,z: ${treesOn.slice(0, 8).join('; ')})` : ''}`);

// Buildings: each survey building in the area should have moved with its ground. The
// ground's move is the median just outside its walls of built minus survey ground; the
// building's is the move of its roof top, which settling (lowering wall bottoms onto
// the ground) leaves alone. Sunk or floating by more than CONTACT fails. Refined
// models are placed by their own code and are listed apart.
await MeshoptDecoder.ready;
const frame = {origin: sillamae.frame.origin, base: world.base}, builtGround: number[][] = [], builtTop = new Map<number, number>();
for (const name of manifest.tiles) {
  const bytes = zlib.gunzipSync(fs.readFileSync(`public/data/tiles/${name}.bin.gz`));
  for (const b of decodeTile(manifest, name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), frame)) {
    if (manifest.buckets[b.index].kind === 'water') continue;
    for (let t = 0; t < b.building.length; t += 3) {
      const p = b.position, k = t * 3;
      if (b.building[t]) builtTop.set(b.building[t], Math.max(builtTop.get(b.building[t]) ?? -Infinity, p[k + 1], p[k + 4], p[k + 7]));
      else if (Math.max(p[k], p[k + 3], p[k + 6]) - Math.min(p[k], p[k + 3], p[k + 6]) < 60) builtGround.push([p[k], p[k + 1], p[k + 2], p[k + 3], p[k + 4], p[k + 5], p[k + 6], p[k + 7], p[k + 8]]);
    }
  }
}
const groundGrid = new Map<string, number[][]>();
for (const tri of builtGround) {
  const xs = [tri[0], tri[3], tri[6]], zs = [tri[2], tri[5], tri[8]];
  for (let x = Math.floor(Math.min(...xs) / 4); x <= Math.floor(Math.max(...xs) / 4); x++) for (let z = Math.floor(Math.min(...zs) / 4); z <= Math.floor(Math.max(...zs) / 4); z++) {
    const k = x + ',' + z;
    groundGrid.set(k, [...groundGrid.get(k) ?? [], tri]);
  }
}
const builtLow = (x: number, z: number) => {
  let low = Infinity;
  for (const [x1, h1, z1, x2, h2, z2, x3, h3, z3] of groundGrid.get(Math.floor(x / 4) + ',' + Math.floor(z / 4)) ?? []) {
    const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
    if (Math.abs(d) < 1e-9) continue;
    const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
    if (Math.min(a, b, c) >= -1e-6) low = Math.min(low, a * h1 + b * h2 + c * h3);
  }
  return low === Infinity ? null : low;
};
const surveyTop = new Map<number, number>();
for (let i = 0; i < surveyed.length; i += 21) if (surveyed[i + 6]) surveyTop.set(surveyed[i + 6], Math.max(surveyTop.get(surveyed[i + 6]) ?? -Infinity, surveyed[i + 2], surveyed[i + 9], surveyed[i + 16]));
const refinedIds = new Set(sillamae.overrides.map(o => o.id)), offContact: string[] = [], refinedListed: string[] = [];
const middle = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (const b of scene.buildings) {
  const g = b.g.map(([x, z]): [number, number] => [x - ox, z - oz]), cx = g.reduce((s, p) => s + p[0], 0) / g.length, cz = g.reduce((s, p) => s + p[1], 0) / g.length;
  if (!area.inside([cx, cz], -EDGE)) continue;
  if (refinedIds.has(b.id)) { refinedListed.push(b.name ?? b.id); continue; }
  const top = builtTop.get(b.pick), was = surveyTop.get(b.pick);
  if (top === undefined || was === undefined) continue;
  const turn = Math.sign(g.reduce((s, p, i) => { const q = g[(i + 1) % g.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)), groundMoves: number[] = [];
  g.forEach((p, i) => {
    const q = g[(i + 1) % g.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!length) return;
    const nx = (q[1] - p[1]) / length * turn, nz = -(q[0] - p[0]) / length * turn;
    for (let t = .5; t < length; t += 1) {
      const x = p[0] + (q[0] - p[0]) * t / length + nx, z = p[1] + (q[1] - p[1]) * t / length + nz, h = builtLow(x, z), s = layers(x + ox, z + oz).at(-1)?.h;
      // Built heights are in the local frame, survey heights absolute.
      if (h !== null && s !== undefined) groundMoves.push(h + world.base - s);
    }
  });
  if (!groundMoves.length) continue;
  const change = middle(groundMoves) - (top + world.base - was);
  if (Math.abs(change) > CONTACT) offContact.push(`${b.name ?? b.id} ${change > 0 ? 'sunk' : 'floating'} ${Math.abs(change).toFixed(2)} m`);
}
console.log(`buildings meeting the ground off their survey contact by over ${CONTACT} m: ${offContact.length}${offContact.length ? ` (${offContact.slice(0, 8).join('; ')})` : ''}`);
console.log(`refined models placed by their own code, not checked: ${refinedListed.join(', ') || 'none'}`);

// Crossings: the carriageway should span the survey's road paint along each zebra.
console.log('marked crossings (paint span | carriageway span, metres along the crossing from its middle):');
for (const w of osm.highways) {
  if (!isCrossing(w.tags) || !marked(w.tags)) continue;
  const [a, b] = [local(w.points[0]), local(w.points[w.points.length - 1])];
  if (!area.inside(a) || !area.inside(b)) continue;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const span = (test: (x: number, z: number) => boolean) => {
    const hits: number[] = [];
    for (let t = -REACH; t <= REACH; t += SCAN) if (test(mid[0] + u[0] * t, mid[1] + u[1] * t)) hits.push(t);
    return hits.length ? [hits[0], hits[hits.length - 1]] : null;
  };
  const paint = span(painted), road = span((x, z) => carriageway(x, z).length > 0);
  const off = paint && road ? Math.max(Math.abs(paint[0] - road[0]), Math.abs(paint[1] - road[1])) : Infinity;
  const show = (s: number[] | null) => s ? `${s[0].toFixed(1)}..${s[1].toFixed(1)}` : 'none';
  console.log(`  ${w.id}: ${show(paint)} | ${show(road)}${off > MISMATCH ? '  <- review' : ''}`);
}

// Survey road paint left uncovered shows as a second road beside or under the built one.
const covered = index(world.roads);
const clusters = new Map<string, number>();
let exposed = 0;
const [cx, cz] = area.centre, scan = area.half - EDGE;
for (let x = cx - scan; x < cx + scan; x += SCAN) for (let z = cz - scan; z < cz + scan; z += SCAN) {
  if (!painted(x, z) || covered(x, z).length) continue;
  exposed += SCAN * SCAN;
  const k = Math.floor(x / CLUSTER) * CLUSTER + ',' + Math.floor(z / CLUSTER) * CLUSTER;
  clusters.set(k, (clusters.get(k) ?? 0) + SCAN * SCAN);
}
console.log(`uncovered survey road paint: ${exposed.toFixed(0)} m2; largest ${CLUSTER} m cells (local x,z of their corner):`);
for (const [k, m2] of [...clusters].sort((p, q) => q[1] - p[1]).slice(0, 10)) console.log(`  ${k}: ${m2.toFixed(1)} m2`);

if (broken || onRoad || walls.length || treesOn.length || offContact.length) process.exitCode = 1;
