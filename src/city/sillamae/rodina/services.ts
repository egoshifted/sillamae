import * as THREE from 'three';
import type {Block, Emit, Point3, ShellMaterials} from './types.ts';

export const rodinaServices={
 buildingId:'213731733',uniqueBuilding:true,reuse:'Rodina only; no building archetype or copies',
 terminals:[
  {id:'M1',u:2.04,v:7.01,type:'stack',width:.65,depth:.55,rise:1},
  {id:'M2',u:18.3,v:6.14,type:'pipe',radius:.09,rise:.8},
  {id:'M3',u:16.06,v:13.2,type:'stack',width:.65,depth:.55,rise:1},
  {id:'M4',u:14.23,v:18.72,type:'stack',width:.6,depth:.55,rise:.85},
  {id:'M5',u:2.98,v:19.67,type:'stack',width:.6,depth:.5,rise:.85},
  {id:'M6',u:17.32,v:16.61,type:'pipe',radius:.085,rise:.7},
  {id:'M7',u:6.66,v:2.68,type:'pipe',radius:.09,rise:.8},
  {id:'W1',u:-21.83,v:13.44,type:'wing vent',width:.28,depth:.28,rise:.65},
  {id:'S1',u:11.97,v:44.05,type:'wing vent',width:.28,depth:.28,rise:.65}
 ],
 drains:[
  {id:'court-hopper',face:'WNW-SSW',centre:-.5,rim:7.2,bowlBottom:6.72,depth:.65,bottom:3.55,pipeDepth:.3,radius:.07,brackets:[4.05,5.45]},
  {id:'WNW-NNE-end-drain',face:'WNW-NNE',centre:-23.55,rim:7.22,bowlBottom:6.74,depth:.6,bottom:4.05,pipeDepth:.3,radius:.07,brackets:[4.45,5.75]},
  {id:'SSW-ESE-end-drain',face:'SSW-ESE',centre:43.7,rim:7.35,bowlBottom:6.87,depth:.6,bottom:3.05,pipeDepth:.3,radius:.07,brackets:[3.55,5.6]},
  {id:'SSW-WNW-end-pipe',face:'SSW-WNW',centre:44.05,top:7.05,bottom:3.7,pipeDepth:.3,radius:.075,brackets:[4.25,5.75]}
 ],
 cornerPipe:{id:'court-corner-pipe',u:-.39,v:21.35,top:10.08,bottom:5.05,radius:.065,brackets:[5.65,7.25,8.85]},
 limits:'All dimensions and roof anchors inferred. Four rectangular stacks, three narrow pavilion terminals and two wing vents are visible proxies, not claims of function. December 2025 broken drain condition retained; hidden continuations, exact bends and collector connections unresolved.'
};

export function rodinaRoofY(u: number,v: number){
 if(u<0)return 7.3+2.65*Math.min((v-3.93)/(10.78-3.93),(17.43-v)/(17.43-10.78));
 if(v>21.65)return 7.3+2.65*Math.min((u-3.95)/(11.15-3.95),(17.8-u)/(17.8-11.15));
 return Math.max(10+3.8*Math.min(u/11.3,(21.4-u)/(21.4-11.3)),10+3.8*Math.min(v/10.95,(21.65-v)/(21.65-10.95)));
}

function drainPoint(d: {face: string; centre: number},y: number,offset: number): Point3{
 if(d.face==='WNW-SSW')return[d.centre,y,17.43+offset];
 if(d.face==='WNW-NNE')return[d.centre,y,3.93-offset];
 if(d.face==='SSW-ESE')return[17.8+offset,y,d.centre];
 return[3.95-offset,y,d.centre];
}

