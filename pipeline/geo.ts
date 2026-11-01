import type {CityDefinition, Point2, SceneData} from '../src/engine/types.ts';

export interface OsmExtract {
  buildings: {id: number; nodes: number[]; points: Point2[]}[];
  highways: {id: number; nodes: number[]; points: Point2[]; tags: Record<string, string>}[];
  entrances: {id: number; point: Point2; tags: Record<string, string>}[];
}

// WGS84 longitude/latitude to Estonian L-EST97 (EPSG:3301), the grid of the
// Maa- ja Ruumiamet survey data. Lambert conformal conic, two standard
// parallels, GRS80 ellipsoid (Snyder, Map Projections: A Working Manual, 15).
const A = 6378137, F = 1 / 298.257222101, E = Math.sqrt(2 * F - F * F);
const RAD = Math.PI / 180;
const LAT1 = (59 + 20 / 60) * RAD, LAT2 = 58 * RAD, LAT0 = 57.51755393055556 * RAD, LON0 = 24 * RAD;
const FALSE_EAST = 500000, FALSE_NORTH = 6375000;

const m = (lat: number) => Math.cos(lat) / Math.sqrt(1 - E * E * Math.sin(lat) ** 2);
const t = (lat: number) => Math.tan(Math.PI / 4 - lat / 2) / ((1 - E * Math.sin(lat)) / (1 + E * Math.sin(lat))) ** (E / 2);
const N = (Math.log(m(LAT1)) - Math.log(m(LAT2))) / (Math.log(t(LAT1)) - Math.log(t(LAT2)));
const AF = A * m(LAT1) / (N * t(LAT1) ** N), RHO0 = AF * t(LAT0) ** N;

export function lest97(lon: number, lat: number): [number, number] {
  const rho = AF * t(lat * RAD) ** N, theta = N * (lon * RAD - LON0);
  return [FALSE_EAST + rho * Math.sin(theta), FALSE_NORTH + RHO0 - rho * Math.cos(theta)];
}

// The inverse, for streets drawn in the studio: latitude by fixed-point iteration (Snyder 7-9).
export function lest97Inverse(east: number, north: number): [number, number] {
  const x = east - FALSE_EAST, y = RHO0 - (north - FALSE_NORTH), rho = Math.sign(N) * Math.hypot(x, y);
  const tt = (rho / AF) ** (1 / N), theta = Math.atan2(x, y);
  let lat = Math.PI / 2 - 2 * Math.atan(tt);
  for (let i = 0; i < 10; i++) lat = Math.PI / 2 - 2 * Math.atan(tt * ((1 - E * Math.sin(lat)) / (1 + E * Math.sin(lat))) ** (E / 2));
  return [(theta / N + LON0) / RAD, lat / RAD];
}

export function fitAffine(a: [number, number][], b: [number, number][]) {
  const n = a.length, mean = (p: [number, number][], k: number) => p.reduce((s, q) => s + q[k], 0) / n;
  const ax = mean(a, 0), az = mean(a, 1), bx = mean(b, 0), bz = mean(b, 1);
  let sxx = 0, sxz = 0, szz = 0, uxx = 0, uxz = 0, uzx = 0, uzz = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i][0] - ax, z = a[i][1] - az, u = b[i][0] - bx, w = b[i][1] - bz;
    sxx += x * x; sxz += x * z; szz += z * z;
    uxx += u * x; uxz += u * z; uzx += w * x; uzz += w * z;
  }
  const det = sxx * szz - sxz * sxz;
  const m0 = (uxx * szz - uxz * sxz) / det, m1 = (uxz * sxx - uxx * sxz) / det;
  const m3 = (uzx * szz - uzz * sxz) / det, m4 = (uzz * sxx - uzx * sxz) / det;
  const matrix = [m0, m1, bx - m0 * ax - m1 * az, m3, m4, bz - m3 * ax - m4 * az];
  const apply = (p: [number, number]): [number, number] => [matrix[0] * p[0] + matrix[1] * p[1] + matrix[2], matrix[3] * p[0] + matrix[4] * p[1] + matrix[5]];
  const rms = Math.sqrt(a.reduce((s, p, i) => { const q = apply(p); return s + (q[0] - b[i][0]) ** 2 + (q[1] - b[i][1]) ** 2; }, 0) / n);
  return {matrix, apply, rms};
}

export type Georeference = ReturnType<typeof georeference>;

export function georeference(osm: OsmExtract, scene: SceneData, city: CityDefinition) {
  const [ox, oz] = city.frame.origin;
  const outlines = new Map(osm.buildings.map(b => [String(b.id), b]));
  const sceneXZ: Point2[] = [], projected: Point2[] = [];
  for (const b of scene.buildings) {
    const points = outlines.get(b.id)?.points.slice(0, -1); // OSM rings repeat their first node
    if (!points || points.length !== b.g.length) continue;
    b.g.forEach((p, i) => { sceneXZ.push(p); projected.push(lest97(...points[i])); });
  }
  const toGrid = fitAffine(sceneXZ, projected), fromGrid = fitAffine(projected, sceneXZ);
  if (toGrid.rms > 1) throw new Error(`Survey does not match OpenStreetMap outlines (RMS ${toGrid.rms.toFixed(2)} m)`);
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    local: (lonLat: Point2): Point2 => { const [x, z] = fromGrid.apply(lest97(...lonLat)); return [round(x - ox), round(z - oz)]; },
    lonLat: (source: Point2): Point2 => lest97Inverse(...toGrid.apply(source)),
    geo: {crs: 'EPSG:3301', toGrid: toGrid.matrix.map(v => +v.toPrecision(12)), rms: round(toGrid.rms)},
  };
}
