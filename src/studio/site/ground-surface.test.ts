import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GroundSurface} from './ground-surface.ts';
import {detailPreview, disposeGroup, roadShapes} from './details.ts';

function ridge() {
  const surface = new GroundSurface(), corners = [[0, 0, 0], [3, 0, 0], [3, 0, 3], [0, 0, 3]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    surface.add(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(1.5, 1, 1.5));
  }
  return surface;
}

test('road preview preserves an interior terrain peak missed by outline sampling', () => {
  const ground = ridge(), road = {id: 'test', type: 'service' as const, points: [[1.5, 0], [1.5, 3]] as [number, number][]};
  const height = (x: number, z: number) => Math.max(0, 1 - Math.max(Math.abs(x - 1.5), Math.abs(z - 1.5)) / 1.5);
  const old = detailPreview([], [], [road], [0, 0], height, 1), fixed = detailPreview([], [], [road], [0, 0], height, 1, ground);
  const at = (group: THREE.Group, x: number, z: number) => {
    group.updateMatrixWorld(true);
    return new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)).intersectObject(group, true)[0]?.point.y ?? -Infinity;
  };
  assert.ok(at(old, 1.5, 1.5) < height(1.5, 1.5), 'negative control must reproduce grass above the old preview');
  for (let x = .1; x < 3; x += .2) for (let z = .1; z < 3; z += .2)
    assert.ok(Math.abs(at(fixed, x, z) - height(x, z) - .04) < 1e-5, `road clearance at ${x},${z}`);
  disposeGroup(old); disposeGroup(fixed);
});

test('clipped surfaces retain terrain planes through partial and repeated terrain edits', () => {
  const ground = ridge(), ring: [number, number][] = [[.3, .2], [2.8, .6], [2, 2.8], [.2, 2]];
  const before = ground.drape(ring, .03);
  ground.reshape(() => .7);
  const raised = ground.drape(ring, .03);
  assert.equal(raised.length, before.length);
  raised.forEach((r, i) => r.forEach((p, j) => assert.ok(Math.abs(p[1] - before[i][j][1] - .7) < 1e-9)));
  ground.reshape(() => 0);
  assert.deepEqual(ground.drape(ring, .03), before);
  ground.reshape(() => .5, {minX: 1, maxX: 2, minZ: 1, maxZ: 2});
  assert.ok(ground.drape(ring, .03).some(r => r.some(p => p[1] > 1.4)));
});

test('marking and carriageway follow the same terrain at different clearances', () => {
  const ground = ridge(), ring: [number, number][] = [[1.44, 0], [1.56, 0], [1.56, 3], [1.44, 3]];
  const road = ground.drape(ring, .04), marking = ground.drape(ring, .06);
  assert.equal(marking.length, road.length);
  marking.forEach((r, i) => r.forEach((p, j) => assert.ok(Math.abs(p[1] - road[i][j][1] - .02) < 1e-9)));
});

test('a live road draft tolerates the pointer resting on its last clicked point', () => {
  const road = {id: 'draft', type: 'service' as const, points: [[0, 0], [0, 0]] as [number, number][]};
  assert.deepEqual(roadShapes(road, road.points), []);
  assert.deepEqual(roadShapes(road, [[0, 0], [0, 3], [0, 3]]), roadShapes(road, [[0, 0], [0, 3]]));
});