export function addRodinaServices(block: Block,emit: Emit,{wall,frame,infill}: ShellMaterials){
 const audit={buildingId:rodinaServices.buildingId,uniqueBuilding:true,reuse:rodinaServices.reuse,terminals:[] as Record<string,unknown>[],drains:[] as Record<string,unknown>[],limits:rodinaServices.limits};
 function surface(name: string,p: number[][],n: number[],material=frame){const u=new THREE.Vector3().subVectors(new THREE.Vector3(...p[1]),new THREE.Vector3(...p[0])),v=new THREE.Vector3().subVectors(new THREE.Vector3(...p[2]),new THREE.Vector3(...p[0])),forward=u.cross(v).dot(new THREE.Vector3(...n))>0,ids=[];for(let i=1;i<p.length-1;i++)ids.push(...(forward?[0,i,i+1]:[0,i+1,i]));return emit(name,p,ids,material);}
 function tube(name: string,points: number[][],r: number,thickness=.012){
  const inner=r-thickness,n=12,centres=points.map(p=>new THREE.Vector3(...p)),rings=centres.map((p,i)=>{const tangent=i===0?centres[1].clone().sub(p):i===centres.length-1?p.clone().sub(centres[i-1]):centres[i+1].clone().sub(centres[i-1]);tangent.normalize();const x=new THREE.Vector3(1,0,0);if(Math.abs(tangent.dot(x))>.9)x.set(0,0,1);x.addScaledVector(tangent,-x.dot(tangent)).normalize();return{p,tangent,x,z:new THREE.Vector3().crossVectors(tangent,x).normalize()};});
  const at=(ring: typeof rings[number],a: number,radius: number)=>ring.p.clone().addScaledVector(ring.x,Math.cos(a)*radius).addScaledVector(ring.z,Math.sin(a)*radius).toArray();
  for(let j=1;j<rings.length;j++)for(let i=0;i<n;i++){
   const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,A=rings[j-1],B=rings[j],normal=A.x.clone().multiplyScalar(Math.cos((a+b)/2)).addScaledVector(A.z,Math.sin((a+b)/2)).toArray();
   surface(name+'-outer',[at(A,a,r),at(A,b,r),at(B,b,r),at(B,a,r)],normal);
   surface(name+'-bore',[at(A,a,inner),at(A,b,inner),at(B,b,inner),at(B,a,inner)],normal.map(x=>-x));
  }
  for(const j of [0,rings.length-1])for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,R=rings[j];surface(name+'-open-rim',[at(R,a,r),at(R,b,r),at(R,b,inner),at(R,a,inner)],R.tangent.clone().multiplyScalar(j===0?-1:1).toArray());}
 }
 function hopper(d: typeof rodinaServices.drains[number] & {rim: number; bowlBottom: number; depth: number}){
  const n=12,top=d.rim,bottom=d.bowlBottom!,centre=drainPoint(d,0,d.depth!),r=.27,neck=d.radius;
  for(let i=0;i<n;i++){
   const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,point=(t: number,y: number,rad: number)=>[centre[0]+Math.cos(t)*rad,y,centre[2]+Math.sin(t)*rad],normal=[Math.cos((a+b)/2),.5,Math.sin((a+b)/2)];
   surface(d.id+'-bowl-outer',[point(a,bottom,neck),point(b,bottom,neck),point(b,top,r),point(a,top,r)],normal);
   surface(d.id+'-bowl-inner',[point(a,bottom,neck-.012),point(b,bottom,neck-.012),point(b,top,r-.015),point(a,top,r-.015)],normal.map(x=>-x));
   surface(d.id+'-bowl-rim',[point(a,top,r),point(b,top,r),point(b,top,r-.015),point(a,top,r-.015)],[0,1,0]);
  }
 }
 function bracket(d: typeof rodinaServices.drains[number],y: number){const a=drainPoint(d,y,.0),b=drainPoint(d,y,d.pipeDepth-d.radius),p=.018;if(d.face.startsWith('WNW'))block(d.id+'-wall-bracket',a[0]-p,a[0]+p,y-p,y+p,Math.min(a[2],b[2]),Math.max(a[2],b[2]),frame);else block(d.id+'-wall-bracket',Math.min(a[0],b[0]),Math.max(a[0],b[0]),y-p,y+p,a[2]-p,a[2]+p,frame);}
 for(const t of rodinaServices.terminals){
  if(t.type==='pipe'){
   const base=rodinaRoofY(t.u,t.v),top=base+t.rise;tube(t.id+'-roof-terminal',[[t.u,base-.12,t.v],[t.u,top,t.v]],t.radius!);audit.terminals.push({...t,base,top});continue;
  }
  const corners=[[-t.width!/2,-t.depth!/2],[t.width!/2,-t.depth!/2],[t.width!/2,t.depth!/2],[-t.width!/2,t.depth!/2]].map(([x,z])=>[t.u+x,t.v+z]),base=corners.map(([u,v])=>rodinaRoofY(u,v)),top=Math.max(...base)+t.rise,inside=t.type==='stack'?.13:.065;
  const normals=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]],inner=corners.map(([u,v])=>[u+(u<t.u?inside:-inside),v+(v<t.v?inside:-inside)]),outer=corners.map(([u,v])=>[u+(u<t.u?-.045:.045),v+(v<t.v?-.045:.045)]);
  for(let i=0;i<4;i++){const j=(i+1)%4,a=corners[i],b=corners[j],c=inner[i],d=inner[j],e=outer[i],f=outer[j];
   surface(t.id+'-stack-wall',[[a[0],base[i]-.045,a[1]],[b[0],base[j]-.045,b[1]],[b[0],top-.04,b[1]],[a[0],top-.04,a[1]]],normals[i],wall);
   surface(t.id+'-stack-mouth',[[c[0],top-.04,c[1]],[d[0],top-.04,d[1]],[d[0],top-.22,d[1]],[c[0],top-.22,c[1]]],normals[i].map(x=>-x),infill);
   surface(t.id+'-cap-rim',[[e[0],top,e[1]],[f[0],top,f[1]],[d[0],top,d[1]],[c[0],top,c[1]]],[0,1,0]);
   surface(t.id+'-cap-outer',[[e[0],top-.04,e[1]],[f[0],top-.04,f[1]],[f[0],top,f[1]],[e[0],top,e[1]]],normals[i]);
   surface(t.id+'-cap-under',[[e[0],top-.04,e[1]],[f[0],top-.04,f[1]],[b[0],top-.04,b[1]],[a[0],top-.04,a[1]]],[0,-1,0]);
   surface(t.id+'-cap-inner',[[c[0],top,c[1]],[d[0],top,d[1]],[d[0],top-.04,d[1]],[c[0],top-.04,c[1]]],normals[i].map(x=>-x));
  }
  surface(t.id+'-mouth-recess',inner.map(([u,v])=>[u,top-.22,v]),[0,1,0],infill);audit.terminals.push({...t,footprint:corners,baseCorners:base,top,mouthDepth:.22});
 }
 for(const d of rodinaServices.drains){
  const points=d.rim?[drainPoint(d,d.bowlBottom!,d.depth!),drainPoint(d,d.bowlBottom!-.16,d.depth!),drainPoint(d,d.bowlBottom!-.4,(d.depth!+d.pipeDepth)/2),drainPoint(d,d.bowlBottom!-.75,d.pipeDepth),drainPoint(d,d.bottom,d.pipeDepth)]:[drainPoint(d,d.top!,d.pipeDepth),drainPoint(d,d.bottom,d.pipeDepth)];
  if(d.rim)hopper(d as typeof d & {rim: number; bowlBottom: number; depth: number});tube(d.id+'-pipe',points,d.radius);for(const y of d.brackets)bracket(d,y);audit.drains.push({...d,path:points});
 }
 const p=rodinaServices.cornerPipe;tube(p.id,[[p.u,p.top,p.v],[p.u,p.bottom,p.v]],p.radius);
 for(const y of p.brackets)block(p.id+'-wall-bracket',p.u+p.radius,-.19,y-.018,y+.018,p.v-.018,p.v+.018,frame);
 audit.drains.push({...p,path:[[p.u,p.top,p.v],[p.u,p.bottom,p.v]]});return audit;
}
