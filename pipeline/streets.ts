import ClipperLib from 'clipper-lib';
import type {LocalPoint, Streets} from '../src/engine/data.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TRIANGLE, type CityDefinition, type Point2, type SceneData} from '../src/engine/types.ts';
import {boxOf, editGround, splitByRegion, type Region} from './ground-cut.ts';
import type {RoadCorrections} from './roads.ts';

const SCALE = 1000; // clipper works in integers: millimetres
const KERB = .15, KERB_RISE = .12, KERB_RADIUS = 6, SURFACE = .02, FOOT_RISE = .03, DENSIFY = 1, OPEN = .3; // metres
// The cut stops short of each surface's edge so the surface overlaps the ground instead of leaving a slit.
const CARVE_OVERLAP = .03;
// Footway edge points this close to the kerb are laid at kerb height; the rest fall to the verge.
const AT_KERB = .35;
const ZEBRA = {bar: .5, gap: .5, length: 3, spur: 2};

export interface Marking {offset: number; width: number; dash?: [number, number]}
export type FootwaySurface = 'asphalt' | 'paving';
// Footways the street carries: centre offset from the road centreline (positive left of its direction), optional span along it.
export interface StreetFootway {offset: number; width: number; from?: number; to?: number; surface?: FootwaySurface}
interface Span {from?: number; to?: number}
// Parking beside the carriageway: tarmac joins it flush; gravel lies behind the kerb.
export interface StreetParking extends Span {offset: number; width: number; surface: 'asphalt' | 'gravel'}
// Painted stall ends: lines across the edge band from `offset` towards the centre, every `spacing` metres.
export interface StreetBays extends Span {offset: number; depth: number; spacing: number}
export interface StreetSpec {
  kerb?: boolean; markings?: Marking[]; footways?: StreetFootway[]; parking?: StreetParking[]; bays?: StreetBays[];
  kerbless?: (Span & {side: 'left' | 'right'})[];
}

