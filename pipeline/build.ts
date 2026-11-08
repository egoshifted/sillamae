import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import zlib from 'node:zlib';
import {beginBuild, buildInputs, files} from './cache.ts';
import {sillamae} from '../src/city/sillamae/index.ts';
import {installInertCanvas} from '../src/studio/assembly/inert-canvas.ts';
import {CELL} from '../src/engine/survey/classify.ts';
import {prepareSurvey} from '../src/engine/survey/prepare.ts';
import {PATH_FINISH} from '../src/engine/streets.ts';
import type {PlacementSite, SceneData} from '../src/engine/types.ts';
import {loadDtm} from './dtm.ts';
import {encodeBucket, groundNormals} from './encode.ts';
import {georeference, type OsmExtract} from './geo.ts';
import {gradeRoads} from './grade.ts';
import {withTerrainEdits, type TerrainChunks} from '../src/engine/terrain-edit.ts';
import {blendSites, gridGround, seatBuildings, surveyWater} from './ground.ts';
import {shoreline} from './shore.ts';
import {deckAt, loadTracedWater} from './water-bodies.ts';
import {buildNav} from './nav.ts';
import {addStudioRoads, applyTreeEdits, collectPlacements, dropHidden, loadSite, markStudioRoads, pathLines, streetLines, studioLines, studioSurfaces} from './placements.ts';
import {buildRoads, clearFootwayPaint, groundIndex, layRoads, moveTreesOffPaths} from './roads.ts';
import {buildStairs} from './stairs.ts';
import {moveTreesOffRoads} from './trees.ts';
import {buildZones} from './zones.ts';
import type {SurveyManifest, WorldData} from '../src/engine/data.ts';

const gzip = promisify(zlib.gzip);
const SOURCE = 'data/source', SITE = 'data/source/site', ITEMS = SITE + '/items.json', TILE_CELLS = 2;
const STUDIO_LIFT = .05, STUDIO_RISE = .01; // metres of depth lift and height over the road layer's own footways
const IDLE = 20 * 60 * 1000; // ms a studio build process keeps the ground, about a gigabyte, before exiting

installInertCanvas();

type Ground = Awaited<ReturnType<typeof buildGround>>;

// Of the site, only drawn roads (built with the streets), hidden survey buildings and
// terrain chunks shape the ground; everything else is laid on it and leaves it as it was.
function groundKey(inputs: Record<string, string>, site: PlacementSite) {
  return createHash('sha256').update(JSON.stringify({
    inputs: Object.entries(inputs).filter(([name]) => name !== ITEMS),
    roads: (site.roads ?? []).filter(r => !PATH_FINISH[r.type]),
    hidden: site.hidden ?? [],
  })).digest('hex');
}

