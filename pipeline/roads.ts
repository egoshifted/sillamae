import {concat, readTriangle, splitPolygon, type SurveyVertex} from '../src/engine/survey/carve.ts';
import {TRIANGLE, type Point2} from '../src/engine/types.ts';
import type {StreetSpec} from './streets.ts';

// Survey ground paints roads as fixed-width strips along generalised centrelines; these colours are its legend.
const ROAD = [.57, .60, .58], VERGE = [.71, .76, .61];

export interface RoadCorrections {
  areas: {name: string; polygon: Point2[]; roads: {osm: number; width: number; centre: Point2[]; street?: StreetSpec}[]}[];
}

// Recolours rather than replaces ground, so the stacked survey layers and their depth order stay untouched.
export function correctRoads(vertices: Float32Array, corrections: RoadCorrections) {
  let changed = 0;
  for (const area of corrections.areas) {
    const xs = area.polygon.map(p => p[0]), zs = area.polygon.map(p => p[1]);
    const box = {minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
    const chunks: Float32Array[] = [], local: SurveyVertex[][] = [];
    let run = 0;
    for (let i = 0; i < vertices.length; i += TRIANGLE) {
      if (vertices[i + 6] !== 0) continue;
      const tx = [vertices[i], vertices[i + 7], vertices[i + 14]], tz = [vertices[i + 1], vertices[i + 8], vertices[i + 15]];
      if (Math.max(...tx) < box.minX || Math.min(...tx) > box.maxX || Math.max(...tz) < box.minZ || Math.min(...tz) > box.maxZ) continue;
      if (Math.max(...tx) - Math.min(...tx) > 60 || Math.max(...tz) - Math.min(...tz) > 60) continue; // sea-level plane
      if (i > run) chunks.push(vertices.subarray(run, i));
      run = i + TRIANGLE;
      local.push(readTriangle(vertices, i));
    }
    if (run < vertices.length) chunks.push(vertices.subarray(run));
    const [inside, outside] = clip(local, area.polygon);
    for (const tri of inside) if (is(tri, ROAD)) { paint(tri, VERGE); changed++; }
    let result = inside;
    for (const road of area.roads) for (let k = 1; k < road.centre.length; k++) {
      const quad = strip(road.centre[k - 1], road.centre[k], road.width / 2), [within, rest] = clip(result, quad);
      for (const tri of within) { paint(tri, ROAD); changed++; }
      result = [...within, ...rest];
    }
    chunks.push(new Float32Array([...outside, ...result].flat(2)));
    vertices = concat(chunks);
  }
  return {vertices, report: `roads: ${corrections.areas.length} corrected areas, ${changed} ground pieces recoloured`};
}

export const correctedAreas = ({areas}: RoadCorrections) => areas.map(({polygon}) => {
  const xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1]);
  return {minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
});

// Segment rectangle extended by half the width at each end, so consecutive strips close their joints.
function strip(a: Point2, b: Point2, half: number): Point2[] {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ux = dx / l * half, uz = dz / l * half;
  return [[a[0] - ux + uz, a[1] - uz - ux], [b[0] + ux + uz, b[1] + uz - ux], [b[0] + ux - uz, b[1] + uz + ux], [a[0] - ux - uz, a[1] - uz + ux]];
}

// Convex polygons only.
function clip(triangles: SurveyVertex[][], polygon: Point2[]): [SurveyVertex[][], SurveyVertex[][]] {
  const area = polygon.reduce((s, a, i) => { const b = polygon[(i + 1) % polygon.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0), sign = Math.sign(area);
  const xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const inside: SurveyVertex[][] = [], outside: SurveyVertex[][] = [];
  for (const tri of triangles) {
    if (Math.max(...tri.map(p => p[0])) <= x0 || Math.min(...tri.map(p => p[0])) >= x1 || Math.max(...tri.map(p => p[1])) <= z0 || Math.min(...tri.map(p => p[1])) >= z1) { outside.push(tri); continue; }
    let rest = tri;
    for (let e = 0; e < polygon.length && rest.length; e++) {
      const a = polygon[e], b = polygon[(e + 1) % polygon.length];
      const [yes, no] = splitPolygon(rest, p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
      for (let j = 1; j < no.length - 1; j++) outside.push([no[0], no[j], no[j + 1]]);
      rest = yes;
    }
    for (let j = 1; j < rest.length - 1; j++) inside.push([rest[0], rest[j], rest[j + 1]]);
  }
  return [inside, outside];
}

const is = (tri: SurveyVertex[], colour: number[]) => tri.every(p => colour.every((c, k) => Math.abs(p[3 + k] - c) < .015));
// splitPolygon shares unsplit corners between the inside and outside pieces; painting in place would bleed.
const paint = (tri: SurveyVertex[], colour: number[]) => { tri.forEach((p, i) => { tri[i] = [...p.slice(0, 3), ...colour, ...p.slice(6)]; }); };
