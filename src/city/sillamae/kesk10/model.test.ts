import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding,createEnvelope} from './model.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import {roofPolygons,wallPolygons,length,footprint,planPoint} from './symmetric-shell.ts';
import {openings,openingFrame} from './openings.ts';

test('main roof and structural shell mirror about the street centreline',()=>{
 const dx=30.72/length,dz=15.01/length;
 const key=(u:number,v:number,h:number)=>[u,v,h].map(n=>Math.round(n*1e4)).join(',');
 for(const polys of [roofPolygons,wallPolygons]){
  const local=polys.flat().map(([x,z,h])=>[(x-302.4)*dx+(z-555.92)*dz,(x-302.4)*dz-(z-555.92)*dx,h]);
  const points=new Set(local.map(p=>key(p[0],p[1],p[2])));
  for(const [u,v,h] of local)assert.ok(points.has(key(length-u,v,h)),`unmatched reflected vertex ${u},${v},${h}`);
 }
 const original=[[302.4,555.92],[310.51,559.88],[311.1,558.66],[325.18,565.63],[324.62,566.78],[333.12,570.93],[340.93,554.85],[310.21,539.86]];
 footprint.forEach((p,i)=>assert.ok(Math.hypot(p[0]-original[i][0],p[1]-original[i][1])<.25));
});

test('both front gables contain a high arched aperture above the paired windows',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 for(const end of ['west','east']){
  const o=openings.find(o=>o.id===`street-${end}-high`)!;
  assert.ok(o.arch>0&&o.bottom>8.5&&o.top>10.5);
  const f=openingFrame(o),x=o.a[0]+f.dx*f.length*o.centre,z=o.a[1]+f.dz*f.length*o.centre;
  const ray=new THREE.Raycaster(new THREE.Vector3(x+f.nx*2,24,z+f.nz*2),new THREE.Vector3(-f.nx,0,-f.nz),0,2.2);
  assert.equal(ray.intersectObject(m.root.getObjectByName('walls')!).length,0);
  ray.far=2.5;assert.ok(ray.intersectObject(m.root.getObjectByName(o.id+'-infill')!).length);
 }
 m.dispose();
});

test('side gables occupy the outer wall plane and raised return thickness has a closed top',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 const dx=30.72/length,dz=15.01/length,walls=m.root.getObjectByName('walls')!;
 for(const side of [-1,1]){
  const u=side===1?length:0;
  for(const v of [5,6,7,8,9,10]){
   const top=v<=6?25.70:v<8.15?25.70+(v-6)*1.95/(8.15-6):27.65-(v-8.15)*1.95/(10.327-8.15);
   const [x,z]=planPoint(u,v),ray=new THREE.Raycaster(new THREE.Vector3(x+side*dx*2,top-.15,z+side*dz*2),new THREE.Vector3(-side*dx,0,-side*dz),0,2.05);
   const hits=ray.intersectObject(walls);assert.ok(hits.length,`missing gable face at ${side}, ${v}`);assert.ok(Math.abs(hits[0].distance-2)<.01);
  }
  for(const v of [4.5,5.5]){
   const [x,z]=planPoint(u,v),ray=new THREE.Raycaster(new THREE.Vector3(x+side*dx*2,25.95,z+side*dz*2),new THREE.Vector3(-side*dx,0,-side*dz),0,2.05);
   assert.equal(ray.intersectObject(walls).length,0,'aerial and side photo show straight eave before the narrow gable');
  }
  const [x,z]=planPoint(side===1?32:length-32,10.18);
  const hits=new THREE.Raycaster(new THREE.Vector3(x,28,z),new THREE.Vector3(0,-1,0),0,2.5).intersectObjects([walls,m.root.getObjectByName('survey-roof')!]);
  assert.ok(hits.length,'raised return must have an opaque top across its thickness');
 }
 const roof=m.root.getObjectByName('street-dormer-roof') as THREE.Mesh;
 const normals=roof.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>0,'front dormer roof faces upward');
 m.dispose();
});

