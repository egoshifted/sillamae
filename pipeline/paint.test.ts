import assert from 'node:assert/strict';
import test from 'node:test';
import {softenPaint} from './paint.ts';

const row = (colours: number[]) => colours.map((v, x) => ({x, z: 0, c: [v, v, v]}));

test('a paint edge becomes a gradient and uniform paint keeps its exact colour', () => {
  const points = row([.1, .1, .1, .1, .9, .9, .9, .9]);
  softenPaint(points, points.length, () => 1);
  assert.deepEqual(points.map(p => +p.c[0].toFixed(3)), [.1, .1, .1, .367, .633, .9, .9, .9]);
});

test('open water stays out of the mean', () => {
  const points = [...row([.2, .2]), null, ...row([.6])];
  softenPaint(points, 4, () => 1);
  assert.equal(points[0]!.c![0], .2);
  assert.equal(points[2], null);
});
