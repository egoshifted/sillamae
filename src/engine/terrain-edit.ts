import type {HeightAt} from './survey/drape.ts';
import type {PlacementSite} from './types.ts';

// Terrain edits from the studio: a grid of height changes over a square, laid on
// the terrain model before roads are graded and the survey ground is draped, so
// everything standing on the ground follows. Shared by the data build and the studio.
export const TERRAIN_STEP = 1; // metres
// Metres inside the square's edge over which an edit fades to nothing, so an edit
// never leaves a step against the terrain outside.
export const TERRAIN_TAPER = 5;

export const gridSize = (size: number) => Math.round(size / TERRAIN_STEP) + 1;

// The change at x/z in a grid whose low corner is at minX/minZ, in the grid's own
// units (centimetres when saved), faded towards the square's edges.
export function sampleDelta(deltas: ArrayLike<number>, size: number, minX: number, minZ: number, x: number, z: number) {
  const n = gridSize(size), fx = (x - minX) / TERRAIN_STEP, fz = (z - minZ) / TERRAIN_STEP;
  if (fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1) return 0;
  const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fz)), tx = fx - i, tz = fz - j;
  const at = (a: number, b: number) => deltas[b * n + a];
  const value = (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
  const edge = Math.min(x - minX, z - minZ, minX + size - x, minZ + size - z);
  return value * Math.min(1, Math.max(0, edge / TERRAIN_TAPER));
}

// Metres of change at source x/z from one site's saved edit.
export function siteDelta(site: PlacementSite, x: number, z: number) {
  if (!site.terrain) return 0;
  const {centre: [cx, cz], size} = site.square;
  return sampleDelta(site.terrain.deltas, size, cx - size / 2, cz - size / 2, x, z) / 100;
}

export function withTerrainEdits(heightAt: HeightAt, sites: PlacementSite[]): HeightAt {
  const edited = sites.filter(s => s.terrain);
  if (!edited.length) return heightAt;
  return (x, z) => {
    const h = heightAt(x, z);
    return h === null ? null : edited.reduce((sum, s) => sum + siteDelta(s, x, z), h);
  };
}
