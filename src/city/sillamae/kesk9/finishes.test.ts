import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding} from './model.ts';
import {createFinishes} from './finishes.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {sourceFootprint} from './design.ts';
import {correctedOpeningSchedule,openingHalves} from './windows.ts';
import type {OverrideContext} from '../../../engine/types.ts';
type Mesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;

function context():OverrideContext {
  return {scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3]]};
}
function meshes(root:THREE.Object3D) {return root.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];}
function area(root:THREE.Object3D) {
  let total=0;
  for(const m of meshes(root)) {
    if(m.material.name.includes('sill metal')||m.material.userData.groundSurface||m.material.userData.detailAddition||m.material.userData.joinery||m.material.color.getHexString()==='d4d6d0')continue;
    const p=m.geometry.getAttribute('position'),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3){
      let poly=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));
      const clipped:THREE.Vector3[]=[];
      for(let j=0;j<poly.length;j++){const u=poly[j],v=poly[(j+1)%poly.length],inside=u.y<=16.70,next=v.y<=16.70;if(inside)clipped.push(u);if(inside!==next)clipped.push(u.clone().lerp(v,(16.70-u.y)/(v.y-u.y)));}
      poly=clipped;for(let j=1;j<poly.length-1;j++){a.copy(poly[0]);b.copy(poly[j]);c.copy(poly[j+1]);total+=b.sub(a).cross(c.sub(a)).length()/2;}
    }
  }
  return total;
}
function hit(root:THREE.Object3D,along:number,height:number,side:number) {
  const ray=new THREE.Raycaster(new THREE.Vector3(along,height,side*8),new THREE.Vector3(0,0,-side),0,4);
  return ray.intersectObject(root,true);
}
function local(root:THREE.Object3D) {root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);}

test('finish partition preserves the complete approved shell surface and contacts',()=>{
  const before=createBuilding(context(),correctedOpeningSchedule(),2),after=createFinishes(context());local(before.root);local(after.root);
  assert.ok(Math.abs(area(after.root)-area(before.root))<.03,'Partition loses a shell surface outside the separately tested joinery');
  for(const side of [-1,1])for(const x of [-32.76,-32.4,-31,-26,-13,0,13,26,31,32.4,32.76])for(const y of [-.1,.2,1.31,5.2,9.7,13.1,16.69,16.72]) {
    // y=5.2 lies exactly on the ESE L2 sill level; sills and the apron are fittings tested separately.
    const a=hit(before.root,x,y,side)[0],b=hit(after.root,x,y,side).find(h=>{const m=(h.object as Mesh).material;return !m.name.includes('sill metal')&&!m.userData.groundSurface;});
    assert.equal(!!b,!!a,`Changed closure ${x}/${y}/${side}`);if(a&&b)assert.ok(Math.abs(a.distance-b.distance)<1e-4);
  }
  before.dispose();after.dispose();
});

test('reference concrete lintels own a single flush surface on both elevations; basement openings have none',()=>{
  const model=createFinishes(context());local(model.root);
  for(const side of [-1,1])for(const x of [-4.5,4.5])for(const y of [1.14,1.18,1.25]) {
    const front=hit(model.root,x,y,side).filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);
    assert.equal(front.length,1);assert.ok((front[0].object as Mesh).material.name.includes('roughcast'),`Basement head ${x}/${y}/${side} is not roughcast`);
  }
  for(const side of [-1,1])for(const [x,y] of [[-3.85,3.86],[0,3.86]]) {
    const hits=hit(model.root,x,y,side),front=hits.filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);
    assert.equal(front.length,1,'Concrete must replace masonry without a second coplanar front');
    assert.ok((front[0].object as Mesh).material.name.includes('concrete'));
  }
  // These independent face samples must remain masonry outside the lintel.
  for(const side of [-1,1])for(const [x,y] of [[-3.85,4.05],[-6.1,4.05],[-4.5,1.25]]) {
    const h=hit(model.root,x,y,side)[0];assert.ok((h.object as Mesh).material.name.includes(y<1.3?'roughcast':'masonry'));
  }
  model.dispose();
});

