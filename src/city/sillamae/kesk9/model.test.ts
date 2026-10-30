import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding,createEnvelope,landHeights,sourcePosition} from './model.ts';
import {design,fittedFootprint,sourceFootprint} from './design.ts';
import type {OverrideContext} from '../../../engine/types.ts';

function context(): OverrideContext {
  return {scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3],[250,600,0,400,600,0,400,800,0]]};
}

function depth(root:THREE.Object3D,s:number,h:number,frame=root) {
  const origin=frame.localToWorld(new THREE.Vector3(s,h,-design.width/2-2));
  const direction=new THREE.Vector3(0,0,1).transformDirection(frame.matrixWorld);
  return new THREE.Raycaster(origin,direction,0,3).intersectObject(root,true)[0]?.distance;
}

test('plan fitting keeps all four imported anchors within their coordinate precision',()=>{
  const fit=fittedFootprint();
  for(let i=0;i<4;i++) assert.ok(Math.hypot(fit[i][0]-sourceFootprint[i][0],fit[i][1]-sourceFootprint[i][1])<.05);
  const a=new THREE.Vector2(...fit[1]).sub(new THREE.Vector2(...fit[0])),b=new THREE.Vector2(...fit[2]).sub(new THREE.Vector2(...fit[1]));
  assert.ok(Math.abs(a.dot(b))<1e-8);
});

test('observed stepped opening has recess, solid low half and real door cut; the old solid envelope fails',()=>{
  const c=context(), before=structuredClone(c.building), model=createBuilding(c), old=createEnvelope(c);
  model.root.updateMatrixWorld(true); old.root.updateMatrixWorld(true);
  const section=0, pair=-3.78;
  assert.ok(depth(model.root,section+pair-.8,2.2)!>2.15);
  assert.ok(Math.abs(depth(model.root,section+pair+.8,2.2)!-2)<1e-4);
  assert.ok(depth(model.root,0,1.8)!>2.15);
  assert.ok(depth(model.root,pair-1.75+.0275,2.2)! < depth(model.root,pair-.8,2.2)!-.03);
  assert.ok(Math.abs(depth(old.root,pair-.8,2.2,model.root)!-2)<.05);
  assert.deepEqual(c.building,before);
  assert.equal(model.root.children.length,6);
  model.dispose(); model.dispose(); old.dispose();
});

test('land contacts exclude the sea plane and remain closed at the blank end and basement',()=>{
  const c=context(), [x,z]=sourcePosition(0,-design.width/2);
  assert.deepEqual(landHeights(c.ground,x,z),[14.3]);
  const model=createBuilding(c); model.root.updateMatrixWorld(true);
  assert.ok(model.root.userData.audit.bottom<14.3-design.datum);
  for(const s of [-design.length/2+.1,design.length/2-.1]) for(const h of [-.1,.2,1.4,16.5]) assert.ok(Math.abs(depth(model.root,s,h)!-2)<1e-4);
  model.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const a of Object.values(o.geometry.attributes) as THREE.BufferAttribute[])for(const v of a.array)assert.ok(Number.isFinite(v));});
  model.dispose();
});

test('the parapet continues the shell without duplicate horizontal caps inside the roof junction',()=>{
  const model=createBuilding(context()); let caps=0;
  model.root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i+=3){
      const y=[0,1,2].map(j=>p.getY(i+j)),z=[0,1,2].map(j=>p.getZ(i+j));
      if(y.every(h=>Math.abs(h-16.71)<1e-5)&&Math.abs(z.reduce((a,b)=>a+b,0)/3)>11.692812823626577/2-.38+.001)caps++;
    }
  });
  assert.equal(caps,0);model.dispose();
});

test('each blank end has one full-width exterior face rather than separate corner strips',()=>{
  const model=createBuilding(context()), counts=new Map([[-1,0],[1,0]]);
  model.root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');
    for(let i=0;i<p.count;i+=3){
      const xs=[0,1,2].map(j=>p.getX(i+j)),ys=[0,1,2].map(j=>p.getY(i+j)),zs=[0,1,2].map(j=>p.getZ(i+j));
      const side=Math.sign(n.getX(i));
      if(Math.abs(n.getX(i))<.99||!xs.every(x=>Math.abs(x-side*65.52871507972675/2)<1e-4)||Math.min(...ys)<1.2999)continue;
      assert.ok(Math.min(...zs)<-11.692812823626577/2+.001&&Math.max(...zs)>11.692812823626577/2-.001,'An exterior end triangle terminates at a false wall strip');
      counts.set(side,counts.get(side)!+1);
    }
  });
  assert.equal(counts.get(-1),2);assert.equal(counts.get(1),2);model.dispose();
});

test('inner long-wall faces stop at the inside of each end wall',()=>{
  const model=createBuilding(context());let inner=0;
  model.root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');
    for(let i=0;i<p.count;i+=3){
      const zs=[0,1,2].map(j=>p.getZ(i+j));
      if(Math.abs(n.getZ(i))<.99||!zs.every(z=>Math.abs(Math.abs(z)-(11.692812823626577/2-.38))<1e-4))continue;
      for(let j=i;j<i+3;j++)assert.ok(Math.abs(p.getX(j))<=65.52871507972675/2-.38+.0001,'A buried inner face reaches the visible end plane');
      inner++;
    }
  });
  assert.ok(inner>0);model.dispose();
});
