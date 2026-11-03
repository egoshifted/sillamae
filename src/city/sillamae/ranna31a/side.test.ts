import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {frontDesign} from './front-design.ts';
import {sideDesign, sideSchedule} from './side-design.ts';
import {createFrontStudy} from './front.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const context: OverrideContext = {
  scene: new THREE.Scene(),
  building: {id:'213730655',pick:304,name:'Ranna 31a',c:[1174.64,662.78],h:32.52,g:[]},
  terrain: {origin:[1140,620],step:100,width:2,height:2,values:[80,80,80,80],meta:{}},
  frame: {origin:[750,760],base:19.3},
  ground: [[1140,620,8,1230,620,8,1230,700,8],[1140,620,8,1230,700,8,1140,700,8]],
};

function probe(model: ReturnType<typeof createFrontStudy>, from: [number, number, number], direction: [number, number, number]) {
  const hit = new THREE.Raycaster(new THREE.Vector3(...from).applyMatrix4(model.root.matrixWorld), new THREE.Vector3(...direction).transformDirection(model.root.matrixWorld), 0, 10).intersectObject(model.root, true)[0];
  return hit && {point: model.root.worldToLocal(hit.point.clone()), material: ((hit.object as THREE.Mesh).material as THREE.Material).name};
}

test('owner end photographs: nine windows in the east, seven from L3 in the west, a small window under each parapet',() => {
  const rows = sideSchedule();
  assert.equal(new Set(rows.map(o => o.id)).size, rows.length);
  assert.equal(rows.filter(o => o.side > 0 && o.kind === 'window').length, 9);
  assert.equal(rows.filter(o => o.side < 0 && o.kind === 'window').length, 7);
  assert.ok(rows.some(o=>o.side<0&&o.kind==='window'&&o.floor===2));
  assert.equal(rows.filter(o => o.kind === 'vent').length, 2);
  // Owner correction: a little above the front floor rows, with the top window still clear of the small one under the parapet.
  for (const o of rows.filter(o => o.kind === 'window')) assert.ok(Math.abs(o.bottom - (frontDesign.firstSill + sideDesign.raise + o.floor! * frontDesign.pitch)) < 1e-9);
  assert.ok(sideDesign.raise > 0, 'end windows are back on the front rows');
  for (const side of [-1, 1]) {
    const column = rows.filter(o => o.side === side), attic = column.find(o => o.kind === 'vent')!;
    assert.ok(Math.max(...column.filter(o => o.kind === 'window').map(o => o.top)) < attic.bottom - .5, 'top end window runs into the small window');
  }
  assert.ok(sideDesign.windowZ + sideDesign.windowWidth / 2 < sideDesign.middle[0], 'end windows run into the proud middle zone');
});

test('owner end photographs: real end-wall openings behind the face, and a proud middle zone between flush front and rear zones',() => {
  const model = createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    for (const side of [-1, 1]) {
      const inward: [number, number, number] = [-side, 0, 0], from = side * 16;
      const face = (z: number, y: number) => { const hit = probe(model, [from, y, z], inward); assert.ok(hit, `end wall open at ${z},${y}`); return {x: Math.abs(hit.point.x), material: hit.material}; };
      // The former end was a solid box with no openings at all.
      // Beside the centre mullion.
      const glass = face(sideDesign.windowZ + .3, frontDesign.firstSill + 5 * frontDesign.pitch + .8);
      assert.equal(glass.material, 'plain-infill');
      assert.ok(glass.x < frontDesign.halfWidth - .1, 'end window is a sticker on the wall face');
      for (const y of [4, 15, 26]) {
        assert.ok(Math.abs(face(0, y).x - (frontDesign.halfWidth + sideDesign.projection)) < .01, 'middle zone is not proud');
        assert.ok(Math.abs(face(4.2, y).x - frontDesign.halfWidth) < .01, 'front zone left the end line');
        assert.ok(Math.abs(face(-6, y).x - frontDesign.halfWidth) < .01, 'rear zone left the end line');
      }
    }
  } finally { model.dispose(); }
});
