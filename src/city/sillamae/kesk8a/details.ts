import * as THREE from 'three';
import {design, detail, length, type Opening, width} from './design.ts';
import type {Finish} from './surfaces.ts';
import {wear} from './wear.ts';

interface Kit {
  add(name: string, geometry: THREE.BufferGeometry, finish: Finish): void;
  box(name: string, u0: number, u1: number, h0: number, h1: number, v0: number, v1: number, finish: Finish): void;
  planes: Record<'front' | 'rear' | 'south' | 'north', THREE.Matrix4>;
}

export function addDetails({add, box, planes}: Kit, openings: {rear: Opening[]; north: Opening[]; south: Opening[]; front: Opening[]}, rearGround: number, bottom: number) {
  const {eave, eaveOverhang, fasciaProud, rake, belt, attic, stairs} = design;
  const piece = (name: string, plane: THREE.Matrix4, s0: number, s1: number, h0: number, h1: number, near: number, far: number, finish: Finish) => {
    const geometry = new THREE.BoxGeometry(s1 - s0, h1 - h0, far - near);
    geometry.translate((s0 + s1) / 2, (h0 + h1) / 2, (near + far) / 2);
    geometry.applyMatrix4(plane);
    add(name, geometry, finish);
  };
  const bar = (name: string, plane: THREE.Matrix4, s0: number, h0: number, s1: number, h1: number, near: number, far: number, thick: number, finish: Finish) => {
    const span = Math.hypot(s1 - s0, h1 - h0), geometry = new THREE.BoxGeometry(span, thick, far - near);
    geometry.rotateZ(Math.atan2(h1 - h0, s1 - s0));
    geometry.translate((s0 + s1) / 2, (h0 + h1) / 2, (near + far) / 2);
    geometry.applyMatrix4(plane);
    add(name, geometry, finish);
  };

  const rustication = (name: string, plane: THREE.Matrix4, s0: number, s1: number) => {
    const {count, joint, proud} = detail.rustication, top = belt.bottom, base = design.plinth, height = (top - base) / count;
    for (let i = 0; i < count; i++) piece(`${name}-${i + 1}`, plane, s0, s1, base + i * height, base + (i + 1) * height - joint, 0, proud, 'trim');
    piece(name + '-backing', plane, s0, s1, base, top, 0, proud - .02, 'wall');
  };
  const {corner} = detail.rustication;
  rustication('quoin-front-left', planes.front, 0, corner);
  rustication('quoin-front-right', planes.front, length - corner, length);
  for (const [i, [s0, s1]] of detail.doorFlanks.entries()) rustication(`door-flank-${i + 1}`, planes.front, s0, s1);
  // Starts past the wall corner so the return closes the front quoin's exposed end.
  rustication('quoin-south-east', planes.south, -detail.rustication.proud, corner);
  rustication('quoin-north-west', planes.north, width - corner, width + detail.rustication.proud);

  for (const [name, sheet, plane, finish] of [
    ['wear-north-west', wear.north, planes.north, 'wearNorth'], ['wear-south-east', wear.south, planes.south, 'wearSouth'],
    ['wear-front', wear.front, planes.front, 'wearFront'], ['wear-rear', wear.rear, planes.rear, 'wearRear'],
  ] as const) {
    const geometry = new THREE.PlaneGeometry(sheet.to - sheet.from, sheet.top);
    geometry.translate((sheet.from + sheet.to) / 2, sheet.top / 2, .004);
    geometry.applyMatrix4(plane);
    add(name, geometry, finish);
  }

  const {cap} = detail.belt;
  piece('belt-cap-left', planes.front, -cap.proud, belt.gap[0], belt.top - cap.lap, belt.top + cap.rise, 0, cap.proud, 'trim');
  piece('belt-cap-right', planes.front, belt.gap[1], length + cap.proud, belt.top - cap.lap, belt.top + cap.rise, 0, cap.proud, 'trim');
  piece('belt-cap-south-east', planes.south, 0, belt.return, belt.top - cap.lap, belt.top + cap.rise, 0, cap.proud, 'trim');
  piece('belt-cap-north-west', planes.north, width - belt.return, width, belt.top - cap.lap, belt.top + cap.rise, 0, cap.proud, 'trim');

  const {pier} = detail;
  piece('door-pier', planes.front, pier.left, pier.right, pier.bottom, pier.top, 0, pier.proud, 'trim');
  piece('door-pier-cap', planes.front, pier.left - pier.capReach, pier.right + pier.capReach, pier.top, pier.top + pier.capHeight, 0, pier.capProud, 'trim');
  const panel = pier.panel;
  for (const [name, s0, s1, h0, h1] of [
    ['left', panel.left, panel.left + panel.line, panel.bottom, panel.top], ['right', panel.right - panel.line, panel.right, panel.bottom, panel.top],
    ['bottom', panel.left + panel.line, panel.right - panel.line, panel.bottom, panel.bottom + panel.line], ['top', panel.left + panel.line, panel.right - panel.line, panel.top - panel.line, panel.top],
  ] as const) piece('door-pier-panel-' + name, planes.front, s0, s1, h0, h1, pier.proud, pier.proud + .015, 'trim');

  const {sign} = detail;
  piece('sign-board', planes.front, sign.left - .03, sign.right + .03, sign.bottom - .03, sign.top + .03, 0, .05, 'frame');
  piece('sign-face', planes.front, sign.left, sign.right, sign.bottom, sign.top, .05, .054, 'sign');

  const edgeStrip = (name: string, u0: number, u1: number, v0: number, v1: number) => box(name, u0, u1, eave - detail.eaveStrip, eave + .002, v0, v1, 'metal');
  const outerFront = -eaveOverhang - fasciaProud, outerRear = width + eaveOverhang + fasciaProud;
  edgeStrip('eave-strip-left', -rake, attic.left, outerFront - .012, outerFront);
  edgeStrip('eave-strip-right', attic.right, length + rake, outerFront - .012, outerFront);
  edgeStrip('eave-strip-rear', -rake, length + rake, outerRear, outerRear + .012);

  const ring = (name: string, plane: THREE.Matrix4, o: Opening, wide: number, near: number, far: number, finish: Finish) => {
    piece(name + '-left', plane, o.from, o.from + wide, o.sill, o.head, near, far, finish);
    piece(name + '-right', plane, o.to - wide, o.to, o.sill, o.head, near, far, finish);
    piece(name + '-bottom', plane, o.from + wide, o.to - wide, o.sill, o.sill + wide, near, far, finish);
    piece(name + '-top', plane, o.from + wide, o.to - wide, o.head - wide, o.head, near, far, finish);
  };
  const sill = (name: string, plane: THREE.Matrix4, o: Opening, finish: Finish) => piece(name, plane, o.from - detail.sill.reach, o.to + detail.sill.reach, o.sill - detail.sill.height, o.sill, -.02, detail.sill.proud, finish);
  // Diamonds join edge midpoints in each cell; the grille sits in front of the glass and behind the frame's face.
  const lattice = (name: string, plane: THREE.Matrix4, s0: number, s1: number, h0: number, h1: number) => {
    const {columns, rows, bar: thick, near, far} = detail.grille, dx = (s1 - s0) / columns, dy = (h1 - h0) / rows;
    for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) {
      const left = s0 + c * dx, low = h0 + r * dy, midS = left + dx / 2, midH = low + dy / 2, right = left + dx, high = low + dy;
      for (const [i, [a, b, e, f]] of [[left, midH, midS, low], [midS, low, right, midH], [right, midH, midS, high], [midS, high, left, midH]].entries()) bar(`${name}-${c}-${r}-${i}`, plane, a, b, e, f, near, far, thick, 'grille');
    }
    for (const s of [s0, s1]) piece(`${name}-post-${s}`, plane, s - thick / 2, s + thick / 2, h0, h1, near, far, 'grille');
    for (const h of [h0, h1]) piece(`${name}-rail-${h}`, plane, s0, s1, h - thick / 2, h + thick / 2, near, far, 'grille');
  };

  const {frame} = detail, inset = -.12, face = -.04;
  for (const o of openings.front.filter(o => o.kind === 'window')) {
    ring(o.id + '-frame', planes.front, o, frame, inset, face, 'frame');
    sill(o.id + '-sill', planes.front, o, 'trim');
    for (const [i, [s0, s1]] of [[o.from - detail.surround, o.from], [o.to, o.to + detail.surround]].entries()) piece(`${o.id}-surround-${i + 1}`, planes.front, s0, s1, o.sill, o.head + detail.surround, 0, .025, 'trim');
    piece(o.id + '-surround-head', planes.front, o.from, o.to, o.head, o.head + detail.surround, 0, .025, 'trim');
    const [blankFrom, blankTo] = o.blank!, glassFrom = blankFrom === o.from ? blankTo : o.from, glassTo = blankFrom === o.from ? o.to : blankFrom, mid = (glassFrom + glassTo) / 2;
    const low = o.sill + frame, high = o.head - frame;
    for (const s of [blankFrom === o.from ? blankTo : blankFrom, mid]) piece(`${o.id}-mullion-${s}`, planes.front, s - frame / 2, s + frame / 2, low, high, inset, face, 'frame');
    lattice(o.id + '-grille-1', planes.front, glassFrom + (glassFrom === o.from ? frame : frame / 2), mid - frame / 2, low, high);
    lattice(o.id + '-grille-2', planes.front, mid + frame / 2, glassTo - (glassTo === o.to ? frame : frame / 2), low, high);
  }
  const door = openings.front.find(o => o.kind === 'door')!;
  ring('front-door-frame', planes.front, door, frame, -.08, -.02, 'frame');
  const split = door.from + (door.to - door.from) * detail.doorSplit;
  piece('front-door-meeting-stile', planes.front, split - .02, split + .02, door.sill + frame, door.head - frame, -.08, -.03, 'frame');
  for (const [leaf, s0, s1] of [['left', door.from + frame + .05, split - .07], ['right', split + .07, door.to - frame - .05]] as const) {
    const height = door.head - door.sill, lowTop = door.sill + height * .35, topBottom = lowTop + .12;
    piece(`front-door-${leaf}-lower`, planes.front, s0, s1, door.sill + frame + .05, lowTop, -.08, -.062, 'frame');
    piece(`front-door-${leaf}-upper`, planes.front, s0, s1, topBottom, door.head - frame - .05, -.08, -.062, 'frame');
  }
  piece('front-door-handle', planes.front, split - .1, split - .05, door.sill + 1, door.sill + 1.14, -.08, -.03, 'metal');

  const plainWindow = (name: string, plane: THREE.Matrix4, o: Opening) => {
    ring(name + '-frame', plane, o, detail.smallFrame, inset, face, 'frame');
    sill(name + '-sill', plane, o, 'metal');
    const {pitch} = detail.smallGrid;
    for (let s = o.from + pitch; s < o.to - .05; s += pitch) piece(`${name}-grid-v-${s}`, plane, s - .006, s + .006, o.sill + detail.smallFrame, o.head - detail.smallFrame, -.11, -.1, 'grille');
    for (let h = o.sill + pitch; h < o.head - .05; h += pitch) piece(`${name}-grid-h-${h}`, plane, o.from + detail.smallFrame, o.to - detail.smallFrame, h - .006, h + .006, -.11, -.1, 'grille');
  };
  for (const o of openings.rear.filter(o => o.kind === 'window')) plainWindow(o.id, planes.rear, o);
  const rearDoor = openings.rear.find(o => o.kind === 'door')!;
  ring('rear-door-frame', planes.rear, rearDoor, .05, -.08, -.02, 'rearDoor');
  piece('rear-door-handle', planes.rear, rearDoor.to - .14, rearDoor.to - .09, rearDoor.sill + 1, rearDoor.sill + 1.14, -.08, -.03, 'metal');
  for (const o of openings.north.filter(o => o.kind === 'window')) plainWindow(o.id, planes.north, o);

  const louvres = [...openings.north.filter(o => o.kind === 'louvre').map(o => ({o, plane: planes.north})), ...openings.south.filter(o => o.kind === 'louvre').map(o => ({o, plane: planes.south}))];
  for (const {o, plane} of louvres) {
    ring(o.id + '-frame', plane, o, .05, -.12, -.02, 'frame');
    for (let h = o.sill + .1, i = 0; h < o.head - .08; h += detail.slatPitch, i++) bar(`${o.id}-slat-${i}`, plane, o.from + .05, h, o.to - .05, h, -.12, -.05, .05, 'frame');
  }

  const {rail} = detail, landing = design.stairs.landing, top = stairs.rise * stairs.risers;
  for (const [i, v] of [rail.wallPost, rail.outerPost].entries()) box(`rail-post-${i + 1}`, rail.u - .025, rail.u + .025, top, top + rail.height, v - .025, v + .025, 'rail');
  box('rail-top', rail.u - .025, rail.u + .025, top + rail.height, top + rail.height + .05, -rail.bend, 0, 'rail');
  // Past the bend the rail slopes down over the steps. v grows outward, which is model -z.
  const railTail = new THREE.BoxGeometry(.05, .05, Math.hypot(rail.tail.out, rail.tail.drop));
  railTail.rotateX(Math.atan2(rail.tail.drop, rail.tail.out));
  railTail.translate(rail.u, top + rail.height + .025 - rail.tail.drop / 2, rail.bend + rail.tail.out / 2);
  add('rail-tail', railTail, 'rail');

  const reach = landing + stairs.tread * (stairs.risers - 1), {square, round, hollow} = detail.bins;
  const squareU = stairs.left - stairs.flank / 2, squareV = -reach - square.collar / 2, half = square.size / 2, lip = square.collar / 2;
  box('bin-square-body', squareU - half, squareU + half, bottom, square.body, squareV - half, squareV + half, 'block');
  box('bin-square-collar', squareU - lip, squareU + lip, square.body, square.top, squareV - lip, squareV + lip, 'block');
  box('bin-square-hollow', squareU - lip + hollow, squareU + lip - hollow, square.top, square.top + .002, squareV - lip + hollow, squareV + lip - hollow, 'dark');
  // Both bins centre on their flanks and on one line, so the entrance reads square from above.
  const roundU = stairs.right + stairs.flank / 2, roundV = squareV;
  const drum = (name: string, radius: number, from: number, to: number, finish: Finish) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, to - from, 20);
    geometry.translate(roundU, (from + to) / 2, -roundV);
    add(name, geometry, finish);
  };
  drum('bin-round-body', round.radius, bottom, round.top - round.rimHeight, 'block');
  drum('bin-round-rim', round.rim, round.top - round.rimHeight, round.top, 'block');
  drum('bin-round-hollow', round.rim - hollow, round.top, round.top + .002, 'dark');

  const {lamp, vent, cable} = detail, rearS = (fromNorth: number) => length - fromNorth;
  piece('rear-lamp-body', planes.rear, rearS(lamp.at) - .09, rearS(lamp.at) + .09, rearGround + lamp.height, rearGround + lamp.height + .1, .06, .16, 'dark');
  piece('rear-lamp-arm', planes.rear, rearS(lamp.at) - .012, rearS(lamp.at) + .012, rearGround + lamp.height - .16, rearGround + lamp.height + .02, 0, .08, 'dark');
  const disc = new THREE.CylinderGeometry(vent.radius, vent.radius, .04, 18);
  disc.rotateX(Math.PI / 2);
  disc.translate(rearS(vent.at), rearGround + vent.height, .02);
  disc.applyMatrix4(planes.rear);
  add('rear-vent', disc, 'dark');
  piece('rear-cable', planes.rear, rearS(cable.at) - .008, rearS(cable.at) + .008, rearGround + .25, rearGround + cable.height, 0, .016, 'dark');
  piece('rear-cable-top', planes.rear, rearS(lamp.at), rearS(cable.at), rearGround + cable.height - .008, rearGround + cable.height + .008, 0, .016, 'dark');
}