test('metal sills cover the whole reveal floor from the wall face to the frame; basement openings have no sill',()=>{
  const m=createFinishes(context());local(m.root);const W=11.692812823626577;
  const down=(x:number,y:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,y+.3,z),new THREE.Vector3(0,-1,0),0,.4).intersectObject(m.root,true)[0];
  for(const o of correctedOpeningSchedule().filter(o=>o.kind!=='door'))for(const p of openingHalves(o)){
    const side=o.elevation==='WNW'?-1:1,x=(p.a+p.b)/2;
    for(const out of [-.16,-.10,-.03,.03]){
      const h=down(x,p.low,side*(W/2+out)),name=h?(h.object as Mesh).material.name:'';
      if(o.kind==='basement')assert.ok(!name.includes('sill metal'),`${o.id} must not have a metal sill`);
      else{assert.ok(name.includes('sill metal'),`${o.id} reveal at ${out} shows ${name}`);assert.ok(h.point.y>p.low&&h.point.y<p.low+.025);}
    }
  }
  assert.ok(!(m.root.children as Mesh[]).some(c=>/-B-S\d-[AB]-sill/.test(c.name)));
  assert.ok(m.root.userData.finishes.sills.every((s:{id:string})=>!s.id.includes('-B-')));
  m.dispose();
});

test('folded sills meet recessed frames and preserve open glass above both stepped levels',()=>{
  const model=createFinishes(context());local(model.root);
  for(const side of [-1,1])for(const [x,y] of side<0?[[-4.8,2.135],[-2.6,2.835]]:[[-4.8,2.235],[-1.8,2.885]]) {
    const sill=hit(model.root,x,y,side)[0];assert.ok((sill.object as Mesh).material.name.includes('sill metal'));
    const glass=hit(model.root,x,y+.3,side)[0];assert.ok(glass.distance>8-11.692812823626577/2+.15);
  }
  for(const m of meshes(model.root))for(const a of Object.values(m.geometry.attributes) as THREE.BufferAttribute[])for(const v of a.array)assert.ok(Number.isFinite(v));
  model.dispose();
});

test('two finish instances share canonical textures safely through toggles, disposal and pending readiness',async()=>{
  const shared=surfaces(),textures=Object.values(shared.maps).flat(),disposed:THREE.Texture[]=[];
  const listeners=textures.map(t=>{const listener=()=>disposed.push(t);t.addEventListener('dispose',listener);return {t,listener};});
  const state=textures.map(t=>[t.uuid,t.repeat.toArray(),t.offset.toArray(),t.flipY,t.colorSpace]);
  const first=createFinishes(context()),second=createFinishes(context()),maps=meshes(second.root).map(m=>[m.material.map,m.material.bumpMap]);
  first.setTextures!(false);assert.deepEqual(meshes(second.root).map(m=>[m.material.map,m.material.bumpMap]),maps);
  first.dispose();first.dispose();await first.ready;
  second.setTextures!(false);second.setTextures!(true);assert.deepEqual(meshes(second.root).map(m=>[m.material.map,m.material.bumpMap]),maps);
  assert.deepEqual(textures.map(t=>[t.uuid,t.repeat.toArray(),t.offset.toArray(),t.flipY,t.colorSpace]),state);
  second.dispose();assert.equal(disposed.length,0);
  for(const {t,listener} of listeners)t.removeEventListener('dispose',listener);
});

test('disposing a finish stage releases each model-owned material exactly once',()=>{
  const dispose=THREE.Material.prototype.dispose,counts=new Map<THREE.Material,number>();
  THREE.Material.prototype.dispose=function(){counts.set(this,(counts.get(this)??0)+1);dispose.call(this);};
  try {const model=createFinishes(context());model.dispose();model.dispose();assert.equal(counts.size,36);for(const count of counts.values())assert.equal(count,1);}
  finally {THREE.Material.prototype.dispose=dispose;}
});

