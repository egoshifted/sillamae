import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {looksLikeGlass} from './water.ts';

const standard = (color: string, options = {}) => new THREE.MeshStandardMaterial({color, ...options});

test('the panes refined models paint count as glass', () => {
  for (const color of ['#65818a', '#71838a', '#6a8189', '#74858c', '#6b7d82', '#7b8b90', '#aebfc0']) assert.ok(looksLikeGlass(standard(color)), color);
});

test('walls, roofs, brick and metal do not', () => {
  for (const color of ['#a19e94', '#74767a', '#8a4b2f', '#d5d1c8', '#e0dcd0', '#222a30', '#a1a8aa', '#969e9f']) assert.ok(!looksLikeGlass(standard(color)), color);
  assert.ok(!looksLikeGlass(standard('#65818a', {metalness: .6})));
  assert.ok(!looksLikeGlass(new THREE.MeshLambertMaterial({color: '#65818a'})));
});
