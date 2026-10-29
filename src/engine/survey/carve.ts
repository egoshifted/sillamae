import {TRIANGLE, VERTEX, type Polygon} from '../types.ts';

export type SurveyVertex = number[];
export type Plane = (p: SurveyVertex) => number;

export function splitPolygon(polygon: SurveyVertex[], plane: Plane): [SurveyVertex[], SurveyVertex[]] {
  const inside: SurveyVertex[] = [], outside: SurveyVertex[] = [];
  for (let j = 0; j < polygon.length; j++) {
    const p = polygon[j], q = polygon[(j + 1) % polygon.length], dp = plane(p), dq = plane(q);
    (dp >= 0 ? inside : outside).push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq), v = p.map((x, k) => x + (q[k] - x) * t);
      inside.push(v);
      outside.push(v);
    }
  }
  return [inside, outside];
}

export function readTriangle(vertices: Float32Array, i: number): SurveyVertex[] {
  return [0, VERTEX, 2 * VERTEX].map(j => Array.from(vertices.subarray(i + j, i + j + VERTEX)));
}

export function concat(chunks: Float32Array[]) {
  const out = new Float32Array(chunks.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export function carveGroundPatches(vertices: Float32Array, patches: Polygon[]) {
  if (!patches.length) return vertices;
  const all = patches.flat(), minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minZ = Math.min(...all.map(p => p[1])), maxZ = Math.max(...all.map(p => p[1]));
  const chunks: Float32Array[] = [];
  let local: SurveyVertex[][] = [], run = 0;
  for (let i = 0; i < vertices.length; i += TRIANGLE) {
    if (vertices[i + 6] !== 0) continue;
    const xs = [vertices[i], vertices[i + 7], vertices[i + 14]], zs = [vertices[i + 1], vertices[i + 8], vertices[i + 15]];
    if (Math.max(...xs) < minX || Math.min(...xs) > maxX || Math.max(...zs) < minZ || Math.min(...zs) > maxZ) continue;
    if (i > run) chunks.push(vertices.subarray(run, i));
    run = i + TRIANGLE;
    local.push(readTriangle(vertices, i));
  }
  if (run < vertices.length) chunks.push(vertices.subarray(run));
  for (const polygon of patches) {
    const area = polygon.reduce((s, a, i) => { const b = polygon[(i + 1) % polygon.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0), sign = Math.sign(area);
    const px0 = Math.min(...polygon.map(p => p[0])), px1 = Math.max(...polygon.map(p => p[0]));
    const pz0 = Math.min(...polygon.map(p => p[1])), pz1 = Math.max(...polygon.map(p => p[1]));
    const next: SurveyVertex[][] = [];
    for (const tri of local) {
      if (Math.max(...tri.map(p => p[0])) <= px0 || Math.min(...tri.map(p => p[0])) >= px1 ||
          Math.max(...tri.map(p => p[1])) <= pz0 || Math.min(...tri.map(p => p[1])) >= pz1) { next.push(tri); continue; }
      let inside = tri;
      for (let e = 0; e < polygon.length && inside.length; e++) {
        const a = polygon[e], b = polygon[(e + 1) % polygon.length];
        const [yes, no] = splitPolygon(inside, p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
        for (let j = 1; j < no.length - 1; j++) next.push([no[0], no[j], no[j + 1]]);
        inside = yes;
      }
    }
    local = next;
  }
  chunks.push(new Float32Array(local.flat(2)));
  return concat(chunks);
}

export function groundWithin(vertices: Float32Array, box: {minX: number; maxX: number; minZ: number; maxZ: number}) {
  const out: number[][] = [], v = vertices;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (v[i + 6] !== 0) continue;
    const xs = [v[i], v[i + 7], v[i + 14]], zs = [v[i + 1], v[i + 8], v[i + 15]];
    if (Math.max(...xs) < box.minX || Math.min(...xs) > box.maxX || Math.max(...zs) < box.minZ || Math.min(...zs) > box.maxZ) continue;
    out.push([v[i], v[i + 1], v[i + 2], v[i + 7], v[i + 8], v[i + 9], v[i + 14], v[i + 15], v[i + 16]]);
  }
  return out;
}
