import assert from 'node:assert/strict';
import test from 'node:test';
import type {CityDefinition, SceneData} from '../src/engine/types.ts';
import {shoreline} from './shore.ts';
import {deckAt} from './water-bodies.ts';

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

test('a traced lake replaces survey water at its level and stays flat beside a lower one', () => {
  const traced = {bodies: [{level: 14, replacesSurvey: true}, {level: 8, replacesSurvey: true}], at: (x: number, z: number) => x > 40 && x < 180 && z > 40 && z < 180 ? (x < 110 ? 1 : 2) : 0};
  const flatGround = (x: number) => x < 110 ? 14.5 : 8.5, painted = water(square(250, 250, 300, 300, 8));
  const shore = shoreline(painted, () => true, flatGround, flatGround, scene, city, traced);
  assert.equal(shore.onLand(70, 100), false);
  assert.equal(shore.onLand(150, 100), false);
  assert.equal(shore.onLand(275, 275), true);
  const levels = new Set<number>();
  for (let i = 2; i < shore.triangles.length; i += 7) if (shore.triangles[i - 2] < 90) levels.add(Math.round(shore.triangles[i] * 100) / 100);
  assert.deepEqual([...levels], [14.04]);
});

test('dark pixels just off a traced shore leave no pit in the bank', () => {
  const traced = {bodies: [{level: 8, replacesSurvey: true}], at: (x: number, z: number) => x > 60 && x < 180 && z > 60 && z < 180 || Math.abs(x - 184) < 1 && Math.abs(z - 120) < 1 ? 1 : 0};
  const bank = () => 9, shore = shoreline(water([]), () => true, bank, bank, scene, city, traced);
  assert.equal(shore.onLand(120, 120), false);
  assert.equal(shore.onLand(184, 120), true);
  assert.ok(shore.heightAt(184, 120)! > 8);
});

test('a shaped bank stays a plane between grid points, whatever the terrain does there', () => {
  const spiky = (x: number, z: number) => terrain(x, z) - (Math.abs(x - Math.round(x)) > .4 ? 3 : 0);
  const shore = shoreline(water(square(120, 120, 180, 180, 4.85)), () => true, spiky, spiky, scene, city);
  const beside = (x: number) => shore.heightAt(x, 150)!;
  const mid = beside(199.5), low = beside(199), high = beside(200);
  assert.ok(high - low > 1);
  assert.ok(Math.abs(mid - (low + high) / 2) < 1e-3);
});

test('a deck holds its height along the span and only there', () => {
  const at = deckAt([{from: [0, 0], to: [100, 0], half: 2, height: [10, 12]}], [50, 50]);
  assert.equal(at(100, 51), 11);
  assert.equal(at(100, 53), null);
  assert.equal(at(170, 50), null);
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
