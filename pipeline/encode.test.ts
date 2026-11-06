import assert from 'node:assert/strict';
import test from 'node:test';
import type {Bucket} from '../src/engine/survey/classify.ts';
import {groundNormals} from './encode.ts';

const bucket = (kind: Bucket['kind'], source: number[], building = [0]) => ({kind, source, building}) as unknown as Bucket;

test('ground normals are shared across buckets, so a crease between them is smoothed', () => {
  const left = bucket('grass', [0, 0, 0, 0, 1, 0, 1, 0, 0]), right = bucket('paving', [1, 0, 0, 0, 1, 0, 1, 1, 1]);
  const flat = groundNormals([left])(1000, 0)!, shared = groundNormals([left, right])(1000, 0)!;
  assert.deepEqual(flat.map(Math.abs), [0, 0]);
  assert.ok(Math.abs(shared[1]) > .01 || Math.abs(shared[0]) > .01);
});

test('water and buildings add nothing to the ground normal', () => {
  const normals = groundNormals([bucket('water', [0, 0, 0, 0, 1, 0, 1, 0, 0]), bucket('plaster', [0, 0, 0, 0, 1, 0, 1, 0, 0], [7])]);
  assert.equal(normals(0, 0), null);
});
