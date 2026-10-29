import {groundRange,terrainHeight} from './terrain.ts';
import type * as THREE from 'three';
import type {Block, Bounds, Face} from './types.ts';

export const accessDesign: {stairs: {id: string; face: Face; centre: number; risers: number; topWidth: number; baseWidth: number; landing: number; run: number; top: number}[]; well: {id: string; u: number[]; v: number[]; floor: number; thickness: number; windowCentres: number[]; sill: number; head: number; width: number; posts: number; accessRoute: string}; platform: {u: number[]; v: number[]; top: number; thickness: number}; exits: {id: string; face: Face; centre: number}[]}={
 stairs:[
  {id:'NNE-flight',face:'NNE',centre:10.7,risers:5,topWidth:7.8,baseWidth:9.4,landing:1.05,run:.34,top:.7},
  {id:'ESE-flight',face:'ESE',centre:10.85,risers:5,topWidth:7.8,baseWidth:9.4,landing:1.05,run:.36,top:.7},
  {id:'COURT-flight',face:'WNW',centre:1.4,risers:6,topWidth:2.8,baseWidth:2.8,landing:1,run:.3,top:.95}
 ],
 well:{id:'SSW-end-well',u:[4.55,17.2],v:[45.47,47.02],floor:-1.6,thickness:.22,windowCentres:[5.65,8.15,10.65,13.15,15.65],sill:-1.25,head:.2,width:1.15,posts:4,accessRoute:'Unresolved; no invented descending flight'},
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
export function exitLevel(exit: {face: Face; centre: number}){return groundRange(...rect(exit.face,exit.centre-.7,exit.centre+.7,-.5,.34))[1]+.035;}

export function addAccess(block: Block,materials: {wall: THREE.MeshStandardMaterial; step: THREE.MeshStandardMaterial; guard: THREE.MeshStandardMaterial}){
 const audit: {stairs: Record<string,unknown>[]; well: (typeof accessDesign.well & {retainingTop: number; guardPostPositions: number[]; gradeAtEnd: number[]}) | null; platform: typeof accessDesign.platform; exits: (typeof accessDesign.exits[number] & {area: Bounds; top: number})[]}={stairs:[],well:null,platform:accessDesign.platform,exits:[]};
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
 const w=accessDesign.well,[u0,u1]=w.u,[v0,v1]=w.v,t=w.thickness,top=groundRange(u0-t,u1+t,v1,v1+t)[1]+.08;
 block('well-floor',u0,u1,w.floor-.12,w.floor,v0,v1,materials.step);
 block('well-front-retaining',u0-t,u1+t,w.floor-.12,top,v1,v1+t,materials.wall);
 block('well-WNW-return',u0-t,u0,w.floor-.12,top,v0,v1,materials.wall);
 block('well-ESE-return',u1,u1+t,w.floor-.12,top,v0,v1,materials.wall);
 const posts=[u0-t/2,u0+(u1-u0)/3,u0+2*(u1-u0)/3,u1+t/2],zc=v1+t/2;
 for(const x of posts)block('well-guard-post',x-.13,x+.13,top,top+.73,zc-.13,zc+.13,materials.wall);
 for(let i=1;i<posts.length;i++){
  const a=posts[i-1]+.13,b=posts[i]-.13;
  for(const y of [top+.12,top+.65])block('well-guard-rail',a,b,y-.018,y+.018,zc-.018,zc+.018,materials.guard);
  for(let x=a+.25;x<b-.15;x+=.3)block('well-guard-bar',x-.012,x+.012,top+.12,top+.65,zc-.012,zc+.012,materials.guard);
 }
 const p=accessDesign.platform;
 block('courtyard-service-platform',...p.u as [number,number],p.top-p.thickness,p.top,...p.v as [number,number],materials.step);
 for(const x of [p.u[0],p.u[1]]){
  block('platform-front-post',x-.025,x+.025,p.top,p.top+.9,p.v[1]-.025,p.v[1]+.025,materials.guard);
  if(x===p.u[0])block('platform-side-rail',x-.02,x+.02,p.top+.87,p.top+.91,p.v[0],p.v[1],materials.guard);
 }
 block('platform-front-rail',p.u[0],p.u[1],p.top+.87,p.top+.91,p.v[1]-.02,p.v[1]+.02,materials.guard);
 for(let x=p.u[0]+.35;x<p.u[1];x+=.35)block('platform-vertical',x-.012,x+.012,p.top,p.top+.9,p.v[1]-.012,p.v[1]+.012,materials.guard);
 audit.well={...w,retainingTop:top,guardPostPositions:posts,gradeAtEnd:[terrainHeight(u0,v1),terrainHeight(u1,v1)]};return audit;
}
