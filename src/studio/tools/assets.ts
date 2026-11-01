import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {sillamae} from '../../city/sillamae/index.ts';
import type {WorldData} from '../../engine/data.ts';
import {gridSize} from '../../engine/terrain-edit.ts';
import type {AssetDefinition, AssetDetail, PlacementSite, Point2} from '../../engine/types.ts';
import {option, repo} from './local.ts';

// Checks the asset library, drafts and saved placements; see src/studio/ASSETS.md.
// Exit 1 lists every failure. Looks are judged by the owner in the studio, not here.
const ASSETS = path.join(repo, 'src/city/sillamae/assets'), DRAFTS = path.join(repo, 'src/city/sillamae/asset-drafts'), SITES = path.join(repo, 'data/source/placements');
// Relative imports that resolve the same from assets/<id>/ and asset-drafts/<id>/,
// so approving a draft moves its folder without breaking it.
const PORTABLE = /^(\.\/|\.\.\/\.\.\/assets\/|\.\.\/\.\.\/\.\.\/\.\.\/engine\/)/;
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d{2}$/;
const SIZE_TOLERANCE = .03; // metres either way between declared and built size
const CONTACT = .01; // metres: how far the base or back may sit from its contact plane
const MAX_SIZE = 30; // metres; anything larger is not street detail

const inertContext = () => new Proxy({}, {get: (target: Record<string | symbol, unknown>, key) => key === 'createImageData' ? undefined : key in target ? target[key] : () => {}});
Object.assign(globalThis, {document: {createElement: () => ({width: 0, height: 0, getContext: inertContext})}});

const failures: string[] = [], warnings: string[] = [];
const fail = (id: string, message: string) => failures.push(`${id}: ${message}`);
const folders = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name) : [];

async function load(dir: string, folder: string, draft: boolean) {
  const file = path.join(dir, folder, 'asset.ts');
  if (!fs.existsSync(file)) { fail(folder, 'missing asset.ts'); return null; }
  for (const f of fs.readdirSync(path.join(dir, folder)).filter(n => n.endsWith('.ts')))
    for (const [, from] of fs.readFileSync(path.join(dir, folder, f), 'utf8').matchAll(/(?:from|import)\s*\(?\s*'(\.[^']*)'/g))
      if (!PORTABLE.test(from)) fail(folder, `${f} imports '${from}'; use ./, ../../assets/ or ../../../../engine/ so the folder can move between drafts and the library`);
  const asset = (await import(pathToFileURL(file).href)).asset as AssetDefinition | undefined;
  if (!asset) { fail(folder, 'asset.ts must export const asset'); return null; }
  return {asset, folder, draft};
}

function measure(asset: AssetDefinition, variant: string, detail: AssetDetail) {
  const root = asset.build({variant, detail});
  root.updateMatrixWorld(true);
  let triangles = 0;
  const box = new THREE.Box3(), geometries = new Set<THREE.BufferGeometry>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry, position = g.attributes.position;
    if (!position || !Array.from(position.array).every(Number.isFinite)) throw Error(`non-finite positions in ${o.name || 'a mesh'}`);
    if (!o.matrixWorld.elements.every(Number.isFinite)) throw Error('non-finite transform');
    triangles += (g.index ? g.index.count : position.count) / 3;
    box.expandByObject(o);
    geometries.add(g);
  });
  for (const g of geometries) g.dispose();
  return {triangles, box};
}

