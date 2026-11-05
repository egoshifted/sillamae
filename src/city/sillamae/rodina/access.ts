import {groundRange,terrainHeight} from './terrain.ts';
import type * as THREE from 'three';
import type {Block, Bounds, Face} from './types.ts';

interface Well {id: string; prefix: string; axis: 'u' | 'v'; along: [number,number]; wall: number; outward: number; depth: number; floor: number; thickness: number; windowCentres: number[]; sill: number; head: number; width: number; posts: number; solidTo?: number; accessRoute: string}

export const accessDesign: {stairs: {id: string; face: Face; centre: number; risers: number; topWidth: number; baseWidth: number; landing: number; run: number; top: number}[]; wells: Well[]; platform: {u: number[]; v: number[]; top: number; thickness: number}; exits: {id: string; face: Face; centre: number}[]}={
 stairs:[
  {id:'NNE-flight',face:'NNE',centre:10.7,risers:5,topWidth:6.7,baseWidth:8.3,landing:1.05,run:.34,top:.7},
  {id:'ESE-flight',face:'ESE',centre:10.825,risers:5,topWidth:6.7,baseWidth:8.3,landing:1.05,run:.36,top:.7},
  {id:'COURT-flight',face:'WNW',centre:1.4,risers:6,topWidth:2.8,baseWidth:2.8,landing:1,run:.3,top:.95}
 ],
 wells:[
  {id:'SSW-end-well',prefix:'',axis:'u',along:[4.55,17.2],wall:45.47,outward:1,depth:1.55,floor:-1.6,thickness:.22,windowCentres:[5.65,8.15,10.65,13.15,15.65],sill:-1.25,head:.2,width:1.15,posts:4,accessRoute:'Unresolved; no invented descending flight'},
  // May 2024 Street View from Kesk 8: solid wall from the north corner, then posts and railing.
  // The floor is deeper than the south well's because the ground here falls to about -1.7.
  {id:'WNW-end-well',prefix:'west-',axis:'v',along:[4.53,16.83],wall:-23.92,outward:-1,depth:1.55,floor:-1.85,thickness:.22,windowCentres:[5.68,8.18,10.68,13.18,15.68],sill:-1.25,head:.2,width:1.15,posts:5,solidTo:8.2,accessRoute:'Unresolved; no invented descending flight'}
 ],
 platform:{u:[1.15,3.95],v:[21.65,22.9],top:5.25,thickness:.14},
 exits:[
  {id:'WNW-NNE-exit',face:'WNW-NNE',centre:-18.2},
  {id:'WNW-SSW-exit',face:'WNW-SSW',centre:-18.2},
  {id:'SSW-ESE-exit',face:'SSW-ESE',centre:39.4}
 ]
};

export function facePoint(face: Face,a: number,d: number): [number,number]{
 if(face==='NNE')return[a,d];
 if(face==='ESE')return[21.4-d,a];
 if(face==='WNW')return[d,21.65-a];
 if(face==='WNW-NNE')return[a,3.93+d];
 if(face==='WNW-SSW')return[a,17.43-d];
 if(face==='SSW-ESE')return[17.8-d,a];
 throw Error('Unknown access face '+face);
}

function rect(face: Face,a0: number,a1: number,d0: number,d1: number): Bounds{const p=[facePoint(face,a0,d0),facePoint(face,a1,d1)];return[Math.min(p[0][0],p[1][0]),Math.max(p[0][0],p[1][0]),Math.min(p[0][1],p[1][1]),Math.max(p[0][1],p[1][1])];}
export function wellArea(w: Well): Bounds{const near=w.wall,far=w.wall+w.outward*w.depth,d=[Math.min(near,far),Math.max(near,far)];return w.axis==='u'?[w.along[0],w.along[1],d[0],d[1]]:[d[0],d[1],w.along[0],w.along[1]];}
export function exitLevel(exit: {face: Face; centre: number}){return groundRange(...rect(exit.face,exit.centre-.7,exit.centre+.7,-.5,.34))[1]+.035;}

