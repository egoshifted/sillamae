import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import type {LocalPoint, Streets} from '../src/engine/data.ts';
import {carveGroundPatches} from '../src/engine/survey/carve.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import type {CityDefinition, Point2, Polygon, SceneData} from '../src/engine/types.ts';
import type {RoadCorrections} from './roads.ts';

const SCALE = 1000; // clipper works in integers: millimetres
const KERB = .15, KERB_RADIUS = 6, SURFACE = .05, DENSIFY = 1, CARVE_MARGIN = .05, OPEN = .3; // metres
// The sea-level plane lies metres below any street; cutting it would open holes in the water.
const SEA_PLANE_BELOW = 3;

export interface Marking {offset: number; width: number; dash?: [number, number]}
export interface StreetSpec {kerb?: boolean; markings?: Marking[]}

export function buildStreets(vertices: Float32Array, corrections: RoadCorrections, scene: SceneData, city: CityDefinition, heightAt: HeightAt) {
  const [ox, oz] = city.frame.origin, streets: Streets = {carriageways: [], markings: [], kerbs: []}, patches: Polygon[] = [];
  let lowest = Infinity;
  const local = (x: number, z: number): LocalPoint => { const h = heightAt(x, z) ?? scene.base; lowest = Math.min(lowest, h); return [round(x - ox), round(h + SURFACE - scene.base), round(z - oz)]; };
  for (const area of corrections.areas) {
    const roads = area.roads.filter(r => r.street);
    if (!roads.length) continue;
    const strips = roads.map(r => union(segmentStrips(r.centre, r.width / 2)));
    // Closing (grow, then shrink) rounds the inside corners of junctions to a kerb radius.
    const joined = intersect(offset(offset(union(strips.flat()), KERB_RADIUS), -KERB_RADIUS), [toPath(area.polygon)]);
    const caps = roads.flatMap(r => [cap(r.centre[0], r.centre[1], r.width), cap(r.centre.at(-1)!, r.centre.at(-2)!, r.width)]);
    const boundary = area.polygon.map((p, i): [Point2, Point2] => [p, area.polygon[(i + 1) % area.polygon.length]]);
    const open = (a: Point2, b: Point2) => [...caps, ...boundary].some(([p, q]) => near(a, p, q) && near(b, p, q));
    for (const polygon of polygons(joined)) {
      const rings = polygon.map(ring => densify(orient(ring, ring === polygon[0])));
      streets.carriageways.push(rings.map(ring => ring.map(([x, z]) => local(x, z))));
      for (const ring of rings) {
        let run: LocalPoint[] = [];
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          if (open(a, b)) { if (run.length > 1) streets.kerbs.push(run); run = []; continue; }
          if (!run.length) run.push(local(...a));
          run.push(local(...b));
        }
        if (run.length > 1) streets.kerbs.push(run);
      }
    }
    const marks = roads.flatMap(r => (r.street!.markings ?? []).flatMap(m => markingPieces(r.centre, m)));
    if (marks.length) {
      const within = intersect(union(marks), offset(joined, -KERB - .05));
      for (const polygon of polygons(within)) streets.markings.push(polygon.map((ring, k) => densify(orient(ring, k === 0)).map(([x, z]) => local(x, z))));
    }
    for (const polygon of polygons(offset(joined, KERB + CARVE_MARGIN))) patches.push(...convexPieces(polygon));
  }
  const carved = patches.length ? carveGroundPatches(vertices, patches, lowest - SEA_PLANE_BELOW) : vertices;
  return {vertices: carved, streets, report: `streets: ${streets.carriageways.length} carriageway pieces, ${streets.kerbs.length} kerb runs, ${streets.markings.length} markings; ${patches.length} ground cut-outs`};
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
    for (const [s, e] of spans) if (e - s > .05) pieces.push(toPath([[a[0] + ux * s + uz * w, a[1] + uz * s - ux * w], [a[0] + ux * e + uz * w, a[1] + uz * e - ux * w], [a[0] + ux * e - uz * w, a[1] + uz * e + ux * w], [a[0] + ux * s - uz * w, a[1] + uz * s + ux * w]]));
    along += l;
  }
  return pieces;
}

function offsetLine(p: Point2[], d: number): Point2[] {
  return p.map((q, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [q[0] - dz / l * d, q[1] + dx / l * d]; });
}

const cap = (end: Point2, next: Point2, width: number): [Point2, Point2] => {
  const dx = next[0] - end[0], dz = next[1] - end[1], l = Math.hypot(dx, dz) || 1, w = width / 2 + KERB;
  return [[end[0] + dz / l * w, end[1] - dx / l * w], [end[0] - dz / l * w, end[1] + dx / l * w]];
};
function near(p: Point2, a: Point2, b: Point2) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) < OPEN;
}

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

function convexPieces(polygon: Point2[][]): Polygon[] {
  const [outer, ...holes] = polygon.map(r => r.map(([x, z]) => new THREE.Vector2(x, z)));
  const points = [outer, ...holes].flat();
  return THREE.ShapeUtils.triangulateShape(outer, holes).map(t => t.map(i => [points[i].x, points[i].y] as Point2));
}

const toPath = (ring: Point2[]) => ring.map(([x, z]) => ({X: Math.round(x * SCALE), Y: Math.round(z * SCALE)}));
const fromPath = (path: any[]): Point2[] => path.map(p => [p.X / SCALE, p.Y / SCALE]);
function union(paths: any[]) {
  const c = new ClipperLib.Clipper(), out = new ClipperLib.Paths();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
function intersect(a: any[], b: any[]) {
  const c = new ClipperLib.Clipper(), out = new ClipperLib.Paths();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  c.Execute(ClipperLib.ClipType.ctIntersection, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
function offset(paths: any[], d: number) {
  const o = new ClipperLib.ClipperOffset(2, .05 * SCALE), out = new ClipperLib.Paths();
  o.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  o.Execute(out, d * SCALE);
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
