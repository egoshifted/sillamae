import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {disposeDraw, markDrawDirty, markDrawStructure, syncDraw} from './draw.ts';

test('instanced meshes stay on the camera layer instead of collapsing into a batch', () => {
  disposeDraw();
  const scene = new THREE.Scene(), root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  scene.add(root);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 3);
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material), new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material), instanced);
  syncDraw(scene, root);
  assert.equal(instanced.layers.mask, 1);
  const batch = scene.children.find((object): object is THREE.BatchedMesh => object instanceof THREE.BatchedMesh);
  assert.equal(batch?.instanceCount, 2);
  disposeDraw();
});

test('many meshes of one material draw as a single batch and follow later moves', () => {
  disposeDraw();
  const scene = new THREE.Scene(), root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  scene.add(root);
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  first.position.set(3, 0, 0); second.position.set(-2, 1, 4);
  root.add(first, second);
  syncDraw(scene, root);
  const batch = scene.children.find((object): object is THREE.BatchedMesh => object instanceof THREE.BatchedMesh);
  assert.ok(batch);
  assert.equal(scene.children.filter(object => object instanceof THREE.BatchedMesh).length, 1);
  assert.equal(first.layers.mask, 1 << 1);
  assert.equal(first.castShadow, false);
  markDrawDirty();
  first.position.x = 8;
  syncDraw(scene, root);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.x - 8) < 1e-6);
  const added = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial());
  added.position.set(0, 3, 0);
  root.add(added);
  markDrawStructure();
  syncDraw(scene, root);
  const found = scene.children.filter((object): object is THREE.BatchedMesh => object instanceof THREE.BatchedMesh);
  assert.equal(found.length, 2);
  assert.ok(found.includes(batch));
  disposeDraw();
});
