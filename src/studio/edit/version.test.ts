import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyHistoryChange, applyParts, diffParts, identifyParts, rememberParts, type HistoryStep} from './version.ts';

function unidentified() {
  const root = new THREE.Group();
  const front = new THREE.Group();
  front.name = 'front';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 3, .4));
  wall.name = 'wall';
  const other = new THREE.Mesh(new THREE.BoxGeometry(6, 3, .4));
  other.name = 'wall';
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10, .2, 8));
  front.add(wall, other);
  root.add(front, roof);
  identifyParts(root);
  return {root, wall, other, roof};
}

test('a generated model gets the same ids on every build and keeps authored ones', () => {
  const first = unidentified(), second = unidentified();
  assert.deepEqual([first.wall, first.other, first.roof].map(obj => obj.userData.id), ['model/front/wall', 'model/front/wall#2', 'model/Mesh']);
  assert.equal(second.other.userData.id, first.other.userData.id);
  const authored = new THREE.Group();
  const part = new THREE.Mesh();
  part.userData.id = 'src/model.ts:10';
  authored.add(part);
  identifyParts(authored);
  assert.equal(part.userData.id, 'src/model.ts:10');
  assert.equal(authored.userData.id, undefined);
});

test('a saved move on a generated model returns to that part, with no stand-in box', () => {
  const first = unidentified(), born = rememberParts(first.root);
  first.wall.position.x = 2;
  const edits = diffParts(first.root, born);
  assert.equal(edits[0].kind, 'part');
  const second = unidentified();
  assert.deepEqual(applyParts(second.root, edits), []);
  assert.equal(second.wall.position.x, 2);
  assert.equal(second.root.children.length, 2);
  assert.equal(second.wall.parent?.children.length, 2);
});

test('an edit whose part is gone is reported and draws nothing', () => {
  const {root} = unidentified();
  const lost = applyParts(root, [{id: 'model/gone', name: 'gone', kind: 'part', parent: null, position: [1, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], visible: true}]);
  assert.deepEqual(lost, ['model/gone']);
  assert.equal(root.children.length, 2);
  const byId = new Map<string, THREE.Object3D>();
  const state = {parent: null, attached: true, visible: true, position: [1, 0, 0] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number]};
  applyHistoryChange(root, byId, {id: 'model/gone', kind: 'part', name: 'gone', before: state, after: state}, 'after');
  assert.equal(root.children.length, 2);
});

test('a saved duplicate returns as a copy of its source part', () => {
  const first = unidentified(), born = rememberParts(first.root);
  const copy = first.roof.clone(false);
  copy.userData = {id: 'studio:1', cloneOf: first.roof.userData.id};
  copy.position.x = .4;
  first.root.add(copy);
  const edits = diffParts(first.root, born);
  const second = unidentified();
  assert.deepEqual(applyParts(second.root, edits), []);
  const restored = second.root.children.find(child => child.userData.id === 'studio:1') as THREE.Mesh;
  assert.equal(restored.geometry, second.roof.geometry);
  assert.equal(restored.position.x, .4);
});

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
