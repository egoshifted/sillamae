import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {restoreGround} from './restore-ground.ts';
import {roadSection} from '../road-demolition.ts';
import type {RoadCut} from '../types.ts';

test('demolition recolours survey road paint while preserving existing grass and buildings', () => {
  const paint = new THREE.Color().setRGB(.57, .60, .58, THREE.SRGBColorSpace).toArray();
  const grass = [.4, .5, .3], position = new Float32Array([0, 2, 0, .2, 2, 0, .4, 2, 0, 20, 2, 0]);
  const colours = new Float32Array([...paint, ...grass, ...paint, ...paint]), before = colours.slice();
  const cut: RoadCut = {kind: 'carriageway', ring: roadSection([0, 0], [1, 0], 3, 3), groundColour: [.35, .45, .25]};
  restoreGround(position, colours, new Uint16Array([0, 0, 1, 0]), [cut]);
  assert.ok(Array.from(colours.slice(0, 3)).every((v, i) => Math.abs(v - cut.groundColour![i]) < 1e-6));
  assert.deepEqual(colours.slice(3), before.slice(3));
  assert.deepEqual(Array.from(position), [0, 2, 0, .20000000298023224, 2, 0, .4000000059604645, 2, 0, 20, 2, 0]);
});
