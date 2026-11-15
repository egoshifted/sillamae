import type {Point2, Polygon} from '../../../engine/types.ts';

// Plan axes: u runs along the Kesk street front from its west corner, left to right when facing
// the building from the street. v runs from that front towards the rear. Heights are metres above
// the ground at the foot of the Kesk steps. The survey footprint is a rectangle to within 0.1 m;
// everything else is estimated from Street View, the 2021 sale photos and the orthophoto, and stays
// provisional until reviewed.
export const footprint: Polygon = [[218.6, 505.7], [219.6, 503.5], [227, 506.8], [226.1, 508.8], [229.2, 510.3], [222.2, 525.4], [196.7, 513.6], [203.7, 498.7]];
const frontWest = footprint[6], frontEast = footprint[5];

export const length = Math.hypot(frontEast[0] - frontWest[0], frontEast[1] - frontWest[1]);
export const axisU: Point2 = [(frontEast[0] - frontWest[0]) / length, (frontEast[1] - frontWest[1]) / length];
// The footprint turns clockwise in survey x/z, so the rear lies to the left of u.
export const axisV: Point2 = [axisU[1], -axisU[0]];
export const planOrigin = frontWest;
export const planPoint = (u: number, v: number): Point2 => [planOrigin[0] + axisU[0] * u + axisV[0] * v, planOrigin[1] + axisU[1] * u + axisV[1] * v];
// Mean of the two end walls, 16.46 and 16.64 m in the survey.
export const width = 16.55;

export const surveyDatum = 11.19;

export const design = {
  wall: .5,
  // The rendered base reads as a separate grey or white band about 1.2 m high in every photograph.
  plinth: 1.2,
  eave: 5.6,
  // Survey building height is 10.44 m above its lowest ground; the ridge sits a little below that.
  ridge: 10.1,
  // The sheets stop just past the eave cornice and the raking cornices (owner's Aug 2024 view).
  eaveOverhang: .36,
  rake: .25,
  roofThickness: .12,
  // Centre frontispiece on the Kesk front: a shallow projection under its own pediment, read from
  // Street View 2024 at the opposite pano. Its outward step is not in the survey footprint.
  // Flush with the wall (owner's crop of the 2024 front). Its raking cornice starts `knee` above the eave, on
  // sloped shoulders over the ends of the main eave cornice, which does not cross it.
  frontispiece: {from: 13.4, to: 22.2, proud: 0, apex: 9.4, knee: .45},
  // Rear wing, taken from the survey footprint; gabled towards the service road on the orthophoto. Its pediment
  // stands on shoulders like the frontispiece's (owner's Sept 2023 rear view), so its sides rise to `knee`.
  wing: {from: 16.55, to: 24.65, depth: 2.3, apex: 9, knee: .45},
  // Landing and steps in front of the frontispiece door, top level with the plinth. The flight starts
  // at the door's west jamb and runs east of it (close Street View frame, yaw 25).
  landing: {from: 12.9, to: 23, depth: 1.8},
  stairs: {from: 17.05, to: 20.05, rise: .15, tread: .3},
  // West gable door is reached by a flight along the wall, rising north from below window g5.
  westLanding: {from: 5.9, to: 7.7, out: 1.3},
  // Blue-grey cellar entrance on the rear wall at the west corner, door in its tall west end; its roof falls
  // east along the wall almost to the ground (Street View from the NW and NE, owner's Sept 2023 view).
  // Heights are above the ground beside it.
  porch: {from: .4, to: 3.6, out: 2, high: 2.4, low: .45, door: {from: .5, to: 1.4, head: 2}},
};

export type Opening = {id: string; kind: 'window' | 'door' | 'attic'; from: number; to: number; sill: number; head: number};

const glazed = (id: string, from: number, to: number, sill: number, head: number): Opening => ({id, kind: 'window', from, to, sill, head});
const door = (id: string, from: number, to: number, head: number): Opening => ({id, kind: 'door', from, to, sill: design.plinth, head});

