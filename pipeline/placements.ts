import fs from 'node:fs';
import path from 'node:path';
import type {BuiltLine} from '../src/engine/data.ts';
import {LINE_HEIGHT, standLine} from '../src/engine/lines.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TREE_MATCH, TRIANGLE, type CityDefinition, type Placement, type PlacementSite, type Point2, type SceneData} from '../src/engine/types.ts';
import type {RoadShape} from './roads.ts';

// What the studio site editor saved: placed objects and tree edits, one file per square.
export function loadSites(dir: string): PlacementSite[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as PlacementSite);
}

// Runs after the trees are moved off roads, as the studio saw them, and before
// they are seated on the ground, so added trees are seated with the rest.
export function applyTreeEdits(scene: SceneData, sites: PlacementSite[]) {
  let removed = 0, unmatched = 0, added = 0;
  for (const site of sites) {
    for (const [x, z] of site.trees?.remove ?? []) {
      let best = -1, distance = TREE_MATCH;
      scene.trees.forEach((t, i) => { const d = Math.hypot(t.p[0] - x, t.p[1] - z); if (d < distance) { distance = d; best = i; } });
      if (best < 0) { unmatched++; continue; }
      scene.trees.splice(best, 1);
      removed++;
    }
    for (const t of site.trees?.add ?? []) {
      scene.trees.push({p: t.p, z: t.z, h: t.h, r: t.r, type: t.type, year: 0, added: t.id});
      added++;
    }
  }
  return `studio tree edits: ${removed} removed, ${added} added${unmatched ? `; ${unmatched} removals matched no tree within ${TREE_MATCH} m (survey trees moved since)` : ''}`;
}

// Survey buildings hidden in the studio leave the survey mesh and the building
// list; the rebuilt ground runs on under them. Refined models cannot be hidden.
export function dropHidden(v: Float32Array, scene: SceneData, sites: PlacementSite[], city: CityDefinition) {
  const refined = new Set(city.overrides.map(o => o.id)), ids = new Set(sites.flatMap(s => s.hidden ?? []).filter(id => !refined.has(id)));
  const picks = new Set(scene.buildings.filter(b => ids.has(b.id)).map(b => b.pick));
  if (!picks.size) return {vertices: v, report: 'studio hidden survey objects: 0'};
  const kept: number[] = [];
  for (let i = 0; i < v.length; i += TRIANGLE) if (!picks.has(v[i + 6])) kept.push(i);
  const out = new Float32Array(kept.length * TRIANGLE);
  kept.forEach((i, k) => out.set(v.subarray(i, i + TRIANGLE), k * TRIANGLE));
  scene.buildings = scene.buildings.filter(b => !picks.has(b.pick));
  return {vertices: out, report: `studio hidden survey objects: ${picks.size}, ${(v.length - out.length) / TRIANGLE} triangles`};
}

// Areas drawn in the studio, as footways in the local frame for the road layer to lay.
export function studioSurfaces(sites: PlacementSite[], city: CityDefinition): RoadShape[] {
  const [ox, oz] = city.frame.origin;
  return sites.flatMap(s => (s.surfaces ?? []).map(a => ({kind: 'footway' as const, surface: a.finish, ring: a.ring.map(([x, z]): Point2 => [x - ox, z - oz])})));
}

// Lines drawn in the studio, stood on the built terrain in the local frame.
export function studioLines(sites: PlacementSite[], city: CityDefinition, heightAt: HeightAt, base: number): BuiltLine[] {
  const [ox, oz] = city.frame.origin;
  return sites.flatMap(s => (s.lines ?? []).map(l => ({
    kind: l.kind, height: l.height ?? LINE_HEIGHT[l.kind],
    points: standLine(l.points.map(([x, z]): [number, number] => [x - ox, z - oz]), (x, z) => { const h = heightAt(x + ox, z + oz); return h === null ? null : h - base; }).map(p => p.map(v => Math.round(v * 1000) / 1000) as [number, number, number]),
  })));
}

// Placements of approved library assets only; drafts are previews and never ship.
// Ground placements keep the height the studio stood them on (the top of a kerb
// or road can be above the terrain); ones far from the ground are reported.
export function collectPlacements(sites: PlacementSite[], library: string, heightAt: HeightAt) {
  const placements: Placement[] = [], skipped = new Set<string>();
  let adrift = 0;
  for (const site of sites) for (const p of site.placements) {
    if (!fs.existsSync(path.join(library, p.asset, 'asset.ts'))) { skipped.add(p.asset); continue; }
    if (p.attach === 'ground') { const h = heightAt(p.p[0], p.p[1]); if (h !== null && Math.abs(h - p.p[2]) > .5) adrift++; }
    placements.push(p);
  }
  const report = `studio placements: ${placements.length} from ${sites.length} squares` + (skipped.size ? `; left out, not in the library: ${[...skipped].join(', ')}` : '') + (adrift ? `; ${adrift} on the ground stand more than 0.5 m from the terrain, check them in the studio` : '');
  return {placements, report};
}
