import assert from 'node:assert/strict';
import test from 'node:test';
import {shadeShares} from './ground-cover.ts';

test('taller buildings throw more shade, and only tall ones reach far', () => {
  const shed = shadeShares(3), block = shadeShares(15), tower = shadeShares(30);
  assert.ok(shed.near < block.near);
  assert.equal(block.near, tower.near);
  assert.equal(shed.far, 0);
  assert.ok(block.far < tower.far);
});
