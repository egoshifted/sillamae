import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuilding, createFinished, createShell} from './model.ts';
import {atticOutline, design, detail, slope, footprint, front, gableNorthWest, gableSouthEast, length, planPoint, rear, width} from './design.ts';
import {wear} from './wear.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const context = () => ({
  scene: new THREE.Scene(), building: {id: '73512071', c: [285.3, 546.2], g: footprint, h: 8.96, name: 'Kesk 8a', pick: 156},
  terrain: {}, frame: {origin: [750, 760], base: 19.3}, ground: [], changed() {},
}) as unknown as OverrideContext;

const names = (root: THREE.Object3D) => root.children.map(child => child.name);

test('the shop front is the shorter south-west edge, not the longer gable side', () => {
  assert.ok(Math.abs(length - 10.95) < .01);
  assert.ok(Math.abs(width - 12.51) < .01);
  const [ax, az] = planPoint(0, 0), [bx, bz] = planPoint(length, 0);
  // Survey z runs south, so a south-west outward normal has negative x and positive z.
  const outward = [az - bz, bx - ax];
  assert.ok(outward[0] < 0 && outward[1] > 0);
});

test('every corner of the plan lands on the survey footprint', () => {
  const corners = [planPoint(0, 0), planPoint(0, width), planPoint(length, width), planPoint(length, 0)];
  corners.forEach(([x, z], i) => assert.ok(Math.hypot(x - footprint[i][0], z - footprint[i][1]) < .05));
});

test('elevations carry the openings counted from the photographs', () => {
  assert.equal(front.filter(o => o.kind === 'window').length, 2);
  assert.equal(front.filter(o => o.kind === 'door').length, 1);
  assert.equal(rear.filter(o => o.kind === 'window').length, 2);
  assert.equal(rear.filter(o => o.kind === 'door').length, 1);
  assert.equal(gableNorthWest.filter(o => o.kind === 'louvre').length, 2);
  assert.equal(gableNorthWest.filter(o => o.kind === 'window').length, 1);
  assert.deepEqual(gableSouthEast.map(o => o.kind), ['louvre', 'louvre']);
});

test('the door sits centrally in the front between the two shop windows', () => {
  const [left, door, right] = front;
  assert.ok(left.to < door.from && door.to < right.from);
  assert.ok(Math.abs((door.from + door.to) / 2 - length / 2) < .05);
});

test('openings stay inside their walls and below the roof', () => {
  for (const o of [...front, ...rear]) { assert.ok(o.from > design.wall && o.to < length - design.wall); assert.ok(o.head < design.eave); }
  for (const o of [...gableNorthWest, ...gableSouthEast]) assert.ok(o.from > design.wall && o.to < width - design.wall);
});

test('the ridge reaches the surveyed height and runs parallel to the front', () => {
  const model = createShell(context());
  const bounds = new THREE.Box3();
  for (const name of ['roof-left', 'roof-centre', 'roof-right']) {
    const roof = model.root.getObjectByName(name) as THREE.Mesh;
    roof.geometry.computeBoundingBox();
    bounds.union(roof.geometry.boundingBox!);
  }
  const {min, max} = bounds;
  assert.ok(Math.abs(max.y - 8.96) < 1e-6);
  assert.ok(Math.abs(max.x - min.x - (length + 2 * design.rake)) < 1e-6);
  assert.ok(Math.abs(max.z - min.z - (width + 2 * design.eaveOverhang)) < 1e-6);
  model.dispose();
});

test('the shell has no opening fills or steps and the openings stage has all of them', () => {
  const shell = createShell(context()), full = createBuilding(context());
  for (const o of [...front, ...rear, ...gableNorthWest, ...gableSouthEast]) {
    assert.ok(!names(shell.root).includes(o.id));
    assert.ok(names(full.root).includes(o.id), o.id);
  }
  assert.ok(!names(shell.root).includes('front-landing'));
  assert.ok(names(full.root).includes('front-landing') && names(full.root).includes('rear-landing'));
  shell.dispose(); full.dispose();
});

