import {TRIANGLE} from '../src/engine/types.ts';

// The survey paints carriageways, footways and road markings in these flat colours.
export const ROAD = [.57, .60, .58], FOOTWAY = [.81, .82, .75], MARKING = [.89, .89, .81];
const CELL = 10; // metres

// Ground triangles of the raw survey at source x/z, highest first.
export function surveyLayers(v: Float32Array) {
  const grid = new Map<string, number[]>();
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (v[i + 6]) continue;
    const xs = [v[i], v[i + 7], v[i + 14]], zs = [v[i + 1], v[i + 8], v[i + 15]];
    const x0 = Math.floor(Math.min(...xs) / CELL), x1 = Math.floor(Math.max(...xs) / CELL), z0 = Math.floor(Math.min(...zs) / CELL), z1 = Math.floor(Math.max(...zs) / CELL);
    if (x1 - x0 > 6 || z1 - z0 > 6) continue; // sea-level plane
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = x + ',' + z;
      let list = grid.get(key);
      if (!list) grid.set(key, list = []);
      list.push(i);
    }
  }
  const layers = (x: number, z: number) => {
    const found: {i: number; h: number}[] = [];
    for (const i of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const ax = v[i], az = v[i + 1], bx = v[i + 7], bz = v[i + 8], cx = v[i + 14], cz = v[i + 15];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-5) continue;
      found.push({i, h: a * v[i + 2] + b * v[i + 9] + c * v[i + 16]});
    }
    // Stable, so equal heights keep index order as the first-highest search did.
    return found.sort((p, q) => q.h - p.h);
  };
  const is = (i: number, colour: number[]) => colour.every((value, k) => Math.abs(v[i + 3 + k] - value) < .015);
  return {layers, is};
}