export function addAccess(block: Block,materials: {wall: THREE.MeshStandardMaterial; step: THREE.MeshStandardMaterial; guard: THREE.MeshStandardMaterial}){
 const audit: {stairs: Record<string,unknown>[]; wells: (Well & {retainingTop: number; guardPostPositions: number[]; gradeAtEnd: number[]})[]; platform: typeof accessDesign.platform; exits: (typeof accessDesign.exits[number] & {area: Bounds; top: number})[]}={stairs:[],wells:[],platform:accessDesign.platform,exits:[]};
 const emit=(name: string,area: Bounds,bottom: number,top: number,material: THREE.MeshStandardMaterial)=>block(name,area[0],area[1],bottom,top,area[2],area[3],material);
 for(const s of accessDesign.stairs){
  const outer=s.landing+(s.risers-1)*s.run,foot=rect(s.face,s.centre-s.baseWidth/2,s.centre+s.baseWidth/2,-outer,-outer+s.run),grade=groundRange(...foot),rise=(s.top-grade[1])/s.risers,treads=[];
  const landing=rect(s.face,s.centre-s.topWidth/2,s.centre+s.topWidth/2,-s.landing,.34);
  emit(s.id+'-landing',landing,groundRange(...landing)[0]-.06,s.top,materials.step);
  for(let i=1;i<s.risers;i++){
   const width=s.baseWidth-(s.baseWidth-s.topWidth)*(i-1)/(s.risers-1),far=-outer+(i-1)*s.run,area=rect(s.face,s.centre-width/2,s.centre+width/2,far,far+s.run),top=grade[1]+rise*i,bottom=groundRange(...area)[0]-.06;
   emit(s.id+'-tread-'+i,area,bottom,top,materials.step);treads.push({index:i,area,bottom,top});
  }
  if(s.id==='COURT-flight'){const area=rect(s.face,2.8,3.03,-outer,.1);emit('COURT-retaining-cheek',area,groundRange(...area)[0]-.08,s.top+.08,materials.wall);}
  audit.stairs.push({...s,rise,footGrade:grade,landingArea:landing,landingBottom:groundRange(...landing)[0]-.06,treads});
 }
 for(const e of accessDesign.exits){const area=rect(e.face,e.centre-.7,e.centre+.7,-.5,.34),top=exitLevel(e);emit(e.id+'-threshold',area,groundRange(...area)[0]-.05,top,materials.step);audit.exits.push({...e,area,top});}
 for(const w of accessDesign.wells){
  const[a0,a1]=w.along,t=w.thickness,bottom=w.floor-.12,start=w.solidTo??a0,count=w.posts-1,name=(part: string)=>w.prefix+'well-'+part;
  const put=(part: string,s0: number,s1: number,y0: number,y1: number,d0: number,d1: number,material=materials.wall)=>{const p=[w.wall+w.outward*d0,w.wall+w.outward*d1],near=Math.min(...p),far=Math.max(...p);return w.axis==='u'?block(name(part),s0,s1,y0,y1,near,far,material):block(name(part),near,far,y0,y1,s0,s1,material);};
  const strip=wellArea({...w,along:[a0-t,a1+t],depth:w.depth+t}),edge=w.outward>0?w.wall+w.depth:w.wall-w.depth-t,top=(w.axis==='u'?groundRange(strip[0],strip[1],edge,edge+t):groundRange(edge,edge+t,strip[2],strip[3]))[1]+.08;
  put('floor',a0,a1,w.floor-.12,w.floor,0,w.depth,materials.step);
  put('front-retaining',a0-t,a1+t,bottom,top,w.depth,w.depth+t);
  put(w.axis==='u'?'WNW-return':'NNE-return',a0-t,a0,bottom,top,0,w.depth);
  put(w.axis==='u'?'ESE-return':'SSW-return',a1,a1+t,bottom,top,0,w.depth);
  if(w.solidTo){put('solid-parapet',a0-t,w.solidTo,top,top+.73,w.depth,w.depth+t);put('solid-return',a0-t,a0,top,top+.73,0,w.depth);}
  const posts=Array.from({length:w.posts},(_,i)=>i===0?w.solidTo??a0-t/2:i===count?a1+t/2:start+(a1-start)*i/count),middle=w.depth+t/2;
  for(const x of posts)put('guard-post',x-.13,x+.13,top,top+.73,middle-.13,middle+.13);
  for(let i=1;i<posts.length;i++){
   const a=posts[i-1]+.13,b=posts[i]-.13;
   for(const y of [top+.12,top+.65])put('guard-rail',a,b,y-.018,y+.018,middle-.018,middle+.018,materials.guard);
   for(let x=a+.25;x<b-.15;x+=.3)put('guard-bar',x-.012,x+.012,top+.12,top+.65,middle-.012,middle+.012,materials.guard);
  }
  const ends=w.axis==='u'?[[a0,w.wall],[a1,w.wall]]:[[w.wall,a0],[w.wall,a1]];
  audit.wells.push({...w,retainingTop:top,guardPostPositions:posts,gradeAtEnd:ends.map(([x,z])=>terrainHeight(x,z))});
 }
 const p=accessDesign.platform;
 block('courtyard-service-platform',...p.u as [number,number],p.top-p.thickness,p.top,...p.v as [number,number],materials.step);
 for(const x of [p.u[0],p.u[1]]){
  block('platform-front-post',x-.025,x+.025,p.top,p.top+.9,p.v[1]-.025,p.v[1]+.025,materials.guard);
  if(x===p.u[0])block('platform-side-rail',x-.02,x+.02,p.top+.87,p.top+.91,p.v[0],p.v[1],materials.guard);
 }
 block('platform-front-rail',p.u[0],p.u[1],p.top+.87,p.top+.91,p.v[1]-.02,p.v[1]+.02,materials.guard);
 for(let x=p.u[0]+.35;x<p.u[1];x+=.35)block('platform-vertical',x-.012,x+.012,p.top,p.top+.9,p.v[1]-.012,p.v[1]+.012,materials.guard);
 return audit;
}
