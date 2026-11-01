import fs from 'node:fs';
import path from 'node:path';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TREE_MATCH, type Placement, type PlacementSite, type SceneData} from '../src/engine/types.ts';

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
