import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildStudyGrid, gridTicks} from './grid.ts';

test('metre marks run through the centre and the base, every fifth one stronger', () => {
  const across = gridTicks(5, 0, 10, 1, 0);
  assert.deepEqual(across.map(tick => tick.at), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(across.filter(tick => tick.major).map(tick => tick.at), [0, 5, 10]);
  const up = gridTicks(0, -0.4, 3.2, 1, 1);
  assert.equal(up[0].at, -2);
  assert.equal(up.at(-1)?.at, 5);
  assert.ok(up.some(tick => tick.at === 0 && tick.major));
});

function disposeGrid(grid: THREE.Object3D) {
  grid.traverse(object => {
    const lines = object as THREE.LineSegments;
    lines.geometry?.dispose();
    (lines.material as THREE.Material | undefined)?.dispose?.();
  });
}

test('the grid follows the long facade and stays on the walls of a rotated block', () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 8));
  mesh.position.set(100, 3, 50);
  mesh.rotation.y = Math.PI / 5;
  root.add(mesh);
  root.updateWorldMatrix(true, true);
  const point = new THREE.Vector3();
  const footprint = [[-10, -3, -4], [10, -3, -4], [10, -3, 4], [-10, -3, 4]].map(([x, y, z]) => {
    point.set(x, y, z).applyMatrix4(mesh.matrixWorld);
    return [point.x, point.z] as [number, number];
  });
  const grid = buildStudyGrid(root, footprint, 0);
  grid.updateMatrixWorld(true);
  const around = new THREE.Box3().setFromObject(grid);
  const block = new THREE.Box3().setFromObject(mesh);
  assert.ok(around.min.x < block.min.x && around.max.x > block.max.x);
  assert.ok(around.min.z < block.min.z && around.max.z > block.max.z);
  assert.ok(around.max.x - around.min.x < block.max.x - block.min.x + 5);
  assert.ok(around.max.z - around.min.z < block.max.z - block.min.z + 5);
  disposeGrid(grid);
  mesh.geometry.dispose();
});
