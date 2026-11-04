import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groupParts, isLocked, lockOwner} from './group.ts';

function box(name: string, x: number, y: number, z: number) {
  const material = new THREE.MeshStandardMaterial();
  material.name = name;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

test('parts stay separate under their material name', () => {
  const wall = box('Masonry', 0, 2, 0);
  wall.userData.id = 'src/city/sillamae/kesk1/model.ts:485';
  const other = box('Masonry', 8, 2, 0);
  other.userData.id = 'src/city/sillamae/kesk1/model.ts:485#2';
  const roof = box('Roof', 0, 11, 0);
  roof.userData.id = 'src/city/sillamae/kesk1/model.ts:500';
  const nodes = groupParts([wall, other, roof], () => '');
  assert.deepEqual(nodes.map(node => node.label), ['Masonry', 'Masonry', 'Roof']);
  assert.equal(nodes.every(node => node.children.length === 0), true);
});

test('a user group is the only folder, and a placed dish stays one row', () => {
  const group = new THREE.Group();
  group.name = 'Фасад';
  group.userData.studioGroup = true;
  group.userData.id = 'studio:1';
  const wall = box('Masonry', 0, 0, 0);
  wall.userData.id = 'src/model.ts:10';
  group.add(wall);
  const dish = new THREE.Group();
  dish.userData.item = 'satellite-dish';
  dish.userData.partId = 'p1';
  dish.add(box('Metal', 0, 0, 0));
  const nodes = groupParts([group, dish], id => id === 'satellite-dish' ? 'Satellite dish' : id);
  assert.equal(nodes[0].label, 'Фасад');
  assert.equal(nodes[0].children[0].label, 'Masonry');
  assert.equal(nodes[1].label, 'Satellite dish');
  assert.equal(nodes[1].children.length, 0);
});

test('a lone survey mesh stays one row', () => {
  const survey = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  survey.name = 'original-survey';
  survey.updateMatrixWorld(true);
  assert.equal(groupParts([survey], () => '')[0].label, 'Survey');
});

test('a locked group locks its children, and the flag owner is the group', () => {
  const group = new THREE.Group();
  const wall = box('Masonry', 0, 0, 0);
  group.add(wall);
  assert.equal(isLocked(wall), false);
  assert.equal(lockOwner(wall), null);
  group.userData.locked = true;
  assert.equal(isLocked(group), true);
  assert.equal(isLocked(wall), true);
  assert.equal(lockOwner(wall), group);
  wall.userData.locked = true;
  assert.equal(lockOwner(wall), wall);
});
