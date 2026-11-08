import {baseElevation, type SurveyPoint} from './design.ts';
import {wallCorners} from './cornice.ts';
import {streetWalls} from './street.ts';
import {streetDownpipes} from './access.ts';
import {refinedLevels} from './levels.ts';

// A mark on one wall: t along the edge from wall corner `edge`, h the survey elevation of its centre,
// w and tall half extents in metres, strength 0–1.
export interface Patch {edge: number; t: number; h: number; w: number; tall: number; strength: number}
// A run-off streak hanging from `top` for `length` metres.
export interface Streak {edge: number; t: number; top: number; w: number; length: number; strength: number}

// Grey damp and mould patches traced from the May 2024 Street View frames: on the Kesk front they gather
// under the eaves beside the bay 2/3 downpipe and left of bay 3; on the Kajaka front beside the bay 1/2 pipe,
// left of bay 3, around the mid pipe and low on the bay 4 pilaster. Shapes are approximations, not surveys.
export const dampPatches: Patch[] = [
  {edge: 7, t: .225, h: 22.2, w: .85, tall: 1.15, strength: .9},
  {edge: 7, t: .292, h: 22.5, w: .5, tall: .85, strength: .75},
  {edge: 7, t: .505, h: 22.9, w: .6, tall: .6, strength: .6},
  {edge: 7, t: .78, h: 23.0, w: .55, tall: .5, strength: .5},
  {edge: 7, t: .40, h: 16.3, w: .7, tall: .35, strength: .55},
  {edge: 0, t: .135, h: 22.6, w: .7, tall: .9, strength: .8},
  {edge: 0, t: .30, h: 22.7, w: .45, tall: .6, strength: .65},
  {edge: 0, t: .50, h: 22.8, w: .6, tall: .7, strength: .6},
  {edge: 0, t: .87, h: 23.0, w: .5, tall: .5, strength: .5},
  {edge: 0, t: .40, h: 16.3, w: .55, tall: .4, strength: .6},
];

const sillDrop = .115;
export function wearStreaks(): Streak[] {
  const streaks: Streak[] = [];
  for (const [key, schedule] of Object.entries(streetWalls)) {
    const edge = Number(key);
    for (const bay of schedule!.bays) for (const upper of [false, true]) {
      const kind = upper ? bay.upper : bay.lower;
      if (kind !== 'window') continue;
      const sill = (upper ? refinedLevels.upper[0] : refinedLevels.lower[0]) - sillDrop;
      streaks.push({edge, t: bay.centre, top: sill, w: .72, length: upper ? 1.4 : 1.0, strength: upper ? .8 : .6});
    }
    for (const bay of schedule!.bays) if (bay.upper === 'balcony')
      streaks.push({edge, t: bay.centre, top: refinedLevels.balcony - .25, w: 1.2, length: 1.4, strength: .7});
    streaks.push(...streetDownpipes.filter(p => p.edge === edge).map(p =>
      ({edge, t: p.fraction, top: 23.4, w: .32, length: 7.6, strength: .5})));
  }
  return streaks;
}

// Packs marks as pairs of vec4 in model space (survey minus the building centre, height above base).
export function wearUniforms(centre: readonly number[]) {
  const walls = wallCorners();
  const frame = (edge: number, t: number) => {
    const a = walls[edge], b = walls[(edge + 1) % walls.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at: SurveyPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
    return {x: at[0] - centre[0], z: at[1] - centre[1], dx: (b[0] - a[0]) / length, dz: (b[1] - a[1]) / length};
  };
  const patches = dampPatches.flatMap(p => {const f = frame(p.edge, p.t); return [[f.x, p.h - baseElevation, f.z, p.w], [f.dx, f.dz, p.tall, p.strength]];});
  const streaks = wearStreaks().flatMap(s => {const f = frame(s.edge, s.t); return [[f.x, s.top - baseElevation, f.z, s.w], [f.dx, f.dz, s.length, s.strength]];});
  return {patches, streaks};
}
