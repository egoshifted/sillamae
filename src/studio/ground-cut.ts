import {splitPolygon} from '../engine/survey/carve.ts';
import type {GroundTriangle} from '../engine/types.ts';

// Removes the parts of the displayed ground triangles inside each convex cut; a copy, so the shared site ground stays intact.
export function cutGround(triangles: GroundTriangle[], cuts: [number, number][][]): GroundTriangle[] {
  if (!cuts.length) return triangles;
  let pieces = triangles.map(t => [[t[0], t[1], t[2]], [t[3], t[4], t[5]], [t[6], t[7], t[8]]]);
  for (const cut of cuts) {
    const area = cut.reduce((s, a, i) => { const b = cut[(i + 1) % cut.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0), sign = Math.sign(area);
    const x0 = Math.min(...cut.map(p => p[0])), x1 = Math.max(...cut.map(p => p[0])), z0 = Math.min(...cut.map(p => p[1])), z1 = Math.max(...cut.map(p => p[1]));
    const next: number[][][] = [];
    for (const piece of pieces) {
      if (Math.max(...piece.map(p => p[0])) <= x0 || Math.min(...piece.map(p => p[0])) >= x1 || Math.max(...piece.map(p => p[1])) <= z0 || Math.min(...piece.map(p => p[1])) >= z1) { next.push(piece); continue; }
      let inside = piece;
      for (let e = 0; e < cut.length && inside.length; e++) {
        const a = cut[e], b = cut[(e + 1) % cut.length];
        const [yes, no] = splitPolygon(inside, p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
        for (let j = 1; j < no.length - 1; j++) next.push([no[0], no[j], no[j + 1]]);
        inside = yes;
      }
    }
    pieces = next;
  }
  return pieces.map(p => p.flat() as GroundTriangle);
}
