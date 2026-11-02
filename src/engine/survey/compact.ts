import type {SurveyBucket} from '../data.ts';

// Match attribute bits, including UV seams and pick IDs. The mobile flat
// shader derives face normals, so adjacent faces may share their vertices.
export function compactBucket(bucket: SurveyBucket, flat = false): SurveyBucket {
  if ((!bucket.normal && !flat) || bucket.indices) return bucket;
  const floats = [bucket.position, bucket.color, bucket.uv, ...(!flat ? [bucket.normal!] : [])];
  const strides = [3, 3, 2, 3], bits = floats.map(a => new Uint32Array(a.buffer, a.byteOffset, a.length));
  const count = bucket.building.length, indices = new Uint32Array(count), originals = new Uint32Array(count);
  let size = 1, unique = 0;
  while (size < count * 2) size *= 2;
  const slots = new Uint32Array(size), mask = size - 1;
  const equal = (a: number, b: number) => {
    if (bucket.building[a] !== bucket.building[b] || bucket.layer[a] !== bucket.layer[b]) return false;
    for (let k = 0; k < bits.length; k++) for (let j = 0; j < strides[k]; j++)
      if (bits[k][a * strides[k] + j] !== bits[k][b * strides[k] + j]) return false;
    return true;
  };
  for (let i = 0; i < count; i++) {
    let hash = Math.imul(bucket.building[i] | bucket.layer[i] << 16, 16777619);
    for (let k = 0; k < bits.length; k++) for (let j = 0; j < strides[k]; j++) hash = Math.imul(hash ^ bits[k][i * strides[k] + j], 16777619);
    let slot = (hash ^ hash >>> 16) & mask;
    while (slots[slot] && !equal(i, slots[slot] - 1)) slot = (slot + 1) & mask;
    if (slots[slot]) indices[i] = indices[slots[slot] - 1];
    else { slots[slot] = i + 1; originals[unique] = i; indices[i] = unique++; }
  }
  if (unique * 47 + count * 4 >= count * 47) return bucket;
  const arrays = floats.map((a, k) => {
    const result = new Float32Array(unique * strides[k]);
    for (let i = 0; i < unique; i++) result.set(a.subarray(originals[i] * strides[k], (originals[i] + 1) * strides[k]), i * strides[k]);
    return result;
  });
  return {...bucket, indices, position: arrays[0], color: arrays[1], uv: arrays[2], normal: arrays[3],
    building: Uint16Array.from(originals.subarray(0, unique), i => bucket.building[i]),
    layer: Uint8Array.from(originals.subarray(0, unique), i => bucket.layer[i])};
}
