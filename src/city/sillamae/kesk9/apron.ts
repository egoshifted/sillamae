import * as THREE from 'three';
import {design} from './design.ts';
import {landHeights,sourcePosition} from './model.ts';
import type {OverrideContext, Polygon} from '../../../engine/types.ts';

export const apron={width:.55,rise:.04,fall:.02,skirt:.15,step:.25};
// Half the 2.1 m entrance-step width in model.ts.
const stairHalf=1.05;

interface Strip {name:string; at(u:number,v:number):[number,number]; pieces:[number,number][]; caps:boolean}

// The slab sits above every survey layer and cuts the ground under it, so unlike a recoloured ground patch it
// needs no depth lift, which can draw buried survey layers through the foundation.
export function createApron(context:OverrideContext,doors:number[],material:THREE.MeshStandardMaterial) {
  const L=design.length/2,W=design.width/2,w=apron.width;
  const heights=(s:number,t:number)=>{const h=landHeights(context.ground,...sourcePosition(s,t));return h.length?h:[design.datum];};
  // Distance from the outline, not from each strip's wall, so strips meeting at a corner get the same heights.
  const out=(s:number,t:number)=>Math.max(Math.abs(s)-L,Math.abs(t)-W,0);
  const top=(s:number,t:number)=>Math.max(...heights(s,t))-design.datum+apron.rise-apron.fall*out(s,t)/w;
  const bottom=(s:number,t:number)=>Math.min(...heights(s,t))-design.datum-apron.skirt;
  const gaps=doors.map(x=>[x-stairHalf,x+stairHalf] as [number,number]).sort((a,b)=>a[0]-b[0]);
  const between=(u0:number,u1:number,cut:[number,number][])=>{const pieces:[number,number][]=[];let at=u0;for(const [a,b] of cut){if(a>at)pieces.push([at,a]);at=Math.max(at,b);}if(at<u1)pieces.push([at,u1]);return pieces;};
  const strips:Strip[]=[
    {name:'wnw',at:(u,v)=>[u,-W-v],pieces:between(-L-w,L+w,gaps),caps:true},
    {name:'ese',at:(u,v)=>[u,W+v],pieces:[[-L-w,L+w]],caps:true},
    {name:'ssw',at:(u,v)=>[-L-v,u],pieces:[[-W,W]],caps:false},
    {name:'nne',at:(u,v)=>[L+v,u],pieces:[[-W,W]],caps:false},
  ];
  const positions:number[]=[], patches:Polygon[]=[];
  const point=([s,t]:[number,number],y:number)=>new THREE.Vector3(s,y,t);
  function quad(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,facing:THREE.Vector3) {
    const n=b.clone().sub(a).cross(c.clone().sub(a)),[p,q,r,s]=n.dot(facing)>=0?[a,b,c,d]:[a,d,c,b];
    positions.push(...p.toArray(),...q.toArray(),...r.toArray(),...p.toArray(),...r.toArray(),...s.toArray());
  }
  for(const strip of strips)for(const [u0,u1] of strip.pieces) {
    const marks=[u0,u1,...(strip.caps?[-L,L]:[])].filter(u=>u>=u0&&u<=u1).sort((a,b)=>a-b),samples:number[]=[];
    // Corner squares stay one cell: extra vertices on an edge shared with an end strip would open T-junction cracks.
    for(let i=0;i<marks.length-1;i++){const corner=strip.caps&&(marks[i]>=L-1e-9||marks[i+1]<=-L+1e-9),n=corner?1:Math.max(1,Math.ceil((marks[i+1]-marks[i])/apron.step));for(let k=0;k<n;k++)samples.push(marks[i]+(marks[i+1]-marks[i])*k/n);}
    samples.push(u1);
    const outward=(u:number)=>{const [s0,t0]=strip.at(u,0),[s1,t1]=strip.at(u,w);return new THREE.Vector3(s1-s0,0,t1-t0);};
    for(let k=0;k<samples.length-1;k++) {
      const [u,next]=[samples[k],samples[k+1]],ia=strip.at(u,0),ib=strip.at(next,0),oa=strip.at(u,w),ob=strip.at(next,w);
      quad(point(ia,top(...ia)),point(ib,top(...ib)),point(ob,top(...ob)),point(oa,top(...oa)),new THREE.Vector3(0,1,0));
      quad(point(oa,top(...oa)),point(ob,top(...ob)),point(ob,bottom(...ob)),point(oa,bottom(...oa)),outward(u));
    }
    if(strip.caps)for(const [u,sign] of [[u0,-1],[u1,1]] as const){
      // Ends at the entrance steps are hidden by the step sides; a cap there would be coplanar with them.
      if(Math.abs(Math.abs(u)-(L+w))>1e-9)continue;
      const i=strip.at(u,0),o=strip.at(u,w),[s0,t0]=strip.at(u-sign,0);
      quad(point(i,top(...i)),point(o,top(...o)),point(o,bottom(...o)),point(i,bottom(...i)),new THREE.Vector3(i[0]-s0,0,i[1]-t0));
    }
    patches.push([[u0,0],[u1,0],[u1,w],[u0,w]].map(([u,v])=>sourcePosition(...strip.at(u,v))));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='apron';mesh.castShadow=mesh.receiveShadow=true;
  return {mesh,patches};
}
