import test from 'node:test';
import assert from 'node:assert/strict';
import {migrate} from './migrate-site.ts';
import {chunkGrid, fillGrid, sampleDelta} from '../../engine/terrain-edit.ts';
import type {PlacementSite, Point2} from '../../engine/types.ts';

const bin = (id: string, x: number, z: number) => ({id, asset: 'bin-wheeled-01', p: [x, z, 12] as [number, number, number], heading: 0, attach: 'ground' as const});
const square = (id: string, centre: Point2, size: number, rest: Partial<PlacementSite> & {terrain?: {deltas: number[]}} = {}) => ({version: 1, id, square: {centre, size}, placements: [], ...rest});

test('squares and tiles move into one store with every item once and ids unique', () => {
  const a = square('212_612_50', [212, 612], 50, {placements: [bin('bin', 214, 600)], roads: [{id: 'r1', type: 'kerbed-path', points: [[200, 600], [220, 600]]}], roadCuts: [{kind: 'carriageway', ring: [[0, 0], [1, 0], [1, 1], [0, 1]]}], hidden: ['7']});
  const b = {version: 2, id: '2_4', placements: [bin('bin', 214, 560)], trees: {remove: [[1, 2] as Point2], add: [{id: 't1', p: [230, 580] as Point2, z: 12, h: 10, r: 3, type: 'broadleaf'}]}, hidden: ['7']};
  const {site, notes} = migrate([a, b]);
  assert.deepEqual(site.placements.map(p => p.id), ['bin', 'bin-2']);
  assert.equal(site.roads!.length, 1);
  assert.ok(site.roadCuts![0].id);
  assert.deepEqual(site.hidden, ['7']);
  assert.equal(site.trees!.add.length, 1);
  assert.equal(notes.length, 1);
});

test('terrain from overlapping squares lands on the town grid as the old build summed it', () => {
  const n = 51, deltas = Array.from({length: n * n}, (_, k) => 50 + (k % 7));
  const {terrain} = migrate([square('100_100_50', [100, 100], 50, {terrain: {deltas}}), square('120_100_50', [120, 100], 50, {terrain: {deltas: new Array(n * n).fill(20)}})]);
  const {grid} = chunkGrid(0, 0, 200, 200), values = fillGrid(grid, terrain);
  // 10 m inside both squares, past their 5 m fade, the node is the sum of the two.
  const [x, z] = [110, 100], i = x - 75, j = z - 75;
  assert.equal(Math.round(sampleDelta(values, grid, x, z) * 100), deltas[j * n + i] + 20);
  assert.equal(sampleDelta(values, grid, 30, 30), 0);
});
