import fs from 'node:fs';
import zlib from 'node:zlib';
import {sillamae} from '../src/city/sillamae/index.ts';
import type {RoadSurface, WorldData} from '../src/engine/data.ts';
import {triangulate} from '../src/engine/roads.ts';
import type {SceneData} from '../src/engine/types.ts';
import {georeference, type OsmExtract} from './geo.ts';
import {isCrossing, marked, roadArea} from './roads.ts';
import {MARKING, ROAD, surveyLayers} from './survey-colour.ts';

// Checks the generated road surfaces against the survey; run after `npm run data`.
// Fails on broken polygons, walls, footways on the carriageway or trees on a road
// surface; the rest is for review.
// Metres; EDGE skips the strip along the area's edge, where roads stop by design.
const SCAN = .5, REACH = 8, CLUSTER = 10, PAINT_TOP = .03, MISMATCH = .5, INSET = .1, EDGE = 15, RAMP = .25, WALL = 1, MAX_STEP = .3, MAX_WALL = .5;

const scene: SceneData = JSON.parse(fs.readFileSync('data/source/scene.json', 'utf8'));
const osm: OsmExtract = JSON.parse(fs.readFileSync('data/source/osm.json', 'utf8'));
const world: WorldData = JSON.parse(fs.readFileSync('public/data/world.json', 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync('data/source/geometry.bin.gz'));
const {layers, is} = surveyLayers(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4));
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
const walls: string[] = [], ramps: string[] = [];
for (const s of world.roads) for (const t of triangulate(s.ring)) {
  const [a, b, c] = t.map(i => s.ring[i]), rise = Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]);
  if (rise < MAX_STEP) continue;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, slope = Math.abs(ny) < 1e-9 ? Infinity : Math.hypot(nx, nz) / Math.abs(ny);
  const where = `${s.kind} ${((a[0] + b[0] + c[0]) / 3).toFixed(1)},${((a[2] + b[2] + c[2]) / 3).toFixed(1)}`;
  if (slope > WALL && rise > MAX_WALL) walls.push(where); else if (slope > RAMP) ramps.push(where);
}
console.log(`walls (steeper than 1 in 1, rising over ${MAX_WALL} m): ${walls.length}${walls.length ? ` (local x,z: ${walls.slice(0, 8).join('; ')})` : ''}`);
console.log(`steep ground followed (steeper than 1 in 4): ${ramps.length}${ramps.length ? ` (local x,z: ${ramps.slice(0, 5).join('; ')})` : ''}`);

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

if (broken || onRoad || walls.length || treesOn.length) process.exitCode = 1;
