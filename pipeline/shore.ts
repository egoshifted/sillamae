import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TRIANGLE, type CityDefinition, type SceneData} from '../src/engine/types.ts';
import {squareOf} from './roads.ts';

// Metres. Survey water ends on a polygon of 10-16 m triangles, while the terrain
// model flattens every water body to a surface about 15 cm above it, bounded by
// a surveyed shoreline. So the terrain model decides where the shore runs, and
// the survey only says which low ground is water and at what level.
const HUGE = 60; // wider or longer survey triangles are the sea sheets
const REACH = 64; // water levels spread this far beyond the survey polygons, which can sit well inside the terrain model's water
const LEVEL_BLUR = 5, GROUND_BLUR = 1, EDGE_BLUR = 2, PASSES = 3;
const MAX_ABOVE_TERRAIN = 1.5, MAX_FLOOD = 2.5, MIN_SURVEYED = .15, MAX_FLOOD_OUTSIDE = .25, MIN_OPEN_SEA = 5000;
const BLOCK = 32, FLAT_SHARE = .6, FLAT_RANGE = [-.02, .4], ABOVE_FLAT = .04;
const MIN_ISLET = 1000, MIN_POND = 60, MIN_CHANNEL = 6; // square metres
export const WATER_CELL = 4;
const UNDER_LAND = 2, SEA_STRIP = 48; // water runs under the banks; the survey sheets take over offshore
const AREA_FADE = 40;
export const SHORE_RANGE = 16; // the depth tint in the water mesh's colour reaches open water here
const BANK = 4, BEACH_SLOPE = .1, BED_SLOPE = .25, BED_START = .05;
const RING = 3; // ground kept under the water, so the bank crosses the surface instead of ending at it
const WET = 1.6, WET_COLOUR = [.34, .29, .21], WET_SHARE = .55;

const smooth = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const srgb = {open: .5, shallow: .1, g: .69, b: .69}; // open water is the survey's own paint; still classified as water

function boxBlur(field: Float32Array, width: number, height: number, radius: number, passes: number) {
  let from = field.slice(), to = new Float32Array(field.length);
  const line = (start: number, step: number, count: number) => {
    let sum = 0, weight = 0;
    const read = (k: number) => from[start + k * step];
    for (let k = 0; k <= Math.min(radius, count - 1); k++) if (!Number.isNaN(read(k))) { sum += read(k); weight++; }
    for (let k = 0; k < count; k++) {
      to[start + k * step] = Number.isNaN(read(k)) || !weight ? read(k) : sum / weight;
      const enter = k + radius + 1, leave = k - radius;
      if (enter < count && !Number.isNaN(read(enter))) { sum += read(enter); weight++; }
      if (leave >= 0 && !Number.isNaN(read(leave))) { sum -= read(leave); weight--; }
    }
  };
  for (let pass = 0; pass < passes; pass++) {
    for (let j = 0; j < height; j++) line(j * width, 1, width);
    [from, to] = [to, from];
    for (let i = 0; i < width; i++) line(i, width, height);
    [from, to] = [to, from];
  }
  return from;
}

// Distance to the nearest cell outside the mask (Felzenszwalb and Huttenlocher).
function distanceInside(inside: Uint8Array, width: number, height: number) {
  const far = 1e10, squared = Float64Array.from(inside, v => v ? far : 0), size = Math.max(width, height);
  const hull = new Int32Array(size), edges = new Float64Array(size + 1), line = new Float64Array(size);
  const sweep = (start: number, step: number, count: number) => {
    let k = 0; hull[0] = 0; edges[0] = -Infinity; edges[1] = Infinity;
    for (let q = 0; q < count; q++) line[q] = squared[start + q * step];
    for (let q = 1; q < count; q++) {
      let s: number;
      for (;;) { const p = hull[k]; s = (line[q] + q * q - line[p] - p * p) / (2 * (q - p)); if (s > edges[k]) break; k--; }
      k++; hull[k] = q; edges[k] = s; edges[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < count; q++) {
      while (edges[k + 1] < q) k++;
      const p = hull[k];
      squared[start + q * step] = (q - p) * (q - p) + line[p];
    }
  };
  for (let i = 0; i < width; i++) sweep(i, width, height);
  for (let j = 0; j < height; j++) sweep(j * width, 1, width);
  return Float32Array.from(squared, Math.sqrt);
}

function regions(mask: Uint8Array, width: number, height: number, visit: (cells: number[]) => void) {
  const seen = new Uint8Array(mask.length), stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || !mask[start]) continue;
    const cells: number[] = [];
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const k = stack.pop()!, i = k % width;
      cells.push(k);
      for (const n of [i > 0 ? k - 1 : -1, i + 1 < width ? k + 1 : -1, k - width, k + width])
        if (n >= 0 && n < mask.length && mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
    visit(cells);
  }
}

