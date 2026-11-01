import fs from 'node:fs';
import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import {initSync, JsStreetNetwork} from 'osm2streets-js/osm2streets_js.js';
import type {Georeference, OsmExtract} from './geo.ts';
import type {Centreline} from './grade.ts';
import {FOOTWAY, MARKING as PAINT_MARKING, ROAD, surveyLayers} from './survey-colour.ts';
import type {Finish, RoadKind, RoadSurface} from '../src/engine/data.ts';
import {triangulate} from '../src/engine/roads.ts';
import type {Bucket} from '../src/engine/survey/classify.ts';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import {TRIANGLE, type CityDefinition, type Point2, type Polygon, type SceneData} from '../src/engine/types.ts';

// Pilot: osm2streets roads only around Kesk 5 while the approach is tried out.
const PILOT = {building: '213818453', half: 170}, TOWN_MARGIN = 30; // metres
// Markings span carriageway triangles of differing slope between their own points.
const DENSIFY = 2, SURFACE = .02, MARKING = .03; // metres
const LAYER_LIFT = .3, LIFT = .5, MARKING_LIFT = .05; // metres; LAYER_LIFT matches the survey shader's
// Metres: with CELL_SIZE cells densified every DENSIFY, ring points lie within REACH of any point of their polygon.
const REACH = 2, SAMPLE = .5, CELL_SIZE = 3;
// Metres: survey ground layers stack 5-35 cm apart, and draping can stretch a
// stack to just over half a metre; ground metres away is at another level.
const STACK = 1;
const HUGE = 60, CELL = 4;
const TOUCH = .05, ORDER_LIFT = .02, SLIVER = .05, MIN_HOLE = 10; // metres, metres, square metres, square metres
const CROSSING_WIDTH = 3, ZEBRA = {bar: .5, pitch: 1, clear: 1}; // metres
const CARRIAGEWAY = new Set(['Driving', 'Parking', 'Shoulder', 'Construction']);
// Paint measurement, metres: a layer within PAINT_TOP of the top one is seen;
// OSM ways lie up to SEEK off the painted road.
const STATION = 4, STATION_END = 8, SCAN = .25, SEEK = 2, MAX_PAINT = 12, MIN_STATIONS = 3, PAINT_TOP = .03, MAX_GROW = 2.5;
// Metres: a trunk keeps TRUNK clear of paths and moves at most TREE_SHIFT.
const TRUNK = .6, TREE_STEP = .25, TREE_SHIFT = 5;
// Metres from a repainted triangle at which the surrounding ground colour is sampled, nearest first.
const VERGE_SAMPLES = [2.5, 4, 8];
const SEEKS = [0, ...Array.from({length: SEEK / SCAN}, (_, k) => [(k + 1) * SCAN, -(k + 1) * SCAN]).flat()];

type Feature = {geometry: {type: string; coordinates: any}; properties: Record<string, any>};
export type RoadShape = {kind: RoadKind; ring: Point2[]; surface?: Finish};

// OSM surface tags to the finishes the viewer draws. Untagged and plain
// "paved" paths are asphalt, as most here are on the ground.
const PAVING = new Set(['paving_stones', 'sett', 'concrete:plates', 'concrete:lanes', 'bricks']);
const LOOSE = new Set(['fine_gravel', 'gravel', 'compacted', 'unpaved', 'ground', 'dirt', 'grass', 'sand']);
const finish = (surface?: string): Finish => surface && PAVING.has(surface) ? 'paving' : surface && LOOSE.has(surface) ? 'gravel' : 'asphalt';

export const isCrossing = (tags: Record<string, string>) => tags.footway === 'crossing' || (tags.highway === 'footway' && 'crossing' in tags);
export const marked = (tags: Record<string, string>) => tags['crossing:markings'] ? tags['crossing:markings'] !== 'no' : ['zebra', 'marked', 'uncontrolled'].includes(tags.crossing);

