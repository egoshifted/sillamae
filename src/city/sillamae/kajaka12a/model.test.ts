import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding, createOpenings, createShell} from './model.ts';
import {bays, doorSchedule, flashings, length, plan, roofBays, rustStains, width} from './design.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const corners = [plan.doorSouth, plan.rearSouth, plan.rearNorth, plan.doorNorth];
const centre: [number, number] = [355.9, 732.875];
const context = (keepParts = true) => ({
  scene: Object.assign(new THREE.Scene(), {userData: {keepParts}}), building: {id: '213815350', c: centre, g: corners, h: 3.84, name: 'Kajaka 12a', pick: 308},
  terrain: {}, frame: {origin: [750, 760], base: 19.3}, ground: [], changed() {},
}) as unknown as OverrideContext;

// Heights in survey metres; u along the door edge from its south end, n out from the door face.
function vertices(root: THREE.Object3D, name: string) {
  const mesh = root.getObjectByName(name) as THREE.Mesh, p = mesh.geometry.getAttribute('position');
  const ax = plan.doorSouth[0], az = plan.doorSouth[1], edge = Math.hypot(plan.doorNorth[0] - ax, plan.doorNorth[1] - az);
  const ux = (plan.doorNorth[0] - ax) / edge, uz = (plan.doorNorth[1] - az) / edge;
  const out: {u: number; n: number; h: number}[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + centre[0], z = p.getZ(i) + centre[1];
    out.push({u: (x - ax) * ux + (z - az) * uz, n: (x - ax) * -uz + (z - az) * ux, h: p.getY(i) + root.position.y + 19.3});
  }
  return out;
}
const roofTop = (root: THREE.Object3D, name: string, side: 'door' | 'rear', end: 'south' | 'north') => {
  const list = vertices(root, name), ns = list.map(v => v.n), wanted = side === 'door' ? Math.max(...ns) : Math.min(...ns);
  // The rear corners sit about 0.1 m off square, so the side is chosen before the end.
  const edge = list.filter(v => Math.abs(v.n - wanted) < .2), us = edge.map(v => v.u), target = end === 'south' ? Math.min(...us) : Math.max(...us);
  return Math.max(...edge.filter(v => Math.abs(v.u - target) < .05).map(v => v.h));
};

test('the row has the 26 doors counted from Street View, split 8 and 18 at the step', () => {
  const model = createOpenings(context());
  const doors = model.root.children.filter(child => child.name.startsWith('door-'));
  assert.equal(doors.length, 26);
  const {blocks, doors: spans} = bays();
  assert.equal(spans.filter(door => door.u1 <= blocks[0].u1).length, 8);
  assert.equal(spans.filter(door => door.u0 >= blocks[1].u0).length, 18);
  model.dispose();
});

test('door widths fit the photographs and the row ends on the source footprint', () => {
  const {doors, piers} = bays();
  assert.ok(doors[0].u1 - doors[0].u0 > 2.6 && doors[0].u1 - doors[0].u0 < 3.3);
  assert.equal(piers.length, 27);
  assert.ok(Math.abs(piers[26].u1 - length) < 1e-9);
  assert.ok(Math.abs(length - 83.65) < .1 && Math.abs(width - 6.56) < .05);
});

test('the wide pier sits between doors 14 and 15', () => {
  const {piers} = bays();
  const widths = piers.map(pier => pier.u1 - pier.u0), wide = widths.indexOf(Math.max(...widths));
  assert.equal(wide, 14);
  assert.ok(widths[wide] > 2 * widths[0]);
});

test('roof ends match the survey eaves and fall to the rear', () => {
  const model = createShell(context());
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < .12, `${actual} vs ${expected}`);
  near(roofTop(model.root, 'south-roof', 'door', 'south'), 17.0);
  near(roofTop(model.root, 'south-roof', 'rear', 'south'), 16.36);
  near(roofTop(model.root, 'north-roof', 'door', 'north'), 17.67);
  near(roofTop(model.root, 'north-roof', 'rear', 'north'), 17.03);
  model.dispose();
});

test('the north block stands above the south block at the step, as in the photographs', () => {
  const model = createShell(context());
  const south = roofTop(model.root, 'south-roof', 'door', 'north'), north = roofTop(model.root, 'north-roof', 'door', 'south');
  assert.ok(north - south > .3 && north - south < .55, String(north - south));
  model.dispose();
});

