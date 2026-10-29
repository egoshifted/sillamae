import fs from 'node:fs';
import zlib from 'node:zlib';
import type {HeightAt} from '../src/engine/survey/drape.ts';

interface Header {
  west: number;
  south: number;
  width: number;
  height: number;
  noData: number;
}

// Bilinear 1 m terrain model sampled at survey x/z; toGrid maps those to EPSG:3301.
export function loadDtm(toGrid: number[]): HeightAt {
  const header: Header = JSON.parse(fs.readFileSync('data/source/dtm-1m.json', 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync('data/source/dtm-1m.bin.gz'));
  const cm = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), {west, south, width, height, noData} = header;
  return (x, z) => {
    const e = toGrid[0] * x + toGrid[1] * z + toGrid[2] - west, n = toGrid[3] * x + toGrid[4] * z + toGrid[5] - south;
    const i = Math.floor(e), j = Math.floor(n);
    if (i < 0 || j < 0 || i >= width - 1 || j >= height - 1) return null;
    const k = j * width + i, h = [cm[k], cm[k + 1], cm[k + width], cm[k + width + 1]];
    if (h.includes(noData)) return null;
    const u = e - i, v = n - j;
    return (h[0] * (1 - u) * (1 - v) + h[1] * u * (1 - v) + h[2] * (1 - u) * v + h[3] * u * v) / 100;
  };
}