// osm2streets builds lane and junction polygons from OSM tags alone. This
// version ignores width tags: driving lanes are 3 m, footways 2 m.
export function buildRoads(osm: OsmExtract, scene: SceneData, city: CityDefinition, {local}: Georeference, vertices: Float32Array) {
  const [ox, oz] = city.frame.origin, {inside} = roadArea(scene, city);
  // Steps are built as stairs. Crossings would become footway lanes over the
  // carriageway, as this osm2streets version does not turn them into markings.
  const near = osm.highways.filter(w => w.points.some(p => inside(local(p), 50)));
  const ways = near.filter(w => w.tags.highway !== 'steps' && !isCrossing(w.tags));
  const crossings = near.filter(w => isCrossing(w.tags) && marked(w.tags));
  const nodes = new Map<number, Point2>();
  for (const w of ways) w.nodes.forEach((n, i) => nodes.set(n, w.points[i]));
  const corners = [...nodes.values()].filter(p => inside(local(p)));
  const lons = corners.map(p => p[0]), lats = corners.map(p => p[1]);
  const [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const clip = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}}]};

  initSync(fs.readFileSync(new URL(import.meta.resolve('osm2streets-js/osm2streets_js_bg.wasm'))));
  const network = new JsStreetNetwork(osmXml(nodes, ways), JSON.stringify(clip),
    {debug_each_step: false, dual_carriageway_experiment: false, sidepath_zipping_experiment: false, inferred_sidewalks: false, inferred_kerbs: false, osm2lanes: false});
  const features = (geojson: string): Feature[] => JSON.parse(geojson).features;
  const lanes = features(network.toLanePolygonsGeojson()), plain = features(network.toGeojsonPlain());
  const markings = features(network.toLaneMarkingsGeojson()).filter(f => f.properties.type !== 'lane arrow');
  network.free();

  const driven = new Set(lanes.filter(f => f.properties.type === 'Driving').map(f => f.properties.road));
  const drivenJunction = new Set(plain.filter(f => f.properties.type === 'road' && driven.has(f.properties.id)).flatMap(f => [f.properties.src_i, f.properties.dst_i]));
  const rings = (f: Feature) => outerRings(f.geometry).flatMap(r => untangle(r.map(p => local(p))));

  // Lanes are 3 m whatever the street, so each carriageway is grown to the
  // width the survey paints it, measured along its OSM ways.
  const paint = paintedWidth(surveyLayers(vertices), [ox, oz]);
  const measured = new Map(ways.map(w => [w.id, paint(w.points.map(p => local(p)))]));
  const built = new Map<number, number>(), grow = new Map<number, number>();
  for (const f of lanes) if (CARRIAGEWAY.has(f.properties.type)) built.set(f.properties.road, (built.get(f.properties.road) ?? 0) + f.properties.width);
  for (const f of plain) if (f.properties.type === 'road' && built.has(f.properties.id)) {
    const widths = f.properties.osm_way_ids.map((id: number) => measured.get(id)).filter((w?: number | null) => w);
    if (widths.length) grow.set(f.properties.id, Math.max(-MAX_GROW, Math.min(MAX_GROW, (median(widths) - built.get(f.properties.id)!) / 2)));
  }
  const junctionGrow = new Map<number, number>();
  for (const f of plain) if (f.properties.type === 'road' && grow.has(f.properties.id))
    for (const j of [f.properties.src_i, f.properties.dst_i]) junctionGrow.set(j, Math.max(junctionGrow.get(j) ?? -MAX_GROW, grow.get(f.properties.id)!));
  const wayById = new Map(ways.map(w => [w.id, w]));
  const roadWays = new Map(plain.filter(f => f.properties.type === 'road').map(f => [f.properties.id as number, f.properties.osm_way_ids.map((id: number) => wayById.get(id)).filter((w?: OsmExtract['highways'][number]) => w) as OsmExtract['highways']]));
  const byRoad = new Map<number, Point2[][]>();
  for (const f of lanes) if (CARRIAGEWAY.has(f.properties.type)) byRoad.set(f.properties.road, [...byRoad.get(f.properties.road) ?? [], ...rings(f)]);
  const carriageways = [
    ...[...byRoad].flatMap(([id, parts]) => {
      const by = grow.get(id) ?? 0;
      if (by >= 0) return offset(union(parts), by, ClipperLib.JoinType.jtMiter);
      // Shrinking the outline would also pull its ends back from the junctions;
      // a band along the OSM ways narrows it across only.
      const lines = (roadWays.get(id) ?? []).map(w => w.points.map(p => local(p)));
      return intersection(union(parts), corridor(lines, built.get(id)! / 2 + by));
    }),
    ...plain.filter(f => f.properties.type === 'intersection' && drivenJunction.has(f.properties.id)).flatMap(f => {
      const by = junctionGrow.get(f.properties.id) ?? 0;
      if (by >= 0) return offset(rings(f), by, ClipperLib.JoinType.jtRound);
      // As for streets: shrinking would open a gap along the road where a path joins it.
      const streets = plain.filter(r => r.properties.type === 'road' && byRoad.has(r.properties.id) && [r.properties.src_i, r.properties.dst_i].includes(f.properties.id));
      return intersection(rings(f), streets.flatMap(r => corridor((roadWays.get(r.properties.id) ?? []).map(w => w.points.map(p => local(p))), built.get(r.properties.id)! / 2 + (grow.get(r.properties.id) ?? 0))));
    }),
  ];
  // Footway junctions take the asphalt most paths here have.
  const surfaceOf = (f: Feature) => finish((f.properties.osm_way_ids ?? []).map((id: number) => wayById.get(id)?.tags.surface).find(Boolean));
  const footways = [
    ...plain.filter(f => f.properties.type === 'intersection' && !drivenJunction.has(f.properties.id)).flatMap(f => rings(f).map(ring => ({ring, surface: 'asphalt' as Finish}))),
    ...lanes.filter(f => !CARRIAGEWAY.has(f.properties.type)).flatMap(f => rings(f).map(ring => ({ring, surface: surfaceOf(f)}))),
  ];
  // Separately mapped sidewalks and paths reach onto the carriageway at junctions and run along its edge.
  const road = area(carriageways);
  // Crossing ways often bend onto the sidewalks; the painted zebra is straight.
  const zebras = crossings.map(w => ({line: [local(w.points[0]), local(w.points[w.points.length - 1])], width: parseFloat(w.tags.width) || CROSSING_WIDTH}));
  // Lane lines stop short of a zebra rather than running through its bars.
  const zebraBands = zebras.map(({line, width}) => band(line[0], line[1], width / 2 + ZEBRA.clear));
  const shapes: RoadShape[] = [
    ...carriageways.map(ring => ({kind: 'carriageway' as const, ring})),
    ...footways.flatMap(({ring, surface}) => difference([ring], road).map(piece => ({kind: 'footway' as const, ring: piece, surface}))),
    ...markings.flatMap(rings).flatMap(ring => difference([ring], zebraBands)).map(ring => ({kind: 'marking' as const, ring})),
    ...zebras.flatMap(({line, width}) => zebra(line, width)).flatMap(bar => intersection([bar], road)).map(ring => ({kind: 'marking' as const, ring})),
  ];

  const halves = new Map<number, number>();
  for (const f of plain) if (f.properties.type === 'road' && driven.has(f.properties.id))
    for (const id of f.properties.osm_way_ids) halves.set(id, Math.max(halves.get(id) ?? 0, built.get(f.properties.id)! / 2 + (grow.get(f.properties.id) ?? 0)));
  const centrelines: Centreline[] = ways.filter(w => halves.has(w.id)).map(w => ({points: w.points.map(p => { const [x, z] = local(p); return [x + ox, z + oz]; }), half: halves.get(w.id)!}));
  const count = (kind: RoadKind) => shapes.filter(s => s.kind === kind).length, grown = [...grow.values()];
  return {shapes, centrelines, report: `roads (osm2streets, ${process.env.ROADS_AREA === 'town' ? 'whole town' : `pilot ${PILOT.half * 2} m around building ${PILOT.building}`}): ${count('carriageway')} carriageway, ${count('footway')} footway and ${count('marking')} marking polygons, ${crossings.length} zebra crossings; carriageways sized to the survey paint: ${grown.filter(g => g >= .05).length} widened, ${grown.filter(g => g <= -.05).length} narrowed, ${byRoad.size - grown.length} unmeasured; ${centrelines.length} ways graded`};
}

