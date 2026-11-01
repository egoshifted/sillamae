import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {entranceDatum, seatModel} from './seat.ts';

const flat = (h: number, size = 20) => [[0, 0, h, size, 0, h, size, size, h], [0, 0, h, size, size, h, 0, size, h]];
const sea = [[-5000, -5000, 0, 5000, -5000, 0, 0, 5000, 0]];

test('the datum is the median ground at the entrances and ignores the sea plane', () => {
  const ground = [...sea, ...flat(14), [20, 0, 15, 40, 0, 15, 40, 20, 15], [20, 0, 15, 40, 20, 15, 20, 20, 15]];
  assert.equal(entranceDatum(ground, [[5, 5], [10, 10], [30, 5]]), 14);
  assert.equal(entranceDatum(ground, [[5, 5], [30, 5]]), 14.5);
  assert.equal(entranceDatum(sea, [[5, 5]]), null);
});

test('a seated model meets the real ground after its root is raised', () => {
  let seen: number[][] = [];
  const model = seatModel(flat(14.5), 14, 14.4, ground => { seen = ground; return {root: new THREE.Group()}; });
  assert.ok(Math.abs(model.root.position.y - .4) < 1e-9);
  assert.ok(Math.abs(seen[0][2] + .4 - 14.5) < 1e-9, 'parts fitted to the lowered ground land on the real ground once raised');
});