test('inner wing eaves are level, straight and closed up to the central roof junction',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 const dx=30.72/length,dz=15.01/length,walls=m.root.getObjectByName('walls')!;
 for(const side of [-1,1])for(const v of [1.5,2.5,3.5,4.5,5.5,6.0]){
  const u=side===1?length-9.242:9.242,[x,z]=planPoint(u,v),direction=new THREE.Vector3(side*dx,0,side*dz);
  const ray=new THREE.Raycaster(new THREE.Vector3(x-side*dx,25.6,z-side*dz),direction,0,1.05);
  const hits=ray.intersectObject(walls);assert.ok(hits.length,`inner wall has folded away at ${side},${v}`);assert.ok(Math.abs(hits[0].distance-1)<.01);
  ray.ray.origin.y=25.8;assert.equal(ray.intersectObject(walls).length,0,'inner eave must not climb above its level datum');
  const [cx,cz]=planPoint(u+side*.16,v);
  const cap=new THREE.Raycaster(new THREE.Vector3(cx,28,cz),new THREE.Vector3(0,-1,0),0,2.4).intersectObjects([walls,m.root.getObjectByName('survey-roof')!]);
  assert.ok(cap.length,'straight eave thickness must be capped');
  assert.ok(cap[0].point.y>=25.7-.005);
 }
 const roof=m.root.getObjectByName('survey-roof') as THREE.Mesh;
 const n=roof.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>=-1e-6,'roof facets must face upwards');
 m.dispose();
});

test('all four gables meet the roof without exposed masonry strips above its pitch',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 const walls=m.root.getObjectByName('walls')!,roof=m.root.getObjectByName('survey-roof')!;
 let checked=0;
 for(const end of [0,length])for(const inset of [.04,.12,.22,.30])for(let along=.15;along<10.2;along+=.13){
  for(const [u,v] of [[end===0?inset:length-inset,along],[end===0?along:length-along,inset]]){
   const [x,z]=planPoint(u,v),ray=new THREE.Raycaster(new THREE.Vector3(x,35,z),new THREE.Vector3(0,-1,0));
   const r=ray.intersectObject(roof),w=ray.intersectObject(walls);
   if(!r.length||r[0].point.y<25.6)continue;
   checked++;
   assert.ok(!w.length||w[0].point.y<r[0].point.y-.0001,`exposed wall cap at ${u},${v}: wall ${w[0]?.point.y}, roof ${r[0].point.y}`);
  }
 }
 assert.ok(checked>800);m.dispose();
});

test('aerial roof junction stays above and behind the separate straight eave endpoint',()=>{
 const dx=30.72/length,dz=15.01/length;
 const polygons=roofPolygons.map(poly=>poly.map(([x,z,h])=>[(x-302.4)*dx+(z-555.92)*dz,(x-302.4)*dz-(z-555.92)*dx,h]));
 for(const side of [-1,1]){
  const onSide=(p:number[])=>side*(p[0]-length/2)>0;
  const eave=(p:number[])=>onSide(p)&&Math.abs(p[1]-6.72)<.01&&Math.abs(p[2]-25.70)<.01;
  const valley=(p:number[])=>onSide(p)&&Math.abs(p[1]-8.205)<.02&&Math.abs(p[2]-26.57)<.01;
  const ridge=(p:number[])=>onSide(p)&&Math.abs(p[1]-9.661)<.02&&Math.abs(p[2]-27.40)<.01;
  const edge=(a:(p:number[])=>boolean,b:(p:number[])=>boolean)=>polygons.some(poly=>poly.some((p,i)=>a(p)&&b(poly[(i+1)%poly.length])||b(p)&&a(poly[(i+1)%poly.length])));
  assert.ok(edge(eave,valley),'aerial shows a rising connection beyond the level eave');
  assert.ok(edge(valley,ridge),'retain the survey valley-to-main-ridge branch visible in the aerial');
 }
});

test('rear roof pitch is planar and the raised wing return has one continuous plane',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 const roof=m.root.getObjectByName('survey-roof')!;
 const height=(u:number,v:number)=>{
  const [x,z]=planPoint(u,v),hits=new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0)).intersectObject(roof);
  assert.ok(hits.length,'rear pitch must be closed');
  assert.ok(hits.every(h=>Math.abs(h.point.y-hits[0].point.y)<1e-4),'no stacked roof fragments');
  return hits[0].point.y;
 };
 const h=height(12,11),du=(height(22,11)-h)/10,dv=(height(12,17)-h)/6;
 for(let u=10.37;u<24;u+=1.73)for(let v=11.13;v<17.5;v+=.83)
  assert.ok(Math.abs(height(u,v)-(h+du*(u-12)+dv*(v-11)))<1e-4,'rear pitch must not contain an unintended crease');
 const dx=30.72/length,dz=15.01/length;
 const returns=wallPolygons.map(p=>p.map(([x,z,h])=>[(x-302.4)*dx+(z-555.92)*dz,(x-302.4)*dz-(z-555.92)*dx,h])).filter(p=>p.every(q=>q[1]>10&&q[1]<11));
 assert.ok(returns.length);
 for(const p of returns)for(const q of p)assert.ok(Math.abs(q[1]-10.326834641659211)<1e-5,'no offset folded fragments behind the raised wing');
 m.dispose();
});

