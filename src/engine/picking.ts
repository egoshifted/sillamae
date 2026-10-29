import * as THREE from 'three';
import type {Building, WorldFrame} from './types.ts';

interface Prism {
  building: Building;
  outline: [number, number][];
  bottom: number;
  top: number;
  box: THREE.Box3;
}

export function buildingPrisms(buildings: Building[], frame: WorldFrame): Prism[] {
  const [ox, oz] = frame.origin;
  return buildings.map(b => {
    const outline = b.g.map(([x, z]): [number, number] => [x - ox, z - oz]);
    const [bottom, top] = b.heightRange ?? [-frame.base, b.h];
    const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
    const box = new THREE.Box3(new THREE.Vector3(Math.min(...xs), bottom, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), top, Math.max(...zs)));
    return {building: b, outline, bottom, top, box};
  });
}

export function pickPrism(ray: THREE.Ray, prisms: Prism[]) {
  let nearest: Building | null = null, distance = Infinity;
  for (const p of prisms) {
    if (!ray.intersectsBox(p.box)) continue;
    const t = enterPrism(ray, p);
    if (t < distance) { distance = t; nearest = p.building; }
  }
  return nearest;
}

function enterPrism({origin: o, direction: d}: THREE.Ray, p: Prism) {
  let best = Infinity;
  if (d.y !== 0) {
    const t = (p.top - o.y) / d.y;
    if (t > 0 && inside(p.outline, o.x + t * d.x, o.z + t * d.z)) best = t;
  }
  const cross = (ux: number, uz: number, vx: number, vz: number) => ux * vz - uz * vx;
  for (let i = 0; i < p.outline.length; i++) {
    const a = p.outline[i], b = p.outline[(i + 1) % p.outline.length], ex = b[0] - a[0], ez = b[1] - a[1];
    const denom = cross(d.x, d.z, ex, ez);
    if (Math.abs(denom) < 1e-12) continue;
    const wx = a[0] - o.x, wz = a[1] - o.z, t = cross(wx, wz, ex, ez) / denom, s = cross(wx, wz, d.x, d.z) / denom;
    if (t <= 0 || t >= best || s < 0 || s > 1) continue;
    const y = o.y + t * d.y;
    if (y >= p.bottom && y <= p.top) best = t;
  }
  return best;
}

function inside(outline: [number, number][], x: number, z: number) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) hit = !hit;
  }
  return hit;
}
