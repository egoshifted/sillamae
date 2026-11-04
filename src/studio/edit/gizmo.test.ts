import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {tightenPickers} from './gizmo.ts';

function extent(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z};
}

test('handle pickers stay on the visible arrows instead of a fat cone', () => {
  const controls = new TransformControls(new THREE.PerspectiveCamera());
  tightenPickers(controls.getHelper());
  const picker = (controls.getHelper().children.find(child => 'picker' in child) as {picker: Record<string, THREE.Object3D>}).picker;
  const shafts = picker.translate.children.filter(child => child.name === 'X') as THREE.Mesh[];
  assert.equal(shafts.length, 2);
  for (const shaft of shafts) {
    const size = extent(shaft.geometry);
    assert.ok(size.x > 0.5, 'the arrow still reaches its tip');
    assert.ok(size.y < 0.1 && size.z < 0.1, 'the invisible hit is no wider than the arrow head');
  }
  const ring = picker.rotate.children.find(child => child.name === 'X') as THREE.Mesh;
  const size = extent(ring.geometry);
  assert.ok(size.x < 0.08, 'the ring hit is a thin tube');
  assert.ok(size.y > 0.9 && size.z > 0.9, 'the ring keeps its radius');
});
