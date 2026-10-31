import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import {concat, readTriangle, type SurveyVertex} from '../src/engine/survey/carve.ts';
import {TRIANGLE, type Point2} from '../src/engine/types.ts';

const SCALE = 1000; // clipper works in integers: millimetres

export type Region = Point2[][][]; // polygons, each an outer ring followed by its holes
export interface Box {minX: number; maxX: number; minZ: number; maxZ: number}

export const boxOf = (points: Point2[]): Box => {
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  return {minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
};

// The sea-level plane's huge triangles stay out: cutting them would open holes in the water.
export function editGround(vertices: Float32Array, box: Box, edit: (triangles: SurveyVertex[][]) => SurveyVertex[][]) {
  const chunks: Float32Array[] = [], local: SurveyVertex[][] = [];
  let run = 0;
  for (let i = 0; i < vertices.length; i += TRIANGLE) {
    if (vertices[i + 6] !== 0) continue;
    const xs = [vertices[i], vertices[i + 7], vertices[i + 14]], zs = [vertices[i + 1], vertices[i + 8], vertices[i + 15]];
    if (Math.max(...xs) < box.minX || Math.min(...xs) > box.maxX || Math.max(...zs) < box.minZ || Math.min(...zs) > box.maxZ) continue;
    if (Math.max(...xs) - Math.min(...xs) > 60 || Math.max(...zs) - Math.min(...zs) > 60) continue;
    if (i > run) chunks.push(vertices.subarray(run, i));
    run = i + TRIANGLE;
    local.push(readTriangle(vertices, i));
  }
  if (run < vertices.length) chunks.push(vertices.subarray(run));
  chunks.push(new Float32Array(edit(local).flat(2)));
  return concat(chunks);
}

// Clipping one convex piece at a time cuts along every internal edge and shatters the ground.
export function splitByRegion(triangles: SurveyVertex[][], region: Region) {
  const parts = region.map(polygon => {
    const xs = polygon[0].map(p => p[0]), zs = polygon[0].map(p => p[1]);
    return {paths: polygon.map(toPath), minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
  });
  const inside: SurveyVertex[][] = [], outside: SurveyVertex[][] = [];
  for (const tri of triangles) {
    const xs = tri.map(p => p[0]), zs = tri.map(p => p[1]);
    const near = parts.filter(r => Math.max(...xs) > r.minX && Math.min(...xs) < r.maxX && Math.max(...zs) > r.minZ && Math.min(...zs) < r.maxZ);
    if (!near.length) { outside.push(tri); continue; }
    const subject = [toPath(tri.map(p => [p[0], p[1]] as Point2))], clip = near.flatMap(r => r.paths);
    const within = execute(ClipperLib.ClipType.ctIntersection, subject, clip);
    if (!within.length) { outside.push(tri); continue; }
    const rest = execute(ClipperLib.ClipType.ctDifference, subject, clip);
    if (!rest.length) { inside.push(tri); continue; }
    inside.push(...triangulate(within, tri));
    outside.push(...triangulate(rest, tri));
  }
  return {inside, outside};
}

function execute(type: number, subject: any[], clip: any[]) {
  const c = new ClipperLib.Clipper(), tree = new ClipperLib.PolyTree();
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  c.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out: Point2[][][] = [];
  const walk = (node: any) => { for (const child of node.Childs()) { out.push([fromPath(child.Contour()), ...child.Childs().map((h: any) => fromPath(h.Contour()))]); for (const h of child.Childs()) walk(h); } };
  walk(tree);
  return out;
}

// New corners take height, colour and building number from the source triangle's plane.
function triangulate(polygons: Point2[][][], tri: SurveyVertex[]) {
  const [a, b, c] = tri, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const vertex = ([x, z]: Point2): SurveyVertex => {
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d, w = 1 - u - v;
    return a.map((_, k) => k < 2 ? (k ? z : x) : k === 6 ? a[6] : a[k] * u + b[k] * v + c[k] * w);
  };
  const out: SurveyVertex[][] = [];
  for (const [outer, ...holes] of polygons) {
    const points = [outer, ...holes].flat(), v2 = (r: Point2[]) => r.map(([x, z]) => new THREE.Vector2(x, z));
    for (const t of THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2))) out.push(t.map(i => vertex(points[i])));
  }
  return out;
}

const toPath = (ring: Point2[]) => ring.map(([x, z]) => ({X: Math.round(x * SCALE), Y: Math.round(z * SCALE)}));
const fromPath = (path: any[]): Point2[] => path.map(p => [p.X / SCALE, p.Y / SCALE]);
