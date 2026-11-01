import type {Point2, RoadType} from './types.ts';

// Street types the studio draws, as OpenStreetMap tags osm2streets builds from.
// osm2streets makes every driving lane 3 m, so the lanes give the width.
export const ROAD_TAGS: Record<RoadType, Record<string, string>> = {
  main: {highway: 'tertiary', lanes: '2', surface: 'asphalt'},
  residential: {highway: 'residential', lanes: '2', surface: 'asphalt'},
  service: {highway: 'service', lanes: '1', surface: 'asphalt'},
};
export const ROAD_WIDTH: Record<RoadType, number> = {main: 7, residential: 6, service: 3.5}; // metres, for previews
export const FOOTWAY = {offset: 1.5, width: 2}; // metres beyond the carriageway edge, and wide
// Metres within which a drawn road's end joins an existing street.
export const SNAP = 8;
// OSM highway types that carry traffic, which drawn roads may join.
export const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

// The nearest point on any of the lines to x/z, if within reach: the line, the
// segment it lies on, how far along it, and the point.
export function nearestOn(lines: Point2[][], x: number, z: number, reach = SNAP) {
  let best: {line: number; segment: number; t: number; point: Point2; distance: number} | null = null;
  lines.forEach((points, line) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const point: Point2 = [ax + t * dx, az + t * dz], distance = Math.hypot(x - point[0], z - point[1]);
      if (distance <= reach && (!best || distance < best.distance)) best = {line, segment: i - 1, t, point, distance};
    }
  });
  return best as {line: number; segment: number; t: number; point: Point2; distance: number} | null;
}

// A line moved sideways by offset metres (left of its direction for positive), mitred at corners.
export function offsetLine(points: Point2[], offset: number): Point2[] {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const before = i > 0 ? norm(p[0] - a[0], p[1] - a[1]) : null, after = i < points.length - 1 ? norm(b[0] - p[0], b[1] - p[1]) : null;
    const d = before && after ? norm(before[0] + after[0], before[1] + after[1]) ?? after : (after ?? before)!;
    const side: Point2 = [-d[1], d[0]], cos = before && after ? Math.max(.3, side[0] * -before[1] + side[1] * before[0]) : 1;
    return [p[0] + side[0] * offset / cos, p[1] + side[1] * offset / cos];
  });
}
function norm(x: number, z: number): Point2 | null { const l = Math.hypot(x, z); return l < 1e-9 ? null : [x / l, z / l]; }

// Rounds corners: a Catmull-Rom curve through the points, sampled every step metres.
export function smoothLine(points: Point2[], step = 3): Point2[] {
  if (points.length < 3) return points;
  const out: Point2[] = [points[0]], p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]], n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as Point2);
    }
  }
  return out;
}
