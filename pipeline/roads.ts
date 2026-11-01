import fs from 'node:fs';
import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import {initSync, JsStreetNetwork} from 'osm2streets-js/osm2streets_js.js';
import type {Georeference, OsmExtract} from './geo.ts';
import type {Centreline} from './grade.ts';
import {FOOTWAY, MARKING as PAINT_MARKING, ROAD, surveyLayers} from './survey-colour.ts';
import type {RoadKind, RoadSurface} from '../src/engine/data.ts';
import {triangulate} from '../src/engine/roads.ts';
import type {Bucket} from '../src/engine/survey/classify.ts';
import {TRIANGLE, type CityDefinition, type Point2, type Polygon, type SceneData} from '../src/engine/types.ts';

// Pilot: osm2streets roads only around Kesk 5 while the approach is tried out.
const PILOT = {building: '213818453', half: 170}; // metres
// Markings span carriageway triangles of differing slope between their own points.
const DENSIFY = 2, SURFACE = .02, MARKING = .03; // metres
const LAYER_LIFT = .3, LIFT = .5, MARKING_LIFT = .05; // metres; LAYER_LIFT matches the survey shader's
// Metres: with CELL_SIZE cells densified every DENSIFY, ring points lie within REACH of any point of their polygon.
const REACH = 2, SAMPLE = .5, CELL_SIZE = 3;
const HUGE = 60, CELL = 4;
const TOUCH = .05, ORDER_LIFT = .02, SLIVER = .05; // metres, metres, square metres
const CROSSING_WIDTH = 3, ZEBRA = {bar: .5, pitch: 1, clear: 1}; // metres
const CARRIAGEWAY = new Set(['Driving', 'Parking', 'Shoulder', 'Construction']);
// Paint measurement, metres: a layer within PAINT_TOP of the top one is seen;
// OSM ways lie up to SEEK off the painted road.
const STATION = 4, STATION_END = 8, SCAN = .25, SEEK = 2, MAX_PAINT = 12, MIN_STATIONS = 3, PAINT_TOP = .03, MAX_GROW = 2.5;
// Metres from a repainted triangle at which the surrounding ground colour is sampled, nearest first.
const VERGE_SAMPLES = [2.5, 4, 8];
const SEEKS = [0, ...Array.from({length: SEEK / SCAN}, (_, k) => [(k + 1) * SCAN, -(k + 1) * SCAN]).flat()];

type Feature = {geometry: {type: string; coordinates: any}; properties: Record<string, any>};
export type RoadShape = {kind: RoadKind; ring: Point2[]};

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
  const rings = (f: Feature) => outerRings(f.geometry).map(r => r.map(p => local(p)));

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
  const footways = [...plain.filter(f => f.properties.type === 'intersection' && !drivenJunction.has(f.properties.id)), ...lanes.filter(f => !CARRIAGEWAY.has(f.properties.type))].flatMap(rings);
  // Separately mapped sidewalks and paths reach onto the carriageway at junctions and run along its edge.
  const road = area(carriageways);
  // Crossing ways often bend onto the sidewalks; the painted zebra is straight.
  const zebras = crossings.map(w => ({line: [local(w.points[0]), local(w.points[w.points.length - 1])], width: parseFloat(w.tags.width) || CROSSING_WIDTH}));
  // Lane lines stop short of a zebra rather than running through its bars.
  const zebraBands = zebras.map(({line, width}) => band(line[0], line[1], width / 2 + ZEBRA.clear));
  const shapes: RoadShape[] = [
    ...carriageways.map(ring => ({kind: 'carriageway' as const, ring})),
    ...footways.flatMap(ring => difference([ring], road)).map(ring => ({kind: 'footway' as const, ring})),
    ...markings.flatMap(rings).flatMap(ring => difference([ring], zebraBands)).map(ring => ({kind: 'marking' as const, ring})),
    ...zebras.flatMap(({line, width}) => zebra(line, width)).flatMap(bar => intersection([bar], road)).map(ring => ({kind: 'marking' as const, ring})),
  ];

  const halves = new Map<number, number>();
  for (const f of plain) if (f.properties.type === 'road' && driven.has(f.properties.id))
    for (const id of f.properties.osm_way_ids) halves.set(id, Math.max(halves.get(id) ?? 0, built.get(f.properties.id)! / 2 + (grow.get(f.properties.id) ?? 0)));
  const centrelines: Centreline[] = ways.filter(w => halves.has(w.id)).map(w => ({points: w.points.map(p => { const [x, z] = local(p); return [x + ox, z + oz]; }), half: halves.get(w.id)!}));
  const count = (kind: RoadKind) => shapes.filter(s => s.kind === kind).length, grown = [...grow.values()];
  return {shapes, centrelines, report: `roads (osm2streets pilot, ${PILOT.half * 2} m around building ${PILOT.building}): ${count('carriageway')} carriageway, ${count('footway')} footway and ${count('marking')} marking polygons, ${crossings.length} zebra crossings; carriageways sized to the survey paint: ${grown.filter(g => g >= .05).length} widened, ${grown.filter(g => g <= -.05).length} narrowed, ${byRoad.size - grown.length} unmeasured; ${centrelines.length} ways graded`};
}

