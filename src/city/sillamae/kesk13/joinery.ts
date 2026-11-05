import * as THREE from 'three';
import type {SurveyPoint} from './design.ts';

export interface OpeningDetail {
  id: string;
  label: string;
  kind: 'window' | 'balcony' | 'door';
  bay: number;
  upper: boolean;
  left: number;
  right: number;
  bottom: number;
  top: number;
  courtyard: boolean;
  point(x: number, y: number, depth?: number): SurveyPoint;
}
type Emit = (p: SurveyPoint) => void;

export function addJoinery(o: OpeningDetail, edge: number, white: Emit, brown: Emit, iron: Emit, part: (id: string, name: string) => void, ornament = false, courtyardDetail = false, complete = false) {
  if (o.kind === 'door') return;
  const dark = ((edge === 0 || edge === 7) && o.upper) || (edge === 2 && o.upper && o.bay === 3) || (edge === 5 && o.upper && o.bay === 5);
  const frame = complete && edge===0 ? white : (ornament && edge === 7 && o.upper ? o.bay >= 7 : dark) ? brown : white;
  function box(x0: number, x1: number, y0: number, y1: number, d0: number, d1: number, emit: Emit) {
    const geometry = new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0);
    const p = geometry.attributes.position, indices = geometry.index!;
    for (let i = 0; i < indices.count; i++) {
      const j = indices.getX(i);
      emit(o.point(p.getX(j) + (x0 + x1) / 2, p.getY(j) + (y0 + y1) / 2, p.getZ(j) + (d0 + d1) / 2));
    }
    geometry.dispose();
  }
  const {left: l, right: r, bottom: b, top: t} = o, mid = (l + r) / 2, f = .07;
  part(o.id + '/frame', o.label + ' frame');
  box(l, l + f, b, t, .10, .18, frame); box(r - f, r, b, t, .10, .18, frame);
  box(l + f, r - f, b, b + f, .10, .18, frame); box(l + f, r - f, t - f, t, .10, .18, frame);
  const transom = t - (t - b) * .24;
  box(l + f, r - f, transom - .035, transom + .035, .105, .18, frame);
  const divisions=complete && !o.upper && (edge===0||edge===7) && (o.bay===4||o.bay===7) ? [l+(r-l)/3,l+(r-l)*2/3] : [mid];
  for (const x of divisions) for (const [low, high] of [[b + f, transom - .035], [transom + .035, t - f]]) box(x - .03, x + .03, low, high, .105, .18, frame);
  if (o.kind !== 'balcony') return;
  part(o.id + '/door-panels', o.label + ' balcony door lower panels');
  for (const [x0, x1] of [[l + f, mid - .03], [mid + .03, r - f]]) box(x0, x1, b + f, b + .54, .12, .18, frame);
  const half = o.courtyard ? 1.05 : 1.30, projection = o.courtyard ? .65 : .85;
  const x0 = mid - half + .06, x1 = mid + half - .06, front = -projection + .06, rear = -.025;
  part(o.id + '/rails', o.label + ' balcony rails');
  for (const x of [x0, x1]) for (const d of [front, rear]) box(x - .025, x + .025, b, b + .95, d - .025, d + .025, iron);
  for (const [height, thickness] of (ornament && (!o.courtyard || courtyardDetail) ? [[.95, .045], [.14, .03]] : [[.95, .045], [.72, .025], [.14, .03]])) {
    box(x0 - .025, x1 + .025, b + height - thickness / 2, b + height + thickness / 2, front - .025, front + .025, iron);
    for (const x of [x0, x1]) box(x - .02, x + .02, b + height - thickness / 2, b + height + thickness / 2, front + .025, 0, iron);
  }
  const count = Math.ceil((x1 - x0) / .18);
  for (let i = 1; i < count; i++) {
    const x = x0 + (x1 - x0) * i / count;
    for (const [lo, hi] of (ornament && (!o.courtyard || courtyardDetail) ? [[.155, .9275]] : [[.155, .7075], [.7325, .9275]])) box(x - .011, x + .011, b + lo, b + hi, front - .011, front + .011, iron);
  }
  const sideCount = Math.ceil((rear - front) / .18);
  for (const x of [x0, x1]) for (let i = 1; i < sideCount; i++) {
    const d = front + (rear - front) * i / sideCount;
    for (const [lo, hi] of (ornament && (!o.courtyard || courtyardDetail) ? [[.155, .9275]] : [[.155, .7075], [.7325, .9275]])) box(x - .011, x + .011, b + lo, b + hi, d - .011, d + .011, iron);
  }
}
