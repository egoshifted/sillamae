import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyHistoryChange, applyParts, diffParts, rememberParts, type HistoryStep} from './version.ts';

test('a local version keeps moves, new pieces and deletions, and skips untouched parts', () => {
  const root = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  wall.userData.id = 'src/model.ts:10';
  const gone = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  gone.userData.id = 'src/model.ts:11';
  root.add(wall, gone);
  const born = rememberParts(root);
  wall.position.set(2, 0, 0);
  gone.removeFromParent();
  const added = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  added.userData.id = 'studio:1';
  added.name = 'Element';
  root.add(added);
  const edits = diffParts(root, born);
  assert.deepEqual(edits.map(edit => edit.id).sort(), ['src/model.ts:10', 'src/model.ts:11', 'studio:1']);
  assert.equal(edits.find(edit => edit.id === 'src/model.ts:11')?.removed, true);

  const again = new THREE.Group();
  const wall2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  wall2.userData.id = 'src/model.ts:10';
  const gone2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  gone2.userData.id = 'src/model.ts:11';
  again.add(wall2, gone2);
  applyParts(again, edits);
  assert.equal(wall2.position.x, 2);
  assert.equal(gone2.parent, null);
  const created = again.children.find(child => child.userData.id === 'studio:1');
  assert.equal(created?.name, 'Element');
});

test('replaying the audit stops at the saved cursor', () => {
  const root = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  wall.userData.id = 'src/model.ts:10';
  root.add(wall);
  const steps: HistoryStep[] = [
    {name: 'Move', changes: [{id: 'src/model.ts:10', kind: 'part', name: '', before: {parent: null, attached: true, visible: true, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]}, after: {parent: null, attached: true, visible: true, position: [3, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]}}]},
    {name: 'Hide', changes: [{id: 'src/model.ts:10', kind: 'part', name: '', before: {parent: null, attached: true, visible: true, position: [3, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]}, after: {parent: null, attached: true, visible: false, position: [3, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]}}]},
  ];
  const byId = new Map([[wall.userData.id as string, wall]]);
  applyHistoryChange(root, byId, steps[0].changes[0], 'after');
  assert.equal(wall.position.x, 3);
  assert.equal(wall.visible, true);
  applyHistoryChange(root, byId, steps[1].changes[0], 'after');
  assert.equal(wall.visible, false);
  applyHistoryChange(root, byId, steps[1].changes[0], 'before');
  assert.equal(wall.visible, true);
});