// The survey's footway paint does not match the ground (a wide band along the
// roads where there is a small kerb and grass), so inside the road area it
// takes the colour of the ground around it; mapped footways are drawn over it.
// Only colours change, so the stacked ground layers stay as they are.
export function clearFootwayPaint(v: Float32Array, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, {layers, is} = surveyLayers(v), {centre: [cx, cz], half} = roadArea(scene, city);
  const vergeColour = (x: number, z: number) => {
    const found: number[][] = [];
    for (const r of VERGE_SAMPLES) for (let k = 0; k < 8; k++) {
      const top = layers(x + ox + Math.cos(k * Math.PI / 4) * r, z + oz + Math.sin(k * Math.PI / 4) * r)[0];
      if (top && !is(top.i, ROAD) && !is(top.i, FOOTWAY) && !is(top.i, PAINT_MARKING)) found.push([v[top.i + 3], v[top.i + 4], v[top.i + 5]]);
    }
    return found.length ? [0, 1, 2].map(c => median(found.map(f => f[c]))) : null;
  };
  // Footway triangles can be large and cross the area's edge, so they are split
  // along it and only the part inside is recoloured. Pieces lie in their
  // triangle's plane and replace it in place, keeping heights, layers and the
  // survey's order.
  const band: Point2[][] = [[[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]]];
  const out: number[] = [];
  let repainted = 0, kept = 0;
  for (let i = 0; i < v.length; i += TRIANGLE) {
    const keep = () => { for (let k = 0; k < TRIANGLE; k++) out.push(v[i + k]); };
    if (v[i + 6] || !is(i, FOOTWAY)) { keep(); continue; }
    const tri = [0, 7, 14].map((k): Point2 => [v[i + k] - ox, v[i + k + 1] - oz]);
    const inside = intersection([tri], band), outside = difference([tri], band);
    const areaOf = (rings: Point2[][]) => rings.reduce((s, r) => s + Math.abs(ClipperLib.Clipper.Area(toPath(r))), 0) / SCALE / SCALE;
    // A hole dropped by the clip would break the area sum; such triangles stay whole.
    if (!inside.length || Math.abs(areaOf(inside) + areaOf(outside) - areaOf([tri])) > .01 * areaOf([tri]) + SLIVER) { keep(); continue; }
    const colour = vergeColour(...inside[0][0]);
    if (!colour) { keep(); kept++; continue; }
    const [a, b, c] = tri, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]), winding = Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    const vertex = ([x, z]: Point2, paint: number[] | null) => {
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d, w = [l1, l2, 1 - l1 - l2];
      const at = (k: number) => w.reduce((s, wj, j) => s + wj * v[i + j * 7 + k], 0);
      out.push(x + ox, z + oz, at(2), ...(paint ?? [at(3), at(4), at(5)]), 0);
    };
    for (const [rings, paint] of [[inside, colour], [outside, null]] as const) for (const ring of rings)
      for (const t of THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), [])) {
        const [p, q, r] = t.map(j => ring[j]), same = Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) === winding;
        for (const point of same ? [p, q, r] : [p, r, q]) vertex(point, paint);
      }
    repainted++;
  }
  return {vertices: Float32Array.from(out), report: `survey footway paint recoloured to the ground around it: ${repainted} triangles; ${kept} kept, with no other ground within ${VERGE_SAMPLES[VERGE_SAMPLES.length - 1]} m`};
}