async function buildGround(key: string, site: PlacementSite, terrainEdits: TerrainChunks) {
  const sites = [site];
  const data: SceneData = JSON.parse(fs.readFileSync(path.join(SOURCE, 'scene.json'), 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(SOURCE, 'geometry.bin.gz')));
  const vertices = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const osm: OsmExtract = JSON.parse(fs.readFileSync(path.join(SOURCE, 'osm.json'), 'utf8'));
  const georef = georeference(osm, data, sillamae), geo = georef.geo;
  const {osm: streets, report: studioRoadReport} = addStudioRoads(osm, sites, georef, sillamae);
  const {shapes, centrelines, report: roadReport} = buildRoads(streets, data, sillamae, georef, vertices);
  // Studio terrain edits go in before the roads are graded, so roads follow them too.
  const model = withTerrainEdits(loadDtm(geo.toGrid), terrainEdits);
  const heightAt = blendSites(gradeRoads(model, centrelines), vertices, data, sillamae);
  const treeReport = moveTreesOffRoads(vertices, data), pathTreeReport = moveTreesOffPaths(shapes, data, sillamae);
  // Copied: the ground seats its own, and each site pass edits and seats a fresh set.
  const trees = data.trees.map(t => ({...t}));
  const {vertices: cleared, report: paintReport} = clearFootwayPaint(vertices, data, sillamae);
  const roadBounds = shapes.map(s => {
    const xs = s.ring.map(p => p[0] + sillamae.frame.origin[0]), zs = s.ring.map(p => p[1] + sillamae.frame.origin[1]);
    return {minX: Math.min(...xs) - 12, maxX: Math.max(...xs) + 12, minZ: Math.min(...zs) - 12, maxZ: Math.max(...zs) + 12};
  });
  // Graded banks shape the ground alone: bridges and paths keep the graded height over the water.
  const shore = shoreline(cleared, surveyWater(cleared), model, heightAt, data, sillamae, loadTracedWater(geo.toGrid));
  const {vertices: gridded, textured, report: groundReport} = gridGround(cleared, shore.heightAt, data, sillamae, shore, roadBounds);
  const {vertices: seatedAll, report: seatReport} = seatBuildings(gridded, vertices, heightAt, data, sillamae);
  const {vertices: seated, report: hiddenReport} = dropHidden(seatedAll, data, sites, sillamae);
  const {buckets, siteGround, settled, draped, patches} = prepareSurvey(seated, data, sillamae, shore.heightAt, [textured]);
  const overWater = deckAt(sillamae.decks ?? [], sillamae.frame.origin), ground = groundIndex(buckets);
  const roads = layRoads(shapes, ground, sillamae, data.base, patches, heightAt, overWater);
  markStudioRoads(roads, sites, sillamae);
  const {stairs, report: stairReport} = buildStairs(streets, data, sillamae, georef, heightAt);
  const {nav, report} = buildNav(streets, data, sillamae, georef);
  const {zones, report: zoneReport} = buildZones(streets, data, sillamae, georef);

  // Bucket order is kept: it is the draw order of equal-depth survey meshes.
  const smooth = groundNormals(buckets);
  const tiles = new Map<string, Uint8Array[]>(), manifest: SurveyManifest = {cell: CELL, tileCells: TILE_CELLS, tiles: [], buckets: []};
  for (const b of buckets) {
    const [cx, cz] = b.cell.split(',').map(Number), name = `${Math.floor(cx / TILE_CELLS)}_${Math.floor(cz / TILE_CELLS)}`;
    let parts = tiles.get(name);
    if (!parts) tiles.set(name, parts = []);
    const offset = parts.reduce((s, p) => s + p.byteLength, 0), encoded = encodeBucket(b, smooth);
    parts.push(...encoded.parts);
    manifest.buckets.push({kind: b.kind, detail: b.detail, cell: b.cell, tile: name, offset, ...encoded.meta});
  }
  const packed = await Promise.all([...tiles].map(async ([name, parts]) => ({name, packed: await gzip(Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.byteLength))), {level: 9})})));
  manifest.tiles = packed.map(t => t.name);
  // Site ground comes from Float32 survey data; millimetres keep it exact enough and halve world.json.
  const mm = (v: number) => Math.round(v * 1000) / 1000;
  const siteGroundMm = Object.fromEntries(Object.entries(siteGround).map(([id, triangles]) => [id, triangles.map(t => t.map(mm))]));
  const outputs: Record<string, string | Buffer> = {
    'survey.json': JSON.stringify(manifest),
    'nav.json': JSON.stringify(nav),
    // The OSM streets, without the studio's own, for drawn roads to snap to in the editor.
    'streets.json': JSON.stringify(streetLines(osm, georef, sillamae)),
    // Mapped footways and paths, for drawn paths to continue from their ends.
    'paths.json': JSON.stringify(pathLines(osm, georef, sillamae)),
    // The edits this data was built with, so the studio previews only what changed since.
    'terrain.json': JSON.stringify(terrainEdits),
  };
  for (const {name, packed: bytes} of packed) outputs[path.join('tiles', name + '.bin.gz')] = bytes;

  const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB';
  const reports = [
    `georeference RMS ${geo.rms.toFixed(2)} m; ${report}`, zoneReport, stairReport, roadReport, studioRoadReport, paintReport, shore.report,
    groundReport, seatReport, treeReport, pathTreeReport, `terrain edited in ${Object.keys(terrainEdits).length} chunks`, hiddenReport,
    `ground on the 1 m terrain model: ${draped!.before} -> ${draped!.after} triangles; ${settled} buildings lowered onto it`,
    `${buckets.length} buckets in ${tiles.size} tiles, ${mb(packed.reduce((s, t) => s + t.packed.length, 0))} gzip`,
  ];
  return {key, data, trees, shore: {heightAt: shore.heightAt, onLand: shore.onLand}, heightAt, ground, patches, overWater, roads, world: {siteGround: siteGroundMm, geo, zones, stairs}, outputs, reports};
}

