import type {Georeference, OsmExtract} from './geo.ts';
import type {Zone} from '../src/engine/data.ts';
import type {CityDefinition, Point2, SceneData} from '../src/engine/types.ts';

const STREETS: Record<string, number> = {
  trunk: 6, trunk_link: 4, primary: 5, primary_link: 4, secondary: 5, secondary_link: 4,
  tertiary: 4, tertiary_link: 3, unclassified: 3, residential: 3, living_street: 3, pedestrian: 3,
};
const CELL = 2, MARGIN = 60, BOUNDARY = 1.5; // metres

// Raster rather than polygon faces: OSM streets often cross without a shared node.
export function buildZones(osm: OsmExtract, scene: SceneData, city: CityDefinition, {local}: Georeference) {
  const [ox, oz] = city.frame.origin;
  const footprints = scene.buildings.map(b => b.g.map(([x, z]): Point2 => [x - ox, z - oz]));
  const all = footprints.flat();
  const x0 = Math.min(...all.map(p => p[0])) - MARGIN, z0 = Math.min(...all.map(p => p[1])) - MARGIN;
  const width = Math.ceil((Math.max(...all.map(p => p[0])) + MARGIN - x0) / CELL);
  const height = Math.ceil((Math.max(...all.map(p => p[1])) + MARGIN - z0) / CELL);
  const ROAD = -1, label = new Int32Array(width * height);

  for (const way of osm.highways) {
    const radius = STREETS[way.tags.highway];
    if (!radius || way.tags.area === 'yes') continue;
    const points = way.points.map(p => local(p));
    for (let i = 1; i < points.length; i++) drawSegment(points[i - 1], points[i], radius);
  }
  const edge = scene.boundary.map(([x, z]): Point2 => [x - ox, z - oz]);
  edge.forEach((p, i) => drawSegment(p, edge[(i + 1) % edge.length], BOUNDARY));

  const open: boolean[] = [false], size: number[] = [0];
  for (let start = 0; start < label.length; start++) {
    if (label[start]) continue;
    const area = open.length, stack = [start];
    open.push(false);
    size.push(0);
    label[start] = area;
    while (stack.length) {
      const c = stack.pop()!, cx = c % width, cz = (c - cx) / width;
      size[area]++;
      if (cx === 0 || cz === 0 || cx === width - 1 || cz === height - 1) open[area] = true;
      for (const n of [cx > 0 ? c - 1 : -1, cx < width - 1 ? c + 1 : -1, cz > 0 ? c - width : -1, cz < height - 1 ? c + width : -1]) {
        if (n >= 0 && !label[n]) { label[n] = area; stack.push(n); }
      }
    }
  }

  const members = new Map<number, number[]>();
  footprints.forEach((outline, i) => {
    const area = areaNear(centroid(outline));
    if (!members.has(area)) members.set(area, []);
    members.get(area)!.push(i);
  });
  const zones: Zone[] = [];
  const ordered = [...members.entries()].sort(([a], [b]) => Number(open[a]) - Number(open[b]) || a - b);
  for (const [area, list] of ordered) {
    const id = zones.length;
    for (const i of list) scene.buildings[i].zone = id;
    const centres = list.map(i => centroid(footprints[i]));
    zones.push({
      id, kind: open[area] ? 'outskirts' : 'block', buildings: list.map(i => scene.buildings[i].id),
      centre: centroid(centres).map(v => Math.round(v * 10) / 10) as Point2, area: size[area] * CELL * CELL,
    });
  }
  const blocks = zones.filter(z => z.kind === 'block');
  const report = `zones ${zones.length}: ${blocks.length} blocks holding ${blocks.reduce((s, z) => s + z.buildings.length, 0)} buildings, ` +
    `${zones.length - blocks.length} outskirts holding ${zones.filter(z => z.kind !== 'block').reduce((s, z) => s + z.buildings.length, 0)}`;
  return {zones, report};

  function drawSegment(a: Point2, b: Point2, radius: number) {
    const minX = Math.max(0, Math.floor((Math.min(a[0], b[0]) - radius - x0) / CELL)), maxX = Math.min(width - 1, Math.ceil((Math.max(a[0], b[0]) + radius - x0) / CELL));
    const minZ = Math.max(0, Math.floor((Math.min(a[1], b[1]) - radius - z0) / CELL)), maxZ = Math.min(height - 1, Math.ceil((Math.max(a[1], b[1]) + radius - z0) / CELL));
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    for (let cz = minZ; cz <= maxZ; cz++) for (let cx = minX; cx <= maxX; cx++) {
      const px = x0 + (cx + .5) * CELL, pz = z0 + (cz + .5) * CELL;
      const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)) : 0;
      if (Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t) <= radius) label[cz * width + cx] = ROAD;
    }
  }

  function areaNear([x, z]: Point2) {
    const cx = Math.floor((x - x0) / CELL), cz = Math.floor((z - z0) / CELL);
    for (let r = 0; r < 20; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      const area = label[nz * width + nx];
      if (area > 0) return area;
    }
    throw new Error(`No block near ${x}, ${z}`);
  }
}

function centroid(points: Point2[]): Point2 {
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
}