export function buildStreets(vertices: Float32Array, corrections: RoadCorrections, scene: SceneData, city: CityDefinition, heightAt: HeightAt) {
  const [ox, oz] = city.frame.origin, cuts: Region = [];
  const streets: Streets = {carriageways: [], markings: [], kerbs: [], footways: [], pavers: [], paths: [], edges: []};
  // The draped survey's top layer sits its layer gap above the terrain model; streets match it so the
  // cut ground edge neither stands above the surface (a see-through slit) nor drops below it (tall kerbs).
  const pointGap = layerGap(vertices, boxOf(corrections.areas.flatMap(a => a.polygon)));
  // Median over 1.5 m: single samples jump between a road strip's layer and the verge's, creasing the surface.
  const gap = (x: number, z: number) => {
    const g = [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * 1.5, Math.sin(k * Math.PI / 4) * 1.5])].map(([dx, dz]) => pointGap(x + dx, z + dz)).sort((a, b) => a - b);
    return g[g.length >> 1];
  };
  const ground = (x: number, z: number) => (heightAt(x, z) ?? scene.base) + gap(x, z) - scene.base;
  const local = (x: number, z: number, rise = 0): LocalPoint => [round(x - ox), round(ground(x, z) + SURFACE + rise), round(z - oz)];
  const blocked: Region = [];
  for (const area of corrections.areas) {
    const roads = area.roads.filter(r => r.street), clip = [toPath(area.polygon)], parks = area.carParks ?? [];
    const strips = roads.map(r => union(segmentStrips(r.centre, r.width / 2)));
    const parkingStrips = (surface: StreetParking['surface']) => roads.flatMap(r => (r.street!.parking ?? []).filter(p => p.surface === surface)
      .map(p => openPath(offsetLine(span(r.centre, p.from, p.to), p.offset), p.width / 2, ClipperLib.EndType.etOpenButt)));
    // Closing (grow, then shrink) rounds the inside corners of junctions to a kerb radius.
    const surfaces = union([...strips.flat(), ...parkingStrips('asphalt').flat(), ...parks.map(p => toPath(p.polygon))]);
    const joined = surfaces.length ? intersect(offset(offset(surfaces, KERB_RADIUS), -KERB_RADIUS), clip) : [];
    const kerbed = offset(joined, KERB), kerbLine = polygons(kerbed).flat().flatMap(ringSegments);
    const caps = roads.flatMap(r => [cap(r.centre[0], r.centre[1], r.width), cap(r.centre.at(-1)!, r.centre.at(-2)!, r.width)]);
    const boundary = area.polygon.map((p, i): [Point2, Point2] => [p, area.polygon[(i + 1) % area.polygon.length]]);
    const open = (a: Point2, b: Point2) => [...caps, ...boundary].some(([p, q]) => near(a, p, q, OPEN) && near(b, p, q, OPEN));
    // Each carriageway edge belongs to the nearest road or car park; only those seen with kerbs get one.
    const owners = [
      ...roads.map(r => ({id: r.osm, distance: (p: Point2) => lineDistance(p, r.centre) - r.width / 2, kerb: (p: Point2) => {
        if (r.street!.kerb === false) return false;
        const at = station(p, r.centre);
        return !(r.street!.kerbless ?? []).some(k => (k.side === 'left') === (at.side > 0) && at.along >= (k.from ?? 0) && at.along <= (k.to ?? Infinity));
      }})),
      ...parks.map(p => ({id: -1, kerb: () => p.kerb !== false, distance: (q: Point2) => inside(q, p.polygon) ? 0 : lineDistance(q, [...p.polygon, p.polygon[0]])})),
    ];
    const owner = (p: Point2) => owners.reduce((best, o) => o.distance(p) < best.distance(p) ? o : best);
    const sidewalkSources = roads.flatMap(r => (r.street!.footways ?? []).map(f => ({road: r.osm, f, line: offsetLine(span(r.centre, f.from, f.to), f.offset)})));
    // A footway that meets a carriageway edge across it is a crossing, and crossings are flush;
    // one running alongside keeps the kerb.
    const crosses = (p: Point2, line: Point2[], half: number, edge: Point2) => {
      const near = nearestSegment(p, line);
      return near.distance < half + .3 && Math.abs(near.direction[0] * edge[0] + near.direction[1] * edge[1]) < .87;
    };
    const crossingFootway = (p: Point2, road: number, edge: Point2) =>
      sidewalkSources.some(s => s.road !== road && crosses(p, s.line, s.f.width / 2, edge)) ||
      (area.footways ?? []).some(f => crosses(p, f.centre, f.width / 2, edge));
    const midpoint = (a: Point2, b: Point2): Point2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (const polygon of polygons(joined)) {
      const rings = polygon.map(ring => densify(orient(ring, ring === polygon[0])));
      streets.carriageways.push(rings.map(ring => ring.map(([x, z]) => local(x, z))));
      const kerbs = (a: Point2, b: Point2) => {
        if (open(a, b)) return false;
        const m = midpoint(a, b), o = owner(m), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return o.kerb(m) && !crossingFootway(outwards(a, b, .3), o.id, [(b[0] - a[0]) / l, (b[1] - a[1]) / l]);
      };
      streets.kerbs.push(...runs(rings, kerbs, p => local(...p)));
      streets.edges.push(...runs(rings, (a, b) => !open(a, b) && !kerbs(a, b), p => local(...p)));
    }
    const crossings = (area.crossings ?? []).map(c => c.centre);
    const marks = [
      ...roads.flatMap(r => (r.street!.markings ?? []).flatMap(m => markingPieces(r.centre, m))),
      ...roads.flatMap(r => (r.street!.bays ?? []).flatMap(b => bayLines(span(r.centre, b.from, b.to), b))),
      ...crossings.flatMap(zebra),
    ];
    if (marks.length && joined.length) {
      const within = intersect(union(marks), offset(joined, -.3));
      for (const polygon of polygons(within)) streets.markings.push(polygon.map((ring, k) => densify(orient(ring, k === 0)).map(([x, z]) => local(x, z))));
    }

    const sidewalk = (s: FootwaySurface) => sidewalkSources.filter(x => (x.f.surface ?? 'asphalt') === s).map(x => openPath(x.line, x.f.width / 2, ClipperLib.EndType.etOpenButt));
    const footStrips = (s: FootwaySurface) => (area.footways ?? []).filter(f => f.kind !== 'path' && (f.surface ?? 'asphalt') === s).map(f => openPath(f.centre, f.width / 2, ClipperLib.EndType.etOpenRound));
    const pathStrips = (area.footways ?? []).filter(f => f.kind === 'path').map(f => openPath(f.centre, f.width / 2, ClipperLib.EndType.etOpenRound));
    // Crossings continue as footway across the verge to the sidewalk behind it.
    const spurs = crossings.map(c => openPath(c, ZEBRA.spur / 2, ClipperLib.EndType.etOpenButt));
    const footways = intersect(difference(union([...sidewalk('asphalt'), ...footStrips('asphalt'), ...spurs].flat()), kerbed), clip);
    const pavers = intersect(difference(union([...sidewalk('paving'), ...footStrips('paving')].flat()), union([...kerbed, ...footways])), clip);
    const paths = intersect(difference(union([...pathStrips, ...parkingStrips('gravel')].flat()), union([...kerbed, ...footways, ...pavers])), clip);
    const atKerb = (x: number, z: number) => kerbLine.some(([a, b]) => near([x, z], a, b, AT_KERB));
    for (const [shapes, out] of [[footways, streets.footways], [pavers, streets.pavers], [paths, streets.paths]] as const) {
      for (const polygon of polygons(shapes)) {
        const rings = polygon.map(ring => densify(orient(ring, ring === polygon[0])));
        const lay = ([x, z]: Point2) => local(x, z, atKerb(x, z) ? KERB_RISE : FOOT_RISE);
        out.push(rings.map(ring => ring.map(lay)));
        streets.edges.push(...runs(rings, (a, b) => !(atKerb(...a) && atKerb(...b)), lay));
      }
    }
    cuts.push(...polygons(offset(union([...kerbed, ...footways, ...pavers, ...paths]), -CARVE_OVERLAP)));
    blocked.push(...polygons(union([...kerbed, ...footways, ...pavers])));
  }
  const carved = cuts.length ? editGround(vertices, boxOf(cuts.flatMap(p => p[0])), triangles => splitByRegion(triangles, cuts).outside) : vertices;
  const report = `streets: ${streets.carriageways.length} carriageway pieces, ${streets.kerbs.length} kerb runs, ${streets.markings.length} markings, ${streets.footways.length} footway and ${streets.paths.length} path pieces; ${cuts.length} ground cut-outs`;
  return {vertices: carved, streets, blocked, report};
}

