import * as THREE from 'three';
import type {Point2} from '../../engine/types.ts';

type Point3 = [number, number, number];
type Triangle = {base: Point3[]; points: Point3[]};
const CELL = 3;

// Preserve terrain edges and interior peaks instead of interpolating across a road outline.
export class GroundSurface {
  private cells = new Map<string, Triangle[]>();
  private triangles: Triangle[] = [];

  add(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like) {
    if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-9) return;
    const points = [a, b, c].map((p): Point3 => [p.x, p.y, p.z]), triangle = {base: points, points};
    this.triangles.push(triangle);
    for (const key of this.keys(points.map(([x, , z]) => [x, z]))) {
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, cell = []);
      cell.push(triangle);
    }
  }

  reshape(shift: (x: number, z: number) => number, box?: {minX: number; maxX: number; minZ: number; maxZ: number}) {
    for (const t of this.triangles) t.points = t.base.map(([x, y, z], i) =>
      !box || x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ ? [x, y + shift(x, z), z] : t.points[i]);
  }

  drape(ring: Point2[], rise: number): Point3[][] {
    const result: Point3[][] = [], candidates = new Set(this.keys(ring).flatMap(key => this.cells.get(key) ?? []));
    for (const indices of THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), [])) {
      const outline = indices.map(i => ring[i]);
      const sign = Math.sign(outline.reduce((s, p, i) => { const q = outline[(i + 1) % 3]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
      if (!sign) continue;
      for (const terrain of candidates) {
        let polygon = terrain.points;
        for (let i = 0; i < 3 && polygon.length; i++) {
          const a = outline[i], b = outline[(i + 1) % 3];
          const side = (p: Point3) => sign * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
          const clipped: Point3[] = [];
          polygon.forEach((p, j) => {
            const q = polygon[(j + 1) % polygon.length], d = side(p), e = side(q);
            if (d >= 0) clipped.push(p);
            if ((d >= 0) !== (e >= 0)) { const t = d / (d - e); clipped.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])]); }
          });
          polygon = clipped;
        }
        if (polygon.length >= 3) result.push(polygon.map(([x, y, z]) => [x, y + rise, z]));
      }
    }
    return result;
  }

  private keys(ring: Point2[]) {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), keys: string[] = [];
    for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
      for (let z = Math.floor(Math.min(...zs) / CELL); z <= Math.floor(Math.max(...zs) / CELL); z++) keys.push(x + ',' + z);
    return keys;
  }
}
