import type {GroundTriangle} from '../types.ts';

const CELL = 4;
const indexes = new WeakMap<GroundTriangle[], (x: number, z: number) => GroundTriangle[]>();

// Site triangles are immutable; lowered/edited ground must use a new array.
// The padding covers the largest barycentric tolerance used by model sampling.
export function groundCandidates(ground: GroundTriangle[], x: number, z: number) {
  let query = indexes.get(ground);
  if (!query) {
    const grid = new Map<number, number[]>(), broad: number[] = [];
    const key = (x: number, z: number) => x * 65536 + z;
    ground.forEach((t, index) => {
      const x0 = Math.min(t[0], t[3], t[6]), x1 = Math.max(t[0], t[3], t[6]), z0 = Math.min(t[1], t[4], t[7]), z1 = Math.max(t[1], t[4], t[7]);
      if (x1 - x0 > 64 || z1 - z0 > 64) { broad.push(index); return; }
      const pad = Math.max(x1 - x0, z1 - z0) * .00002 + .00001;
      for (let cx = Math.floor((x0 - pad) / CELL); cx <= Math.floor((x1 + pad) / CELL); cx++)
        for (let cz = Math.floor((z0 - pad) / CELL); cz <= Math.floor((z1 + pad) / CELL); cz++) {
          const k = key(cx, cz); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(index);
        }
    });
    query = (x, z) => [...grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [], ...broad].sort((a, b) => a - b).map(i => ground[i]);
    indexes.set(ground, query);
  }
  return query(x, z);
}