function layerGap(vertices: Float32Array, box: {minX: number; maxX: number; minZ: number; maxZ: number}) {
  const CELL = 4, grid = new Map<string, number[]>(), v = vertices;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (v[i + 6]) continue;
    const xs = [v[i], v[i + 7], v[i + 14]], zs = [v[i + 1], v[i + 8], v[i + 15]];
    if (Math.max(...xs) < box.minX || Math.min(...xs) > box.maxX || Math.max(...zs) < box.minZ || Math.min(...zs) > box.maxZ) continue;
    if (Math.max(...xs) - Math.min(...xs) > 60) continue;
    for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
      for (let z = Math.floor(Math.min(...zs) / CELL); z <= Math.floor(Math.max(...zs) / CELL); z++) {
        const key = x + ',' + z;
        let list = grid.get(key);
        if (!list) grid.set(key, list = []);
        list.push(i);
      }
  }
  return (x: number, z: number) => {
    let low = Infinity, high = -Infinity;
    for (const i of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const ax = v[i], az = v[i + 1], bx = v[i + 7], bz = v[i + 8], cx = v[i + 14], cz = v[i + 15], d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-5) continue;
      const h = a * v[i + 2] + b * v[i + 9] + c * v[i + 16];
      low = Math.min(low, h); high = Math.max(high, h);
    }
    return high > low ? Math.min(high - low, .6) : 0;
  };
}

