import test from 'node:test';
import assert from 'node:assert/strict';
import {demolishRoads, roadSection} from './road-demolition.ts';
import type {RoadSurface} from './data.ts';
import type {RoadCut} from './types.ts';

const road: RoadSurface = {kind: 'carriageway', lift: 0, ring: [[0, 0, -3], [10, 10, -3], [10, 10, 3], [0, 0, 3]]};
const area = (s: RoadSurface) => Math.abs(s.ring.reduce((sum, a, i) => { const b = s.ring[(i + 1) % s.ring.length]; return sum + a[0] * b[2] - b[0] * a[2]; }, 0)) / 2;
const sum = (r: RoadSurface[]) => r.reduce((s, r) => s + area(r), 0);
const cut = (x: number): RoadCut => ({kind: 'carriageway', ring: roadSection([x, 0], [1, 0], 3.04, 3.04)});

test('a click removes two metres across a sloped road and fills it without holes', () => {
  const original = structuredClone(road), result = demolishRoads([road], [cut(5)]);
  assert.ok(Math.abs(sum(result.filter(r => r.surface === 'grass')) - 12) < 1e-8);
  assert.ok(Math.abs(sum(result) - 60) < 1e-8);
  for (const s of result) for (const [x, y] of s.ring) assert.ok(Math.abs(x - y) < 1e-8);
  assert.deepEqual(road, original);
});

test('overlapping drag cuts do not duplicate ground and survive a save round trip', () => {
  const cuts = [cut(3), cut(4), cut(5), cut(5)];
  const result = demolishRoads([road], JSON.parse(JSON.stringify(cuts)));
  assert.ok(Math.abs(sum(result.filter(r => r.surface === 'grass')) - 24) < 1e-8);
  assert.ok(Math.abs(sum(result) - 60) < 1e-8);
  assert.deepEqual(demolishRoads([road], []), [road]);
});

test('road cuts erase markings but leave adjoining footways intact', () => {
  const marking: RoadSurface = {...road, kind: 'marking', ring: road.ring.map(([x, y, z]) => [x, y + .03, z / 30])};
  const footway: RoadSurface = {...road, kind: 'footway', surface: 'paving'};
  const result = demolishRoads([marking, footway], [cut(5)]);
  assert.ok(Math.abs(sum(result.filter(r => r.kind === 'marking')) - 1.6) < 1e-8);
  assert.equal(result.filter(r => r.surface === 'grass').length, 0);
  assert.ok(result.includes(footway));
});

test('footway demolition and reversed cut winding preserve the same footprint', () => {
  const path: RoadSurface = {...road, kind: 'footway', surface: 'worn-grass'};
  const c: RoadCut = {...cut(5), kind: 'footway'};
  const a = demolishRoads([path], [c]), b = demolishRoads([path], [{...c, ring: [...c.ring].reverse()}]);
  assert.ok(Math.abs(sum(a.filter(r => r.surface === 'grass')) - 12) < 1e-8);
  assert.ok(Math.abs(sum(a) - sum(b)) < 1e-8);
});

test('sampled ground colour survives saving and reaches all restored polygons', () => {
  const c: RoadCut = {...cut(5), groundColour: [.4, .5, .3]};
  const result = demolishRoads([road], JSON.parse(JSON.stringify([c])));
  const restored = result.filter(r => r.surface === 'grass');
  assert.ok(restored.length > 0);
  for (const r of restored) assert.deepEqual(r.groundColour, c.groundColour);
  for (const r of result.filter(r => r.kind === 'carriageway')) assert.equal(r.groundColour, undefined);
});

test('restored colour blends across the road between different verges', () => {
  const c: RoadCut = {...cut(5), groundColour: [.4, .5, .3], groundColours: [[.2, .3, .1], [.2, .3, .1], [.6, .7, .5], [.6, .7, .5]]};
  for (const s of demolishRoads([road], [c]).filter(s => s.surface === 'grass')) {
    assert.equal(s.groundColours?.length, s.ring.length);
    s.ring.forEach((p, i) => assert.ok(Math.abs(s.groundColours![i][0] - (.2 + .4 * (p[2] + 3.04) / 6.08)) < 1e-8));
  }
});

test('natural terrain is exposed directly without a replacement grass strip', () => {
  const result = demolishRoads([road], [{...cut(5), exposeGround: true}]);
  assert.ok(Math.abs(sum(result) - 48) < 1e-8);
  assert.ok(result.every(r => r.kind === 'carriageway'));
});
