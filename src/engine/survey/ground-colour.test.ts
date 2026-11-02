import test from 'node:test';
import assert from 'node:assert/strict';
import type {SurveyBucket} from '../data.ts';
import {GroundColour} from './ground-colour.ts';

function sample(x: number, z: number, colour: number[], building = 0): SurveyBucket {
  return {index: 0, position: new Float32Array([x - .2, 0, z - .2, x + .2, 0, z - .2, x, 0, z + .4]), color: new Float32Array([...colour, ...colour, ...colour]), building: new Uint16Array([building, building, building]), layer: new Uint8Array(3), uv: new Float32Array(6)};
}
test('restored ground samples the verge rather than road paint or buildings', () => {
  const colours = new GroundColour([[[-3, -5], [3, -5], [3, 5], [-3, 5]]]);
  colours.add(sample(0, 0, [.3, .33, .31]));
  colours.add(sample(4, 0, [.8, .1, .1], 1));
  colours.add(sample(-5, 0, [.4, .5, .3]));
  colours.add(sample(5, 0, [.4, .5, .3]));
  const colour = colours.at(0, 0)!;
  assert.ok(colour.every((c, i) => Math.abs(c - [.4, .5, .3][i]) < 1e-6));
  assert.equal(colours.naturalAt(-5, 0), true);
  assert.equal(colours.naturalAt(100, 0), false);
});
test('nearby terrain colours change smoothly and missing samples stay explicit', () => {
  const colours = new GroundColour();
  assert.equal(colours.at(0, 0), undefined);
  colours.add(sample(-5, 0, [.4, .5, .3]));
  colours.add(sample(5, 0, [.2, .3, .1]));
  assert.ok(colours.at(-4, 0)![0] > colours.at(4, 0)![0]);
  assert.ok(Math.abs(colours.at(0, 0)![0] - .3) < 1e-6);
});