// What the site lays on the ground: trees, areas and paths, lines and placed assets.
async function writeSite(ground: Ground, site: PlacementSite, out: string) {
  const sites = [site], {data, shore, heightAt} = ground;
  data.trees = ground.trees.map(t => ({...t}));
  const editReport = applyTreeEdits(data, sites), allTrees = data.trees.length;
  data.trees = data.trees.filter(t => shore.onLand(...t.p));
  for (const t of data.trees) t.z = shore.heightAt(t.p[0], t.p[1]) ?? t.z;
  // Studio areas are laid on their own and drawn over any footway they overlap.
  const drawn = layRoads(studioSurfaces(sites, sillamae), ground.ground, sillamae, data.base, ground.patches, heightAt, ground.overWater).map(s => ({...s, lift: s.lift + STUDIO_LIFT, ring: s.ring.map(([x, y, z]): [number, number, number] => [x, y + STUDIO_RISE, z])}));
  markStudioRoads(drawn, sites, sillamae);
  const lines = studioLines(sites, sillamae, heightAt, data.base);
  const {placements, report: placementReport} = collectPlacements(sites, 'src/city/sillamae/assets', heightAt);
  const roadCuts = sites.flatMap(s => (s.roadCuts ?? []).map(c => ({...c, ring: c.ring.map(([x, z]): [number, number] => [x - sillamae.frame.origin[0], z - sillamae.frame.origin[1]])})));
  const {siteGround, geo, zones, stairs} = ground.world;
  const world: WorldData = {...data, siteGround, geo, zones, stairs, roads: [...ground.roads, ...drawn], roadCuts};

  fs.mkdirSync(path.join(out, 'tiles'), {recursive: true});
  for (const [name, contents] of Object.entries(ground.outputs)) fs.writeFileSync(path.join(out, name), contents);
  const worldText = Buffer.from(JSON.stringify(world));
  fs.writeFileSync(path.join(out, 'world.json'), worldText);
  fs.writeFileSync(path.join(out, 'world.json.gz'), await gzip(worldText, {level: 9}));
  fs.writeFileSync(path.join(out, 'placements.json'), JSON.stringify(placements));
  fs.writeFileSync(path.join(out, 'lines.json'), JSON.stringify(lines));
  return [`${allTrees - data.trees.length} trees standing in the water dropped`, editReport, placementReport + `; ${drawn.length} area cells, ${lines.length} lines`, `world.json ${(worldText.length / 1048576).toFixed(1)} MB`];
}

// kept.ground: the ground of an earlier build in this process, reused when nothing it
// depends on changed, else dropped before the new one is built to free its memory.
async function build(kept: {ground?: Ground} = {}, force = false) {
  const started = performance.now(), cache = await beginBuild(process.cwd(), undefined, force);
  if (!cache) return;
  try {
    const {site, terrain} = loadSite(SITE), key = groundKey(cache.inputs, site), reused = kept.ground?.key === key;
    if (!reused) kept.ground = undefined;
    const ground = kept.ground ??= await buildGround(key, site, terrain);
    const siteReports = await writeSite(ground, site, cache.directory);
    console.log((reused ? ['ground: unchanged since the last build in this process, reused'] : ground.reports).concat(siteReports, `${((performance.now() - started) / 1000).toFixed(1)} s`).join('\n'));
    cache.commit();
  } finally { cache.close(); }
}

// For the studio: one long-lived process that keeps the ground, so a site edit that
// only lays things on it rebuilds in seconds. Each 'build' message is answered with
// 'built', 'failed' or, when pipeline or model code changed since it started and the
// ground would be built with stale modules, 'restart', after which it exits.
function serve() {
  const code = () => files(process.cwd(), buildInputs.filter(p => p !== SOURCE)), started = JSON.stringify(code());
  const kept: {ground?: Ground} = {};
  let idle: NodeJS.Timeout | undefined;
  const reply = (message: object) => process.send!(message);
  process.on('disconnect', () => process.exit(0));
  process.on('message', async message => {
    if (message !== 'build') return;
    clearTimeout(idle);
    if (JSON.stringify(code()) !== started) { reply({state: 'restart'}); process.disconnect(); return; }
    try { await build(kept); reply({state: 'built'}); }
    catch (error) { kept.ground = undefined; console.error(error); reply({state: 'failed', error: error instanceof Error ? error.message : String(error)}); }
    idle = setTimeout(() => process.exit(0), IDLE);
  });
}

if (process.argv.includes('--serve')) serve();
else await build({}, process.argv.includes('--force'));
