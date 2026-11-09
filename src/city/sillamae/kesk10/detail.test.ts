import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {createDetail} from './detail.ts';
import {createBuilding} from './model.ts';
import {openings,openingFrame} from './openings.ts';

const context=()=>({frame:{origin:[0,0],base:0},ground:[[290,530,14.41,350,530,14.41,350,580,14.41],[290,530,14.41,350,580,14.41,290,580,14.41]]}) as OverrideContext;
test('refinement keeps every scheduled aperture open, including coplanar end wings',()=>{
 const m=createDetail(context());m.root.updateMatrixWorld(true);
 for(const o of openings){const f=openingFrame(o),spring=o.top-o.arch;
  for(const fraction of [.15,.5,.85])for(const offset of [-.2,0,.2]){
   const x=o.centre*f.length+o.width*offset,h=o.bottom+(o.top-o.bottom)*fraction;
   if(o.arch&&h>spring&&Math.abs(offset*o.width)>o.width/2*Math.sqrt(1-((h-spring)/o.arch)**2))continue;
   const ray=new THREE.Raycaster(new THREE.Vector3(o.a[0]+f.dx*x+f.nx*2,14.41+h,o.a[1]+f.dz*x+f.nz*2),new THREE.Vector3(-f.nx,0,-f.nz),0,2.30);
   assert.equal(ray.intersectObject(m.root.getObjectByName('walls')!).length,0,`${o.id} ${fraction} ${offset} blocked`);
  }
 }m.dispose();
});
test('refinement preserves approved roof geometry and emits finite ornament transforms',()=>{
 const old=createBuilding(context()),m=createDetail(context());
 const mesh=(root:THREE.Object3D,name:string)=>root.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry>;
 for(const name of ['survey-roof','rear-stairwell-roof'])assert.deepEqual(mesh(m.root,name).geometry.attributes.position.array,mesh(old.root,name).geometry.attributes.position.array);
 m.root.updateMatrixWorld(true);m.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name);if(o instanceof THREE.Mesh)for(const a of Object.values(o.geometry.attributes) as THREE.BufferAttribute[])assert.ok(Array.from(a.array).every(Number.isFinite),o.name);});
 old.dispose();m.dispose();
});

test('entrance rail posts seat on outward-facing stair treads',()=>{
 const m=createDetail(context());m.root.updateMatrixWorld(true);
 const stairs=m.root.children.filter(o=>o.name.includes('-landing')||o.name.includes('-step-'));
 const posts=m.root.children.filter(o=>o.name.includes('-rail-post-'));
 assert.equal(posts.length,18);
 for(const post of posts){const box=new THREE.Box3().setFromObject(post),c=box.getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(c.x,box.min.y+.1,c.z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObjects(stairs)[0];assert.ok(hit,post.name+' has no tread');
  assert.ok(Math.abs(hit.point.y-box.min.y-.015)<.001,post.name+' is not seated');
 }
 m.dispose();
});

test('side and rear window decoration coverage includes the omitted elevations',()=>{
 const m=createDetail(context());
 for(const id of ['southeast-L2-1','southeast-L2-2','southeast-L2-3','southeast-gable-vent'])assert.ok(m.root.getObjectByName(id+'-sill-scroll-1'),id);
 assert.ok(m.root.getObjectByName('southeast-L1-crest-relief-ground'));
 for(const o of openings.filter(o=>o.id.startsWith('rear-L')))assert.ok(m.root.getObjectByName(o.id+'-render-head'),o.id);
 m.dispose();
});
test('roof junction sheets sit just above the approved roof without floating strips',()=>{
 const m=createDetail(context());m.root.updateMatrixWorld(true);
 const roof=m.root.getObjectByName('survey-roof')!,ray=new THREE.Raycaster();let samples=0;
 for(const obj of m.root.children){
  if(!(obj instanceof THREE.Mesh)||!(/^(hip-ridge-fold|valley-lining|dormer-apron)-/.test(obj.name)))continue;
  const p=obj.geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=9){const c=new THREE.Vector3();for(let j=0;j<3;j++)c.add(new THREE.Vector3().fromBufferAttribute(p,i+j));c.multiplyScalar(1/3);
   ray.set(c.clone().add(new THREE.Vector3(0,.1,0)),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(roof)[0];
   assert.ok(hit,obj.name+' misses the roof');const gap=c.y-hit.point.y;assert.ok(gap>=.005&&gap<=.045,obj.name+' offset '+gap);samples++;
  }
 }
 assert.ok(samples>50);m.dispose();
});

test('every rainpipe stays outside its wall along the complete run',()=>{
 const m=createDetail(context()),L=Math.hypot(30.72,15.01),dx=30.72/L,dz=15.01/L;
 const pipes=m.root.children.filter(o=>/^(downpipe-\d|northwest-rear-downpipe)/.test(o.name));assert.equal(pipes.length,5);
 for(const obj of pipes){const p=(obj as THREE.Mesh).geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i)-302.4,z=p.getZ(i)-555.92,u=x*dx+z*dz,v=x*dz-z*dx;
   const clearance=obj.name.startsWith('northwest')?-u:(obj.name==='downpipe-2'||obj.name==='downpipe-3'?1.3-v:-v);
   assert.ok(clearance>=.01,obj.name+' crosses wall by '+(-clearance));
  }
 }
 m.dispose();
});