const doorX=[-26.2114860318907,-13.10574301594535,0,13.10574301594535,26.2114860318907];
const leafColour=['red-brown','brown','red-brown','brown','red-brown'];
type Entrance={door:string;flats:string;stairwell:number;rail?:boolean;mailbox?:boolean;access?:boolean;lamp?:boolean;fittings:{name:string;bounds:number[][]}[]};
const records=(m:{root:THREE.Object3D})=>m.root.userData.finishes.entrances as Entrance[];

test('all five entrances receive their observed dark door and orange brick jambs; the generic door is gone',()=>{
  const model=createFinishes(context());local(model.root);
  doorX.forEach((x,i)=>{
    for(const dx of [-.5,.5]){const name=(hit(model.root,x+dx,1.4,-1)[0].object as Mesh).material.name;assert.ok(name.endsWith('dark door, '+leafColour[i]),`S${i+1}: ${name}`);}
    for(const dx of [-.865,.865]){const hits=hit(model.root,x+dx,1.9,-1),front=hits.filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);assert.equal(front.length,1);assert.ok((front[0].object as Mesh).material.name.includes('brick jambs'));}
    assert.notEqual((hit(model.root,x,1.4,-1)[0].object as Mesh).material.color.getHexString(),'868d89','Generic unresolved door remains');
  });
  for(const x of doorX)for(const dx of [-1.0,1.0])assert.ok((hit(model.root,x+dx,1.9,-1)[0].object as Mesh).material.name.includes('masonry'));
  model.dispose();
});

test('entrance fittings follow the per-entrance observations and meet the recessed door and canopy',()=>{
  const model=createFinishes(context());local(model.root);const exterior=-11.692812823626577/2,entrances=records(model);
  assert.deepEqual(entrances.map(e=>[e.door,e.stairwell,e.flats]),[['WNW-S1-door',5,'81–100'],['WNW-S2-door',4,'61–80'],['WNW-S3-door',3,'41–60'],['WNW-S4-door',2,'21–40'],['WNW-S5-door',1,'1–20']]);
  assert.deepEqual(entrances.filter(e=>e.rail).map(e=>e.door),['WNW-S1-door','WNW-S3-door','WNW-S4-door']);
  assert.deepEqual(entrances.filter(e=>e.mailbox).map(e=>e.door),['WNW-S3-door']);
  assert.deepEqual(entrances.filter(e=>e.access).map(e=>e.door),['WNW-S3-door','WNW-S4-door']);
  assert.deepEqual(entrances.filter(e=>e.lamp).map(e=>e.door),['WNW-S4-door','WNW-S5-door']);
  entrances.forEach((e,i)=>{
    const x=doorX[i],p=e.flats.replace('–','-'),find=(n:string)=>e.fittings.find(f=>f.name===p+'-'+n);
    assert.ok((hit(model.root,x+.115,1.60,-1)[0].object as Mesh).material.name.includes('lever'));
    assert.ok(Math.abs(find('handle-backplate')!.bounds[1][2]-(exterior+.221))<1e-5);
    assert.equal(!!find('access-unit'),!!e.access);assert.equal(!!find('mailbox'),!!e.mailbox);assert.equal(!!find('canopy-light'),!!e.lamp);assert.equal(!!find('rail-post'),!!e.rail);
    if(e.access){assert.ok((hit(model.root,x-.075,1.87,-1)[0].object as Mesh).material.name.includes('access unit'));assert.ok(Math.abs(find('access-unit')!.bounds[1][2]-(exterior+.221))<1e-5);}
    if(e.mailbox){const box=find('mailbox')!;assert.ok(Math.abs(box.bounds[1][2]-(exterior+.221))<1e-5,'Mailbox must sit on the leaf');assert.ok((hit(model.root,x+.30,1.91,-1)[0].object as Mesh).material.name.includes('mailbox'));}
    if(e.lamp){const lamp=find('canopy-light')!;assert.ok(Math.abs(lamp.bounds[1][1]-2.62)<1e-5);assert.ok(lamp.bounds[0][2]>=exterior-1.2&&lamp.bounds[1][2]<=exterior);}
    if(e.rail){
      const post=find('rail-post')!,arm=find('rail-arm')!;
      assert.ok(Math.abs(post.bounds[0][1]-.65)<1e-5,'Rail post must stand on the landing');
      assert.ok(Math.abs(arm.bounds[1][2]-exterior)<1e-5,'Rail arm must reach the wall');
      assert.ok(post.bounds[0][0]>x+1.55/2+.18,'Rail must stand beside the NNE jamb, not on it');
    }
  });
  model.dispose();
});

