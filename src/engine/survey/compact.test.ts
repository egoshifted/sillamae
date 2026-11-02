import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {SurveyBucket, SurveyManifest} from '../data.ts';
import {SURFACES} from './classify.ts';
import {compactBucket} from './compact.ts';
import {addSurveyLayer, type SurveyMaterials} from './layer.ts';

function square(index = 0): SurveyBucket {
  return {index, position: new Float32Array([0,0,0, 1,0,0, 1,0,1, 0,0,0, 1,0,1, 0,0,1]),
    color: new Float32Array(18).fill(.25), uv: new Float32Array([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]),
    normal: new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0]),
    building: new Uint16Array(6), layer: new Uint8Array(6)};
}

test('compaction preserves every attribute and triangle order, including seams', () => {
  const original = square(), compact = compactBucket(original);
  assert.equal(compact.building.length, 4);
  assert.deepEqual([...compact.indices!], [0,1,2,0,2,3]);
  for (const [name, stride] of [['position',3],['color',3],['uv',2],['normal',3],['building',1],['layer',1]] as const) {
    const expanded = Array.from(compact.indices!).flatMap(i => [...compact[name]!.subarray(i * stride, (i + 1) * stride)]);
    assert.deepEqual(expanded, [...original[name]!]);
    const seam = square(); seam[name]![3 * stride] = name === 'building' || name === 'layer' ? 1 : -.25;
    const split = compactBucket(seam);
    assert.notEqual(split.indices![0], split.indices![3], name);
  }
  const signed = square(); signed.position[9] = -0;
  const split = compactBucket(signed);
  assert.notEqual(split.indices![0], split.indices![3]);
  assert.ok(Object.is(split.position[split.indices![3] * 3], -0));
  assert.equal(compactBucket(compact), compact);
});

test('flat-shaded compaction preserves all triangle corners without retaining face-normal duplicates', () => {
  const original = square(); original.normal!.set([0,0,1, 0,0,1, 0,0,1], 9);
  const compact = compactBucket(original, true);
  assert.equal(compact.building.length, 4);
  assert.equal(compact.normal, undefined);
  for (const [name, stride] of [['position',3],['color',3],['uv',2],['building',1],['layer',1]] as const)
    assert.deepEqual(Array.from(compact.indices!).flatMap(i => [...compact[name].subarray(i * stride, (i + 1) * stride)]), [...original[name]]);
});

test('overview and close-up share CPU and GPU attributes across repeated detail switches', () => {
  const scene = new THREE.Scene(), near = Object.fromEntries(SURFACES.map(k => [k, new THREE.MeshStandardMaterial({flatShading: true})])) as SurveyMaterials['near'], far = Object.fromEntries(SURFACES.map(k => [k, new THREE.MeshLambertMaterial()])) as SurveyMaterials['far'];
  const tints = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const materials = {near, far, tints, overlays: {tints, relief: {value: 0}, reliefRange: {value: new THREE.Vector2()}, base: 0}, setTextures() {}} as SurveyMaterials;
  const metadata = [0,1].map(() => ({kind: 'grass', detail: 'base', cell: '0,0'})) as SurveyManifest['buckets'];
  const layer = addSurveyLayer(scene, metadata, materials), base = scene.children[0], overview = scene.children[3];
  layer.fill(compactBucket(square(0))); layer.fill(compactBucket(square(1)));
  const [a,b] = base.children as THREE.Mesh[], whole = overview.children[0] as THREE.Mesh;
  for (const mesh of [a,b]) {
    for (const name of Object.keys(whole.geometry.attributes)) assert.equal(mesh.geometry.getAttribute(name), whole.geometry.getAttribute(name));
    assert.equal(mesh.geometry.index, whole.geometry.index);
  }
  assert.deepEqual(a.geometry.drawRange, {start: 0, count: 6});
  assert.deepEqual(b.geometry.drawRange, {start: 6, count: 6});
  assert.deepEqual([...whole.geometry.index!.array], [0,1,2,0,2,3,4,5,6,4,6,7]);
  const geometry = whole.geometry;
  for (const level of [2,0,1,0,2,0]) { layer.setLevel(level); assert.equal(whole.geometry, geometry); }
});