// Trees standing on a built carriageway or footway move to the nearest spot
// clear of it, trunk and all; survey crown points do not respect paths.
export function moveTreesOffPaths(shapes: RoadShape[], scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, paved = area(shapes.filter(s => s.kind !== 'marking').map(s => s.ring));
  const boxes = paved.map(r => { const xs = r.map(p => p[0]), zs = r.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; });
  const onPath = (x: number, z: number) => paved.filter((r, i) => x >= boxes[i][0] && x <= boxes[i][1] && z >= boxes[i][2] && z <= boxes[i][3] && inRing(r, x, z)).length % 2 === 1;
  const clear = (x: number, z: number) => [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * TRUNK, Math.sin(k * Math.PI / 4) * TRUNK])].every(([dx, dz]) => !onPath(x + dx, z + dz));
  let moved = 0, stranded = 0;
  for (const t of scene.trees) {
    const x = t.p[0] - ox, z = t.p[1] - oz;
    if (clear(x, z)) continue;
    let spot: Point2 | null = null;
    for (let r = TREE_STEP; r <= TREE_SHIFT && !spot; r += TREE_STEP) for (let k = 0; k < 24 && !spot; k++) {
      const p: Point2 = [x + Math.cos(k * Math.PI / 12) * r, z + Math.sin(k * Math.PI / 12) * r];
      if (clear(...p)) spot = p;
    }
    if (!spot) { stranded++; continue; }
    t.p = [round(spot[0] + ox), round(spot[1] + oz)];
    moved++;
  }
  return `trees moved off built roads and paths: ${moved}; ${stranded} left more than ${TREE_SHIFT} m from clear ground`;
}

