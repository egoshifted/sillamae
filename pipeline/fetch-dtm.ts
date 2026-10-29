import fs from 'node:fs';
import zlib from 'node:zlib';
import {fromArrayBuffer} from 'geotiff';
import {georeference, type OsmExtract} from './geo.ts';
import {sillamae} from '../src/city/sillamae/index.ts';
import type {SceneData} from '../src/engine/types.ts';

const WCS = 'https://teenus.maaamet.ee/ows/wcs-dtm', TILE = 1000, MARGIN = 200; // metres
const NO_DATA = -32768;

const scene: SceneData = JSON.parse(fs.readFileSync('data/source/scene.json', 'utf8'));
const osm: OsmExtract = JSON.parse(fs.readFileSync('data/source/osm.json', 'utf8'));
const m = georeference(osm, scene, sillamae).geo.toGrid;
const corners = scene.buildings.flatMap(b => b.g).map(([x, z]) => [m[0] * x + m[1] * z + m[2], m[3] * x + m[4] * z + m[5]]);
const west = Math.floor(Math.min(...corners.map(c => c[0])) - MARGIN), east = Math.ceil(Math.max(...corners.map(c => c[0])) + MARGIN);
const south = Math.floor(Math.min(...corners.map(c => c[1])) - MARGIN), north = Math.ceil(Math.max(...corners.map(c => c[1])) + MARGIN);
const width = east - west, height = north - south;
const heights = new Int16Array(width * height).fill(NO_DATA);

for (let e = west; e < east; e += TILE) for (let n = south; n < north; n += TILE) {
  const w = Math.min(TILE, east - e), h = Math.min(TILE, north - n);
  const url = `${WCS}?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=dtm-1&CRS=EPSG:3301&BBOX=${e},${n},${e + w},${n + h}&RESX=1&RESY=1&FORMAT=GTiff`;
  const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const image = await (await fromArrayBuffer(await response.arrayBuffer())).getImage();
  if (image.getWidth() !== w || image.getHeight() !== h) throw new Error(`tile ${e},${n}: ${image.getWidth()}x${image.getHeight()}, expected ${w}x${h}`);
  const [raster] = await image.readRasters() as unknown as Float32Array[];
  const missing = image.getGDALNoData();
  // GeoTIFF rows run north to south; the grid stored here runs south to north.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const value = raster[y * w + x];
    if (value === missing || !Number.isFinite(value) || value < -100) continue;
    heights[(n - south + h - 1 - y) * width + (e - west + x)] = Math.round(value * 100);
  }
  console.log(`tile ${e},${n} ${w}x${h}`);
}

const header = {source: 'Maa- ja Ruumiamet DTM WCS dtm-1', crs: 'EPSG:3301', fetched: new Date().toISOString().slice(0, 10), west, south, width, height, cell: 1, unit: 'cm', noData: NO_DATA, rows: 'south to north'};
fs.writeFileSync('data/source/dtm-1m.json', JSON.stringify(header, null, 2) + '\n');
fs.writeFileSync('data/source/dtm-1m.bin.gz', zlib.gzipSync(Buffer.from(heights.buffer), {level: 9}));
const valid = heights.filter(v => v !== NO_DATA).length;
console.log(`${width}x${height} m, ${(valid / heights.length * 100).toFixed(1)} % with data, ${(fs.statSync('data/source/dtm-1m.bin.gz').size / 1048576).toFixed(1)} MB`);
