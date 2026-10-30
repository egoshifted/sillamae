import * as THREE from 'three';

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

// Batching owns the direct children's geometry, but keeps their materials and draw order.
export function batchDetailStudy<T extends THREE.Group>(root: T): T {
  const old = [...root.children];
  for (const child of old) {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial) || child.children.length || !child.visible)
      throw Error('Batching requires visible, childless standard-material meshes');
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
      const a = child.geometry.getAttribute(name);
      if (!a || a.itemSize !== size || a.normalized || a.isInterleavedBufferAttribute) throw Error('Unsupported batch attribute: ' + name);
    }
    if (Object.keys(child.geometry.attributes).some(name => !['position', 'normal', 'uv'].includes(name)) || child.geometry.drawRange.start !== 0 || child.geometry.drawRange.count !== Infinity)
      throw Error('Batching would discard geometry attributes or draw range');
  }
  root.updateMatrixWorld(true);
  const groups = new Map<string, {material: THREE.MeshStandardMaterial; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[]}>();
  const combined: Mesh[] = [], allocated: THREE.BufferGeometry[] = [];
  try {
    for (const mesh of old as Mesh[]) {
      const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow].join(':');
      if (!groups.has(key)) groups.set(key, {material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, parts: []});
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      allocated.push(geometry);
      geometry.applyMatrix4(mesh.matrix);
      groups.get(key)!.parts.push(geometry);
    }
    for (const group of groups.values()) {
      const geometry = new THREE.BufferGeometry();
      allocated.push(geometry);
      for (const name of ['position', 'normal', 'uv']) {
        const values = new Float32Array(group.parts.reduce((n, p) => n + p.getAttribute(name).array.length, 0));
        let offset = 0;
        for (const p of group.parts) { const a = p.getAttribute(name); values.set(a.array, offset); offset += a.array.length; }
        geometry.setAttribute(name, new THREE.BufferAttribute(values, name === 'uv' ? 2 : 3));
      }
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, group.material);
      mesh.name = 'detail-batch'; mesh.castShadow = group.cast; mesh.receiveShadow = group.receive;
      combined.push(mesh);
    }
  } catch (error) {
    allocated.forEach(g => g.dispose());
    throw error;
  }
  for (const group of groups.values()) group.parts.forEach(g => g.dispose());
  for (const mesh of old as Mesh[]) { root.remove(mesh); mesh.geometry.dispose(); }
  root.add(...combined);
  root.userData.batchStats = {sourceMeshes: old.length, batches: combined.length};
  return root;
}