export function inRing(r: Point2[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
  return inside;
}

// The survey's footway paint does not match the ground (a wide band along the
// roads where there is a small kerb and grass), so inside the road area it
// takes the colour of the ground around it; mapped footways are drawn over it.
// Only colours change, so the stacked ground layers stay as they are.
export function clearFootwayPaint(v: Float32Array, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, {layers, is} = surveyLayers(v);
  const vergeColour = (x: number, z: number) => {
    const found: number[][] = [];
    for (const r of VERGE_SAMPLES) for (let k = 0; k < 8; k++) {
      const top = layers(x + ox + Math.cos(k * Math.PI / 4) * r, z + oz + Math.sin(k * Math.PI / 4) * r)[0];
      if (top && !is(top.i, ROAD) && !is(top.i, FOOTWAY) && !is(top.i, PAINT_MARKING)) found.push([v[top.i + 3], v[top.i + 4], v[top.i + 5]]);
    }
    return found.length ? [0, 1, 2].map(c => median(found.map(f => f[c]))) : null;
  };
  // Footway triangles can be large and cross the area's edge, so they are split
  // along it and only the part inside is recoloured.
  const square = squareOf(scene, city), out: number[] = [];
  let repainted = 0, kept = 0;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    if (v[i + 6] || !is(i, FOOTWAY)) { pushTriangle(v, i, out); continue; }
    if (!splitTriangle(v, i, square, city, out, p => vergeColour(...p) ?? (kept++, null))) { pushTriangle(v, i, out); continue; }
    repainted++;
  }
  return {vertices: Float32Array.from(out), report: `survey footway paint recoloured to the ground around it: ${repainted} triangles; ${kept} kept, with no other ground within ${VERGE_SAMPLES[VERGE_SAMPLES.length - 1]} m`};
}

export const squareOf = (scene: SceneData, city: CityDefinition): Point2[][] => {
  const {centre: [cx, cz], half: [hx, hz]} = roadArea(scene, city);
  return [[[cx - hx, cz - hz], [cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz]]];
};

export const pushTriangle = (v: Float32Array, i: number, out: number[]) => { for (let k = 0; k < TRIANGLE; k++) out.push(v[i + k]); };

// Splits survey triangle i along a region (local frame). The part inside takes
// the colour paintAt gives for a point in it, or is dropped when that is 'drop';
// the rest keeps its colours. Pieces lie in the triangle's plane and are pushed
// in its place, keeping heights, layers and the survey's order. Returns false,
// pushing nothing, when nothing lies inside, paintAt gives no colour, or the
// clip lost a hole (which would break the area sum).
export function splitTriangle(v: Float32Array, i: number, region: Point2[][], city: CityDefinition, out: number[], paintAt: ((p: Point2) => number[] | null) | 'drop') {
  const [ox, oz] = city.frame.origin, tri = [0, 7, 14].map((k): Point2 => [v[i + k] - ox, v[i + k + 1] - oz]);
  const inside = intersection([tri], region), outside = difference([tri], region);
  const areaOf = (rings: Point2[][]) => rings.reduce((s, r) => s + Math.abs(ClipperLib.Clipper.Area(toPath(r))), 0) / SCALE / SCALE;
  if (!inside.length || Math.abs(areaOf(inside) + areaOf(outside) - areaOf([tri])) > .01 * areaOf([tri]) + SLIVER) return false;
  const colour = paintAt === 'drop' ? null : paintAt(inside[0][0]);
  if (paintAt !== 'drop' && !colour) return false;
  const [a, b, c] = tri, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]), winding = Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const vertex = ([x, z]: Point2, paint: number[] | null) => {
    const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d, w = [l1, l2, 1 - l1 - l2];
    const at = (k: number) => w.reduce((s, wj, j) => s + wj * v[i + j * 7 + k], 0);
    out.push(x + ox, z + oz, at(2), ...(paint ?? [at(3), at(4), at(5)]), 0);
  };
  const parts: [Point2[][], number[] | null][] = paintAt === 'drop' ? [[outside, null]] : [[inside, colour], [outside, null]];
  for (const [rings, paint] of parts) for (const ring of rings)
    for (const t of THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), [])) {
      const [p, q, r] = t.map(j => ring[j]), same = Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) === winding;
      for (const point of same ? [p, q, r] : [p, r, q]) vertex(point, paint);
    }
  return true;
}

