import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {sillamae} from '../index.ts';
import {doorFeet, footprint, stairFoot} from './design.ts';
import {refined} from './index.ts';

test('Kesk 8 is registered once and the atlas builds the finished model', () => {
  assert.equal(sillamae.overrides.filter(o => o.id === refined.id).length, 1);
  assert.equal(sillamae.overrides.find(o => o.id === refined.id), refined);
  const scene = new THREE.Scene(), context = {scene, frame: {origin: [750, 760], base: 19.3}, terrain: {} as never, ground: [], building: {} as never} as unknown as OverrideContext;
  const model = refined.build(context);
  assert.equal(model.root.parent, scene);
  // Batched for the atlas: one mesh per material rather than one per part.
  const materials = new Set<THREE.Material>();
  let meshes = 0;
  model.root.traverse(child => { if (child instanceof THREE.Mesh) { meshes++; materials.add(child.material as THREE.Material); } });
  assert.ok(meshes > 0 && meshes === materials.size, meshes + ' meshes for ' + materials.size + ' materials');
  model.root.userData.dispose();
  assert.equal(scene.children.length, 0);
});

test('every door foot lies outside the footprint, the Kesk flight first', () => {
  const feet = refined.entrances!({} as never);
  assert.deepEqual(feet, doorFeet());
  assert.deepEqual(feet[0], stairFoot());
  const inside = ([x, z]: [number, number]) => footprint.reduce((hit, a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    return (a[1] > z) !== (b[1] > z) && x < a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0]) ? !hit : hit;
  }, false);
  for (const foot of feet) assert.ok(!inside(foot), `${foot} is inside the footprint`);
});
