import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {frontDesign} from './front-design.ts';
import {rearDesign, rearSchedule} from './rear-design.ts';
import {createFrontStudy} from './front.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const context: OverrideContext = {
  scene: new THREE.Scene(),
  building: {id:'213730655',pick:304,name:'Ranna 31a',c:[1174.64,662.78],h:32.52,g:[]},
  terrain: {origin:[1140,620],step:100,width:2,height:2,values:[80,80,80,80],meta:{}},
  frame: {origin:[750,760],base:19.3},
  ground: [[1140,620,8,1230,620,8,1230,700,8],[1140,620,8,1230,700,8,1140,700,8]],
};

function probe(model: ReturnType<typeof createFrontStudy>, from: [number, number, number], direction: [number, number, number], far = 12) {
  const origin = new THREE.Vector3(...from).applyMatrix4(model.root.matrixWorld);
  const ray = new THREE.Vector3(...direction).transformDirection(model.root.matrixWorld);
  const hit = new THREE.Raycaster(origin, ray, 0, far).intersectObject(model.root, true)[0];
  return hit && {point: model.root.worldToLocal(hit.point.clone()), material: ((hit.object as THREE.Mesh).material as THREE.Material).name};
}

test('owner rear photographs: nine glazed band rows, a tower window per floor, ten stair windows per column, two niches and two doors',() => {
  const rows = rearSchedule();
  assert.equal(new Set(rows.map(o => o.id)).size, rows.length);
  assert.equal(rows.filter(o => o.kind === 'balcony').length, 18);
  assert.equal(rows.filter(o => o.kind === 'window' && o.group !== 'centre').length, 18);
  assert.equal(rows.filter(o => o.kind === 'window' && o.group === 'centre').length, 20);
  assert.equal(rows.filter(o => o.kind === 'arch').length, 2);
  assert.equal(rows.filter(o => o.kind === 'door').length, 2);
  // Stair windows sit on half landings, between the band rows rather than on them.
  const band = rows.filter(o => o.kind === 'balcony' && o.x > 0).map(o => (o.bottom + o.top) / 2);
  const stair = rows.filter(o => o.group === 'centre' && o.kind === 'window' && o.x > 0).map(o => (o.bottom + o.top) / 2);
  for (const mid of stair.slice(0, 8)) assert.ok(band.every(b => Math.abs(mid - b) > .25 * frontDesign.pitch), `stair window at ${mid} sits on a floor row`);
  assert.ok(Math.max(...stair) + rearDesign.stairHeight / 2 < frontDesign.centreShoulder, 'top stair window cuts the parapet');
  // Owner correction: the rear rows are measured from the ground (distant photo ≈2.5 m to the first glazing), so the building lift must not raise them.
  const firstGlazing = Math.min(...rows.filter(o => o.kind === 'balcony').map(o => o.bottom)) + frontDesign.lift;
  assert.ok(firstGlazing > 2 && firstGlazing < 2.6, `first rear band glazing at ${firstGlazing.toFixed(2)} m above the entrance ground`);
});

test('owner rear photographs and survey: towers stand proudest, bands behind them and the stair centre deepest',() => {
  const model = createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    const face = (x: number, y: number) => { const hit = probe(model, [x, y, -12], [0, 0, 1]); assert.ok(hit, `rear open at ${x},${y}`); return hit.point.z; };
    for (const side of [-1, 1]) {
      // Between floor rows, so the rays meet masonry and panels rather than glass.
      for (const y of [1.2, 9.9, 18.3]) {
        assert.ok(Math.abs(face(side * 12.9, y) - rearDesign.face) < .01, 'outer cheek left the rear line');
        assert.ok(Math.abs(face(side * 6.5, y) - rearDesign.face) < .01, 'tower left the rear line');
        assert.ok(Math.abs(face(side * 10, y) - rearDesign.bandFace) < .01, 'band is not recessed behind the cheek and tower');
        // Above the rear entrance canopy, between the two stair columns.
        assert.ok(Math.abs(face(side * .2, y + 3) - rearDesign.centreFace) < .01, 'stair centre is not the deepest plane');
      }
      // The recess sides are closed, so a ray along the facade into the band meets the tower return.
      const across = probe(model, [side * 9, 10.5, rearDesign.face + .25], [-side, 0, 0]);
      assert.ok(across && Math.abs(Math.abs(across.point.x) - rearDesign.tower[1]) < .01, 'band recess is open at the tower');
    }
  } finally { model.dispose(); }
});

