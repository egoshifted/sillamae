import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFinishes} from './finishes.ts';
import {correctedOpeningSchedule,openingHalves} from './windows.ts';
import {paneFrame} from './joinery.ts';
import {sourceFootprint} from './design.ts';
import type {OverrideContext} from '../../../engine/types.ts';

function model(){
  const context={scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3]]} as OverrideContext;
  const m=createFinishes(context);m.root.position.set(0,0,0);m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);return m;
}
function probe(root:THREE.Object3D,id:string,half:'tall'|'short'|'stair'|'basement',fraction:number,top=false){
  const o=correctedOpeningSchedule().find(o=>o.id===id)!,p=openingHalves(o).find(p=>half==='stair'||half==='basement'||(Math.abs(p.low-o.sill)<1e-6)===(half==='tall'))!,side=o.elevation==='WNW'?-1:1;
  const x=p.a+(p.b-p.a)*fraction,y=top?o.head-.0275:(p.low+o.head)/2;
  const hit=new THREE.Raycaster(new THREE.Vector3(x,y,side*8),new THREE.Vector3(0,0,-side),0,4).intersectObject(root,true)[0];
  assert.ok(hit,`${id}/${half}/${fraction}`);return (hit.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material;
}
test('rear modern lights are evenly spaced but four-light L3 differs from three-light L5',()=>{
  const m=model();
  for(const f of [1/3,2/3])assert.ok(probe(m.root,'ESE-L5-S1-A','tall',f).name.includes('replacement frames'));
  for(const f of [.25,.5,.75])assert.ok(probe(m.root,'ESE-L3-S1-A','tall',f).name.includes('replacement frames'));
  assert.ok(probe(m.root,'ESE-L5-S1-A','tall',.5).name.includes('glazing'));
  assert.ok(probe(m.root,'ESE-L3-S1-A','tall',1/3).name.includes('glazing'));
  for(const level of [2,3,4,5]){assert.ok(probe(m.root,`ESE-L${level}-S1-A`,'short',.40).name.includes('replacement frames'));assert.ok(probe(m.root,`ESE-L${level}-S1-A`,'short',.50).name.includes('glazing'));}
  m.dispose();
});
test('older rear timber changes the whole frame and uses uneven living-room and kitchen divisions',()=>{
  const m=model();
  for(const f of [.46,.59])assert.equal(probe(m.root,'ESE-L5-S1-B','tall',f).color.getHexString(),'62645a');
  assert.equal(probe(m.root,'ESE-L5-S1-B','short',.36).color.getHexString(),'62645a');
  for(const half of ['tall','short'] as const)assert.equal(probe(m.root,'ESE-L5-S1-B',half,.5,true).color.getHexString(),'62645a');
  assert.ok(probe(m.root,'ESE-L5-S1-B','tall',1/3).name.includes('glazing'));
  assert.ok(probe(m.root,'ESE-L4-S1-B','tall',.46).name.includes('glazing'),'Occluded floor must not inherit its older neighbour');m.dispose();
});
test('front local-axis divisions put narrow old side lights on the photograph-correct side',()=>{
  const m=model();
  for(const [id,colour,tall,short] of [['WNW-L2-S4-B','62645a',.23,.18],['WNW-L2-S4-A','58352f',.20,.25]] as const){
    for(const [half,f] of [['tall',tall],['short',short]] as const){assert.equal(probe(m.root,id,half,f).color.getHexString(),colour);assert.equal(probe(m.root,id,half,.5,true).color.getHexString(),colour);assert.ok(probe(m.root,id,half,1-f).name.includes('glazing'));}
  }
  for(const f of [1/3,2/3])assert.ok(probe(m.root,'WNW-L3-S4-B','tall',f).name.includes('replacement frames'));
  assert.ok(probe(m.root,'WNW-L3-S4-B','short',.25).name.includes('replacement frames'));m.dispose();
});
test('front staircase dividers are offset and unseen units use authorized inferred layouts',()=>{
  const m=model();for(const [level,f] of [[1,.25],[2,.30],[3,.30],[4,.25],[5,.25]]){
    assert.ok(probe(m.root,`WNW-L${level}-S4-stair`,'stair',f).name.includes('replacement frames'));assert.ok(probe(m.root,`WNW-L${level}-S4-stair`,'stair',.5).name.includes('glazing'));
  }
  assert.ok(probe(m.root,'WNW-L3-S1-stair','stair',.25).name.includes('replacement frames'));
  assert.ok(probe(m.root,'ESE-L3-S4-A','tall',1/3).name.includes('replacement frames'));
  const sill=(m.root.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]).find(m=>m.material.name.includes('sill metal'))!;
  assert.equal(sill.material.metalness,.55);assert.equal(sill.material.roughness,.45);m.dispose();
});

test('observed front living rooms survive inferred kitchen completion',()=>{
  const m=model();
  for(const level of [1,3,4])for(const f of [1/3,2/3])assert.ok(probe(m.root,`WNW-L${level}-S3-B`,'tall',f).name.includes('replacement frames'));
  assert.equal(probe(m.root,'WNW-L2-S3-B','tall',.17).color.getHexString(),'665a4d');
  assert.equal(probe(m.root,'WNW-L5-S3-B','tall',.15).color.getHexString(),'62645a');
  for(const level of [2,3,4])assert.ok(probe(m.root,`WNW-L${level}-S3-B`,'short',.25).name.includes('replacement frames'));
  m.dispose();
});

test('shared step boundary keeps each differently finished frame return on its own side',()=>{
  const m=model(),o=correctedOpeningSchedule().find(o=>o.id==='WNW-L2-S3-B')!;
  const hit=new THREE.Raycaster(new THREE.Vector3(o.split!-.02,o.head-.2,-(11.692812823626577/2-.205)),new THREE.Vector3(1,0,0),0,.05).intersectObject(m.root,true)[0];
  assert.ok(hit);assert.equal((hit.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.getHexString(),'665a4d');m.dispose();
});

test('every glazed half on both elevations has actual bars with observed versus inferred provenance',()=>{
  const m=model(),rows=m.root.userData.finishes.paneDivisions;assert.equal(rows.length,245);assert.equal(rows.filter((r:{inferred:boolean})=>r.inferred).length,187);
  for(const o of correctedOpeningSchedule().filter(o=>o.kind!=='door'))for(const p of openingHalves(o)){
    if(o.kind==='door')continue;
    const half=o.kind==='pair'?(Math.abs(p.low-o.sill)<1e-6?'tall':'short'):o.kind,style=paneFrame(o,p.low)!;
    assert.ok(style.bars.length);const material=probe(m.root,o.id,half,style.bars[0]);assert.ok(material.name.includes('frames'),o.id+'/'+half);
    const row=rows.find((r:{id:string;half:string})=>r.id===o.id&&r.half===half);assert.equal(row.inferred,!!style.inferred);
  }
  m.dispose();
});
