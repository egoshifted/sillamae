import type {BalconySchedule} from '../kesk5/types.ts';

const light = (from: number, to: number, panePitch = .74, cover?: string) => ({from, to, frame: 'light', panePitch, cover});
const dark = (from: number, to: number, panePitch = .74, cover?: string) => ({from, to, frame: 'dark', panePitch, cover});

// Fractions run northwest to southeast. Unresolved spans retain the approved shell.
export const balconies: BalconySchedule = {rows: [
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
  {section: 4, floor: 1, segments: [light(0,.26),light(.26,.69,.52),light(.69,1,.93)]},
  {section: 4, floor: 2, segments: [light(.26,.69,.52),dark(.69,1,.88)]},
  {section: 4, floor: 3, segments: [dark(0,.26),dark(.69,1)]},
  {section: 4, floor: 4, segments: [light(0,1)]},
  {section: 4, floor: 5, segments: [light(.79,1,.8,'light')]},
]};