// The square, in the local frame, within which roads are built.
// ROADS_AREA=town widens it to a rectangle over every building, for trying
// the whole town before the pilot is retired. half is [x, z].
export function roadArea(scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin;
  let cx: number, cz: number, half: [number, number];
  if (process.env.ROADS_AREA === 'town') {
    const xs = scene.buildings.flatMap(b => b.g.map(p => p[0] - ox)), zs = scene.buildings.flatMap(b => b.g.map(p => p[1] - oz));
    [cx, cz] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    half = [(Math.max(...xs) - Math.min(...xs)) / 2 + TOWN_MARGIN, (Math.max(...zs) - Math.min(...zs)) / 2 + TOWN_MARGIN];
  } else {
    const b = scene.buildings.find(b => b.id === PILOT.building)!;
    [cx, cz, half] = [b.g.reduce((s, p) => s + p[0], 0) / b.g.length - ox, b.g.reduce((s, p) => s + p[1], 0) / b.g.length - oz, [PILOT.half, PILOT.half]];
  }
  const inside = ([x, z]: Point2, margin = 0) => Math.abs(x - cx) <= half[0] + margin && Math.abs(z - cz) <= half[1] + margin;
  return {centre: [cx, cz] as Point2, half, inside};
}

// Width of the survey's road paint across a way, median over stations away
// from its ends, where junctions widen the paint. Crossing paint counts as road.
function paintedWidth({layers, is}: ReturnType<typeof surveyLayers>, [ox, oz]: Point2) {
  const painted = (x: number, z: number) => {
    const found = layers(x + ox, z + oz), top = found[0]?.h ?? -Infinity;
    return found.some(l => l.h > top - PAINT_TOP && (is(l.i, ROAD) || is(l.i, PAINT_MARKING)));
  };
  return (line: Point2[]) => {
    const widths: number[] = [];
    let along = 0;
    const total = line.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!length) continue;
      const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], n = [-u[1], u[0]];
      for (let s = (STATION - along % STATION) % STATION; s < length; s += STATION) {
        if (along + s < STATION_END || total - along - s < STATION_END) continue;
        const at = (t: number) => painted(a[0] + u[0] * s + n[0] * t, a[1] + u[1] * s + n[1] * t);
        const start = SEEKS.find(t => at(t));
        if (start === undefined) continue;
        let left = start, right = start;
        while (left - start > -MAX_PAINT && at(left - SCAN)) left -= SCAN;
        while (right - start < MAX_PAINT && at(right + SCAN)) right += SCAN;
        widths.push(right - left + SCAN);
      }
      along += length;
    }
    return widths.length >= MIN_STATIONS ? median(widths) : null;
  };
}

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function corridor(lines: Point2[][], half: number): Point2[][] {
  const o = new ClipperLib.ClipperOffset(2, .1 * SCALE), out: {X: number; Y: number}[][] = [];
  o.AddPaths(lines.map(toPath), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenSquare);
  o.Execute(out, half * SCALE);
  return out.map(p => p.map((q): Point2 => [q.X / SCALE, q.Y / SCALE]));
}

function offset(rings: Point2[][], by: number, join: number): Point2[][] {
  if (Math.abs(by) < .05) return rings;
  const o = new ClipperLib.ClipperOffset(2, .1 * SCALE), out: {X: number; Y: number}[][] = [];
  o.AddPaths(rings.map(toPath), join, ClipperLib.EndType.etClosedPolygon);
  o.Execute(out, by * SCALE);
  return out.map(p => p.map((q): Point2 => [q.X / SCALE, q.Y / SCALE])).filter(r => Math.abs(ClipperLib.Clipper.Area(toPath(r))) / SCALE / SCALE >= SLIVER);
}