// The square, in the local frame, within which roads are built.
export function roadArea(scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin, b = scene.buildings.find(b => b.id === PILOT.building)!;
  const cx = b.g.reduce((s, p) => s + p[0], 0) / b.g.length - ox, cz = b.g.reduce((s, p) => s + p[1], 0) / b.g.length - oz;
  const inside = ([x, z]: Point2, margin = 0) => Math.abs(x - cx) <= PILOT.half + margin && Math.abs(z - cz) <= PILOT.half + margin;
  return {centre: [cx, cz] as Point2, half: PILOT.half, inside};
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
export function layRoads(shapes: RoadShape[], buckets: Bucket[], city: CityDefinition, base: number, patches: Polygon[]) {
  const [ox, oz] = city.frame.origin, ground = groundIndex(buckets);
  const sites = area(patches.map(p => p.map(([x, z]): Point2 => [x - ox, z - oz])));
  // Surfaces are cut into cells: the viewer triangulates outlines only, and the
  // middle of a wide carriageway would otherwise sink below survey paint
  // sheets, which then shadow it.
  const surfaces: RoadSurface[] = shapes.flatMap(s => difference([s.ring], sites).flatMap(ring => s.kind === 'marking' ? [ring] : cells(ring)).map(ring => ({kind: s.kind, lift: 0, ring: densify(ring).map(([x, z]): [number, number, number] => [x, 0, z])})));
  const around = (x: number, z: number) => {
    let top = -Infinity, layer = 0;
    for (let dx = -REACH; dx <= REACH; dx += SAMPLE) for (let dz = -REACH; dz <= REACH; dz += SAMPLE) {
      if (dx * dx + dz * dz > REACH * REACH) continue;
      const g = ground(x + dx, z + dz);
      if (g) { top = Math.max(top, g.top); layer = Math.max(layer, g.layer); }
    }
    return top === -Infinity ? null : {top, layer};
  };
  for (const s of surfaces) {
    const found = s.ring.map(p => around(p[0] + ox, p[2] + oz));
    const heights = found.filter(g => g !== null).map(g => g!.top);
    if (!heights.length) continue;
    const fallback = heights.reduce((a, b) => a + b, 0) / heights.length, rise = s.kind === 'marking' ? SURFACE + MARKING : SURFACE;
    s.ring.forEach((p, i) => p[1] = round((found[i]?.top ?? fallback) - base + rise));
    s.lift = round(LAYER_LIFT * Math.max(0, ...found.map(g => g?.layer ?? 0)) + LIFT);
  }
  // Footways are clipped off the carriageway, but where they meet at the same
  // height the carriageway must win, so it takes any higher neighbour's lift.
  const carriageways = surfaces.filter(s => s.kind === 'carriageway'), footways = surfaces.filter(s => s.kind === 'footway');
  for (const c of carriageways) {
    const box = boxOf(c.ring, TOUCH), touching = footways.filter(f => f.ring.some(([x, , z]) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ));
    c.lift = round(Math.max(c.lift, ...touching.map(f => f.lift + ORDER_LIFT)));
  }
  // Markings lie on the carriageway as the viewer triangulates it: sampled from
  // the ground they would sink where its long triangles span a higher edge. A
  // marking lifted less than any carriageway it overlaps would be hidden there.
  const road = surfaceIndex(carriageways);
  for (const m of surfaces) if (m.kind === 'marking') {
    for (const p of m.ring) { const h = road.at(p[0], p[2]); if (h !== null) p[1] = round(h + MARKING); }
    m.lift = round(Math.max(m.lift, ...road.overlapping(boxOf(m.ring, 0)).map(c => c.lift)) + MARKING_LIFT);
  }
  return surfaces;
}

function surfaceIndex(surfaces: RoadSurface[]) {
  const triangles = surfaces.flatMap(s => triangulate(s.ring).map(t => t.map(i => s.ring[i])));
  const at = (x: number, z: number) => {
    let top: number | null = null;
    for (const [[x1, h1, z1], [x2, h2, z2], [x3, h3, z3]] of triangles) {
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-4) continue;
      top = Math.max(top ?? -Infinity, a * h1 + b * h2 + c * h3);
    }
    return top;
  };
  const overlapping = (box: ReturnType<typeof boxOf>) => surfaces.filter(s => { const b = boxOf(s.ring, 0); return b.minX <= box.maxX && b.maxX >= box.minX && b.minZ <= box.maxZ && b.maxZ >= box.minZ; });
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
// hole (a block ringed by road) would cut away the whole block.
function area(rings: Point2[][]): Point2[][] {
  const c = new ClipperLib.Clipper(), out: {X: number; Y: number}[][] = [];
  c.AddPaths(rings.map(toPath), ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out.filter(p => Math.abs(ClipperLib.Clipper.Area(p)) / SCALE / SCALE >= SLIVER).map(p => p.map((q): Point2 => [q.X / SCALE, q.Y / SCALE]));
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
  return (x: number, z: number) => {
    let top = -Infinity, layer = 0;
    for (const index of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const {p: [x1, z1, h1, x2, z2, h2, x3, z3, h3], layer: l} = triangles[index], d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-9) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) < -1e-6) continue;
      top = Math.max(top, a * h1 + b * h2 + c * h3);
      layer = Math.max(layer, l);
    }
    return top === -Infinity ? null : {top, layer};
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