const roofGeometry = (root: THREE.Object3D, name: string) => {
  const mesh = root.getObjectByName(name) as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  return {box: mesh.geometry.boundingBox!, position: mesh.geometry.getAttribute('position')};
};

test('the attic steps twice on each side before its gable, as in the annotated photograph', () => {
  const outline = atticOutline(), heights = outline.map(([, h]) => h);
  assert.equal(outline.length, 11);
  assert.ok(Math.abs(design.attic.right - design.attic.left - 3.07) < .05);
  assert.ok(Math.abs(design.attic.inner[1] - design.attic.inner[0] - 2.17) < .05);
  assert.ok(Math.abs(design.attic.rake[1] - design.attic.rake[0] - 1.62) < .05);
  assert.equal(heights.filter(h => h === design.attic.shoulder).length, 4);
  assert.equal(heights.filter(h => h === design.attic.step).length, 4);
  // The rejected first draft had one shoulder at 5.35 running straight into the gable.
  assert.ok(design.attic.step - design.attic.shoulder > .3);
  assert.ok(design.attic.shoulder > 5.35);
});

const lowestAt = (position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, axis: 'z' | 'x', value: number) => {
  let low = Infinity;
  for (let i = 0; i < position.count; i++) if (Math.abs((axis === 'z' ? position.getZ(i) : position.getX(i)) - value) < 1e-5) low = Math.min(low, position.getY(i));
  return low;
};

test('the eave blocks stop at the attic and their underside falls back to the wall', () => {
  const model = createBuilding(context()), {root} = model;
  const left = roofGeometry(root, 'front-eave-left-soffit'), right = roofGeometry(root, 'front-eave-right');
  assert.ok(Math.abs(left.box.max.x - design.attic.left) < 1e-6 && Math.abs(right.box.min.x - design.attic.right) < 1e-6);
  const atWall = lowestAt(left.position, 'z', 0), atFascia = lowestAt(left.position, 'z', design.eaveOverhang + design.fasciaProud);
  assert.ok(Math.abs(atWall - (design.eave - .52)) < 1e-5);
  assert.ok(Math.abs(atFascia - (design.eave - .3)) < 1e-5);
  // The first rejected draft had a flat soffit, which leaves no fall between fascia and wall.
  assert.ok(atFascia - atWall > .15);
  model.dispose();
});

test('the soffit is one straight face from fascia to wall, not the rejected stack of chords', () => {
  const model = createBuilding(context()), {root} = model;
  const {position} = roofGeometry(root, 'front-eave-left-soffit');
  const depths = new Set(Array.from({length: position.count}, (_, i) => position.getZ(i).toFixed(4)));
  assert.equal(depths.size, 2);
  assert.ok(!root.getObjectByName('north-west-verge-moulding'));
  model.dispose();
});

test('the fascia covers the cut edge of the roof sheet', () => {
  const model = createBuilding(context());
  const fascia = roofGeometry(model.root, 'front-eave-left'), roof = roofGeometry(model.root, 'roof-left').box;
  assert.ok(fascia.box.max.z > roof.max.z);
  let top = -Infinity;
  for (let i = 0; i < fascia.position.count; i++) if (Math.abs(fascia.position.getZ(i) - fascia.box.max.z) < 1e-5) top = Math.max(top, fascia.position.getY(i));
  assert.ok(Math.abs(top - design.eave) < 1e-5);
  // The rejected draft's 0.16 m sheet edge read as a black band along the whole eave.
  assert.ok(design.roofThickness < .1);
  model.dispose();
});

test('the verge falls from fascia to wall at both gables and stops at the wall corners', () => {
  const model = createBuilding(context()), {root} = model;
  for (const [name, wallPlane, outer] of [['south-east-verge-soffit', length, length + design.rake], ['north-west-verge-soffit', 0, -design.rake]] as const) {
    const {position, box} = roofGeometry(root, name);
    assert.ok(lowestAt(position, 'x', outer) - lowestAt(position, 'x', wallPlane) > .15, name);
    // Running past the corner put a nib below the eave block in the rejected draft.
    assert.ok(box.max.z <= 1e-5 && box.min.z >= -width - 1e-5, name);
  }
  model.dispose();
});

