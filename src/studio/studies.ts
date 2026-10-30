import * as THREE from 'three';
import {usePhysicalDepth} from './depth.ts';
import {city, definitions} from './project.ts';
import {createMassingStudy} from './assembly/massing.ts';
import {createSurveyStudy, surveyGround} from './survey.ts';
import type {WorldData} from '../engine/data.ts';
import type {Building, OverrideContext} from '../engine/types.ts';
import type {StudyModel} from './types.ts';

export function stages(id: string) {
  const result = [{id: 'survey', label: 'Original survey'}, {id: 'massing', label: 'Provisional massing'}];
  if (city.overrides.some(o => o.id === id)) result.push({id: 'assembled', label: 'Atlas assembly'});
  for (const [key, stage] of Object.entries(definitions.find(s => s.id === id)?.stages ?? {})) result.push({id: key, label: stage.label});
  if (new Set(result.map(s => s.id)).size !== result.length) throw Error('Study stage uses a reserved name');
  return result;
}
export function label(building: Building) { return `${definitions.find(s => s.id === building.id)?.label ?? building.name} · ${building.id}`; }

export async function buildStudy(world: WorldData, id: string, mode: string) {
  const building = world.buildings.find(b => b.id === id);
  if (!building) throw Error('Unknown study building: ' + id);
  const scene = new THREE.Scene(), frame = {...city.frame, base: world.base};
  const groundTriangles = world.siteGround[id] ?? await surveyGround(building);
  const context: OverrideContext = {scene, building: structuredClone(building), terrain: world.terrain, frame, ground: groundTriangles, changed() {}};
  let model: StudyModel;
  if (mode === 'survey') model = await createSurveyStudy(building, frame);
  else if (mode === 'massing') model = createMassingStudy(context);
  else if (mode === 'assembled') {
    const override = city.overrides.find(o => o.id === id);
    if (!override) throw Error('No production assembly for ' + id);
    const built = override.build(context);
    model = {root: built.root, setTextures: built.setTextures, ready: Promise.all([built.ready, built.root.userData.ready]), dispose: () => built.root.userData.dispose()};
  } else {
    const stage = definitions.find(s => s.id === id)?.stages[mode];
    if (!stage) throw Error('Unknown study stage: ' + mode);
    model = await stage.build(context);
  }
  try { await model.ready; if (model.root.userData.detailError) throw Error(model.root.userData.detailError); }
  catch (error) { model.dispose(); throw error; }
  if (!model.root.parent) scene.add(model.root);
  usePhysicalDepth(scene);
  const bounds = new THREE.Box3().setFromObject(model.root), ground = new THREE.Group(); ground.name = 'study-ground';
  const positions: number[] = [];
  for (const t of groundTriangles) {
    // The source sea plane is not a local contact surface; retain nearby land layers.
    if (Math.max(t[2], t[5], t[8]) < bounds.min.y + frame.base - 5) continue;
    for (let i = 0; i < 9; i += 3) positions.push(t[i] - frame.origin[0], t[i + 2] - frame.base, t[i + 1] - frame.origin[1]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color: '#a5ad91', roughness: 1, side: THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; ground.add(mesh); scene.add(ground);
  let disposed = false;
  return {scene, root: model.root, ground, bounds, textures: (on: boolean) => model.setTextures?.(on), dispose() {
    if (disposed) return; disposed = true; model.dispose(); geometry.dispose(); material.dispose(); scene.clear();
  }};
}
