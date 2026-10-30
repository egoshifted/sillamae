import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {refined} from './index.ts';
import {design,sourceFootprint,fittedFootprint} from './design.ts';
import type {OverrideContext} from '../../../engine/types.ts';

function context(changed?:()=>void):OverrideContext {
  return {scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3]],changed};
}
test('atlas fitting updates only the target working footprint and exposes all five entrances outside the steps',()=>{
  const c=context(),vertices=new Float32Array([1,2,3]),source=structuredClone(sourceFootprint);
  assert.equal(refined.carveSurvey!(vertices,c.building),vertices);assert.deepEqual(c.building.g,fittedFootprint());assert.deepEqual(sourceFootprint,source);
  const entrances=refined.entrances!(c.building);assert.equal(entrances.length,5);
  for(let i=0;i<5;i++){
    const [x,z]=entrances[i],dx=x-design.centre[0],dz=z-design.centre[1],s=dx*design.axis[0]+dz*design.axis[1],t=-dx*design.axis[1]+dz*design.axis[0];
    assert.ok(Math.abs(s-design.length*((i+.5)/5-.5))<1e-8);assert.ok(Math.abs(t+design.width/2+1.35)<1e-8);
  }
});
test('atlas creates the full corrected model immediately while shared texture readiness does not block its first frame',async()=>{
  let changes=0;const c=context(()=>changes++),built=refined.build(c);assert.equal(built.ready,undefined);assert.equal(c.scene.children.length,1);assert.equal(built.root.name,'kesk9');
  assert.equal(built.root.userData.finishes.paneDivisions.length,245);assert.equal(built.root.userData.finishes.lintels.length,10);
  const materials=(built.root.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]).map(m=>m.material),maps=materials.map(m=>m.map);
  built.setTextures(false);await built.root.userData.ready;assert.equal(changes,1);assert.ok(materials.every(m=>m.map===null));built.setTextures(true);assert.deepEqual(materials.map(m=>m.map),maps);
  built.root.userData.dispose();built.root.userData.dispose();assert.equal(c.scene.children.length,0);
});
test('disposing the production model suppresses late redraw and safely releases it before texture readiness',async()=>{
  let changes=0;const c=context(()=>changes++),built=refined.build(c);built.setTextures(false);built.root.userData.dispose();await built.root.userData.ready;built.setTextures(true);assert.equal(changes,0);assert.equal(c.scene.children.length,0);
});