test('owner close rear entrance photo: one porch, both doors in its back wall, a pier at the white column and one canopy',() => {
  const model = createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    const e = rearDesign.entrance;
    // Owner correction: the entrance sits on the building axis; it had drifted 0.65 m to one side.
    assert.ok(Math.abs(e.left + e.right) < .01, 'rear entrance canopy is off the axis');
    const doors = rearSchedule().filter(o => o.kind === 'door');
    assert.ok(Math.abs(doors.reduce((sum, o) => sum + o.x, 0)) < .01, 'rear doors are off the axis');
    for (const o of doors) assert.ok(e.porchEdge - (Math.abs(o.x) + o.width / 2) < .02, `door ${o.id} stops short of its pier`);
    for (const side of [-1, 1]) {
      const pier = probe(model, [side * (e.porchEdge + e.right) / 2, 1, -12], [0, 0, 1]);
      assert.ok(pier && Math.abs(pier.point.z - rearDesign.face) < .01, 'missing an end pier');
    }
    // The previous model cut one door into the proud tower face, a metre in front of the other.
    for (const door of rearSchedule().filter(o => o.kind === 'door')) {
      const hit = probe(model, [door.x, 1, -12], [0, 0, 1]);
      assert.ok(hit && hit.material === 'plain-door', `door ${door.id} missing`);
      assert.ok(Math.abs(hit.point.z - (rearDesign.centreFace + .19 - .0175)) < .01, `door ${door.id} is not in the porch back wall`);
    }
    const pier = probe(model, [(e.porchEdge + e.right) / 2, 1, -12], [0, 0, 1]);
    assert.ok(pier && Math.abs(pier.point.z - rearDesign.face) < .01, 'no pier at the white column');
    const canopy = (x: number) => { const hit = probe(model, [x, 10, rearDesign.face - .6], [0, -1, 0], 20); assert.ok(hit); return hit.point.y; };
    for (const x of [e.left + .4, 0, 2.95, e.right - .4]) assert.ok(Math.abs(canopy(x) - e.canopyTop) < .01, `canopy top breaks at ${x}`);
    const under = probe(model, [0, e.canopyBottom - .05, rearDesign.face - .6], [0, 1, 0], 2);
    assert.ok(under && Math.abs(under.point.y - e.canopyBottom) < .01, 'canopy fascia is still a thin plate');
  } finally { model.dispose(); }
});

test('owner close photo of the tower tops: glazed round-headed windows in widening concrete surrounds under steep gables',() => {
  const model = createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    const s = rearDesign.archSurround;
    for (const side of [-1, 1]) {
      const x = side * rearDesign.towerColumn;
      // The former niche was a dark recess in the wall, with no glass and no surround.
      const arch = probe(model, [x, 27.5, -12], [0, 0, 1]);
      assert.ok(arch && arch.material === 'plain-infill', 'tower arch is not glazed');
      for (const [dx, y] of [[s.topWidth / 2 - .1, s.top - .1], [-(s.topWidth / 2 - .1), s.top - .1], [s.bottomWidth / 2 - .1, s.bottom + .1]]) {
        const frame = probe(model, [x + dx, y, -12], [0, 0, 1]);
        assert.ok(frame && frame.material === 'plain-balcony-panel' && Math.abs(frame.point.z - (rearDesign.face - .06)) < .01, `surround missing at ${dx.toFixed(2)},${y}`);
      }
      // The surround widens upwards: just outside its bottom corner the ray meets the plain wall.
      const beside = probe(model, [x + s.bottomWidth / 2 + .1, s.bottom + .1, -12], [0, 0, 1]);
      assert.ok(beside && beside.material === 'plain-shell', 'surround does not narrow towards its bottom');
      assert.ok(rearDesign.towerPeak - rearDesign.towerShoulder >= 1.4, 'tower gable is too shallow');
    }
  } finally { model.dispose(); }
});

test('owner rear photographs: band canopies rise to the wing roof without a parapet, tower gables top the stair parapet',() => {
  const model = createFrontStudy(context); model.root.updateMatrixWorld(true);
  try {
    const top = (x: number, z: number) => { const hit = probe(model, [x, 40, z], [0, -1, 0], 30); assert.ok(hit, `no roof at ${x},${z}`); return hit.point.y; };
    for (const side of [-1, 1]) {
      let previous = -Infinity;
      for (const z of [-7.7, -7.3, -6.9, -6.62]) { const h = top(side * 10, z); assert.ok(h > previous, 'band canopy does not rise towards the roof'); previous = h; }
      assert.ok(Math.abs(top(side * 10, -6.4) - frontDesign.deck) < .01, 'wing roof does not continue behind the canopy');
      assert.ok(Math.abs(previous - frontDesign.deck) < .1, 'step between the canopy and the wing roof');
      assert.ok(top(side * rearDesign.towerColumn, -7.6) > frontDesign.centreShoulder + 1, 'tower gable no higher than the stair parapet');
    }
    assert.ok(Math.abs(top(0, -6.6) - frontDesign.centreShoulder) < .01, 'stair centre parapet missing');
  } finally { model.dispose(); }
});