// Roads stand on the top draped ground surface around each ring point, which
// rides on the graded terrain: survey layers rising above a road, such as
// painted crossings, would shadow it. Layers that still rise between ring
// points are outdrawn by a depth lift. Refined sites own the ground they lay,
// so roads stop at their patches.
export function layRoads(shapes: RoadShape[], buckets: Bucket[], city: CityDefinition, base: number, patches: Polygon[], heightAt: HeightAt) {
  const [ox, oz] = city.frame.origin, ground = groundIndex(buckets);
  const sites = area(patches.map(p => p.map(([x, z]): Point2 => [x - ox, z - oz])));
  // Surfaces are cut into cells: the viewer triangulates outlines only, and the
  // middle of a wide carriageway would otherwise sink below survey paint
  // sheets, which then shadow it.
  const surfaces: RoadSurface[] = shapes.flatMap(s => difference([s.ring], sites).flatMap(ring => s.kind === 'marking' ? [ring] : cells(ring)).map((ring): RoadSurface => ({kind: s.kind, lift: 0, ring: densify(ring).map(([x, z]): [number, number, number] => [x, 0, z]), ...s.surface && {surface: s.surface}})));
  // The point stands on the ground stack beneath it and takes from around it
  // only how thick the layers stack: neighbouring ground can lie at another
  // level altogether, as at the edge of the ground kept at its surveyed height
  // around refined sites, metres from the draped ground beside it. The stack's
  // top, not its base, is the floor: site works push survey layers down near
  // their patches. Over water there is no ground stack: a path crossing a stream
  // stands on the graded terrain the ground beside it was built from, as the
  // mean of its cell's other points stepped between cells on the banks.
  const around = (x: number, z: number) => {
    let thick = 0, layer = 0, found = false;
    for (let dx = -REACH; dx <= REACH; dx += SAMPLE) for (let dz = -REACH; dz <= REACH; dz += SAMPLE) {
      if (dx * dx + dz * dz > REACH * REACH) continue;
      const g = ground(x + dx, z + dz);
      if (g) { thick = Math.max(thick, g.top - g.low); layer = Math.max(layer, g.layer); found = true; }
    }
    const here = ground(x, z);
    if (here && found) return {top: Math.max(here.top, here.low + thick), layer};
    const terrain = heightAt(x, z);
    return terrain === null ? null : {top: terrain, layer};
  };
  const laid = surfaces.filter(s => {
    const found = s.ring.map(p => around(p[0] + ox, p[2] + oz));
    if (found.some(g => g === null)) return false;
    const rise = s.kind === 'marking' ? SURFACE + MARKING : SURFACE;
    s.ring.forEach((p, i) => p[1] = round(found[i]!.top - base + rise));
    s.lift = round(LAYER_LIFT * Math.max(0, ...found.map(g => g!.layer)) + LIFT);
    return true;
  });
  // Footways are clipped off the carriageway, but where they meet at the same
  // height the carriageway must win, so it takes any higher neighbour's lift.
  const carriageways = laid.filter(s => s.kind === 'carriageway'), footways = boxGrid(laid.filter(s => s.kind === 'footway'), s => boxOf(s.ring, 0));
  for (const c of carriageways) {
    const box = boxOf(c.ring, TOUCH), touching = footways(box).filter(f => f.ring.some(([x, , z]) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ));
    c.lift = round(Math.max(c.lift, ...touching.map(f => f.lift + ORDER_LIFT)));
  }
  // Markings lie on the carriageway as the viewer triangulates it: sampled from
  // the ground they would sink where its long triangles span a higher edge. A
  // marking lifted less than any carriageway it overlaps would be hidden there.
  const road = surfaceIndex(carriageways);
  for (const m of laid) if (m.kind === 'marking') {
    for (const p of m.ring) { const h = road.at(p[0], p[2]); if (h !== null) p[1] = round(h + MARKING); }
    m.lift = round(Math.max(m.lift, ...road.overlapping(boxOf(m.ring, 0)).map(c => c.lift)) + MARKING_LIFT);
  }
  return laid;
}

// Grid of items by their bounding boxes, so town-wide lookups stay local.
function boxGrid<T>(items: T[], box: (item: T) => ReturnType<typeof boxOf>) {
  const grid = new Map<string, T[]>(), keys = (b: ReturnType<typeof boxOf>) => {
    const out: string[] = [];
    for (let x = Math.floor(b.minX / CELL); x <= Math.floor(b.maxX / CELL); x++) for (let z = Math.floor(b.minZ / CELL); z <= Math.floor(b.maxZ / CELL); z++) out.push(x + ',' + z);
    return out;
  };
  for (const item of items) for (const k of keys(box(item))) { let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(item); }
  return (b: ReturnType<typeof boxOf>) => [...new Set(keys(b).flatMap(k => grid.get(k) ?? []))].filter(item => { const c = box(item); return c.minX <= b.maxX && c.maxX >= b.minX && c.minZ <= b.maxZ && c.maxZ >= b.minZ; });
}