// Positions along each wall in metres; heights above the datum. Read from the saved Street View
// frames on each wall's own plane (front ~32.6 px/m, west gable ~42.9, east gable ~56.6), so
// ±0.15 m along and ±0.3 m in height. Widths are kept as read, not evened out.
export const front: Opening[] = [glazed('front-w1', 5, 6.7, 2.5, 4.6), glazed('front-w2', 7.4, 8.7, 2.5, 4.6), glazed('front-w3', 9.4, 10.7, 2.5, 4.6)];
// Symmetric about the frontispiece axis, where the photo differed by under 0.1 m.
const axis = (design.frontispiece.from + design.frontispiece.to) / 2;
export const frontispieceOpenings: Opening[] = [
  glazed('frontispiece-w1', axis - 3.25, axis - 1.45, 2.5, 4.6), door('frontispiece-door', axis - .75, axis + .75, 4.6), glazed('frontispiece-w2', axis + 1.45, axis + 3.25, 2.5, 4.6),
];
// Gables run in v, from the Kesk front towards the rear.
export const westGable: Opening[] = [
  glazed('west-g6', 1.8, 2.5, 2.3, 4.7), glazed('west-g5', 3, 4.15, 2.3, 4.7), glazed('west-g4', 4.9, 5.85, 2.3, 4.7),
  door('west-door', 6.2, 7.4, 4.3), glazed('west-g3', 9.1, 10.4, 2.3, 4.7), glazed('west-g2', 11.4, 12.8, 2.3, 4.7), glazed('west-g1', 13.55, 15, 2.3, 4.7),
];
// The east yard lies about level with the hall floor, so this door opens at ground level.
const centre = width / 2, pair = (id: string, near: number, far: number): Opening[] => [glazed(id + '-south', centre - far, centre - near, 2.3, 4.4), glazed(id + '-north', centre + near, centre + far, 2.3, 4.4)];
export const eastGable: Opening[] = [...pair('east-outer', 3.8, 4.95), ...pair('east-inner', 1.75, 2.9), door('east-door', centre - .7, centre + .7, 4.3)];
// Rear, in u. The wing face is read from the NE pano (yaw 180/215, ~40 px/m) and mirrored about the
// wing axis (read offsets differed by 0.4 m, within the perspective error at that angle); the rear
// ground is about 1.5 m above the datum there. The rear wall east of the wing is blank; west of it the
// NE pano (yaw 250) shows its whole length with a single window just east of the porch. The tall pair
// in the NW pano is the wing face seen edge-on, not more rear windows.
const wingAxis = (design.wing.from + design.wing.to) / 2;
export const wingFace: Opening[] = [
  glazed('wing-west', wingAxis - 2.75, wingAxis - 1.6, 2.65, 4.7), glazed('wing-centre', wingAxis - .6, wingAxis + .6, 2.65, 4.7), glazed('wing-east', wingAxis + 1.6, wingAxis + 2.75, 2.65, 4.7),
];
export const rear: Opening[] = [glazed('rear-w1', 4.2, 5.2, 2.65, 4.7)];
// Tall and narrow, about 4:1 (owner's Sept 2023 east gable view).
export const atticWindow = (id: string): Opening => ({id, kind: 'attic', from: centre - .22, to: centre + .22, sill: 7.1, head: 8.75});

export const slope = (design.ridge - design.eave) / (width / 2);
export const roofUnderside = (v: number) => design.ridge - slope * Math.abs(v - width / 2);

const {stairs, landing} = design;
export const risers = Math.round(design.plinth / stairs.rise);
export const stairFoot = (): Point2 => planPoint((stairs.from + stairs.to) / 2, -landing.depth - stairs.tread * (risers - 1) - .3);
// Ground points just outside every door: the Kesk flight, the west gable flight, the east gable door and the
// rear cellar entrance. Only the Kesk flight seats the model.
export const doorFeet = (): Point2[] => {
  const {westLanding, porch} = design;
  return [
    stairFoot(), planPoint(-westLanding.out / 2, westLanding.from - stairs.tread * (risers - 1) - .3),
    planPoint(length + .5, width / 2), planPoint(porch.from - .5, width + (porch.door.from + porch.door.to) / 2),
  ];
};

// Detail pass, all estimated from the saved frames and the sale photos; provisional.
export const detail = {
  // Pale moulded eave cornice under the overhang; on the end gables it returns about 0.9 m, as a pediment.
  // Stepped moulding under a sloped sheet cap; the gable returns use the same section. At each pediment foot
  // the eave cornice runs `shoulder` into the gable under a sheet-clad wedge falling inwards from the rake's
  // foot (owner's close crop of the 2024 front and Sept 2023 rear).
  cornice: {depth: .32, height: .38, cap: .07, return: 1.1, shoulder: 1},
  verge: {depth: .22, height: .34, step: .1},
  // Pale pilasters and a hood over the east gable door (owner's Sept 2023 view).
  eastDoor: {pier: .3, hood: .22, hoodProud: .18},
  // Red-brown box dormers: one on the street slope (Street View yaw 20, orthophoto), one on the rear slope
  // (drone dji_0488, orthophoto). `set` is the face's distance up-slope from its wall, `rise` its height
  // above the roof there.
  dormers: [
    {id: 'dormer-front', side: 'front', from: 7.6, to: 9.6, set: 2, rise: 1.1},
    {id: 'dormer-rear', side: 'rear', from: 9.5, to: 11.5, set: 2, rise: 1.1},
  ] as const,
  dormerWindow: {width: 1.1, height: .6, sill: .25},
  // Rust-brown wrought iron with a row of interlocking ovals between two rails (img_20211011_162054).
  rail: {height: .95, foot: .1, post: .04, pitch: 1.4, ring: {spacing: .24, radius: .13, tube: .008}},
  newel: {height: 1.12, ball: .075},
  surround: .18,
  // The wing's window group, shown repaired: pale pilasters at each end and between the windows on a
  // continuous sill band with consoles, under a frieze and a hood cornice. In 2023 the hood is broken back to
  // its core and the pilasters are stripped to boards (NE pano yaw 180, owner's Sept 2023 rear view).
  wingGroup: {pier: .36, proud: .05, sillBand: .16, console: .26, frieze: .26, hood: .24, hoodProud: .18},
  vent: {u: 12.5, h: 4.4, radius: .3},
  // The Kesk door is a 1 m leaf beside a fixed panel (Street View yaw 25).
  doorLeaf: 1,
};
export const grilled = new Set(['frontispiece-w2', 'east-outer-south', 'east-outer-north', 'east-inner-south', 'east-inner-north']);
const brown = ['front-', 'frontispiece-', 'wing-', 'east-'];
export const frameFinish = (id: string) => brown.some(prefix => id.startsWith(prefix)) ? 'darkFrame' as const : 'frame' as const;
