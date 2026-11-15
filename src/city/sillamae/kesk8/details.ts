import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {design, detail, eastGable, frontispieceOpenings, length, type Opening, risers, slope, width, wingFace} from './design.ts';
import type {Finish} from './surfaces.ts';

type Outline = [number, number][];
type Plane = 'front' | 'rear' | 'east' | 'west' | 'wing' | 'across';
export interface Kit {
  add(name: string, geometry: THREE.BufferGeometry, finish: Finish): void;
  box(name: string, u0: number, u1: number, h0: number, h1: number, v0: number, v1: number, finish: Finish): void;
  prism(name: string, outline: Outline, plane: Plane, near: number, far: number, finish: Finish, holes?: Outline[]): void;
  walled(name: string, outline: Outline, plane: Plane, near: number, far: number, openings: Opening[], finish: Finish): void;
}
// Plan point (u, height, v) in model space, where z is -v.
type Point = [number, number, number];
const at = ([u, h, v]: Point) => new THREE.Vector3(u, h, -v);
const rectangle = (from: number, to: number, h0: number, h1: number): Outline => [[from, h0], [to, h0], [to, h1], [from, h1]];
const up = new THREE.Vector3(0, 1, 0);

// A bar of the given section between two points, its height kept vertical-ish along slopes.
function beam(a: THREE.Vector3, b: THREE.Vector3, thick: number, deep: number) {
  const x = b.clone().sub(a), length = x.length();
  x.normalize();
  const y = up.clone().sub(x.clone().multiplyScalar(x.dot(up))).normalize(), z = x.clone().cross(y);
  return new THREE.BoxGeometry(length, thick, deep).applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(.5)));
}

// Posts, two rails and a row of upright ovals following walking-surface points; `newels` index the points
// that carry a taller post with a ball finial.
function railing(points: Point[], newels: number[] = []) {
  const {height, foot, post, pitch, ring} = detail.rail, parts: THREE.BufferGeometry[] = [];
  const along = (p: Point, lift: number) => at([p[0], p[1] + lift, p[2]]);
  points.forEach((p, i) => {
    const tall = newels.includes(i);
    parts.push(beam(along(p, 0), along(p, tall ? detail.newel.height : height + .02), post, post));
    if (tall) parts.push(new THREE.SphereGeometry(detail.newel.ball, 8, 6).translate(p[0], p[1] + detail.newel.height + detail.newel.ball * .8, -p[2]));
  });
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], run = Math.hypot(b[0] - a[0], b[2] - a[2]);
    parts.push(beam(along(a, height), along(b, height), .04, .05), beam(along(a, foot), along(b, foot), .025, .025));
    const posts = Math.floor(run / pitch);
    for (let k = 1; k <= posts; k++) {
      const t = k / (posts + 1), p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      parts.push(beam(along(p, 0), along(p, height), post * .7, post * .7));
    }
    const x = new THREE.Vector3(b[0] - a[0], 0, a[2] - b[2]).normalize(), basis = new THREE.Matrix4().makeBasis(x, up, x.clone().cross(up));
    const half = (height - foot) / 2 * .92, count = Math.max(1, Math.round(run / ring.spacing));
    for (let k = 0; k < count; k++) {
      const t = (k + .5) / count, h = a[1] + (b[1] - a[1]) * t + (foot + height) / 2;
      const oval = new THREE.TorusGeometry(ring.radius, ring.tube, 3, 10).scale(1, half / ring.radius, 1).applyMatrix4(basis);
      parts.push(oval.translate(a[0] + (b[0] - a[0]) * t, h, -(a[2] + (b[2] - a[2]) * t)));
    }
  }
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return merged;
}

