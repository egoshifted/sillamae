import test from 'node:test';
import assert from 'node:assert/strict';
import {takeArea, mergeArea} from './store.ts';
import type {PlacementSite} from '../../engine/types.ts';

const bin = (id: string, x: number, z: number) => ({id, asset: 'bin-wheeled-01', p: [x, z, 12] as [number, number, number], heading: 0, attach: 'ground' as const});
const town: PlacementSite = {
  version: 3,
  placements: [bin('a', 10, 10), bin('far', 500, 500), bin('b', 20, 20)],
  roads: [{id: 'cross', type: 'residential', points: [[40, 0], [200, 0]]}, {id: 'away', type: 'residential', points: [[300, 0], [400, 0]]}],
  roadCuts: [{id: 'c1', kind: 'carriageway', ring: [[0, 0], [1, 0], [1, 1]]}],
  trees: {remove: [[5, 5], [600, 600]], add: [{id: 't1', p: [15, 15], z: 12, h: 10, r: 3, type: 'broadleaf'}]},
  hidden: ['near', 'away'],
};
const inside = (x: number, z: number) => Math.abs(x) <= 50 && Math.abs(z) <= 50;

test('an area takes what stands in it and drawn items that reach into it', () => {
  const area = takeArea(town, inside, id => id === 'near');
  assert.deepEqual(area.placements.map(p => p.id), ['a', 'b']);
  assert.deepEqual(area.roads!.map(r => r.id), ['cross']);
  assert.deepEqual(area.trees, {remove: [[5, 5]], add: [town.trees!.add[0]]});
  assert.deepEqual(area.hidden, ['near']);
  area.placements[0].p[0] = 11;
  assert.equal(town.placements[0].p[0], 10, 'the area is a copy');
});

test('merging an unchanged area gives the store back as it was', () => {
  const area = takeArea(town, inside, id => id === 'near');
  assert.deepEqual(mergeArea(town, area, structuredClone(area)), town);
});

test('edits in the area replace, remove and add items without touching the rest', () => {
  const opened = takeArea(town, inside, id => id === 'near'), edited = structuredClone(opened);
  edited.placements = [{...edited.placements[1], heading: 1}, bin('new', 30, 30)];
  edited.roads![0].points.push([250, 0]);
  edited.trees = {remove: [], add: []};
  edited.hidden = [];
  const merged = mergeArea(town, opened, edited);
  assert.deepEqual(merged.placements.map(p => p.id), ['far', 'b', 'new']);
  assert.equal(merged.placements[1].heading, 1);
  assert.deepEqual(merged.roads!.map(r => r.points.length), [3, 2]);
  assert.deepEqual(merged.trees, {remove: [[600, 600]], add: []});
  assert.deepEqual(merged.hidden, ['away']);
  assert.deepEqual(merged.roadCuts, town.roadCuts);
});
