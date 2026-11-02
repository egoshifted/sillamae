import type {BuiltLine, RoadSurface} from './data.ts';
import type {Point2} from './types.ts';
import {contains} from './road-demolition.ts';

const CELL = 5;
const SLIVER = .05; // metres
// Metres beyond a path edge to look for the road. A path drawn straight beside a curving
// road leaves a strip of a few centimetres to decimetres that still wants its kerb.
const REACH = [.08, .35];
function coverage(rings: Point2[][]) {
  const cells = new Map<string, Point2[][]>();
  for (const ring of rings) {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
      for (let z = Math.floor(Math.min(...zs) / CELL); z <= Math.floor(Math.max(...zs) / CELL); z++) {
        const key = `${x},${z}`, list = cells.get(key) ?? [];
        list.push(ring); cells.set(key, list);
      }
  }
  return (x: number, z: number) => (cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []).some(r => contains(r, x, z));
}

export function snapToRoadEdge(rings: Point2[][], at: Point2, halfWidth: number, reach = 4): Point2 | undefined {
  const inside = coverage(rings);
  let best = reach, point: Point2 | undefined;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 1e-5) continue;
    const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dz) / length ** 2));
    const x = a[0] + t * dx, z = a[1] + t * dz, nx = -dz / length, nz = dx / length;
    const left = inside(x + nx * .02, z + nz * .02), right = inside(x - nx * .02, z - nz * .02);
    if (left === right) continue; // Tiled road polygons have internal edges that cannot accept a footpath.
    const side = left ? -1 : 1, p: Point2 = [x + side * nx * halfWidth, z + side * nz * halfWidth];
    const distance = Math.hypot(p[0] - at[0], p[1] - at[1]);
    if (distance < best && !inside(...p)) { best = distance; point = p; }
  }
  return point;
}

export function roadKerbs(surfaces: RoadSurface[], context: RoadSurface[] = []): (BuiltLine & {lift: number})[] {
  const paths = surfaces.filter(s => s.kerbed && s.kind === 'footway' && !s.groundColour);
  if (!paths.length) return [];
  const flat = (s: RoadSurface): Point2[] => s.ring.map(([x, , z]) => [x, z]);
  const inPath = coverage(paths.map(flat)), inRoad = coverage([...surfaces, ...context].filter(s => s.kind === 'carriageway').map(flat));
  // Where surfaces overlap, as a path draped over stacked survey layers does, only the top copy keeps its kerb.
  const top = new Map<string, BuiltLine & {lift: number}>();
  for (const {ring, lift} of paths) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    // Draping leaves centimetre slivers where fragments meet the outline; their sides cannot be told apart.
    if (length < SLIVER) continue;
    const nx = -dz / length, nz = dx / length, count = Math.ceil(length / .25);
    for (let k = 0; k < count; k++) {
      const t = (k + .5) / count, x = a[0] + t * dx, z = a[2] + t * dz;
      const left = inPath(x + nx * .02, z + nz * .02), right = inPath(x - nx * .02, z - nz * .02);
      if (left === right) continue;
      const side = left ? -1 : 1;
      if (!REACH.some(d => inRoad(x + side * nx * d, z + side * nz * d))) continue;
      const at = (t: number): [number, number, number] => [a[0] + t * dx - side * nx * .075, a[1] + t * (b[1] - a[1]), a[2] + t * dz - side * nz * .075];
      const line = {lift, kind: 'kerb' as const, height: .12, points: [at(k / count), at((k + 1) / count)]}, key = `${Math.round(x * 50)},${Math.round(z * 50)}`;
      const kept = top.get(key);
      if (!kept || line.points[0][1] + line.points[1][1] > kept.points[0][1] + kept.points[1][1]) top.set(key, line);
    }
  }
  return [...top.values()];
}