test('verge faces point away from the solid', () => {
  const model = createBuilding(context());
  const {position} = roofGeometry(model.root, 'south-east-verge');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (Math.abs(a.x - length - design.rake) < 1e-5 && Math.abs(b.x - a.x) < 1e-5 && Math.abs(c.x - a.x) < 1e-5) assert.ok(normal.x > 0);
  }
  model.dispose();
});

test('the dormer is dark metal cheeks under a roof that starts at the upper step', () => {
  const model = createBuilding(context()), body = model.root.getObjectByName('dormer-body') as THREE.Mesh;
  assert.equal((body.material as THREE.MeshStandardMaterial).name, 'cheek');
  // The rejected drafts carried the cap down to 5.74 m or lower, far below the attic's upper step.
  assert.ok(design.attic.dormerEave > 5.8);
  // Owner removed the solid saddle wedges; the thin metal returns only with the finish pass.
  assert.ok(!model.root.getObjectByName('saddle-left') && !model.root.getObjectByName('saddle-right'));
  model.dispose();
});

test('no roof slope passes in front of the attic wall', () => {
  const model = createBuilding(context());
  const centre = roofGeometry(model.root, 'roof-centre').box;
  // Model z is -v, so the front overhang would show as positive z; the rejected draft reached +0.5.
  assert.ok(centre.max.z <= -design.attic.thickness + 1e-6);
  assert.ok(Math.abs(centre.min.x - design.attic.left) < 1e-6 && Math.abs(centre.max.x - design.attic.right) < 1e-6);
  model.dispose();
});

test('roof pieces close both sides of the dormer down to the main slope, within the attic width', () => {
  const model = createBuilding(context());
  for (const [name, foot] of [['dormer-cover-left', design.attic.left], ['dormer-cover-right', design.attic.right]] as const) {
    const {box} = roofGeometry(model.root, name);
    assert.ok(Math.abs(foot === design.attic.left ? box.min.x - foot : box.max.x - foot) < 1e-5, name);
    const roofTopAtBack = design.eave + slope * (design.attic.thickness + design.eaveOverhang);
    assert.ok(Math.abs(box.min.y - roofTopAtBack) < 1e-5, name);
    // Without these the dark cheek stood open from the main roof up to the cap's edge.
    assert.ok(box.max.y > design.attic.dormerEave - .2, name);
    assert.ok(((model.root.getObjectByName(name) as THREE.Mesh).material as THREE.Material).name === 'roof');
  }
  model.dispose();
});

test('no void shows under the dormer cap above the attic steps', () => {
  const model = createBuilding(context());
  const front = roofGeometry(model.root, 'dormer-cap-front').box, cap = roofGeometry(model.root, 'dormer-cap').box;
  assert.ok(Math.abs(front.max.y - cap.max.y) < 1e-6);
  assert.ok(Math.abs(front.min.x - design.attic.left) < 1e-6 && Math.abs(front.max.x - design.attic.right) < 1e-6);
  assert.notEqual(((model.root.getObjectByName('dormer-cap-front') as THREE.Mesh).material as THREE.Material).name, 'roof');
  // The panel reaches down to the main slope, so the rejected gap beneath the cap's open end is closed.
  assert.ok(Math.abs(front.min.y - (design.eave + slope * (design.attic.thickness + design.eaveOverhang))) < 1e-6);
  model.dispose();
});