// The surface lies left of each run.
function runs(rings: Point2[][], keep: (a: Point2, b: Point2) => boolean, lay: (p: Point2) => LocalPoint) {
  const out: LocalPoint[][] = [];
  for (const ring of rings) {
    let run: LocalPoint[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (!keep(a, b)) { if (run.length > 1) out.push(run); run = []; continue; }
      if (!run.length) run.push(lay(a));
      run.push(lay(b));
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

function segmentStrips(centre: Point2[], half: number) {
  const out: Point2[][] = [];
  for (let k = 1; k < centre.length; k++) {
    const [a, b] = [centre[k - 1], centre[k]], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    // Interior joints overlap by half a width so bends close; the road ends stay square.
    const back = k > 1 ? half : 0, ahead = k < centre.length - 1 ? half : 0, ux = dx / l, uz = dz / l;
    const s = [a[0] - ux * back, a[1] - uz * back], e = [b[0] + ux * ahead, b[1] + uz * ahead];
    out.push([[s[0] + uz * half, s[1] - ux * half], [e[0] + uz * half, e[1] - ux * half], [e[0] - uz * half, e[1] + ux * half], [s[0] - uz * half, s[1] + ux * half]]);
  }
  return out.map(toPath);
}

function markingPieces(centre: Point2[], m: Marking) {
  const line = offsetLine(centre, m.offset), pieces: any[] = [];
  let along = 0;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < .01) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, w = m.width / 2;
    const spans: [number, number][] = [];
    if (!m.dash) spans.push([0, l]);
    else { const period = m.dash[0] + m.dash[1]; for (let s = -((along) % period); s < l; s += period) spans.push([Math.max(0, s), Math.min(l, s + m.dash[0])]); }
    for (const [s, e] of spans) if (e - s > .05) pieces.push(rectangle(a, ux, uz, s, e, w));
    along += l;
  }
  return pieces;
}

// Bars run with the traffic, so across the crossing's own direction they repeat bar, gap, bar.
function zebra(line: Point2[]) {
  const pieces: any[] = [];
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < .01) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    for (let s = 0; s + ZEBRA.bar <= l; s += ZEBRA.bar + ZEBRA.gap) pieces.push(rectangle(a, ux, uz, s, s + ZEBRA.bar, ZEBRA.length / 2));
  }
  return pieces;
}

function bayLines(line: Point2[], b: StreetBays) {
  const pieces: any[] = [], w = .1;
  let along = 0;
  for (let k = 1; k < line.length; k++) {
    const [a, c] = [line[k - 1], line[k]], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l < .01) continue;
    const ux = (c[0] - a[0]) / l, uz = (c[1] - a[1]) / l, nx = -uz, nz = ux, inward = -Math.sign(b.offset) || 1;
    for (let s = (b.spacing - along % b.spacing) % b.spacing; s <= l; s += b.spacing) {
      const p: Point2 = [a[0] + ux * s + nx * b.offset, a[1] + uz * s + nz * b.offset], q: Point2 = [p[0] + nx * inward * b.depth, p[1] + nz * inward * b.depth];
      pieces.push(...openPath([p, q], w / 2, ClipperLib.EndType.etOpenButt));
    }
    along += l;
  }
  return pieces;
}

const rectangle = (a: Point2, ux: number, uz: number, s: number, e: number, w: number) => toPath([[a[0] + ux * s + uz * w, a[1] + uz * s - ux * w], [a[0] + ux * e + uz * w, a[1] + uz * e - ux * w], [a[0] + ux * e - uz * w, a[1] + uz * e + ux * w], [a[0] + ux * s - uz * w, a[1] + uz * s + ux * w]]);

function offsetLine(p: Point2[], d: number): Point2[] {
  return p.map((q, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [q[0] - dz / l * d, q[1] + dx / l * d]; });
}

function span(p: Point2[], from = 0, to = Infinity): Point2[] {
  const out: Point2[] = [];
  let along = 0;
  for (let k = 1; k < p.length; k++) {
    const [a, b] = [p[k - 1], p[k]], l = Math.hypot(b[0] - a[0], b[1] - a[1]), at = (d: number): Point2 => [a[0] + (b[0] - a[0]) * (d - along) / l, a[1] + (b[1] - a[1]) * (d - along) / l];
    if (along + l >= from && along <= to) {
      if (!out.length) out.push(from > along ? at(from) : a);
      out.push(to < along + l ? at(to) : b);
    }
    along += l;
  }
  return out;
}

