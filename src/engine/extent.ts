import * as THREE from 'three';
import type {Polygon} from './types.ts';

// Inward edge lines (nx, nz, c): nx x + nz z + c is the distance inside that edge.
export function extentEdges(extent: Polygon) {
  let area = 0;
  extent.forEach(([x, z], i) => { const [x2, z2] = extent[(i + 1) % extent.length]; area += x * z2 - x2 * z; });
  return extent.map(([x, z], i) => {
    const [x2, z2] = extent[(i + 1) % extent.length], length = Math.hypot(x2 - x, z2 - z), s = Math.sign(area) / length;
    const nx = -(z2 - z) * s, nz = (x2 - x) * s;
    return new THREE.Vector3(nx, nz, -(nx * x + nz * z));
  });
}

export function clippingPlanes(extent: Polygon) {
  return extentEdges(extent).map(e => new THREE.Plane(new THREE.Vector3(e.x, 0, e.y), e.z));
}

export function insideExtent(edges: THREE.Vector3[], x: number, z: number) {
  return edges.every(e => e.x * x + e.y * z + e.z >= 0);
}
