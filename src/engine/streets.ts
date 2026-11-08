import type {Point2, RoadType, SiteRoad, SurfaceFinish} from './types.ts';

// osm2streets makes every driving lane 3 m, so the lanes give the width.
export const ROAD_TAGS: Record<RoadType, Record<string, string>> = {
  main: {highway: 'tertiary', lanes: '2', surface: 'asphalt'},
  residential: {highway: 'residential', lanes: '2', surface: 'asphalt'},
  service: {highway: 'service', lanes: '1', surface: 'asphalt'},
  sidewalk: {highway: 'footway', surface: 'paving_stones'},
  'kerbed-path': {highway: 'footway', surface: 'asphalt'},
  'asphalt-path': {highway: 'footway', surface: 'asphalt'},
  'gravel-path': {highway: 'footway', surface: 'gravel'},
  'tiled-path': {highway: 'footway', surface: 'concrete:plates'},
  'worn-path': {highway: 'path', surface: 'ground'},
};
export const ROAD_WIDTH: Record<RoadType, number> = {main: 7, residential: 6, service: 3.5, sidewalk: 2, 'kerbed-path': 2, 'asphalt-path': 1.8, 'gravel-path': 1.5, 'worn-path': .9, 'tiled-path': 2};
export const PATH_FINISH: Partial<Record<RoadType, SurfaceFinish>> = {sidewalk: 'paving', 'kerbed-path': 'asphalt', 'asphalt-path': 'asphalt', 'gravel-path': 'gravel', 'worn-path': 'worn-grass', 'tiled-path': 'worn-paving'};

export const tileCount = (tiles = 4) => Math.max(1, Math.min(6, Math.round(Number.isFinite(tiles) ? tiles : 4)));
export const roadWidth = (road: Pick<SiteRoad, 'type' | 'tiles' | 'width'>) => road.type === 'tiled-path' ? tileCount(road.tiles) * .5 : road.width ?? ROAD_WIDTH[road.type];
// This osm2streets version builds every mapped footway and path this wide.
export const OSM_PATH_WIDTH = 2;
export const KERB = {width: .15, height: .12};
type PathRoad = Pick<SiteRoad, 'type' | 'tiles' | 'width' | 'ends' | 'kerbs' | 'kerb'>;
// A join eases over three times the change in width, at least 1.5 m, and never past the path's middle.
const taperLength = (change: number, total: number) => Math.min(total / 2, Math.max(1.5, Math.abs(change) * 3));
const smooth = (t: number) => t * t * (3 - 2 * t);

// The course a path is outlined along and its half-width at each point. Plain paths keep
// their clicked points; worn ones wander in width and tapering ones are sampled for a smooth ease.
function pathCourse(road: PathRoad, points: Point2[]) {
  const width = roadWidth(road), half = width / 2, [from, to] = road.ends ?? [];
  const tapers = (from != null && from !== width) || (to != null && to !== width);
  if (road.type !== 'worn-path' && !tapers) return {course: points, half: points.map(() => half), sides: null};
  const sampled: Point2[] = [], along: number[] = [];
  let distance = 0;
  const widths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(length / (road.type === 'worn-path' ? .6 : .5)));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, d = distance + length * t;
      sampled.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      along.push(d);
      widths.push(road.type === 'worn-path' ? .84 + .12 * Math.sin(d * 2.1) + .04 * Math.sin(d * 5.3) : 1);
    }
    distance += length;
  }
  if (!sampled.length) return {course: [], half: [], sides: null};
  sampled.push(points[points.length - 1]); widths.push(widths[widths.length - 1]); along.push(distance);
  if (tapers) along.forEach((d, i) => {
    let w = width;
    if (from != null && from !== width) { const l = taperLength(from - width, distance); if (d < l) w = from + (width - from) * smooth(d / l); }
    if (to != null && to !== width) { const l = taperLength(to - width, distance); if (distance - d < l) w = to + (w - to) * smooth((distance - d) / l); }
    widths[i] *= w / width;
  });
  return {course: sampled, half: widths.map(w => half * w), sides: widths};
}
// The ring of a path's surface, source or local x/z as its points are.
export function pathOutline(road: PathRoad, points: Point2[]): Point2[] {
  const {course, sides} = pathCourse(road, points), half = roadWidth(road) / 2;
  if (!course.length) return [];
  if (!sides) return [...offsetLine(course, half), ...offsetLine(course, -half).reverse()];
  const side = (sign: number) => offsetLine(course, sign * half).map((p, i): Point2 => [course[i][0] + (p[0] - course[i][0]) * sides[i], course[i][1] + (p[1] - course[i][1]) * sides[i]]);
  return [...side(1), ...side(-1).reverse()];
}
// The centre lines of a path's kerbs, standing just outside its edges, with their size.
export function pathKerbs(road: PathRoad, points: Point2[]) {
  if (!road.kerbs || !PATH_FINISH[road.type]) return [];
  const {course, half} = pathCourse(road, points), width = road.kerb?.width ?? KERB.width, height = road.kerb?.height ?? KERB.height;
  if (course.length < 2) return [];
  // In source x/z seen from above, offsetLine's positive side is on the walker's right.
  return (road.kerbs === 'both' ? [-1, 1] : road.kerbs === 'left' ? [-1] : [1]).map(sign => ({
    width, height,
    points: offsetLine(course, sign).map((p, i): Point2 => { const out = half[i] + width / 2; return [course[i][0] + (p[0] - course[i][0]) * out, course[i][1] + (p[1] - course[i][1]) * out]; }),
  }));
}
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

export function pathCoordinates(points: Point2[], width: number, x: number, z: number): Point2 {
  let best = Infinity, travelled = 0, result: Point2 = [x, z];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length ** 2));
    const distance = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (distance < best) { best = distance; result = [((x - a[0]) * -dz + (z - a[1]) * dx) / length + width / 2, travelled + t * length]; }
    travelled += length;
  }
  return result;
}
