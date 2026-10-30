import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchDetailStudy} from './batch.ts';

test('batch preserves transformed triangles, UVs, material and shadow grouping', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const a = new THREE.Mesh(new THREE.BoxGeometry(), material), b = new THREE.Mesh(new THREE.BoxGeometry(), material);
  a.position.set(2, 3, 4); a.rotation.y = .4; b.position.set(-2, 1, 3); b.castShadow = true;
  root.add(a, b); root.updateMatrixWorld(true);
  const expected = [a, b].map(m => { const g = m.geometry.toNonIndexed(); g.applyMatrix4(m.matrix); return g; });
  let disposed = 0; [a, b].forEach(m => m.geometry.addEventListener('dispose', () => disposed++));
  batchDetailStudy(root); assert.equal(disposed, 2); assert.equal(root.children.length, 2);
  root.children.forEach((o, i) => { const mesh = o as THREE.Mesh; assert.equal(mesh.material, material); assert.equal(mesh.castShadow, i === 1); for (const name of ['position', 'normal', 'uv']) assert.deepEqual(mesh.geometry.getAttribute(name).array, expected[i].getAttribute(name).array); mesh.geometry.dispose(); });
  expected.forEach(g => g.dispose()); material.dispose();
});
test('unsupported input fails before changing children or disposing original geometry', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial(), a = new THREE.Mesh(new THREE.BoxGeometry(), material), b = new THREE.Object3D();
  root.add(a, b); let disposed = false; a.geometry.addEventListener('dispose', () => disposed = true);
  assert.throws(() => batchDetailStudy(root), /childless/); assert.deepEqual(root.children, [a, b]); assert.equal(disposed, false);
  root.remove(b); a.geometry.setAttribute('building', new THREE.Uint16BufferAttribute(new Uint16Array(24), 1));
  assert.throws(() => batchDetailStudy(root), /discard/); assert.equal(disposed, false);
  a.geometry.dispose(); material.dispose();
});
test('failure during transformation releases temporary geometry and retains originals', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(mesh); let released = 0, originalDisposed = false;
  mesh.geometry.addEventListener('dispose', () => originalDisposed = true);
  const convert = mesh.geometry.toNonIndexed.bind(mesh.geometry);
  mesh.geometry.toNonIndexed = () => { const g = convert(); g.addEventListener('dispose', () => released++); g.applyMatrix4 = () => { throw Error('test transform failure'); }; return g; };
  assert.throws(() => batchDetailStudy(root), /test transform failure/); assert.equal(released, 1); assert.equal(originalDisposed, false); assert.equal(root.children[0], mesh);
  mesh.geometry.dispose(); material.dispose();
});
