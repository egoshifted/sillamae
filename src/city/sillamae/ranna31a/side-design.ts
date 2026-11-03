import {frontDesign as d, type FrontOpening} from './front-design.ts';

// Owner end photographs: east nearly square-on, west oblique above the low wing. Zones from the east photo's top edge (13.35 m end), heights on the floor rows; all inferred.
export const sideDesign = {
  // Front zone to z 2.95, proud middle zone to −3.95, rear zone to the rear line.
  middle: [-3.95, 2.95] as const,
  // A cast shadow on the rear zone and a lit seam at the front zone mark the middle as proud; owner correction from the plan view: further out than the first .3.
  projection: .5,
  windowZ: -4.85,
  // Owner correction: the end windows sit a little above the front floor rows.
  raise: .5,
  windowWidth: 1.25,
  attic: {bottom: 27.3, top: 27.9, width: .8},
  // West end: the low wing covers the lower floors, so its window column starts higher (photo cut off below; provisional).
  westFirstFloor: 2,
  basis: 'End study: proud middle zone, one window column at the front edge of the rear zone on each end, a small window under the parapet; west column above the low wing.',
};

export interface SideOpening extends FrontOpening { side: -1 | 1 }

// x carries the local z position of the opening along the end wall.
export function sideSchedule(): SideOpening[] {
  const s = sideDesign, rows: SideOpening[] = [];
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'west' : 'east', first = side < 0 ? s.westFirstFloor : 0;
    for (let floor = first; floor < d.floors; floor++) rows.push({id: `side-${name}-L${floor+1}`, kind: 'window', x: s.windowZ, width: s.windowWidth, bottom: d.firstSill+s.raise+floor*d.pitch, top: d.firstHead+s.raise+floor*d.pitch, floor, group: side < 0 ? 'outer-left' : 'outer-right', inferredDimensions: true, side});
    rows.push({id: `side-${name}-attic`, kind: 'vent', x: s.windowZ, width: s.attic.width, bottom: s.attic.bottom, top: s.attic.top, floor: null, group: side < 0 ? 'outer-left' : 'outer-right', inferredDimensions: true, side});
  }
  return rows;
}
