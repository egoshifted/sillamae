import assert from 'node:assert/strict';
import test from 'node:test';
import {centreBlades, shadeShares} from './ground-cover.ts';

test('blades average to neutral, so the grass keeps its brightness as they fade with zoom', () => {
  const data = new Uint8ClampedArray([60, 200, 7, 255, 100, 240, 7, 255, 140, 90, 7, 255, 180, 110, 7, 255]);
  centreBlades(data);
  const mean = (channel: number) => [0, 1, 2, 3].reduce((sum, i) => sum + data[i * 4 + channel], 0) / 4;
  assert.ok(Math.abs(mean(0) - 128) <= 1);
  assert.ok(Math.abs(mean(1) - 128) <= 1);
  assert.equal(data[2], 7);
});

test('taller buildings throw more shade, and only tall ones reach far', () => {
  const shed = shadeShares(3), block = shadeShares(15), tower = shadeShares(30);
  assert.ok(shed.near < block.near);
  assert.equal(block.near, tower.near);
  assert.equal(shed.far, 0);
  assert.ok(block.far < tower.far);
});
