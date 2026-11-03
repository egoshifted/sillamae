import {kesk1Design} from '../kesk1/index.ts';
import {orthogonalPlan} from '../kesk1/plan.ts';
import type {Point2} from '../../../engine/types.ts';

export const id = '109978280';

// Owner-authorised transfer from Kesk 1, the same architectural type. Kesk 1's
// individually observed units and fixtures stay off until Kesk 7 evidence shows them.
export const kesk7Design: typeof kesk1Design = Object.freeze({
  ...kesk1Design,
  number: '7',
  openBalconies: [], rearBrownFloors: [], brownBalconies: [], timberBalconies: [], sunburstBalconies: [], timberWindows: [],
  fanlightGrille: false, flowerBox: false, flag: false, dish: false,
  vents: [], liftRoofDetails: false,
  // June 2012 Street View (east): on the stepped strip at the far end of the
  // wall beside the entrance, about 0.35 m lower than Kesk 1's. Approximate.
  // The street plate is about as wide as the number plate; both fit the 0.6 m strip.
  plaque: {edge: 8, x: -.3, y: 3.65, depth: -.12, streetWidth: .45},
  annexFinish: 'brick' as const, // 2025 Street View from the north parking area
  lightwells: true, // June 2012 Street View: basement window at grade in a cut well
  // Owner, 2012 and 2024 Street View: door at grade without steps; the canopy
  // reads as a flat slab. Its depth and height remain Kesk 1's, provisionally.
  entranceStair: false, entranceCanopyUpstand: false,
  // September 2023 Street View (north): five steps at the far end of the wing
  // wall down to a sunken walk and the annex service door, railed at the top.
  annexAccessOnGround: true,
  annexRail: 'metal',
  // June 2012 (edge 8) and September 2023 (edge 1) Street View: about 1.5 x 0.8 m,
  // a wide and a narrow pane. Applied to the unphotographed basement windows too; provisional.
  basementWindow: {width: 1.5, division: .68},
  // September 2023: about 0.4 of the wall from the annex, 0.75 m above the sunken walk. Scaled, approximate.
  wingBasementWindow: {along: .4, y: .6},
});

// The survey lists Kesk 7 clockwise; reversed from its vertex 0 it follows the
// edge numbering the Kesk 1 generator indexes (lengths agree within 0.4 m).
// Once registered the data build stores the reordered plan, so an outline
// already wound like Kesk 1's is only refitted.
export function kesk1Order(points: Point2[]): Point2[] {
  const area = points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  return orthogonalPlan(area > 0 ? points : points.map((_, i) => points[(points.length - i) % points.length]));
}