test('vertical roof faces keep varying UVs, which the normal map needs to avoid rendering black', () => {
  const model = createFinished(detailContext(true));
  const mesh = model.root.getObjectByName('dormer-cap') as THREE.Mesh, uv = mesh.geometry.getAttribute('uv'), normal = mesh.geometry.getAttribute('normal');
  const front = Array.from({length: uv.count}, (_, i) => i).filter(i => Math.abs(normal.getZ(i)) > .9);
  assert.ok(new Set(front.map(i => uv.getY(i).toFixed(3))).size > 1);
  assert.ok(new Set(front.map(i => uv.getX(i).toFixed(3))).size > 1);
  model.dispose();
});

test('the belt course wraps both front corners onto the gables', () => {
  const model = createBuilding(context());
  const south = roofGeometry(model.root, 'south-east-belt-return').box, north = roofGeometry(model.root, 'north-west-belt-return').box;
  assert.ok(south.min.x >= length - 1e-6 && south.max.x > length);
  assert.ok(north.max.x <= 1e-6 && north.min.x < 0);
  model.dispose();
});

const detailContext = (keepParts: boolean) => {
  const base = context();
  base.scene.userData.keepParts = keepParts;
  return base;
};

test('every shop window pane has its own diamond grille, and the blank panels stay clear', () => {
  const model = createFinished(detailContext(true)), parts = names(model.root);
  for (const id of ['front-window-left', 'front-window-right']) for (const pane of [1, 2]) assert.ok(parts.some(n => n.startsWith(`${id}-grille-${pane}-0-0`)), `${id} ${pane}`);
  const blank = front[0].blank!;
  model.root.traverse(child => {
    if (!child.name.startsWith('front-window-left-grille') || !(child instanceof THREE.Mesh)) return;
    child.geometry.computeBoundingBox();
    assert.ok(child.geometry.boundingBox!.min.x >= blank[1] - 1e-3, child.name);
  });
  model.dispose();
});

test('the finished stage carries the observed attachments on their own walls', () => {
  const model = createFinished(detailContext(true)), parts = names(model.root);
  for (const part of ['sign-face', 'rail-top', 'bin-square-body', 'bin-square-collar', 'bin-round-body', 'bin-round-rim', 'rear-lamp-body', 'rear-vent', 'quoin-south-east-1', 'quoin-north-west-1', 'door-flank-1-1', 'door-pier-cap']) assert.ok(parts.includes(part), part);
  for (const o of [...gableNorthWest, ...gableSouthEast].filter(o => o.kind === 'louvre')) assert.ok(parts.includes(o.id + '-slat-0'), o.id);
  model.dispose();
});

test('the stone bins stand either side of the steps, square on the left and round on the right', () => {
  const model = createFinished(detailContext(true));
  const square = roofGeometry(model.root, 'bin-square-collar').box, round = roofGeometry(model.root, 'bin-round-rim').box;
  const {left, right, landing, tread, risers} = design.stairs, front = landing + tread * (risers - 1);
  assert.ok(square.max.x <= left && round.min.x >= right - .2);
  assert.ok(square.min.z >= front - 1e-6 && round.min.z >= front - 1e-6);
  assert.ok(Math.abs(square.max.x - square.min.x - (square.max.z - square.min.z)) < 1e-6);
  assert.equal(model.root.getObjectByName('front-block-left'), undefined);
  // The owner rejected the round bin sitting off its flank and off the square bin's line.
  const centre = (box: THREE.Box3, axis: 'x' | 'z') => (box.min[axis] + box.max[axis]) / 2;
  assert.ok(Math.abs(centre(square, 'z') - centre(round, 'z')) < 1e-5);
  assert.ok(Math.abs(centre(round, 'x') - (right + design.stairs.flank / 2)) < 1e-5);
  assert.ok(Math.abs(centre(square, 'x') - (left - design.stairs.flank / 2)) < 1e-5);
  assert.ok(square.max.y > .6 && square.max.y < .8 && round.max.y > .5 && round.max.y < .75);
  model.dispose();
});

