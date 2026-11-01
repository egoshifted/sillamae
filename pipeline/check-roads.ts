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
const SCAN = .5, REACH = 8, CLUSTER = 10, PAINT_TOP = .03, MISMATCH = .5, INSET = .1, EDGE = 15, RAMP = .25, WALL = 1, MAX_STEP = .3, MAX_WALL = .5, CONTACT = .3, PAINT_SAMPLES = 2e6, FLOAT = 1.5, OVER_WATER = 4;

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

// The built ground and building roofs, decoded from the tiles. Ground triangles are
// kept flat and indexed by 4 m cell: town-wide there are millions.
await MeshoptDecoder.ready;
const frame = {origin: sillamae.frame.origin, base: world.base}, builtTop = new Map<number, number>();
let groundData = new Float32Array(9 << 20), groundCount = 0;
const groundGrid = new Map<string, number[]>(), isWater: boolean[] = [];
for (const name of manifest.tiles) {
  const bytes = zlib.gunzipSync(fs.readFileSync(`public/data/tiles/${name}.bin.gz`));
  for (const b of decodeTile(manifest, name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), frame)) {
    const water = manifest.buckets[b.index].kind === 'water';
    for (let t = 0; t < b.building.length; t += 3) {
      const p = b.position, k = t * 3, xs = [p[k], p[k + 3], p[k + 6]], zs = [p[k + 2], p[k + 5], p[k + 8]];
      if (b.building[t] && !water) { builtTop.set(b.building[t], Math.max(builtTop.get(b.building[t]) ?? -Infinity, p[k + 1], p[k + 4], p[k + 7])); continue; }
      if (Math.max(...xs) - Math.min(...xs) >= 60) continue;
      if ((groundCount + 1) * 9 > groundData.length) { const grown = new Float32Array(groundData.length * 2); grown.set(groundData); groundData = grown; }
      groundData.set(p.subarray(k, k + 9), groundCount * 9);
      for (let x = Math.floor(Math.min(...xs) / 4); x <= Math.floor(Math.max(...xs) / 4); x++) for (let z = Math.floor(Math.min(...zs) / 4); z <= Math.floor(Math.max(...zs) / 4); z++) {
        const key = x + ',' + z;
        let list = groundGrid.get(key);
        if (!list) groundGrid.set(key, list = []);
        list.push(groundCount);
      }
      isWater.push(water);
      groundCount++;
    }
  }
}
// Lowest built ground at local x/z, in the local frame like the road heights;
// with water, streams and ponds count too (the sea plane never does).
const builtLow = (x: number, z: number, water = false) => {
  let low = Infinity;
  for (const i of groundGrid.get(Math.floor(x / 4) + ',' + Math.floor(z / 4)) ?? []) {
    if (isWater[i] && !water) continue;
    const [x1, h1, z1, x2, h2, z2, x3, h3, z3] = groundData.subarray(i * 9, i * 9 + 9), d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
    if (Math.abs(d) < 1e-9) continue;
    const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
    if (Math.min(a, b, c) >= -1e-6) low = Math.min(low, a * h1 + b * h2 + c * h3);
  }
  return low === Infinity ? null : low;
};

// Walls: a drawn triangle steeper than 1 in 1 that rises over MAX_WALL and stands
// off the ground beneath it (or the water, where a path runs down to a stream),
// by more than MAX_WALL at a corner, from a ring point that took another level's
// height. A corner over neither is not judged. Steep triangles
// whose corners sit on the ground follow a steep bank or ramp and, with ramps
// steeper than 1 in 4, are listed for review. Slivers made steep by centimetre
// rounding rise less than MAX_STEP. Along the area's edge the rebuilt ground meets
// survey layers stacked above it, so roads leaving the area step up; those are
// listed apart.
const walls: string[] = [], ramps: string[] = [], edgeSteps: string[] = [];
for (const s of world.roads) for (const t of triangulate(s.ring)) {
  const [a, b, c] = t.map(i => s.ring[i]), rise = Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]);
  if (rise < MAX_STEP) continue;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, slope = Math.abs(ny) < 1e-9 ? Infinity : Math.hypot(nx, nz) / Math.abs(ny);
  const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3, where = `${s.kind} ${x.toFixed(1)},${z.toFixed(1)}`;
  if (slope <= RAMP) continue;
  const offGround = Math.max(...[a, b, c].map(p => { const g = builtLow(p[0], p[2]) ?? builtLow(p[0], p[2], true); return g === null ? 0 : Math.abs(p[1] - g); }));
  if (!area.inside([x, z], -EDGE)) edgeSteps.push(where); else if (slope > WALL && rise > MAX_WALL && offGround > MAX_WALL) walls.push(where); else ramps.push(where);
}
console.log(`walls (steeper than 1 in 1, rising over ${MAX_WALL} m): ${walls.length}${walls.length ? ` (local x,z: ${walls.slice(0, 8).join('; ')})` : ''}`);
console.log(`steep ground followed (steeper than 1 in 4): ${ramps.length}${ramps.length ? ` (local x,z: ${ramps.slice(0, 5).join('; ')})` : ''}`);
console.log(`steep within ${EDGE} m of the area's edge: ${edgeSteps.length}`);

// Off the ground: a surface with a point more than FLOAT from the lowest built
// ground under it, which a flat surface left where no ground was found escapes
// the wall test. Ring points stand at most a stack (1 m) above the lowest ground.
// Where there is only water (old survey water can also lie under rebuilt ground)
// a road crossing a stream stands on the banks' terrain, metres above it, so only
// OVER_WATER catches a surface left at another level.
const floating: string[] = [];
for (const s of world.roads) {
  const off = s.ring.find(p => {
    const g = builtLow(p[0], p[2]);
    if (g !== null) return Math.abs(p[1] - g) > FLOAT;
    const w = builtLow(p[0], p[2], true);
    return w !== null && Math.abs(p[1] - w) > OVER_WATER;
  });
  if (off) floating.push(`${s.kind} ${off[0].toFixed(1)},${off[2].toFixed(1)}`);
}
console.log(`surfaces off the ground by over ${FLOAT} m: ${floating.length}${floating.length ? ` (local x,z: ${floating.slice(0, 8).join('; ')})` : ''}`);

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
// Town-wide a 0.5 m scan is tens of millions of samples; the step widens to keep it near PAINT_SAMPLES.
const [cx, cz] = area.centre, [scanX, scanZ] = area.half.map(h => h - EDGE), step = Math.max(SCAN, Math.sqrt(4 * scanX * scanZ / PAINT_SAMPLES));
for (let x = cx - scanX; x < cx + scanX; x += step) for (let z = cz - scanZ; z < cz + scanZ; z += step) {
  if (!painted(x, z) || covered(x, z).length) continue;
  exposed += step * step;
  const k = Math.floor(x / CLUSTER) * CLUSTER + ',' + Math.floor(z / CLUSTER) * CLUSTER;
  clusters.set(k, (clusters.get(k) ?? 0) + step * step);
}
console.log(`uncovered survey road paint (sampled every ${step.toFixed(1)} m): ${exposed.toFixed(0)} m2; largest ${CLUSTER} m cells (local x,z of their corner):`);
for (const [k, m2] of [...clusters].sort((p, q) => q[1] - p[1]).slice(0, 10)) console.log(`  ${k}: ${m2.toFixed(1)} m2`);

if (broken || onRoad || walls.length || floating.length || treesOn.length || offContact.length) process.exitCode = 1;
