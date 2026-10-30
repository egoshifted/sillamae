import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding} from './model.ts';
import {createFinishes} from './finishes.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {sourceFootprint} from './design.ts';
import {correctedOpeningSchedule} from './windows.ts';
import type {OverrideContext} from '../../../engine/types.ts';
type Mesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;

function context():OverrideContext {
  return {scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3]]};
}
function meshes(root:THREE.Object3D) {return root.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];}
function area(root:THREE.Object3D) {
  let total=0;
  for(const m of meshes(root)) {
    if(m.material.name.includes('sill metal')||m.material.userData.detailAddition||m.material.userData.joinery||m.material.color.getHexString()==='d4d6d0')continue;
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
  const before=createBuilding(context(),correctedOpeningSchedule()),after=createFinishes(context());local(before.root);local(after.root);
  assert.ok(Math.abs(area(after.root)-area(before.root))<.03,'Partition loses a shell surface outside the separately tested joinery');
  for(const side of [-1,1])for(const x of [-32.76,-32.4,-31,-26,-13,0,13,26,31,32.4,32.76])for(const y of [-.1,.2,1.31,5.2,9.7,13.1,16.69,16.72]) {
    const a=hit(before.root,x,y,side)[0],b=hit(after.root,x,y,side)[0];
    assert.equal(!!b,!!a,`Changed closure ${x}/${y}/${side}`);if(a&&b)assert.ok(Math.abs(a.distance-b.distance)<1e-4);
  }
  before.dispose();after.dispose();
});

test('reference concrete lintels own a single flush surface on both elevations including basement',()=>{
  const model=createFinishes(context());local(model.root);
  for(const side of [-1,1])for(const [x,y] of [[-3.85,3.86],[0,3.86],[-4.5,1.14]]) {
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
  try {const model=createFinishes(context());model.dispose();model.dispose();assert.equal(counts.size,26);for(const count of counts.values())assert.equal(count,1);}
  finally {THREE.Material.prototype.dispose=dispose;}
});

test('only the reference-mapped 21–40 entrance receives the dark door and orange jamb finish',()=>{
  const model=createFinishes(context());local(model.root);
  const x=13.10574301594535;
  for(const dx of [-.5,.5])assert.ok((hit(model.root,x+dx,1.4,-1)[0].object as Mesh).material.name.includes('dark door'));
  for(const dx of [-.865,.865]){const hits=hit(model.root,x+dx,1.9,-1),front=hits.filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);assert.equal(front.length,1);assert.ok((front[0].object as Mesh).material.name.includes('brick jambs'));}
  for(const other of [-26.2114860318907,-13.10574301594535,0,26.2114860318907])assert.equal((hit(model.root,other,1.4,-1)[0].object as Mesh).material.color.getHexString(),'868d89');
  model.dispose();
});

test('selected entrance fittings meet the recessed door and canopy instead of floating at the wall plane',()=>{
  const model=createFinishes(context());local(model.root);const x=13.10574301594535,exterior=-11.692812823626577/2;
  assert.ok((hit(model.root,x+.115,1.60,-1)[0].object as Mesh).material.name.includes('lever'));
  assert.ok((hit(model.root,x-.075,1.87,-1)[0].object as Mesh).material.name.includes('access unit'));
  const features=model.root.userData.finishes.entrance.fittings as {name:string;bounds:number[][]}[];
  for(const name of ['21-40-handle-backplate','21-40-access-unit']){const f=features.find(f=>f.name===name)!;assert.ok(Math.abs(f.bounds[1][2]-(exterior+.221))<1e-5);}
  const lamp=features.find(f=>f.name==='21-40-canopy-light')!;assert.ok(Math.abs(lamp.bounds[1][1]-2.62)<1e-5);
  assert.ok(lamp.bounds[0][2]>=exterior-1.2&&lamp.bounds[1][2]<=exterior);
  model.dispose();
});

test('every occupied row has one continuous pale lintel band across both complete elevations',()=>{
  const m=createFinishes(context());local(m.root);
  for(const side of [-1,1])for(const y of [3.89,6.84,9.79,12.74,15.69])for(let x=-32.6;x<=32.6;x+=.49){
    const hits=hit(m.root,x,y,side),front=hits.filter(h=>Math.abs(h.distance-(8-11.692812823626577/2))<1e-4);
    assert.equal(front.length,1);const mat=(front[0].object as Mesh).material;assert.ok(mat.name.includes('continuous concrete'));assert.equal(mat.color.getHexString(),'f4f4eb');
  }
  assert.equal(m.root.userData.finishes.lintels.length,10);assert.equal(m.root.userData.finishes.basementLintels.length,20);m.dispose();
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
test('entrance plaque faces outward, contacts its leaf and releases its own map through texture toggles',()=>{
  const m=createFinishes(context());local(m.root);const x=13.10574301594535,material=(hit(m.root,x-.43,2.36,-1)[0].object as Mesh).material;
  assert.ok(material.name.includes('entrance plaque'));for(const mesh of meshes(m.root).filter(mesh=>mesh.material===material)){const uv=mesh.geometry.getAttribute('uv');assert.ok(Array.from(uv.array).every(v=>v>=0&&v<=1),'Plaque requires local image coordinates');}const texture=material.map!;let disposed=0;texture.addEventListener('dispose',()=>disposed++);
  const f=m.root.userData.finishes.entrance.fittings.find((f:{name:string})=>f.name==='21-40-plaque-backing');assert.ok(Math.abs(f.bounds[1][2]-(-11.692812823626577/2+.221))<1e-5);
  m.setTextures!(false);assert.equal(material.map,null);m.setTextures!(true);assert.equal(material.map,texture);m.setTextures!(false);m.dispose();m.dispose();assert.equal(disposed,1);
});
