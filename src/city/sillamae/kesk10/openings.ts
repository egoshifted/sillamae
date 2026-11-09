import type {Point2} from '../../../engine/types.ts';
import {footprint, wing, width} from './symmetric-shell.ts';

export interface Opening {id: string; a: Point2; b: Point2; centre: number; width: number; bottom: number; top: number; arch: number; kind: 'window' | 'door'; basis: string}
const west: [Point2, Point2] = [footprint[0],footprint[1]];
const centre: [Point2, Point2] = [footprint[2],footprint[3]];
const east: [Point2, Point2] = [footprint[4],footprint[5]];
export const openings: Opening[] = [];
function add(id: string, edge: [Point2,Point2], x: number, width: number, bottom: number, top: number, arch = 0, kind: Opening['kind'] = 'window', basis = 'Street facade, June 2023 photograph; proportions inferred against surveyed span') {
  openings.push({id, a: edge[0], b: edge[1], centre: x, width, bottom, top, arch, kind, basis});
}
for (const [name,edge] of [['west',west],['east',east]] as const) {
  const axis=name==='west'?6.54:wing-6.54;
  for (const [i,x] of [axis-.785,axis+.785].entries()) add(`street-${name}-L2-${i+1}`,edge,x/wing,1.05,5.3,7.05,.525,'window','Owner front photograph and May 2024 Street View: upper arches about three quarters of lower-window height; dimensions inferred');
  add(`street-${name}-high`,edge,axis/wing,1.0,8.65,10.85,.5,'window','June 2021 wide front photograph and Fotoladu 4815045: high arched window below each front gable');
  add(`street-${name}-door`,edge,axis/wing,1.5,.48,3.55,.75,'door');
}
for(let pair=0;pair<5;pair++) for(let side=0;side<2;side++) add(`street-centre-L2-${pair*2+side+1}`,centre,.055+pair*.201+side*.086,.93,5.3,7.05,.465,'window','Owner front photograph and May 2024 Street View: five pairs with narrow intra-pair and wider inter-pair gaps; upper arches about three quarters of lower-window height; dimensions inferred');
for(let i=0;i<5;i++) if(i!==2) add(`street-centre-L1-${i+1}`,centre,.10+i*.20,1.16,1.10,3.40);
add('street-centre-door',centre,.50,1.5,.48,3.55,.75,'door');
const northwest: [Point2,Point2] = [footprint[7],footprint[0]];
for(const [i,v] of [11.5,13.5].entries()) add(`northwest-L2-${i+1}`,northwest,1-v/width,1.0,5.4,7.3,0,'window','September 2023 Street View: two rectangular windows on lower rear range; placement and size inferred');
add('northwest-L1',northwest,1-12.5/width,1.1,1.5,3.2,0,'window','September 2023 Street View: one lower opening above parked cars; inferred proportions');
for(const [i,v] of [2.8,4.4].entries())add(`northwest-pair-${i+1}`,northwest,1-v/width,1,5.3,7.75,.5,'window','September 2023 Street View: paired arches on the same side plane as the single gable arch');
add('northwest-pair-L1',northwest,1-3.6/width,1.15,1.1,3.4,0,'window','Owner-supplied 2012 Street View resolves the lower opening under paired arches; partly obscured in 2023');
add('northwest-gable-L2',northwest,1-8.15/width,1.0,5.3,7.75,.5,'window','September 2023 Street View: single arched opening under the end gable');
add('northwest-gable-vent',northwest,1-8.15/width,.65,9.35,10.4,0,'window','September 2023 Street View: rectangular attic vent below the end gable');
add('northwest-door',northwest,1-8.15/width,1.45,.36,3.45,.725,'door','September 2023 Street View: entrance below single arch, partially obscured by van; doorway width inferred');
const southeast: [Point2,Point2] = [footprint[5],footprint[6]];
for(const [i,v] of [2.8,4.4,8.15].entries()) add(`southeast-L2-${i+1}`,southeast,v/width,1.0,5.3,7.75,.5,'window','June 2021 oblique photograph: paired arches and single arch above entrance; proportions inferred');
add('southeast-L1',southeast,3.6/width,1.15,1.1,3.4,0,'window','June 2021 oblique photograph: lower rectangular opening under paired arches');
add('southeast-gable-vent',southeast,8.15/width,.65,9.35,10.4,0,'window','June 2021 oblique photograph: rectangular attic vent');
for(const [i,v] of [11.5,13.5].entries())add(`southeast-rear-L2-${i+1}`,southeast,v/width,1,5.4,7.3,0,'window','June 2021 oblique photograph: two rectangular upper openings in lower rear range');
add('southeast-door',southeast,8.15/width,1.45,.18,3.45,.725,'door','June 2021 oblique photograph: end entrance under gable');
const rear: [Point2,Point2] = [footprint[6],footprint[7]];
for(const [i,x] of [.09,.17,.25,.33,.68,.76,.84,.93].entries()) add(`rear-L2-${i+1}`,rear,x,.90,5.6,7.0,0,'window','Fotoladu 4816738, 2021-06-02: visible rectangular upper row; normalized positions and dimensions inferred');
for(const [i,x] of [.42,.59].entries()) add(`rear-high-vent-${i+1}`,rear,x,1.35,7.0,7.55,0,'window','Fotoladu 4816738: two wide openings just below eaves beside stairwell');
for(const [i,x] of [.09,.17,.33,.68,.84].entries()) add(`rear-L1-${i+1}`,rear,x,1.1,1.0,2.8,0,'window','Fotoladu 4816738: visible lower openings; rightmost is boarded, represented as plain infill');
add('rear-door',rear,.76,1.10,.18,2.6,0,'door','Fotoladu 4816738: rear door right of the stairwell, proportions inferred');

export function openingFrame(o: Opening) {
  const length = Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]), dx=(o.b[0]-o.a[0])/length, dz=(o.b[1]-o.a[1])/length;
  return {length,dx,dz,nx:-dz,nz:dx};
}
export function openingLoop(o: Opening): Point2[] {
  const x=o.centre*openingFrame(o).length, r=o.width/2, spring=o.top-o.arch;
  const points: Point2[] = [[x-r,o.bottom],[x+r,o.bottom],[x+r,spring]];
  if(o.arch) for(let i=1;i<=16;i++){const t=i*Math.PI/16;points.push([x+r*Math.cos(t),spring+o.arch*Math.sin(t)]);}
  else points.push([x-r,o.top]);
  return points;
}

