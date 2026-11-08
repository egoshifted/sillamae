import type {Bucket} from './classify.ts';

const CELL = 4; // metres

// Outside triangleGrid: a closure there would keep every bucket alive as long as the grid.
function each(buckets: Bucket[], keep: (bucket: Bucket, triangle: number) => boolean, huge: number, visit: (bucket: Bucket, triangle: number, minX: number, maxX: number, minZ: number, maxZ: number) => void) {
  for (const b of buckets) for (let t = 0; t < b.building.length; t++) {
    if (!keep(b, t)) continue;
    const s = b.source, i = t * 9;
    const minX = Math.min(s[i], s[i + 3], s[i + 6]), maxX = Math.max(s[i], s[i + 3], s[i + 6]);
    const minZ = Math.min(s[i + 1], s[i + 4], s[i + 7]), maxZ = Math.max(s[i + 1], s[i + 4], s[i + 7]);
    if (maxX - minX <= huge && maxZ - minZ <= huge) visit(b, t, minX, maxX, minZ, maxZ);
  }
}

// The town has about ten million ground triangles, so these are flat arrays:
// a small array per triangle cost more to destructure and collect than the
// lookups themselves. Each cell keeps its triangles in bucket order. Changing
// CELL changes results: the bary test below tolerates points just outside a
// triangle, and only a triangle sharing the point's cell gets that test.
export function triangleGrid(buckets: Bucket[], keep: (bucket: Bucket, triangle: number) => boolean, huge: number) {
  let count = 0, firstX = Infinity, lastX = -Infinity, firstZ = Infinity, lastZ = -Infinity;
  each(buckets, keep, huge, (b, t, minX, maxX, minZ, maxZ) => {
    count++;
    firstX = Math.min(firstX, Math.floor(minX / CELL));
    lastX = Math.max(lastX, Math.floor(maxX / CELL));
    firstZ = Math.min(firstZ, Math.floor(minZ / CELL));
    lastZ = Math.max(lastZ, Math.floor(maxZ / CELL));
  });
  const columns = count ? lastX - firstX + 1 : 0, rows = count ? lastZ - firstZ + 1 : 0;
  const cell = (cx: number, cz: number) => (cx - firstX) * rows + cz - firstZ;
  const corners = new Float64Array(count * 9), layers = new Uint8Array(count), starts = new Int32Array(columns * rows + 1);
  let filled = 0;
  each(buckets, keep, huge, (b, t, minX, maxX, minZ, maxZ) => {
    const i = t * 9, s = b.source, at = filled * 9;
    for (let j = 0; j < 9; j++) corners[at + j] = s[i + j];
    layers[filled++] = b.layer?.[t] ?? 0;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) starts[cell(cx, cz) + 1]++;
  });
  for (let i = 1; i < starts.length; i++) starts[i] += starts[i - 1];
  const members = new Int32Array(starts[starts.length - 1] ?? 0), next = starts.slice();
  filled = 0;
  each(buckets, keep, huge, (b, t, minX, maxX, minZ, maxZ) => {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) members[next[cell(cx, cz)]++] = filled;
    filled++;
  });

  return {
    // Calls hit with the height and layer of every triangle over x/z.
    over(x: number, z: number, hit: (height: number, layer: number) => void) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (!(cx >= firstX && cx <= lastX && cz >= firstZ && cz <= lastZ)) return;
      const index = cell(cx, cz);
      for (let m = starts[index]; m < starts[index + 1]; m++) {
        const triangle = members[m], i = triangle * 9;
        const x1 = corners[i], z1 = corners[i + 1], x2 = corners[i + 3], z2 = corners[i + 4], x3 = corners[i + 6], z3 = corners[i + 7];
        const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
        if (Math.abs(d) < 1e-9) continue;
        const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
        if (Math.min(a, b, c) < -1e-6) continue;
        hit(a * corners[i + 2] + b * corners[i + 5] + c * corners[i + 8], layers[triangle]);
      }
    },
  };
}
