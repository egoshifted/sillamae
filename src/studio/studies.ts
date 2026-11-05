import * as THREE from 'three';
import {usePhysicalDepth} from './depth.ts';
import {city, definitions} from './project.ts';
import {createMassingStudy} from './assembly/massing.ts';
import {createSurveyStudy, surveyGround} from './survey.ts';
import type {WorldData} from '../engine/data.ts';
import type {Building, OverrideContext} from '../engine/types.ts';
import {cutGround} from './ground-cut.ts';
import type {StudyModel} from './types.ts';

type XZH = [number, number, number];

// groundWithin keeps any triangle that nicks the site box, including ones hundreds of metres across.
function clipGround(poly: XZH[], box: {minX: number; maxX: number; minZ: number; maxZ: number}): XZH[] {
  const planes: [(p: XZH) => boolean, (a: XZH, b: XZH) => XZH][] = [
    [p => p[0] >= box.minX, (a, b) => { const t = (box.minX - a[0]) / (b[0] - a[0]); return [box.minX, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }],
    [p => p[0] <= box.maxX, (a, b) => { const t = (box.maxX - a[0]) / (b[0] - a[0]); return [box.maxX, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }],
    [p => p[1] >= box.minZ, (a, b) => { const t = (box.minZ - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, box.minZ, a[2] + (b[2] - a[2]) * t]; }],
    [p => p[1] <= box.maxZ, (a, b) => { const t = (box.maxZ - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, box.maxZ, a[2] + (b[2] - a[2]) * t]; }],
  ];
  let out = poly;
  for (const [inside, cross] of planes) {
    const next: XZH[] = [];
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length];
      if (inside(p)) { next.push(p); if (!inside(q)) next.push(cross(p, q)); }
      else if (inside(q)) next.push(cross(p, q));
    });
    out = next;
    if (out.length < 3) return [];
  }
  return out;
}

export function stages(id: string) {
  const result = [{id: 'survey', label: 'Original survey'}, {id: 'massing', label: 'Provisional massing'}];
  if (city.overrides.some(o => o.id === id)) result.push({id: 'assembled', label: 'Atlas assembly'});
  for (const [key, stage] of Object.entries(definitions.find(s => s.id === id)?.stages ?? {})) result.push({id: key, label: stage.label});
  if (new Set(result.map(s => s.id)).size !== result.length) throw Error('Study stage uses a reserved name');
  return result;
}
export function label(building: Building) { return `${definitions.find(s => s.id === building.id)?.label ?? building.name} · ${building.id}`; }

export async function buildStudy(world: WorldData, id: string, mode: string, custom?: (context: OverrideContext) => StudyModel | Promise<StudyModel>) {
  const building = world.buildings.find(b => b.id === id);
  if (!building) throw Error('Unknown study building: ' + id);
  const scene = new THREE.Scene(), frame = {...city.frame, base: world.base};
  scene.userData.keepParts = true;
  const definition = definitions.find(s => s.id === id);
  const useSurvey = mode !== 'assembled' && definition?.studyGroundSource === 'survey';
  let groundTriangles = useSurvey ? await surveyGround(building) : world.siteGround[id] ?? await surveyGround(building);
  const context: OverrideContext = {scene, building: structuredClone(building), terrain: world.terrain, frame, ground: groundTriangles, changed() {}};
  let model: StudyModel;
  if (mode === 'survey') model = await createSurveyStudy(building, frame);
  else if (mode === 'massing') model = createMassingStudy(context);
  else if (mode === 'assembled') {
    if (custom) model = await custom(context);
    else {
      const override = city.overrides.find(o => o.id === id);
      if (!override) throw Error('No production assembly for ' + id);
      const built = override.build(context);
      model = {root: built.root, setTextures: built.setTextures, ready: Promise.all([built.ready, built.root.userData.ready]), dispose: () => built.root.userData.dispose()};
    }
  } else {
    const stage = definition?.stages[mode];
    if (!stage) throw Error('Unknown study stage: ' + mode);
    model = await stage.build(context);
    groundTriangles = model.studyGround ?? groundTriangles;
    if (stage.cutsGround) groundTriangles = cutGround(groundTriangles, model.root.userData.groundPatches ?? []);
  }
  try { await model.ready; if (model.root.userData.detailError) throw Error(model.root.userData.detailError); }
  catch (error) { model.dispose(); throw error; }
  if (!model.root.parent) scene.add(model.root);
  usePhysicalDepth(scene);
  const bounds = new THREE.Box3().setFromObject(model.root), ground = new THREE.Group(); ground.name = 'study-ground';
  const gx = building.g.map(p => p[0]), gz = building.g.map(p => p[1]);
  const box = {minX: Math.min(...gx) - 15, maxX: Math.max(...gx) + 15, minZ: Math.min(...gz) - 15, maxZ: Math.max(...gz) + 15};
  const positions: number[] = [];
  for (const t of cutGround(groundTriangles, model.groundCuts ?? [])) {
    if(model.keepGroundTriangle&&!model.keepGroundTriangle(t))continue;
    // The source sea plane is not a local contact surface; retain nearby land layers.
    if (Math.max(t[2], t[5], t[8]) < bounds.min.y + frame.base - 5) continue;
    const poly = clipGround([[t[0], t[1], t[2]], [t[3], t[4], t[5]], [t[6], t[7], t[8]]], box);
    for (let k = 1; k < poly.length - 1; k++) for (const p of [poly[0], poly[k], poly[k + 1]]) positions.push(p[0] - frame.origin[0], p[2] - frame.base, p[1] - frame.origin[1]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color: '#a5ad91', roughness: 1, side: THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; ground.add(mesh); scene.add(ground);
  let disposed = false;
  return {scene, root: model.root, ground, bounds, shadowDetail: model.shadowDetail, textures: (on: boolean) => model.setTextures?.(on), dispose() {
    if (disposed) return; disposed = true; model.dispose(); geometry.dispose(); material.dispose(); scene.clear();
  }};
}

