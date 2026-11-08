import * as THREE from 'three';
import {eaves, surveyRoof, type RoofShape, type SurveyPoint} from './design.ts';
import {roofHeight} from './roof.ts';

type Emit = (p: SurveyPoint) => void;

// Along the eave edge: t is the fraction from eave point `edge`, along/setback offsets are metres.
// w and d are half extents along and across the eave; rise is the height above the highest roof contact.
export interface Stack {edge: number; group: number; t: number; along: number; setback: number; w: number; d: number; rise: number; clad: boolean}

export const chimneyRows = [
  {edge: 0, fractions: [.22, .5, .78]},
  {edge: 7, fractions: [.22, .5, .78]},
] as const;

const draftStacks: Stack[] = chimneyRows.flatMap(row => row.fractions.flatMap((t, group) => [1.7, 3.25, 4.8].map(setback =>
  ({edge: row.edge, group, t, along: 0, setback, w: .34, d: .4, rise: 1.1, clad: false}))));

type Row = readonly Omit<Stack, 'edge' | 'group' | 't' | 'along'>[];
// Stacks stand in rows running up the slope (Maa-amet aerial); seen from the street the tall front one
// hides most of the row, so the rear ones read as slimmer stacks stepping down beside it.
const cladRow: Row = [
  {setback: 1.9, w: .48, d: .55, rise: 2.4, clad: true},
  {setback: 3.3, w: .25, d: .3, rise: 1.7, clad: true},
  {setback: 4.5, w: .22, d: .28, rise: 1.2, clad: true},
];
const plainRow: Row = [
  {setback: 1.9, w: .35, d: .35, rise: 1.3, clad: false},
  {setback: 3.3, w: .2, d: .25, rise: 1.2, clad: false},
  {setback: 4.5, w: .2, d: .25, rise: .9, clad: false},
];
const lowRow: Row = [
  {setback: 3.0, w: .25, d: .25, rise: .7, clad: false},
  {setback: 3.9, w: .25, d: .25, rise: .7, clad: false},
  {setback: 4.8, w: .25, d: .25, rise: .7, clad: false},
];
const row = (edge: number, group: number, t: number, stacks: Row) => stacks.map(s => ({...s, edge, group, t, along: 0}));

// Kesk street slope (edge 7): only the clad row near the west hip; the box in the owner's circle 2 is a low row
// high on the courtyard slope (edge 5), showing over the ridge. Kajaka street slope (edge 0): clad rows at the
// north and middle, plain boxes past the south dormer. Positions: Maa-amet aerial with Street View May 2024;
// sizes scale from window widths in those frames, and the stack depths are estimates.
export const roofStacks: Stack[] = [
  ...row(7, 0, .2, cladRow),
  ...row(5, 0, .24, lowRow),
  ...row(0, 0, .22, cladRow),
  ...row(0, 1, .5, cladRow),
  ...row(0, 2, .78, plainRow),
];

export function stackFrame(s: Stack, shape: RoofShape = surveyRoof) {
  const a = eaves[s.edge], b = eaves[(s.edge + 1) % eaves.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
  const cx = a[0] + (b[0] - a[0]) * s.t + ux * s.along - uz * s.setback;
  const cz = a[1] + (b[1] - a[1]) * s.t + uz * s.along + ux * s.setback;
  const at = (u: number, v: number, height: number): SurveyPoint => [cx + ux * u - uz * v, cz + uz * u + ux * v, height];
  const ground = (u: number, v: number, lift: number) => {const [x, z] = at(u, v, 0); return roofHeight(x, z, shape) + lift;};
  const corners = [[-s.w, -s.d], [s.w, -s.d], [s.w, s.d], [-s.w, s.d]];
  const top = Math.max(...corners.map(([u, v]) => ground(u, v, .035))) + s.rise;
  return {at, ground, top, ux, uz};
}

export function addChimneys(wall: Emit, metal: Emit, inside: Emit, part: (id: string, name: string) => void, shape: RoofShape = surveyRoof, refined = false) {
  const counts = new Map<string, number>();
  for (const s of refined ? roofStacks : draftStacks) {
    const key = s.edge + '-' + s.group, stack = counts.get(key) ?? 0;
    counts.set(key, stack + 1);
    const {at, ground, top, ux, uz} = stackFrame(s, shape), {w, d} = s;
    const rectangle = (w: number, d: number, height: number | ((u: number, v: number) => number)) => [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, v]) => at(u, v, typeof height === 'number' ? height : height(u, v)));
    const lower = rectangle(w, d, (u, v) => ground(u, v, .035));
    const upper = rectangle(w, d, top - .08), rim = rectangle(w+.06, d+.06, top);
    const lip = rectangle(w+.06, d+.06, top - .08), hole = rectangle(w-.12, d-.12, top);
    const well = rectangle(w-.12, d-.12, top - .42);
    const id = `chimney-${key}-${stack}`, name = `Edge ${s.edge} chimney group ${s.group + 1} stack ${stack + 1}`;
    function surface(points: SurveyPoint[], normal: number[], emit: Emit) {
      for (let i = 1; i < points.length - 1; i++) {
        const [p, q, r] = [points[0], points[i], points[i + 1]];
        const cross = new THREE.Vector3(q[0] - p[0], q[2] - p[2], q[1] - p[1]).cross(new THREE.Vector3(r[0] - p[0], r[2] - p[2], r[1] - p[1]));
        (cross.dot(new THREE.Vector3(...normal)) >= 0 ? [p, q, r] : [p, r, q]).forEach(emit);
      }
    }
    const normals = [[uz, 0, -ux], [ux, 0, uz], [-uz, 0, ux], [-ux, 0, -uz]];
    part(id + '/body', name + ' body');
    for (let i = 0; i < 4; i++) {const j = (i + 1) % 4; surface([lower[i], lower[j], upper[j], upper[i]], normals[i], wall);}
    part(id + '/flashing', name + ' flashing and rim');
    const apron = rectangle(w+.15, d+.15, (u, v) => ground(u, v, .035));
    const foot = rectangle(w+.15, d+.15, (u, v) => ground(u, v, 0));
    const collar = rectangle(w, d, (u, v) => ground(u, v, .18));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      surface([apron[i], apron[j], collar[j], collar[i]], [0, 1, 0], metal);
      surface([foot[i], foot[j], apron[j], apron[i]], normals[i], metal);
      surface([rim[i], rim[j], hole[j], hole[i]], [0, 1, 0], metal);
      surface([lip[i], lip[j], rim[j], rim[i]], normals[i], metal);
      surface([upper[i], upper[j], lip[j], lip[i]], [0, -1, 0], metal);
    }
    part(id + '/flue', name + ' open flue');
    for (let i = 0; i < 4; i++) {const j = (i + 1) % 4; surface([hole[i], hole[j], well[j], well[i]], normals[i].map(v => -v), inside);}
    surface(well, [0, 1, 0], inside);
  }
}

export function stackIds(refined: boolean) {
  const counts = new Map<string, number>();
  return (refined ? roofStacks : draftStacks).map(s => {
    const key = s.edge + '-' + s.group, stack = counts.get(key) ?? 0;
    counts.set(key, stack + 1);
    return {stack: s, id: `chimney-${key}-${stack}`};
  });
}
