import {MeshoptEncoder} from 'meshoptimizer/encoder';
import type {Bucket} from '../src/engine/survey/classify.ts';

await MeshoptEncoder.ready;

const VERTEX = 20; // Uint32 x, z, height in millimetres above the bucket origin; sRGB bytes, 1 if smooth; Uint8 octahedral normal, pad

const pad4 = (bytes: Uint8Array) => {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
  out.set(bytes);
  return out;
};
const toSrgb = (v: number) => Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055));

export type GroundNormals = (x: number, z: number) => [number, number] | null;

// Ground is smooth across its triangles, buckets and tiles alike, so normals are summed here
// over the whole town, where every neighbour is known. Keyed by millimetre x/z: stacked
// survey layers share a slope closely enough. Octahedral, north-up (see decodeTile).
export function groundNormals(buckets: Bucket[]): GroundNormals {
  const sums = new Map<number, [number, number, number]>(), key = (x: number, z: number) => x * 67108864 + z;
  for (const b of buckets) {
    if (b.kind === 'water') continue;
    for (let t = 0; t < b.building.length; t++) {
      if (b.building[t]) continue;
      const s = b.source, i = t * 9, ax = s[i + 3] - s[i], ay = s[i + 5] - s[i + 2], az = s[i + 4] - s[i + 1], bx = s[i + 6] - s[i], by = s[i + 8] - s[i + 2], bz = s[i + 7] - s[i + 1];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      for (let c = 0; c < 3; c++) {
        const k = key(Math.round(s[i + c * 3] * 1000), Math.round(s[i + c * 3 + 1] * 1000)), sum = sums.get(k);
        if (sum) { sum[0] += nx; sum[1] += ny; sum[2] += nz; } else sums.set(k, [nx, ny, nz]);
      }
    }
  }
  return (x, z) => {
    const n = sums.get(key(x, z));
    if (!n) return null;
    const l = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]);
    return l ? [n[0] / l, n[2] / l] : null;
  };
}

// One millimetre grid in absolute survey coordinates, so a vertex shared by
// two buckets quantises identically and no seams open between them.
export function encodeBucket(b: Bucket, smooth: GroundNormals) {
  const corners = b.source.length / 3, mm = b.source.map(v => Math.round(v * 1000));
  const origin = [0, 1, 2].map(c => {
    let low = Infinity;
    for (let i = c; i < mm.length; i += 3) low = Math.min(low, mm[i]);
    return low;
  });
  const unique = new Map<string, number>(), order: number[] = [], index = new Uint32Array(corners);
  const rgb = b.c.map(toSrgb);
  for (let v = 0; v < corners; v++) {
    const key = `${mm[v * 3]},${mm[v * 3 + 1]},${mm[v * 3 + 2]},${rgb[v * 3]},${rgb[v * 3 + 1]},${rgb[v * 3 + 2]},${b.building[Math.floor(v / 3)] ? 1 : 0}`;
    let k = unique.get(key);
    if (k === undefined) { unique.set(key, k = order.length); order.push(v); }
    index[v] = k;
  }
  const vertices = new Uint8Array(order.length * VERTEX), view = new DataView(vertices.buffer);
  order.forEach((v, k) => {
    for (let c = 0; c < 3; c++) view.setUint32(k * VERTEX + c * 4, mm[v * 3 + c] - origin[c], true);
    for (let c = 0; c < 3; c++) vertices[k * VERTEX + 12 + c] = rgb[v * 3 + c];
    const normal = b.kind !== 'water' && !b.building[Math.floor(v / 3)] ? smooth(mm[v * 3], mm[v * 3 + 1]) : null;
    if (!normal) return;
    vertices[k * VERTEX + 15] = 1;
    // Eight bits: sixteen doubled the download, as the low bytes of a normal hardly compress.
    vertices[k * VERTEX + 16] = Math.round(normal[0] * 127) + 128;
    vertices[k * VERTEX + 17] = Math.round(normal[1] * 127) + 128;
  });
  const encodedVertices = MeshoptEncoder.encodeVertexBuffer(vertices, order.length, VERTEX);
  const encodedIndices = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(index.buffer), corners, 4);
  const triangles = corners / 3, buildings = new Uint16Array(Math.ceil(triangles / 2) * 2), layers = new Uint8Array(Math.ceil(triangles / 4) * 4);
  buildings.set(b.building);
  layers.set(b.layer ?? []);
  return {
    parts: [pad4(encodedVertices), pad4(encodedIndices), new Uint8Array(buildings.buffer), layers],
    meta: {vertices: corners, unique: order.length, vertexBytes: encodedVertices.length, indexBytes: encodedIndices.length, origin: origin as [number, number, number]},
  };
}