test('door pull mounts contact their recessed leaves and retain hand clearance',()=>{
 const m=createDetail(context());m.root.updateMatrixWorld(true);
 for(const o of openings.filter(o=>o.kind==='door')){
  const f=openingFrame(o),x=o.centre*f.length,leaf=m.root.getObjectByName(o.id+'-infill');assert.ok(leaf,o.id);
  for(const i of [0,1]){const seat=m.root.getObjectByName(o.id+'-handle-seat-'+i)!;const c=new THREE.Box3().setFromObject(seat).getCenter(new THREE.Vector3());
   const ray=new THREE.Raycaster(c.clone().add(new THREE.Vector3(f.nx*.1,0,f.nz*.1)),new THREE.Vector3(-f.nx,0,-f.nz),0,.15);
   const hit=ray.intersectObject(leaf)[0];assert.ok(hit,o.id+' unseated handle');assert.ok(hit.distance<.13,o.id+' floating seat');
  }
  const handle=m.root.getObjectByName(o.id+'-handle') as THREE.Mesh,p=handle.geometry.getAttribute('position');let max=-Infinity;
  for(let i=0;i<p.count;i++)max=Math.max(max,(p.getX(i)-o.a[0]-f.dx*x)*f.nx+(p.getZ(i)-o.a[1]-f.dz*x)*f.nz);
  assert.ok(max>-.19&&max<-.10,o.id+' pull clearance');
 }m.dispose();
});

test('three shallow chimney caps overlap supports and project beyond shafts',()=>{
 const m=createDetail(context());m.root.updateMatrixWorld(true);
 for(let i=0;i<3;i++){
  const cap=m.root.getObjectByName('chimney-cap-'+i)!,stack=m.root.getObjectByName('ridge-stack-'+(i+1))!;
  const cb=new THREE.Box3().setFromObject(cap),sb=new THREE.Box3().setFromObject(stack);
  assert.ok(cb.max.y-cb.min.y<.12);assert.ok(cb.min.y>sb.max.y+.10&&cb.min.y<sb.max.y+.18);
  assert.ok(cb.min.x<sb.min.x&&cb.max.x>sb.max.x&&cb.min.z<sb.min.z&&cb.max.z>sb.max.z);
  for(const sign of [-1,1]){const support=m.root.getObjectByName('chimney-cap-support-'+i+'-'+sign)!;const b=new THREE.Box3().setFromObject(support),c=b.getCenter(new THREE.Vector3());
   const ray=new THREE.Raycaster(new THREE.Vector3(c.x,cb.max.y+.1,c.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(cap)[0];
   assert.ok(hit);assert.ok(b.max.y>=hit.point.y-.025&&b.max.y<=hit.point.y+.025,'support/cap contact');assert.ok(b.min.y<sb.max.y);
  }
 }m.dispose();
});
