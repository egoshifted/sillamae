import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {fitHaze} from './haze.ts';

function view(zoom: number) {
  const camera = new THREE.OrthographicCamera(-60, 60, 60, -60), target = new THREE.Vector3();
  camera.zoom = zoom;
  camera.position.set(0, 1000, 1000);
  const fog = new THREE.Fog(0xffffff);
  fitHaze(fog, camera, target);
  const distance = camera.position.distanceTo(target), share = (d: number) => THREE.MathUtils.smoothstep(d, fog.near, fog.far);
  return {centre: share(distance), edge: share(distance + 60 / zoom)};
}

test('the air stays clear close up and thickens towards the far edge with altitude', () => {
  const close = view(1), far = view(.04);
  assert.ok(close.centre < .001);
  assert.ok(close.edge > .04 && close.edge < .06);
  assert.ok(Math.abs(far.centre - .2) < .001);
  assert.ok(Math.abs(far.edge - .46) < .001);
});
