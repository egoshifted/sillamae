import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding} from './model.ts';
import {createFinishes} from './finishes.ts';
import {correctedOpeningSchedule} from './windows.ts';
import {sourceFootprint,openingSchedule} from './design.ts';
import type {OverrideContext} from '../../../engine/types.ts';

function context():OverrideContext{return {scene:new THREE.Scene(),building:{id:'73512033',name:'Kesk 9',pick:133,c:[326.275,691.25],h:17.46,g:structuredClone(sourceFootprint)},frame:{origin:[750,760],base:19.3},terrain:{origin:[0,0],step:1,width:2,height:2,values:[140,140,140,140],meta:{}},ground:[[250,600,14.3,400,600,14.3,400,800,14.3],[250,600,14.3,400,800,14.3,250,800,14.3]]};}
function local(root:THREE.Object3D){root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);}
function depth(root:THREE.Object3D,x:number,y:number,side:number){return new THREE.Raycaster(new THREE.Vector3(x,y,side*8),new THREE.Vector3(0,0,-side),0,4).intersectObject(root,true)[0]?.distance??Infinity;}
function transition(fn:(x:number)=>boolean,a:number,b:number){const first=fn(a);assert.notEqual(first,fn(b),'Probe bracket must straddle an opening edge');for(let i=0;i<12;i++){const m=(a+b)/2;if(fn(m)===first)a=m;else b=m;}return (a+b)/2;}

test('actual facade apertures match independent same-row width, gap, stair and split ranges',()=>{
  const m=createBuilding(context(),correctedOpeningSchedule());local(m.root);
  for(const side of [-1,1]){
    const open=(x:number)=>depth(m.root,x,9.2,side)>2.27;
    const left=transition(open,-6.5,-5.0),right=transition(open,side<0?-2.2:-1.3,side<0?-1.4:-.5),width=right-left;
    const pitch=65.52871507972675/5;
    if(side<0){assert.ok(width/pitch>.285&&width/pitch<.325);assert.ok(open(.81)&&!open(.9));}
    else{assert.ok(width/pitch>.37&&width/pitch<.41);assert.ok(open(1.2));}
    const split=transition(x=>depth(m.root,x,8.5,side)>2.27,side<0?-4.2:-3.5,side<0?-3.2:-2.0),fraction=(split-left)/width;
    assert.ok(fraction>(side<0?.49:.60)&&fraction<(side<0?.56:.68));
    const nextLeft=transition(open,6.6,7.8),thisRight=transition(open,5.5,6.5),gap=(nextLeft-thisRight)/width;
    assert.ok(gap>(side<0?.30:.18)&&gap<(side<0?.40:.27));
  }
  m.dispose();
});

test('actual upper-window heads leave the photograph-supported parapet margin relative to row pitch',()=>{
  const m=createBuilding(context(),correctedOpeningSchedule());local(m.root);
  const top=transition(y=>depth(m.root,-4.8,y,1)>2.27,15.3,16.5),below=transition(y=>depth(m.root,-4.8,y,1)>2.27,12.0,13.7),pitch=top-below,ratio=(16.96-top)/pitch;
  assert.ok(ratio>.39&&ratio<.56);assert.ok(pitch>2.85&&pitch<3.05);m.dispose();
});

test('doors and basement remain independently scheduled while opening IDs/counts survive the correction',()=>{
  const before=openingSchedule(),after=correctedOpeningSchedule();
  assert.deepEqual(after.map(o=>o.id),before.map(o=>o.id));
  assert.deepEqual(after.filter(o=>o.kind==='door'||o.kind==='basement'),before.filter(o=>o.kind==='door'||o.kind==='basement'));
});

test('corrected stair sill clears canopy and widened reveals remain real recessed openings',()=>{
  const m=createFinishes(context());local(m.root);let lowest=Infinity;
  for(const mesh of m.root.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]){
    if(!mesh.material.name.includes('sill metal'))continue;const p=mesh.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.86&&p.getY(i)>2.5&&p.getY(i)<3&&p.getZ(i)<-5.7)lowest=Math.min(lowest,p.getY(i));
  }
  assert.ok(lowest>2.79&&lowest>2.74+.04);
  for(const side of [-1,1])for(const x of side<0?[-5.80,-1.90]:[-5.95,-.95])assert.ok(depth(m.root,x,9.2,side)>2.27);
  m.dispose();
});