function checkAsset(asset: AssetDefinition, folder: string) {
  const id = asset.id;
  if (id !== folder) fail(folder, `id "${id}" must match its folder name`);
  if (!ID.test(id)) fail(id, 'id must be lowercase words joined by hyphens, ending in a two-digit number (bin-concrete-01)');
  for (const key of ['name', 'category'] as const) if (!asset[key]?.trim()) fail(id, `missing ${key}`);
  if (!asset.tags?.length) fail(id, 'needs at least one tag');
  if (!['ground', 'wall', 'either'].includes(asset.attach)) fail(id, 'attach must be ground, wall or either');
  if (!asset.variants?.length) { fail(id, 'needs at least one variant'); return; }
  if (new Set(asset.variants.map(v => v.id)).size !== asset.variants.length) fail(id, 'variant ids must be unique');
  if (!(asset.size?.length === 3 && asset.size.every(s => s > 0 && s <= MAX_SIZE))) { fail(id, `size must be three lengths in metres up to ${MAX_SIZE}`); return; }
  for (const {id: variant} of asset.variants) {
    let near, far;
    try { near = measure(asset, variant, 'near'); far = measure(asset, variant, 'far'); }
    catch (e) { fail(id, `variant ${variant} failed to build: ${e instanceof Error ? e.message : e}`); continue; }
    const built = near.box.getSize(new THREE.Vector3()).toArray();
    if (built.some((s, i) => Math.abs(s - asset.size[i]) > SIZE_TOLERANCE))
      fail(id, `variant ${variant} builds ${built.map(s => s.toFixed(2)).join(' x ')} m, declared ${asset.size.join(' x ')} m`);
    if (near.triangles > asset.triangles) fail(id, `variant ${variant} has ${near.triangles} triangles, budget ${asset.triangles}`);
    if (far.triangles > near.triangles) fail(id, `variant ${variant}: far detail (${far.triangles}) is heavier than near (${near.triangles})`);
    if (asset.attach !== 'wall' && Math.abs(near.box.min.y) > CONTACT) fail(id, `variant ${variant}: base is ${near.box.min.y.toFixed(3)} m from the ground (y = 0)`);
    if (asset.attach !== 'ground' && Math.abs(near.box.min.z) > CONTACT) fail(id, `variant ${variant}: back is ${near.box.min.z.toFixed(3)} m from the wall (z = 0)`);
    if (asset.attach === 'ground' && (Math.abs(near.box.min.x + near.box.max.x) / 2 > asset.size[0] / 2 || near.box.max.z < 0 || near.box.min.z > 0))
      fail(id, `variant ${variant}: the origin is not under the object`);
  }
}

const selected = option('id');
const loaded = (await Promise.all([
  ...folders(ASSETS).map(f => load(ASSETS, f, false)),
  ...folders(DRAFTS).map(f => load(DRAFTS, f, true)),
])).filter(a => a !== null);
const seen = new Map<string, string>();
for (const {asset, draft} of loaded) {
  const where = draft ? 'drafts' : 'library';
  if (seen.has(asset.id)) fail(asset.id, `id used twice (${seen.get(asset.id)} and ${where})`);
  seen.set(asset.id, where);
}
for (const {asset, folder} of loaded) if (!selected || asset.id === selected) checkAsset(asset, folder);

// The built town, when there is one, to check placements against its buildings and roads.
const WORLD = path.join(repo, 'public/data/world.json');
const world = fs.existsSync(WORLD) ? JSON.parse(fs.readFileSync(WORLD, 'utf8')) as WorldData : null;
const WALL_REACH = 1; // metres a wall placement may sit from its building's outline
const inRing = (ring: Point2[], x: number, z: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > z) !== (ring[j][1] > z) && x < (ring[j][0] - ring[i][0]) * (z - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
  return inside;
};
const edgeDistance = (ring: Point2[], x: number, z: number) => Math.min(...ring.map((a, i) => {
  const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}));
