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
import {buildNav} from './nav.ts';
import {buildStairs} from './stairs.ts';
import {buildStreets} from './streets.ts';
import {correctedAreas, correctRoads, type RoadCorrections} from './roads.ts';
import {moveTreesOffRoads} from './trees.ts';
import {buildZones} from './zones.ts';
import type {SurveyManifest, WorldData} from '../src/engine/data.ts';

const SOURCE = 'data/source', OUT = 'public/data', TILE_CELLS = 2;

// Override models paint procedural textures on canvases. Here only their
// geometry matters, so canvases are inert stand-ins.
const inertContext = () => new Proxy({}, {get: (target: Record<string | symbol, unknown>, key) => key === 'createImageData' ? undefined : key in target ? target[key] : () => {}});
Object.assign(globalThis, {document: {createElement: () => ({width: 0, height: 0, getContext: inertContext})}});

const started = performance.now();
const data: SceneData = JSON.parse(fs.readFileSync(path.join(SOURCE, 'scene.json'), 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync(path.join(SOURCE, 'geometry.bin.gz')));
const surveyed = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const corrections: RoadCorrections = JSON.parse(fs.readFileSync(path.join(SOURCE, 'road-corrections.json'), 'utf8'));
const {vertices: recoloured, report: roadReport} = correctRoads(surveyed, corrections);
const osm: OsmExtract = JSON.parse(fs.readFileSync(path.join(SOURCE, 'osm.json'), 'utf8'));
const georef = georeference(osm, data, sillamae), geo = georef.geo;
const heightAt = loadDtm(geo.toGrid);
const treeReport = moveTreesOffRoads(recoloured, data);
const {vertices, streets, report: streetReport} = buildStreets(recoloured, corrections, data, sillamae, heightAt);
const {buckets, siteGround, settled, draped} = prepareSurvey(vertices, data, sillamae, heightAt, correctedAreas(corrections));
const {stairs, report: stairReport} = buildStairs(osm, data, sillamae, georef, heightAt);
const {nav, report} = buildNav(osm, data, sillamae, georef);
const {zones, report: zoneReport} = buildZones(osm, data, sillamae, georef);

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
const world: WorldData = {...data, siteGround, geo, zones, stairs, streets};
fs.writeFileSync(path.join(OUT, 'survey.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify(world));
fs.writeFileSync(path.join(OUT, 'nav.json'), JSON.stringify(nav));

const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB';
console.log(`georeference RMS ${geo.rms.toFixed(2)} m; ${report}`);
console.log(zoneReport);
console.log(stairReport);
console.log(roadReport);
console.log(streetReport);
console.log(treeReport);
console.log(`ground on the 1 m terrain model: ${draped!.before} -> ${draped!.after} triangles; ${settled} buildings lowered onto it`);
console.log(`${buckets.length} buckets in ${tiles.size} tiles, ${mb(bytes)} gzip; world.json ${mb(fs.statSync(path.join(OUT, 'world.json')).size)}; ${((performance.now() - started) / 1000).toFixed(1)} s`);
