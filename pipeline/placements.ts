import fs from 'node:fs';
import path from 'node:path';
import type {BuiltLine, RoadSurface} from '../src/engine/data.ts';
import {LINE_HEIGHT, standLine} from '../src/engine/lines.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TREE_MATCH, TRIANGLE, type CityDefinition, type Placement, type PlacementSite, type Point2, type SceneData} from '../src/engine/types.ts';
import {DRIVEN, FOOTWAY, nearestOn, offsetLine, ROAD_TAGS, ROAD_WIDTH, SNAP} from '../src/engine/streets.ts';
import type {Georeference, OsmExtract} from './geo.ts';
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

// Roads drawn in the studio join the OpenStreetMap streets before anything is
// built from them: an end within SNAP of a street becomes a node on it (an
// existing node if one is close, else the street is split there), and ends of
// drawn roads that meet share a node, so osm2streets builds the junctions.
// Footways are separate paths beside the carriageway, as most here are mapped.
export function addStudioRoads(osm: OsmExtract, sites: PlacementSite[], {local, lonLat}: Georeference, city: CityDefinition) {
  const roads = sites.flatMap(s => s.roads ?? []);
  if (!roads.length) return {osm, report: 'studio roads: 0'};
  const [ox, oz] = city.frame.origin, toLonLat = ([x, z]: Point2) => lonLat([x + ox, z + oz]);
  const highways = osm.highways.map(w => ({...w, nodes: [...w.nodes], points: [...w.points]}));
  const driven = highways.filter(w => DRIVEN.has(w.tags.highway)), lines = driven.map(w => w.points.map(p => local(p)));
  const ends: {id: number; at: Point2}[] = [];
  let node = -1, way = -1, joined = 0;
  const end = (at: Point2): {id: number; at: Point2} => {
    const shared = ends.find(e => Math.hypot(e.at[0] - at[0], e.at[1] - at[1]) < 1);
    if (shared) return shared;
    const hit = nearestOn(lines, at[0], at[1], SNAP);
    if (hit) {
      joined++;
      const w = driven[hit.line], line = lines[hit.line];
      for (const k of [hit.segment, hit.segment + 1]) if (Math.hypot(line[k][0] - hit.point[0], line[k][1] - hit.point[1]) < 1.5) return {id: w.nodes[k], at: line[k]};
      const id = node--;
      w.nodes.splice(hit.segment + 1, 0, id);
      w.points.splice(hit.segment + 1, 0, toLonLat(hit.point));
      line.splice(hit.segment + 1, 0, hit.point);
      return {id, at: hit.point};
    }
    const made = {id: node--, at};
    ends.push(made);
    return made;
  };
  let footways = 0;
  for (const r of roads) {
    const at = r.points.map(([x, z]): Point2 => [x - ox, z - oz]);
    if (at.length < 2) continue;
    const first = end(at[0]), last = end(at[at.length - 1]), course = [first.at, ...at.slice(1, -1), last.at];
    highways.push({id: way--, nodes: [first.id, ...course.slice(1, -1).map(() => node--), last.id], points: course.map(toLonLat), tags: {...ROAD_TAGS[r.type], 'studio:road': r.id}});
    if (r.footways) for (const side of [1, -1]) {
      const path = offsetLine(course, side * (ROAD_WIDTH[r.type] / 2 + FOOTWAY.offset));
      highways.push({id: way--, nodes: path.map(() => node--), points: path.map(toLonLat), tags: {highway: 'footway', footway: 'sidewalk', surface: 'asphalt'}});
      footways++;
    }
  }
  return {osm: {...osm, highways}, report: `studio roads: ${roads.length}, ${joined} ends joined to streets, ${footways} footways`};
}

// Marks the laid road surfaces that belong to drawn roads with their square,
// by distance from the road's course, junction pieces at their ends included.
export function markStudioRoads(surfaces: RoadSurface[], sites: PlacementSite[], city: CityDefinition) {
  const [ox, oz] = city.frame.origin, courses = sites.flatMap(s => (s.roads ?? []).map(r => ({site: s.id, points: r.points.map(([x, z]): Point2 => [x - ox, z - oz]), half: ROAD_WIDTH[r.type] / 2, footways: !!r.footways})));
  if (!courses.length) return;
  // A cell's centre lies within half its 3 m size of its own band; streets beyond stay the town's.
  const SLACK = .75;
  for (const s of surfaces) {
    const cx = s.ring.reduce((t, p) => t + p[0], 0) / s.ring.length, cz = s.ring.reduce((t, p) => t + p[2], 0) / s.ring.length;
    const owner = courses.find(c => {
      const hit = nearestOn([c.points], cx, cz, c.half + FOOTWAY.offset + FOOTWAY.width + SLACK);
      if (!hit) return false;
      return s.kind === 'footway' ? c.footways && hit.distance > c.half : hit.distance <= c.half + SLACK;
    });
    if (owner) s.studio = owner.site;
  }
}

// The driven streets in source x/z, for the studio to snap drawn roads to.
export function streetLines(osm: OsmExtract, {local}: Georeference, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, round = (v: number) => Math.round(v * 100) / 100;
  return osm.highways.filter(w => DRIVEN.has(w.tags.highway) && !w.tags['studio:road']).map(w => w.points.map(p => { const [x, z] = local(p); return [round(x + ox), round(z + oz)] as Point2; }));
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