const indoors = (x: number, z: number) => world?.buildings.find(b => inRing(b.g, x, z));
const [ox, oz] = sillamae.frame.origin;
const carriageways = world?.roads.filter(r => r.kind === 'carriageway').map(r => r.ring.map(([x, , z]): Point2 => [x + ox, z + oz])) ?? [];
function againstTown(name: string, id: string, attach: string, x: number, z: number, building?: string) {
  if (!world) return;
  if (attach === 'wall') {
    const b = world.buildings.find(w => w.id === building);
    if (!b) fail(name, `${id} hangs on building ${building}, which the built data no longer has`);
    else if (edgeDistance(b.g, x, z) > WALL_REACH) fail(name, `${id} is ${edgeDistance(b.g, x, z).toFixed(1)} m from the walls of building ${building}`);
    return;
  }
  const inside = indoors(x, z);
  if (inside) fail(name, `${id} stands inside building ${inside.id}`);
  else if (carriageways.some(r => inRing(r, x, z))) warnings.push(`${name}: ${id} stands on a carriageway`);
}

const byId = new Map(loaded.map(l => [l.asset.id, l]));
let placed = 0;
for (const file of fs.existsSync(SITES) ? fs.readdirSync(SITES).filter(f => f.endsWith('.json')) : []) {
  const site = JSON.parse(fs.readFileSync(path.join(SITES, file), 'utf8')) as PlacementSite, name = 'placements/' + file;
  if (site.version !== 1 || file !== site.id + '.json') fail(name, 'must be version 1 and named after its id');
  const ids = new Set<string>();
  for (const p of site.placements ?? []) {
    placed++;
    if (ids.has(p.id)) fail(name, `placement id ${p.id} used twice`);
    ids.add(p.id);
    const found = byId.get(p.asset);
    if (!found) { fail(name, `${p.id} uses unknown asset ${p.asset}`); continue; }
    if (found.draft) fail(name, `${p.id} uses draft asset ${p.asset}; approve it first`);
    if (found.asset.retired) warnings.push(`${name}: ${p.id} still uses retired asset ${p.asset}`);
    if (p.variant && !found.asset.variants.some(v => v.id === p.variant)) fail(name, `${p.id} uses unknown variant ${p.variant} of ${p.asset}`);
    if (!(p.p?.length === 3 && p.p.every(Number.isFinite) && Number.isFinite(p.heading))) fail(name, `${p.id} has an invalid position or heading`);
    if (p.attach === 'wall' && !p.building) fail(name, `${p.id} is on a wall but names no building`);
    else if (p.p?.every(Number.isFinite)) againstTown(name, p.id, p.attach, p.p[0], p.p[1], p.building);
  }
  if (site.terrain) {
    const d = site.terrain.deltas, n = gridSize(site.square.size);
    if (!Array.isArray(d) || d.length !== n * n) fail(name, `terrain needs ${n * n} heights for a ${site.square.size} m square, has ${Array.isArray(d) ? d.length : 'none'}`);
    else if (!d.every(v => Number.isInteger(v) && Math.abs(v) <= 1000)) fail(name, 'terrain heights must be whole centimetres within 10 m');
  }
  const point = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  for (const r of site.trees?.remove ?? []) if (!point(r)) fail(name, `removed tree ${JSON.stringify(r)} is not an x/z pair`);
  for (const t of site.trees?.add ?? []) {
    if (ids.has(t.id)) fail(name, `tree id ${t.id} used twice`);
    ids.add(t.id);
    if (!point(t.p) || !Number.isFinite(t.z) || !(t.h >= 3) || !(t.r > 0) || !['Lehtpuu', 'Okaspuu'].includes(t.type)) fail(name, `tree ${t.id} needs x/z, ground height, a height of 3 m or more, a crown radius and a kind`);
    else againstTown(name, 'tree ' + t.id, 'ground', t.p[0], t.p[1]);
  }
}

for (const w of warnings) console.warn('warning ' + w);
const library = loaded.filter(l => !l.draft).length;
console.log(`assets: ${library} in the library, ${loaded.length - library} drafts; ${placed} placements checked${world ? ' against the built town' : '; build data (npm run data) to also check them against buildings and roads'}`);
if (failures.length) {
  for (const f of failures) console.error('FAIL ' + f);
  process.exit(1);
}
console.log('assets: all checks passed');
