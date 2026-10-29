import type {Georeference, OsmExtract} from './geo.ts';
import type {NavData} from '../src/engine/data.ts';
import type {CityDefinition, Point2, SceneData} from '../src/engine/types.ts';

const NOT_WALKABLE = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'proposed', 'construction', 'raceway', 'bus_guideway']);

export function buildNav(osm: OsmExtract, scene: SceneData, city: CityDefinition, {local}: Georeference) {
  const [ox, oz] = city.frame.origin;
  const outlines = new Map(osm.buildings.map(b => [String(b.id), b]));

  const kinds: string[] = [], kind = (k: string) => kinds.includes(k) ? kinds.indexOf(k) : kinds.push(k) - 1;
  const nodes: Point2[] = [], index = new Map<number, number>(), edges: [number, number, number][] = [];
  const node = (osmId: number, lonLat: Point2) => {
    let i = index.get(osmId);
    if (i === undefined) { index.set(osmId, i = nodes.length); nodes.push(local(lonLat)); }
    return i;
  };
  for (const way of osm.highways) {
    const t = way.tags;
    if (NOT_WALKABLE.has(t.highway) || t.foot === 'no' || t.access === 'no' || t.access === 'private') continue;
    const k = kind(t.highway);
    for (let i = 1; i < way.nodes.length; i++) edges.push([node(way.nodes[i - 1], way.points[i - 1]), node(way.nodes[i], way.points[i]), k]);
  }

  const overrides = new Map(city.overrides.map(o => [o.id, o]));
  const osmDoors = new Map(osm.entrances.map(e => [e.id, e]));
  const entrances: NavData['entrances'] = [];
  const link = kind('entrance');
  for (const b of scene.buildings) {
    const footprint = b.g.map(([x, z]): Point2 => [x - ox, z - oz]);
    let doors: Point2[] = [], source: 'model' | 'osm' | 'estimated' = 'model';
    const modelled = overrides.get(b.id)?.entrances?.(b);
    if (modelled) doors = modelled.map(([x, z]) => [x - ox, z - oz]);
    else {
      doors = (outlines.get(b.id)?.nodes ?? []).flatMap(id => osmDoors.has(id) ? [local(osmDoors.get(id)!.point)] : []);
      source = 'osm';
    }
    if (!doors.length) {
      const near = nearestOnEdges(nodes, edges, centroid(footprint), link);
      if (!near) continue;
      doors = [nearestOnOutline(footprint, near.point)];
      source = 'estimated';
    }
    for (const door of doors) {
      const near = nearestOnEdges(nodes, edges, door, link);
      if (!near) continue;
      const at = splitEdge(nodes, edges, near), d = nodes.push(door.map(round) as Point2) - 1;
      edges.push([d, at, link]);
      entrances.push({building: b.id, node: d, source});
    }
  }
  const nav: NavData = {kinds, nodes, edges: edges.map(([a, b, k]) => [a, b, round(dist(nodes[a], nodes[b])), k]), entrances};
  return {nav, report: summary(nav)};
}

const round = (v: number) => Math.round(v * 100) / 100;
const dist = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const centroid = (p: Point2[]): Point2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

function closestOnSegment(a: Point2, b: Point2, p: Point2) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return {t, point: [a[0] + dx * t, a[1] + dz * t] as Point2};
}

function nearestOnEdges(nodes: Point2[], edges: [number, number, number][], p: Point2, link: number) {
  let best: {edge: number; t: number; point: Point2; distance: number} | null = null;
  edges.forEach(([a, b, k], edge) => {
    if (k === link) return;
    const c = closestOnSegment(nodes[a], nodes[b], p), distance = dist(c.point, p);
    if (!best || distance < best.distance) best = {edge, ...c, distance};
  });
  return best as {edge: number; t: number; point: Point2; distance: number} | null;
}

function nearestOnOutline(outline: Point2[], p: Point2) {
  let best = outline[0], distance = Infinity;
  outline.forEach((a, i) => {
    const c = closestOnSegment(a, outline[(i + 1) % outline.length], p).point;
    if (dist(c, p) < distance) { distance = dist(c, p); best = c; }
  });
  return best;
}

function splitEdge(nodes: Point2[], edges: [number, number, number][], near: {edge: number; t: number; point: Point2}) {
  const [a, b, k] = edges[near.edge];
  if (near.t < 1e-6) return a;
  if (near.t > 1 - 1e-6) return b;
  const p = nodes.push(near.point.map(round) as Point2) - 1;
  edges[near.edge] = [a, p, k];
  edges.push([p, b, k]);
  return p;
}

function summary(nav: NavData) {
  const parent = nav.nodes.map((_, i) => i), find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const [a, b] of nav.edges) parent[find(a)] = find(b);
  const sizes = new Map<number, number>();
  nav.nodes.forEach((_, i) => sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1));
  const largest = Math.max(...sizes.values()), bySource = (s: string) => nav.entrances.filter(e => e.source === s).length;
  const km = nav.edges.reduce((s, e) => s + e[2], 0) / 1000;
  return `nav ${nav.nodes.length} nodes, ${nav.edges.length} edges, ${km.toFixed(1)} km, largest component ${(largest / nav.nodes.length * 100).toFixed(1)} %; ` +
    `entrances ${nav.entrances.length} (model ${bySource('model')}, osm ${bySource('osm')}, estimated ${bySource('estimated')})`;
}
