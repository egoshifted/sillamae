import {MeshoptEncoder} from 'meshoptimizer/encoder';
import type {Bucket} from '../src/engine/survey/classify.ts';

await MeshoptEncoder.ready;

const VERTEX = 16; // Uint32 x, z, height in millimetres above the bucket origin; sRGB bytes + pad

const pad4 = (bytes: Uint8Array) => {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
  out.set(bytes);
  return out;
};
const toSrgb = (v: number) => Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055));

// One millimetre grid in absolute survey coordinates, so a vertex shared by
// two buckets quantises identically and no seams open between them.
export function encodeBucket(b: Bucket) {
  const corners = b.source.length / 3, mm = b.source.map(v => Math.round(v * 1000));
  const origin = [0, 1, 2].map(c => {
    let low = Infinity;
    for (let i = c; i < mm.length; i += 3) low = Math.min(low, mm[i]);
    return low;
  });
  const unique = new Map<string, number>(), order: number[] = [], index = new Uint32Array(corners);
  const rgb = b.c.map(toSrgb);
  for (let v = 0; v < corners; v++) {
    const key = `${mm[v * 3]},${mm[v * 3 + 1]},${mm[v * 3 + 2]},${rgb[v * 3]},${rgb[v * 3 + 1]},${rgb[v * 3 + 2]}`;
    let k = unique.get(key);
    if (k === undefined) { unique.set(key, k = order.length); order.push(v); }
    index[v] = k;
  }
  const vertices = new Uint8Array(order.length * VERTEX), view = new DataView(vertices.buffer);
  order.forEach((v, k) => {
    for (let c = 0; c < 3; c++) view.setUint32(k * VERTEX + c * 4, mm[v * 3 + c] - origin[c], true);
    for (let c = 0; c < 3; c++) vertices[k * VERTEX + 12 + c] = rgb[v * 3 + c];
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
