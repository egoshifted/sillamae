import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {sillamae} from '../../city/sillamae/index.ts';
import type {WorldData} from '../../engine/data.ts';
import {hash, localDirectory, option, repo, writeNew} from './local.ts';

const out = localDirectory(option('out', true)!);
// Node checks geometry only. Canvas painting and downloaded textures need browser captures.
const inertContext = () => new Proxy({}, {get: (target: Record<string | symbol, unknown>, key) => key === 'createImageData' ? undefined : key in target ? target[key] : () => {}});
Object.assign(globalThis, {document: {createElement: () => ({width: 0, height: 0, getContext: inertContext})}});
const world: WorldData = JSON.parse(fs.readFileSync(path.join(repo, 'public/data/world.json'), 'utf8'));
function snapshot(root: THREE.Object3D) {
  const rows: unknown[] = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.matrixWorld.elements.every(Number.isFinite)) throw Error('Non-finite transform: ' + o.name);
    const geometry: Record<string, unknown> = {};
    if (o instanceof THREE.Mesh) {
      for (const [name, a] of Object.entries(o.geometry.attributes) as [string, THREE.BufferAttribute][]) {
        if (!Array.from(a.array).every(Number.isFinite)) throw Error('Non-finite ' + name + ': ' + o.name);
        geometry[name] = {size: a.itemSize, normalized: a.normalized, count: a.count, hash: hash(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength))};
      }
      geometry.index = o.geometry.index ? Array.from(o.geometry.index.array) : null;
      geometry.groups = o.geometry.groups;
    }
    const materials = o instanceof THREE.Mesh ? (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[] : [];
    rows.push({name: o.name, type: o.type, visible: o.visible, matrix: o.matrix.toArray(), cast: o.castShadow, receive: o.receiveShadow, geometry, materials: materials.map(m => ({type: m.type, color: m.color?.getHex(), roughness: m.roughness, metalness: m.metalness, side: m.side, opacity: m.opacity, map: !!m.map, bumpMap: !!m.bumpMap, bumpScale: m.bumpScale, compile: String(m.onBeforeCompile), cacheKey: m.customProgramCacheKey()})), audit: o.userData.audit});
  });
  return rows;
}
const results: Record<string, unknown> = {};
const selected = option('id');
for (const override of sillamae.overrides.filter(o => !selected || o.id === selected)) {
  const scene = new THREE.Scene(), building = structuredClone(world.buildings.find(b => b.id === override.id)!);
  const built = override.build({scene, building, terrain: world.terrain, frame: {...sillamae.frame, base: world.base}, ground: world.siteGround[override.id] ?? [], changed() {}});
  try {
    await built.ready; await built.root.userData.ready;
    if (built.root.userData.detailError) throw Error(built.root.userData.detailError);
    const textured = snapshot(scene); built.setTextures(false); const untextured = snapshot(scene); built.setTextures(true); const restored = snapshot(scene);
    if (JSON.stringify(textured) !== JSON.stringify(restored)) throw Error('Texture restore changed model: ' + override.id);
    const lod: Record<string, unknown> = {};
    if (built.root instanceof THREE.LOD) for (const distance of [5, 50, 200]) {
      const camera = new THREE.PerspectiveCamera(35, 1, .1, 1000); camera.position.copy(built.root.position).add(new THREE.Vector3(distance, 0, 0)); camera.updateMatrixWorld(true); built.root.update(camera); lod[distance] = snapshot(scene);
    }
    results[override.id] = {textured, untextured, restored, lod, patches: built.groundPatches, entrances: override.entrances?.(building)};
  } finally { built.root.userData.dispose(); built.root.removeFromParent(); }
  if (scene.children.length) throw Error('Model left objects in the scene after disposal: ' + override.id);
}
if (!Object.keys(results).length) throw Error('No production override for this ID; use studio capture for an unregistered draft');
writeNew(path.join(out, 'models.json'), results);
const previous = option('compare');
if (previous && fs.readFileSync(path.join(previous, 'models.json'), 'utf8') !== fs.readFileSync(path.join(out, 'models.json'), 'utf8')) throw Error('Model snapshot differs; inspect before accepting');
console.log('Finite geometry, texture restoration and scene disposal passed; models saved locally.');
