import type {Point2} from '../../../engine/types.ts';

export const frontDesign = {
  centre: [1191.9, 659.7] as Point2,
  angle: Math.atan2(.06459, .99791),
  halfWidth: 13.25,
  back: -7.8,
  sideFront: 5.55,
  centreFront: 8.05,
  balconyFront: 9.55,
  wall: .38,
  floors: 9,
  // Owner distant rear and frontal photos measured in floor units against the survey decks; supersedes the inferred 3.05.
  pitch: 2.8,
  firstSill: 1.5,
  // Frontal photo: a window is .57 of a floor tall.
  firstHead: 3.1,
  // Roof decks are the survey's horizontal surfaces; tops above them are frontal-photo floor units times the pitch.
  sideTop: 29,
  deck: 28.8,
  upperDeck: 30.2,
  centreShoulder: 30.4,
  centrePeak: 32.25,
  bladeTop: 31.45,
  entranceX: -1.65,
  entranceLevel: .36,
  // Owner corrections: the building stands higher above the entrance ground; the entrance, plinth, apron and basement stairs stay set from the ground (owner entrance photo: landing one or two low rises above the road).
  lift: .7,
  balconyCentres: [-5, 5],
  balconyWidth: 2.4,
  // Owner close photos: the outer red brick wall stands proud of the balcony face; about half a brick, inferred.
  outerCheekProjection: .12,
  roofFixtures: [
    {id:'left-roof-block',x:-9.3,z:-2.6,width:.9,depth:1.15,height:.8,upper:false},
    {id:'central-roof-block',x:0,z:2.3,width:.9,depth:3.0,height:.6,upper:true},
    {id:'right-roof-block',x:9.3,z:-.6,width:.85,depth:1.0,height:.85,upper:false},
  ],
  outerColumns: [-11.15, -8.35, 8.35, 11.15],
  // Owner close front photo: white diamond-lattice grilles over the two ground-floor windows of the left outer wing.
  grilles: ['front-L1-outer-1', 'front-L1-outer-2'],
  // Owner photos of both outer wings: a basement stair runs along the facade between an inner and an outer wall, both with falling tops, down towards its balcony. Sizes inferred.
  // Owner correction: a paved gap separates the facade from the inner wall along the run; only the landing reaches the facade.
  // Both stair-wall entrance ends align; the low ends meet the balcony cheek with its basement door.
  // Heights here are above the entrance ground, not the lifted building datum.
  // Owner corrections: wider between the walls than the first 1.2 m, then a little more.
  // Owner correction: the stairs stand further out from the facade, with a wider paved gap behind the inner wall.
  basementStairs: {inner: 1.05, gap: .8, width: 2.2, wall: .25, floor: -1.9, top: .2, wallTop: [1, .2] as const, landing: 1.35, outerExtra: 0, doorWidth: 1, doorHeight: 2,
    runs: [{side: -1, high: -13.5, low: -6.65}, {side: 1, high: 13.5, low: 6.65}]},
  centreColumns: [-1.65, 1.65],
  basis: 'Plain front study: nine rows, four outer window columns, two central columns, two balcony stacks and offset entrance from owner photographs. Dimensions inferred against the survey envelope; other elevations unstudied.',
};

export interface FrontOpening {
  id: string;
  kind: 'window' | 'balcony' | 'door' | 'vent' | 'arch';
  x: number;
  width: number;
  bottom: number;
  top: number;
  floor: number | null;
  group: 'outer-left' | 'outer-right' | 'centre' | 'balcony';
  inferredDimensions: true;
}

export function sourcePoint(x: number, z: number): Point2 {
  const c = Math.cos(frontDesign.angle), s = Math.sin(frontDesign.angle);
  return [frontDesign.centre[0] + c*x + s*z, frontDesign.centre[1] - s*x + c*z];
}

export function frontSchedule(): FrontOpening[] {
  const d = frontDesign, rows: FrontOpening[] = [];
  const add = (row: Omit<FrontOpening, 'inferredDimensions'>) => rows.push({...row, inferredDimensions: true});
  for (let floor = 0; floor < d.floors; floor++) {
    const bottom = d.firstSill + floor*d.pitch, top = d.firstHead + floor*d.pitch;
    for (const [column, x] of d.outerColumns.entries()) add({id: `front-L${floor+1}-outer-${column+1}`, kind: 'window', x, width: 1.6, bottom, top, floor, group: x<0?'outer-left':'outer-right'});
    for (const [column, x] of d.centreColumns.entries()) {
      const door = floor===0 && column===0;
      add({id: `front-L${floor+1}-centre-${column+1}`, kind: door?'door':'window', x, width: door?1.8:2.15, bottom: door?d.entranceLevel-d.lift:bottom, top: door?2.6-d.lift:top, floor, group: 'centre'});
    }
    // The slab of the floor above is centred .12 m above its level and is .18 m thick, so its underside is .03 m above that level. Lower heads stop there; the top floor still meets the roof cheek.
    const balconyTop = floor===d.floors-1 ? top : (floor+1)*d.pitch+.03;
    for (const [column, x] of d.balconyCentres.entries()) add({id: `front-L${floor+1}-balcony-${column+1}`, kind: 'balcony', x, width: d.balconyWidth, bottom: floor*d.pitch+1.35, top: balconyTop, floor, group: 'balcony'});
  }
  // Frontal photo, in floors above the top sill: vents 1.02–1.22, arched niches 1.27–2.05.
  const topSill = d.firstSill+(d.floors-1)*d.pitch;
  for (const [column, x] of d.outerColumns.entries()) add({id: `front-attic-${column+1}`, kind: 'vent', x, width: 1.4, bottom: topSill+1.02*d.pitch, top: topSill+1.22*d.pitch, floor: null, group: x<0?'outer-left':'outer-right'});
  for (const [column, x] of d.centreColumns.entries()) add({id: `front-blind-arch-${column+1}`, kind: 'arch', x, width: 2.15, bottom: topSill+1.27*d.pitch, top: topSill+2.05*d.pitch, floor: null, group: 'centre'});
  return rows;
}
