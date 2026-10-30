import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMassingStudy} from './massing.ts';

test('new-building massing preserves source plan and explicit datum in a shifted frame', () => {
  const building = {id: 'new', name: 'New building', pick: 1, c: [104, 203] as [number, number], h: 8, g: [[100, 200], [108, 200], [108, 206], [100, 206]] as [number, number][], heightRange: [2, 10] as [number, number]}, original = structuredClone(building);
  const model = createMassingStudy({building, frame: {origin: [90, 190], base: 20}}, {datum: 24, height: 9});
  const bounds = new THREE.Box3().setFromObject(model.root);
  assert.deepEqual(bounds.min.toArray(), [10, 4, 10]); assert.deepEqual(bounds.max.toArray(), [18, 13, 16]); assert.deepEqual(building, original);
  model.dispose(); model.dispose();
  assert.throws(() => createMassingStudy({building, frame: {origin: [0, 0], base: 0}}, {height: 0}), /positive/);
});
