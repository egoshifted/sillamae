import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {createAnnex} from './annex.ts';
import {annexOutline as ring,annexSchedule} from './annex-design.ts';
import {frontDesign as tower} from './front-design.ts';

const context={ground:[[1140,620,8,1230,620,8,1230,700,8],[1140,620,8,1230,700,8,1140,700,8]]} as OverrideContext;
test('owner annex photos: three arched windows (big centre rear one, one on each wing), six rectangular windows, garage, two raised doors and a separate basement door',()=>{
  const rows=annexSchedule();assert.equal(rows.filter(o=>o.kind==='arch').length,3);for(const edge of [1,2,3])assert.equal(rows.filter(o=>o.kind==='arch'&&o.edge===edge).length,1);assert.equal(rows.filter(o=>o.kind==='window').length,6);assert.equal(rows.filter(o=>o.kind==='gate').length,1);
  assert.equal(rows.filter(o=>o.kind==='door'&&o.bottom>8).length,4);assert.equal(rows.filter(o=>o.kind==='door'&&o.bottom<8).length,1);
  assert.ok(ring.every(([x])=>x<=-13.25),'annex crosses into the tower');
});
test('annex openings have real recesses and yellow-marked basement flight descends below land',()=>{
  const datum=8.9,model=createAnnex(context,datum);model.root.updateMatrixWorld(true);
  try {
    for(const o of annexSchedule().filter(o=>o.kind==='window'||o.kind==='arch')) {
      const a=ring[o.edge],b=ring[(o.edge+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,u=o.u+o.width*.2;
      const normal=new THREE.Vector3(-uz,0,ux),origin=new THREE.Vector3(a[0]+ux*u,(o.bottom+o.top)/2-datum,a[1]+uz*u).addScaledVector(normal,2);
      const hit=new THREE.Raycaster(origin,normal.clone().negate(),0,3).intersectObject(model.root,true)[0];assert.ok(hit,`no glazing ${o.id}`);assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,'annex-glazing');assert.ok(hit.distance>2.1,'wall face covers glazing');
    }
    let previous=Infinity;
    for(const t of [.9,.7,.5,.3,.1]) {
      const x=-17.55-2.3*t,z=5.1+4.9*t,hit=new THREE.Raycaster(new THREE.Vector3(x,10-datum,z),new THREE.Vector3(0,-1,0)).intersectObject(model.root,true)[0];
      assert.ok(hit);const top=hit.point.y+datum;assert.ok(top<previous-.1&&top<8,'basement flight does not descend below approach');previous=top;
    }
    assert.equal(model.groundCuts.length,1);
  } finally {model.dispose();model.dispose();}
});

test('owner marked courtyard: sloping concrete sills and broad retained platform keep the basement channel open',()=>{
  const datum=8.9,model=createAnnex(context,datum);model.root.updateMatrixWorld(true);
  const top=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,15-datum,z),new THREE.Vector3(0,-1,0)).intersectObject(model.root,true)[0];
  try {
    for(const o of annexSchedule().filter(o=>o.edge===11&&o.kind==='window')) {
      const x=ring[11][0]+o.u,near=top(x,ring[11][1]+.03),far=top(x,ring[11][1]+.23);
      assert.ok(near&&far,'missing deep concrete sill');assert.ok(near.point.y>far.point.y+.1,'sill is still a horizontal ledge');
      assert.equal(((far.object as THREE.Mesh).material as THREE.Material).name,'annex-concrete');
    }
    const deck=top(-15.4,5.4);assert.ok(deck,'missing broad platform above the lawn');
    const coping=top(-15.4,5.75);assert.ok(coping);
    assert.ok(Math.abs(coping.point.y-(-tower.lift+tower.basementStairs.wallTop[0]))<1e-5,'platform coping differs from the adjoining tower stair wall');
    assert.ok(coping.point.y>deck.point.y+.03,'stone coping is not distinct from the paved deck');
    assert.equal(((coping.object as THREE.Mesh).material as THREE.Material).name,'annex-concrete');
    const front=new THREE.Raycaster(new THREE.Vector3(-15.4,8.15-datum,8),new THREE.Vector3(0,0,-1)).intersectObject(model.root,true)[0];
    assert.ok(front&&Math.abs(front.point.z-5.8)<1e-4,'missing front retaining face');
    const channel=top(-18.24,6.948);assert.ok(channel&&channel.point.y+datum<7,'platform fills the descending basement channel');
  } finally {model.dispose();}
});

