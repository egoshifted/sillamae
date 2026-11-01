import * as THREE from 'three';
import type {RoadSurface} from '../../engine/data.ts';
import {LINE_HEIGHT, lineMeshes, standLine} from '../../engine/lines.ts';
import {addRoads} from '../../engine/roads.ts';
import type {Point2, SiteLine, SiteSurface} from '../../engine/types.ts';
import {usePhysicalDepth} from '../depth.ts';

const CELL = 3; // metres; as the data build, areas are cut into cells so their middles follow the ground
const RISE = .03; // metres over the ground the preview draws at

// Sutherland-Hodgman against one axis-aligned cell; a concave ring clips correctly against a convex window.
function clip(ring: Point2[], minX: number, minZ: number, maxX: number, maxZ: number) {
  let out = ring;
  const edges: [(p: Point2) => boolean, (a: Point2, b: Point2) => Point2][] = [
    [p => p[0] >= minX, (a, b) => [minX, a[1] + (b[1] - a[1]) * (minX - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= maxX, (a, b) => [maxX, a[1] + (b[1] - a[1]) * (maxX - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= minZ, (a, b) => [a[0] + (b[0] - a[0]) * (minZ - a[1]) / (b[1] - a[1]), minZ]],
    [p => p[1] <= maxZ, (a, b) => [a[0] + (b[0] - a[0]) * (maxZ - a[1]) / (b[1] - a[1]), maxZ]],
  ];
  for (const [inside, cross] of edges) {
    const next: Point2[] = [];
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length];
      if (inside(p)) { next.push(p); if (!inside(q)) next.push(cross(p, q)); }
      else if (inside(q)) next.push(cross(p, q));
    });
    out = next;
    if (out.length < 3) return [];
  }
  return out;
}
const area = (r: Point2[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
function densify(ring: Point2[], step = 1) {
  return ring.flatMap((p, i) => {
    const q = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    return Array.from({length: n}, (_, k): Point2 => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]);
  });
}

// The preview of the square's areas and lines, in the local frame, rebuilt whole after each change.
export function detailPreview(surfaces: SiteSurface[], lines: SiteLine[], origin: Point2, height: (x: number, z: number) => number, anisotropy: number) {
  const [ox, oz] = origin, group = new THREE.Group(), scratch = new THREE.Scene();
  const local = (ring: Point2[]) => ring.map(([x, z]): Point2 => [x - ox, z - oz]);
  const laid: RoadSurface[] = [];
  for (const s of surfaces) {
    const ring = local(s.ring), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let x = Math.floor(Math.min(...xs) / CELL) * CELL; x < Math.max(...xs); x += CELL)
      for (let z = Math.floor(Math.min(...zs) / CELL) * CELL; z < Math.max(...zs); z += CELL) {
        const cell = clip(ring, x, z, x + CELL, z + CELL);
        if (cell.length < 3 || area(cell) < .01) continue;
        laid.push({kind: 'footway', lift: 0, surface: s.finish, ring: densify(cell).map(([px, pz]): [number, number, number] => [px, height(px, pz) + RISE, pz])});
      }
  }
  if (laid.length) group.add(addRoads(scratch, laid, anisotropy));
  if (lines.length) group.add(lineMeshes(lines.map(l => ({kind: l.kind, height: l.height ?? LINE_HEIGHT[l.kind], points: standLine(local(l.points), height)})), {lifted: false}));
  usePhysicalDepth(group);
  return group;
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); }
  });
  group.removeFromParent();
}

export function inRing(ring: Point2[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > z) !== (ring[j][1] > z) && x < (ring[j][0] - ring[i][0]) * (z - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
  return inside;
}

export function distanceToLine(points: Point2[], x: number, z: number) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

export const centroid = (points: Point2[]): Point2 => [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