test('every occupied row has one continuous pale lintel band across both complete elevations',()=>{
  const m=createFinishes(context());local(m.root);
  for(const side of [-1,1])for(const y of [3.89,6.84,9.79,12.74,15.69])for(let x=-32.6;x<=32.6;x+=.49){
    const hits=hit(m.root,x,y,side),front=hits.filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);
    assert.equal(front.length,1);const mat=(front[0].object as Mesh).material;assert.ok(mat.name.includes('continuous concrete'));assert.equal(mat.color.getHexString(),'f4f4eb');
  }
  assert.equal(m.root.userData.finishes.lintels.length,10);assert.equal(m.root.userData.finishes.basementLintels,undefined);m.dispose();
});
test('concrete coping projects outside all wall edges, retains the roof void and has one top owner',()=>{
  const m=createFinishes(context());local(m.root);const L=65.52871507972675,W=11.692812823626577;
  for(const side of [-1,1])for(const x of [-L/2-.03,-L/2+.03,0,L/2-.03,L/2+.03]){
    const hits=hit(m.root,x,16.84,side);assert.ok(hits.length);assert.ok(Math.abs(hits[0].distance-(8-W/2-.055))<1e-4);assert.ok((hits[0].object as Mesh).material.name.includes('concrete'));
  }
  for(const x of [-L/2-.03,L/2+.03])for(const z of [-W/2-.03,0,W/2+.03]){
    const hits=new THREE.Raycaster(new THREE.Vector3(x,18,z),new THREE.Vector3(0,-1,0),0,2).intersectObject(m.root,true).filter(h=>Math.abs(h.point.y-16.96)<1e-4);
    assert.equal(hits.length,1,'No duplicated cap top at corners/ends');
  }
  const interior=new THREE.Raycaster(new THREE.Vector3(0,18,0),new THREE.Vector3(0,-1,0),0,2).intersectObject(m.root,true)[0];assert.ok(Math.abs(interior.point.y-16.71)<1e-4);
  m.dispose();
});
test('every canopy has metal flashing on its front, both ends and top edge, standing off the slab',()=>{
  const m=createFinishes(context());local(m.root);const exterior=-11.692812823626577/2,front=exterior-1.2,top=2.74;
  for(const x of doorX){
    const face=hit(m.root,x,top-.03,-1)[0];assert.ok((face.object as Mesh).material.name.includes('flashing'));assert.ok(Math.abs(face.point.z-(front-.016))<1e-4,'Flashing must stand 12 mm off the slab front');
    for(const side of [-1,1]){const end=new THREE.Raycaster(new THREE.Vector3(x+side*3,top-.03,exterior-.6),new THREE.Vector3(-side,0,0),0,2).intersectObject(m.root,true)[0];assert.ok((end.object as Mesh).material.name.includes('flashing'),'Missing end flashing');}
    const cap=new THREE.Raycaster(new THREE.Vector3(x,4,front+.02),new THREE.Vector3(0,-1,0),0,2).intersectObject(m.root,true)[0];assert.ok((cap.object as Mesh).material.name.includes('flashing'));assert.ok(Math.abs(cap.point.y-(top+.004))<1e-5);
    const inner=new THREE.Raycaster(new THREE.Vector3(x,4,front+.4),new THREE.Vector3(0,-1,0),0,2).intersectObject(m.root,true)[0];assert.ok(!(inner.object as Mesh).material.name.includes('flashing'),'Flashing must not cover the whole canopy');
  }
  m.dispose();
});

