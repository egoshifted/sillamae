import * as THREE from 'three';
import {wallCorners} from './cornice.ts';
import {eaves, type SurveyPoint} from './design.ts';
import type {OpeningDetail} from './joinery.ts';
type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;
function emitGeometry(g: THREE.BufferGeometry, point: (x: number, h: number, d: number) => SurveyPoint, emit: Emit, reverse = false) {
  const p = g.attributes.position, index = g.index;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) for (const offset of reverse ? [0, 2, 1] : [0, 1, 2]) {
    const j = index ? index.getX(i + offset) : i + offset;emit(point(p.getX(j), p.getY(j), p.getZ(j)));
  }
}
function box(x0: number, x1: number, y0: number, y1: number, d0: number, d1: number, point: (x: number, h: number, d: number) => SurveyPoint, emit: Emit) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0);g.translate((x0 + x1) / 2, (y0 + y1) / 2, (d0 + d1) / 2);emitGeometry(g, point, emit);g.dispose();
}
export function addEntranceFrame(o: OpeningDetail, emit: Emit, part: Part) {
  if (o.kind !== 'door') return;
  part(o.id + '/entrance-frame', o.label + ' entrance frame');
  const {left: l, right: r, bottom: b, top: t} = o;
  box(l, l + .075, b, t, .08, .18, o.point, emit);box(r - .075, r, b, t, .08, .18, o.point, emit);
  box(l + .075, r - .075, t - .075, t, .08, .18, o.point, emit);
}
export const downpipes = [{edge: 0, fraction: .22}, {edge: 7, fraction: .78}, {edge: 2, fraction: .80}] as const;
// Each street front drains through three pipes between the bays (Street View May 2024).
export const streetDownpipes = [
  {edge: 7, fraction: .22}, {edge: 7, fraction: .50}, {edge: 7, fraction: .78},
  {edge: 0, fraction: .13}, {edge: 0, fraction: .50}, {edge: 0, fraction: .87}, {edge: 2, fraction: .80},
] as const;
export function addDownpipes(emit: Emit, part: Part, plinthTop?: number, eavePoints: readonly SurveyPoint[] = eaves, pipes: readonly {edge: number; fraction: number}[] = downpipes) {
  const walls = wallCorners(eavePoints);
  for (const [index, {edge, fraction}] of pipes.entries()) {
    const a = walls[edge], b = walls[(edge + 1) % walls.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length, x = fraction * length;
    const point = (u: number, h: number, d: number): SurveyPoint => [a[0] + dx * u - dz * d, a[1] + dz * u + dx * d, h];
    const top = a[2] + (b[2] - a[2]) * fraction - .17;
    const upper = [new THREE.Vector3(x, top, -.27), new THREE.Vector3(x, top - .22, -.27), new THREE.Vector3(x, top - .48, -.115), new THREE.Vector3(x, top - .68, -.115)];
    const lower = plinthTop === undefined ? [new THREE.Vector3(x, 15.65, -.115), new THREE.Vector3(x, 15.58, -.115), new THREE.Vector3(x, 15.46, -.18), new THREE.Vector3(x, 15.36, -.30)] : [new THREE.Vector3(x, plinthTop+.35, -.115), new THREE.Vector3(x, plinthTop+.20, -.16), new THREE.Vector3(x, plinthTop+.05, -.25), new THREE.Vector3(x, 15.36, -.30)];
    const curve = new THREE.CurvePath<THREE.Vector3>();
    curve.add(new THREE.CatmullRomCurve3(upper));
    curve.add(new THREE.LineCurve3(upper[3], lower[0]));
    curve.add(new THREE.CatmullRomCurve3(lower));
    const id = pipes === downpipes ? `drain-${edge}` : `drain-${edge}-${index}`;
    part(id + '/pipe', `Edge ${edge} downpipe`);
    const segments = 56, radial = 10;
    const outer = new THREE.TubeGeometry(curve, segments, .045, radial, false), inner = new THREE.TubeGeometry(curve, segments, .037, radial, false);
    emitGeometry(outer, point, emit);emitGeometry(inner, point, emit, true);
    const op = outer.attributes.position, ip = inner.attributes.position;
    for (const end of [0, segments]) for (let j = 0; j < radial; j++) {
      const k = end * (radial + 1) + j;
      const p = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => point(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
      const ring = [p(op, k), p(op, k + 1), p(ip, k + 1), p(ip, k)];
      (end === 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]).forEach(i => emit(ring[i]));
    }
    outer.dispose();inner.dispose();
    part(id + '/brackets', `Edge ${edge} downpipe brackets`);
    for (const h of [16.3, 19.0, 22.0]) {
      // Long straight spans are sampled from the same curve so collars cannot drift from the pipe.
      let best = 0, distance = Infinity;
      for (let i = 0; i <= 1000; i++) {const d = Math.abs(curve.getPointAt(i / 1000).y - h);if (d < distance) {distance = d;best = i / 1000;}}
      const c = curve.getPointAt(best);
      const ring = new THREE.TorusGeometry(.047, .008, 5, 10);ring.rotateX(Math.PI / 2);ring.translate(c.x, c.y, c.z);
      emitGeometry(ring, point, emit);ring.dispose();
      box(x - .02, x + .02, c.y - .025, c.y + .025, c.z, .01, point, emit);
    }
  }
}
