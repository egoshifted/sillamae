import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TRIANGLE, type CityDefinition, type Point2, type SceneData} from '../src/engine/types.ts';
import {pushTriangle, splitTriangle, squareOf} from './roads.ts';
import {surveyLayers} from './survey-colour.ts';

// Metres. Refined models stand on the survey's heights near their walls (NEAR)
// and the terrain model takes over by FAR, where the kept survey ground ended.
const NEAR = 5, FAR = 20, SAMPLE_BAND = [2, 8], SAMPLE_STEP = 2;
// Metres: grid spacing of the rebuilt ground, the terrain model's own; a stack
// of survey layers is never thicker than STACK; wider triangles are the sea plane.
const GRID = 1, STACK = 1, HUGE = 60;
// Metres: buildings sample their ground OUTSIDE their walls every SEAT_STEP.
const OUTSIDE = 1, SEAT_STEP = 1;
// Grid steps height and colour spread into ground left bare, enough to cross the widest building.
const FILL_PASSES = 60;

type Box = {minX: number; maxX: number; minZ: number; maxZ: number};
const distance = (b: Box, x: number, z: number) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
const smoothstep = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

// The survey ground around a refined site used to keep its surveyed height in a
// rectangle 20 m beyond the building, leaving straight seams where it met the
// draped ground. Instead the terrain model is shifted down by the site's typical
// survey offset near the building and eases back to itself by FAR, keeping the
// terrain model's shape (the rise to a wall) all the way in.
export function blendSites(heightAt: HeightAt, vertices: Float32Array, scene: SceneData, city: CityDefinition): HeightAt {
  const {layers} = surveyLayers(vertices);
  const sites = city.overrides.filter(o => !o.seatsOnGround).map(o => {
    const g = scene.buildings.find(b => b.id === o.id)!.g, xs = g.map(p => p[0]), zs = g.map(p => p[1]);
    const box = {minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)}, offsets: number[] = [];
    for (let d = SAMPLE_BAND[0]; d <= SAMPLE_BAND[1]; d += SAMPLE_STEP)
      for (let x = box.minX - d; x <= box.maxX + d; x += SAMPLE_STEP) for (let z = box.minZ - d; z <= box.maxZ + d; z += SAMPLE_STEP) {
        if (Math.abs(distance(box, x, z) - d) > SAMPLE_STEP / 2) continue;
        const low = layers(x, z).at(-1)?.h, h = heightAt(x, z);
        if (low !== undefined && h !== null) offsets.push(h - low);
      }
    return {box, offset: median(offsets)};
  });
  return (x, z) => {
    const h = heightAt(x, z);
    if (h === null) return null;
    let weight = 0, offset = 0;
    for (const s of sites) {
      const w = 1 - smoothstep((distance(s.box, x, z) - NEAR) / (FAR - NEAR));
      if (w > weight) { weight = w; offset = s.offset; }
    }
    return h - weight * offset;
  };
}

