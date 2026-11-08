import * as THREE from 'three';
import type {FacadeLevels} from './levels.ts';
import type {OpeningDetail} from './joinery.ts';
import {baseElevation, type SurveyPoint} from './design.ts';

type UpperOpening = 'window' | 'balcony';
type Bay = {centre: number; upper: UpperOpening} & ({lower: 'door'; threshold: number} | {lower?: 'window'});
type Schedule = {bays: Bay[]; setback?: boolean; courtyard?: boolean};

const street: Schedule = {
  bays: Array.from({length: 10}, (_, i) => ({
    centre: .08 + i * .84 / 9, lower: 'window', upper: i === 3 || i === 6 ? 'balcony' : 'window',
  })),
};

export const streetWalls: Partial<Record<number, Schedule>> = {0: street, 7: street};

// Both street fronts carry the garland window second from each end (Street View May 2024).
export const garlandBays = [2, 9] as const;
export function hasGarland(edge: number, bay: number) {
  return !!streetWalls[edge] && (garlandBays as readonly number[]).includes(bay);
}

// Upper sashes still in brown-stained timber; every other street sash is white PVC (Street View May 2024).
export const timberSashes: Partial<Record<number, readonly number[]>> = {7: [2, 7, 8, 9, 10], 0: [1, 2]};
export const courtyardWalls: Partial<Record<number, Schedule>> = {
  2: {courtyard: true, bays: [
    {centre: .10, lower: 'window', upper: 'window'}, {centre: .30, lower: 'window', upper: 'balcony'},
    {centre: .50, lower: 'door', upper: 'window', threshold: 15.24}, {centre: .70, lower: 'window', upper: 'balcony'},
    {centre: .90, lower: 'window', upper: 'window'},
  ]},
  4: {courtyard: true, setback: true, bays: [
    {centre: .29, lower: 'window', upper: 'window'}, {centre: .80, lower: 'door', upper: 'window', threshold: 15.28},
  ]},
  // This edge runs from the inside corner to the outer end, opposite the reference bay numbering.
  5: {courtyard: true, bays: [
    {centre: .065, upper: 'window'}, {centre: .21, lower: 'window', upper: 'window'},
    {centre: .355, lower: 'window', upper: 'window'}, {centre: .50, lower: 'window', upper: 'balcony'},
    {centre: .645, lower: 'door', upper: 'window', threshold: 15.22}, {centre: .79, lower: 'window', upper: 'balcony'},
    {centre: .935, lower: 'window', upper: 'window'},
  ]},
};

export const endWalls: Partial<Record<number, Schedule>> = {
  1: {bays: [{centre: .28, lower: 'window', upper: 'window'}, {centre: .72, lower: 'window', upper: 'window'}]},
  6: {bays: [{centre: .28, lower: 'window', upper: 'window'}, {centre: .72, lower: 'window', upper: 'window'}]},
};

type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;
export function addOpeningWall(a: SurveyPoint, b: SurveyPoint, schedule: Schedule, vertex: Emit, inset: Emit, door: Emit, part?: Part, detail?: (opening: OpeningDetail) => void, ornament = false, levels?: FacadeLevels, levelSetback = false, topBreaks: readonly (readonly [number,number])[] = []) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  const point = (x: number, y: number, depth = 0): SurveyPoint =>
    [a[0] + dx*x - dz*depth, a[1] + dz*x + dx*depth, y];
  const at = (x: number, y: number) => new THREE.Vector2(x, y);
  const outline = [at(0, baseElevation), at(length, baseElevation), at(length, b[2]), ...[...topBreaks].reverse().map(([t,h])=>at(length*t,h)), at(0, a[2])];
  const holes: THREE.Vector2[][] = [];
  for (const [index, bay] of schedule.bays.entries()) {
    const centre = length * bay.centre;
    for (const upper of [false, true]) {
      const kind = upper ? bay.upper : bay.lower;
      if (!kind) continue;
      const id = `bay-${index + 1}/${upper ? 'L2' : 'L1'}`;
      const label = `Bay ${index + 1} ${upper ? 'L2' : 'L1'}`;
      part?.(id + '/reveal', label + ' reveal');
      const balcony = kind === 'balcony';
      const width = kind === 'door' ? 1.36 : balcony || (ornament && !schedule.courtyard && !upper && bay.upper === 'balcony') ? 1.75 : 1.44;
      const left = centre - width/2, right = centre + width/2;
      const lift = schedule.setback && !levelSetback ? 1.30 : 0;
      const bottom = !upper && bay.lower === 'door' ? bay.threshold : balcony ? levels?.balcony ?? 18.55 : (upper ? levels?.upper[0] ?? 19.37 : levels?.lower[0] ?? 16.00) + lift;
      const top = kind === 'door' ? bottom + 2.17 : (upper ? levels?.upper[1] ?? 21.51 : levels?.lower[1] ?? 18.14) + lift;
      const loop = [at(left, bottom), at(right, bottom), at(right, top), at(left, top)];
      holes.push(loop);
      const front = loop.map(p => point(p.x, p.y)), back = loop.map(p => point(p.x, p.y, .18));
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        [front[i], back[next], front[next], front[i], back[i], back[next]].forEach(vertex);
      }
      part?.(id + '/infill', label + (kind === 'door' ? ' door' : ' glazing'));
      [back[0], back[2], back[1], back[0], back[3], back[2]].forEach(kind === 'door' ? door : inset);
      detail?.({id, label, kind, bay: index + 1, upper, left, right, bottom, top, courtyard: !!schedule.courtyard, point});
      if (balcony) {
        part?.(id + '/slab', label + ' balcony slab');
        const halfWidth = schedule.courtyard ? 1.05 : 1.30, projection = schedule.courtyard ? .65 : .85;
        const x0 = centre - halfWidth, x1 = centre + halfWidth, under = bottom - .16;
        const slab = [point(x0, bottom), point(x1, bottom), point(x1, bottom, -projection), point(x0, bottom, -projection)];
        const soffit = slab.map(([x, z]): SurveyPoint => [x, z, under]);
        [slab[0], slab[1], slab[2], slab[0], slab[2], slab[3],
          soffit[0], soffit[2], soffit[1], soffit[0], soffit[3], soffit[2]].forEach(vertex);
        for (const i of [1, 2, 3]) {
          const next = (i + 1) % 4;
          [slab[i], soffit[i], soffit[next], slab[i], soffit[next], slab[next]].forEach(vertex);
        }
      }
    }
  }
  part?.('wall', 'Wall');
  const points = outline.concat(...holes);
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(outline, holes)) {
    for (const index of [i, k, j]) vertex(point(points[index].x, points[index].y));
  }
}
