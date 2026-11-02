import * as THREE from 'three';
import {contains} from '../road-demolition.ts';
import type {RoadCut} from '../types.ts';

const PAINT = [[.57, .60, .58], [.81, .82, .75], [.89, .89, .81]].map(c => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace).toArray());

// Change survey paint, keeping the actual terrain geometry, normals and material.
export function restoreGround(position: ArrayLike<number>, colour: Float32Array, buildings: ArrayLike<number>, cuts: RoadCut[]) {
  const regions = cuts.filter(c => c.groundColour).map(c => {
    const [a, b, , d] = c.ring, ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - a[0], vz = d[1] - a[1];
    const u2 = ux * ux + uz * uz, v2 = vx * vx + vz * vz;
    const cx = (a[0] + c.ring[2][0]) / 2, cz = (a[1] + c.ring[2][1]) / 2;
    const ring = c.ring.map(([x, z]): [number, number] => [x + Math.sign(x - cx) * .75, z + Math.sign(z - cz) * .75]);
    return {c, a, ux, uz, vx, vz, u2, v2, ring, minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])), minZ: Math.min(...ring.map(p => p[1])), maxZ: Math.max(...ring.map(p => p[1]))};
  });
  if (!regions.length) return;
  for (let i = 0; i < position.length; i += 3) {
    if (buildings[i / 3]) continue;
    const x = position[i], z = position[i + 2];
    const r = regions.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && contains(r.ring, x, z));
    if (!r || !PAINT.some(p => p.every((v, k) => Math.abs(v - colour[i + k]) < .06))) continue;
    const u = Math.max(0, Math.min(1, ((x - r.a[0]) * r.ux + (z - r.a[1]) * r.uz) / r.u2));
    const v = Math.max(0, Math.min(1, ((x - r.a[0]) * r.vx + (z - r.a[1]) * r.vz) / r.v2));
    const c = r.c.groundColours ?? Array.from({length: 4}, () => r.c.groundColour!);
    for (let k = 0; k < 3; k++) colour[i + k] = (c[0][k] * (1 - u) + c[1][k] * u) * (1 - v) + (c[3][k] * (1 - u) + c[2][k] * u) * v;
  }
}
