import {carveGroundPatches, concat, groundWithin} from '../../../engine/survey/carve.ts';
import {TRIANGLE, VERTEX, type GroundTriangle, type Point2} from '../../../engine/types.ts';
import {prepareKesk5Ground} from '../kesk5/ground.ts';
import type {Audit} from '../kesk5/types.ts';

export function gradeSite(ground: GroundTriangle[], origin: Point2, audit: Audit, datum: number, landing: number) {
  const vertices = new Float32Array(ground.length * TRIANGLE);
  ground.forEach((triangle, i) => {
    for (let j = 0; j < 3; j++) vertices.set(triangle.slice(j * 3, j * 3 + 3), i * TRIANGLE + j * VERTEX);
  });
  return groundWithin(gradeSurvey(vertices, origin, audit, datum, landing),
    {minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity});
}

export function gradeSurvey(vertices: Float32Array, origin: Point2, audit: Audit, datum: number, landing: number) {
  const levelApproaches = audit.facadeEdges.filter(f => f.type === 'entrance' && f.section !== 3).map(({edge}) => {
    const a = audit.localFootprint[edge], b = audit.localFootprint[(edge + 1) % audit.localFootprint.length];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  });
  const grade = prepareKesk5Ground(vertices, {origin}, audit, datum, {
    inner: 1.65, outer: 6,
    offset(x, z, top) {
      // A slight fall away from the level approaches keeps the slabs clear of the survey surface.
      const distance = Math.min(...levelApproaches.map(([cx, cz]) => Math.hypot(x - cx, z - cz)));
      const approach = Math.min(1, Math.max(0, (4 - distance) / 2));
      return datum + landing - .13 + approach * .12 - top;
    },
  });
  return concat([carveGroundPatches(vertices, [grade.patch], 10), grade.vertices]);
}