function context(height=14.41): OverrideContext {
 return {scene:new THREE.Scene(),building:{id:'65395731',pick:113,name:'Kesk 10',c:[321.625,555.1],g:[[302.2,555.5],[310.8,539],[341,554.7],[332.5,571.2]],h:13.11},frame:{origin:[0,0],base:0},terrain:{origin:[0,0],step:1,width:0,height:0,values:[],meta:{}},ground:[[290,530,height,350,530,height,350,580,height],[290,530,height,350,580,height,290,580,height]]};
}
test('the street shell cuts ten arched upper windows, four lower windows and three entrances',()=>{
 const m=createBuilding(context());
 const ids=m.root.children.map(c=>c.name);
 assert.equal(ids.filter(n=>/^street-centre-L2-\d+-reveal$/.test(n)).length,10);
 assert.equal(ids.filter(n=>/^street-centre-L1-\d+-reveal$/.test(n)).length,4);
 assert.equal(ids.filter(n=>/^street-.*-door-reveal$/.test(n)).length,3);
 const row=openings.filter(o=>/^street-centre-L2-/.test(o.id));
 for(let pair=0;pair<4;pair++){
  const inner=row[pair*2+1].centre-row[pair*2].centre,outer=row[pair*2+2].centre-row[pair*2+1].centre;
  assert.ok(inner<outer*.85,'Street View shows five distinct pairs, not an evenly spaced row');
 }
 assert.ok(Math.abs(row[0].centre-.055)<1e-8&&Math.abs(row[9].centre-.945)<1e-8,'pairing retains the overall row span');
 m.root.updateMatrixWorld(true);
 // First lower centre opening, independently positioned along the surveyed recessed wall.
 for(const o of openings.filter(o=>/^street-.*-L2-/.test(o.id))){
  const f=openingFrame(o),x=o.a[0]+f.dx*f.length*o.centre,z=o.a[1]+f.dz*f.length*o.centre;
  const ray=new THREE.Raycaster(new THREE.Vector3(x+f.nx*2,14.41+7.4,z+f.nz*2),new THREE.Vector3(-f.nx,0,-f.nz),0,2.05);
  assert.ok(ray.intersectObject(m.root.getObjectByName('walls')!).length,'masonry above the shorter front arch must be restored');
  ray.ray.origin.y=14.41+6.2;
  assert.equal(ray.intersectObject(m.root.getObjectByName('walls')!).length,0,'shorter arch retains a real opening');
 }
 const ax=311.1,az=558.66,dx=14.08/Math.hypot(14.08,6.97),dz=6.97/Math.hypot(14.08,6.97),x=ax+1.571*dx,z=az+1.571*dz;
 const ray=new THREE.Raycaster(new THREE.Vector3(x-dz*3,16.5,z+dx*3),new THREE.Vector3(dz,0,-dx),0,3.2);
 assert.equal(ray.intersectObject(m.root.getObjectByName('walls')!).length,0,'masonry must not cover the lower opening');
 ray.far=3.5;
 assert.ok(ray.intersectObject(m.root.getObjectByName('street-centre-L1-1-infill')!).length>0,'recessed infill must sit behind the opening');
 const old=createEnvelope(context());old.root.updateMatrixWorld(true);
 assert.ok(ray.intersectObject(old.root,true).length>0,'the original solid block must fail the opening probe');
 old.dispose();m.dispose();
});
test('foundation follows entrance ground and all roof vertices move by the same change',()=>{
 const low=createBuilding(context()),high=createBuilding(context(16.41));
 assert.equal(high.root.userData.audit.datum-low.root.userData.audit.datum,2);
 assert.ok(high.root.userData.audit.foundationBottom<16.41);
 const a=(low.root.getObjectByName('survey-roof') as THREE.Mesh).geometry.getAttribute('position');
 const b=(high.root.getObjectByName('survey-roof') as THREE.Mesh).geometry.getAttribute('position');
 assert.equal(a.count,b.count);for(let i=0;i<a.count;i++)assert.ok(Math.abs(b.getY(i)-a.getY(i)-2)<1e-4);
 low.dispose();high.dispose();
});
test('roof has outward upper faces, finite geometry and no visible double-sided materials',()=>{
 const m=createBuilding(context());let triangles=0;
 m.root.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');triangles+=p.count/3;for(const n of p.array)assert.ok(Number.isFinite(n));assert.equal((o.material as THREE.Material).side,THREE.FrontSide);}});
 assert.ok(triangles<15000,`unexpected tessellation: ${triangles}`);
 m.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(322,40,550),new THREE.Vector3(0,-1,0));
 assert.ok(ray.intersectObject(m.root.getObjectByName('survey-roof')!).length>0);
 assert.throws(()=>createBuilding({...context(),ground:[]}),/entrance ground/);
 m.dispose();m.dispose();
});
test('rear tower is wider, has only a bottom door, and its roof rises to the main eave',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 const walls=m.root.getObjectByName('rear-stairwell-walls')!,roof=m.root.getObjectByName('rear-stairwell-roof')!;
 const dx=30.72/length,dz=15.01/length;
 for(let angle=.08;angle<Math.PI;angle+=.11){
  const u=Math.cos(angle),v=Math.sin(angle),[x,z]=planPoint(17.25+3*u,18.3+3*v);
  const direction=new THREE.Vector3(-dx*u-dz*v,0,-dz*u+dx*v);
  const hits=new THREE.Raycaster(new THREE.Vector3(x,17.41,z),direction,0,2).intersectObject(walls);
  assert.ok(hits.length,'continuous curved wall');assert.ok(Math.abs(hits[0].distance-1)<.004,'circular wall must not flatten into broad chamfers');
  for(const r of [1.99,2.02]){
   const [rx,rz]=planPoint(17.25+r*u,18.3+r*v);
   const hit=new THREE.Raycaster(new THREE.Vector3(rx,25,rz),new THREE.Vector3(0,-1,0)).intersectObject(roof);
   assert.equal(hit.length>0,r<2,'roof eave follows the rounded wall');
  }
 }
 for(const [h,name] of [[1,'door']] as const){
  const [x,z]=planPoint(17.25,20.8),ray=new THREE.Raycaster(new THREE.Vector3(x,14.41+h,z),new THREE.Vector3(-dz,0,dx),0,1);
  assert.equal(ray.intersectObject(walls).length,0,'real opening through curved wall');
  const infill=ray.intersectObject(m.root.getObjectByName('rear-stairwell-'+name)!);
  assert.ok(infill.length&&infill[0].distance>.7,'infill remains recessed');
 }
 assert.equal(m.root.getObjectByName('rear-stairwell-window'),undefined);
 for(const h of [4.2,4.8,5.5]){
  const [x,z]=planPoint(17.25,20.8),ray=new THREE.Raycaster(new THREE.Vector3(x,14.41+h,z),new THREE.Vector3(-dz,0,dx),0,1);
  const hits=ray.intersectObject(walls);assert.ok(hits.length&&Math.abs(hits[0].distance-.5)<.005,'continuous masonry at former window');
 }
 const p=(roof as THREE.Mesh).geometry.getAttribute('position');let peak=-Infinity,peakV=0;
 for(let i=0;i<p.count;i++)if(p.getY(i)>peak){peak=p.getY(i);peakV=(p.getX(i)-302.4)*dz-(p.getZ(i)-555.92)*dx;}
 assert.ok(peakV<17.876,'roof high point joins main building, not the centre of the addition');
 const [jx,jz]=planPoint(17.25,17.65);
 const ray=new THREE.Raycaster(new THREE.Vector3(jx,30,jz),new THREE.Vector3(0,-1,0));
 const main=ray.intersectObject(m.root.getObjectByName('survey-roof')!);
 assert.ok(main.length&&Math.abs(peak-main[0].point.y)<.001,'roof peak meets the main roof without a gap');
 m.dispose();
});

test('rear and southeast masonry seats stay inside their surveyed exterior planes',()=>{
 const m=createBuilding(context());m.root.updateMatrixWorld(true);
 for(const [a,b] of [[[333.12,570.93],[340.93,554.85]],[[340.93,554.85],[310.21,539.86]]]){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
  const x=a[0]+(b[0]-a[0])*.22,z=a[1]+(b[1]-a[1])*.22;
  const ray=new THREE.Raycaster(new THREE.Vector3(x-dz*2,18.41,z+dx*2),new THREE.Vector3(dz,0,-dx),0,2.6);
  const hits=ray.intersectObject(m.root.getObjectByName('walls')!);
  assert.ok(hits.length);assert.ok(Math.abs(hits[0].distance-2)<.03,`exterior moved outward: ${hits[0].distance}`);
 }
 m.dispose();
});


