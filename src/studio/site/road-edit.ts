import * as THREE from 'three';
import type {Point2, RoadCut, RoadType, SiteRoad} from '../../engine/types.ts';
import {PATH_FINISH, SNAP} from '../../engine/streets.ts';
import {contains} from '../../engine/road-demolition.ts';

export function nearestRoadEnd(roads: SiteRoad[], at: Point2, type: RoadType, exclude?: string, cuts: RoadCut[] = [], accepts: (point: Point2) => boolean = () => true) {
  const walking = !!PATH_FINISH[type], kind = walking ? 'footway' : 'carriageway';
  let distance = walking ? 2 : SNAP, best: Point2 | undefined;
  for (const road of roads) {
    if (road.id === exclude || !!PATH_FINISH[road.type] !== walking || road.points.length < 2) continue;
    for (const point of [road.points[0], road.points[road.points.length - 1]]) {
      if (!accepts(point)) continue;
      if (cuts.some(c => c.kind === kind && contains(c.ring, ...point))) continue;
      const d = Math.hypot(point[0] - at[0], point[1] - at[1]);
      if (d <= distance) { distance = d; best = point; }
    }
  }
  return best && [...best] as Point2;
}

export function extendRoad(points: Point2[], end: 0 | 1, target: Point2): Point2[] {
  const course = points.map(p => [...p] as Point2);
  if (end === 0) course.reverse();
  const a = course.at(-2), b = course.at(-1);
  if (!a || !b || Math.hypot(target[0] - b[0], target[1] - b[1]) < .05) return points.map(p => [...p]);
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const along = ((target[0] - a[0]) * dx + (target[1] - a[1]) * dz) / (length || 1);
  const across = Math.abs((target[0] - a[0]) * dz - (target[1] - a[1]) * dx) / (length || 1);
  if (along > .05 && across < .05) course[course.length - 1] = [...target];
  else if (along < 0 && across < .05) return points.map(p => [...p]);
  else course.push([...target]);
  return end === 0 ? course.reverse() : course;
}

// The courses left after removing `length` metres of course centred on the point
// nearest `at`; remnants shorter than `shortest` go too.
export function clearSection(points: Point2[], at: Point2, length = 2, shortest = .3): Point2[][] {
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  let centre = 0, best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - az) * dz) / l2)) : 0;
    const d = Math.hypot(ax + t * dx - at[0], az + t * dz - at[1]);
    if (d < best) { best = d; centre = along[i - 1] + t * (along[i] - along[i - 1]); }
  }
  const total = along[along.length - 1];
  const point = (s: number): Point2 => {
    const i = Math.max(1, along.findIndex(a => a >= s)), span = along[i] - along[i - 1], t = span ? (s - along[i - 1]) / span : 0;
    return [points[i - 1][0] + t * (points[i][0] - points[i - 1][0]), points[i - 1][1] + t * (points[i][1] - points[i - 1][1])];
  };
  const course = (from: number, to: number): Point2[] => [point(from), ...points.filter((_, i) => along[i] > from && along[i] < to).map(p => [...p] as Point2), point(to)];
  return [[0, centre - length / 2], [centre + length / 2, total]].filter(([from, to]) => to - from >= shortest).map(([from, to]) => course(from, to));
}

export function roadBoundary(rings: Point2[][]): [Point2, Point2][] {
  const vertices = rings.flat(), edges: [Point2, Point2][] = [], seen = new Set<string>();
  const inside = (x: number, z: number) => rings.some(r => contains(r, x, z));
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const ts = [0, 1];
    for (const p of vertices) {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length ** 2;
      if (t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / length < 1e-6) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    const at = (t: number): Point2 => [a[0] + t * dx, a[1] + t * dz];
    for (let j = 1; j < ts.length; j++) {
      if ((ts[j] - ts[j - 1]) * length < 1e-6) continue;
      const [x, z] = at((ts[j] + ts[j - 1]) / 2), nx = -dz / length * .001, nz = dx / length * .001;
      if (inside(x + nx, z + nz) === inside(x - nx, z - nz)) continue;
      const edge: [Point2, Point2] = [at(ts[j - 1]), at(ts[j])];
      const key = edge.map(p => p.map(v => v.toFixed(5)).join(',')).sort().join(';');
      if (!seen.has(key)) { seen.add(key); edges.push(edge); }
    }
  }
  return edges;
}

export function insideEndpointMarker(ray: THREE.Ray, centre: THREE.Vector3, radius: number) {
  const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -centre.y), new THREE.Vector3());
  return !!hit && Math.hypot(hit.x - centre.x, hit.z - centre.z) <= radius;
}