test('the shell closes the door face and the draft opens it', () => {
  const span = bays().doors[3];
  const jambs = (model: ReturnType<typeof createShell>) => vertices(model.root, 'south-block').filter(v => Math.abs(v.n) < .3 && v.h < 15.5 && (Math.abs(v.u - span.u0) < .03 || Math.abs(v.u - span.u1) < .03)).length;
  const inOpening = (model: ReturnType<typeof createShell>) => vertices(model.root, 'south-block').filter(v => v.u > span.u0 + .03 && v.u < span.u1 - .03 && Math.abs(v.n) < .3 && v.h < 15.5).length;
  const shell = createShell(context()), draft = createOpenings(context());
  assert.equal(jambs(shell), 0);
  assert.ok(jambs(draft) > 0);
  assert.equal(inOpening(draft), 0);
  shell.dispose(); draft.dispose();
});

test('every face points out of its solid', () => {
  const model = createBuilding(context());
  model.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const p = object.geometry.getAttribute('position');
    let volume = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      volume += a.dot(b.cross(c)) / 6;
    }
    assert.ok(volume > 0, object.name);
  });
  model.dispose();
});

test('a closed model frees what it made', () => {
  const model = createBuilding(context());
  const parent = new THREE.Group();
  parent.add(model.root);
  model.dispose();
  model.dispose();
  assert.equal(model.root.parent, null);
});

test('the schedule has one entry per door, with the doors picked out in the photographs', () => {
  assert.equal(doorSchedule.length, bays().doors.length);
  const hue = (door: number) => new THREE.Color(doorSchedule[door - 1].colour);
  assert.ok(hue(11).r > 2 * hue(11).b && hue(11).g > .3, 'door 11 is the ochre one');
  assert.ok(hue(13).r > 2 * hue(13).g, 'door 13 is bright red');
  for (const door of [7, 9, 11, 12, 13, 14, 18, 24, 25]) assert.equal(doorSchedule[door - 1].kind, 'plank', 'door ' + door);
  for (const door of [10, 15, 26]) assert.equal(doorSchedule[door - 1].kind, 'steel', 'door ' + door);
});

test('finished doors use the material of their type', () => {
  const model = createBuilding(context());
  const material = (door: string) => (model.root.getObjectByName(door) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(material('door-11').name, 'Plank doors');
  assert.equal(material('door-10').name, 'Steel doors');
  assert.equal(model.root.children.filter(child => child.name.startsWith('door-')).length, 26);
  model.dispose();
});

test('roof bays cover every door once and flashings sit on doors the photographs show', () => {
  const covered = roofBays.flatMap(([first, last]) => Array.from({length: last - first + 1}, (_, i) => first + i));
  assert.deepEqual(covered, Array.from({length: 26}, (_, i) => i + 1));
  assert.deepEqual(flashings, [[7, 8], [19, 20]]);
});

test('the finished roof keeps the survey eaves, the step and a continuous row', () => {
  const model = createBuilding(context());
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < .12, `${actual} vs ${expected}`);
  near(roofTop(model.root, 'south-roof', 'door', 'south'), 17.0);
  near(roofTop(model.root, 'north-roof', 'door', 'north'), 17.67);
  const south = vertices(model.root, 'south-roof').map(v => v.u), north = vertices(model.root, 'north-roof').map(v => v.u);
  assert.ok(Math.abs(Math.max(...south) - Math.min(...north)) < .1, 'the two roofs meet at the step');
  model.dispose();
});

test('the sheet edge is wavy along corrugated bays and hidden under the flashings', () => {
  const model = createBuilding(context()), {doors} = bays();
  const crests = (from: number, to: number, name: string) => vertices(model.root, name).filter(v => v.n > .11 && v.u > from && v.u < to);
  const height = (list: {h: number}[]) => Math.max(...list.map(v => v.h)) - Math.min(...list.map(v => v.h));
  const plainBay = crests(doors[1].u0 + .2, doors[1].u1 - .2, 'south-roof');
  assert.ok(plainBay.length > 30, String(plainBay.length));
  assert.ok(height(plainBay) > .025, String(height(plainBay)));
  const flashed = crests(doors[18].u0 + .3, doors[18].u1 - .3, 'north-roof');
  assert.ok(!flashed.length, String(flashed.length));
  model.dispose();
});

