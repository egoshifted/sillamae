import {frontDesign as d, type FrontOpening} from './front-design.ts';

// Owner rear photographs (frontal, distant and obliques). Widths from pixel runs along image rows, heights in floor units at the 2.8 m pitch; all inferred.
export const rearDesign = {
  face: d.back,
  // Perspective offsets between rows: towers stand proudest, bands sit behind them, the stair centre further back (survey crest .9–1.05 m in).
  bandFace: d.back+.5,
  centreFace: d.back+1,
  loggiaWall: -6.6,
  cheek: [12.5, d.halfWidth] as const,
  band: [7.2, 12.5] as const,
  tower: [2.8, 7.2] as const,
  towerColumn: 5,
  stairColumns: [-1.95, 1.95],
  // Window rows were measured from the rear ground, so the building lift does not raise them (owner: the rear had drifted up).
  bandSill: 2.25-d.lift,
  bandHead: 3.6-d.lift,
  towerSill: 1.85-d.lift,
  towerHead: 3.2-d.lift,
  stairSill: 3.45-d.lift,
  stairHeight: 1.3,
  stairCount: 10,
  // The band canopy starts just above the top glazing row.
  bandEave: 3.6-d.lift+(d.floors-1)*d.pitch+.15,
  towerShoulder: 30.6,
  // Owner close photo of the tower tops, scaled by the 4.4 m tower width: the gable rises about 1.5 m.
  towerPeak: 32.1,
  // Glazed round-headed window in a concrete surround that widens towards its top.
  archSurround: {bottom: 26.7, top: 29.1, bottomWidth: 2.05, topWidth: 2.65},
  // Owner close rear entrance photo: one porch recessed to the stair plane between end piers, both doors in its back wall, a deep canopy fascia just above the doors. Owner correction: centred on the building axis.
  // Set from the ground, so the lifted building keeps its doors at the porch floor.
  entrance: {left: -3.45, right: 3.45, porchEdge: 3.15, canopyTop: 2.75-d.lift, canopyBottom: 2.3-d.lift, doorBottom: -d.lift, doorTop: 2.2-d.lift},
  basis: 'Rear study: outer cheeks, two recessed glazed balcony bands, two towers with white window columns and arched niches, recessed stair centre with ten half-landing windows and a rear entrance. Plan depths from perspective offsets and survey; entrance provisional.',
};

export function rearSchedule(): FrontOpening[] {
  const r = rearDesign, rows: FrontOpening[] = [];
  const add = (row: Omit<FrontOpening, 'inferredDimensions'>) => rows.push({...row, inferredDimensions: true});
  for (let floor = 0; floor < d.floors; floor++) {
    for (const side of [-1, 1]) {
      add({id: `rear-L${floor+1}-band-${side<0?'left':'right'}`, kind: 'balcony', x: side*(r.band[0]+r.band[1])/2, width: r.band[1]-r.band[0]-.2, bottom: r.bandSill+floor*d.pitch, top: r.bandHead+floor*d.pitch, floor, group: 'balcony'});
      add({id: `rear-L${floor+1}-tower-${side<0?'left':'right'}`, kind: 'window', x: side*r.towerColumn, width: 1.4, bottom: r.towerSill+floor*d.pitch, top: r.towerHead+floor*d.pitch, floor, group: side<0?'outer-left':'outer-right'});
    }
  }
  for (const side of [-1, 1]) {
    // Tower top: glazed round-headed window between the top window and the gable (owner close photo of the tower tops).
    add({id: `rear-arch-window-${side<0?'left':'right'}`, kind: 'arch', x: side*r.towerColumn, width: 1.64, bottom: 26.8, top: 28.25, floor: null, group: side<0?'outer-left':'outer-right'});
  }
  for (let landing = 0; landing < r.stairCount; landing++) for (const [column, x] of r.stairColumns.entries()) {
    add({id: `rear-stair-${landing+1}-${column+1}`, kind: 'window', x, width: 1.5, bottom: r.stairSill+landing*d.pitch, top: r.stairSill+r.stairHeight+landing*d.pitch, floor: null, group: 'centre'});
  }
  // Owner correction: each door runs out to its end pier (a centimetre left so the opening stays inside the wall outline).
  const doorWidth = 1.42, doorX = r.entrance.porchEdge-.01-doorWidth/2;
  for (const [index, [x, width]] of [[-doorX, doorWidth], [doorX, doorWidth]].entries()) add({id: `rear-door-${index+1}`, kind: 'door', x, width, bottom: r.entrance.doorBottom, top: r.entrance.doorTop, floor: 0, group: 'centre'});
  return rows;
}
