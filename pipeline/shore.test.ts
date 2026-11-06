import assert from 'node:assert/strict';
import test from 'node:test';
import type {CityDefinition, SceneData} from '../src/engine/types.ts';
import {shoreline} from './shore.ts';

const TRIANGLE_FLOATS = 21, BLUE = [.5, .69, .69];

function water(triangles: number[][][]) {
  const v = new Float32Array(triangles.length * TRIANGLE_FLOATS);
  triangles.forEach((corners, t) => corners.forEach(([x, z, h], c) => v.set([x, z, h, ...BLUE, 0], t * TRIANGLE_FLOATS + c * 7)));
  return v;
}
const square = (x0: number, z0: number, x1: number, z1: number, h: number) => [[[x0, z0, h], [x1, z0, h], [x1, z1, h]], [[x0, z0, h], [x1, z1, h], [x0, z1, h]]];

const scene = {buildings: [{g: [[0, 0], [400, 0], [400, 400], [0, 400]]}]} as unknown as SceneData;
const city = {frame: {origin: [0, 0]}, overrides: []} as unknown as CityDefinition;
// Dry ground at 10 m with a lake bed at 5 m, flattened by the terrain model as survey lakes are.
const terrain = (x: number, z: number) => x > 100 && x < 200 && z > 100 && z < 200 ? 5 : 10;

test('a surveyed lake floods and its shore follows the terrain model, not the polygon', () => {
  const shore = shoreline(water(square(120, 120, 180, 180, 4.85)), () => true, terrain, terrain, scene, city);
  assert.equal(shore.onLand(150, 150), false);
  assert.equal(shore.onLand(110, 150), false);
  assert.equal(shore.onLand(60, 150), true);
  assert.ok(shore.heightAt(150, 150)! < 5.3);
  assert.equal(shore.heightAt(300, 300), 10);
});

test('a water-coloured patch above the ground floods nothing', () => {
  const shore = shoreline(water(square(300, 300, 306, 306, 13)), () => true, terrain, terrain, scene, city);
  assert.equal(shore.onLand(303, 303), true);
  assert.equal(shore.triangles.length, 0);
  assert.equal(shore.heightAt(303, 303), 10);
});

test('a scrap of paint on the rim of a hollow does not fill it', () => {
  const hollow = (x: number, z: number) => Math.hypot(x - 300, z - 300) < 30 ? 8.5 : 10;
  const shore = shoreline(water(square(299, 299, 301, 301, 8.5)), () => true, hollow, hollow, scene, city);
  assert.equal(shore.onLand(310, 300), true);
});