function surfaceIndex(surfaces: RoadSurface[]) {
  const triangles = boxGrid(surfaces.flatMap(s => triangulate(s.ring).map(t => t.map(i => s.ring[i]))), t => boxOf(t as [number, number, number][], 0));
  const at = (x: number, z: number) => {
    let top: number | null = null;
    for (const [[x1, h1, z1], [x2, h2, z2], [x3, h3, z3]] of triangles({minX: x, maxX: x, minZ: z, maxZ: z})) {
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-4) continue;
      top = Math.max(top ?? -Infinity, a * h1 + b * h2 + c * h3);
    }
    return top;
  };
  const overlapping = boxGrid(surfaces, s => boxOf(s.ring, 0));
  return {at, overlapping};
}

function boxOf(ring: [number, number, number][], margin: number) {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[2]);
  return {minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin, minZ: Math.min(...zs) - margin, maxZ: Math.max(...zs) + margin};
}

function cells(ring: Point2[]) {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), out: Point2[][] = [];
  for (let x = Math.floor(Math.min(...xs) / CELL_SIZE) * CELL_SIZE; x < Math.max(...xs); x += CELL_SIZE)
    for (let z = Math.floor(Math.min(...zs) / CELL_SIZE) * CELL_SIZE; z < Math.max(...zs); z += CELL_SIZE)
      out.push(...intersection([ring], [[[x, z], [x + CELL_SIZE, z], [x + CELL_SIZE, z + CELL_SIZE], [x, z + CELL_SIZE]]]));
  return out;
}

// Rectangle along a to b reaching half to either side.
function band(a: Point2, b: Point2, half: number): Point2[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / length * half, (b[0] - a[0]) / length * half];
  return [[a[0] - n[0], a[1] - n[1]], [b[0] - n[0], b[1] - n[1]], [b[0] + n[0], b[1] + n[1]], [a[0] + n[0], a[1] + n[1]]];
}

// Each bar runs with the traffic, across the crossing line, so bars are laid
// along that line at the zebra pitch.
function zebra(line: Point2[], width: number) {
  const bars: Point2[][] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!length) continue;
    const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], n = [-u[1] * width / 2, u[0] * width / 2];
    for (let s = 0; s + ZEBRA.bar <= length; s += ZEBRA.pitch) {
      const p = (t: number, side: number): Point2 => [a[0] + u[0] * t + n[0] * side, a[1] + u[1] * t + n[1] * side];
      bars.push([p(s, -1), p(s + ZEBRA.bar, -1), p(s + ZEBRA.bar, 1), p(s, 1)]);
    }
  }
  return bars;
}

