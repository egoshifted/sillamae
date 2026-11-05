import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {surfaces} from '../kesk1/surfaces.ts';
import {acquirePaleMasonry} from '../shared/masonry.ts';
import {bays, design, doorPoints, doorSchedule, fascia, finish, flashings, length, plan, planPoint, roofBays, rustStains, surveyDatum, width} from './design.ts';
import {corrugatedSheet, plankBoards, rustDrip, tile, weatheredSteel} from './textures.ts';

type Height = (u: number, n: number) => number;
type Vec = [number, number, number];
type Stage = 'shell' | 'openings' | 'finished';
interface Bucket {points: number[]; colours: number[]; flips: number[]}

const plainColours = {walls: '#c5c7be', roof: '#55585a', doors: '#6f6a63'};
const bucket = (): Bucket => ({points: [], colours: [], flips: []});

export function createShell(context: OverrideContext) { return build(context, 'shell'); }
export function createOpenings(context: OverrideContext) { return build(context, 'openings'); }
export function createBuilding(context: OverrideContext) { return build(context, 'finished'); }

function build({building, frame, ground, scene}: OverrideContext, stage: Stage): StudyModel {
  const datum = entranceDatum(ground, doorPoints()) ?? surveyDatum, finished = stage === 'finished';
  const at = (u: number, n: number, h: number): Vec => {
    const [x, z] = planPoint(u, n);
    return [x - building.c[0], h, z - building.c[1]];
  };
  const tint = new THREE.Color();
  // The footprint's handedness decides winding, so each face is checked against its solid's centre.
  const quad = (out: Bucket, corners: Vec[], centre: THREE.Vector3, flip = 1) => {
    const [a, b, c, d] = corners.map(p => new THREE.Vector3(...p));
    const outward = b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(c).multiplyScalar(.5).sub(centre)) > 0;
    for (const p of outward ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) {
      out.points.push(p.x, p.y, p.z);
      out.colours.push(tint.r, tint.g, tint.b);
      out.flips.push(flip);
    }
  };
  const solid = (out: Bucket, u0: number, u1: number, n0: number, n1: number, bottom: Height, top: Height, colour = '#ffffff', flip = 1) => {
    tint.set(colour);
    const low = (u: number, n: number) => at(u, n, bottom(u, n)), high = (u: number, n: number) => at(u, n, top(u, n));
    const corners = [low(u0, n0), low(u1, n0), low(u1, n1), low(u0, n1), high(u0, n0), high(u1, n0), high(u1, n1), high(u0, n1)];
    const centre = corners.reduce((sum, p) => sum.add(new THREE.Vector3(...p)), new THREE.Vector3()).multiplyScalar(1 / 8);
    for (const [a, b, c, d] of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) quad(out, [corners[a], corners[b], corners[c], corners[d]], centre, flip);
  };

  const pale = finished ? acquirePaleMasonry() : null, shared = finished ? surfaces() : null;
  const made = finished ? {sheet: corrugatedSheet(), plank: plankBoards(), steel: weatheredSteel(.55), rust: weatheredSteel(1.25), drip: rustDrip()} : null;
  const concreteMap = shared?.maps['concrete-v1'][0] ?? null;
  const surface = (name: string, colour: string, options: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({
    name, roughness: 1, color: finished ? '#ffffff' : colour, vertexColors: finished, ...(finished ? options : {}),
  });
  const steelFinish = {roughness: .72, metalness: .25};
  const materials = {
    walls: surface('Pale brick', plainColours.walls, {map: pale?.maps[0], bumpMap: pale?.maps[1], bumpScale: .02}),
    band: surface('Concrete', plainColours.walls, {map: concreteMap, bumpMap: concreteMap, bumpScale: .018}),
    roof: surface('Roof sheet', plainColours.roof, {map: made?.sheet, bumpMap: made?.sheet, bumpScale: .05}),
    steel: surface('Steel doors', plainColours.doors, {map: made?.steel, ...steelFinish}),
    rust: surface('Rusted steel doors', plainColours.doors, {map: made?.rust, ...steelFinish}),
    plank: surface('Plank doors', plainColours.doors, {map: made?.plank, bumpMap: made?.plank, bumpScale: .012, roughness: .88}),
    fascia: surface('Fascia', plainColours.roof, {map: made?.rust, ...steelFinish}),
    trim: surface('Flashing', plainColours.roof, {roughness: .7, metalness: .2}),
  };
  const scales = new Map<THREE.Material, [number, number]>([
    [materials.walls, [tile.brick.u, tile.brick.v]], [materials.band, [tile.concrete, tile.concrete]], [materials.roof, [tile.sheet, tile.sheet]],
    [materials.steel, [tile.steel, tile.steel]], [materials.rust, [tile.steel, tile.steel]], [materials.fascia, [tile.steel, tile.steel]],
    [materials.plank, [tile.plank, tile.plank]],
  ]);
  // Decals sit on the wall by a few millimetres, so depth must not be written or they fight the band.
  const dripMaterial = finished ? new THREE.MeshStandardMaterial({name: 'Rust stains', map: made?.drip, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 1}) : null;

  const root = new THREE.Group();
  root.name = 'kajaka12a-' + stage;
  const emit = (name: string, out: Bucket, material: THREE.MeshStandardMaterial) => {
    if (!out.points.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.colours, 3));
    geometry.computeVertexNormals();
    // Faces run their texture along themselves because the row is oblique to the axes.
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = new Float32Array(p.count * 2), [w, h] = scales.get(material) ?? [1, 1];
    const a = (plan.doorNorth[0] - plan.doorSouth[0]) / length, b = (plan.doorNorth[1] - plan.doorSouth[1]) / length;
    for (let i = 0; i < p.count; i++) {
      const flat = Math.abs(n.getY(i)) > .5, side = Math.hypot(n.getX(i), n.getZ(i)) || 1;
      const along = flat ? p.getX(i) * a + p.getZ(i) * b : (p.getZ(i) * n.getX(i) - p.getX(i) * n.getZ(i)) / side;
      uv[i * 2] = along * out.flips[i] / w;
      uv[i * 2 + 1] = (flat ? p.getX(i) * -b + p.getZ(i) * a : p.getY(i)) / h;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  };

  // The studio edits single parts. The atlas draws one mesh per material; the shared batcher
  // cannot be used because it rejects the vertex colours that carry the door schedule.
  const batches = new Map<THREE.MeshStandardMaterial, Bucket>();
  const add = (name: string, out: Bucket, material: THREE.MeshStandardMaterial) => {
    if (scene.userData.keepParts) { emit(name, out, material); return; }
    const batch = batches.get(material) ?? bucket();
    batches.set(material, batch);
    for (const key of ['points', 'colours', 'flips'] as const) for (const value of out[key]) batch[key].push(value);
  };

  const {doors, piers, blocks} = bays(), {wall, foot, overhang, rearFall, roofThickness, bandHeight, doorRecess, doorLeaf} = design;
  const flat = (h: number): Height => () => h;
  const pierCentre = (index: number) => (piers[index].u0 + piers[index].u1) / 2;
  const drips: {points: number[]; uv: number[]} = {points: [], uv: []};
  blocks.forEach((block, index) => {
    const eave = (u: number) => block.eave[0] + (block.eave[1] - block.eave[0]) * (u - block.u0) / (block.u1 - block.u0);
    const roof: Height = (u, n) => eave(u) + n / width * rearFall;
    const under: Height = (u, n) => roof(u, n) - roofThickness;
    const head: Height = u => eave(u) - bandHeight;
    const lintelTop: Height = u => head(u, 0) + (finished ? finish.lintel : 0);
    const brick = bucket(), band = bucket(), cover = bucket(), rim = bucket(), trim = bucket();
    const inBlock = (door: number) => { const mid = (doors[door - 1].u0 + doors[door - 1].u1) / 2; return mid > block.u0 && mid < block.u1; };
    solid(brick, block.u0, block.u1, -width, -width + wall, flat(foot), under, finish.rear);
    solid(brick, block.u0, block.u0 + wall, -width + wall, -wall, flat(foot), under, finish.brick);
    if (index === blocks.length - 1) solid(brick, block.u1 - wall, block.u1, -width + wall, -wall, flat(foot), under, finish.brick);
    if (stage === 'shell') solid(brick, block.u0, block.u1, -wall, 0, flat(foot), under, finish.brick);
    else {
      if (finished) solid(band, block.u0, block.u1, -wall, 0, head, lintelTop, finish.band);
      solid(brick, block.u0, block.u1, -wall, 0, lintelTop, under, finish.brick);
      for (const pier of piers) {
        const u0 = Math.max(pier.u0, block.u0), u1 = Math.min(pier.u1, block.u1);
        if (u1 > u0) solid(brick, u0, u1, -wall, 0, flat(foot), head, finish.brick);
      }
    }
    const south = index === 0 ? overhang.end : 0, north = index === blocks.length - 1 ? overhang.end : 0;
    if (finished) {
      for (const [first, last, colour] of roofBays) {
        if (!inBlock(first)) continue;
        const u0 = first === 1 || !inBlock(first - 1) ? block.u0 - south : pierCentre(first - 1);
        const u1 = last === doors.length || !inBlock(last + 1) ? block.u1 + north : pierCentre(last);
        solid(cover, u0, u1, -width - overhang.rear, overhang.door, under, roof, colour);
      }
      doorSchedule.forEach((_, i) => {
        const door = i + 1;
        if (!inBlock(door)) return;
        const u0 = door === 1 || !inBlock(door - 1) ? block.u0 - south : pierCentre(door - 1);
        const u1 = door === doors.length || !inBlock(door + 1) ? block.u1 + north : pierCentre(door);
        const red = fascia.red.doors.includes(door);
        const low: Height = u => eave(u) - roofThickness - fascia.height;
        solid(rim, u0, u1, overhang.door - .04, overhang.door, low, (u, n) => roof(u, n) - roofThickness, red ? fascia.red.colour : fascia.colour);
        if (flashings.some(([a, b]) => door >= a && door <= b)) return;
        // A bump map cannot change the outline, and the wavy sheet edge is what reads from the lane.
        tint.set(roofBays.find(([a, b]) => door >= a && door <= b)![2]);
        const edge = overhang.door + .002, behind = new THREE.Vector3(...at((u0 + u1) / 2, 0, eave(u0)));
        for (let u = u0; u + finish.wave <= u1; u += finish.wave) {
          const point = (t: number, lift: number) => { const along = u + finish.wave * t; return at(along, edge, roof(along, edge) + lift); };
          quad(cover, [point(0, 0), point(1, 0), point(.68, finish.waveHeight), point(.32, finish.waveHeight)], behind);
        }
      });
      for (const [first, last] of flashings) {
        if (!inBlock(first)) continue;
        const up: Height = (u, n) => roof(u, n) + .012;
        solid(trim, pierCentre(first - 1), pierCentre(last), -.3, overhang.door + .015, roof, up, '#c7ced1');
        solid(trim, pierCentre(first - 1), pierCentre(last), overhang.door + .002, overhang.door + .015, u => eave(u) - roofThickness - .05, up, '#c7ced1');
      }
      for (const [door, drip] of rustStains) {
        if (!inBlock(door)) continue;
        const u = pierCentre(door), top = eave(u) - roofThickness - fascia.height + .01, bottom = head(u, 0) - .25;
        const corners = [at(u - drip / 2, .004, bottom), at(u + drip / 2, .004, bottom), at(u + drip / 2, .004, top), at(u - drip / 2, .004, top)];
        const [uvA, uvB, uvC, uvD] = [[0, 0], [1, 0], [1, 1], [0, 1]];
        const outward = new THREE.Vector3(...corners[1]).sub(new THREE.Vector3(...corners[0])).cross(new THREE.Vector3(...corners[2]).sub(new THREE.Vector3(...corners[0]))).dot(new THREE.Vector3(...at(u, 1, top)).sub(new THREE.Vector3(...at(u, 0, top)))) > 0;
        for (const k of outward ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { drips.points.push(...corners[k]); drips.uv.push(...[uvA, uvB, uvC, uvD][k]); }
      }
    } else solid(cover, block.u0 - south, block.u1 + north, -width - overhang.rear, overhang.door, under, roof);
    add(block.name + '-block', brick, materials.walls);
    add(block.name + '-band', band, materials.band);
    add(block.name + '-roof', cover, materials.roof);
    add(block.name + '-fascia', rim, materials.fascia);
    add(block.name + '-flashing', trim, materials.trim);
    if (stage === 'shell') return;
    doors.forEach(({u0, u1}, i) => {
      if (!inBlock(i + 1)) return;
      const out = bucket(), spec = doorSchedule[i], name = `door-${String(i + 1).padStart(2, '0')}`;
      if (!finished) {
        solid(out, u0, u1, -doorRecess - doorLeaf, -doorRecess, flat(foot), head);
        add(name, out, materials.steel);
        return;
      }
      const {frame: side, seam, frameColour} = finish, back = -doorRecess - doorLeaf, face = -doorRecess, mid = (u0 + u1) / 2;
      const inner: Height = u => head(u, 0) - side, top = head(mid, 0);
      solid(out, u0, u1, back - .02, back, flat(foot), head, frameColour);
      solid(out, u0, u0 + side, back, face + .02, flat(foot), head, frameColour);
      solid(out, u1 - side, u1, back, face + .02, flat(foot), head, frameColour);
      solid(out, u0 + side, u1 - side, back, face + .02, inner, head, frameColour);
      solid(out, u0 + side, mid - seam, back, face, flat(foot), inner, spec.colour);
      solid(out, mid + seam, u1 - side, back, face, flat(foot), inner, spec.colour, -1);
      for (const h of [top - .33, top - 1.72]) for (const [a, b] of [[u0 + side, u0 + side + .13], [u1 - side - .13, u1 - side]]) solid(out, a, b, face, face + .018, flat(h), flat(h + .07), '#1e1c1a');
      const handle = top - 1;
      if (spec.latch) solid(out, mid - .09, mid + .05, face, face + .03, flat(handle - .1), flat(handle + .1), '#191816');
      if (spec.plate) solid(out, mid - .17, mid - .03, face, face + .004, flat(top - .32), flat(top - .15), '#d6d4cb');
      if (spec.wicket) {
        const lintel = handle + .95;
        for (const edge of [mid - .45, mid + .42]) solid(out, edge, edge + .03, face, face + .006, flat(foot), flat(lintel), frameColour);
        solid(out, mid - .45, mid + .45, face, face + .006, flat(lintel), flat(lintel + .03), frameColour);
      }
      add(name, out, finished && spec.kind === 'plank' ? materials.plank : spec.rust ? materials.rust : materials.steel);
    });
  });

  if (finished) {
    if (drips.points.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(drips.points, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(drips.uv, 2));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, dripMaterial!);
      mesh.name = 'rust-stains';
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }

  for (const [material, out] of batches) emit(material.name, out, material);
  root.position.set(building.c[0] - frame.origin[0], datum - frame.base, building.c[1] - frame.origin[1]);
  root.userData.audit = {stage, datum, doors: stage === 'shell' ? 0 : doors.length};
  const textured = [...Object.values(materials), ...(dripMaterial ? [dripMaterial] : [])].map(material => ({material, map: material.map, bump: material.bumpMap}));
  let disposed = false;
  return {
    root,
    ready: shared?.ready,
    setTextures(enabled: boolean) {
      for (const {material, map, bump} of textured) {
        material.map = enabled ? map : null;
        material.bumpMap = enabled ? bump : null;
        material.needsUpdate = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      Object.values(materials).forEach(material => material.dispose());
      dripMaterial?.dispose();
      Object.values(made ?? {}).forEach(map => map.dispose());
      pale?.release();
      root.removeFromParent();
    },
  };
}
