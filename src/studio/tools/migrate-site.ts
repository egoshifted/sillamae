import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHUNK, chunkGrid, splitGrid, TERRAIN_STEP, type TerrainChunks} from '../../engine/terrain-edit.ts';
import type {PlacementSite, Point2} from '../../engine/types.ts';
import {canonical} from '../site/store.ts';

// Moves work saved per square (data/source/placements, any version) into the town's
// site store. Items keep their order, file by file; ids are made unique across the
// town, and road cuts get ids, as the editor merges by them. Terrain from the old
// squares is resampled onto the town grid, overlapping squares summed as the old
// build summed them. The old files are moved to the archive, never deleted.
type Old = Omit<PlacementSite, 'version'> & {version: number; id: string; square?: {centre: Point2; size: number}; terrain?: {deltas: number[]}};

const TAPER = 5; // metres inside a square over which its terrain edit used to fade out

function oldDelta(site: Old, x: number, z: number) {
  const {centre: [cx, cz], size} = site.square!, minX = cx - size / 2, minZ = cz - size / 2, n = Math.round(size / TERRAIN_STEP) + 1, d = site.terrain!.deltas;
  const fx = (x - minX) / TERRAIN_STEP, fz = (z - minZ) / TERRAIN_STEP;
  if (fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1) return 0;
  const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fz)), tx = fx - i, tz = fz - j, at = (a: number, b: number) => d[b * n + a];
  const value = (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
  return value * Math.min(1, Math.max(0, Math.min(x - minX, z - minZ, minX + size - x, minZ + size - z) / TAPER));
}

export function migrate(olds: Old[], into: PlacementSite = {version: 3, placements: []}) {
  const site: PlacementSite = structuredClone(into), notes: string[] = [];
  const ids = new Set([...site.placements, ...site.surfaces ?? [], ...site.lines ?? [], ...site.roads ?? [], ...site.roadCuts ?? [], ...site.trees?.add ?? []].flatMap(i => i.id ? [i.id] : []));
  const unique = (from: string, id: string) => {
    let next = id;
    for (let k = 2; ids.has(next); k++) next = `${id}-${k}`;
    if (next !== id) notes.push(`${from}: ${id} renamed ${next}, the id was taken`);
    ids.add(next);
    return next;
  };
  let cuts = 0;
  for (const old of olds) {
    if (old.terrain && !old.square) throw Error(`${old.id}: terrain without a square cannot be placed on the town grid`);
    site.placements.push(...old.placements.map(p => ({...p, id: unique(old.id, p.id)})));
    if (old.surfaces?.length) (site.surfaces ??= []).push(...old.surfaces.map(s => ({...s, id: unique(old.id, s.id)})));
    if (old.lines?.length) (site.lines ??= []).push(...old.lines.map(l => ({...l, id: unique(old.id, l.id)})));
    if (old.roads?.length) (site.roads ??= []).push(...old.roads.map(r => ({...r, id: unique(old.id, r.id)})));
    if (old.roadCuts?.length) (site.roadCuts ??= []).push(...old.roadCuts.map(c => ({...c, id: unique(old.id, c.id ?? `cut-${++cuts}`)})));
    if (old.trees?.add.length || old.trees?.remove.length) {
      const trees = site.trees ??= {remove: [], add: []};
      trees.remove.push(...old.trees.remove);
      trees.add.push(...old.trees.add.map(t => ({...t, id: unique(old.id, t.id)})));
    }
    for (const id of old.hidden ?? []) if (!site.hidden?.includes(id)) (site.hidden ??= []).push(id);
  }
  const shaped = olds.filter(o => o.terrain);
  let terrain: TerrainChunks = {};
  if (shaped.length) {
    const box = shaped.map(o => { const [cx, cz] = o.square!.centre, h = o.square!.size / 2; return [cx - h, cz - h, cx + h, cz + h]; });
    const {grid} = chunkGrid(Math.min(...box.map(b => b[0])), Math.min(...box.map(b => b[1])), Math.max(...box.map(b => b[2])), Math.max(...box.map(b => b[3])));
    const values = new Float32Array(grid.nx * grid.nz);
    for (let j = 0; j < grid.nz; j++) for (let i = 0; i < grid.nx; i++) {
      const x = grid.minX + i * TERRAIN_STEP, z = grid.minZ + j * TERRAIN_STEP;
      values[j * grid.nx + i] = Math.round(shaped.reduce((sum, o) => sum + oldDelta(o, x, z), 0)) / 100;
    }
    terrain = Object.fromEntries(Object.entries(splitGrid(grid, values)).filter((e): e is [string, number[]] => !!e[1]));
  }
  return {site: canonical(site), terrain, notes};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const from = path.join(repo, 'data/source/placements'), store = path.join(repo, 'data/source/site'), items = path.join(store, 'items.json');
  const archive = path.resolve(process.argv.find(a => a.startsWith('--archive='))?.slice(10) ?? path.join(repo, '../sillamae-local/placements-before-store'));
  const dry = process.argv.includes('--dry-run');
  const files = fs.existsSync(from) ? fs.readdirSync(from).filter(f => f.endsWith('.json')).sort() : [];
  if (!files.length) { console.log('Nothing in data/source/placements to move.'); process.exit(0); }
  const olds = files.map(f => ({...JSON.parse(fs.readFileSync(path.join(from, f), 'utf8')), id: f.slice(0, -5)}) as Old);
  const into = fs.existsSync(items) ? JSON.parse(fs.readFileSync(items, 'utf8')) as PlacementSite : undefined;
  if (fs.existsSync(path.join(store, 'terrain')) && olds.some(o => o.terrain)) throw Error('The store already has terrain; merge old terrain by hand');
  const {site, terrain, notes} = migrate(olds, into);
  const count = (s: Omit<PlacementSite, 'version'>, chunks?: number) => `${s.placements.length} objects, ${s.roads?.length ?? 0} roads, ${s.lines?.length ?? 0} lines, ${s.surfaces?.length ?? 0} areas, ${s.roadCuts?.length ?? 0} road cuts, trees +${s.trees?.add.length ?? 0} −${s.trees?.remove.length ?? 0}, ${s.hidden?.length ?? 0} hidden${chunks !== undefined ? `, ${chunks} terrain chunks` : (s as Old).terrain ? ', terrain' : ''}`;
  for (const o of olds) console.log(`${o.id}: ${count(o)}`);
  console.log(`store: ${count(site, Object.keys(terrain).length)}`);
  for (const n of notes) console.log('note: ' + n);
  if (dry) { console.log('Dry run: nothing written.'); process.exit(0); }
  fs.mkdirSync(archive, {recursive: true});
  for (const f of files) if (fs.existsSync(path.join(archive, f))) throw Error(`${archive} already has ${f}; nothing was changed`);
  fs.mkdirSync(path.join(store, 'terrain'), {recursive: true});
  fs.writeFileSync(items, JSON.stringify(site, null, 1) + '\n');
  for (const [key, deltas] of Object.entries(terrain)) {
    if (deltas.length !== CHUNK * CHUNK) throw Error('Bad chunk ' + key);
    fs.writeFileSync(path.join(store, 'terrain', key + '.json'), JSON.stringify({deltas}) + '\n');
  }
  if (!fs.readdirSync(path.join(store, 'terrain')).length) fs.rmdirSync(path.join(store, 'terrain'));
  for (const f of files) { fs.copyFileSync(path.join(from, f), path.join(archive, f)); fs.rmSync(path.join(from, f)); }
  fs.rmdirSync(from);
  console.log(`Wrote data/source/site; old files moved to ${archive}. Run npm run data, then check the atlas.`);
}
