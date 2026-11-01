import type * as THREE from 'three';
import type {GroundTriangle, Point2} from '../../engine/types.ts';

// Triangles wider than this, in metres, are the sea-level plane under the whole town.
const SEA_PLANE = 200;

// A refined model stands on a flat foundation whose top is its datum: the
// median of the lowest atlas ground at its entrances (source x/z), or null
// where no ground is found. Reading it from the same site ground in the data
// build, the atlas and the studio keeps all three in agreement.
export function entranceDatum(ground: GroundTriangle[], points: Point2[]): number | null {
  const heights = points.flatMap(([x, z]) => {
    let low = Infinity;
    for (const [x1, z1, h1, x2, z2, h2, x3, z3, h3] of ground) {
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-9 || Math.max(x1, x2, x3) - Math.min(x1, x2, x3) > SEA_PLANE) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) >= -1e-6) low = Math.min(low, a * h1 + b * h2 + c * h3);
    }
    return low === Infinity ? [] : [low];
  }).sort((a, b) => a - b);
  const n = heights.length;
  return n ? (heights[(n - 1) >> 1] + heights[n >> 1]) / 2 : null;
}

// Seats a model written against a fixed study datum on another datum without
// rewriting it: the model is built against the ground lowered by the
// difference and its root is raised by the same amount, so every part it fits
// to the ground (foundation bottoms, steps, aprons) still meets the real ground.
export function seatModel<T extends {root: THREE.Object3D}>(ground: GroundTriangle[], studyDatum: number, datum: number, build: (ground: GroundTriangle[]) => T): T {
  const lift = datum - studyDatum, model = build(lowered(ground, lift));
  model.root.position.y += lift;
  return model;
}

export const lowered = (ground: GroundTriangle[], by: number) => by ? ground.map(t => t.map((v, i) => i % 3 === 2 ? v - by : v)) : ground;
