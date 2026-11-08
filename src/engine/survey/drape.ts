import type {Bucket, Site} from './classify.ts';
import {triangleGrid} from './triangle-grid.ts';
import {TRIANGLE, type SceneData} from '../types.ts';

// Absolute height at source x/z, or null where there is no terrain model.
export type HeightAt = (x: number, z: number) => number | null;

const TOLERANCE = .15; // metres
const MIN_EDGE = 1;
const MAX_DEPTH = 6;
const KEEP_MARGIN = 5;
const HUGE = 200;
const LAYER_GAP = .02, MAX_LAYER = 7, UNDERWATER = .02;

type Corner = {x: number; z: number; old: number; h: number; r: number; g: number; b: number};

// Open addressing over flat arrays: these take tens of millions of lookups, where
// nested Maps cost more than the terrain queries they cache.
class PointMap {
  #bits = 20;
  #xs = new Float64Array(1 << this.#bits);
  #zs = new Float64Array(1 << this.#bits);
  #values = new Float64Array(1 << this.#bits);
  #used = new Uint8Array(1 << this.#bits);
  #size = 0;
  #slot(x: number, z: number) {
    const mask = this.#used.length - 1, xs = this.#xs, zs = this.#zs, used = this.#used;
    // The high bits: scaled grid coordinates end in zeros, which multiplying keeps in the low ones.
    let i = (Math.imul(x * 64 | 0, 0x9e3779b1) + Math.imul(z * 64 | 0, 0x85ebca6b)) >>> (32 - this.#bits);
    while (used[i] && (xs[i] !== x || zs[i] !== z)) i = (i + 1) & mask;
    return i;
  }
  get(x: number, z: number) {
    const i = this.#slot(x, z);
    return this.#used[i] ? this.#values[i] : undefined;
  }
  has(x: number, z: number) { return this.#used[this.#slot(x, z)] === 1; }
  set(x: number, z: number, value: number) {
    const i = this.#slot(x, z);
    this.#values[i] = value;
    if (this.#used[i]) return;
    this.#used[i] = 1;
    this.#xs[i] = x;
    this.#zs[i] = z;
    if (++this.#size * 2 > this.#used.length) this.#grow();
  }
  #grow() {
    const [xs, zs, values, used] = [this.#xs, this.#zs, this.#values, this.#used];
    this.#bits++;
    const size = 1 << this.#bits;
    this.#xs = new Float64Array(size);
    this.#zs = new Float64Array(size);
    this.#values = new Float64Array(size);
    this.#used = new Uint8Array(size);
    for (let old = 0; old < used.length; old++) {
      if (!used[old]) continue;
      const i = this.#slot(xs[old], zs[old]);
      this.#xs[i] = xs[old];
      this.#zs[i] = zs[old];
      this.#values[i] = values[old];
      this.#used[i] = 1;
    }
  }
}

// The survey ground is stacked: road, lawn and pitch polygons lie 5-35 cm above
// a base surface. Every ground vertex therefore moves by the same correction,
// finer terrain minus the lowest old surface at its x/z, which keeps the gaps.
// Edges along which that correction bends by more than TOLERANCE are halved.
// The decision depends on the edge alone, so both triangles sharing it split
// it alike and no cracks open. Children stay in their parent's bucket and keep
// its surface. Water, ground under water, and refined sites keep their heights.
export function drapeGround(buckets: Bucket[], heightAt: HeightAt, sites: Site[]) {
  const surfaces = surfaceIndex(buckets, false), base = (x: number, z: number) => surfaces(x, z)[0] ?? null;
  const waters = surfaceIndex(buckets, true), sea = seaLevel(buckets);
  const kept = new PointMap();
  for (const b of buckets) for (let i = 0; i < b.source.length; i += 3) {
    const x = b.source[i], z = b.source[i + 1];
    if (b.kind === 'water' || sites.some(s => x >= s.minX - KEEP_MARGIN && x <= s.maxX + KEEP_MARGIN && z >= s.minZ - KEEP_MARGIN && z <= s.maxZ + KEEP_MARGIN)) kept.set(x, z, 1);
  }
  const corrections = new PointMap(); // NaN: no correction applies here
  const correction = (x: number, z: number) => {
    const known = corrections.get(x, z);
    if (known !== undefined) return Number.isNaN(known) ? null : known;
    const fine = kept.has(x, z) ? null : heightAt(x, z), old = fine === null ? null : base(x, z);
    const c = fine === null || old === null ? null : fine - old;
    corrections.set(x, z, c ?? NaN);
    return c;
  };
  const waterTops = new PointMap();
  const underwater = (x: number, z: number, old: number) => {
    let top = waterTops.get(x, z);
    if (top === undefined) waterTops.set(x, z, top = Math.max(sea, ...waters(x, z)));
    return old < top + UNDERWATER;
  };
  const splits = (p: Corner, q: Corner) => {
    const [a, b] = p.x < q.x || (p.x === q.x && p.z < q.z) ? [p, q] : [q, p];
    if (underwater(a.x, a.z, a.old) || underwater(b.x, b.z, b.old)) return false;
    const ca = correction(a.x, a.z), cb = correction(b.x, b.z);
    if (ca === null || cb === null || Math.hypot(b.x - a.x, b.z - a.z) <= MIN_EDGE) return false;
    for (const t of [.25, .5, .75]) {
      const c = correction(Math.fround(a.x + (b.x - a.x) * t), Math.fround(a.z + (b.z - a.z) * t));
      if (c !== null && Math.abs(c - (ca + (cb - ca) * t)) > TOLERANCE) return true;
    }
    return false;
  };
  const corner = (x: number, z: number, old: number, r: number, g: number, b: number): Corner =>
    ({x, z, old, h: underwater(x, z, old) ? old : old + (correction(x, z) ?? 0), r, g, b});
  const midpoint = (p: Corner, q: Corner) =>
    corner(Math.fround((p.x + q.x) / 2), Math.fround((p.z + q.z) / 2), (p.old + q.old) / 2, (p.r + q.r) / 2, (p.g + q.g) / 2, (p.b + q.b) / 2);

  let before = 0, after = 0;
  for (const bucket of buckets) {
    const source: number[] = [], colour: number[] = [], building: number[] = [], layer: number[] = [];
    let level = 0;
    const emit = (corners: Corner[], pick: number) => {
      for (const c of corners) { source.push(c.x, c.z, c.h); colour.push(c.r, c.g, c.b); }
      building.push(pick);
      layer.push(level);
    };
    const refine = (a: Corner, b: Corner, c: Corner, depth: number) => {
      const ab = depth < MAX_DEPTH && splits(a, b), bc = depth < MAX_DEPTH && splits(b, c), ca = depth < MAX_DEPTH && splits(c, a);
      if (!ab && !bc && !ca) return emit([a, b, c], 0);
      // Rotate so the split edges come first; winding is unchanged.
      if (!ab && bc) return refine(b, c, a, depth);
      if (!ab && !bc) return refine(c, a, b, depth);
      if (!bc && ca) return refine(c, a, b, depth);
      const m = midpoint(a, b);
      if (!bc && !ca) { refine(a, m, c, depth + 1); refine(m, b, c, depth + 1); return; }
      const n = midpoint(b, c);
      if (!ca) { refine(a, m, c, depth + 1); refine(m, n, c, depth + 1); refine(m, b, n, depth + 1); return; }
      const o = midpoint(c, a);
      refine(a, m, o, depth + 1); refine(m, b, n, depth + 1); refine(o, n, c, depth + 1); refine(m, n, o, depth + 1);
    };
    for (let t = 0; t < bucket.building.length; t++) {
      const pick = bucket.building[t];
      const corners = [0, 1, 2].map(j => {
        const i = (t * 3 + j) * 3, s = bucket.source, c = bucket.c;
        return pick ? {x: s[i], z: s[i + 1], old: s[i + 2], h: s[i + 2], r: c[i], g: c[i + 1], b: c[i + 2]} : corner(s[i], s[i + 1], s[i + 2], c[i], c[i + 1], c[i + 2]);
      });
      before++;
      level = 0;
      if (pick || bucket.kind === 'water') { emit(corners, pick); after++; continue; }
      // Layers can still touch between vertices; the shader draws higher ones in front.
      const cx = (corners[0].x + corners[1].x + corners[2].x) / 3, cz = (corners[0].z + corners[1].z + corners[2].z) / 3;
      const own = (corners[0].old + corners[1].old + corners[2].old) / 3;
      const moved = corners.some(c => c.h !== c.old);
      level = moved ? Math.min(MAX_LAYER, surfaces(cx, cz).filter(h => h < own - LAYER_GAP).length) : 0;
      const start = building.length;
      refine(corners[0], corners[1], corners[2], 0);
      after += building.length - start;
    }
    Object.assign(bucket, {source, c: colour, building, layer});
  }
  return {before, after};
}

// The kilometre-wide horizon triangles are one sea-level water plane under
// the whole town.
function seaLevel(buckets: Bucket[]) {
  let level = -Infinity;
  for (const b of buckets) for (let t = 0; t < b.building.length; t++) {
    const s = b.source.slice(t * 9, t * 9 + 9);
    if (b.kind === 'water' && Math.max(s[0], s[3], s[6]) - Math.min(s[0], s[3], s[6]) > HUGE) level = Math.max(level, s[2], s[5], s[8]);
  }
  return level;
}

// Heights of the survey ground (or water) surfaces at x/z, lowest first, from
// the original buckets, horizon triangles left out.
function surfaceIndex(buckets: Bucket[], water: boolean) {
  const grid = triangleGrid(buckets, (b, t) => !b.building[t] && (b.kind === 'water') === water, HUGE);
  return (x: number, z: number) => {
    const heights: number[] = [];
    grid.over(x, z, height => heights.push(height));
    return heights.sort((a, b) => a - b);
  };
}

// Survey buildings whose lowest wall vertices would hang above the finer ground
// get those vertices lowered to it.
export function settleBuildings(v: Float32Array, data: SceneData, heightAt: HeightAt) {
  const lowest = new Map<number, number>();
  for (let i = 0; i < v.length; i += TRIANGLE) {
    const pick = v[i + 6];
    if (pick) lowest.set(pick, Math.min(lowest.get(pick) ?? Infinity, v[i + 2], v[i + 9], v[i + 16]));
  }
  const target = new Map<number, number>();
  for (const b of data.buildings) {
    const ground: number[] = [];
    b.g.forEach((p, i) => {
      const q = b.g[(i + 1) % b.g.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])));
      for (let s = 0; s < steps; s++) {
        const h = heightAt(p[0] + (q[0] - p[0]) * s / steps, p[1] + (q[1] - p[1]) * s / steps);
        if (h !== null) ground.push(h);
      }
    });
    const low = lowest.get(b.pick);
    if (low !== undefined && ground.length && low > Math.min(...ground) - .05) target.set(b.pick, Math.min(...ground) - .1);
  }
  for (let i = 0; i < v.length; i += TRIANGLE) {
    const to = target.get(v[i + 6]);
    if (to === undefined) continue;
    const low = lowest.get(v[i + 6])!;
    for (const k of [2, 9, 16]) if (v[i + k] < low + .05) v[i + k] = to;
  }
  return target.size;
}
