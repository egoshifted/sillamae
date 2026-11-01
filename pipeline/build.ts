import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {sillamae} from '../src/city/sillamae/index.ts';
import {CELL} from '../src/engine/survey/classify.ts';
import {prepareSurvey} from '../src/engine/survey/prepare.ts';
import type {SceneData} from '../src/engine/types.ts';
import {loadDtm} from './dtm.ts';
import {encodeBucket} from './encode.ts';
import {georeference, type OsmExtract} from './geo.ts';
import {gradeRoads} from './grade.ts';
import {withTerrainEdits} from '../src/engine/terrain-edit.ts';
import {blendSites, gridGround, seatBuildings} from './ground.ts';
import {buildNav} from './nav.ts';
import {addStudioRoads, applyTreeEdits, collectPlacements, dropHidden, loadSites, markStudioRoads, streetLines, studioLines, studioSurfaces} from './placements.ts';
import {buildRoads, clearFootwayPaint, layRoads, moveTreesOffPaths} from './roads.ts';
import {buildStairs} from './stairs.ts';
import {moveTreesOffRoads} from './trees.ts';
import {buildZones} from './zones.ts';
import type {SurveyManifest, WorldData} from '../src/engine/data.ts';

const SOURCE = 'data/source', OUT = 'public/data', TILE_CELLS = 2;
const STUDIO_LIFT = .05, STUDIO_RISE = .01; // metres of depth lift and height over the road layer's own footways

// Override models paint procedural textures on canvases. Here only their
// geometry matters, so canvases are inert stand-ins.
const inertContext = () => new Proxy({}, {get: (target: Record<string | symbol, unknown>, key) => key === 'createImageData' ? undefined : key in target ? target[key] : () => {}});
Object.assign(globalThis, {document: {createElement: () => ({width: 0, height: 0, getContext: inertContext})}});

