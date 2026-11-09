import * as THREE from 'three';
import type {OverrideContext, Point2} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {createMassingStudy} from '../../../studio/assembly/massing.ts';
import {design} from './design.ts';
import type {SurveyPoint} from './survey-shell.ts';
import {footprint, wallPolygons, roofPolygons} from './symmetric-shell.ts';
import {openings, openingFrame, openingLoop, type Opening} from './openings.ts';

const surveyDatum=14.41, thickness=.32;
export function createEnvelope(context: OverrideContext) { return createMassingStudy(context,design); }
export function entrancePoints(): Point2[] {
  return openings.filter(o=>o.kind==='door').map(o=>{const f=openingFrame(o);return [o.a[0]+f.dx*f.length*o.centre+f.nx*.6,o.a[1]+f.dz*f.length*o.centre+f.nz*.6];});
}

function split(poly: SurveyPoint[], distance: (p: SurveyPoint)=>number, positive: boolean) {
  const out: SurveyPoint[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length], da=distance(a)*(positive?1:-1),db=distance(b)*(positive?1:-1);
    if(da>=-1e-8)out.push(a);
    if((da>1e-8&&db< -1e-8)||(da< -1e-8&&db>1e-8)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t) as SurveyPoint);}
  }
  return out;
}
function subtract(poly: SurveyPoint[], o: Opening, datum: number) {
  const f=openingFrame(o),loop=openingLoop(o),out: SurveyPoint[][]=[];
  let inside=poly;
  for(let i=0;i<loop.length&&inside.length>=3;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];
    const distance=(p:SurveyPoint)=>{const x=(p[0]-o.a[0])*f.dx+(p[1]-o.a[1])*f.dz;return (b[0]-a[0])*(p[2]-datum-a[1])-(b[1]-a[1])*(x-a[0]);};
    const outside=split(inside,distance,false);if(outside.length>=3)out.push(outside);
    inside=split(inside,distance,true);
  }
  return inside.length>=3?out:[poly];
}

