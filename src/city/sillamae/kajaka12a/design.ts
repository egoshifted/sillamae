import type {Point2} from '../../../engine/types.ts';

// The Maa-amet orthophoto agrees with these within about 0.5 m along both long edges. The
// survey's door wall is about 2 m out at the north end, so it does not set the plan.
export const plan = {
  doorSouth: [341.7, 772.3] as Point2,
  rearSouth: [335.7, 769.7] as Point2,
  rearNorth: [370.1, 693.4] as Point2,
  doorNorth: [376.1, 696.1] as Point2,
};

// Source x/z for u metres along the row from its south end and n metres out from the door face.
export function planPoint(u: number, n: number): Point2 {
  const s = u / length, t = -n / width;
  const door = [plan.doorSouth[0] + (plan.doorNorth[0] - plan.doorSouth[0]) * s, plan.doorSouth[1] + (plan.doorNorth[1] - plan.doorSouth[1]) * s];
  const rear = [plan.rearSouth[0] + (plan.rearNorth[0] - plan.rearSouth[0]) * s, plan.rearSouth[1] + (plan.rearNorth[1] - plan.rearSouth[1]) * s];
  return [door[0] + (rear[0] - door[0]) * t, door[1] + (rear[1] - door[1]) * t];
}

export const length = (Math.hypot(plan.doorNorth[0] - plan.doorSouth[0], plan.doorNorth[1] - plan.doorSouth[1]) + Math.hypot(plan.rearNorth[0] - plan.rearSouth[0], plan.rearNorth[1] - plan.rearSouth[1])) / 2;
export const width = (Math.hypot(plan.rearSouth[0] - plan.doorSouth[0], plan.rearSouth[1] - plan.doorSouth[1]) + Math.hypot(plan.rearNorth[0] - plan.doorNorth[0], plan.rearNorth[1] - plan.doorNorth[1])) / 2;

// Heights are metres above the datum. The datum is read from the site ground; this is the
// survey ground along the doors, the value the eave heights below were measured against.
export const surveyDatum = 14.35;

// Eaves are [south, north]. The row's two ends are survey (17.00 and 17.67 m); the 0.40 m step
// between the blocks is scaled from photographs.
export const blocks = [
  {name: 'south', doors: 8, eave: [2.65, 2.75]},
  {name: 'north', doors: 18, eave: [3.15, 3.32]},
];

export const design = {
  // Survey fall to the rear, the same at both ends of the row.
  rearFall: .64,
  // Scaled from photographs.
  bandHeight: .72,
  pier: .29,
  // Approximate: scaled from a photograph taken at an angle.
  thickPier: {afterDoor: 14, width: .85},
  wall: .25,
  doorRecess: .1,
  doorLeaf: .06,
  roofThickness: .08,
  overhang: {door: .12, rear: .1, end: .1},
  // Below the lowest ground along the row (13.74 m at the rear).
  foot: -1.2,
};

export interface Span {u0: number; u1: number}

export interface Door {kind: 'steel' | 'plank'; colour: string; latch?: boolean; plate?: boolean; wicket?: boolean; rust?: boolean}

