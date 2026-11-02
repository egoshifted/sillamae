import test from 'node:test';
import assert from 'node:assert/strict';
import {studioSurfaces, addStudioRoads} from './placements.ts';
import {roadShapes} from '../src/studio/site/details.ts';
import {PATH_FINISH, ROAD_WIDTH} from '../src/engine/streets.ts';
import type {CityDefinition, PlacementSite, RoadType} from '../src/engine/types.ts';
import type {Georeference} from './geo.ts';

const city = {frame: {origin: [100, 200]}} as CityDefinition;
const types: RoadType[] = ['sidewalk', 'asphalt-path', 'gravel-path', 'worn-path', 'kerbed-path'];
const site: PlacementSite = {version: 1, id: '110_210_50', square: {centre: [110, 210], size: 50}, placements: [],
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
    assert.equal(built[i].studio, site.id);
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
