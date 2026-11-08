import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pickTree, type TreeItem} from './trees.ts';
import type {WorldFrame} from '../../engine/types.ts';

const frame = {origin: [100, 200], base: 10} as WorldFrame;
const tree: TreeItem = {key: 'tree', tree: {p: [105, 205], z: 10, h: 12, r: 3, type: 'Lehtpuu', year: 0}};
test('plan-view clicks hit the top of a tree crown', () => {
  const ray = new THREE.Ray(new THREE.Vector3(5, 30, 5), new THREE.Vector3(0, -1, 0));
  assert.equal(pickTree(ray, [tree], frame)?.item.key, 'tree');
  assert.equal(pickTree(ray, [tree], frame)?.distance, 18);
  ray.origin.x = 9;
  assert.equal(pickTree(ray, [tree], frame), null);
});
test('oblique tree picking still chooses the nearest crown', () => {
  const ray = new THREE.Ray(new THREE.Vector3(5, 6, -10), new THREE.Vector3(0, 0, 1));
  const farther: TreeItem = {...tree, key: 'farther', tree: {...tree.tree, p: [105, 215]}};
  assert.equal(pickTree(ray, [farther, tree], frame)?.item.key, 'tree');
});
test('the ground beside a trunk, under the crown, is not the tree', () => {
  const ray = new THREE.Ray(new THREE.Vector3(7, 2, -10), new THREE.Vector3(0, -.1, 1).normalize());
  assert.equal(pickTree(ray, [tree], frame), null);
});
test('a tree the camera stands in is not picked', () => {
  const ray = new THREE.Ray(new THREE.Vector3(5.5, 8, 5), new THREE.Vector3(1, -.2, 0).normalize());
  assert.equal(pickTree(ray, [tree], frame), null);
});
