import * as THREE from 'three';

// The camera draws one batch per material. Source meshes stay on layer 1, so a ray can still hit one part.
const PICK = 1;
type Record = {batch: THREE.BatchedMesh; id: number; cache: Float32Array; visible: boolean};
const records = new Map<THREE.Mesh, Record>();
const batches: THREE.BatchedMesh[] = [];
let sceneSeen: THREE.Scene | null = null;
let rootSeen: THREE.Object3D | null = null;
let structureEpoch = 0;
let builtEpoch = -1;
let dirtyAll = false;
const dirtyMeshes = new Set<THREE.Mesh>();

export function markDrawDirty(object?: THREE.Object3D) {
  if (!object) { dirtyAll = true; return; }
  object.traverse(node => { if (node instanceof THREE.Mesh) dirtyMeshes.add(node); });
}
export function markDrawStructure() { structureEpoch++; dirtyAll = true; }

function casts(mesh: THREE.Mesh) {
  return mesh.userData.drawCast != null ? mesh.userData.drawCast === true : mesh.castShadow;
}
function signature(mesh: THREE.Mesh) {
  const material = mesh.material as THREE.Material;
  return material.uuid + '|' + (casts(mesh) ? 'c' : '') + '|' + Object.keys(mesh.geometry.attributes).sort().join(',');
}

function collect(root: THREE.Object3D) {
  const list: THREE.Mesh[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || !object.geometry.getAttribute('position')) return;
    list.push(object);
  });
  return list;
}

function clearBatches() {
  for (const batch of batches) { batch.removeFromParent(); batch.dispose(); }
  batches.length = 0;
  for (const mesh of records.keys()) {
    mesh.layers.set(0);
    mesh.castShadow = mesh.userData.drawCast === true;
    mesh.receiveShadow = mesh.userData.drawReceive === true;
  }
  records.clear();
}

function enroll(scene: THREE.Scene, meshes: THREE.Mesh[]) {
  const groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    if (records.has(mesh)) continue;
    const key = signature(mesh);
    const list = groups.get(key);
    if (list) list.push(mesh);
    else groups.set(key, [mesh]);
  }
  for (const group of groups.values()) {
    const prepared = group.map(mesh => mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry);
    let vertices = 0;
    for (const geometry of prepared) vertices += geometry.getAttribute('position').count;
    const batch = new THREE.BatchedMesh(prepared.length, vertices, 1, group[0].material as THREE.Material);
    batch.perObjectFrustumCulled = false;
    batch.sortObjects = false;
    batch.frustumCulled = false;
    batch.castShadow = casts(group[0]);
    batch.receiveShadow = true;
    batch.raycast = () => {};
    batch.name = 'draw-batch';
    for (let i = 0; i < prepared.length; i++) {
      const mesh = group[i], geometry = prepared[i];
      const id = batch.addInstance(batch.addGeometry(geometry));
      if (geometry !== mesh.geometry) geometry.dispose();
      batch.setMatrixAt(id, mesh.matrixWorld);
      const visible = mesh.visible;
      if (!visible) batch.setVisibleAt(id, false);
      const cache = new Float32Array(16);
      cache.set(mesh.matrixWorld.elements);
      records.set(mesh, {batch, id, cache, visible});
      if (mesh.userData.drawCast == null) { mesh.userData.drawCast = mesh.castShadow; mesh.userData.drawReceive = mesh.receiveShadow; }
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.layers.set(PICK);
    }
    scene.add(batch);
    batches.push(batch);
  }
}

function rebuild(scene: THREE.Scene, root: THREE.Object3D) {
  clearBatches();
  const meshes = collect(root);
  if (meshes.length < 2) return;
  root.updateMatrixWorld(true);
  enroll(scene, meshes);
}

function adopt(scene: THREE.Scene, root: THREE.Object3D) {
  const live = new Set(collect(root));
  for (const mesh of [...records.keys()]) {
    if (live.has(mesh)) continue;
    const record = records.get(mesh)!;
    record.batch.deleteInstance(record.id);
    records.delete(mesh);
    mesh.layers.set(0);
    if (mesh.userData.drawCast != null) { mesh.castShadow = mesh.userData.drawCast === true; mesh.receiveShadow = mesh.userData.drawReceive === true; }
  }
  const used = new Set([...records.values()].map(record => record.batch));
  for (let i = batches.length - 1; i >= 0; i--) if (!used.has(batches[i])) { batches[i].removeFromParent(); batches[i].dispose(); batches.splice(i, 1); }
  root.updateMatrixWorld(true);
  enroll(scene, [...live].filter(mesh => !records.has(mesh)));
}

function syncMesh(mesh: THREE.Mesh) {
  const record = records.get(mesh);
  if (!record) return;
  mesh.updateWorldMatrix(true, false);
  let visible = mesh.parent != null;
  for (let node: THREE.Object3D | null = mesh; visible && node; node = node.parent) if (!node.visible) visible = false;
  if (record.visible !== visible) { record.batch.setVisibleAt(record.id, visible); record.visible = visible; }
  if (!visible) return;
  const elements = mesh.matrixWorld.elements;
  let changed = false;
  for (let i = 0; i < 16; i++) if (elements[i] !== record.cache[i]) { changed = true; break; }
  if (!changed) return;
  record.cache.set(elements);
  record.batch.setMatrixAt(record.id, mesh.matrixWorld);
}

function write(root: THREE.Object3D) {
  if (dirtyAll) { root.updateMatrixWorld(true); for (const mesh of records.keys()) syncMesh(mesh); }
  else for (const mesh of dirtyMeshes) syncMesh(mesh);
  dirtyMeshes.clear();
  dirtyAll = false;
}

export function syncDraw(scene: THREE.Scene, root: THREE.Object3D) {
  if (scene !== sceneSeen || root !== rootSeen) {
    sceneSeen = scene; rootSeen = root; builtEpoch = structureEpoch;
    rebuild(scene, root);
    dirtyAll = false; dirtyMeshes.clear();
    return 'rebuild' as const;
  }
  if (structureEpoch !== builtEpoch) {
    builtEpoch = structureEpoch;
    adopt(scene, root);
    write(root);
    return 'rebuild' as const;
  }
  if (!dirtyAll && !dirtyMeshes.size) return 'same' as const;
  write(root);
  return 'edit' as const;
}

export function disposeDraw() {
  clearBatches();
  sceneSeen = null;
  rootSeen = null;
  builtEpoch = -1;
  dirtyAll = false;
  dirtyMeshes.clear();
}
