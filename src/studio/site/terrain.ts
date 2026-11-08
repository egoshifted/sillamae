import {fillGrid, sampleDelta, splitGrid, TERRAIN_STEP, type EditGrid, type TerrainChunks} from '../../engine/terrain-edit.ts';
import type {Point2} from '../../engine/types.ts';

export type TerrainMode = 'raise' | 'lower' | 'flatten' | 'smooth' | 'reset';
const LIMIT = 10; // metres of change either way; more is not detail

// The town's terrain edit over the chunks around the open area: metres per node,
// in the local frame. The brush reaches only nodes inside the editable box, where
// the ground is loaded; the rest of each chunk is kept as saved. Saved as
// centimetres per chunk (see engine/terrain-edit.ts).
export class TerrainEdit {
  readonly deltas: Float32Array;
  readonly grid: EditGrid;
  readonly source: EditGrid;
  readonly editable: {minX: number; minZ: number; maxX: number; maxZ: number};

  constructor(source: EditGrid, [ox, oz]: Point2, editable: TerrainEdit['editable'], chunks?: Record<string, number[] | null>) {
    this.source = source;
    this.grid = {...source, minX: source.minX - ox, minZ: source.minZ - oz};
    this.editable = editable;
    this.deltas = new Float32Array(source.nx * source.nz);
    this.load(chunks);
  }

  at(x: number, z: number) { return sampleDelta(this.deltas, this.grid, x, z); }

  load(chunks?: Record<string, number[] | null> | null) {
    this.deltas.set(fillGrid(this.source, Object.fromEntries(Object.entries(chunks ?? {}).filter(([, d]) => d)) as TerrainChunks));
  }

  // Every chunk the edit covers, null where it holds no change.
  saved() { return splitGrid(this.source, this.deltas); }

  // One touch of the brush. surface gives the ground height as now shown; target
  // is the height flatten levels to. Strength is metres for raise and lower, a
  // share of the way for the rest. Falloff is smooth to the brush's rim.
  dab(mode: TerrainMode, cx: number, cz: number, radius: number, strength: number, surface: (x: number, z: number) => number, target: number | null) {
    const {minX, minZ, nx, nz} = this.grid, e = this.editable;
    const i0 = Math.max(0, Math.ceil((Math.max(cx - radius, e.minX) - minX) / TERRAIN_STEP)), i1 = Math.min(nx - 1, Math.floor((Math.min(cx + radius, e.maxX) - minX) / TERRAIN_STEP));
    const j0 = Math.max(0, Math.ceil((Math.max(cz - radius, e.minZ) - minZ) / TERRAIN_STEP)), j1 = Math.min(nz - 1, Math.floor((Math.min(cz + radius, e.maxZ) - minZ) / TERRAIN_STEP));
    const next = new Map<number, number>();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = minX + i * TERRAIN_STEP, z = minZ + j * TERRAIN_STEP, d = Math.hypot(x - cx, z - cz) / radius;
      if (d >= 1) continue;
      const w = (1 - d * d) ** 2, k = j * nx + i, now = this.deltas[k];
      let change = 0;
      if (mode === 'raise' || mode === 'lower') change = (mode === 'raise' ? 1 : -1) * strength * w;
      else if (mode === 'reset') change = -now * strength * w;
      else {
        const h = surface(x, z);
        if (h === -Infinity) continue;
        if (mode === 'flatten' && target !== null) change = (target - h) * strength * w;
        if (mode === 'smooth') {
          const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => surface(x + a * TERRAIN_STEP, z + b * TERRAIN_STEP)).filter(v => v > -Infinity);
          if (around.length) change = (around.reduce((s, v) => s + v, 0) / around.length - h) * strength * w;
        }
      }
      next.set(k, Math.max(-LIMIT, Math.min(LIMIT, now + change)));
    }
    // Applied after reading, so smoothing and flattening see the ground as it was.
    for (const [k, v] of next) this.deltas[k] = v;
    return {minX: cx - radius, maxX: cx + radius, minZ: cz - radius, maxZ: cz + radius};
  }
}
