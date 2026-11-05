export interface BalconySegment {
  from: number; to: number; frame: string; panePitch?: number; cover?: string;
  top?: number; // share of the height taken by a row of upper lights
  curtains?: boolean;
  fascia?: boolean;
}

const light = (from: number, to: number, panePitch = .74, cover?: string): BalconySegment => ({from, to, frame: 'light', panePitch, cover});
const dark = (from: number, to: number, panePitch = .74, cover?: string): BalconySegment => ({from, to, frame: 'dark', panePitch, cover});
const narrow = (from: number, to: number): BalconySegment => ({from, to, frame: 'light', panePitch: .34, top: .22});
const modern = (from: number, to: number, top = 0, curtains = false): BalconySegment => ({from, to, frame: 'white', panePitch: 1.05, top, curtains});

// Fractions run northwest to southeast. Unresolved spans retain the approved shell.
// Section 4 is read from May 2024 Street View at the southeast end; its top floor is timber under a lean-to.
export const balconies: {rows: {section: number; floor: number; segments: BalconySegment[]}[]} = {rows: [
  {section: 1, floor: 1, segments: [light(0,.24)]},
  {section: 1, floor: 2, segments: []},
  {section: 1, floor: 3, segments: [light(0,.25)]},
  {section: 1, floor: 4, segments: [light(0,.25)]},
  {section: 1, floor: 5, segments: []},
  {section: 2, floor: 1, segments: [light(0,.23)]},
  {section: 2, floor: 2, segments: [dark(.24,.78,.48)]},
  {section: 2, floor: 3, segments: [light(0,.76)]},
  {section: 2, floor: 4, segments: [light(0,.23),light(.78,1)]},
  {section: 2, floor: 5, segments: []},
  {section: 3, floor: 1, segments: [light(0,.23),light(.63,1)]},
  {section: 3, floor: 2, segments: []},
  {section: 3, floor: 3, segments: []},
  {section: 3, floor: 4, segments: []},
  {section: 3, floor: 5, segments: [light(0,.24,.8,'light'),dark(.62,.94,.8,'light')]},
  {section: 4, floor: 1, segments: [narrow(0,.6),modern(.6,1)]},
  {section: 4, floor: 2, segments: [narrow(0,.6),modern(.6,1,.24,true)]},
  {section: 4, floor: 3, segments: [dark(0,.12,.6),{...dark(.6,1,.62),fascia: true}]},
  {section: 4, floor: 4, segments: [modern(0,1)]},
  {section: 4, floor: 5, segments: [{from: .6, to: 1, frame: 'timber', panePitch: .75, top: .3, cover: 'sheet'}]},
]};
