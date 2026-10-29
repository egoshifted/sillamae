import {preloadSurfaces} from './surfaces.js';
import {orthogonalPlan} from './plan.ts';
import {addSteppedApartment} from './model.js';
import {concat, readTriangle, splitPolygon, type SurveyVertex} from '../../../engine/survey/carve.ts';
import {TRIANGLE, type Building, type BuildingOverride, type Point2} from '../../../engine/types.ts';

// Floor indices are zero-based (L1 = 0).
// These settings are not evidence for other addresses.
export const kesk1Design = Object.freeze({
  height: 28.5, floors: 9, floorPitch: 2.85,
  foundationLevel: 12.8, // survey height of local Y = 0
  balconyEdges: [2, 9, 11, 13, 18],
  openBalconies: [[2, 6], [18, 1]],
  rearBrownFloors: [2, 4, 6, 8], balconyFrameInset: .09,
  number: '1', street: 'Kesk tn',
  // Individually counted from supplied June/September 2023 Street View elevations.
  vents: [{edge: 1, count: 5}, {edge: 4, count: 2}, {edge: 8, count: 8}, {edge: 14, count: 7}, {edge: 16, count: 1}],
  pathWidth: 2.4, annexParapetHeight: 1, annexStart: 1.05, // User reference: shorten far end by about 1 m; entrance end stays fixed.
  // Provisional aerial-image proportion, not a surveyed height. Main roof only.
  mainParapetAboveRoof: .67,
  liftRoofDetails: true, // Rear door and small rooftop cowl from the user's aerial reference; dimensions approximate.
  // Aerial-supported relationships; dimensions provisional pending review.
  steppedFacadeEdges: [2, 9, 11, 13, 18], balconyShoulder: .26, roofShelfDepth: .45, baseProjection: .35,
  sideWallStep: {edge: 8, width: .60, depth: .12}, entranceReturnStep: {edge: 7, widthFraction: 1 / 3, projection: .12},
});

export const kesk1: BuildingOverride = {
  id: '213321385',
  carveSurvey(vertices, building) {
    building.g = orthogonalPlan(building.g);
    return carveEntrancePit(vertices, building);
  },
  preload: preloadSurfaces,
  build({scene, building, terrain, frame, ground, changed}) {
    const root = addSteppedApartment(scene, building, {...terrain, siteGround: ground.filter(t => Math.max(t[2], t[5], t[8]) >= 10)}, kesk1Design, frame);
    root.userData.ready.then(() => changed?.());
    return {root, groundPatchMinHeight: 10, groundPatches: root.userData.groundPatches ?? [], setTextures: root.userData.setTextures};
  },
  entrances: building => [facePoint(building, 6, .2394, 3), facePoint(building, 16, .5, 2.7)],
  view: {offset: [110, 80, 45], span: 65},
  detailShadows: true,
};

function facePoint(building: Building, index: number, along: number, out: number): Point2 {
  const g = building.g, a = g[index], b = g[(index + 1) % g.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const sign = Math.sign(g.reduce((s, p, i) => { const q = g[(i + 1) % g.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
  return [a[0] + u[0] * L * along + u[1] * sign * out, a[1] + u[1] * L * along - u[0] * sign * out];
}

// Remove only ground triangles inside the sunken entrance footprint. Clipping,
// rather than dropping whole triangles, preserves adjacent grass and paths.
function carveEntrancePit(vertices: Float32Array, building: Building, bounds?: {min: number; max: number; minD: number}): Float32Array {
  const g = building.g, a = g[19], b = g[0], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [u[1], -u[0]];
  const depth = Math.max(...g.map(p => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1])) + .06 + 2.4;
  const along = (p: number[]) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
  const across = (p: number[]) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
  const min = bounds?.min ?? 4.29, max = bounds?.max ?? L, minD = bounds?.minD ?? 0;
  const planes = [(p: SurveyVertex) => along(p) - min, (p: SurveyVertex) => max - along(p),
    (p: SurveyVertex) => across(p) - minD, (p: SurveyVertex) => depth - across(p)];
  const out: number[] = [], chunks: Float32Array[] = [];
  let runStart = 0;
  for (let i = 0; i < vertices.length; i += TRIANGLE) {
    if (vertices[i + 6] || Math.max(vertices[i + 2], vertices[i + 9], vertices[i + 16]) < 10) continue;
    const corners = [i, i + 7, i + 14].map(j => [vertices[j], vertices[j + 1]]);
    const s = corners.map(along), d = corners.map(across);
    if (Math.max(...s) < min || Math.min(...s) > max || Math.max(...d) < minD || Math.min(...d) > depth) continue;
    if (i > runStart) chunks.push(vertices.subarray(runStart, i));
    runStart = i + TRIANGLE;
    let inside = readTriangle(vertices, i);
    for (const plane of planes) {
      if (!inside.length) break;
      const [yes, no] = splitPolygon(inside, plane);
      for (let j = 1; j < no.length - 1; j++) out.push(...no[0], ...no[j], ...no[j + 1]);
      inside = yes;
    }
  }
  if (runStart < vertices.length) chunks.push(vertices.subarray(runStart));
  chunks.push(new Float32Array(out));
  const result = concat(chunks);
  return bounds ? result : carveEntrancePit(result, building, {min: L, max: along(g[2]), minD: depth - 2.4});
}
