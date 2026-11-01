import {gridSize, sampleDelta, TERRAIN_STEP} from '../../engine/terrain-edit.ts';

export type TerrainMode = 'raise' | 'lower' | 'flatten' | 'smooth' | 'reset';
const LIMIT = 10; // metres of change either way; more is not detail

// The square's terrain edit while it is being shaped: metres on the shared grid,
// in the local frame. Saved as centimetres (see engine/terrain-edit.ts).
export class TerrainEdit {
  readonly deltas: Float32Array;
  readonly n: number;
  readonly minX: number;
  readonly minZ: number;
  readonly size: number;

  constructor(minX: number, minZ: number, size: number, saved?: number[]) {
    this.minX = minX;
    this.minZ = minZ;
    this.size = size;
    this.n = gridSize(size);
    this.deltas = new Float32Array(this.n * this.n);
    this.load(saved);
  }

  at(x: number, z: number) { return sampleDelta(this.deltas, this.size, this.minX, this.minZ, x, z); }

  load(saved?: number[] | null) {
    this.deltas.fill(0);
    if (saved?.length === this.deltas.length) saved.forEach((v, i) => { this.deltas[i] = v / 100; });
  }

  saved() {
    const cm = Array.from(this.deltas, v => Math.round(v * 100));
    return cm.some(v => v !== 0) ? cm : null;
  }

  // One touch of the brush. surface gives the ground height as now shown; target
  // is the height flatten levels to. Strength is metres for raise and lower, a
  // share of the way for the rest. Falloff is smooth to the brush's rim.
  dab(mode: TerrainMode, cx: number, cz: number, radius: number, strength: number, surface: (x: number, z: number) => number, target: number | null) {
    const i0 = Math.max(0, Math.ceil((cx - radius - this.minX) / TERRAIN_STEP)), i1 = Math.min(this.n - 1, Math.floor((cx + radius - this.minX) / TERRAIN_STEP));
    const j0 = Math.max(0, Math.ceil((cz - radius - this.minZ) / TERRAIN_STEP)), j1 = Math.min(this.n - 1, Math.floor((cz + radius - this.minZ) / TERRAIN_STEP));
    const next = new Map<number, number>();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.minX + i * TERRAIN_STEP, z = this.minZ + j * TERRAIN_STEP, d = Math.hypot(x - cx, z - cz) / radius;
      if (d >= 1) continue;
      const w = (1 - d * d) ** 2, k = j * this.n + i, now = this.deltas[k];
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
