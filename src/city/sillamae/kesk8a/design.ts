import type {Point2, Polygon} from '../../../engine/types.ts';

// Plan axes: u runs along the south-west front from its north-west corner, left to right
// when facing the door. v runs from the front towards the rear. Heights are metres above
// the paving at the front steps. Everything except the footprint and ridge is estimated
// from Street View and stays provisional until reviewed.
export const footprint: Polygon = [[277, 545.9], [286.7, 538], [293.6, 546.5], [283.9, 554.4]];
const [west, north, , south] = footprint;

export const length = Math.hypot(south[0] - west[0], south[1] - west[1]);
export const width = Math.hypot(north[0] - west[0], north[1] - west[1]);
export const axisU: Point2 = [(south[0] - west[0]) / length, (south[1] - west[1]) / length];
export const axisV: Point2 = [(north[0] - west[0]) / width, (north[1] - west[1]) / width];
export const planPoint = (u: number, v: number): Point2 => [west[0] + axisU[0] * u + axisV[0] * v, west[1] + axisU[1] * u + axisV[1] * v];
export const planOrigin = west;

export const surveyDatum = 13.96;

// Everything on the front mirrors about this line, by the owner's instruction: photo-read
// positions differed by up to 0.2 m, more than their error, and read as crooked.
export const axis = length / 2;
const around = (half: number): [number, number] => [axis - half, axis + half];

export const design = {
  wall: .38,
  plinth: .3,
  ridge: 8.96,
  eave: 4.75,
  eaveOverhang: .5,
  // Eaves and verges share one profile: a fascia, then a straight soffit falling back to the wall.
  // Heights are below the roof's top edge for eaves and below its underside for verges.
  eaveFascia: .3,
  eaveDepth: .52,
  fasciaProud: .02,
  rake: .5,
  verge: {fascia: .2, drop: .42},
  roofThickness: .06,
  belt: {bottom: 3.42, top: 3.66, proud: .12, gap: around(.68), return: .75},
  // Two stepped shoulders and a central gable, read from the owner's annotated photograph.
  attic: {
    left: axis - 1.535, right: axis + 1.535, shoulder: 5.5, inner: around(1.085), step: 5.95, rake: around(.81), apex: 6.57, centre: axis, thickness: .25,
    dormerEave: 5.9, dormerDepth: 2.6, capDrop: .02, capOverhang: .15, capThickness: .1,
  },
  stairs: {left: axis - 1.615, right: axis + 1.615, flank: .78, rise: .153, risers: 3, tread: .3, landing: 1.25},
  rearLanding: {rise: .35, width: 1.5, depth: 1.1, stepDepth: .35},
};

// All estimated from view-front, entrance-steps, rear-closeup and the owner's annotated photographs.
export const detail = {
  rustication: {count: 7, joint: .02, proud: .05, corner: .55},
  doorFlanks: [[axis - 1.4, axis - .74], [axis + .74, axis + 1.4]] as [number, number][],
  belt: {cap: {proud: .2, rise: .04, lap: .04}},
  pier: {
    left: axis - .85, right: axis + .85, bottom: 3.01, top: 4.16, proud: .06, capReach: .1, capHeight: .08, capProud: .14,
    panel: {left: axis - .35, right: axis + .35, bottom: 3.13, top: 3.85, line: .025},
  },
  sign: {left: axis - .765, right: axis + .765, bottom: 4.29, top: 4.97},
  eaveStrip: .06,
  frame: .06,
  smallFrame: .05,
  smallGrid: {pitch: .15},
  surround: .1,
  sill: {reach: .1, height: .09, proud: .09},
  grille: {columns: 3, rows: 5, bar: .018, near: -.1, far: -.082},
  doorSplit: .66,
  slatPitch: .13,
  // Placed where the owner marked it. The post stands clear of the 0.09 m window sill just beside it.
  rail: {u: 7.03, height: 1.08, wallPost: -.12, outerPost: -1.14, bend: 1.05, tail: {out: .54, drop: .28}},
  // Stone litter bins from the owner's entrance photo: a square one on the left, a round one on the right.
  bins: {
    square: {size: .62, body: .45, collar: .66, top: .7},
    round: {radius: .28, top: .62, rim: .3, rimHeight: .06},
    hollow: .08,
  },
  lamp: {at: 6.2, height: 2.95},
  vent: {at: 3, height: 2.5, radius: .07},
  cable: {at: 7.05, height: 2.85},
};

export const slope = (design.ridge - design.eave) / (width / 2 + design.eaveOverhang);
export const wallTop = design.eave - design.roofThickness + slope * design.eaveOverhang;
export const roofUnderside = (v: number) => design.ridge - design.roofThickness - slope * Math.abs(v - width / 2);

export const atticOutline = (): [number, number][] => {
  const {left, right, shoulder, inner, step, rake, apex, centre} = design.attic;
  return [
    [left, wallTop], [right, wallTop], [right, shoulder], [inner[1], shoulder], [inner[1], step], [rake[1], step],
    [centre, apex], [rake[0], step], [inner[0], step], [inner[0], shoulder], [left, shoulder],
  ];
};

export interface Opening {id: string; from: number; to: number; sill: number; head: number; kind: 'door' | 'window' | 'louvre'; blank?: [number, number]}

export const threshold = design.stairs.rise * design.stairs.risers;

// The blank spans are the opaque white panels that fill part of each shop window.
export const front: Opening[] = [
  {id: 'front-window-left', from: axis - 4.55, to: axis - 1.64, sill: 1.28, head: 3.01, kind: 'window', blank: [axis - 4.55, axis - 3.6]},
  {id: 'front-door', from: axis - .74, to: axis + .74, sill: threshold, head: threshold + 2.5, kind: 'door'},
  {id: 'front-window-right', from: axis + 1.64, to: axis + 4.55, sill: 1.28, head: 3.01, kind: 'window', blank: [axis + 3.6, axis + 4.55]},
];

// Measured from the north corner along the rear. A parked lorry hides most of this wall
// in the 2022 view, so the positions rest mainly on one oblique 2024 view.
export const rear: Opening[] = [
  {id: 'rear-window-north', from: 3.98, to: 4.73, sill: 1.1, head: 2.55, kind: 'window'},
  {id: 'rear-door', from: 4.925, to: 5.975, sill: 0, head: 2.1, kind: 'door'},
  {id: 'rear-window-south', from: 6.175, to: 6.925, sill: 1.1, head: 2.55, kind: 'window'},
];

const louvres = (prefix: string): Opening[] => [-1, 1].map((side, i) => ({
  id: `${prefix}-louvre-${i + 1}`, from: width / 2 + side * 1.06 - .25, to: width / 2 + side * 1.06 + .25, sill: 5, head: 5.9, kind: 'louvre',
}));

// Gable positions are v, from the front corner towards the rear.
export const gableNorthWest: Opening[] = [
  ...louvres('north-west'),
  {id: 'north-west-window', from: width - 3.32, to: width - 2.72, sill: 1.34, head: 2.87, kind: 'window'},
];
export const gableSouthEast: Opening[] = louvres('south-east');

export const frontDoorFoot = (): Point2 => planPoint((design.stairs.left + design.stairs.right) / 2, -2.3);
export const rearDoorFoot = (): Point2 => planPoint(5.45, width + 1.6);
