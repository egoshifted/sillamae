import * as THREE from 'three';
import type {RoadSurface} from './data.ts';
import type {Point2, RoadCut} from './types.ts';

type P = [number, number, number];
export function contains(ring: Point2[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > z) !== (ring[j][1] > z) && x < (ring[j][0] - ring[i][0]) * (z - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
  return inside;
}

// Partition in the original triangle's plane, so retained pavement keeps its heights.
export function demolishRoads(surfaces: RoadSurface[], cuts: RoadCut[]): RoadSurface[] {
  if (!cuts.length) return surfaces;
  const out: RoadSurface[] = [];
  const bounds = (ring: Point2[]) => ({x0: Math.min(...ring.map(p => p[0])), x1: Math.max(...ring.map(p => p[0])), z0: Math.min(...ring.map(p => p[1])), z1: Math.max(...ring.map(p => p[1]))});
  const indexed = cuts.map(c => ({...c, box: bounds(c.ring)}));
  for (const surface of surfaces) {
    const box = bounds(surface.ring.map(([x, , z]) => [x, z]));
    const relevant = indexed.filter(c => (surface.kind === c.kind || surface.kind === 'marking' && c.kind === 'carriageway') && c.box.x0 < box.x1 && c.box.x1 > box.x0 && c.box.z0 < box.z1 && c.box.z1 > box.z0);
    if (!relevant.length) { out.push(surface); continue; }
    let kept = THREE.ShapeUtils.triangulateShape(surface.ring.map(([x, , z]) => new THREE.Vector2(x, z)), []).map(t => t.map(i => surface.ring[i]));
    for (const cut of relevant) {
      const next: P[][] = [];
      const sign = Math.sign(cut.ring.reduce((s, a, i) => { const b = cut.ring[(i + 1) % cut.ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
      for (const polygon of kept) {
        let inside = polygon;
        for (let i = 0; i < cut.ring.length && inside.length; i++) {
          const a = cut.ring[i], b = cut.ring[(i + 1) % cut.ring.length];
          const distance = (p: P) => sign * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
          const yes: P[] = [], no: P[] = [];
          inside.forEach((p, j) => {
            const q = inside[(j + 1) % inside.length], d = distance(p), e = distance(q);
            (d >= 0 ? yes : no).push(p);
            if ((d >= 0) !== (e >= 0)) { const t = d / (d - e), hit: P = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])]; yes.push(hit); no.push(hit); }
          });
          if (no.length >= 3) next.push(no);
          inside = yes;
        }
        if (inside.length >= 3 && surface.kind !== 'marking' && !cut.exposeGround) {
          const groundColours = cut.groundColours && inside.map(p => {
            const [a, b, , d] = cut.ring, ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - a[0], vz = d[1] - a[1];
            const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[2] - a[1]) * uz) / (ux * ux + uz * uz)));
            const v = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[2] - a[1]) * vz) / (vx * vx + vz * vz)));
            const c = cut.groundColours!;
            return [0, 1, 2].map(k => (c[0][k] * (1 - u) + c[1][k] * u) * (1 - v) + (c[3][k] * (1 - u) + c[2][k] * u) * v) as [number, number, number];
          });
          out.push({...surface, kind: 'footway', surface: 'grass', groundColour: cut.groundColour, groundColours, ring: inside});
        }
      }
      kept = next;
    }
    for (const ring of kept) out.push({...surface, ring});
  }
  return out;
}

export function roadSection(at: Point2, direction: Point2, left: number, right: number, length = 2): Point2[] {
  const n = Math.hypot(...direction), u = [direction[0] / n, direction[1] / n], v = [-u[1], u[0]];
  return [[-length / 2, -left], [length / 2, -left], [length / 2, right], [-length / 2, right]].map(([s, t]) => [at[0] + u[0] * s + v[0] * t, at[1] + u[1] * s + v[1] * t]);
}