test('each entrance has a landing and one step, two rises from the ground, with the landing unchanged',()=>{
  const m=createFinishes(context());local(m.root);const exterior=-11.692812823626577/2;
  const tread=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0),0,3).intersectObject(m.root,true)[0].point.y;
  for(const x of doorX){
    assert.ok(Math.abs(tread(x,exterior-.2)-.65)<1e-5,'Landing level must stay at the door sill');
    assert.ok(Math.abs(tread(x,exterior-.7)-.65)<1e-5,'Second tread must belong to the landing');
    const step=tread(x,exterior-1.05);assert.ok(step>.19+.05&&step<.6,'One intermediate step between ground and landing');
  }
  m.dispose();
});

test('the apron is a thin slab round all four walls, above the ground, closed at its outer edge and stopping at the steps',()=>{
  const m=createFinishes(context());local(m.root);const L=65.52871507972675/2,W=11.692812823626577/2,ground=14.3-14.11;
  const down=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0),0,3).intersectObject(m.root,true)[0];
  const isApron=(h?:THREE.Intersection)=>!!h&&(h.object as Mesh).material.name.includes('apron');
  for(const [x,z] of [[-20,-W-.1],[-20,-W-.5],[20,W-(-.3)],[0,W+.5],[-L-.3,0],[L+.3,2],[L+.5,-W-.5],[-L-.5,W+.5]]){
    const h=down(x,z);assert.ok(isApron(h),`No apron at ${x}/${z}`);assert.ok(h.point.y>ground+.015&&h.point.y<ground+.045,'Apron must sit a few centimetres above the ground');
  }
  assert.ok(down(-20,-W-.02).point.y>down(-20,-W-.53).point.y,'Apron must fall away from the wall');
  for(const x of doorX)assert.ok(!isApron(down(x,-W-.3)),'Apron must stop at the entrance steps');
  assert.ok(!isApron(down(-20,-W-.7)),'Apron is 0.55 m wide');
  for(const [x,y,z,dir] of [[-20,ground-.05,-W-2,[0,0,1]],[0,ground-.05,W+2,[0,0,-1]],[-L-2,ground-.05,0,[1,0,0]],[L+2,ground-.05,0,[-1,0,0]],[L+2,ground-.05,-W-.3,[-1,0,0]]] as const){
    const h=new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(...dir),0,2).intersectObject(m.root,true)[0];assert.ok(isApron(h),`Open apron edge towards ${dir}`);
  }
  const patches=m.root.userData.groundPatches as number[][][];assert.equal(patches.length,9);
  assert.ok(patches.every(p=>p.length===4&&p.flat().every(Number.isFinite)));
  m.dispose();
});

test('each entrance plaque faces outward, contacts its leaf and releases its own map through texture toggles',()=>{
  const m=createFinishes(context());local(m.root);const entrances=records(m),textures:THREE.Texture[]=[];let disposed=0;
  entrances.forEach((e,i)=>{
    const material=(hit(m.root,doorX[i]-.43,2.36,-1)[0].object as Mesh).material;
    assert.ok(material.name.endsWith('entrance plaque '+e.flats),material.name);
    for(const mesh of meshes(m.root).filter(mesh=>mesh.material===material)){const uv=mesh.geometry.getAttribute('uv');assert.ok(Array.from(uv.array).every(v=>v>=0&&v<=1),'Plaque requires local image coordinates');}
    const texture=material.map!;assert.ok(!textures.includes(texture),'Each plaque needs its own text');textures.push(texture);texture.addEventListener('dispose',()=>disposed++);
    const f=e.fittings.find(f=>f.name===e.flats.replace('–','-')+'-plaque-backing')!;assert.ok(Math.abs(f.bounds[1][2]-(-11.692812823626577/2+.221))<1e-5);
  });
  const plaques=entrances.map((_,i)=>(hit(m.root,doorX[i]-.43,2.36,-1)[0].object as Mesh).material);
  m.setTextures!(false);assert.ok(plaques.every(p=>p.map===null));m.setTextures!(true);assert.deepEqual(plaques.map(p=>p.map),textures);m.setTextures!(false);m.dispose();m.dispose();assert.equal(disposed,5);
});
