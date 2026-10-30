import type {Polygon} from '../../../engine/types.ts';

export const sourceFootprint: Polygon = [[308.1,719.1],[333.7,658.8],[344.5,663.4],[318.8,723.7]];
export const design = {
  id: '73512033',
  centre: [326.275,691.25] as [number,number],
  axis: [0.39143145060592777,-0.9202072698455163] as [number,number],
  length: 65.52871507972675,
  width: 11.692812823626577,
  datum: 14.11,
  wall: .38,
  foundationTop: 1.3,
  roofDeck: 16.71,
  parapetTop: 16.96,
  floorPitch: 3.2,
  floors: 5,
  sections: 5,
  provenance: {
    plan: 'Orthogonal fit of imported footprint; maximum displacement below 0.05 m',
    levels: 'Survey roof clusters 30.82/31.07/31.66 m; datum is original envelope minimum, not finished floor',
    openings: 'Five occupied rows, stepped pairs and WNW stair lights observed; dimensions and repeated hidden units provisional',
    contacts: 'Unmodified source land triangles sampled independently of the sea plane; no grading',
    status: 'Plain shell for owner review; dimensions inferred unless explicitly survey-derived',
  },
};

export interface Opening {
  id: string;
  elevation: 'WNW' | 'ESE';
  floor: number;
  kind: 'pair' | 'stair' | 'basement' | 'door';
  x: number;
  width: number;
  sill: number;
  head: number;
  tall?: 'left' | 'right';
  shortSill?: number;
  provisional: boolean;
}

export function openingSchedule(): Opening[] {
  const result: Opening[] = [], pitch = design.length / design.sections;
  for (const elevation of ['WNW','ESE'] as const) for (let section = 0; section < 5; section++) {
    const centre = -design.length / 2 + pitch * (section + .5);
    for (let floor = 0; floor < 5; floor++) {
      const level = floor * design.floorPitch;
      for (const side of [-1,1] as const) result.push({
        id: `${elevation}-L${floor+1}-S${section+1}-${side<0?'A':'B'}`,
        elevation, floor, kind: 'pair', x: centre + side * 3.78, width: 3.5,
        sill: 1.8 + level, head: 3.45 + level, shortSill: 2.75 + level,
        tall: side < 0 ? 'left' : 'right', provisional: true,
      });
      if (elevation === 'WNW') result.push({id: `WNW-L${floor+1}-S${section+1}-stair`, elevation, floor, kind: 'stair', x: centre, width: 1.55, sill: 2.75 + level, head: 3.45 + level, provisional: true});
    }
    for (const side of [-1,1] as const) result.push({id: `${elevation}-B-S${section+1}-${side<0?'A':'B'}`, elevation, floor: -1, kind: 'basement', x: centre + side * 4.5, width: 1.15, sill: .55, head: 1.1, provisional: true});
    if (elevation === 'WNW') result.push({id: `WNW-S${section+1}-door`, elevation, floor: 0, kind: 'door', x: centre, width: 1.55, sill: .65, head: 2.65, provisional: true});
  }
  return result;
}

export function fittedFootprint(): Polygon {
  const [ux,uz] = design.axis, [cx,cz] = design.centre;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t]) => [cx + ux*s*design.length/2 - uz*t*design.width/2, cz + uz*s*design.length/2 + ux*t*design.width/2]);
}
