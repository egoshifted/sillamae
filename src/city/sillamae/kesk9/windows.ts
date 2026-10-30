import {design,openingSchedule,type Opening} from './design.ts';

export const openingRows={pitch:2.95,firstHead:3.80};
export const windowProfiles={
  WNW:{width:4.0,offset:3.85,tallFraction:.52,tallHeight:1.65,shortHeight:.95},
  ESE:{width:5.10,offset:3.45,tallFraction:.64,tallHeight:1.55,shortHeight:.90},
};

export function correctedOpeningSchedule():Opening[] {
  return openingSchedule().map(o=>{
    if(o.kind==='door'||o.kind==='basement')return o;
    const p=windowProfiles[o.elevation],head=openingRows.firstHead+o.floor*openingRows.pitch;
    if(o.kind==='stair')return {...o,width:1.70,head,sill:head-.95};
    const side=o.tall==='left'?-1:1,centre=o.x-side*3.78,x=centre+side*p.offset;
    const split=x-p.width/2+p.width*(o.tall==='left'?p.tallFraction:1-p.tallFraction);
    return {...o,x,width:p.width,head,sill:head-p.tallHeight,shortSill:head-p.shortHeight,split};
  });
}

export function openingHalves(o:Opening) {
  const middle=o.split??o.x;
  return o.kind==='pair'
    ? [{a:o.x-o.width/2,b:middle,low:o.tall==='left'?o.sill:o.shortSill!},{a:middle,b:o.x+o.width/2,low:o.tall==='right'?o.sill:o.shortSill!}]
    : [{a:o.x-o.width/2,b:o.x+o.width/2,low:o.sill}];
}

export function windowMargins() {
  return Object.fromEntries(Object.entries(windowProfiles).map(([e,p])=>[e,{withinSection:2*p.offset-p.width,betweenSections:design.length/design.sections-2*p.offset-p.width}]));
}
