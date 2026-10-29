import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Stair} from './data.ts';

const FOOT = 1; // metres of solid below the pitch line, so no gap opens under the flight
const CHEEK = {height: .25, thickness: .2};
// Depth-only lift above the survey ground's layer lift (see survey/layer.ts),
// whose painted steps would otherwise show through the treads.
const DEPTH_LIFT = 1;

export function addStairs(scene: THREE.Scene, stairs: Stair[]) {
  const treads: THREE.BufferGeometry[] = [], cheeks: THREE.BufferGeometry[] = [];
  for (const s of stairs) {
    const [low, high] = s.from[1] <= s.to[1] ? [s.from, s.to] : [s.to, s.from];
    const dx = high[0] - low[0], dz = high[2] - low[2], run = Math.hypot(dx, dz);
    if (run < .1) continue;
    const u = new THREE.Vector3(dx / run, 0, dz / run), side = new THREE.Vector3(-u.z, 0, u.x);
    const rise = high[1] - low[1], tread = run / s.steps, riser = rise / s.steps;
    const place = (offset: number) => new THREE.Matrix4().makeBasis(u, new THREE.Vector3(0, 1, 0), side)
      .setPosition(new THREE.Vector3(low[0], 0, low[2]).addScaledVector(side, offset));

    const profile = new THREE.Shape().moveTo(0, low[1] - FOOT);
    for (let i = 0; i < s.steps; i++) profile.lineTo(i * tread, low[1] + (i + 1) * riser).lineTo((i + 1) * tread, low[1] + (i + 1) * riser);
    profile.lineTo(run, high[1] - FOOT).closePath();
    treads.push(extrude(profile, s.width, place(-s.width / 2)));

    const cheek = new THREE.Shape().moveTo(0, low[1] - FOOT).lineTo(run, high[1] - FOOT)
      .lineTo(run, high[1] + CHEEK.height).lineTo(0, low[1] + riser + CHEEK.height).closePath();
    for (const offset of [-s.width / 2 - CHEEK.thickness, s.width / 2]) cheeks.push(extrude(cheek, CHEEK.thickness, place(offset)));
  }
  const group = new THREE.Group();
  for (const [parts, colour] of [[treads, '#bdb7ab'], [cheeks, '#a39d91']] as const) {
    if (!parts.length) continue;
    const material = new THREE.MeshStandardMaterial({color: colour, roughness: .9});
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
gl_Position.z += projectionMatrix[2][2] * ${DEPTH_LIFT}.;`);
    };
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    parts.forEach(p => p.dispose());
  }
  scene.add(group);
  return group;
}

function extrude(shape: THREE.Shape, depth: number, matrix: THREE.Matrix4) {
  return new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false}).applyMatrix4(matrix);
}
