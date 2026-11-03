import * as THREE from 'three';
import type {OverrideContext,Point2,SiteSurface} from '../../../engine/types.ts';
import {detailPreview,disposeGroup} from '../../../studio/site/details.ts';
import {groundCandidates} from '../../../engine/survey/ground-index.ts';
import {createFrontStudy} from './front.ts';
import {sourcePoint} from './front-design.ts';

// The marker identifies the area only; straight parking edges follow the aerial, with dimensions inferred.
export const parkingOutline:Point2[]=[[-17,11.5],[13,11.5],[13,21],[-17,21]];

export function createSiteStudy(context:OverrideContext) {
  const building=createFrontStudy(context),root=new THREE.Group(),[ox,oz]=context.frame.origin;
  const surface:SiteSurface={id:'ranna31a-front-parking',finish:'asphalt',ring:parkingOutline.map(([x,z])=>sourcePoint(x,z))};
  const land=(x:number,z:number)=>{
    let high=-Infinity;
    for(const [ax,az,ah,bx,bz,bh,cx,cz,ch] of groundCandidates(context.ground,x,z)) {
      if(Math.max(ax,bx,cx)-Math.min(ax,bx,cx)>200)continue;
      const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-9)continue;
      const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,c=1-a-b;
      if(Math.min(a,b,c)>=-1e-6)high=Math.max(high,a*ah+b*bh+c*ch);
    }
    if(!Number.isFinite(high))throw Error('Parking preview needs survey land');return high;
  };
  const [a,b,,c]=surface.ring,ha=land(...a),hb=land(...b),hc=land(...c),dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1],det=dx*ez-dz*ex;
  const sx=((hb-ha)*ez-(hc-ha)*dz)/det,sz=(dx*(hc-ha)-ex*(hb-ha))/det;
  const plane=(x:number,z:number)=>ha+sx*(x-a[0])+sz*(z-a[1]);
  let clearance=0;
  // A single plane clears all local land layers instead of drawing one overlapping asphalt sheet per layer.
  const xs=surface.ring.map(p=>p[0]),zs=surface.ring.map(p=>p[1]);
  for(let x=Math.min(...xs);x<=Math.max(...xs);x+=.5)for(let z=Math.min(...zs);z<=Math.max(...zs);z+=.5)
    clearance=Math.max(clearance,land(x,z)-plane(x,z));
  const height=(x:number,z:number)=>plane(x+ox,z+oz)+clearance-context.frame.base;
  const parking=detailPreview([surface],[],[],context.frame.origin,height,8);
  parking.name='ranna31a-parking-study';root.add(building.root,parking);root.name='ranna31a-with-site';
  let disposed=false;
  return {...building,root,dispose(){if(disposed)return;disposed=true;building.dispose();disposeGroup(parking);root.removeFromParent();}};
}
