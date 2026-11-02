import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addPlacements} from './placements.ts';
import type {AssetDefinition} from './types.ts';

test('placement batching preserves foliage shader hooks and alpha shadow material', () => {
  const material = new THREE.MeshLambertMaterial(), depth = new THREE.MeshDepthMaterial();
  material.onBeforeCompile = shader => { shader.vertexShader = 'seasonal-leaves\n' + shader.vertexShader; };
  material.customProgramCacheKey = () => 'seasonal-test';
  const asset: AssetDefinition = {id: 'shrub-test-01', name: 'Shrub', category: 'vegetation', tags: ['shrub'], attach: 'ground', size: [1, 1, 1], triangles: 2, variants: [{id: 'atlas', label: 'Atlas'}], build() {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.customDepthMaterial = depth;
    return mesh;
  }};
  const scene = new THREE.Group();
  addPlacements(scene, [{id: 'a', asset: asset.id, p: [0, 0, 0], heading: 0, attach: 'ground'}], new Map([[asset.id, asset]]), {origin: [0, 0], base: 0});
  let count = 0;
  scene.traverse(o => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    const m = o.material as THREE.Material;
    const shader = {vertexShader: '#include <project_vertex>', fragmentShader: '', uniforms: {}} as THREE.WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.match(shader.vertexShader, /seasonal-leaves/);
    assert.match(shader.vertexShader, /gl_Position.z/);
    assert.match(m.customProgramCacheKey(), /seasonal-test/);
    assert.equal(o.customDepthMaterial, depth);
    count++;
  });
  assert.equal(count, 2);
});
