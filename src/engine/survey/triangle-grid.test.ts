import test from 'node:test';
import assert from 'node:assert/strict';
import {triangleGrid} from './triangle-grid.ts';
import type {Bucket} from './classify.ts';

const bucket = (kind: Bucket['kind'], source: number[], building: number[], layer?: number[]): Bucket =>
  ({kind, detail: 'base', cell: '0,0', source, c: [], building, ...layer && {layer}});
const heights = (grid: ReturnType<typeof triangleGrid>, x: number, z: number) => {
  const found: [number, number][] = [];
  grid.over(x, z, (height, layer) => found.push([Math.round(height * 1e9) / 1e9, layer]));
  return found;
};

test('every triangle over a point reports its height and layer, in bucket order', () => {
  const upper = bucket('grass', [0, 0, 5, 9, 0, 5, 0, 9, 5], [0], [2]), lower = bucket('paving', [0, 0, 1, 9, 0, 1, 0, 9, 4], [0]);
  const grid = triangleGrid([upper, lower], () => true, 100);
  assert.deepEqual(heights(grid, 1, 0), [[5, 2], [1, 0]]);
  assert.deepEqual(heights(grid, 8, 8), []);
  assert.equal(heights(grid, 0, 3)[1][0], 2);
});

test('filtered, huge and degenerate triangles are left out, and far points find nothing', () => {
  const kept = [0, 0, 1, 2, 0, 1, 0, 2, 1], huge = [0, 0, 2, 500, 0, 2, 0, 500, 2], flat = [0, 0, 3, 1, 1, 3, 2, 2, 3], building = [0, 0, 4, 2, 0, 4, 0, 2, 4];
  const grid = triangleGrid([bucket('grass', [...kept, ...huge, ...flat, ...building], [0, 0, 0, 7])], (b, t) => !b.building[t], 100);
  assert.deepEqual(heights(grid, .5, .5), [[1, 0]]);
  assert.deepEqual(heights(grid, 900, -900), []);
});

test('a triangle spanning many cells is found from each of them', () => {
  const grid = triangleGrid([bucket('grass', [-20, -20, 1, 40, -20, 1, -20, 40, 1], [0])], () => true, 100);
  for (const [x, z] of [[-19, -19], [0, 0], [30, -15], [-15, 30]]) assert.equal(heights(grid, x, z).length, 1);
});

test('an empty grid answers without error', () => {
  assert.deepEqual(heights(triangleGrid([], () => true, 100), 0, 0), []);
});