const cap = (end: Point2, next: Point2, width: number): [Point2, Point2] => {
  const dx = next[0] - end[0], dz = next[1] - end[1], l = Math.hypot(dx, dz) || 1, w = width / 2 + KERB;
  return [[end[0] + dz / l * w, end[1] - dx / l * w], [end[0] - dz / l * w, end[1] + dx / l * w]];
};
function near(p: Point2, a: Point2, b: Point2, within: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) < within;
}
const ringSegments = (ring: Point2[]) => ring.map((a, i): [Point2, Point2] => [a, ring[(i + 1) % ring.length]]);
function lineDistance(p: Point2, line: Point2[]) {
  let best = Infinity;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t));
  }
  return best;
}
// side: positive = left of the line's direction.
function station(p: Point2, line: Point2[]) {
  let best = {distance: Infinity, along: 0, side: 0}, start = 0;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l)));
    const distance = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
    if (distance < best.distance) best = {distance, along: start + t * l, side: Math.sign(dx * (p[1] - a[1]) - dz * (p[0] - a[0]))};
    start += l;
  }
  return best;
}
function nearestSegment(p: Point2, line: Point2[]) {
  let best = {distance: Infinity, direction: [1, 0] as Point2};
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
    const distance = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t), l = Math.sqrt(l2) || 1;
    if (distance < best.distance) best = {distance, direction: [dx / l, dz / l]};
  }
  return best;
}
function inside([x, z]: Point2, ring: Point2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; }
  return c;
}
// Edges run with the surface on their left, so outward is to the right.
const outwards = (a: Point2, b: Point2, d: number): Point2 => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return [(a[0] + b[0]) / 2 + dz / l * d, (a[1] + b[1]) / 2 - dx / l * d];
};

function densify(ring: Point2[]) {
  const out: Point2[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / DENSIFY));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  });
  return out;
}
const signedArea = (ring: Point2[]) => ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const orient = (ring: Point2[], outer: boolean) => (signedArea(ring) > 0) === outer ? ring : [...ring].reverse();

const toPath = (ring: Point2[]) => ring.map(([x, z]) => ({X: Math.round(x * SCALE), Y: Math.round(z * SCALE)}));
const fromPath = (path: any[]): Point2[] => path.map(p => [p.X / SCALE, p.Y / SCALE]);
function clipped(type: number, a: any[], b: any[] = []) {
  const c = new ClipperLib.Clipper(), out = new ClipperLib.Paths();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
const union = (paths: any[]) => clipped(ClipperLib.ClipType.ctUnion, paths);
const intersect = (a: any[], b: any[]) => b.length ? clipped(ClipperLib.ClipType.ctIntersection, a, b) : [];
const difference = (a: any[], b: any[]) => b.length ? clipped(ClipperLib.ClipType.ctDifference, a, b) : a;
function offset(paths: any[], d: number) {
  const o = new ClipperLib.ClipperOffset(2, .05 * SCALE), out = new ClipperLib.Paths();
  o.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  o.Execute(out, d * SCALE);
  return out;
}
function openPath(line: Point2[], half: number, ends: number) {
  const o = new ClipperLib.ClipperOffset(2, .05 * SCALE), out = new ClipperLib.Paths();
  o.AddPath(toPath(line), ClipperLib.JoinType.jtRound, ends);
  o.Execute(out, half * SCALE);
  return out;
}
function polygons(paths: any[]): Point2[][][] {
  const c = new ClipperLib.Clipper(), tree = new ClipperLib.PolyTree();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out: Point2[][][] = [];
  const walk = (node: any) => { for (const child of node.Childs()) { out.push([fromPath(child.Contour()), ...child.Childs().map((h: any) => fromPath(h.Contour()))]); for (const h of child.Childs()) walk(h); } };
  walk(tree);
  return out;
}
const round = (v: number) => Math.round(v * 1000) / 1000;
