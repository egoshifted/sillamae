import * as THREE from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import type {Point2, SiteRoad} from '../../engine/types.ts';
import {extendRoad, insideEndpointMarker, nearestRoadEnd, roadBoundary} from './road-edit.ts';

const road: SiteRoad = {id: 'path', type: 'kerbed-path', points: [[0, 0], [10, 0]]};
test('walking paths snap exactly to either existing end without changing its coordinates', () => {
  assert.deepEqual(nearestRoadEnd([road], [.8, 1], 'kerbed-path'), [0, 0]);
  assert.deepEqual(nearestRoadEnd([road], [10.5, -.5], 'asphalt-path'), [10, 0]);
  assert.equal(nearestRoadEnd([road], [5, 0], 'asphalt-path'), undefined);
  assert.equal(nearestRoadEnd([road], [0, 0], 'residential'), undefined);
});
test('extension snapping excludes itself and bulldozed ends', () => {
  assert.equal(nearestRoadEnd([road], [0, 0], 'kerbed-path', road.id), undefined);
  assert.equal(nearestRoadEnd([road], [0, 0], 'kerbed-path', undefined, [{kind: 'footway', ring: [[-1, -1], [1, -1], [1, 1], [-1, 1]]}]), undefined);
});
test('either end extends while retaining all previous bends and the opposite end', () => {
  const points: Point2[] = [[0, 0], [5, 0], [5, 5]];
  assert.deepEqual(extendRoad(points, 1, [5, 10]), [[0, 0], [5, 0], [5, 10]]);
  assert.deepEqual(extendRoad(points, 0, [-5, 0]), [[-5, 0], [5, 0], [5, 5]]);
  assert.deepEqual(extendRoad(points, 1, [10, 5]), [[0, 0], [5, 0], [5, 5], [10, 5]]);
  assert.deepEqual(points, [[0, 0], [5, 0], [5, 5]], 'gesture baseline remains available for Undo and cancellation');
});
test('dragging inward shortens the terminal segment without folding it over itself', () => {
  assert.deepEqual(extendRoad(road.points, 1, [7, 0]), [[0, 0], [7, 0]]);
  assert.deepEqual(extendRoad(road.points, 1, [-3, 0]), road.points);
  assert.deepEqual(extendRoad(road.points, 1, [10.01, 0]), road.points);
});


test('selection follows bent road edges without drawing its bounding rectangle', () => {
  const ring: Point2[] = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10]];
  const edges = roadBoundary([ring]);
  assert.equal(edges.length, 6);
  assert.ok(edges.some(([a, b]) => a[0] === 2 && b[0] === 2 && a[1] === 2 && b[1] === 10));
  assert.ok(!edges.some(([a, b]) => a[0] === 10 && b[0] === 10 && Math.max(a[1], b[1]) > 2));
});

test('selection excludes internal triangle edges and shared partial edges', () => {
  const rings: Point2[][] = [[[0, 0], [10, 0], [0, 2]], [[10, 0], [10, 1], [5, 1]], [[5, 1], [10, 1], [10, 2], [0, 2]]];
  const edges = roadBoundary(rings);
  assert.ok(edges.every(([a, b]) => a[0] === b[0] && [0, 10].includes(a[0]) || a[1] === b[1] && [0, 2].includes(a[1])));
  assert.equal(edges.reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0), 24);
});


test('endpoint snapping only accepts the visible marker footprint at any viewing angle', () => {
  const centre = new THREE.Vector3(10, 3, 20);
  for (const camera of [new THREE.Vector3(10, 30, 20), new THREE.Vector3(5, 6, 35)]) {
    const rayTo = (x: number) => new THREE.Ray(camera, new THREE.Vector3(10 + x, 3, 20).sub(camera).normalize());
    assert.equal(insideEndpointMarker(rayTo(.8), centre, .9), true);
    assert.equal(insideEndpointMarker(rayTo(1.1), centre, .9), false);
  }
  assert.equal(nearestRoadEnd([road], [.8, 1], 'kerbed-path', undefined, [], () => false), undefined);
});