test('the rail stands at the owner-marked spot, on the landing and clear of the window sill', () => {
  const model = createFinished(detailContext(true));
  const post = roofGeometry(model.root, 'rail-post-1').box, far = roofGeometry(model.root, 'rail-post-2').box;
  assert.ok(Math.abs((post.min.x + post.max.x) / 2 - 7.03) < 1e-5 && Math.abs((far.min.x + far.max.x) / 2 - 7.03) < 1e-5);
  assert.ok(post.max.x < design.stairs.right && post.min.z > detail.sill.proud);
  model.dispose();
});

test('wear stays on its wall, clear of the north-west window, and never casts a shadow', () => {
  const window = gableNorthWest.find(o => o.kind === 'window')!, from = width - window.to, to = width - window.from;
  for (const sheet of Object.values(wear)) {
    for (const [s, h, w, tall] of [...sheet.spalls, ...sheet.scuffs, ...sheet.stains, ...sheet.ochre]) {
      assert.ok(s - w / 2 >= sheet.from - 1e-6 && s + w / 2 <= sheet.to + 1e-6, `${s}`);
      assert.ok(h - tall / 2 >= 0 && h + tall / 2 <= sheet.top, `${h}`);
    }
  }
  for (const [s, h, w, tall] of wear.north.spalls) assert.ok(s + w / 2 < from || s - w / 2 > to || h + tall / 2 < window.sill, `${s}`);
  const model = createFinished(detailContext(true));
  for (const name of ['wear-north-west', 'wear-south-east', 'wear-front', 'wear-rear']) {
    const mesh = model.root.getObjectByName(name) as THREE.Mesh, material = mesh.material as THREE.MeshStandardMaterial;
    assert.equal(mesh.castShadow, false, name);
    assert.ok(material.transparent && !material.depthWrite, name);
  }
  model.dispose();
});

test('wear hides with the textures rather than turning into a white sheet', () => {
  const model = createFinished(detailContext(true));
  const material = (model.root.getObjectByName('wear-front') as THREE.Mesh).material as THREE.Material;
  model.setTextures!(false);
  assert.equal(material.visible, false);
  model.setTextures!(true);
  assert.equal(material.visible, true);
  model.dispose();
});

test('the graffiti sits where the owner photographs show it', () => {
  const [tag] = wear.north.tags;
  assert.ok(tag.s > 6.7 && tag.s < 7.4 && tag.h > 1.25 && tag.h < 1.65);
  const look = wear.south.tags.find(t => t.text === 'ЗАГЛЯНИ')!, inside = wear.south.tags.find(t => t.text.includes('ВНУТРЬ'))!;
  assert.ok(look.s < 3 && look.h > inside.h);
  for (const t of wear.south.tags) assert.ok(t.s > wear.south.from && t.s < 3.2 && t.h < wear.south.top, t.text);
  // The owner removed the red lines, which were a guess at illegible text.
  assert.ok(!wear.south.tags.some(t => t.colour === '#b0303a' || /ПРОВЕРЬ|ГРАНЕТ/.test(t.text)));
  assert.equal(tag.text, 'Gonood');
  const {arrow, smile} = wear.north.marker!;
  assert.ok(arrow.s > tag.s && smile.s > arrow.s && arrow.from < tag.h && arrow.to > tag.h);
});

test('rear damp is strongest at the north corner, as circled by the owner', () => {
  const corner = wear.rear.stains.find(([s]) => s > length - 2)!, doorward = wear.rear.stains.find(([s]) => s < length - 2)!;
  assert.ok(corner[1] + corner[3] / 2 > doorward[1] + doorward[3] / 2);
});

test('gable openings follow the near-frontal photograph, not the first oblique estimate', () => {
  const window = gableNorthWest.find(o => o.kind === 'window')!;
  assert.ok(Math.abs(width - window.to - 2.72) < 1e-6 && Math.abs(window.sill - 1.34) < 1e-6);
  const [left, right] = gableNorthWest;
  assert.ok(Math.abs(right.from - left.to - 1.62) < .01);
  assert.ok(Math.abs((left.from + right.to) / 2 - width / 2) < 1e-6);
});

