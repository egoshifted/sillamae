import {TRIANGLE, type Point2, type SceneData} from '../src/engine/types.ts';

// The survey paints carriageways and footways in these flat colours.
const ROAD = [.57, .60, .58], FOOTWAY = [.81, .82, .75];
const CELL = 10, CLEAR = .6, MAX_SHIFT = 5, STEP = .25; // metres

// Tree points are crown centres, so roadside crowns that lean over the road put the trunk on the carriageway.
export function moveTreesOffRoads(vertices: Float32Array, scene: SceneData) {
  const grid = new Map<string, number[]>(), v = vertices;
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
  // The top layer is what is seen; lower stacked layers can carry another class.
  function surface(x: number, z: number) {
    let top = -1, high = -Infinity;
    for (const i of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const ax = v[i], az = v[i + 1], bx = v[i + 7], bz = v[i + 8], cx = v[i + 14], cz = v[i + 15];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-5) continue;
      const h = a * v[i + 2] + b * v[i + 9] + c * v[i + 16];
      if (h > high) { high = h; top = i; }
    }
    const is = (colour: number[]) => top >= 0 && colour.every((value, k) => Math.abs(v[top + 3 + k] - value) < .015);
    return is(ROAD) ? 'road' : is(FOOTWAY) ? 'footway' : 'verge';
  }
  const clearOf = (x: number, z: number, avoid: string[]) => [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * CLEAR, Math.sin(k * Math.PI / 4) * CLEAR])]
    .every(([dx, dz]) => !avoid.includes(surface(x + dx, z + dz)));
  function nearest(x: number, z: number, avoid: string[]): [number, number] | null {
    for (let r = STEP; r <= MAX_SHIFT; r += STEP) for (let k = 0; k < 24; k++) {
      const p: [number, number] = [x + Math.cos(k * Math.PI / 12) * r, z + Math.sin(k * Math.PI / 12) * r];
      if (clearOf(...p, avoid)) return p;
    }
    return null;
  }
  let verge = 0, footway = 0, stranded = 0;
  for (const t of scene.trees) {
    const [x, z] = t.p;
    if (surface(x, z) !== 'road') continue;
    const p = nearest(x, z, ['road', 'footway']) ?? nearest(x, z, ['road']);
    if (!p) { stranded++; continue; }
    t.p = [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    if (surface(...t.p) === 'footway') footway++; else verge++;
  }
  return `trees moved off carriageways: ${verge} to verges, ${footway} to footways; ${stranded} left more than ${MAX_SHIFT} m from either`;
}

// Street-layer surfaces are wider than the survey's painted strips (parking, junction corners, footways).
export function moveTreesOffStreets(scene: SceneData, streets: Point2[][][]) {
  const boxes = streets.map(p => { const xs = p[0].map(q => q[0]), zs = p[0].map(q => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; });
  const on = (x: number, z: number) => streets.some((p, i) => { const b = boxes[i]; return x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && p.filter(ring => within(x, z, ring)).length % 2 === 1; });
  const clear = (x: number, z: number) => [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * CLEAR, Math.sin(k * Math.PI / 4) * CLEAR])].every(([dx, dz]) => !on(x + dx, z + dz));
  let moved = 0, stranded = 0;
  for (const t of scene.trees) {
    const [x, z] = t.p;
    if (!on(x, z)) continue;
    let found: Point2 | null = null;
    for (let r = STEP; r <= MAX_SHIFT && !found; r += STEP) for (let k = 0; k < 24 && !found; k++) {
      const p: Point2 = [x + Math.cos(k * Math.PI / 12) * r, z + Math.sin(k * Math.PI / 12) * r];
      if (clear(...p)) found = p;
    }
    if (!found) { stranded++; continue; }
    t.p = [Math.round(found[0] * 100) / 100, Math.round(found[1] * 100) / 100];
    moved++;
  }
  return `trees moved off street surfaces: ${moved}; ${stranded} left more than ${MAX_SHIFT} m from a verge`;
}

function within(x: number, z: number, ring: Point2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; }
  return c;
}
