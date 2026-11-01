import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addStreets} from './streets.ts';
import type {LocalPoint} from './data.ts';

// 10 m square road, counter-clockwise in (x, z) as the data build writes outer rings.
const square: LocalPoint[] = [[0, 1, 0], [10, 1, 0], [10, 1, 10], [0, 1, 10]];

function normals(mesh: THREE.Mesh) {
  const p = mesh.geometry.getAttribute('position'), out: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, i + k));
    out.push(b.sub(a).cross(c.sub(a)).normalize());
  }
  return out;
}

test('carriageways and markings face up whichever way their rings wind', () => {
  for (const ring of [square, [...square].reverse()]) {
    const scene = new THREE.Scene(), group = addStreets(scene, {carriageways: [[ring]], markings: [[ring]], kerbs: []});
    for (const mesh of group.children as THREE.Mesh[]) for (const n of normals(mesh)) assert.ok(n.y > .99, 'face points down');
  }
});

test('kerbs rise on the right of travel with faces towards the road, up and out', () => {
  const scene = new THREE.Scene(), group = addStreets(scene, {carriageways: [], markings: [], kerbs: [[[0, 1, 0], [10, 1, 0]]]});
  const mesh = group.children[0] as THREE.Mesh, faces = normals(mesh);
  // Travel +x with the road on the left (+z): kerb at z < 0.
  const p = mesh.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) assert.ok(p.getZ(i) <= 1e-9);
  assert.ok(faces.some(n => n.z > .99), 'no face towards the road');
  assert.ok(faces.some(n => n.y > .99), 'no top face');
  assert.ok(faces.some(n => n.z < -.99), 'no outer face');
  assert.ok(faces.every(n => n.y > -.5), 'a face points down');
});