export function createBuilding({frame,ground}: OverrideContext): StudyModel {
  const groundDatum=entranceDatum(ground,entrancePoints());
  if(groundDatum===null)throw Error('Kesk 10 requires actual entrance ground to seat its foundation');
  const datum:number=groundDatum;
  const near=ground.filter(t=>t.some((v,i)=>i%3===0&&v>300&&v<343)&&t.some((v,i)=>i%3===1&&v>537&&v<573));
  const samples=near.flatMap(t=>[t[2],t[5],t[8]]).filter(h=>h>datum-5&&h<datum+5);
  const bottom=Math.min(datum,...samples)-.6, lift=datum-surveyDatum;
  const root=new THREE.Group();root.name='kesk10-plain-shell';
  const materials=[new THREE.MeshStandardMaterial({color:'#d1cfc6',roughness:1}),new THREE.MeshStandardMaterial({color:'#a4a6a2',roughness:1}),new THREE.MeshStandardMaterial({color:'#8a9393',roughness:1}),new THREE.MeshStandardMaterial({color:'#b5b2a7',roughness:1})];
  const geometries: THREE.BufferGeometry[]=[];
  function mesh(name: string, polys: SurveyPoint[][], material: number) {
    const positions:number[]=[];
    for(const p of polys)for(let i=1;i<p.length-1;i++){
      const a=p[0],b=p[i],c=p[i+1],u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
      // Collinear survey facets can become visible slivers after Float32 conversion.
      if((u[1]*v[2]-u[2]*v[1])**2+(u[2]*v[0]-u[0]*v[2])**2+(u[0]*v[1]-u[1]*v[0])**2<1e-12)continue;
      for(const q of [a,b,c])positions.push(q[0]-frame.origin[0],q[2]-frame.base,q[1]-frame.origin[1]);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();geometries.push(geo);
    const m=new THREE.Mesh(geo,materials[material]);m.name=name;m.userData.id='kesk10/'+name;m.castShadow=m.receiveShadow=true;root.add(m);return m;
  }
  const shifted=(p:SurveyPoint):SurveyPoint=>[p[0],p[1],p[2]<15.17?bottom:p[2]+lift];
  const walls:SurveyPoint[][]=[];
  const wallFronts=wallPolygons.map(f=>f.map(shifted));
  const vector=(p:SurveyPoint)=>new THREE.Vector3(p[0],p[2],p[1]);
  function roofHeight(x:number,z:number){
    let height=-Infinity;
    for(const poly of roofPolygons)for(let i=1;i<poly.length-1;i++){
      const [a,b,c]=[poly[0],poly[i],poly[i+1]],d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-8)continue;
      const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/d,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-7)height=Math.max(height,u*a[2]+v*b[2]+w*c[2]+lift);
    }
    return height;
  }
  const inset=(q:SurveyPoint,n:THREE.Vector3):SurveyPoint=>{
    const x=q[0]-n.x*thickness,z=q[1]-n.z*thickness,h=q[2]-n.y*thickness,roof=roofHeight(x,z);
    // A sloping gable's inner face must terminate at the roof, not extrude through it.
    return [x,z,Number.isFinite(roof)?Math.min(h,roof):h];
  };
  for(const tri of wallFronts){
    const edges=footprint.map((a,i)=>{const b=footprint[(i+1)%footprint.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,nx:-(b[1]-a[1])/l,nz:(b[0]-a[0])/l};});
    const edge=edges.find(f=>tri.every(p=>Math.abs((p[0]-f.a[0])*f.nx+(p[1]-f.a[1])*f.nz)<.075));
    if(edge){
      const f=edge,[a,b,c]=tri;
      const nx=(b[2]-a[2])*(c[1]-a[1])-(b[1]-a[1])*(c[2]-a[2]),nz=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
      // Some source faces wind inward, including the recessed return; thickness must extend into the building.
      if(nx*f.nx+nz*f.nz<0)tri.reverse();
    }else{
      const n=vector(tri[1]).sub(vector(tri[0])).cross(vector(tri[2]).sub(vector(tri[0]))).normalize();
      const p=tri.reduce((a,p)=>a.add(vector(p)),new THREE.Vector3()).divideScalar(tri.length);
      // Raised returns also face outward, toward the lower roof, rather than into the high wing.
      if(roofHeight(p.x+n.x*.08,p.z+n.z*.08)>p.y+.02&&roofHeight(p.x-n.x*.08,p.z-n.z*.08)<p.y-.02)tri.reverse();
    }
    let pieces=[tri];
    for(const o of openings){const f=openingFrame(o);if(tri.every(p=>Math.abs((p[0]-o.a[0])*f.nx+(p[1]-o.a[1])*f.nz)<.075))pieces=pieces.flatMap(p=>subtract(p,o,datum));}
    walls.push(...pieces);
    const a=new THREE.Vector3(tri[0][0],tri[0][2],tri[0][1]),b=new THREE.Vector3(tri[1][0],tri[1][2],tri[1][1]),c=new THREE.Vector3(tri[2][0],tri[2][2],tri[2][1]);
    const n=b.sub(a).cross(c.sub(a)).normalize();
    for(const p of pieces){
      const back=p.map(q=>inset(q,n));
      walls.push([...back].reverse());
    }
    // Only cap exposed perimeter segments. Internal triangulation caps produce coplanar
    // slivers at the exterior; opening boundaries already have continuous reveals.
    if(n.lengthSq()<.5)continue;
    const coplanar=wallFronts.filter(p=>p!==tri&&p.every(q=>Math.abs(vector(q).sub(a).dot(n))<1e-5));
    for(let i=0;i<tri.length;i++){
      const p=tri[i],q=tri[(i+1)%tri.length],start=vector(p),edge=vector(q).sub(start),l2=edge.lengthSq();if(l2<1e-10)continue;
      const spans:number[][]=[];
      for(const poly of coplanar)for(let j=0;j<poly.length;j++){
        const c=vector(poly[j]).sub(start),d=vector(poly[(j+1)%poly.length]).sub(start);
        if(c.clone().cross(edge).lengthSq()>l2*1e-10||d.clone().cross(edge).lengthSq()>l2*1e-10)continue;
        const t=c.dot(edge)/l2,u=d.dot(edge)/l2,lo=Math.max(0,Math.min(t,u)),hi=Math.min(1,Math.max(t,u));
        if(hi-lo>1e-7)spans.push([lo,hi]);
      }
      const cuts=[0,1,...spans.flat()].sort((a,b)=>a-b);
      for(let j=0;j<cuts.length-1;j++){
        const lo=cuts[j],hi=cuts[j+1],mid=(lo+hi)/2;if(hi-lo<1e-7||spans.some(([a,b])=>mid>=a&&mid<=b))continue;
        const at=(t:number):SurveyPoint=>p.map((v,k)=>v+(q[k]-v)*t) as SurveyPoint;
        const front=[at(lo),at(hi)],back=front.map(q=>inset(q,n));
        const cap=[front[0],back[0],back[1],front[1]];
        if(!cap.every(q=>roofHeight(q[0],q[1])>=q[2]-1e-6))walls.push(cap);
      }
    }
  }
  mesh('walls',walls,0);
  mesh('survey-roof',roofPolygons.map(f=>f.map(p=>[p[0],p[1],p[2]+lift] as SurveyPoint).reverse()),1);
  for(const o of openings){
    const f=openingFrame(o),loop=openingLoop(o),point=(p:Point2,d:number):SurveyPoint=>[o.a[0]+f.dx*p[0]-f.nx*d,o.a[1]+f.dz*p[0]-f.nz*d,datum+p[1]];
    const front=loop.map(p=>point(p,0)),back=loop.map(p=>point(p,thickness)),reveals:SurveyPoint[][]=[];
    for(let i=0;i<loop.length;i++){const j=(i+1)%loop.length;reveals.push([front[i],front[j],back[j],back[i]]);}
    // A blank panel overlaps its masonry seat; keep the actual reveal unobstructed.
    const cx=o.centre*f.length,cy=(o.bottom+o.top)/2;
    const panelLoop=loop.map(p=>[cx+(p[0]-cx)*(1+.20/o.width),cy+(p[1]-cy)*(1+.20/(o.top-o.bottom))] as Point2);
    const panelFront=panelLoop.map(p=>point(p,thickness)),inner=panelLoop.map(p=>point(p,thickness+.04));
    const panel=[panelFront,[...inner].reverse(),...panelFront.map((p,i)=>{const j=(i+1)%panelFront.length;return [p,inner[i],inner[j],panelFront[j]];})];
    mesh(o.id+'-reveal',reveals,0);mesh(o.id+'-infill',panel,2);
    if(o.kind==='door') {
      const x=o.centre*f.length,w=o.width/2+.25,foot=entranceDatum(ground,[[o.a[0]+f.dx*x+f.nx,o.a[1]+f.dz*x+f.nz]])??datum;
      const base=foot-.4,top=datum+o.bottom;
      const p=[point([x-w,base-datum],-1.0),point([x+w,base-datum],-1.0),point([x+w,base-datum],.04),point([x-w,base-datum],.04)],q=p.map(a=>[a[0],a[1],top] as SurveyPoint);
      mesh(o.id+'-landing',[[...q].reverse(),p,...[0,1,2,3].map(i=>[p[i],q[i],q[(i+1)%4],p[(i+1)%4]])],3);
      const count=Math.max(1,Math.ceil((top-foot)/.17));
      for(let step=1;step<count;step++){
        const d=-1-step*.30, rise=(top-foot)*(count-step)/count;
        const p=[point([x-w,base-datum],d),point([x+w,base-datum],d),point([x+w,base-datum],d+.31),point([x-w,base-datum],d+.31)];
        const q=p.map(a=>[a[0],a[1],foot+rise] as SurveyPoint);
        mesh(o.id+`-step-${step}`,[[...q].reverse(),p,...[0,1,2,3].map(i=>[p[i],q[i],q[(i+1)%4],p[(i+1)%4]])],3);
      }
      if(o.id.startsWith('street-')||o.id==='northwest-door'){
        const top=o.id==='northwest-door'?4.5:4.95,shoulder=top-.6,outer:Point2[]=[[x-1.45,0],[x+1.45,0],[x+1.45,shoulder],[x,top],[x-1.45,shoulder]];
        if(o.id==='northwest-door')outer.splice(2,3,[x+1.45,top],[x-1.45,top]);
        const front=outer.map(p=>point(p,-.35)),back=outer.map(p=>point(p,.02));
        const surround=subtract(front,o,datum);
        for(let i=0;i<front.length;i++){const j=(i+1)%front.length;surround.push([front[i],back[i],back[j],front[j]]);}
        const portal=loop.map(p=>point(p,-.35)),seat=loop.map(p=>point(p,.02));
        for(let i=0;i<portal.length;i++){const j=(i+1)%portal.length;surround.push([portal[i],portal[j],seat[j],seat[i]]);}
        mesh(o.id+'-surround',surround,0);
      }
    }
  }
  const points=footprint.map(p=>new THREE.Vector2(p[0],p[1]));
  const floor=THREE.ShapeUtils.triangulateShape(points,[]).map(t=>t.map(i=>[footprint[i][0],footprint[i][1],datum] as SurveyPoint));
  // x/z polygon winding is opposite the renderer's x/y/z ground normal.
  mesh('foundation-top',floor.map(t=>[...t].reverse()),3);
  mesh('foundation-bottom',floor.map(t=>t.map(p=>[p[0],p[1],bottom] as SurveyPoint)),3);
  const length=Math.hypot(30.72,15.01),dx=30.72/length,dz=15.01/length;
  const local=(u:number,v:number,h:number):SurveyPoint=>[302.4+dx*u+dz*v,555.92+dz*u-dx*v,datum+h];
  function solid(name:string,u0:number,u1:number,v0:number,v1:number,base:number,top:number,material=0) {
    const p=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>local(u,v,base)),q=p.map(a=>[a[0],a[1],datum+top] as SurveyPoint);
    mesh(name,[[...q],[...p].reverse(),...[0,1,2,3].map(i=>[p[i],p[(i+1)%4],q[(i+1)%4],q[i]])],material);
  }
  // Fotoladu north views resolve a rounded tower; its width and projection remain photo estimates.
  const centre=17.25,radius=2,curveV=18.3,segments=32;
  const arc=Array.from({length:segments+1},(_,i)=>[centre+radius*Math.cos(i*Math.PI/segments),curveV+radius*Math.sin(i*Math.PI/segments)] as Point2);
  const stairPlan:Point2[]=[[centre-radius,17.65],[centre+radius,17.65],...arc];
  const stairBase=stairPlan.map(([u,v])=>local(u,v,bottom-datum)),stairTop=stairPlan.map(([u,v])=>local(u,v,6.7));
  const stairWalls:SurveyPoint[][]=[];
  const towerOpenings:[number,number][]=[[.18,2.25]];
  const cuts=towerOpenings.map(([bottom,top],i):Opening=>({id:`tower-${i}`,a:local(18.85,20.3,0).slice(0,2) as Point2,b:local(15.65,20.3,0).slice(0,2) as Point2,centre:.5,width:.9,bottom,top,arch:0,kind:i===0?'door':'window',basis:'Existing Fotoladu rear opening schedule'}));
  for(let i=0;i<stairPlan.length;i++){
    const j=(i+1)%stairPlan.length;
    let pieces=[[stairBase[i],stairBase[j],stairTop[j],stairTop[i]]];
    if(i>=2&&i<stairPlan.length-1)for(const o of cuts)pieces=pieces.flatMap(p=>subtract(p,o,datum));
    stairWalls.push(...pieces);
  }
  const tower=mesh('rear-stairwell-walls',stairWalls,0),position=tower.geometry.getAttribute('position'),normal=tower.geometry.getAttribute('normal');
  const [cx,cz]=local(centre,curveV,0);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)+frame.origin[0],z=position.getZ(i)+frame.origin[1],v=(x-302.4)*dz-(z-555.92)*dx;
    if(v<curveV-1e-5)continue;
    const n=new THREE.Vector3(x-cx,0,z-cz).normalize();normal.setXYZ(i,n.x,0,n.z);
  }
  const frontV=(u:number)=>{
    for(let i=0;i<arc.length-1;i++)if(u<=arc[i][0]&&u>=arc[i+1][0]){
      const t=(u-arc[i][0])/(arc[i+1][0]-arc[i][0]);return arc[i][1]+t*(arc[i+1][1]-arc[i][1]);
    }
    throw Error('Rear opening outside curved face');
  };
  const us=[16.8,...arc.map(p=>p[0]).filter(u=>u>16.8&&u<17.7).sort((a,b)=>a-b),17.7];
  const reveals:SurveyPoint[][]=[];
  for(const [lo,hi] of towerOpenings){
    for(let i=0;i<us.length-1;i++){
      const a=us[i],b=us[i+1];
      reveals.push([local(a,20.0,lo),local(b,20.0,lo),local(b,frontV(b),lo),local(a,frontV(a),lo)]);
      reveals.push([local(a,frontV(a),hi),local(b,frontV(b),hi),local(b,20.0,hi),local(a,20.0,hi)]);
    }
    for(const u of [16.8,17.7]){
      const p=[local(u,20.0,lo),local(u,frontV(u),lo),local(u,frontV(u),hi),local(u,20.0,hi)];
      reveals.push(u===16.8?p:p.reverse());
    }
  }
  mesh('rear-stairwell-reveals',reveals,0);
  solid('rear-stairwell-door',16.8,17.7,19.98,20.02,.18,2.25,2);
  // The photographed roof rises to the main eave, not to a freestanding cone peak.
  const join=local(centre,17.65,0),apex:SurveyPoint=[join[0],join[1],roofHeight(join[0],join[1])];
  mesh('rear-stairwell-roof',stairTop.map((p,i)=>[p,stairTop[(i+1)%stairTop.length],apex]),1);
  mesh('rear-stairwell-bottom',stairBase.map((p,i)=>[stairBase[(i+1)%stairBase.length],p,local(centre,curveV,bottom-datum)]),0);
  for(const [i,u] of [7,27].entries()) {
    const p=[local(u-.7,15.55,9.45),local(u+.7,15.55,9.45),local(u,15.55,10.65),local(u-.7,13.8,10.65),local(u+.7,13.8,10.65),local(u,13.8,11.4)];
    mesh(`rear-dormer-${i+1}`,[[p[0],p[2],p[5],p[3]],[p[2],p[1],p[4],p[5]],[p[3],p[5],p[4]],[p[0],p[3],p[4],p[1]]].map(f=>f.reverse()),1);
    const opening:Opening={id:`rear-dormer-${i+1}-vent`,a:[p[1][0],p[1][1]],b:[p[0][0],p[0][1]],centre:.5,width:.62,bottom:9.52,top:10.03,arch:0,kind:'window',basis:'Fotoladu 4816738: dark vent in each rear dormer'};
    mesh(opening.id+'-face',subtract([p[2],p[1],p[0]],opening,datum),0);
    solid(opening.id,u-.31,u+.31,15.40,15.44,9.52,10.03,2);
  }
  for(const [i,u] of [10.6,17.6,23.2].entries())solid(`ridge-stack-${i+1}`,u-.35,u+.35,9.1,9.75,12.4,14.0,1);
  {
    const u=length/2,p=[local(u-.7,3.4,10.2),local(u+.7,3.4,10.2),local(u,3.4,10.65),local(u-.7,5.75,10.72),local(u+.7,5.75,10.72),local(u,5.75,10.72)];
    const base=[local(u-.7,3.4,9.34),local(u+.7,3.4,9.34)];
    mesh('street-dormer-roof',[[p[0],p[3],p[5],p[2]],[p[2],p[5],p[4],p[1]]].map(f=>f.reverse()),1);
    const o:Opening={id:'street-dormer-vent',a:[p[0][0],p[0][1]],b:[p[1][0],p[1][1]],centre:.5,width:.6,bottom:9.45,top:10.05,arch:0,kind:'window',basis:'Fotoladu 4815045: central triangular front dormer'};
    mesh(o.id+'-face',subtract([base[0],base[1],p[1],p[2],p[0]],o,datum),0);
    mesh('street-dormer-cheeks',[[base[0],p[0],p[3]],[p[1],base[1],p[4]]],0);
    solid(o.id,u-.3,u+.3,3.50,3.54,9.45,10.05,2);
  }
  root.userData.audit={datum,foundationBottom:bottom,surveyDatum,roofLift:lift,openings:openings.length,stage:'plain shell',uncertainty:'Roof and main walls mirrored from SE survey form using Fotoladu evidence. Opening, stairwell, stack and dormer proportions inferred. Obscured lower rear details remain deferred.'};
  return {root,dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.removeFromParent();}};
}
