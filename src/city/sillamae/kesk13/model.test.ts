import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFinished, createDetails} from './model.ts';
import {eaves, ridges, courtyardNotch} from './design.ts';
import {roofStacks, stackFrame} from './chimneys.ts';
import {roofVents, roofHeight} from './roof.ts';
import {streetWalls} from './street.ts';
import {streetDownpipes} from './access.ts';
import {dampPatches, wearStreaks, wearUniforms} from './wear.ts';
import {wallCorners} from './cornice.ts';
import type {OverrideContext} from '../../../engine/types.ts';

const centre = [385.92, 649.33];
const context = (keepParts = true) => {
  const scene = new THREE.Scene();
  scene.userData.keepParts = keepParts;
  return {scene, building: {id: '213726928', c: centre, g: [], h: 12, name: 'Kesk 13', pick: 1},
    terrain: {}, frame: {origin: [750, 760], base: 19.3}, ground: [], changed() {}} as unknown as OverrideContext;
};
const ids = (root: THREE.Object3D) => {const out: string[] = []; root.traverse(o => {if (o.userData.id) out.push(o.userData.id);}); return out;};
const finished = createFinished(context());
const partIds = ids(finished.root);
const materialOf = (id: string) => ((finished.root.children.find(o => o.userData.id === id) as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString();

// Where a stack centre falls along the Kesk front, as a fraction of edge 7 from its west end.
const alongKesk = (s: typeof roofStacks[number]) => {
  const {at} = stackFrame(s), [x, z] = at(0, 0, 0), a = eaves[7], b = eaves[0];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / length / length;
};

test('the Kesk street slope has one clad row near the west hip and nothing over the rest', () => {
  const kesk = roofStacks.filter(s => s.edge === 7);
  assert.equal(new Set(kesk.map(s => s.group)).size, 1);
  assert.ok(kesk.every(s => s.clad && Math.abs(s.t - .2) < .05));
  const front = kesk.reduce((a, b) => a.setback < b.setback ? a : b);
  assert.ok(front.rise >= 2 && kesk.every(s => s === front || (s.w < front.w && s.rise < front.rise)), 'the tall front stack has slimmer, lower ones behind it');
});

test('the box seen over the Kesk ridge mid-roof is a low row high on the courtyard slope', () => {
  const box = roofStacks.filter(s => s.edge === 5);
  assert.ok(box.length > 0 && box.every(s => s.rise < 1 && s.setback >= 3 && !s.clad));
  for (const s of box) assert.ok(Math.abs(alongKesk(s) - .5) < .06, 'it lines up with the middle of the Kesk front');
});

test('the Kajaka street slope keeps three rows: two clad and one of plain boxes', () => {
  const kajaka = roofStacks.filter(s => s.edge === 0);
  assert.deepEqual([...new Set(kajaka.map(s => s.group))], [0, 1, 2]);
  assert.ok(kajaka.filter(s => s.group < 2).every(s => s.clad));
  assert.ok(kajaka.filter(s => s.group === 2).every(s => !s.clad));
});

test('stacks stand on their own slope, clear of the dormers and below the ridge', () => {
  const ridgeTop = Math.max(...ridges.map(r => r[2]));
  for (const s of roofStacks) {
    const {at, top} = stackFrame(s, courtyardNotch);
    for (const [u, v] of [[-s.w, -s.d], [s.w, -s.d], [s.w, s.d], [-s.w, s.d]]) {
      const [x, z] = at(u, v, 0);
      assert.doesNotThrow(() => roofHeight(x, z, courtyardNotch));
    }
    assert.ok(s.setback - s.d > 1, 'the front face stays well up the slope from the eave');
    assert.ok(top < ridgeTop + .5);
    for (const vent of roofVents.filter(v => v.edge === s.edge)) {
      const a = eaves[s.edge], b = eaves[(s.edge + 1) % 8], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const gap = Math.abs((vent.t - s.t) * length - s.along) - vent.width / 2 - s.w;
      assert.ok(gap > .5, `stack on edge ${s.edge} at ${s.t} clears the dormer at ${vent.t}`);
    }
  }
});

test('the finished model builds every scheduled stack and the review stages keep their eighteen', () => {
  assert.equal(partIds.filter(id => /\/chimney-[\d-]+\/body$/.test(id)).length, roofStacks.length);
  assert.equal(partIds.filter(id => /\/chimney-[\d-]+\/cladding$/.test(id)).length, roofStacks.filter(s => s.clad).length);
  const draft = createDetails(context());
  assert.equal(ids(draft.root).filter(id => /\/chimney-[\d-]+\/body$/.test(id)).length, 18);
  draft.dispose();
});

test('both street fronts carry the garland under bays 2 and 9 and nowhere else', () => {
  const garlands = partIds.filter(id => id.endsWith('/rosette')).sort();
  assert.deepEqual(garlands, [
    'kesk13/edge-0/bay-2/L2/rosette', 'kesk13/edge-0/bay-9/L2/rosette',
    'kesk13/edge-7/bay-2/L2/rosette', 'kesk13/edge-7/bay-9/L2/rosette',
  ]);
  for (const id of garlands) {
    const base = id.replace('/rosette', '');
    assert.ok(partIds.includes(base + '/sill-consoles') && partIds.includes(base + '/foliate-swag'));
  }
});

test('only garland bays and balconies keep a plaster surround on the street fronts', () => {
  for (const edge of [0, 7]) for (const [index, bay] of streetWalls[edge]!.bays.entries()) for (const level of ['L1', 'L2']) {
    const kind = level === 'L1' ? bay.lower : bay.upper;
    const framed = partIds.includes(`kesk13/edge-${edge}/bay-${index + 1}/${level}/moulding`);
    assert.equal(framed, kind === 'balcony' || index + 1 === 2 || index + 1 === 9, `edge ${edge} bay ${index + 1} ${level}`);
    if (kind === 'window') assert.ok(partIds.includes(`kesk13/edge-${edge}/bay-${index + 1}/${level}/sill`));
  }
  assert.ok(partIds.includes('kesk13/edge-2/bay-1/L2/moulding'), 'courtyard surrounds are untouched');
});

test('quoins rise at the street corner and the west end of the Kesk front, clear of the end-wall windows', () => {
  for (const corner of [0, 7]) assert.equal(partIds.filter(id => id.startsWith(`kesk13/corner-${corner}/course-`)).length, 20);
  assert.ok(!partIds.some(id => /\/corner-[1-6]\//.test(id)));
  const walls = wallCorners(), end = Math.hypot(walls[7][0] - walls[6][0], walls[7][1] - walls[6][1]);
  assert.ok(.72 * end + .72 < end - .58, 'the widest quoin stops short of the nearer end-wall window');
  const {length, spans} = openingSpans(7);
  assert.ok(spans[0][0] > .58 && length > 0, 'and of bay 1 on the Kesk front');
});

test('timber and PVC sashes follow the photographed street windows', () => {
  const brown = '51473f', white = 'e1dfd5';
  for (const bay of [2, 7, 8, 9, 10]) assert.equal(materialOf(`kesk13/edge-7/bay-${bay}/L2/frame`), brown);
  for (const bay of [1, 3, 4, 5, 6]) assert.equal(materialOf(`kesk13/edge-7/bay-${bay}/L2/frame`), white);
  for (const bay of [1, 2]) assert.equal(materialOf(`kesk13/edge-0/bay-${bay}/L2/frame`), brown);
  for (const bay of [3, 5, 9]) assert.equal(materialOf(`kesk13/edge-0/bay-${bay}/L2/frame`), white);
  for (let bay = 1; bay <= 10; bay++) assert.equal(materialOf(`kesk13/edge-7/bay-${bay}/L1/frame`), white);
  assert.ok(partIds.includes('kesk13/edge-7/bay-1/L1/sashes'));
  assert.ok(!partIds.some(id => /edge-[2-6]\/.*\/sashes$/.test(id)), 'courtyard sashes are not evidenced');
});

const openingSpans = (edge: number) => {
  const walls = wallCorners(), a = walls[edge], b = walls[(edge + 1) % 8], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {length, spans: streetWalls[edge]!.bays.map(bay => [bay.centre * length - .875, bay.centre * length + .875])};
};

test('street downpipes run between bays, three to each front', () => {
  for (const edge of [0, 7]) {
    const pipes = streetDownpipes.filter(p => p.edge === edge);
    assert.equal(pipes.length, 3);
    const {length, spans} = openingSpans(edge);
    for (const p of pipes) assert.ok(spans.every(([l, r]) => p.fraction * length < l - .2 || p.fraction * length > r + .2), `pipe ${edge}/${p.fraction} misses every opening`);
    for (const [index] of pipes.entries()) assert.ok(partIds.some(id => id.startsWith(`kesk13/drain-${edge}-`) && id.endsWith('/pipe')), `${edge}/${index}`);
  }
});

test('weathering marks sit on the street walls between plinth and eaves', () => {
  for (const p of dampPatches) {
    assert.ok(streetWalls[p.edge]);
    assert.ok(p.t - 0 > .02 && p.t < .98);
    assert.ok(p.h - p.tall > 15.85 && p.h + p.tall < 24.2, `patch ${p.edge}/${p.t} stays on the wall`);
  }
  const streaks = wearStreaks();
  const windows = Object.values(streetWalls).flatMap(s => s!.bays.flatMap(b => [b.lower, b.upper])).filter(k => k === 'window').length;
  const balconies = Object.values(streetWalls).flatMap(s => s!.bays).filter(b => b.upper === 'balcony').length;
  assert.equal(streaks.length, windows + balconies + streetDownpipes.filter(p => streetWalls[p.edge]).length);
  for (const s of streaks) assert.ok(s.top - s.length > 15.5 && s.top < 23.9);
  const {patches, streaks: packed} = wearUniforms(centre);
  assert.equal(patches.length, dampPatches.length * 2);
  assert.equal(packed.length, streaks.length * 2);
  assert.ok([...patches, ...packed].flat().every(Number.isFinite));
});

test('the finished model stays finite and releases its resources', () => {
  finished.root.traverse(o => {
    const g = (o as THREE.Mesh).geometry;
    if (g) assert.ok(Array.from(g.attributes.position.array as Float32Array).every(Number.isFinite));
  });
  const merged = createFinished(context(false));
  assert.ok((merged.root as THREE.Mesh).geometry.attributes.position.count > 0);
  merged.dispose();
});
