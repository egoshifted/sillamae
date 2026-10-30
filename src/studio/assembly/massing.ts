import * as THREE from 'three';
import type {Building, Polygon, WorldFrame} from '../../engine/types.ts';
import type {StudyModel} from '../types.ts';

export interface MassingDesign {footprint?: Polygon; height?: number; datum?: number}

export function createMassingStudy({building, frame}: {building: Building; frame: WorldFrame}, design: MassingDesign = {}): StudyModel {
  const footprint = design.footprint ?? building.g, height = design.height ?? building.h;
  const datum = design.datum ?? (building.heightRange ? building.heightRange[0] + frame.base : undefined);
  if (datum === undefined || !Number.isFinite(datum) || !Number.isFinite(height) || height <= 0 || footprint.length < 3 || footprint.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw Error('A finite footprint, positive height and explicit ground datum are required');
  const shape = new THREE.Shape(footprint.map(([x, z]) => new THREE.Vector2(x - building.c[0], -(z - building.c[1]))));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false, steps: 1}); geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({color: '#c5c7be', roughness: 1});
  const root = new THREE.Group(), mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  root.position.set(building.c[0] - frame.origin[0], datum - frame.base, building.c[1] - frame.origin[1]);
  root.name = 'provisional-massing'; root.userData.audit = {stage: 'massing', footprint, height, datum, basis: 'Imported footprint and approximate survey envelope; roof, openings and architecture unverified'};
  let disposed = false;
  return {root, dispose() { if (disposed) return; disposed = true; geometry.dispose(); material.dispose(); root.removeFromParent(); }};
}