// Clipper works in integer millimetres; results keep outer contours only, as
// the viewer triangulates rings without holes.
const SCALE = 1000;
const toPath = (ring: Point2[]) => ring.map(([x, z]) => ({X: Math.round(x * SCALE), Y: Math.round(z * SCALE)}));
// osm2streets can return a ring that crosses itself and winds backwards; in a
// non-zero union it cancels the ground other rings cover, opening a hole that
// footways are then not cut by. Each becomes simple rings wound forwards, with
// the centimetre spikes left where it crossed itself removed.
function untangle(ring: Point2[]): Point2[][] {
  const simple = ClipperLib.Clipper.SimplifyPolygon(toPath(ring), ClipperLib.PolyFillType.pftNonZero);
  return ClipperLib.Clipper.CleanPolygons(simple, SLIVER * SCALE)
    .filter((p: {X: number; Y: number}[]) => Math.abs(ClipperLib.Clipper.Area(p)) / SCALE / SCALE >= SLIVER)
    .map((p: {X: number; Y: number}[]) => p.map((q): Point2 => [q.X / SCALE, q.Y / SCALE]));
}
function clip(type: number, subject: Point2[][], cut: Point2[][]): Point2[][] {
  const c = new ClipperLib.Clipper(), tree = new ClipperLib.PolyTree();
  c.AddPaths(subject.map(toPath), ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(cut.map(toPath), ClipperLib.PolyType.ptClip, true);
  c.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out: Point2[][] = [], walk = (node: any) => {
    for (const child of node.Childs()) {
      const ring = child.Contour().map((p: {X: number; Y: number}): Point2 => [p.X / SCALE, p.Y / SCALE]);
      if (!child.IsHole() && Math.abs(ClipperLib.Clipper.Area(child.Contour())) / SCALE / SCALE >= SLIVER) out.push(ring);
      walk(child);
    }
  };
  walk(tree);
  return out;
}
const union = (rings: Point2[][]) => clip(ClipperLib.ClipType.ctUnion, rings, []);
// Outer rings and holes, wound oppositely; only for cutting, where dropping a
// hole (a block ringed by road) would cut away the whole block. Holes under
// MIN_HOLE are seams between overlapping slivers, not ground, and are filled.
function area(rings: Point2[][]): Point2[][] {
  const c = new ClipperLib.Clipper(), out: {X: number; Y: number}[][] = [];
  c.AddPaths(rings.map(toPath), ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out.filter(p => { const a = ClipperLib.Clipper.Area(p) / SCALE / SCALE; return a >= SLIVER || a <= -MIN_HOLE; }).map(p => p.map((q): Point2 => [q.X / SCALE, q.Y / SCALE]));
}
const difference = (subject: Point2[][], cut: Point2[][]) => cut.length ? clip(ClipperLib.ClipType.ctDifference, subject, cut) : subject;
const intersection = (subject: Point2[][], cut: Point2[][]) => clip(ClipperLib.ClipType.ctIntersection, subject, cut);

function groundIndex(buckets: Bucket[]) {
  const triangles: {p: number[]; layer: number}[] = [], grid = new Map<string, number[]>();
  for (const b of buckets) {
    if (b.kind === 'water') continue;
    for (let t = 0; t < b.building.length; t++) {
      if (b.building[t]) continue;
      const p = b.source.slice(t * 9, t * 9 + 9), xs = [p[0], p[3], p[6]], zs = [p[1], p[4], p[7]];
      if (Math.max(...xs) - Math.min(...xs) > HUGE || Math.max(...zs) - Math.min(...zs) > HUGE) continue;
      const index = triangles.push({p, layer: b.layer?.[t] ?? 0}) - 1;
      for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++)
        for (let cz = Math.floor(Math.min(...zs) / CELL); cz <= Math.floor(Math.max(...zs) / CELL); cz++) {
          const k = cx + ',' + cz;
          let list = grid.get(k);
          if (!list) grid.set(k, list = []);
          list.push(index);
        }
    }
  }
  // The stack at a point is its lowest surface and the layers within STACK of
  // it; anything higher is not ground (a shelter roof painted as ground).
  return (x: number, z: number) => {
    const found: {h: number; layer: number}[] = [];
    for (const index of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const {p: [x1, z1, h1, x2, z2, h2, x3, z3, h3], layer} = triangles[index], d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-6) continue;
      found.push({h: a * h1 + b * h2 + c * h3, layer});
    }
    if (!found.length) return null;
    const low = Math.min(...found.map(f => f.h)), stack = found.filter(f => f.h <= low + STACK);
    return {low, top: Math.max(...stack.map(f => f.h)), layer: Math.max(...stack.map(f => f.layer))};
  };
}

function osmXml(nodes: Map<number, Point2>, ways: OsmExtract['highways']) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return ['<osm version="0.6">',
    ...[...nodes].map(([id, [lon, lat]]) => `<node id="${id}" lat="${lat}" lon="${lon}"/>`),
    ...ways.map(w => `<way id="${w.id}">${w.nodes.map(n => `<nd ref="${n}"/>`).join('')}${Object.entries(w.tags).map(([k, v]) => `<tag k="${esc(k)}" v="${esc(v)}"/>`).join('')}</way>`),
    '</osm>'].join('\n');
}

// GeoJSON rings repeat their first point; the viewer's triangulation does not want it.
function outerRings(geometry: Feature['geometry']): Point2[][] {
  const rings: Point2[][] = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.type === 'MultiPolygon' ? geometry.coordinates.map((p: Point2[][]) => p[0]) : [];
  return rings.map(r => r.slice(0, -1)).filter(r => r.length >= 3);
}

// Edges are split so ring heights follow the ground between osm2streets' sparse corners.
function densify(ring: Point2[]) {
  return ring.flatMap((p, i) => {
    const q = ring[(i + 1) % ring.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / DENSIFY));
    return Array.from({length: steps}, (_, k): Point2 => [p[0] + (q[0] - p[0]) * k / steps, p[1] + (q[1] - p[1]) * k / steps]);
  });
}

const round = (v: number) => Math.round(v * 100) / 100;
