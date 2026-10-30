import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {usePhysicalDepth} from './depth.ts';

test('isolated study removes atlas lift without losing material shaders or uniforms', () => {
  for (const lift of ['1.', '.01', 'rodinaLift', '1. * step(.5, normal.y)']) {
    const material = new THREE.MeshStandardMaterial(), scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(), mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
    material.onBeforeCompile = shader => {
      shader.uniforms.detail = {value: 1};
      shader.vertexShader += '\ngl_Position.z += projectionMatrix[2][2] * ' + lift + ';';
      shader.fragmentShader += '\nmaterial-detail';
    };
    material.customProgramCacheKey = () => 'original-detail';
    usePhysicalDepth(scene);
    const shader = {uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: 'surface'} as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.equal(shader.vertexShader.trim(), '#include <project_vertex>');
    assert.equal(shader.fragmentShader, 'surface\nmaterial-detail');
    assert.deepEqual(shader.uniforms.detail, {value: 1});
    assert.equal(material.customProgramCacheKey(), 'original-detail:studio-physical-depth');
    assert.equal(material.polygonOffset, true);
    assert.equal(mesh.geometry, geometry); assert.equal(material.transparent, false);
    geometry.dispose(); material.dispose();
  }
});

test('perspective negative control demonstrates a hidden step defeating a nearer opaque wall', () => {
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 2000), projection = camera.projectionMatrix;
  const clip = (distance: number) => new THREE.Vector4(0, 0, -distance, 1).applyMatrix4(projection);
  const wall = clip(5), step = clip(10);
  assert.ok(step.z / step.w > wall.z / wall.w);
  const broken = step.clone(); broken.z += projection.elements[10];
  assert.ok(broken.z / broken.w < wall.z / wall.w, 'Old shader incorrectly puts the hidden step in front');
});
