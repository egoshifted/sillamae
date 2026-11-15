import * as THREE from 'three';
import type {OverrideContext, Point2} from '../../../engine/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {atticWindow, axisU, design, detail, eastGable, footprint, frameFinish, front, frontispieceOpenings, grilled, length, type Opening, planOrigin, planPoint, rear, risers, roofUnderside, slope, stairFoot, surveyDatum, westGable, width, wingFace as wingOpenings} from './design.ts';
import {addDetails} from './details.ts';
import {applyUV, createFinish, type Finish, plainColours} from './surfaces.ts';

type Stage = 'shell' | 'openings' | 'finished';
type Outline = [number, number][];

const lowestGround = (context: OverrideContext, points: Point2[]) => {
  const heights = points.flatMap(point => entranceDatum(context.ground, [point]) ?? []);
  return heights.length ? Math.min(...heights) : null;
};

export function createShell(context: OverrideContext) { return build(context, 'shell'); }
export function createOpenings(context: OverrideContext) { return build(context, 'openings'); }
export function createFinished(context: OverrideContext) { return build(context, 'finished'); }

function build(context: OverrideContext, stage: Stage): StudyModel {
  const {frame, ground, scene} = context;
  const datum = entranceDatum(ground, [stairFoot()]) ?? surveyDatum;
  const {wall, plinth, eave, ridge, eaveOverhang, rake, roofThickness, frontispiece, wing, landing, stairs, westLanding} = design;
  const low = lowestGround(context, [...footprint, stairFoot(), planPoint(length / 2, width + wing.depth + 1)]);
  const bottom = (low === null ? -1 : low - datum) - .4;
  const eastGround = (entranceDatum(ground, [planPoint(length + 1, width / 2)]) ?? datum) - datum;
  const {porch} = design, porchGround = (entranceDatum(ground, [planPoint(porch.from - .5, width + porch.out / 2)]) ?? datum) - datum;

  const root = new THREE.Group();
  root.name = 'kesk8-' + stage;
  root.position.set(planOrigin[0] - frame.origin[0], datum - frame.base, planOrigin[1] - frame.origin[1]);
  // Model x is u, y is height and z is -v.
  root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(axisU[0], 0, axisU[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-axisU[1], 0, axisU[0]),
  ));
  root.userData.audit = {stage, datum, bottom, eastGround, porchGround,basis: 'Survey footprint; heights, roof and openings estimated from Street View, sale photos and orthophoto; no architectural approval'};

  const finished = stage === 'finished', finish = finished ? createFinish() : null;
  const materials = new Map<Finish, THREE.MeshStandardMaterial>();
  const material = (name: Finish) => {
    if (!materials.has(name)) materials.set(name, finish?.material(name) ?? new THREE.MeshStandardMaterial({name, color: plainColours[name], roughness: name === 'glass' ? .3 : 1}));
    return materials.get(name)!;
  };
  const add = (name: string, geometry: THREE.BufferGeometry, finish: Finish) => {
    const mesh = new THREE.Mesh(geometry, material(finish));
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  };
  const box = (name: string, u0: number, u1: number, h0: number, h1: number, v0: number, v1: number, finish: Finish) => {
    const geometry = new THREE.BoxGeometry(u1 - u0, h1 - h0, v1 - v0);
    geometry.translate((u0 + u1) / 2, (h0 + h1) / 2, -(v0 + v1) / 2);
    add(name, geometry, finish);
  };
  const place = (along: THREE.Vector3, outward: THREE.Vector3, origin: THREE.Vector3) => new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0, 1, 0), outward).setPosition(origin);
  const planes = {
    front: place(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3()),
    rear: place(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(length, 0, -width)),
    east: place(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(length, 0, 0)),
    // Runs from the rear corner, so v schedules are mirrored onto it: a +v basis here would be left-handed.
    west: place(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -width)),
    // Runs along -u, so plan positions are negated onto it.
    wing: place(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -width - design.wing.depth)),
    // Sections in (v, height) extruded along u.
    across: place(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3()),
  };
  const fromRear = (o: Opening): Opening => ({...o, from: width - o.to, to: width - o.from});
  // Extrudes from `near` to `far` along the plane's outward axis, so holes get real reveals.
  const prism = (name: string, outline: Outline, plane: THREE.Matrix4, near: number, far: number, finish: Finish, holes: Outline[] = []) => {
    const shape = new THREE.Shape(outline.map(([s, h]) => new THREE.Vector2(s, h)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([s, h]) => new THREE.Vector2(s, h))));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: far - near, bevelEnabled: false, steps: 1});
    geometry.translate(0, 0, near);
    geometry.applyMatrix4(plane);
    add(name, geometry, finish);
  };
  const rectangle = (from: number, to: number, h0: number, h1: number): Outline => [[from, h0], [to, h0], [to, h1], [from, h1]];
  // A pediment whose rake starts `knee` above the eave, over the shoulders.
  const pediment = (from: number, to: number, apex: number, knee: number): Outline => [[from, 0], [to, 0], [to, eave + knee], [(from + to) / 2, apex], [from, eave + knee]];
  // Attic windows are round-headed: the head is the crown of a semicircle on the opening's width.
  const outline = (o: Opening, inset = 0): Outline => {
    const from = o.from + inset, to = o.to + -inset, sill = o.sill + inset;
    if (o.kind !== 'attic') return rectangle(from, to, sill, o.head - inset);
    const r = (to - from) / 2, spring = o.head - (o.to - o.from) / 2;
    return [[from, sill], [to, sill], ...Array.from({length: 9}, (_, i): [number, number] => [from + r + r * Math.cos(Math.PI * i / 8), spring + r * Math.sin(Math.PI * i / 8)])];
  };
  const plinthProud = .04, shown = stage !== 'shell';

  // Frames sit back in the reveal; doors deeper than windows, as on the Kesk entrance.
  const fill = (plane: THREE.Matrix4, o: Opening, face = 0) => {
    const inset = (o.kind === 'door' ? .2 : .14) - face, rail = o.kind === 'door' ? .08 : .07;
    const frameColour = frameFinish(o.id);
    prism(o.id + '-frame', outline(o), plane, -inset - .07, -inset, frameColour, [outline(o, rail)]);
    prism(o.id + (o.kind === 'door' ? '-leaf' : '-glass'), outline(o, rail), plane, -inset - .05, -inset - .03, o.kind !== 'door' ? 'glass' : o.id === 'east-door' ? 'metalDoor' : 'door');
    if (finished && grilled.has(o.id)) prism(o.id + '-grille', outline(o, rail), plane, -inset - .1, -inset - .09, 'grille');
    if (o.kind === 'window') prism(o.id + '-sill', rectangle(o.from - .05, o.to + .05, o.sill - .04, o.sill + .015), plane, -inset, face + .06, o.id.startsWith('frontispiece-') ? 'trim' : frameColour);
  };
  const walled = (name: string, shape: Outline, plane: THREE.Matrix4, near: number, far: number, openings: Opening[], surface: Finish = 'wall') => {
    prism(name, shape, plane, near, far, surface, shown ? openings.map(o => outline(o)) : []);
    if (shown) openings.forEach(o => fill(plane, o, far));
  };

  box('foundation', 0, length, bottom, 0, 0, width, 'foundation');
  box('wing-foundation', wing.from, wing.to, bottom, 0, width, width + wing.depth, 'foundation');

  walled('front-wall-west', rectangle(wall, frontispiece.from, 0, eave), planes.front, -wall, 0, front);
  walled('front-wall-east', rectangle(frontispiece.to, length - wall, 0, eave), planes.front, -wall, 0, []);
  walled('rear-wall', rectangle(wall, length - wall, 0, eave), planes.rear, -wall, 0, rear.map(o => ({...o, from: length - o.to, to: length - o.from})));
  const gable: Outline = [[0, 0], [width, 0], [width, eave], [width / 2, roofUnderside(width / 2)], [0, eave]];
  walled('west-gable', gable, planes.west, -wall, 0, [...westGable, atticWindow('west-attic')].map(fromRear));
  walled('east-gable', gable, planes.east, -wall, 0, [...eastGable, atticWindow('east-attic')]);
  prism('front-plinth', rectangle(-plinthProud, length + plinthProud, 0, plinth), planes.front, 0, plinthProud, 'plinth');
  prism('rear-plinth', rectangle(-plinthProud, length + plinthProud, 0, plinth), planes.rear, 0, plinthProud, 'plinth');
  prism('west-plinth', rectangle(0, width, 0, plinth), planes.west, 0, plinthProud, 'plinth');
  prism('east-plinth', rectangle(0, width, 0, plinth), planes.east, 0, plinthProud, 'plinth');

  // Deeper than the wall so its sides close the gap where the raised verge meets the main slope.
  const knee = eave + frontispiece.knee, wingKnee = eave + wing.knee;
  walled('frontispiece', pediment(frontispiece.from, frontispiece.to, frontispiece.apex, frontispiece.knee), planes.front, -1, frontispiece.proud, frontispieceOpenings);
  walled('wing-face', pediment(-wing.to, -wing.from, wing.apex, wing.knee), planes.wing, -wall, 0, wingOpenings.map(o => ({...o, from: -o.to, to: -o.from})));
  box('wing-side-west', wing.from, wing.from + wall, 0, wingKnee, width - wall, width + wing.depth - wall, 'wall');
  box('wing-side-east', wing.to - wall, wing.to, 0, wingKnee, width - wall, width + wing.depth - wall, 'wall');
  prism('wing-plinth', rectangle(-wing.to - plinthProud, -wing.from + plinthProud, 0, plinth), planes.wing, 0, plinthProud, 'plinth');
  for (const [name, u, side] of [['wing-plinth-west', wing.from, -1], ['wing-plinth-east', wing.to, 1]] as const) {
    box(name, side < 0 ? u - plinthProud : u, side < 0 ? u : u + plinthProud, 0, plinth, width, width + wing.depth, 'plinth');
  }

  const t = roofThickness, under = (v: number) => ridge - slope * Math.abs(v - width / 2);
  const slab = (section: Outline): Outline => [...section, ...section.map(([v, h]): [number, number] => [v, h + t]).reverse()];
  // The main roof is cut into runs along u. Where the frontispiece or the wing stands, that side's overhang
  // stops inside their wall, so no eave runs across the frontispiece face or into the wing's roof.
  const cuts = [-rake, frontispiece.from, frontispiece.to, wing.from, wing.to, length + rake].sort((a, b) => a - b);
  cuts.slice(0, -1).forEach((u0, i) => {
    const u1 = cuts[i + 1], mid = (u0 + u1) / 2;
    if (u1 - u0 < 1e-6) return;
    const v0 = mid > frontispiece.from && mid < frontispiece.to ? .1 : -eaveOverhang, v1 = mid > wing.from && mid < wing.to ? width - .1 : width + eaveOverhang;
    prism(`roof-${i}`, slab([[v0, under(v0)], [width / 2, ridge], [v1, under(v1)]]), planes.east, u0 - length, u1 - length, 'roof');
  });

  // A cross roof runs from its eave into the main roof until its ridge passes under the main slab.
  const crossRoof = (name: string, from: number, to: number, apex: number, near: number, far: number, base = eave, side = rake) => {
    const mid = (from + to) / 2, fall = (apex - base) / ((to - from) / 2), edge = (u: number) => apex - fall * Math.abs(u - mid);
    const section: Outline = [[from - side, edge(from - side)], [mid, apex], [to + side, edge(to + side)]];
    prism(name, [...section, ...section.map(([u, h]): [number, number] => [u, h + t]).reverse()], planes.front, near, far, 'roof');
  };
  const meets = (apex: number) => (apex + t + .02 - eave) / slope;
  // The sheets end flush with the raking cornice under its capping, with no side overhang to cut through the
  // shoulders. The wing's sides rise to its knee, so its sheets meet them there.
  crossRoof('frontispiece-roof', frontispiece.from, frontispiece.to, frontispiece.apex, -meets(frontispiece.apex), frontispiece.proud + detail.verge.depth, knee, 0);
  crossRoof('wing-roof', wing.from, wing.to, wing.apex, -width - wing.depth - detail.verge.depth, -width + meets(wing.apex), wingKnee, 0);

  // Rendered like the plinth on its faces, with a concrete top.
  box('landing', landing.from, landing.to, bottom, plinth - .03, -landing.depth, 0, 'plinth');
  box('landing-top', landing.from, landing.to, plinth - .03, plinth, -landing.depth, 0, 'steps');
  for (let i = 1; i < risers; i++) {
    box(`step-${i}`, stairs.from, stairs.to, bottom, plinth - stairs.rise * i, -landing.depth - stairs.tread * i, -landing.depth - stairs.tread * (i - 1), 'steps');
  }
  if (shown) {
    const {from, to, out} = westLanding;
    box('west-landing', -out, 0, bottom, plinth, from, to, 'steps');
    for (let i = 1; i < risers; i++) box(`west-step-${i}`, -out, 0, bottom, plinth - stairs.rise * i, from - stairs.tread * i, from - stairs.tread * (i - 1), 'steps');

    // Drawn on the front plane in (u, height), extruded out from the rear wall along v.
    const g = porchGround, reach = width + porch.out, fall = (porch.high - porch.low) / (porch.to - porch.from), lip = .1;
    const roofAt = (u: number) => g + porch.high - fall * (u - porch.from);
    prism('porch', [[porch.from, bottom], [porch.to, bottom], [porch.to, g + porch.low], [porch.from, g + porch.high]], planes.front, -reach, -width, 'porch');
    prism('porch-roof', [[porch.from - lip, roofAt(porch.from - lip)], [porch.to + lip, roofAt(porch.to + lip)], [porch.to + lip, roofAt(porch.to + lip) + .06], [porch.from - lip, roofAt(porch.from - lip) + .06]], planes.front, -reach - lip, -width, 'roof');
    box('porch-door', porch.from - .03, porch.from, g, g + porch.door.head, width + porch.door.from, width + porch.door.to, 'metalDoor');
  }

  if (finished) {
    addDetails({
      add, box,
      prism: (name, shape, plane, near, far, surface, holes) => prism(name, shape, planes[plane], near, far, surface, holes),
      walled: (name, shape, plane, near, far, openings, surface) => walled(name, shape, planes[plane], near, far, openings, surface),
    });
    applyUV(root);
    // The studio edits single parts; the atlas draws one mesh per material.
    if (!scene.userData.keepParts) batchDetailStudy(root);
  }

  let disposed = false;
  return {
    root,
    ready: finish?.ready,
    setTextures: finish ? on => finish.setTextures(on) : undefined,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.traverse(child => { if (child instanceof THREE.Mesh) child.geometry.dispose(); });
      materials.forEach(m => m.dispose());
      finish?.dispose();
      root.removeFromParent();
    },
  };
}
