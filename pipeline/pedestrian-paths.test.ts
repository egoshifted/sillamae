import test from 'node:test';
import assert from 'node:assert/strict';
import {studioSurfaces, addStudioRoads} from './placements.ts';
import {roadShapes} from '../src/studio/site/details.ts';
import {KERB, offsetLine, PATH_FINISH, pathKerbs, pathOutline, ROAD_WIDTH, pathCoordinates} from '../src/engine/streets.ts';
import type {CityDefinition, PlacementSite, RoadType} from '../src/engine/types.ts';
import type {Georeference} from './geo.ts';

const city = {frame: {origin: [100, 200]}} as CityDefinition;
const types: RoadType[] = ['sidewalk', 'asphalt-path', 'gravel-path', 'worn-path', 'kerbed-path', 'tiled-path'];
const site: PlacementSite = {version: 3, placements: [],
  roads: types.map((type, i) => ({id: String(i), type, points: [[100, 200], [100, 210]], footways: true}))};

test('pedestrian types retain their widths and finishes from saved data to atlas shapes', () => {
  const saved = JSON.parse(JSON.stringify(site)) as PlacementSite;
  const built = studioSurfaces([saved], city);
  assert.equal(built.length, types.length);
  for (const [i, type] of types.entries()) {
    const preview = roadShapes(saved.roads![i], [[0, 0], [0, 10]]);
    assert.equal(preview.length, 1, 'no traffic markings or parallel footways');
    assert.equal(preview[0].kind, 'footway');
    assert.equal(built[i].surface, PATH_FINISH[type]);
    assert.equal(!!built[i].kerbed, type === 'kerbed-path');
    assert.equal(!!preview[0].kerbed, type === 'kerbed-path');
    assert.equal(built[i].studio, String(i), 'built paths name their own road, for the editor to preview it instead');
    assert.deepEqual(preview[0].ring, built[i].ring);
    assert.ok(built[i].ring.flat().every(Number.isFinite));
    const width = Math.max(...built[i].ring.map(p => p[0])) - Math.min(...built[i].ring.map(p => p[0]));
    if (type === 'worn-path') assert.ok(width > .6 && width <= ROAD_WIDTH[type]);
    else assert.equal(width, ROAD_WIDTH[type]);
  }
});

test('walking paths do not become vehicle lanes or alter the street network', () => {
  const osm = {highways: [], buildings: [], entrances: []} as Parameters<typeof addStudioRoads>[0];
  const geo = {local: p => p, lonLat: p => p} as Georeference;
  assert.equal(addStudioRoads(osm, [site], geo, city).osm, osm);
});

test('worn paths have repeatable irregular edges without changing the clicked course', () => {
  const road = site.roads![3], first = roadShapes(road, [[0, 0], [0, 10]])[0];
  assert.deepEqual(first, roadShapes(road, [[0, 0], [0, 10]])[0]);
  assert.ok(new Set(first.ring.map(p => Math.abs(p[0]).toFixed(3))).size > 5);
});


test('worn tiled paths preserve all six tile widths and aligned layout through save and build', () => {
  for (let tiles = 1; tiles <= 6; tiles++) {
    const road = {id: 'tiles', type: 'tiled-path' as const, tiles, points: [[100, 200], [100, 210]] as [number, number][]};
    const saved = JSON.parse(JSON.stringify({...site, roads: [road]}));
    const built = studioSurfaces([saved], city)[0], preview = roadShapes(road, [[0, 0], [0, 10]])[0];
    assert.equal(Math.max(...built.ring.map(p => p[0])) - Math.min(...built.ring.map(p => p[0])), tiles * .5);
    assert.deepEqual(built.tileLayout, preview.tileLayout);
    assert.equal(built.surface, 'worn-paving');
    assert.deepEqual(pathCoordinates([[0, 0], [0, 10]], tiles * .5, tiles * .25, 1), [0, 1]);
    assert.deepEqual(pathCoordinates([[0, 0], [10, 0]], tiles * .5, 1, -tiles * .25), [0, 1]);
  }
});

test('a path joining a narrower one eases from its width to its own', () => {
  const road = {type: 'asphalt-path' as const, width: 3, ends: [2, null] as [number, null]}, ring = pathOutline(road, [[0, 0], [0, 10]]);
  const widthAt = (z: number) => { const xs = ring.filter(p => Math.abs(p[1] - z) < 1e-6).map(p => p[0]); return Math.max(...xs) - Math.min(...xs); };
  assert.ok(Math.abs(widthAt(0) - 2) < 1e-9);
  assert.ok(widthAt(1.5) > 2 && widthAt(1.5) < 3);
  assert.ok(Math.abs(widthAt(10) - 3) < 1e-9);
});

test('paths without a width or joins keep the outline they had', () => {
  const points: [number, number][] = [[0, 0], [3, 4], [3, 10]];
  assert.deepEqual(pathOutline({type: 'asphalt-path'}, points), [...offsetLine(points, .9), ...offsetLine(points, -.9).reverse()]);
});

test('kerbs stand just outside the chosen sides', () => {
  const kerbs = pathKerbs({type: 'asphalt-path', width: 2, kerbs: 'left', kerb: {width: .2}}, [[0, 0], [0, 10]]);
  assert.equal(kerbs.length, 1);
  assert.deepEqual(kerbs[0].points.map(p => p.map(v => +v.toFixed(6))), [[1.1, 0], [1.1, 10]]);
  assert.equal(kerbs[0].height, KERB.height);
  assert.equal(pathKerbs({type: 'asphalt-path'}, [[0, 0], [0, 10]]).length, 0);
});
