import type {SurveyVertex} from '../src/engine/survey/carve.ts';
import type {Point2} from '../src/engine/types.ts';
import {boxOf, editGround, splitByRegion} from './ground-cut.ts';
import type {FootwaySurface, StreetSpec} from './streets.ts';

// Survey ground paints roads as fixed-width strips along generalised centrelines; these colours are its legend.
const ROAD = [.57, .60, .58], FOOTWAY = [.81, .82, .75], VERGE = [.71, .76, .61];

export interface RoadCorrections {
  areas: {
    name: string; polygon: Point2[];
    roads: {osm: number; width: number; centre: Point2[]; street?: StreetSpec}[];
    footways?: {osm: number; kind: 'sidewalk' | 'footway' | 'path'; width: number; centre: Point2[]; surface?: FootwaySurface}[];
    carParks?: {name: string; polygon: Point2[]; kerb?: boolean}[];
    crossings?: {osm: number; centre: Point2[]}[];
  }[];
}

// Recolours rather than replaces ground, so the stacked survey layers and their depth order stay untouched.
export function correctRoads(vertices: Float32Array, corrections: RoadCorrections) {
  let changed = 0;
  for (const area of corrections.areas) {
    vertices = editGround(vertices, boxOf(area.polygon), triangles => {
      const {inside, outside} = splitByRegion(triangles, [[area.polygon]]);
      // Footways in a corrected area are all rebuilt by the street layer.
      for (const tri of inside) if (is(tri, ROAD) || (area.footways && is(tri, FOOTWAY))) { paint(tri, VERGE); changed++; }
      const strips = area.roads.flatMap(r => r.centre.slice(1).map((b, k) => [strip(r.centre[k], b, r.width / 2)]));
      const roads = splitByRegion(inside, strips);
      for (const tri of roads.inside) { paint(tri, ROAD); changed++; }
      return [...outside, ...roads.outside, ...roads.inside];
    });
  }
  return {vertices, report: `roads: ${corrections.areas.length} corrected areas, ${changed} ground pieces recoloured`};
}

export const correctedAreas = ({areas}: RoadCorrections) => areas.map(({polygon}) => boxOf(polygon));

// Segment rectangle extended by half the width at each end, so consecutive strips close their joints.
function strip(a: Point2, b: Point2, half: number): Point2[] {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ux = dx / l * half, uz = dz / l * half;
  return [[a[0] - ux + uz, a[1] - uz - ux], [b[0] + ux + uz, b[1] + uz - ux], [b[0] + ux - uz, b[1] + uz + ux], [a[0] - ux - uz, a[1] - uz + ux]];
}

const is = (tri: SurveyVertex[], colour: number[]) => tri.every(p => colour.every((c, k) => Math.abs(p[3 + k] - c) < .015));
const paint = (tri: SurveyVertex[], colour: number[]) => { tri.forEach((p, i) => { tri[i] = [...p.slice(0, 3), ...colour, ...p.slice(6)]; }); };
