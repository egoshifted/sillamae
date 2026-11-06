import * as THREE from 'three';
import type {OverrideContext, Point2} from '../../../engine/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {addDetails} from './details.ts';
import {atticOutline, axisU, design, footprint, front, frontDoorFoot, gableNorthWest, gableSouthEast, length, type Opening, planOrigin, planPoint, rear, rearDoorFoot, roofUnderside, slope, surveyDatum, threshold, wallTop, width} from './design.ts';
import {applyUV, createFinish, type Finish, plainColours} from './surfaces.ts';

type Stage = 'shell' | 'openings' | 'finished';
type Outline = [number, number][];

export function createShell(context: OverrideContext) { return build(context, 'shell'); }
export function createBuilding(context: OverrideContext) { return build(context, 'openings'); }
export function createFinished(context: OverrideContext) { return build(context, 'finished'); }

const lowestGround = (context: OverrideContext, points: Point2[]) => {
  const heights = points.flatMap(point => entranceDatum(context.ground, [point]) ?? []);
  return heights.length ? Math.min(...heights) : null;
};

function build(context: OverrideContext, stage: Stage): StudyModel {
  const {frame, ground, scene} = context;
  const datum = entranceDatum(ground, [frontDoorFoot()]) ?? surveyDatum;
  const rearGround = (entranceDatum(ground, [rearDoorFoot()]) ?? datum) - datum;
  const low = lowestGround(context, [...footprint, frontDoorFoot(), rearDoorFoot(), planPoint(length / 2, -2.3), planPoint(length / 2, width + 1.6)]);
  const bottom = (low === null ? -1 : low - datum) - .4;

  const root = new THREE.Group();
  root.name = 'kesk8a-' + stage;
  root.position.set(planOrigin[0] - frame.origin[0], datum - frame.base, planOrigin[1] - frame.origin[1]);
  // Model x is u, y is height and z is -v: the footprint runs left-handed in (u, up, v).
  root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(axisU[0], 0, axisU[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-axisU[1], 0, axisU[0]),
  ));
  root.userData.audit = {stage, datum, bottom, rearGround, basis: 'Survey footprint and ridge; openings and levels estimated from Street View; no architectural approval'};

  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const finished = stage === 'finished', finish = finished ? createFinish() : null;
  const material = (name: Finish) => {
    if (!materials.has(name)) materials.set(name, finish?.material(name) ?? new THREE.MeshStandardMaterial({name, color: plainColours[name], roughness: 1}));
    return materials.get(name)!;
  };
  const add = (name: string, geometry: THREE.BufferGeometry, finish: Finish) => {
    const mesh = new THREE.Mesh(geometry, material(finish));
    mesh.name = name;
    mesh.castShadow = !finish.startsWith('wear');
    mesh.receiveShadow = true;
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
    south: place(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(length, 0, 0)),
    north: place(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -width)),
  };
  // Extrudes from `near` to `far` along the plane's outward axis, so holes get real reveals.
  const prism = (name: string, outline: Outline, plane: THREE.Matrix4, near: number, far: number, finish: Finish, holes: Outline[] = []) => {
    const shape = new THREE.Shape(outline.map(([s, h]) => new THREE.Vector2(s, h)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([s, h]) => new THREE.Vector2(s, h))));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: far - near, bevelEnabled: false, steps: 1});
    geometry.translate(0, 0, near);
    geometry.applyMatrix4(plane);
    add(name, geometry, finish);
  };
  const rectangle = (from: number, to: number, sill: number, head: number): Outline => [[from, sill], [to, sill], [to, head], [from, head]];

  const {wall, plinth, rake, verge, fasciaProud, eaveOverhang, eaveDepth, eaveFascia, eave, ridge, roofThickness, belt, attic, stairs, rearLanding} = design;
  const shown = stage !== 'shell', trim: Finish = finished ? 'trim' : 'wall';
  const rearOpenings = rear.map(o => {
    const lift = rearGround + (o.kind === 'door' ? rearLanding.rise : 0);
    return {...o, from: length - o.to, to: length - o.from, sill: o.sill + lift, head: o.head + lift};
  });
  const northGable = gableNorthWest.map(o => ({...o, from: width - o.to, to: width - o.from}));

  const fill = (plane: THREE.Matrix4, o: Opening) => {
    const fillFinish: Finish = o.id === 'rear-door' ? 'rearDoor' : o.kind === 'door' ? 'door' : o.kind === 'louvre' ? 'louvre' : 'glass';
    const inset = o.kind === 'door' ? .08 : .12;
    prism(o.id, rectangle(o.from, o.to, o.sill, o.head), plane, -inset - .04, -inset, fillFinish);
    if (o.blank) prism(o.id + '-blank', rectangle(o.blank[0], o.blank[1], o.sill, o.head), plane, -inset, -inset + .03, 'blank');
  };
  const walled = (name: string, outline: Outline, plane: THREE.Matrix4, openings: Opening[]) => {
    prism(name, outline, plane, -wall, 0, 'wall', shown ? openings.map(o => rectangle(o.from, o.to, o.sill, o.head)) : []);
    if (shown) openings.forEach(o => fill(plane, o));
  };

  box('foundation', 0, length, bottom, plinth, 0, width, 'foundation');
  walled('front-wall', rectangle(wall, length - wall, plinth, wallTop), planes.front, front);
  walled('rear-wall', rectangle(wall, length - wall, plinth, wallTop), planes.rear, rearOpenings);
  const gable: Outline = [[0, plinth], [width, plinth], [width, wallTop], [width / 2, roofUnderside(width / 2)], [0, wallTop]];
  walled('north-west-gable', gable, planes.north, northGable);
  walled('south-east-gable', gable, planes.south, gableSouthEast);

  const section: Outline = [[-eaveOverhang, eave], [width / 2, ridge], [width + eaveOverhang, eave], [width + eaveOverhang, eave - roofThickness], [width / 2, ridge - roofThickness], [-eaveOverhang, eave - roofThickness]];
  // The attic wall rises straight through the eave, so the slope only starts behind it there.
  const behind = attic.thickness, roofAt = eave + slope * (behind + eaveOverhang);
  prism('roof-left', section, planes.south, -length - rake, attic.left - length, 'roof');
  prism('roof-right', section, planes.south, attic.right - length, rake, 'roof');
  prism('roof-centre', [[behind, roofAt], ...section.slice(1, 5), [behind, roofAt - roofThickness]], planes.south, attic.left - length, attic.right - length, 'roof');
  // Shearing the section vertically along each slope mitres the two runs at the apex.
  const sweepVerge = (name: string, plane: number, outward: number, vergeSection: [number, number][], finish: Finish) => {
    const points: number[] = [];
    const at = ([out, down]: [number, number], v: number) => new THREE.Vector3(plane + outward * out, roofUnderside(v) - down, -v);
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, from: THREE.Vector3) => {
      const facesOut = b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(from)) > 0;
      for (const p of facesOut ? [a, b, c] : [a, c, b]) points.push(p.x, p.y, p.z);
    };
    const mean: [number, number] = [vergeSection.reduce((sum, p) => sum + p[0], 0) / vergeSection.length, vergeSection.reduce((sum, p) => sum + p[1], 0) / vergeSection.length];
    // Each run ends at the wall corner: past it the eave block carries the profile to the outer edge.
    for (const [v0, v1, end] of [[0, width / 2, 0], [width / 2, width, width]]) {
      const centre = at(mean, (v0 + v1) / 2);
      vergeSection.forEach((p, i) => {
        const q = vergeSection[(i + 1) % vergeSection.length];
        triangle(at(p, v0), at(q, v0), at(q, v1), centre);
        triangle(at(p, v0), at(q, v1), at(p, v1), centre);
      });
      const inside = at(mean, end - Math.sign(end - width / 2));
      for (let i = 1; i < vergeSection.length - 1; i++) triangle(at(vergeSection[0], end), at(vergeSection[i], end), at(vergeSection[i + 1], end), inside);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    add(name, geometry, finish);
  };
  for (const [name, plane, outward] of [['south-east-verge', length, 1], ['north-west-verge', 0, -1]] as const) {
    sweepVerge(name, plane, outward, [[0, 0], [rake, 0], [rake, verge.fascia], [0, verge.fascia]], trim);
    sweepVerge(name + '-soffit', plane, outward, [[0, verge.fascia], [rake, verge.fascia], [0, verge.drop]], 'soffit');
  }
  const eaveBox = (name: string, u0: number, u1: number, v0: number, v1: number) => {
    const outer = v0 < 0 ? v0 : v1, inner = v0 < 0 ? v1 : v0, face = outer + Math.sign(outer - inner) * fasciaProud;
    const near = u0 - length, far = u1 - length, fasciaBottom = eave - eaveFascia;
    // The fascia stands just proud of the sheet so it hides the roof's cut edge, as the pale strip does on site.
    prism(name, [[inner, fasciaBottom], [face, fasciaBottom], [face, eave], [outer, eave], [inner, wallTop]], planes.south, near, far, trim);
    prism(name + '-soffit', [[inner, eave - eaveDepth], [face, fasciaBottom], [inner, fasciaBottom]], planes.south, near, far, 'soffit');
  };
  eaveBox('front-eave-left', -rake, attic.left, -eaveOverhang, 0);
  eaveBox('front-eave-right', attic.right, length + rake, -eaveOverhang, 0);
  eaveBox('rear-eave', -rake, length + rake, width, width + eaveOverhang);

  prism('front-belt-left', rectangle(0, belt.gap[0], belt.bottom, belt.top), planes.front, 0, belt.proud, trim);
  prism('front-belt-right', rectangle(belt.gap[1], length, belt.bottom, belt.top), planes.front, 0, belt.proud, trim);
  prism('south-east-belt-return', rectangle(-belt.proud, belt.return, belt.bottom, belt.top), planes.south, 0, belt.proud, trim);
  prism('north-west-belt-return', rectangle(width - belt.return, width + belt.proud, belt.bottom, belt.top), planes.north, 0, belt.proud, trim);

  const [innerLeft, innerRight] = attic.inner;
  prism('attic-front', atticOutline(), planes.front, -attic.thickness, 0, 'wall');
  // The body stops under the cap's underside, or its ridge would poke through the thin sheet.
  const clear = attic.capDrop + attic.capThickness + .01;
  prism('dormer-body', [[innerLeft, wallTop], [innerRight, wallTop], [innerRight, attic.dormerEave - clear], [attic.centre, attic.apex - clear], [innerLeft, attic.dormerEave - clear]], planes.front, -attic.dormerDepth, -attic.thickness, 'cheek');
  const capLeft = innerLeft - attic.capOverhang, capRight = innerRight + attic.capOverhang, drop = attic.capOverhang * (attic.apex - attic.dormerEave) / (attic.centre - innerLeft);
  // Kept just below the attic's own gable so the cap never shows above the front screen.
  const capBase = attic.dormerEave - drop - attic.capDrop, capTop = attic.apex - attic.capDrop;
  prism('dormer-cap', [
    [capLeft, capBase], [attic.centre, capTop], [capRight, capBase], [capRight, capBase - attic.capThickness], [attic.centre, capTop - attic.capThickness], [capLeft, capBase - attic.capThickness],
  ], planes.front, -attic.dormerDepth, -attic.thickness, 'roof');
  // Roof pieces run from the cap's edge down to the main slope, so no open cheek shows beside the dormer.
  const capMeetsRoof = (capBase - eave) / slope - eaveOverhang;
  const coverCheek = (name: string, capEdge: number, foot: number) => {
    const top = new THREE.Vector3(capEdge, capBase, -behind), end = new THREE.Vector3(capEdge, capBase, -capMeetsRoof);
    const outer = new THREE.Vector3(foot, roofAt, -behind), under = new THREE.Vector3(capEdge, roofAt, -behind);
    const centre = top.clone().add(end).add(outer).add(under).multiplyScalar(.25), points: number[] = [];
    for (const [a, b, c] of [[top, end, outer], [top, outer, under], [top, under, end], [end, under, outer]]) {
      const facesOut = b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(centre)) > 0;
      for (const p of facesOut ? [a, b, c] : [a, c, b]) points.push(p.x, p.y, p.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    add(name, geometry, 'roof');
  };
  // The cap is shallower than the attic's gable, so above the upper steps its open end would show the void under it.
  // Wall-coloured because this face sits in the attic's shadow, where the dark sheet read as a hole. It stands 2 mm
  // proud of the cover pieces' front faces, which lie in the same plane.
  prism('dormer-cap-front', [[attic.left, roofAt], [attic.right, roofAt], [capRight, capBase], [attic.centre, capTop], [capLeft, capBase]], planes.front, -behind - attic.capThickness, -behind + .002, trim);
  coverCheek('dormer-cover-left', capLeft, attic.left);
  coverCheek('dormer-cover-right', capRight, attic.right);

  if (shown) {
    const {left, right, flank, rise, risers, tread, landing} = stairs, reach = landing + tread * (risers - 1);
    box('front-landing', left, right, bottom, threshold, -landing, 0, 'steps');
    for (let i = 1; i < risers; i++) box(`front-step-${i}`, left, right, bottom, threshold - rise * i, -landing - tread * i, -landing - tread * (i - 1), 'steps');
    box('front-flank-left', left - flank, left, bottom, threshold, -reach, 0, 'steps');
    box('front-flank-right', right, right + flank, bottom, threshold, -reach, 0, 'steps');

    const door = rear[1], centre = (door.from + door.to) / 2, top = rearGround + rearLanding.rise;
    box('rear-landing', centre - rearLanding.width / 2, centre + rearLanding.width / 2, bottom, top, width, width + rearLanding.depth, 'steps');
    box('rear-step', centre - rearLanding.width / 2, centre + rearLanding.width / 2, bottom, rearGround + rearLanding.rise / 2, width + rearLanding.depth, width + rearLanding.depth + rearLanding.stepDepth, 'steps');
  }

  if (finished) {
    addDetails({add, box, planes}, {rear: rearOpenings, north: northGable, south: gableSouthEast, front}, rearGround, bottom);
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