// In order from the south end, read from the May 2024 Street View. Colours are matched by eye in overcast light.
export const doorSchedule: Door[] = [
  {kind: 'steel', colour: '#7a3a32'},
  {kind: 'steel', colour: '#7a3532', latch: true},
  {kind: 'steel', colour: '#94544c', wicket: true},
  {kind: 'steel', colour: '#7d3c34', wicket: true, rust: true},
  {kind: 'steel', colour: '#4a2e2a', rust: true},
  {kind: 'steel', colour: '#6a3229'},
  {kind: 'plank', colour: '#4a2a24', latch: true, plate: true},
  {kind: 'steel', colour: '#743a30'},
  {kind: 'plank', colour: '#3f2a25'},
  {kind: 'steel', colour: '#332622'},
  {kind: 'plank', colour: '#c39a55', latch: true},
  {kind: 'plank', colour: '#33292a'},
  {kind: 'plank', colour: '#9c3a32', latch: true},
  {kind: 'plank', colour: '#2f2622', latch: true},
  {kind: 'steel', colour: '#5f2c26'},
  {kind: 'steel', colour: '#5f2c26', latch: true, plate: true, rust: true},
  {kind: 'steel', colour: '#8c5a3c', latch: true, rust: true},
  {kind: 'plank', colour: '#6b4f44', latch: true},
  {kind: 'steel', colour: '#7c3a30'},
  {kind: 'steel', colour: '#94503a'},
  {kind: 'steel', colour: '#7a3632'},
  {kind: 'steel', colour: '#7a3632'},
  {kind: 'steel', colour: '#4e2c28'},
  {kind: 'plank', colour: '#4a2b27', latch: true},
  {kind: 'plank', colour: '#452825', latch: true},
  {kind: 'steel', colour: '#3e2e2b'},
];

// [first door, last door, colour]. Read from the orthophoto, so bay edges are good to about one door.
export const roofBays: [number, number, string][] = [
  [1, 4, '#5d605e'], [5, 5, '#8b8d89'], [6, 6, '#6e3f33'], [7, 8, '#9eaab0'], [9, 15, '#565755'],
  [16, 17, '#9fa3a2'], [18, 18, '#565755'], [19, 20, '#a9b0b1'], [21, 23, '#5a5a57'], [24, 24, '#9eaab0'], [25, 26, '#565755'],
];

// The photographs show a brighter strip over doors 3 and 4 only.
export const fascia = {colour: '#6b3a2a', height: .13, red: {doors: [3, 4], colour: '#8e3a30'}};

// White metal strips seen on the eave in photographs, narrower than the pale bays in the orthophoto.
export const flashings: [number, number][] = [[7, 8], [19, 20]];

// Drips below the fascia as [after door, width]. Those after doors 15, 17 and 21 are partly inferred.
export const rustStains: [number, number][] = [[2, .3], [4, .5], [5, .4], [15, .35], [16, .6], [17, .3], [21, .3]];

export const finish = {lintel: .28, frame: .05, seam: .012, wave: .167, waveHeight: .03, rear: '#cfccc1', band: '#bdb9ac', brick: '#e4e0d4', frameColour: '#26221f'};

// One width for every door: the photographs show one pattern, but no door has been measured.
export function bays() {
  const doors = blocks.reduce((sum, block) => sum + block.doors, 0);
  const piers = (doors + 1) * design.pier + design.thickPier.width - design.pier;
  const door = (length - piers) / doors;
  const doorSpans: Span[] = [], pierSpans: Span[] = [{u0: 0, u1: design.pier}];
  let u = design.pier;
  for (let i = 1; i <= doors; i++) {
    doorSpans.push({u0: u, u1: u + door});
    u += door;
    const pier = i === design.thickPier.afterDoor ? design.thickPier.width : design.pier;
    pierSpans.push({u0: u, u1: u + pier});
    u += pier;
  }
  const edges = [0];
  let passed = 0;
  for (const block of blocks.slice(0, -1)) {
    passed += block.doors;
    edges.push((pierSpans[passed].u0 + pierSpans[passed].u1) / 2);
  }
  edges.push(length);
  return {doors: doorSpans, piers: pierSpans, blocks: blocks.map((block, i) => ({...block, u0: edges[i], u1: edges[i + 1]}))};
}

export const doorPoints = (): Point2[] => bays().doors.filter((_, i) => i % 5 === 2).map(({u0, u1}) => {
  const s = (u0 + u1) / 2 / length, n = .6 / width;
  const lerp = (a: Point2, b: Point2, t: number): Point2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const door = lerp(plan.doorSouth, plan.doorNorth, s), rear = lerp(plan.rearSouth, plan.rearNorth, s);
  return lerp(door, rear, -n);
});
