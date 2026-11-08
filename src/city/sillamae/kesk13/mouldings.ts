import * as THREE from 'three';
import {baseElevation, type SurveyPoint} from './design.ts';
import {wallCorners} from './cornice.ts';
import type {OpeningDetail} from './joinery.ts';
import {hasGarland} from './street.ts';
type Emit = (p: SurveyPoint) => void;
type Part = (id: string, name: string) => void;

function geometry(g: THREE.BufferGeometry, point: (x: number, y: number, d: number) => SurveyPoint, emit: Emit) {
  const p = g.attributes.position, index = g.index;
  for (let i = 0; i < (index?.count ?? p.count); i++) {const j = index ? index.getX(i) : i; emit(point(p.getX(j), p.getY(j), p.getZ(j)));}
  g.dispose();
}

export function addMouldings(o: OpeningDetail, edge: number, emit: Emit, part: Part, ornament = false, complete = false) {
  if (o.kind === 'door') return;
  const {left: l, right: r, bottom: b, top: t} = o, street = edge === 0 || edge === 7;
  function box(x0: number, x1: number, y0: number, y1: number, front: number, back = .015) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, back - front);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (front + back) / 2); geometry(g, o.point, emit);
  }
  // Street View May 2024: plain street windows are bare reveals with a sill; only the garland bays and balconies are framed.
  const framed = !(complete && street && o.kind === 'window' && !hasGarland(edge, o.bay));
  if (framed) {
    part(o.id + '/moulding', o.label + ' plaster surround');
    const jamb = street ? .10 : .06;
    box(l - jamb, l, b, t, street ? -.045 : -.025);
    box(r, r + jamb, b, t, street ? -.045 : -.025);
    box(l - jamb, r + jamb, t, t + .11, -.06);
  }
  if (framed && street && o.upper && (!ornament || o.kind === 'balcony' || (complete ? hasGarland(edge, o.bay) : (edge === 0 && o.bay === 2) || (edge === 7 && o.bay === 9)))) {
    box(l - .16, r + .16, t + .11, t + .19, -.11);
    box(l - .20, r + .20, t + .19, t + .24, -.15);
  }
  if (o.kind === 'window') {
    part(o.id + '/sill', o.label + ' projecting sill');
    box(l - .12, r + .12, b - .075, b, -.16, .18);
    box(l - .12, r + .12, b - .115, b - .075, -.16, -.11);
  }
  if (ornament || !o.upper || !((edge === 0 && o.bay === 2) || (edge === 7 && o.bay === 9))) return;
  part(o.id + '/garland', o.label + ' garland relief');
  const centre = (l + r) / 2, width = r - l - .1, y = b - .24;
  for (let k = 0; k < 2; k++) {
    const pts = Array.from({length: 13}, (_, i) => {const u = i / 12; return new THREE.Vector3(centre - width / 2 + u * width, y - .38 * Math.sin(Math.PI * u) - k * .075, -.035);});
    geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .055, 6, false), o.point, emit);
  }
  for (const sign of [-1, 1]) {
    const g = new THREE.SphereGeometry(1, 8, 6);g.scale(.085, .12, .06);g.translate(centre + sign * width / 2, y, -.025);geometry(g, o.point, emit);
  }
}

export function addCornerRustication(emit: Emit, part: Part) {
  const walls = wallCorners(), c = walls[0], prev = walls[7], next = walls[1];
  const unit = (p: SurveyPoint) => {const length = Math.hypot(p[0] - c[0], p[1] - c[1]); return [(p[0] - c[0]) / length, (p[1] - c[1]) / length];};
  const u = unit(prev), v = unit(next), n = [u[1], -u[0]], m = [-v[1], v[0]], projection = .055;
  const k = projection / (1 + n[0] * m[0] + n[1] * m[1]);
  const count = 20, pitch = (c[2] - .20 - baseElevation) / count;
  for (let row = 0; row < count; row++) {
    part(`corner-0/course-${row}`, `Street corner quoin ${row + 1}`);
    const width = row % 2 ? .50 : .58;
    const a = [c[0] + u[0] * width, c[1] + u[1] * width], b = [c[0] + v[0] * width, c[1] + v[1] * width];
    const polygon = [a, [c[0], c[1]], b, [b[0] - m[0] * projection, b[1] - m[1] * projection], [c[0] - (n[0] + m[0]) * k, c[1] - (n[1] + m[1]) * k], [a[0] - n[0] * projection, a[1] - n[1] * projection]];
    const shape = new THREE.Shape(polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, {depth: pitch - .025, bevelEnabled: false});
    geometry(g, (x, minusZ, h) => [x, -minusZ, baseElevation + row * pitch + .0125 + h], emit);
  }
}