test('door, pier, panel, sign, belt gap, attic, steps and windows all mirror about one axis', () => {
  const middle = length / 2, mid = (a: number, b: number) => (a + b) / 2, {attic, belt, stairs} = design, {pier, sign, doorFlanks} = detail;
  // The rejected draft had these centres anywhere from 5.45 to 5.65.
  for (const [name, a, b] of [
    ['door', front[1].from, front[1].to], ['pier', pier.left, pier.right], ['panel', pier.panel.left, pier.panel.right], ['sign', sign.left, sign.right],
    ['belt gap', belt.gap[0], belt.gap[1]], ['attic', attic.left, attic.right], ['upper step', attic.inner[0], attic.inner[1]], ['gable', attic.rake[0], attic.rake[1]],
    ['stairs', stairs.left, stairs.right], ['door flanks', doorFlanks[0][0], doorFlanks[1][1]], ['windows', front[0].from, front[2].to], ['inner windows', front[0].to, front[2].from],
  ] as const) assert.ok(Math.abs(mid(a, b) - middle) < 1e-9, name);
  assert.ok(Math.abs(attic.centre - middle) < 1e-9);
  assert.ok(Math.abs(mid(front[0].blank![0], front[2].blank![1]) - middle) < 1e-9 && Math.abs(mid(front[0].blank![1], front[2].blank![0]) - middle) < 1e-9);
});

test('the rail bends past its outer post and slopes down outward, away from the wall', () => {
  const model = createFinished(detailContext(true));
  const tail = model.root.getObjectByName('rail-tail') as THREE.Mesh, top = roofGeometry(model.root, 'rail-top').box;
  const position = tail.geometry.getAttribute('position'), points = Array.from({length: position.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
  const near = points.reduce((a, b) => b.z < a.z ? b : a), far = points.reduce((a, b) => b.z > a.z ? b : a);
  // Model z grows outward from the front wall.
  assert.ok(far.z > top.max.z + .4);
  assert.ok(far.y < near.y - .2);
  assert.ok(near.z < top.max.z + .1 && Math.abs(near.y - top.max.y) < .1);
  assert.ok(far.y > design.stairs.rise * design.stairs.risers);
  model.dispose();
});

test('the corner quoins wrap the corner without leaving the wall plane open', () => {
  const model = createFinished(detailContext(true));
  const box = roofGeometry(model.root, 'quoin-south-east-1').box;
  assert.ok(Math.abs(box.min.x - length) < 1e-6);
  assert.ok(box.max.z >= detail.rustication.proud - 1e-6);
  model.dispose();
});

test('the sign reads outward from the front wall, at the height in the owner photograph', () => {
  const model = createFinished(detailContext(true)), face = roofGeometry(model.root, 'sign-face').box;
  assert.ok(face.max.z > 0);
  assert.ok(Math.abs(face.max.x - face.min.x - 1.53) < .01 && Math.abs(face.max.y - 4.97) < .01);
  assert.ok(face.min.x >= design.attic.left && face.max.x <= design.attic.right);
  model.dispose();
});

test('the atlas batches by material while the studio keeps named parts, and textures toggle back', () => {
  const batched = createFinished(detailContext(false)), parts = createFinished(detailContext(true));
  assert.ok(batched.root.children.length < 25);
  assert.ok(parts.root.children.length > 200);
  const roof = parts.root.getObjectByName('roof-left') as THREE.Mesh, material = roof.material as THREE.MeshStandardMaterial, map = material.map;
  assert.ok(map && material.normalMap);
  parts.setTextures!(false);
  assert.equal(material.map, null);
  parts.setTextures!(true);
  assert.equal(material.map, map);
  batched.dispose(); parts.dispose();
});

test('all generated geometry is finite at every stage', () => {
  for (const model of [createShell(context()), createBuilding(context()), createFinished(detailContext(true))]) {
    model.root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      for (const value of child.geometry.getAttribute('position').array) assert.ok(Number.isFinite(value), child.name);
    });
    model.dispose();
  }
});
