import * as THREE from 'three';
import type {RoadSurface} from '../data.ts';
import type {Building, TerrainGrid, Tree, WorldFrame} from '../types.ts';

const CELL = 2, MARGIN = 60, TENDED = 34; // metres; grass is kept short this far from a wall
const WALL_SHADE = 1, COVER_BLUR = 12, CONTACT_BLUR = 2.6, NEAR_BLUR = 7, FAR_BLUR = 16, HOLLOW_BLUR = 8, WEAR_BLUR = 3, EDGE_BLUR = 1; // metres
const HOLLOWS = [[3, .24], [9, .1]]; // grid cells around each point; shade per metre below their mean
const MOST_HOLLOW = .5;
const UNPAVED = new Set(['worn-grass', 'grass', 'flowerbed']);
// Each blur spreads a footprint's shade, so where walls meet or face each other the shares add
// up, and an inner corner or courtyard comes out darker than an outer corner.
export const shadeShares = (height: number) => ({near: .5 * Math.min(1, height / 12), far: .4 * Math.min(1, Math.max(0, height - 8) / 22)});

// Share of the sky a point loses to the land around it, from the terrain model's heights in
// decimetres. Sea cells stay clear: they would otherwise read as the deepest hollows of all.
export function terrainHollows({width, height, values}: Pick<TerrainGrid, 'width' | 'height' | 'values'>) {
  const totals = new Float64Array((width + 1) * (height + 1)), row = width + 1;
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++)
    totals[(j + 1) * row + i + 1] = values[j * width + i] / 10 + totals[j * row + i + 1] + totals[(j + 1) * row + i] - totals[j * row + i];
  const shade = new Float32Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const h = values[j * width + i] / 10;
    if (h <= 0) continue;
    for (const [reach, share] of HOLLOWS) {
      const x0 = Math.max(0, i - reach), x1 = Math.min(width, i + reach + 1), z0 = Math.max(0, j - reach), z1 = Math.min(height, j + reach + 1);
      const mean = (totals[z1 * row + x1] - totals[z0 * row + x1] - totals[z1 * row + x0] + totals[z0 * row + x0]) / ((x1 - x0) * (z1 - z0));
      shade[j * width + i] += Math.max(0, mean - h) * share;
    }
    shade[j * width + i] = Math.min(MOST_HOLLOW, shade[j * width + i]);
  }
  return shade;
}

const placeholder = new THREE.DataTexture(new Uint8Array(4), 1, 1);
placeholder.needsUpdate = true;
const noBlades = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
noBlades.needsUpdate = true;

// Shared uniforms: refined sites draw their restored ground with their own material, and
// must agree with the survey beside them. Without a town (the studio) nothing is covered.
export const groundCover = {map: {value: placeholder as THREE.Texture}, area: {value: new THREE.Vector4(0, 0, 1, 1)}, blades: {value: noBlades as THREE.Texture}, verge: {value: placeholder as THREE.Texture}};

export const BLADE_TILE = 2.6; // metres
const BLADE_SIZE = 512;

// The shader reads this as a change from .5, so a mipmapped distant read must average exactly
// that, or the grass would brighten or darken as the blades fade out with zoom.
export function centreBlades(data: Uint8ClampedArray) {
  for (const channel of [0, 1]) {
    let sum = 0;
    for (let i = channel; i < data.length; i += 4) sum += data[i];
    const shift = 128 - sum / (data.length / 4);
    for (let i = channel; i < data.length; i += 4) data[i] += shift;
  }
}

