import * as THREE from 'three';
import {splitPolygon} from '../../../engine/survey/carve.ts';
import {ridges, surveyRoof, type RoofShape, type SurveyPoint} from './design.ts';

type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;
const triangleCache = new WeakMap<RoofShape, SurveyPoint[][][]>();
function roofTriangles(shape: RoofShape) {
  let triangles = triangleCache.get(shape);
  if (!triangles) {
    const anchors = [...shape.eaves, ...ridges, ...(shape.extra ?? [])];
    triangles = shape.planes.map(plane => {
      const points = plane.map(i => anchors[i]);
      return THREE.ShapeUtils.triangulateShape(points.map(([x,z]) => new THREE.Vector2(x,-z)), []).map(tri => tri.map(i => points[i]));
    });
    triangleCache.set(shape, triangles);
  }
  return triangles;
}

export const roofVents = [
  {edge: 0, t: .36, setback: 1.35, width: 1.45, depth: 1.8, arched: true},
  {edge: 0, t: .64, setback: 1.35, width: 1.45, depth: 1.8, arched: true},
  {edge: 7, t: .36, setback: 1.35, width: 1.45, depth: 1.8, arched: true},
  {edge: 7, t: .64, setback: 1.35, width: 1.45, depth: 1.8, arched: true},
  {edge: 2, t: .5, setback: 2.0, width: 1.5, depth: 1.6, arched: false},
  {edge: 5, t: .645, setback: 2.0, width: 1.5, depth: 1.6, arched: false},
] as const;

export function roofHeight(x: number, z: number, shape: RoofShape = surveyRoof) {
  const triangles = roofTriangles(shape);
  for (const [a, b, c] of triangles.flat()) {
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / det;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / det;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) return u * a[2] + v * b[2] + (1 - u - v) * c[2];
  }
  throw Error('Kesk 13 vent outside survey roof');
}

function ventFrame(d: typeof roofVents[number], shape: RoofShape) {
  const eaves = shape.eaves;
  const a = eaves[d.edge], b = eaves[(d.edge + 1) % eaves.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
  function point(u: number, s: number, lift = 0): SurveyPoint {
    const x = a[0] + (b[0] - a[0]) * d.t + ux * u - uz * (d.setback + s);
    const z = a[1] + (b[1] - a[1]) * d.t + uz * u + ux * (d.setback + s);
    return [x, z, roofHeight(x, z, shape) + lift];
  }
  return {point, ux, uz};
}

export function addVentedRoof(vertex: Emit, infill: Emit, part: Part, shape: RoofShape = surveyRoof) {
  const triangles = roofTriangles(shape);
  const footprints = roofVents.map(d => {
    const {point} = ventFrame(d, shape), r = d.width / 2;
    return d.arched ? [point(-r, 0), point(r, 0), point(0, d.depth)] : [point(-r, 0), point(r, 0), point(r, d.depth), point(-r, d.depth)];
  });
  for (const [index, plane] of triangles.entries()) {
    part(`roof-${index}`, `Roof plane ${index + 1}`);
    let pieces: number[][][] = plane.map(tri => tri.map(p => [...p]));
    for (const footprint of footprints) {
      const next: number[][][] = [];
      for (const polygon of pieces) {
        let remaining = polygon;
        for (let i = 0; i < footprint.length && remaining.length; i++) {
          const a = footprint[i], b = footprint[(i + 1) % footprint.length];
          const [inside, outside] = splitPolygon(remaining, p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
          if (outside.length >= 3) next.push(outside);
          remaining = inside;
        }
      }
      pieces = next;
    }
    for (const polygon of pieces) for (let i = 1; i < polygon.length - 1; i++) {
      [polygon[0], polygon[i], polygon[i + 1]].forEach(p => vertex(p as unknown as SurveyPoint));
    }
  }
  roofVents.forEach((d, index) => {
    const {point, ux, uz} = ventFrame(d, shape), r = d.width / 2;
    const name = `Roof vent ${index + 1}`, id = `vent-${index}`;
    function surface(points: SurveyPoint[], normal: number[], emit = vertex) {
      for (let i = 1; i < points.length - 1; i++) {
        const [a, b, c] = [points[0], points[i], points[i + 1]];
        const ab = new THREE.Vector3(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
        const ac = new THREE.Vector3(c[0] - a[0], c[2] - a[2], c[1] - a[1]);
        const cross = ab.cross(ac);
        if (cross.lengthSq() < 1e-16) continue;
        (cross.dot(new THREE.Vector3(...normal)) >= 0 ? [a, b, c] : [a, c, b]).forEach(emit);
      }
    }
    const profile = d.arched ? Array.from({length: 13}, (_, i) => {
      const angle = Math.PI - i * Math.PI / 12;
      return [r * Math.cos(angle), .15 + r * Math.sin(angle)];
    }) : [[-r, .55], [r, .55]];
    const front = [[-r, 0], ...profile, [r, 0]];
    const inset = front.map(([u, h]) => [u * (r - .08) / r, h === 0 ? .08 : d.arched ? .15 + (h - .15) * (r - .08) / r : .47]);
    const p = (u: number, h: number, depth = 0): SurveyPoint => {
      const base = point(u, 0), at = point(u, depth);
      return [at[0], at[1], base[2] + h];
    };
    part(id + '/hood', name + ' hood');
    for (let i = 1; i < profile.length; i++) {
      const [a, ha] = profile[i - 1], [b, hb] = profile[i];
      const backA = point(d.arched ? 0 : a, d.depth), backB = point(d.arched ? 0 : b, d.depth);
      surface([p(a, ha), p(b, hb), backB, backA], [0, 1, 0]);
    }
    for (const sign of [-1, 1]) {
      const h = d.arched ? .15 : .55;
      surface([point(sign * r, 0), p(sign * r, h), point(d.arched ? 0 : sign * r, d.depth)], [sign * ux, 0, sign * uz]);
    }
    part(id + '/reveal', name + ' opening reveal');
    for (let i = 0; i < front.length; i++) {
      const j = (i + 1) % front.length;
      surface([p(front[i][0], front[i][1]), p(front[j][0], front[j][1]), p(inset[j][0], inset[j][1]), p(inset[i][0], inset[i][1])], [uz, 0, -ux]);
      const du = inset[j][0] - inset[i][0], dh = inset[j][1] - inset[i][1];
      surface([p(inset[i][0], inset[i][1]), p(inset[j][0], inset[j][1]), p(inset[j][0], inset[j][1], .12), p(inset[i][0], inset[i][1], .12)], [dh * ux, -du, dh * uz]);
    }
    part(id + '/infill', name + ' recessed infill');
    surface(inset.map(([u, h]) => p(u, h, .12)), [uz, 0, -ux], infill);
  });
}