// The survey's water levels on the metre grid, highest surface first.
function surveyLevels(v: Float32Array, isWater: (i: number) => boolean, minX: number, minZ: number, width: number, height: number) {
  const level = new Float32Array(width * height).fill(NaN);
  let sea = -Infinity;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (v[i + 6] || !isWater(i)) continue;
    const ax = v[i], az = v[i + 1], ah = v[i + 2], bx = v[i + 7], bz = v[i + 8], bh = v[i + 9], cx = v[i + 14], cz = v[i + 15], ch = v[i + 16];
    if (Math.max(ax, bx, cx) - Math.min(ax, bx, cx) > HUGE || Math.max(az, bz, cz) - Math.min(az, bz, cz) > HUGE) { sea = Math.max(sea, ah, bh, ch); continue; }
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-9) continue;
    const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - minX)), i1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - minX));
    const j0 = Math.max(0, Math.ceil(Math.min(az, bz, cz) - minZ)), j1 = Math.min(height - 1, Math.floor(Math.max(az, bz, cz) - minZ));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const x = minX + k, z = minZ + j, a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-6) continue;
      const h = a * ah + b * bh + c * ch, at = j * width + k;
      if (!(level[at] >= h)) level[at] = h;
    }
  }
  return {level, sea};
}

// The survey paints a few patches water-coloured that are nothing of the kind, some of
// them metres above the ground. A real surface lies at the terrain model or just over
// its channel, so anything standing higher is no water, however it is painted.
function dropStrayWater(level: Float32Array, terrain: Float32Array, width: number, height: number) {
  let stray = 0;
  regions(Uint8Array.from(level, l => Number.isNaN(l) ? 0 : 1), width, height, cells => {
    const above = cells.flatMap(k => Number.isNaN(terrain[k]) ? [] : [level[k] - terrain[k]]).sort((a, b) => a - b);
    if (above.length && above[above.length >> 1] <= MAX_ABOVE_TERRAIN) return;
    stray++;
    for (const k of cells) level[k] = NaN;
  });
  return stray;
}

// Lifts survey levels onto the flat water surfaces of the terrain model, block by
// block: where most of a block's water is that flat surface, it decides. River
// channels are modelled below the survey's level and keep it.
function liftToFlatWater(level: Float32Array, terrain: Float32Array, width: number, height: number) {
  const columns = Math.ceil(width / BLOCK), rows = Math.ceil(height / BLOCK), lift = new Float32Array(width * height);
  const blocks = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const rises: number[] = [];
    let water = 0;
    for (let j = r * BLOCK; j < Math.min(height, (r + 1) * BLOCK); j++) for (let i = c * BLOCK; i < Math.min(width, (c + 1) * BLOCK); i++) {
      const at = j * width + i, rise = terrain[at] - level[at];
      if (Number.isNaN(level[at])) continue;
      water++;
      if (rise >= FLAT_RANGE[0] && rise <= FLAT_RANGE[1]) rises.push(rise);
    }
    rises.sort((a, b) => a - b);
    // Blocks without water stay out of the blur below, or a lake's margin would sink.
    blocks[r * columns + c] = !water ? NaN : rises.length >= water * FLAT_SHARE ? Math.max(0, rises[rises.length >> 1]) : 0;
  }
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) lift[j * width + i] = blocks[Math.floor(j / BLOCK) * columns + Math.floor(i / BLOCK)];
  const eased = boxBlur(lift, width, height, BLOCK, PASSES);
  for (let k = 0; k < level.length; k++) if (!Number.isNaN(level[k])) level[k] += eased[k] + ABOVE_FLAT;
}

function spreadLevels(level: Float32Array, width: number, height: number, reach: number) {
  let frontier: number[] = [];
  for (let k = 0; k < level.length; k++) if (!Number.isNaN(level[k])) frontier.push(k);
  for (let step = 0; step < reach; step++) {
    const next = new Map<number, number[]>();
    for (const k of frontier) {
      const i = k % width;
      for (const n of [i > 0 ? k - 1 : -1, i + 1 < width ? k + 1 : -1, k - width, k + width]) {
        if (n < 0 || n >= level.length || !Number.isNaN(level[n])) continue;
        const list = next.get(n);
        if (list) list.push(level[k]); else next.set(n, [level[k]]);
      }
    }
    frontier = [];
    for (const [k, values] of next) { level[k] = values.reduce((a, b) => a + b, 0) / values.length; frontier.push(k); }
  }
}