test('owner courtyard correction: annex wall is recessed and the level pipe stays visible below every front sill',()=>{
  assert.ok(tower.sideFront-ring[12][1]>.3,'annex front is still proud of the tower');
  const model=createAnnex(context,8.9);model.root.updateMatrixWorld(true);
  try {
    for(const o of annexSchedule().filter(o=>o.kind==='window')) {
      const a=ring[o.edge],b=ring[(o.edge+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,normal=new THREE.Vector3(-uz,0,ux);
      const origin=new THREE.Vector3(a[0]+ux*o.u,1.25-tower.lift,a[1]+uz*o.u).addScaledVector(normal,2);
      const hit=new THREE.Raycaster(origin,normal.clone().negate(),0,3).intersectObject(model.root,true)[0];
      assert.ok(hit,`missing pipe at ${o.id}`);assert.equal(((hit.object as THREE.Mesh).material as THREE.Material).name,'gas-pipe-yellow',`sill or platform obstructs pipe at ${o.id}`);
    }
  } finally {model.dispose();}
});

test('courtyard timber windows have an upper transom and undivided lower glazing',()=>{
  const datum=8.9,model=createAnnex(context,datum);model.root.updateMatrixWorld(true);
  try {
    for(const o of annexSchedule().filter(o=>o.edge===11&&o.kind==='window')) {
      const materialAt=(height:number)=>{
        const hit=new THREE.Raycaster(new THREE.Vector3(ring[11][0]+o.u,height-datum,ring[11][1]+1),new THREE.Vector3(0,0,-1),0,2).intersectObject(model.root,true)[0];
        assert.ok(hit);return ((hit.object as THREE.Mesh).material as THREE.Material).name;
      };
      assert.equal(materialAt(o.bottom+.65),'annex-glazing');
      assert.equal(materialAt(o.top-.25),'annex-glazing');
      assert.equal(materialAt(o.top-.55),'annex-brown-window-frame');
    }
  } finally {model.dispose();}
});

test('courtyard finishes borrow tower masonry without disposing its shared material',()=>{
  const masonry=new THREE.MeshStandardMaterial(),model=createAnnex(context,8.9,masonry);let disposed=0;
  masonry.addEventListener('dispose',()=>disposed++);
  assert.ok(model.root.children.some(o=>o instanceof THREE.Mesh&&o.material===masonry));
  model.setTextures(false);model.setTextures(true);model.dispose();model.dispose();
  assert.equal(disposed,0);masonry.dispose();assert.equal(disposed,1);
});

test('chamfer beside the cellar has undivided glazing under a roof outlet: an open notch between two capped brick blades',()=>{
  const datum=8.9,model=createAnnex(context,datum),a=ring[9],b=ring[10],length=Math.hypot(b[0]-a[0],b[1]-a[1]),u=new THREE.Vector3((b[0]-a[0])/length,0,(b[1]-a[1])/length),n=new THREE.Vector3(-u.z,0,u.x);
  model.root.updateMatrixWorld(true);
  const ray=(at:number,height:number)=>new THREE.Raycaster(new THREE.Vector3(a[0],height-datum,a[1]).addScaledVector(u,at).addScaledVector(n,1),n.clone().negate(),0,1.5).intersectObject(model.root,true)[0];
  try {
    for(const height of [10.8,11.65])assert.equal(((ray(.57,height).object as THREE.Mesh).material as THREE.Material).name,'annex-glazing');
    assert.ok(!ray(length/2,13.3),'solid parapet or flat roof blocks the central notch');
    for(const at of [.09,length-.09])assert.ok(ray(at,13.3),'missing upper brick blade');
  } finally {model.dispose();}
});
