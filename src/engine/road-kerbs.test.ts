import test from 'node:test';
import assert from 'node:assert/strict';
import type {RoadSurface} from './data.ts';
import {roadKerbs, snapToRoadEdge} from './road-kerbs.ts';
import {demolishRoads} from './road-demolition.ts';

const road: RoadSurface = {kind: 'carriageway', lift: 0, ring: [[0, 0, 0], [10, 0, 0], [10, 0, 6], [0, 0, 6]]};
const path: RoadSurface = {kind: 'footway', surface: 'asphalt', kerbed: true, lift: 0, ring: [[0, .03, 6], [10, .23, 6], [10, .23, 8], [0, .03, 8]]};
const length = (surfaces: RoadSurface[]) => roadKerbs(surfaces).reduce((n, l) => n + Math.hypot(l.points[1][0] - l.points[0][0], l.points[1][2] - l.points[0][2]), 0);

test('kerbs appear only at the road-facing edge, regardless of winding', () => {
  for (const p of [path, {...path, ring: [...path.ring].reverse()}]) {
    assert.equal(length([road, p]), 10);
    for (const line of roadKerbs([road, p])) for (const [x, y, z] of line.points) {
      assert.equal(z, 6.075);
      assert.ok(Math.abs(y - (.03 + .02 * x)) < 1e-8);
    }
  }
  assert.equal(roadKerbs([path]).length, 0);
});

test('draped triangle edges do not become interior kerbs', () => {
  const [a, b, c, d] = path.ring;
  assert.equal(length([road, {...path, ring: [a, b, c]}, {...path, ring: [a, c, d]}]), 10);
});

test('a lower stacked copy of a path adds no second kerb', () => {
  const lower: RoadSurface = {...path, ring: path.ring.map(([x, y, z]) => [x, y - .05, z])};
  const kerbs = roadKerbs([road, path, lower]);
  assert.ok(kerbs.every(l => l.points.every(([x, y, z]) => z === 6.075 && Math.abs(y - (.03 + .02 * x)) < 1e-8)));
  assert.equal(length([road, path, lower]), 10);
});
test('a path drawn a few decimetres off a curving road keeps its kerb, a distant one does not', () => {
  const shifted = (dz: number): RoadSurface => ({...path, ring: path.ring.map(([x, y, z]) => [x, y, z + dz])});
  assert.equal(length([road, shifted(.25)]), 10);
  assert.equal(length([road, shifted(.6)]), 0);
});

test('bulldozing either adjoining surface removes the matching kerb', () => {
  for (const kind of ['carriageway', 'footway'] as const) {
    const cut = {kind, exposeGround: true, ring: [[4, -1], [6, -1], [6, 9], [4, 9]] as [number, number][]};
    assert.ok(Math.abs(length(demolishRoads([road, path], [cut])) - 8) < .26);
  }
  assert.equal(length([road, path]), 10);
});

test('snap places the footpath outside either road edge and ignores tiled seams', () => {
  const rings = [[[0, 0], [5, 0], [5, 6], [0, 6]], [[5, 0], [10, 0], [10, 6], [5, 6]]] as [number, number][][];
  assert.deepEqual(snapToRoadEdge(rings, [3, 7.5], 1), [3, 7]);
  assert.deepEqual(snapToRoadEdge(rings, [3, -1.5], 1), [3, -1]);
  assert.equal(snapToRoadEdge(rings, [5, 3], 1, 1), undefined);
  assert.equal(snapToRoadEdge(rings, [3, 20], 1), undefined);
});
