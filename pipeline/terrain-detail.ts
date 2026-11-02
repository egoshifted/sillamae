import type {Point2} from '../src/engine/types.ts';

export const BLOCK = 8;
export interface GroundPoint {x: number; z: number; h: number | null; c: number[] | undefined}
export interface Box {minX: number; maxX: number; minZ: number; maxZ: number}

export function inside(ring: Point2[], x: number, z: number) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if ((ring[i][1] > z) !== (ring[j][1] > z) && x < (ring[j][0] - ring[i][0]) * (z - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) yes = !yes;
  return yes;
}

export function fineArea(ring: Point2[], boxes: Box[]) {
  const size = 32, grid = new Map<string, Box[]>();
  for (const b of boxes) for (let x = Math.floor(b.minX / size); x <= Math.floor(b.maxX / size); x++)
    for (let z = Math.floor(b.minZ / size); z <= Math.floor(b.maxZ / size); z++) {
      const key = x + ',' + z;
      let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(b);
    }
  return (x: number, z: number) => {
    if (inside(ring, x, z)) return true;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) <= 16) return true;
    }
    return (grid.get(Math.floor(x / size) + ',' + Math.floor(z / size)) ?? []).some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  };
}

// Every boundary vertex stays on the original metre grid, including beside a
// fine neighbour. The fan therefore has no T-junctions or interpolated seam heights.
export function perimeter(i: number, j: number, stride: number) {
  const ring: number[] = [];
  for (let k = 0; k < BLOCK; k++) ring.push(j * stride + i + k);
  for (let k = 0; k < BLOCK; k++) ring.push((j + k) * stride + i + BLOCK);
  for (let k = BLOCK; k > 0; k--) ring.push((j + BLOCK) * stride + i + k);
  for (let k = BLOCK; k > 0; k--) ring.push((j + k) * stride + i);
  return ring;
}

export function canCoarsen(points: (GroundPoint | null)[], i: number, j: number, stride: number) {
  const p = points[j * stride + i], q = points[j * stride + i + BLOCK], r = points[(j + BLOCK) * stride + i], s = points[(j + BLOCK) * stride + i + BLOCK];
  if (!p?.c || p.h === null || !q?.c || q.h === null || !r?.c || r.h === null || !s?.c || s.h === null) return false;
  if (Math.abs(p.h + s.h - q.h - r.h) > .08) return false;
  for (let y = 0; y <= BLOCK; y++) for (let x = 0; x <= BLOCK; x++) {
    const v = points[(j + y) * stride + i + x];
    if (!v?.c || v.h === null || v.c.some((c, k) => c !== p.c![k])) return false;
    const u = x / BLOCK, t = y / BLOCK, h = (p.h * (1 - u) + q.h * u) * (1 - t) + (r.h * (1 - u) + s.h * u) * t;
    if (Math.abs(v.h - h) > .08) return false;
  }
  return true;
}
