import * as THREE from 'three';

// Metres covered by one tile of each map; UVs divide by these.
export const tile = {sheet: 1.336, plank: 1.2, steel: 3, brick: {u: 2.2, v: .996}, concrete: 1.2};

type Shade = number | [number, number, number] | [number, number, number, number];

export const hash = (a: number, b: number) => {
  let v = Math.imul(a + 7919, b + 3719);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return (v >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);

export function noise(x: number, y: number, cellX: number, cellY: number, size: number) {
  const across = Math.round(size / cellX), down = Math.round(size / cellY), cx = Math.floor(x / cellX), cy = Math.floor(y / cellY);
  const fx = smooth(x / cellX - cx), fy = smooth(y / cellY - cy), at = (a: number, b: number) => hash((a + across) % across, (b + down) % down);
  return (at(cx, cy) * (1 - fx) + at(cx + 1, cy) * fx) * (1 - fy) + (at(cx, cy + 1) * (1 - fx) + at(cx + 1, cy + 1) * fx) * fy;
}

// DataTextures, because the data build has no canvas to draw on. These multiply the scheduled
// colours, so they stay near white: a mid-grey base darkens every door away from its schedule.
export function texture(size: number, shade: (x: number, y: number) => Shade, colour: boolean, height = size) {
  const data = new Uint8Array(size * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < size; x++) {
    const value = shade(x, y), [r, g, b, a = 255] = typeof value === 'number' ? [value, value, value] : value;
    data.set([r, g, b, a].map(v => Math.max(0, Math.min(255, Math.round(v)))), (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(data, size, height);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  if (colour) map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

// Eight waves per tile, about 167 mm each, the common pitch for these sheets; not measured here.
export const corrugatedSheet = () => texture(128, x => 214 + 38 * Math.sin(x / 128 * Math.PI * 16) + (hash(x >> 3, 3) - .5) * 12, true);

// The chevron comes from mirroring the UVs on the right leaf, so one direction is enough here.
export function plankBoards() {
  const size = 256, board = 28;
  return texture(size, (x, y) => {
    const along = (x + y) % size, row = Math.floor(along / board), gap = along % board < 2;
    return gap ? 110 : 232 + (hash(row, 11) - .5) * 30 + (hash((x - y + size) >> 1, row) - .5) * 20;
  }, true);
}

// Rows line up with door height because steel UVs come from model height: row 0 is the ground and
// door heads fall at 0.64-0.87 of the tile. Rust shifts hue, since a grey multiply only darkens.
export function weatheredSteel(amount: number) {
  const size = 256;
  return texture(size, (x, y) => {
    const t = y / size, base = 226 + noise(x, y, 32, 32, size) * 26 + (hash(x, y) - .5) * 6;
    const streak = Math.max(0, noise(x, 0, 8, 256, size) - .56) * 3.2, fall = t < .86 ? smooth(t / .86) : 1;
    const freckle = t < .22 ? smooth(Math.max(0, Math.min(1, (noise(x, y, 6, 6, size) - .58) / .2))) * (1 - t / .22) : 0;
    const f = Math.min(1, (streak * fall * .85 + freckle * .55 + noise(x, y, 16, 16, size) * .12) * amount);
    return [base * (1 - .22 * f), base * (1 - .5 * f), base * (1 - .62 * f)];
  }, true);
}

// Alpha runs out towards row 0, the bottom of the drip.
export function rustDrip() {
  const size = 64, height = 128;
  return texture(size, (x, y) => {
    const edge = Math.min(x, size - 1 - x) / (size / 2), streak = noise(x, 0, 5, 256, size);
    const alpha = Math.min(1, edge * 2.2) * (y / height) ** 1.4 * (.3 + streak * .9) * 190;
    return [112, 62, 40, alpha];
  }, true, height);
}
