import fs from 'node:fs';
import zlib from 'node:zlib';
import type {HeightAt} from '../src/engine/survey/drape.ts';
import type {Deck, Point2} from '../src/engine/types.ts';

export interface TracedWater {
  bodies: {level: number; replacesSurvey: boolean}[];
  at: (x: number, z: number) => number; // 1-based body at source x/z, 0 for none
}

export const NO_TRACED_WATER: TracedWater = {bodies: [], at: () => 0};

// Lakes traced from the orthophoto by fetch-water.ts; toGrid maps source x/z to EPSG:3301.
export function loadTracedWater(toGrid: number[]): TracedWater {
  const {west, north, width, height, bodies} = JSON.parse(fs.readFileSync('data/source/water-bodies.json', 'utf8'));
  const mask = zlib.gunzipSync(fs.readFileSync('data/source/water-bodies.bin.gz'));
  return {
    bodies,
    at(x, z) {
      const i = Math.floor(toGrid[0] * x + toGrid[1] * z + toGrid[2] - west), j = Math.floor(north - (toGrid[3] * x + toGrid[4] * z + toGrid[5]));
      return i >= 0 && j >= 0 && i < width && j < height ? mask[j * width + i] : 0;
    },
  };
}

// Height at source x/z of the deck there, else null.
export function deckAt(decks: Deck[], [ox, oz]: Point2): HeightAt {
  return (x, z) => {
    for (const {from: [ax, az], to: [bx, bz], half, height} of decks) {
      const dx = bx - ax, dz = bz - az, t = ((x - ox - ax) * dx + (z - oz - az) * dz) / (dx * dx + dz * dz);
      if (t >= 0 && t <= 1 && Math.abs((x - ox - ax) * dz - (z - oz - az) * dx) / Math.hypot(dx, dz) <= half) return height[0] + (height[1] - height[0]) * t;
    }
    return null;
  };
}
