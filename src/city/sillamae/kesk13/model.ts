import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {baseElevation, eaves, ridges, roofPlanes, type SurveyPoint} from './design.ts';

import {addOpeningWall, courtyardWalls, streetWalls} from './street.ts';

export function createShell(context: OverrideContext) { return build(context, 'shell'); }
export function createStreet(context: OverrideContext) { return build(context, 'street'); }
export function createBuilding(context: OverrideContext) { return build(context, 'courtyard'); }

function build({building, frame}: OverrideContext, stage: 'shell' | 'street' | 'courtyard'): StudyModel {
  const positions: number[] = [], infills: number[] = [], doors: number[] = [];
  function vertex([x, z, h]: SurveyPoint) {
    positions.push(x - building.c[0], h - baseElevation, z - building.c[1]);
  }

  for (let i = 0; i < eaves.length; i++) {
    const a = eaves[i], b = eaves[(i + 1) % eaves.length];
    const wall = stage === 'shell' ? undefined : streetWalls[i] ?? (stage === 'courtyard' ? courtyardWalls[i] : undefined);
    if (wall) {
      addOpeningWall(a, b, wall, vertex,
        ([x, z, h]) => infills.push(x - building.c[0], h - baseElevation, z - building.c[1]),
        ([x, z, h]) => doors.push(x - building.c[0], h - baseElevation, z - building.c[1]));
      continue;
    }
    const footA: SurveyPoint = [a[0], a[1], baseElevation];
    const footB: SurveyPoint = [b[0], b[1], baseElevation];
    [footA, a, b, footA, b, footB].forEach(vertex);
  }
  const anchors = [...eaves, ...ridges];
  for (const plane of roofPlanes) {
    const corners = plane.map(i => anchors[i]);
    const outline = corners.map(([x, z]) => new THREE.Vector2(x, -z));
    for (const triangle of THREE.ShapeUtils.triangulateShape(outline, [])) {
      triangle.forEach(i => vertex(corners[i]));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.concat(infills, doors), 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color: '#c5c7be', roughness: 1});
  const materials = [material];
  geometry.addGroup(0, positions.length / 3, 0);
  if (infills.length) {
    materials.push(new THREE.MeshStandardMaterial({color: '#849396', roughness: .85}));
    geometry.addGroup(positions.length / 3, infills.length / 3, 1);
  }
  if (doors.length) {
    materials.push(new THREE.MeshStandardMaterial({color: '#665d53', roughness: 1}));
    geometry.addGroup((positions.length + infills.length) / 3, doors.length / 3, 2);
  }
  const root = new THREE.Mesh(geometry, materials);
  root.name = 'kesk13-' + stage;
  root.position.set(building.c[0] - frame.origin[0], baseElevation - frame.base, building.c[1] - frame.origin[1]);
  root.castShadow = root.receiveShadow = true;
  return {root, dispose() {root.removeFromParent(); geometry.dispose(); materials.forEach(m => m.dispose());}};
}