const started = performance.now();
const data: SceneData = JSON.parse(fs.readFileSync(path.join(SOURCE, 'scene.json'), 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync(path.join(SOURCE, 'geometry.bin.gz')));
const vertices = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const osm: OsmExtract = JSON.parse(fs.readFileSync(path.join(SOURCE, 'osm.json'), 'utf8'));
const georef = georeference(osm, data, sillamae), geo = georef.geo;
const sites = loadSites(path.join(SOURCE, 'placements'));
// Everything built from the streets sees the roads drawn in the studio too.
const {osm: streets, report: studioRoadReport} = addStudioRoads(osm, sites, georef, sillamae);
const {shapes, centrelines, report: roadReport} = buildRoads(streets, data, sillamae, georef, vertices);
// Studio terrain edits go in before the roads are graded, so roads follow them too.
const heightAt = blendSites(gradeRoads(withTerrainEdits(loadDtm(geo.toGrid), sites), centrelines), vertices, data, sillamae);
const treeReport = moveTreesOffRoads(vertices, data), pathTreeReport = moveTreesOffPaths(shapes, data, sillamae);
const editReport = applyTreeEdits(data, sites);
const {vertices: cleared, report: paintReport} = clearFootwayPaint(vertices, data, sillamae);
const {vertices: gridded, textured, report: groundReport} = gridGround(cleared, heightAt, data, sillamae);
const {vertices: seatedAll, report: seatReport} = seatBuildings(gridded, vertices, heightAt, data, sillamae);
const {vertices: seated, report: hiddenReport} = dropHidden(seatedAll, data, sites, sillamae);
const {buckets, siteGround, settled, draped, patches} = prepareSurvey(seated, data, sillamae, heightAt, [textured]);
// Studio areas are laid on their own and drawn over any footway they overlap.
const drawn = layRoads(studioSurfaces(sites, sillamae), buckets, sillamae, data.base, patches, heightAt).map(s => ({...s, lift: s.lift + STUDIO_LIFT, ring: s.ring.map(([x, y, z]): [number, number, number] => [x, y + STUDIO_RISE, z])}));
const roads = [...layRoads(shapes, buckets, sillamae, data.base, patches, heightAt), ...drawn];
markStudioRoads(roads, sites, sillamae);
const lines = studioLines(sites, sillamae, heightAt, data.base);
const {stairs, report: stairReport} = buildStairs(streets, data, sillamae, georef, heightAt);
const {nav, report} = buildNav(streets, data, sillamae, georef);
const {zones, report: zoneReport} = buildZones(streets, data, sillamae, georef);
const {placements, report: placementReport} = collectPlacements(sites, 'src/city/sillamae/assets', heightAt);

// Bucket order is kept: it is the draw order of equal-depth survey meshes.
const tiles = new Map<string, Uint8Array[]>(), manifest: SurveyManifest = {cell: CELL, tileCells: TILE_CELLS, tiles: [], buckets: []};
for (const b of buckets) {
  const [cx, cz] = b.cell.split(',').map(Number), name = `${Math.floor(cx / TILE_CELLS)}_${Math.floor(cz / TILE_CELLS)}`;
  let parts = tiles.get(name);
  if (!parts) tiles.set(name, parts = []);
  const offset = parts.reduce((s, p) => s + p.byteLength, 0), encoded = encodeBucket(b);
  parts.push(...encoded.parts);
  manifest.buckets.push({kind: b.kind, detail: b.detail, cell: b.cell, tile: name, offset, ...encoded.meta});
}

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, 'tiles'), {recursive: true});
let bytes = 0;
for (const [name, parts] of tiles) {
  const packed = zlib.gzipSync(Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.byteLength))), {level: 9});
  fs.writeFileSync(path.join(OUT, 'tiles', name + '.bin.gz'), packed);
  manifest.tiles.push(name);
  bytes += packed.length;
}
// Site ground comes from Float32 survey data; millimetres keep it exact enough and halve world.json.
const mm = (v: number) => Math.round(v * 1000) / 1000;
const siteGroundMm = Object.fromEntries(Object.entries(siteGround).map(([id, triangles]) => [id, triangles.map(t => t.map(mm))]));
const world: WorldData = {...data, siteGround: siteGroundMm, geo, zones, stairs, roads};
fs.writeFileSync(path.join(OUT, 'survey.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify(world));
fs.writeFileSync(path.join(OUT, 'nav.json'), JSON.stringify(nav));
fs.writeFileSync(path.join(OUT, 'placements.json'), JSON.stringify(placements));
fs.writeFileSync(path.join(OUT, 'lines.json'), JSON.stringify(lines));
// The OSM streets, without the studio's own, for drawn roads to snap to in the editor.
fs.writeFileSync(path.join(OUT, 'streets.json'), JSON.stringify(streetLines(osm, georef, sillamae)));
// The edits this data was built with, so the studio previews only what changed since.
const terrain = Object.fromEntries(sites.filter(s => s.terrain).map(s => [s.id, s.terrain!.deltas]));
fs.writeFileSync(path.join(OUT, 'terrain.json'), JSON.stringify(terrain));

const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB';
console.log(`georeference RMS ${geo.rms.toFixed(2)} m; ${report}`);
console.log(zoneReport);
console.log(stairReport);
console.log(roadReport);
console.log(studioRoadReport);
console.log(paintReport);
console.log(groundReport);
console.log(seatReport);
console.log(treeReport);
console.log(pathTreeReport);
console.log(editReport + `; terrain edited in ${Object.keys(terrain).length} squares`);
console.log(placementReport + `; ${drawn.length} area cells, ${lines.length} lines`);
console.log(hiddenReport);
console.log(`ground on the 1 m terrain model: ${draped!.before} -> ${draped!.after} triangles; ${settled} buildings lowered onto it`);
console.log(`${buckets.length} buckets in ${tiles.size} tiles, ${mb(bytes)} gzip; world.json ${mb(fs.statSync(path.join(OUT, 'world.json')).size)}; ${((performance.now() - started) / 1000).toFixed(1)} s`);