// Red: how lit a blade is, dark gaps first and pale tips on top. Green: dead, dry blades.
// Painted strokes keep hard, thin edges; value noise at this scale only ever reads as a blur.
function paintBlades() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BLADE_SIZE;
  const paint = canvas.getContext('2d')!;
  paint.fillStyle = 'rgb(60,110,128)';
  paint.fillRect(0, 0, BLADE_SIZE, BLADE_SIZE);
  let seed = 4099;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const blade = (x: number, y: number, angle: number, length: number, width: number, bend: number) => {
    const dx = Math.cos(angle), dy = Math.sin(angle), mx = x + dx * length * .55 - dy * bend, my = y + dy * length * .55 + dx * bend;
    paint.beginPath();
    paint.moveTo(x - dy * width, y + dx * width);
    paint.quadraticCurveTo(mx, my, x + dx * length, y + dy * length);
    paint.quadraticCurveTo(mx, my, x + dy * width, y - dx * width);
    paint.fill();
  };
  for (const [count, low, high] of [[5200, 30, 105], [3400, 110, 185], [1500, 185, 250]]) for (let i = 0; i < count; i++) {
    const x = random() * BLADE_SIZE, y = random() * BLADE_SIZE, angle = random() * Math.PI * 2, length = 16 + random() * 24, width = 1 + random() * 1.3, bend = (random() - .5) * length * .5;
    paint.fillStyle = `rgb(${low + random() * (high - low) | 0},${random() < .14 ? 225 : 90 + random() * 60 | 0},128)`;
    // A stroke crossing the tile's edge carries on from the opposite one, or the seams would show.
    for (const ox of x < 42 ? [0, BLADE_SIZE] : x > BLADE_SIZE - 42 ? [0, -BLADE_SIZE] : [0]) for (const oy of y < 42 ? [0, BLADE_SIZE] : y > BLADE_SIZE - 42 ? [0, -BLADE_SIZE] : [0]) blade(x + ox, y + oy, angle, length, width, bend);
  }
  const image = paint.getImageData(0, 0, BLADE_SIZE, BLADE_SIZE);
  centreBlades(image.data);
  paint.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Red: ground worn beside a road. Green: the dark line where grass meets it. The roads are
