import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Materials shared by every asset, so a street of props costs one material per
// finish. Never dispose them from an asset. Colours are sRGB, matched to the
// town's survey and refined buildings rather than to catalogue photos.
const cache = new Map<string, THREE.MeshStandardMaterial>();
const material = (key: string, color: string, roughness: number, metalness = 0) => {
  let m = cache.get(key);
  if (!m) cache.set(key, m = new THREE.MeshStandardMaterial({color, roughness, metalness}));
  return m;
};

export const palette = {
  concrete: () => material('concrete', '#a9a59b', .95),
  darkConcrete: () => material('dark-concrete', '#85827a', .95),
  wood: () => material('wood', '#8a6a48', .85),
  darkMetal: () => material('dark-metal', '#3d4240', .6, .4),
  galvanised: () => material('galvanised', '#9ea3a2', .45, .6),
  lamp: () => material('lamp', '#f3efdc', .3),
  paint: (color: string) => material('paint-' + color, color, .6, .2),
};

export type Part = [THREE.BufferGeometry, THREE.Material];

// Merges parts per material, one mesh each; the geometries passed in are consumed.
export function assemble(parts: Part[], name: string) {
  const root = new THREE.Group();
  root.name = name;
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const [geometry, m] of parts) {
    const list = byMaterial.get(m) ?? [];
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    list.push(flat);
    byMaterial.set(m, list);
  }
  for (const [m, list] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    for (const g of list) g.dispose();
  }
  return root;
}

export const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
export function rod(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, radius: number, segments = 8) {
  const a = new THREE.Vector3(...from), direction = new THREE.Vector3(...to).sub(a), length = direction.length();
  return new THREE.CylinderGeometry(radius, radius, length, segments)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
    .translate(a.x + direction.x * length / 2, a.y + direction.y * length / 2, a.z + direction.z * length / 2);
}
export const cylinder =(top: number, bottom: number, h: number, segments: number, x = 0, y = h / 2, z = 0) => new THREE.CylinderGeometry(top, bottom, h, segments).translate(x, y, z);
