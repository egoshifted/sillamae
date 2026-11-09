import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sillamae} from '../index.ts';
import {refined} from './index.ts';
import {createDetail} from './detail.ts';
import {entrancePoints} from './model.ts';
import type {OverrideContext} from '../../../engine/types.ts';

test('Kesk 10 atlas registration retains detail and includes the rear addition entrance',()=>{
 assert.equal(sillamae.overrides.filter(o=>o.id==='65395731').length,1);
 assert.equal(sillamae.overrides.find(o=>o.id==='65395731'),refined);
 const entrances=refined.entrances!({} as never),base=entrancePoints();
 assert.equal(entrances.length,7);assert.deepEqual(entrances.slice(0,6),base);
 const [x,z]=entrances[6],length=Math.hypot(30.72,15.01),dx=30.72/length,dz=15.01/length;
 assert.ok(Math.abs((x-302.4)*dx+(z-555.92)*dz-17.25)<1e-6);
 assert.ok((x-302.4)*dz-(z-555.92)*dx>20.3);
 const scene=new THREE.Scene(),context={scene,frame:{origin:[0,0],base:0},ground:[[290,530,14.41,350,530,14.41,350,580,14.41],[290,530,14.41,350,580,14.41,290,580,14.41]]} as OverrideContext;
 const model=refined.build(context),detail=createDetail(context);
 assert.equal(model.root.userData.audit.datum,detail.root.userData.audit.datum);
 assert.ok(model.root.getObjectByName('chimney-cap-0'));assert.ok(model.root.getObjectByName('street-west-door-handle-seat-0'));
 assert.equal(model.root.parent,scene);model.root.userData.dispose();model.root.removeFromParent();detail.dispose();assert.equal(scene.children.length,0);
});
