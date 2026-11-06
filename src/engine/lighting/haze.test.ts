import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {fitHaze, installAtmosphere} from './haze.ts';

function view(zoom: number) {
  const camera = new THREE.OrthographicCamera(-60, 60, 60, -60), target = new THREE.Vector3();
  camera.zoom = zoom;
  camera.position.set(0, 1000, 1000);
  const fog = new THREE.Fog(0xffffff);
  fitHaze(fog, camera, target);
  const distance = camera.position.distanceTo(target), share = (d: number) => THREE.MathUtils.smoothstep(d, fog.near, fog.far);
  return {centre: share(distance), edge: share(distance + 60 / zoom), below: share(distance + 40)};
}

test('the air stays clear close up and thickens towards the far edge with altitude', () => {
  const close = view(.8), far = view(.04);
  assert.ok(close.centre < .001);
  assert.ok(close.edge > .04 && close.edge < .06);
  assert.ok(Math.abs(far.centre - .2) < .001);
  assert.ok(Math.abs(far.edge - .46) < .001);
});

test('zooming in past close-up adds no haze, even on ground off the target plane', () => {
  assert.ok(view(12).below < .02);
});

test('the atmosphere still finds its place in the three.js shader chunks', () => {
  installAtmosphere([new THREE.Vector3(1, 0, 100)]);
  assert.match(THREE.ShaderChunk.fog_fragment, /hazeEdge/);
  assert.match(THREE.ShaderChunk.lights_fragment_begin, /hazeCloud/);
});
