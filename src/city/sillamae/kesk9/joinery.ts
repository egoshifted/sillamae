import type {Opening} from './design.ts';

export type FrameFinish='pale'|'aged'|'red'|'brown';
export interface PaneFrame {finish:FrameFinish; bars:readonly number[]; inferred?:boolean}
interface PairFrame {tall?:PaneFrame; short?:PaneFrame}
const pale=(...bars:number[]):PaneFrame=>({finish:'pale',bars});
const aged=(...bars:number[]):PaneFrame=>({finish:'aged',bars});
const red=(...bars:number[]):PaneFrame=>({finish:'red',bars});
const brown=(...bars:number[]):PaneFrame=>({finish:'brown',bars});

// Fractions increase along the local SSW→NNE axis; WNW photographs read in reverse.
export const pairFrames:Record<string,PairFrame>={
  'ESE-L2-S1-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'ESE-L3-S1-A':{tall:pale(.25,.50,.75),short:pale(.40)},
  'ESE-L4-S1-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'ESE-L5-S1-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'ESE-L5-S1-B':{tall:aged(.46,.59),short:aged(.36)},
  'ESE-L3-S2-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'ESE-L4-S2-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'ESE-L5-S2-A':{tall:pale(1/3,2/3),short:pale(.40)},
  'WNW-L1-S3-B':{tall:pale(1/3,2/3),short:pale(.50)},
  'WNW-L2-S3-B':{tall:brown(.17)},
  'WNW-L3-S3-B':{tall:pale(1/3,2/3)},
  'WNW-L4-S3-B':{tall:pale(1/3,2/3)},
  'WNW-L5-S3-B':{tall:aged(.15),short:aged(.20)},
  'WNW-L1-S4-B':{tall:pale(1/3,2/3),short:pale(.40)},
  'WNW-L2-S4-B':{tall:aged(.23),short:aged(.18)},
  'WNW-L3-S4-B':{tall:pale(1/3,2/3),short:pale(.25)},
  'WNW-L4-S4-B':{tall:pale(1/3,2/3),short:pale(.25)},
  'WNW-L5-S4-B':{tall:pale(1/3,2/3),short:pale(.25)},
  'WNW-L2-S4-A':{tall:red(.20),short:red(.25)},
  'WNW-L3-S4-A':{tall:pale(.25),short:pale(.25)},
  'WNW-L4-S4-A':{tall:pale(.35),short:pale(.25)},
  'WNW-L5-S4-A':{tall:pale(1/3,2/3),short:pale(.25)},
  'WNW-L1-S5-A':{tall:pale(1/3,2/3),short:pale(.30)},
  'WNW-L2-S5-A':{tall:pale(.66),short:pale(.25)},
  'WNW-L3-S5-A':{tall:aged(.20),short:aged(.25)},
  'WNW-L4-S5-A':{tall:aged(.20),short:aged(.25)},
};

export const stairFrames:Record<string,PaneFrame>={
  'WNW-L1-S4-stair':pale(.25),
  'WNW-L2-S4-stair':pale(.30),
  'WNW-L3-S4-stair':pale(.30),
  'WNW-L4-S4-stair':pale(.25),
  'WNW-L5-S4-stair':pale(.25),
  'WNW-L1-S5-stair':pale(.25),
  'WNW-L2-S5-stair':pale(.25),
  'WNW-L3-S5-stair':pale(.25),
  'WNW-L4-S5-stair':pale(.25),
};

export function paneFrame(o:Opening,low:number):PaneFrame|undefined {
  if(o.kind==='door')return undefined;
  if(o.kind==='basement')return {finish:'pale',bars:[],inferred:o.elevation==='ESE'};
  const tall=Math.abs(low-o.sill)<1e-6;
  const observed=o.kind==='pair'?pairFrames[o.id]?.[tall?'tall':'short']:stairFrames[o.id];
  if(observed)return observed;
  const bars=o.kind==='stair'?[.25]:tall?[1/3,2/3]:[o.elevation==='ESE'?.40:.25];
  return {finish:'pale',bars,inferred:true};
}
