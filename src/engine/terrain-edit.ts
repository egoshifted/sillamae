import type {HeightAt} from './survey/drape.ts';

// Terrain edits from the studio: height changes on one 1 m lattice for the whole
// town, laid on the terrain model before roads are graded and the survey ground
// is draped, so everything standing on the ground follows. Shared by the data
// build and the studio. Saved in square chunks so an edit touches few files; a
// chunk is an index of nodes, not an area of work, and edits run across them freely.
export const TERRAIN_STEP = 1; // metres
export const CHUNK = 64; // nodes along each side of a chunk
const SPAN = CHUNK * TERRAIN_STEP;

// Centimetres per node, rows along z; a chunk at cx/cz holds nodes from cx*SPAN, cz*SPAN.
export type TerrainChunks = Record<string, number[]>;
export const CHUNK_KEY = /^-?\d+_-?\d+$/;

export interface EditGrid {
  minX: number;
  minZ: number;
  nx: number;
  nz: number;
}

// Whole chunks covering the box, in source x/z.
export function chunkGrid(minX: number, minZ: number, maxX: number, maxZ: number) {
  const c0 = Math.floor(minX / SPAN), c1 = Math.floor(maxX / SPAN), r0 = Math.floor(minZ / SPAN), r1 = Math.floor(maxZ / SPAN);
  const keys: string[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) keys.push(`${c}_${r}`);
  return {grid: {minX: c0 * SPAN, minZ: r0 * SPAN, nx: (c1 - c0 + 1) * CHUNK, nz: (r1 - r0 + 1) * CHUNK} as EditGrid, keys};
}

const chunkOf = (key: string) => key.split('_').map(Number) as [number, number];

// Metres per node over the grid, from the chunks it covers.
export function fillGrid(grid: EditGrid, chunks: TerrainChunks) {
  const values = new Float32Array(grid.nx * grid.nz);
  for (const [key, deltas] of Object.entries(chunks)) {
    const [c, r] = chunkOf(key), i0 = c * CHUNK - grid.minX / TERRAIN_STEP, j0 = r * CHUNK - grid.minZ / TERRAIN_STEP;
    if (i0 < 0 || j0 < 0 || i0 + CHUNK > grid.nx || j0 + CHUNK > grid.nz) continue;
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) values[(j0 + j) * grid.nx + i0 + i] = deltas[j * CHUNK + i] / 100;
  }
  return values;
}

// The grid's chunks as saved, null for a chunk with no change left.
export function splitGrid(grid: EditGrid, values: ArrayLike<number>) {
  const out: Record<string, number[] | null> = {};
  for (let j0 = 0; j0 < grid.nz; j0 += CHUNK) for (let i0 = 0; i0 < grid.nx; i0 += CHUNK) {
    const cm: number[] = [];
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) cm.push(Math.round(values[(j0 + j) * grid.nx + i0 + i] * 100));
    out[`${(grid.minX / TERRAIN_STEP + i0) / CHUNK}_${(grid.minZ / TERRAIN_STEP + j0) / CHUNK}`] = cm.some(v => v !== 0) ? cm : null;
  }
  return out;
}

// The change at x/z, bilinear between nodes, zero off the grid.
export function sampleDelta(values: ArrayLike<number>, grid: EditGrid, x: number, z: number) {
  const {minX, minZ, nx, nz} = grid, fx = (x - minX) / TERRAIN_STEP, fz = (z - minZ) / TERRAIN_STEP;
  if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return 0;
  const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), tx = fx - i, tz = fz - j, at = (a: number, b: number) => values[b * nx + a];
  return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
}

export function withTerrainEdits(heightAt: HeightAt, chunks: TerrainChunks): HeightAt {
  const keys = Object.keys(chunks);
  if (!keys.length) return heightAt;
  const cs = keys.map(chunkOf), {grid} = chunkGrid(Math.min(...cs.map(c => c[0])) * SPAN, Math.min(...cs.map(c => c[1])) * SPAN, Math.max(...cs.map(c => c[0])) * SPAN, Math.max(...cs.map(c => c[1])) * SPAN);
  const values = fillGrid(grid, chunks);
  return (x, z) => {
    const h = heightAt(x, z);
    return h === null ? null : h + sampleDelta(values, grid, x, z);
  };
}