// cut back out, so neither runs under a surface the grass could show through at its edges.
function paintVerge(roads: RoadSurface[], width: number, height: number, toX: (x: number) => number, toZ: (z: number) => number) {
  const mask = document.createElement('canvas'), canvas = document.createElement('canvas');
  mask.width = canvas.width = width;
  mask.height = canvas.height = height;
  const shape = mask.getContext('2d')!, paint = canvas.getContext('2d')!;
  // One path per ring: rings wind both ways, and a shared path would cancel where they overlap.
  for (const {ring, kind, surface, groundColour} of roads) {
    if (kind === 'marking' || groundColour || UNPAVED.has(surface ?? '')) continue;
    shape.beginPath();
    ring.forEach(p => shape.lineTo(toX(p[0]), toZ(p[2])));
    shape.closePath();
    shape.fill();
  }
  const tinted = (colour: string) => {
    const part = document.createElement('canvas'), x = part.getContext('2d')!;
    part.width = width;
    part.height = height;
    x.drawImage(mask, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = colour;
    x.fillRect(0, 0, width, height);
    return part;
  };
  paint.fillRect(0, 0, width, height);
  paint.globalCompositeOperation = 'lighter';
  paint.filter = `blur(${WEAR_BLUR / CELL}px)`;
  paint.drawImage(tinted('rgb(255,0,0)'), 0, 0);
  paint.filter = `blur(${EDGE_BLUR / CELL}px)`;
  paint.drawImage(tinted('rgb(0,255,0)'), 0, 0);
  paint.filter = 'none';
  paint.globalCompositeOperation = 'source-over';
  paint.drawImage(tinted('rgb(0,0,0)'), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

// Red: the ground under trees. Green: tended ground around buildings. Blue: ground the sky
// barely reaches, against walls, at the foot of trees and in the land's hollows. Baked, it costs
// a texture read where a screen-space pass would draw the town a second time on every redraw.
export function paintGroundCover(trees: Tree[], buildings: Building[], {origin: [ox, oz]}: WorldFrame, terrain: TerrainGrid, roads: RoadSurface[]) {
  const xs = [...trees.map(t => t.p[0]), ...buildings.flatMap(b => b.g.map(p => p[0]))], zs = [...trees.map(t => t.p[1]), ...buildings.flatMap(b => b.g.map(p => p[1]))];
  const minX = Math.min(...xs) - MARGIN, minZ = Math.min(...zs) - MARGIN, width = Math.max(...xs) + MARGIN - minX, depth = Math.max(...zs) + MARGIN - minZ;
  const sharp = document.createElement('canvas'), canvas = document.createElement('canvas');
  sharp.width = canvas.width = Math.ceil(width / CELL);
  sharp.height = canvas.height = Math.ceil(depth / CELL);
  const paint = sharp.getContext('2d')!;
  paint.fillRect(0, 0, sharp.width, sharp.height);
  paint.globalCompositeOperation = 'lighter';
  paint.fillStyle = 'rgb(170,0,0)';
  for (const t of trees) {
    paint.beginPath();
    paint.arc((t.p[0] - minX) / CELL, (t.p[1] - minZ) / CELL, Math.max(1, t.r * 1.2 / CELL), 0, Math.PI * 2);
    paint.fill();
  }
  paint.fillStyle = paint.strokeStyle = 'rgb(0,255,0)';
  paint.lineWidth = TENDED * 2 / CELL;
  paint.lineJoin = 'round';
  for (const b of buildings) {
    paint.beginPath();
    b.g.forEach(([x, z]) => paint.lineTo((x - minX) / CELL, (z - minZ) / CELL));
    paint.closePath();
    paint.fill();
    paint.stroke();
  }
  const soft = canvas.getContext('2d')!;
  soft.filter = `blur(${COVER_BLUR / CELL}px)`;
  soft.drawImage(sharp, 0, 0);
  soft.globalCompositeOperation = 'lighter';
  const outline = (x: CanvasRenderingContext2D, b: Building) => {
    x.beginPath();
    b.g.forEach(([px, pz]) => x.lineTo((px - minX) / CELL, (pz - minZ) / CELL));
    x.closePath();
  };
  const layer = (blur: number, draw: (x: CanvasRenderingContext2D) => void) => {
    const part = document.createElement('canvas'), x = part.getContext('2d')!;
    part.width = canvas.width;
    part.height = canvas.height;
    draw(x);
    soft.filter = `blur(${blur / CELL}px)`;
    soft.drawImage(part, 0, 0);
  };
  const shares = buildings.map(b => ({b, ...shadeShares(b.heightRange ? b.heightRange[1] - b.heightRange[0] : b.h)}));
  layer(CONTACT_BLUR, x => {
    x.fillStyle = x.strokeStyle = 'rgba(0,0,255,.6)';
    x.lineWidth = WALL_SHADE * 2 / CELL;
    x.lineJoin = 'round';
    for (const {b} of shares) { outline(x, b); x.fill(); x.stroke(); }
    x.fillStyle = 'rgba(0,0,255,.47)';
    for (const t of trees) {
      x.beginPath();
      x.arc((t.p[0] - minX) / CELL, (t.p[1] - minZ) / CELL, Math.max(1, t.r * .45 / CELL), 0, Math.PI * 2);
      x.fill();
    }
  });
  for (const [blur, share] of [[NEAR_BLUR, 'near'], [FAR_BLUR, 'far']] as const) layer(blur, x => {
    for (const entry of shares) {
      x.fillStyle = `rgba(0,0,255,${entry[share]})`;
      outline(x, entry.b);
      x.fill();
    }
  });
  const hollows = terrainHollows(terrain), relief = document.createElement('canvas');
  relief.width = terrain.width;
  relief.height = terrain.height;
  const image = new ImageData(terrain.width, terrain.height);
  hollows.forEach((shade, k) => { image.data[k * 4 + 2] = 255; image.data[k * 4 + 3] = shade * 255; });
  relief.getContext('2d')!.putImageData(image, 0, 0);
  soft.filter = `blur(${HOLLOW_BLUR / CELL}px)`;
  // Each grid value belongs to a point, and a pixel is stretched around its centre.
  soft.drawImage(relief, (terrain.origin[0] - terrain.step / 2 - minX) / CELL, (terrain.origin[1] - terrain.step / 2 - minZ) / CELL, terrain.width * terrain.step / CELL, terrain.height * terrain.step / CELL);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  groundCover.map.value = texture;
  groundCover.blades.value = paintBlades();
  // Road rings are local; everything else here is in source coordinates.
  groundCover.verge.value = paintVerge(roads, canvas.width, canvas.height, x => (x + ox - minX) / CELL, z => (z + oz - minZ) / CELL);
  groundCover.area.value.set(minX - ox, minZ - oz, 1 / (canvas.width * CELL), 1 / (canvas.height * CELL));
}