// terrain: the terrain model alone; graded: the surface the rebuilt ground otherwise takes.
export function shoreline(v: Float32Array, isWater: (i: number) => boolean, terrain: HeightAt, graded: HeightAt, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, [[x0, z0], , [x1, z1]] = squareOf(scene, city)[0];
  const minX = x0 + ox, minZ = z0 + oz, width = Math.round(x1 - x0) + 1, height = Math.round(z1 - z0) + 1, count = width * height;
  const {level, sea} = surveyLevels(v, isWater, minX, minZ, width, height);
  const ground = new Float32Array(count);
  for (let j = 0, at = 0; j < height; j++) for (let i = 0; i < width; i++) ground[at++] = terrain(minX + i, minZ + j) ?? NaN;
  const stray = dropStrayWater(level, ground, width, height);
  const surveyed = Uint8Array.from(level, l => Number.isNaN(l) ? 0 : 1);
  liftToFlatWater(level, ground, width, height);
  const seaLevel = sea + ABOVE_FLAT;
  for (let k = 0; k < count; k++) if (Number.isNaN(level[k]) && ground[k] < seaLevel - .01) level[k] = seaLevel;
  // The rectangle overhangs the terrain model over the open sea. Holes that do not
  // reach the edge are buildings, and small ones that do are land at its corners;
  // gridGround fills both.
  const beyond = Uint8Array.from(ground, h => Number.isNaN(h) ? 1 : 0);
  regions(beyond, width, height, cells => {
    if (!cells.some(k => { const i = k % width, j = Math.floor(k / width); return i === 0 || j === 0 || i === width - 1 || j === height - 1; }) || cells.length < MIN_OPEN_SEA) for (const k of cells) beyond[k] = 0;
  });
  for (let k = 0; k < count; k++) if (beyond[k]) level[k] = seaLevel;
  spreadLevels(level, width, height, REACH);
  const water = boxBlur(level, width, height, LEVEL_BLUR, PASSES), relief = boxBlur(ground, width, height, GROUND_BLUR, PASSES);
  // Past the shore too, so a water cell on the last flooded metre has all its corners.
  spreadLevels(water, width, height, WATER_CELL * 2);

  // Land well below a nearby water level lies behind a dam or bank: only the margin
  // of a flat water surface may flood past what the survey painted.
  let bodies = 0;
  const flooded = new Uint8Array(count);
  for (let k = 0; k < count; k++) flooded[k] = beyond[k] || (Number.isNaN(relief[k]) ? surveyed[k] : relief[k] < water[k] && water[k] - relief[k] < (surveyed[k] ? MAX_FLOOD : MAX_FLOOD_OUTSIDE) ? 1 : 0);
  // Real water is mostly surveyed or open to the sea: a hollow beside a stray scrap of
  // paint, or below sea level inland, stays dry however low it lies.
  regions(flooded, width, height, cells => {
    const seeds = cells.reduce((n, k) => n + surveyed[k], 0), open = cells.some(k => beyond[k]);
    if (!open && (seeds < cells.length * MIN_SURVEYED || cells.length < MIN_POND)) { for (const k of cells) flooded[k] = 0; return; }
    bodies++;
  });
  const dry = flooded.map(f => 1 - f);
  let islets = 0;
  regions(dry, width, height, cells => {
    if (cells.length >= MIN_ISLET) return;
    if (cells.some(k => { const i = k % width, j = Math.floor(k / width); return i === 0 || j === 0 || i === width - 1 || j === height - 1; })) return;
    islets++;
    for (const k of cells) flooded[k] = 1;
  });
  // Opening: channels too thin for the water mesh's cells are paint, not water.
  const core = distanceInside(flooded, width, height).map(d => d > MIN_CHANNEL / 2 ? 1 : 0);
  const fromCore = distanceInside(Uint8Array.from(core, c => 1 - c), width, height);
  for (let k = 0; k < count; k++) if (flooded[k] && !beyond[k] && fromCore[k] > MIN_CHANNEL / 2 + 1) flooded[k] = 0;
  const toWater = distanceInside(flooded.map(f => 1 - f), width, height), toLand = distanceInside(flooded, width, height);
  const signed = new Float32Array(count);
  for (let k = 0; k < count; k++) signed[k] = Math.min(toWater[k], SEA_STRIP * 2) - Math.min(toLand[k], SEA_STRIP * 2);
  // Half the grid step, so the zero crossing falls between land and water cells.
  for (let k = 0; k < count; k++) signed[k] += signed[k] > 0 ? -.5 : .5;
  const edge = boxBlur(signed, width, height, EDGE_BLUR, PASSES);

  const bilinear = (field: Float32Array, x: number, z: number) => {
    const gx = x - minX, gz = z - minZ, i = Math.floor(gx), j = Math.floor(gz);
    if (i < 0 || j < 0 || i >= width - 1 || j >= height - 1) return null;
    const u = gx - i, t = gz - j, k = j * width + i;
    return (field[k] * (1 - u) + field[k + 1] * u) * (1 - t) + (field[k + width] * (1 - u) + field[k + width + 1] * u) * t;
  };
  const shift = new Float32Array(count);
  for (let j = 0, at = 0; j < height; j++) for (let i = 0; i < width; i++, at++) {
    const s = edge[at], level = water[at];
    if (Number.isNaN(level) || s >= BANK) continue;
    const h = graded(minX + i, minZ + j);
    if (h === null) continue;
    const shaped = s >= 0 ? level + BEACH_SLOPE * s + (Math.max(h, level + BEACH_SLOPE * s) - level - BEACH_SLOPE * s) * smooth(s / BANK) : level - BED_START + BED_SLOPE * s;
    shift[at] = shaped - h;
  }

  const triangles: number[] = [];
  const corner = (i: number, j: number) => {
    const at = j * width + i, border = Math.min(i, j, width - 1 - i, height - 1 - j);
    // Past the ground area the survey's untinted water carries on.
    const depth = Math.max(smooth(Math.min(1, Math.max(0, -edge[at] / SHORE_RANGE))), 1 - border / AREA_FADE);
    triangles.push(minX + i, minZ + j, water[at], srgb.shallow + (srgb.open - srgb.shallow) * depth, srgb.g, srgb.b, 0);
  };
  let cells = 0;
  for (let j = 0; j + WATER_CELL < height; j += WATER_CELL) for (let i = 0; i + WATER_CELL < width; i += WATER_CELL) {
    let nearest = Infinity, level = true, seaward = true;
    for (let b = 0; b <= WATER_CELL; b++) for (let a = 0; a <= WATER_CELL; a++) {
      const at = (j + b) * width + i + a;
      nearest = Math.min(nearest, edge[at]);
      level &&= !Number.isNaN(water[at]);
      seaward &&= Math.abs(water[at] - seaLevel) < .02 && edge[at] < -SEA_STRIP;
    }
    if (nearest > UNDER_LAND || !level || seaward) continue;
    corner(i, j); corner(i + WATER_CELL, j + WATER_CELL); corner(i + WATER_CELL, j);
    corner(i, j); corner(i, j + WATER_CELL); corner(i + WATER_CELL, j + WATER_CELL);
    cells++;
  }

  return {
    triangles,
    report: `shoreline: ${cells} water cells of ${WATER_CELL} m, ${bodies} water bodies, ${islets} survey islets flooded, ${stray} stray water patches ignored, water level ${seaLevel.toFixed(2)} m at sea`,
    heightAt: ((x, z) => {
      const h = graded(x, z), by = bilinear(shift, x, z);
      return h === null || by === null ? h : h + by;
    }) as HeightAt,
    // Rebuilt ground stops a little way under the water.
    keepsGround: (x: number, z: number) => (bilinear(edge, x, z) ?? 0) > -RING || Number.isNaN(bilinear(water, x, z)),
    distance: (x: number, z: number) => Math.abs(bilinear(edge, x, z) ?? Infinity),
    onLand: (x: number, z: number) => (bilinear(edge, x, z) ?? 1) > 0,
    wetten(x: number, z: number, colour: number[]) {
      const s = bilinear(edge, x, z);
      if (s === null || s >= WET) return colour;
      const wet = WET_SHARE * (1 - smooth(Math.max(0, s) / WET));
      return colour.map((c, k) => c + (WET_COLOUR[k] - c) * wet);
    },
  };
}

export type Shoreline = ReturnType<typeof shoreline>;