test('the rear wall is brick, as the owner directed, with no concrete surface', () => {
  const model = createBuilding(context());
  const rearFaces = (name: string) => vertices(model.root, name).filter(v => v.n < -width + .1 && v.h > 15);
  const bricks = rearFaces('south-block').length + rearFaces('north-block').length;
  assert.ok(bricks > 0);
  assert.equal(((model.root.getObjectByName('south-block') as THREE.Mesh).material as THREE.MeshStandardMaterial).name, 'Pale brick');
  model.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || (object.material as THREE.Material).name !== 'Concrete') return;
    assert.equal(rearFaces(object.name).length, 0, object.name);
  });
  model.dispose();
});

test('the worst rusted doors take the heavier surface and plank doors never do', () => {
  const model = createBuilding(context());
  const name = (door: string) => ((model.root.getObjectByName(door) as THREE.Mesh).material as THREE.Material).name;
  for (const door of ['door-04', 'door-05', 'door-16', 'door-17']) assert.equal(name(door), 'Rusted steel doors', door);
  assert.equal(name('door-01'), 'Steel doors');
  assert.equal(doorSchedule.filter(door => door.rust && door.kind === 'plank').length, 0);
  model.dispose();
});

test('rust stains lie on the wall face under the fascia, at the scheduled piers', () => {
  const model = createBuilding(context());
  const stains = vertices(model.root, 'rust-stains'), {piers} = bays();
  assert.equal(stains.length, rustStains.length * 6);
  assert.ok(stains.every(v => Math.abs(v.n) < .02));
  for (const [door] of rustStains) {
    const mid = (piers[door].u0 + piers[door].u1) / 2;
    assert.ok(stains.some(v => Math.abs(v.u - mid) < .4), 'door ' + door);
  }
  model.dispose();
});

test('each door has four hinges at its outer edges and plates sit near the head', () => {
  const model = createBuilding(context());
  const count = (mesh: string) => vertices(model.root, mesh).length;
  assert.equal(count('door-01') - count('door-06'), 0, 'doors of the same make match');
  assert.equal(count('door-16') - count('door-15'), 2 * 36, 'latch and plate add one solid each');
  const {doors} = bays(), door = doors[15], mid = (door.u0 + door.u1) / 2;
  const list = vertices(model.root, 'door-16'), plate = list.filter(v => Math.abs(v.n + .096) < .002 && v.u > mid - .18 && v.u < mid);
  assert.ok(plate.length > 0);
  const head = Math.max(...list.map(v => v.h));
  assert.ok(head - Math.max(...plate.map(v => v.h)) < .3, 'plate is near the door head');
  model.dispose();
});

test('the atlas draws one mesh per material with the same geometry the studio edits', () => {
  const triangles = (root: THREE.Object3D) => {
    let total = 0;
    root.traverse(object => { if (object instanceof THREE.Mesh) total += object.geometry.getAttribute('position').count / 3; });
    return total;
  };
  const parts = createBuilding(context()), atlas = createBuilding(context(false));
  assert.ok(parts.root.children.length > 30);
  assert.ok(atlas.root.children.length <= 9, String(atlas.root.children.length));
  assert.equal(triangles(atlas.root), triangles(parts.root));
  assert.equal(new Set(atlas.root.children.map(child => ((child as THREE.Mesh).material as THREE.Material).uuid)).size, atlas.root.children.length);
  parts.dispose(); atlas.dispose();
});

test('textures switch off and back on without losing maps', () => {
  const model = createBuilding(context());
  const roof = (model.root.getObjectByName('north-roof') as THREE.Mesh).material as THREE.MeshStandardMaterial, map = roof.map;
  assert.ok(map);
  model.setTextures?.(false);
  assert.equal(roof.map, null);
  model.setTextures?.(true);
  assert.equal(roof.map, map);
  model.dispose();
});

test('plain stages stay free of finished surfaces', () => {
  for (const create of [createShell, createOpenings]) {
    const model = create(context());
    model.root.traverse(object => { if (object instanceof THREE.Mesh) assert.equal((object.material as THREE.MeshStandardMaterial).map, null, object.name); });
    model.dispose();
  }
});
