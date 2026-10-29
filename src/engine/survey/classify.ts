import * as THREE from 'three';
import {TRIANGLE, type WorldFrame} from '../types.ts';

export const SURFACES = ['plaster', 'roof', 'stone', 'paving', 'clay', 'grass', 'brick', 'plain', 'glass', 'water'] as const;
export type Surface = typeof SURFACES[number];
export type Detail = 'base' | 'medium' | 'fine';

export interface Bucket {
  kind: Surface;
  detail: Detail;
  cell: string;
  source: number[];
  c: number[];
  building: number[];
  layer?: number[]; // ground triangles: how many land surfaces lie beneath
}

export interface Site {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const CELL = 180;
const TILE: Partial<Record<Surface, number>> = {roof: 2.4, plaster: 2, stone: 2.2, brick: 1.8, paving: 3, grass: 2, clay: 1.5};
const ORDER = [0, 14, 7], SWAPPED = [0, 7, 14];

export function bucketSurvey(v: Float32Array, frame: WorldFrame, skip: Set<number>, sites: Site[]) {
  const [ox, oz] = frame.origin, buckets = new Map<string, Bucket>();
  const c = new THREE.Color(), a = new THREE.Vector3(), b = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (skip.has(v[i + 6])) continue;
    let corners = ORDER;
    const pts = ORDER.map(j => new THREE.Vector3(v[i + j] - ox, v[i + j + 2] - frame.base, v[i + j + 1] - oz));
    a.subVectors(pts[1], pts[0]);
    b.subVectors(pts[2], pts[0]);
    normal.crossVectors(a, b);
    const area = normal.length() / 2;
    normal.normalize();
    if (Math.abs(normal.y) > .2 && normal.y < 0) { [pts[1], pts[2]] = [pts[2], pts[1]]; normal.negate(); corners = SWAPPED; }
    const r = v[i + 3], g = v[i + 4], bl = v[i + 5], id = v[i + 6];
    const mean = (r + g + bl) / 3, sat = Math.max(r, g, bl) - Math.min(r, g, bl), y = pts.reduce((s, p) => s + p.y, 0) / 3;
    let kind: Surface = 'plain';
    if (id) {
      if (bl > r * 1.04 && g > r * 1.04) kind = 'glass';
      else if (Math.abs(normal.y) > .15 && y > 4 && mean < .65) kind = 'roof';
      else if (area > 1 && Math.abs(normal.y) < .2) kind = mean < .62 && sat < .1 ? 'stone' : r > g * 1.3 ? 'brick' : 'plaster';
    } else if (bl > r * 1.15 && g > r * 1.15) kind = 'water';
    else if (area > 2 || inSite(pts[0].x + ox, pts[0].z + oz, sites)) kind = g > r * 1.035 ? 'grass' : r > g * 1.2 ? 'clay' : sat < .1 ? 'paving' : 'grass';
    const detail: Detail = id && kind !== 'glass' && area < .16 ? 'fine' : id && kind !== 'glass' && area < 1 ? 'medium' : 'base';
    const cx = Math.floor((pts[0].x + pts[1].x + pts[2].x) / 3 / CELL), cz = Math.floor((pts[0].z + pts[1].z + pts[2].z) / 3 / CELL);
    const key = kind + '-' + detail + '-' + cx + '-' + cz;
    let out = buckets.get(key);
    if (!out) buckets.set(key, out = {kind, detail, cell: cx + ',' + cz, source: [], c: [], building: []});
    out.building.push(id);
    for (let j = 0; j < 3; j++) {
      // Colours stay with the unswapped corner order, as the survey viewer always did.
      const p = i + corners[j], k = i + ORDER[j];
      out.source.push(v[p], v[p + 1], v[p + 2]);
      c.setRGB(v[k + 3], v[k + 4], v[k + 5], THREE.SRGBColorSpace);
      out.c.push(c.r, c.g, c.b);
    }
  }
  return buckets;
}

export function expandBucket(source: Float32Array, kind: Surface, frame: WorldFrame) {
  const [ox, oz] = frame.origin, base = frame.base, tile = TILE[kind] || 2;
  const position = new Float32Array(source.length), uv = new Float32Array(source.length / 3 * 2);
  for (let i = 0; i < source.length; i += 9) {
    const x0 = source[i] - ox, y0 = source[i + 2] - base, z0 = source[i + 1] - oz;
    const x1 = source[i + 3] - ox, y1 = source[i + 5] - base, z1 = source[i + 4] - oz;
    const x2 = source[i + 6] - ox, y2 = source[i + 8] - base, z2 = source[i + 7] - oz;
    const ax0 = x1 - x0, ay0 = y1 - y0, az0 = z1 - z0, bx = x2 - x0, by = y2 - y0, bz = z2 - z0;
    let nx = ay0 * bz - az0 * by, ny = az0 * bx - ax0 * bz, nz = ax0 * by - ay0 * bx;
    const s = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1); // as Vector3.normalize
    nx = Math.abs(nx * s); ny = Math.abs(ny * s); nz = Math.abs(nz * s);
    const top = ny > nx && ny > nz, side = nx > nz;
    const xs = [x0, x1, x2], ys = [y0, y1, y2], zs = [z0, z1, z2];
    for (let j = 0; j < 3; j++) {
      const at = i + j * 3, t = (i / 3 + j) * 2;
      position[at] = xs[j]; position[at + 1] = ys[j]; position[at + 2] = zs[j];
      uv[t] = (top ? xs[j] : side ? zs[j] : xs[j]) / tile;
      uv[t + 1] = (top ? zs[j] : ys[j]) / tile;
    }
  }
  return {position, uv};
}

function inSite(x: number, z: number, sites: Site[]) {
  return sites.some(s => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
}