export function addDetails(kit: Kit) {
  const {add, prism, walled} = kit, {eave, ridge, plinth, frontispiece, wing, landing, stairs, westLanding} = design;
  const roofAt = (set: number) => eave + slope * set;
  const {cornice, verge} = detail, c = cornice;

  // Cornice section (outward from the face, height): a stepped moulding under a top that falls outward. Under
  // an eave the top follows the roof's underside, which drops `fall` metres a metre, or the cornice's outer
  // edge comes up through the sheets. Every run is extruded along its wall, so its cut ends show the moulding.
  const profile = (face: number, out: number, fall: number, top = eave - .01): Outline => {
    const x = (d: number) => face + out * d, outer = top - fall * c.depth;
    return [[face, top - c.height], [x(.06), top - c.height], [x(.06), top - c.height + .08], [x(.16), outer - .16], [x(c.depth), outer - .1], [x(c.depth), outer], [face, top]];
  };
  // With no roof above, a return only sheds water: a shallow fall like a sheet cap.
  const capped = c.cap / c.depth;
  // The front run stops at the frontispiece on both sides; nothing crosses its face.
  prism('front-cornice-west', profile(0, -1, slope), 'across', -c.depth, frontispiece.from, 'trim');
  prism('front-cornice-east', profile(0, -1, slope), 'across', frontispiece.to, length + c.depth, 'trim');
  prism('rear-cornice', profile(width, 1, slope), 'across', -c.depth, length + c.depth, 'trim');
  // Gable returns run a short way along the end wall, under the flat-sided verge overhang; the front plane
  // extrudes along -v. The wing's side cornices stay at the eave below its raised sides and start past the main
  // rear overhang, clear of its sheets.
  for (const [v0, v1] of [[0, c.return], [width - c.return, width]]) {
    prism(`west-cornice-return-${v0}`, profile(0, -1, capped), 'front', -v1, -v0, 'trim');
    prism(`east-cornice-return-${v0}`, profile(length, 1, capped), 'front', -v1, -v0, 'trim');
  }
  const wingEnd = width + wing.depth, knee = eave + frontispiece.knee, wingKnee = eave + wing.knee, {shoulder} = c;
  prism('wing-cornice-west', profile(wing.from, -1, capped), 'front', -wingEnd, -width - design.eaveOverhang - .01, 'trim');
  prism('wing-cornice-east', profile(wing.to, 1, capped), 'front', -wingEnd, -width - design.eaveOverhang - .01, 'trim');

  // Shoulders: the eave cornice carried into each pediment foot under a sheet-clad wedge falling inwards from the
  // rake's foot to the cornice top. The wedge stands deeper than the raking cornice, so it hides that cornice's cut
  // foot, and the cornice shows only where it rises clear of the wedge. The frontispiece's keeps the eave
  // cornice's section so its mouldings run on unbroken.
  const wedge = (corner: number, inner: number, top: number): Outline => [[corner, eave - .2], [inner, eave - .2], [inner, eave - .02], [corner, top]];
  const fp = frontispiece.proud;
  prism('frontispiece-shoulder-cornice-west', profile(-fp, -1, slope), 'across', frontispiece.from, frontispiece.from + shoulder, 'trim');
  prism('frontispiece-shoulder-cornice-east', profile(-fp, -1, slope), 'across', frontispiece.to - shoulder, frontispiece.to, 'trim');
  prism('frontispiece-shoulder-west', wedge(frontispiece.from, frontispiece.from + shoulder, knee), 'front', fp, fp + c.depth + .02, 'flashing');
  prism('frontispiece-shoulder-east', wedge(frontispiece.to, frontispiece.to - shoulder, knee), 'front', fp, fp + c.depth + .02, 'flashing');
  // The wing face's cornice also turns the corners onto the side cornices.
  prism('wing-shoulder-cornice-west', profile(wingEnd, 1, capped), 'across', wing.from - c.depth, wing.from + shoulder, 'trim');
  prism('wing-shoulder-cornice-east', profile(wingEnd, 1, capped), 'across', wing.to - shoulder, wing.to + c.depth, 'trim');
  prism('wing-shoulder-west', wedge(-wing.from, -wing.from - shoulder, wingKnee), 'wing', 0, c.depth + .02, 'flashing');
  prism('wing-shoulder-east', wedge(-wing.to, -wing.to + shoulder, wingKnee), 'wing', 0, c.depth + .02, 'flashing');

  // Raking cornices in two steps, standing on the returns or shoulders. On the pediments a pale capping covers
  // the cut ends of the sheets.
  const band = (from: number, to: number, apex: number, base: number, height: number): Outline => {
    const mid = (from + to) / 2;
    return [[from, base], [mid, apex], [to, base], [to, base - height], [mid, apex - height], [from, base - height]];
  };
  const sheet = design.roofThickness;
  const rakes: [string, number, number, number, number, Plane, number, boolean][] = [
    ['west', 0, width, ridge, eave, 'west', 0, false], ['east', 0, width, ridge, eave, 'east', 0, false],
    ['frontispiece', frontispiece.from, frontispiece.to, frontispiece.apex, knee, 'front', fp, true], ['wing', -wing.to, -wing.from, wing.apex, wingKnee, 'wing', 0, true],
  ];
  for (const [name, from, to, apex, base, plane, at, capping] of rakes) {
    prism(name + '-verge', band(from, to, apex, base, verge.height), plane, at, at + verge.step, 'trim');
    prism(name + '-verge-crown', band(from, to, apex, base, verge.height * .55), plane, at + verge.step, at + verge.depth, 'trim');
    if (capping) prism(name + '-verge-capping', band(from, to, apex + sheet + .03, base + sheet + .03, sheet + .07), plane, at + verge.depth - .01, at + verge.depth + .02, 'trim');
  }

  // Shed dormers: a face with a real window, and a roof rising back at a third of the main pitch until it
  // meets the sheets (owner's Aug 2024 view). Triangular cheeks close the sides under it. Sections are drawn
  // across the slope in (distance up from the wall, height) and mapped to v for each side.
  const {dormerWindow: w} = detail, rise = slope / 3, cap = .07;
  for (const d of detail.dormers) {
    const plane = d.side === 'front' ? 'front' : 'rear', from = d.side === 'front' ? d.from : length - d.to, to = d.side === 'front' ? d.to : length - d.from;
    const v = (set: number) => d.side === 'front' ? set : width - set, mid = (from + to) / 2;
    const base = roofAt(d.set) - .05, top = roofAt(d.set) + d.rise, roofOver = (set: number) => top + rise * (set - d.set);
    // Where the dormer roof's underside reaches the top of the sheets.
    const back = (top - rise * d.set - eave - sheet) / (slope - rise);
    const glazing: Opening = {id: d.id + '-window', kind: 'window', from: mid - w.width / 2, to: mid + w.width / 2, sill: roofAt(d.set) + w.sill, head: roofAt(d.set) + w.sill + w.height};
    walled(d.id + '-face', rectangle(from, to, base, top), plane, -d.set - .08, -d.set, [glazing], 'dormer');
    const cheek: Outline = [[v(d.set + .08), base], [v(d.set + .08), top], [v(back), roofOver(back)]];
    prism(d.id + '-cheek-a', cheek, 'across', d.from, d.from + .08, 'dormer');
    prism(d.id + '-cheek-b', cheek, 'across', d.to - .08, d.to, 'dormer');
    // Overhangs the face a little and ends just past the seam, where it has dipped under the sheets.
    const front = d.set - .12, end = back + cap / (slope - rise) + .03;
    prism(d.id + '-cap', [[v(front), roofOver(front)], [v(end), roofOver(end)], [v(end), roofOver(end) + cap], [v(front), roofOver(front) + cap]], 'across', d.from - .1, d.to + .1, 'roof');
  }

  // One pale surround for the frontispiece's window, door and window: a head band, end piers, and piers
  // filling the gaps beside the door down to the landing (owner's close crop, 2024).
  const [left, door, right] = frontispieceOpenings, s = detail.surround, proud = frontispiece.proud;
  for (const [id, from, to, sill, top] of [
    ['head', left.from - s, right.to + s, left.head, left.head + s], ['pier-west', left.from - s, left.from, left.sill, left.head], ['pier-east', right.to, right.to + s, right.sill, right.head],
    ['pier-door-west', left.to, door.from, door.sill, door.head], ['pier-door-east', door.to, right.from, door.sill, door.head],
  ] as const) prism('frontispiece-surround-' + id, rectangle(from, to, sill, top), 'front', proud, proud + .04, 'trim');

  // Pale piers and a hood round the east gable door.
  const eastDoor = eastGable.find(o => o.kind === 'door')!, {pier, hood, hoodProud} = detail.eastDoor;
  prism('east-door-pier-a', rectangle(eastDoor.from - pier, eastDoor.from, eastDoor.sill, eastDoor.head), 'east', 0, .04, 'trim');
  prism('east-door-pier-b', rectangle(eastDoor.to, eastDoor.to + pier, eastDoor.sill, eastDoor.head), 'east', 0, .04, 'trim');
  prism('east-door-hood', rectangle(eastDoor.from - pier - .08, eastDoor.to + pier + .08, eastDoor.head, eastDoor.head + hood), 'east', 0, hoodProud, 'trim');
  // The wing's window group, repaired. Pilasters stand at each end and midway between the windows, the end ones
  // as far out as the gaps are wide; the hood is a moulded section on the across plane, where v runs outwards.
  const g = detail.wingGroup, panes = wingFace.map(o => [-o.to, -o.from] as const).sort((a, b) => a[0] - b[0]);
  const gap = panes[1][0] - panes[0][1], last = panes[panes.length - 1];
  const piers = [panes[0][0] - gap / 2, ...panes.slice(1).map((p, i) => (panes[i][1] + p[0]) / 2), last[1] + gap / 2];
  const sill = Math.min(...wingFace.map(o => o.sill)) - .04, head = Math.max(...wingFace.map(o => o.head)) + .04, frieze = head + g.frieze;
  const ends = [piers[0] - g.pier / 2 - .08, piers[piers.length - 1] + g.pier / 2 + .08] as const;
  piers.forEach((x, i) => {
    prism(`wing-pilaster-${i}`, rectangle(x - g.pier / 2, x + g.pier / 2, sill, head), 'wing', 0, g.proud, 'trim');
    prism(`wing-console-${i}`, rectangle(x - g.pier / 2 + .05, x + g.pier / 2 - .05, sill - g.sillBand - g.console, sill - g.sillBand), 'wing', 0, g.proud + .03, 'trim');
  });
  prism('wing-sill-band', rectangle(ends[0], ends[1], sill - g.sillBand, sill), 'wing', 0, g.proud + .05, 'trim');
  prism('wing-frieze', rectangle(ends[0] + .04, ends[1] - .04, head, frieze), 'wing', 0, g.proud, 'trim');
  const hoodSection: Outline = [[wingEnd, frieze], [wingEnd + g.proud + .04, frieze], [wingEnd + g.proud + .04, frieze + .05], [wingEnd + g.hoodProud, frieze + g.hood - .08], [wingEnd + g.hoodProud, frieze + g.hood - .03], [wingEnd, frieze + g.hood]];
  prism('wing-hood', hoodSection, 'across', -ends[1] - .06, -ends[0] + .06, 'trim');

  const vent = new THREE.CylinderGeometry(detail.vent.radius, detail.vent.radius, .06, 16).rotateX(Math.PI / 2).translate(detail.vent.u, detail.vent.h, -width - .03);
  add('rear-vent', vent, 'vent');

  // The Kesk door's leaf and fixed panel meet at a mullion.
  const split = door.from + detail.doorLeaf;
  prism('frontispiece-door-mullion', rectangle(split - .03, split + .03, door.sill, door.head), 'front', frontispiece.proud - .27, frontispiece.proud - .18, 'darkFrame');

  // Railings round the Kesk landing and both sides of its flight; the flight's head carries two newels.
  // The landing lies in front of the wall, at negative v.
  const top = plinth, edge = .04 - landing.depth, foot = -landing.depth - stairs.tread * (risers - 1), low = plinth - stairs.rise * (risers - 1);
  const flight = (u: number): Point[] => [[u, top, edge], [u, low, foot]];
  add('landing-rail-west', railing([[stairs.from + .04, top, edge], [landing.from + .04, top, edge], [landing.from + .04, top, -.05]], [0]), 'rail');
  add('landing-rail-east', railing([[stairs.to - .04, top, edge], [landing.to - .04, top, edge], [landing.to - .04, top, -.05]], [0]), 'rail');
  add('stair-rail-west', railing(flight(stairs.from + .04)), 'rail');
  add('stair-rail-east', railing(flight(stairs.to - .04)), 'rail');
  const west = -westLanding.out + .04, westLow = plinth - stairs.rise * (risers - 1), westFoot = westLanding.from - stairs.tread * (risers - 1);
  add('west-rail', railing([[0, top, westLanding.to - .04], [west, top, westLanding.to - .04], [west, top, westLanding.from], [west, westLow, westFoot]], [2]), 'rail');
}