// Survey buildings stood on the survey's ground; the rebuilt ground follows the
// terrain model, up to a metre away from it, and left them sunk or floating.
// Each building in the road area moves by how far its ground moved: the median,
// just outside its walls, of the new ground minus the survey's lowest ground.
// survey is the unmodified survey, sampled for its ground; v gets the moves.
// Refined models place themselves and are left alone.
export function seatBuildings(v: Float32Array, survey: Float32Array, heightAt: HeightAt, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, {layers} = surveyLayers(survey), [[minX, minZ], , [maxX, maxZ]] = squareOf(scene, city)[0];
  const refined = new Set(city.overrides.map(o => o.id)), shift = new Map<number, number>();
  for (const b of scene.buildings) {
    const g = b.g, cx = g.reduce((s, p) => s + p[0], 0) / g.length - ox, cz = g.reduce((s, p) => s + p[1], 0) / g.length - oz;
    if (refined.has(b.id) || cx < minX || cx > maxX || cz < minZ || cz > maxZ) continue;
    // Outward is to the right of each edge on an anticlockwise outline in (x, z), to the left on a clockwise one.
    const turn = Math.sign(g.reduce((s, p, i) => { const q = g[(i + 1) % g.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)), moves: number[] = [];
    g.forEach((p, i) => {
      const q = g[(i + 1) % g.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (!length) return;
      const nx = (q[1] - p[1]) / length * turn * OUTSIDE, nz = -(q[0] - p[0]) / length * turn * OUTSIDE;
      for (let t = .5; t < length; t += SEAT_STEP) {
        const x = p[0] + (q[0] - p[0]) * t / length + nx, z = p[1] + (q[1] - p[1]) * t / length + nz;
        const low = layers(x, z).at(-1)?.h, h = heightAt(x, z);
        if (low !== undefined && h !== null) moves.push(h - low);
      }
    });
    if (moves.length) shift.set(b.pick, median(moves));
  }
  const out = Float32Array.from(v);
  for (let i = 0; i < out.length; i += TRIANGLE) {
    const by = shift.get(out[i + 6]);
    if (by !== undefined) for (const k of [2, 9, 16]) out[i + k] += by;
  }
  const moves = [...shift.values()].sort((a, b) => a - b);
  return {vertices: out, report: `buildings moved with their ground in the road area: ${moves.length}, by ${moves.length ? `${moves[0].toFixed(2)} to ${moves.at(-1)!.toFixed(2)} m, median ${median(moves).toFixed(2)}` : 'none'}`};
}

// Inside the road area the survey ground (flat sheets stacked 5-35 cm apart
// over 10-16 m triangles) is replaced by one surface on a 1 m grid at the given
// heights, coloured from the survey's visible layer. Water, buildings and
// survey ground outside the area stay; triangles across its edge are split.
// The grid runs on under buildings, where their walls hide it.
export function gridGround(v: Float32Array, heightAt: HeightAt, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, square = squareOf(scene, city), {layers} = surveyLayers(v);
  const water = (i: number) => v[i + 5] > v[i + 3] * 1.15 && v[i + 4] > v[i + 3] * 1.15; // as survey/classify.ts
  const [[minX, minZ], , [maxX, maxZ]] = square[0].map(([x, z]): Point2 => [x + ox, z + oz]);
  const out: number[] = [];
  let removed = 0;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    const xs = [v[i], v[i + 7], v[i + 14]], zs = [v[i + 1], v[i + 8], v[i + 15]];
    if (v[i + 6] || water(i) || Math.max(...xs) - Math.min(...xs) > HUGE || Math.max(...xs) < minX || Math.min(...xs) > maxX || Math.max(...zs) < minZ || Math.min(...zs) > maxZ) { pushTriangle(v, i, out); continue; }
    if (xs.every(x => x >= minX && x <= maxX) && zs.every(z => z >= minZ && z <= maxZ)) { removed++; continue; }
    if (splitTriangle(v, i, square, city, out, 'drop')) removed++; else pushTriangle(v, i, out);
  }

  // The visible layer of the ground stack; anything higher is not ground (a shelter roof painted as ground).
  const colour = (x: number, z: number) => {
    const found = layers(x, z), low = found.at(-1)?.h;
    if (low === undefined) return undefined;
    const top = found.find(l => l.h <= low + STACK)!;
    return water(top.i) ? null : [v[top.i + 3], v[top.i + 4], v[top.i + 5]];
  };
  const nx = Math.round((maxX - minX) / GRID), nz = Math.round((maxZ - minZ) / GRID);
  // Water is left out (null). Inside buildings the survey has no ground and the
  // terrain model no data, so those points take height and colour from their
  // neighbours: without them the cells along every wall dropped out.
  const points: ({x: number; z: number; h: number | null; c: number[] | undefined} | null)[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = minX + i * GRID, z = minZ + j * GRID, c = colour(x, z);
    points.push(c === null ? null : {x, z, h: heightAt(x, z), c});
  }
  const neighbours = (k: number) => {
    const i = k % (nx + 1), j = Math.floor(k / (nx + 1));
    return [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && a <= nx && b >= 0 && b <= nz).map(([a, b]) => points[b * (nx + 1) + a]).filter(p => p !== null);
  };
  let filled = 0;
  for (let pass = 0; pass < FILL_PASSES; pass++) {
    const next = points.map((p, k) => {
      if (!p || (p.h !== null && p.c)) return null;
      const near = neighbours(k), heights = near.map(n => n!.h).filter(h => h !== null) as number[];
      return {h: p.h ?? (heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null), c: p.c ?? near.map(n => n!.c).find(Boolean)};
    });
    let changed = 0;
    next.forEach((n, k) => { const p = points[k]; if (p && n && (n.h !== p.h || n.c !== p.c)) { p.h = n.h; p.c = n.c; changed++; } });
    filled += changed;
    if (!changed) break;
  }
  // Cells under buildings stay: the grid cannot follow a wall, and dropping the
  // cells a footprint covers left see-through gaps along the foundations.
  const corners = (i: number, j: number) => [points[j * (nx + 1) + i], points[j * (nx + 1) + i + 1], points[(j + 1) * (nx + 1) + i + 1], points[(j + 1) * (nx + 1) + i]];
  const kept = (corner: typeof points) => corner.every(p => p?.c && p.h !== null);
  let cells = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (kept(corners(i, j))) cells++;
  // Written straight into the typed array: town-wide, a plain array of the grid's numbers outgrows the heap.
  const vertices = new Float32Array(out.length + cells * 2 * TRIANGLE);
  vertices.set(out);
  let at = out.length;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const corner = corners(i, j);
    if (!kept(corner)) continue;
    // Split along the diagonal across which the height changes least: one fixed
    // diagonal left a sawtooth of creases on banks that do not run with the grid.
    const [a, b, c, d] = corner.map(p => p!.h!), split = Math.abs(a - c) <= Math.abs(b - d) ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
    for (const t of split) for (const k of t) { const p = corner[k]!; vertices.set([p.x, p.z, p.h!, ...p.c!, 0], at); at += 7; }
  }
  const textured = {minX, maxX, minZ, maxZ};
  return {vertices, textured, report: `ground rebuilt on a ${GRID} m grid in the road area: ${cells} cells (${filled} point fills under buildings); ${removed} survey ground triangles replaced`};
}
