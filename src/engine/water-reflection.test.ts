import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {sameView} from './water-reflection.ts';

test('rounding in the camera is not a move, and real ones are', () => {
  const a = new THREE.Matrix4().makeTranslation(1000, 500, -300), b = a.clone();
  b.elements[12] += 1e-5;
  assert.ok(sameView(a, b));
  b.elements[12] += .05;
  assert.ok(!sameView(a, b));
});
