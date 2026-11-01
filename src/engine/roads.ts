import * as THREE from 'three';
import type {Finish, RoadKind, RoadSurface} from './data.ts';

const LOOK: Record<Exclude<RoadKind, 'footway'>, [string, number]> = {carriageway: ['#5f625f', .95], marking: ['#e4e4dc', .8]};
// Footway finishes, matched to Street View on Kesk: worn asphalt a little
// lighter and warmer than the carriageway, with darker patched repairs.
// tile is the ground size of one texture repeat, in metres.
const FINISH: Record<Finish, {tile: number; roughness: number; paint: (x: CanvasRenderingContext2D, rng: () => number) => void}> = {
  asphalt: {tile: 6, roughness: .97, paint: asphalt},
  paving: {tile: 1, roughness: .9, paint: paving},
  gravel: {tile: 2, roughness: 1, paint: gravel},
};

export function addRoads(scene: THREE.Scene, surfaces: RoadSurface[], anisotropy = 1) {
  const group = new THREE.Group();
  group.name = 'roads';
  const add = (own: RoadSurface[], material: THREE.MeshStandardMaterial, tile?: number) => {
    if (!own.length) return;
    const mesh = new THREE.Mesh(surfaceGeometry(own, tile), material);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const kind of Object.keys(LOOK) as (keyof typeof LOOK)[]) add(surfaces.filter(s => s.kind === kind), lifted(...LOOK[kind]));
  for (const [finish, {tile, roughness, paint}] of Object.entries(FINISH) as [Finish, typeof FINISH[Finish]][]) {
    const material = lifted('#ffffff', roughness);
    material.map = finishTexture(paint, anisotropy);
    add(surfaces.filter(s => s.kind === 'footway' && (s.surface ?? 'asphalt') === finish), material, tile);
  }
  scene.add(group);
  return group;
}

function lifted(color: string, roughness: number) {
  const material = new THREE.MeshStandardMaterial({color, roughness});
  material.userData.groundSurface = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float lift;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * lift;');
  };
  material.customProgramCacheKey = () => 'road-lift';
  return material;
}

// The data build lays markings on these same triangles. Rings carry collinear
// points (edges are split so heights follow the ground), and a triangle joining
// three of them covers no ground: where their heights differ it stands up as a wall.
export const triangulate = (ring: RoadSurface['ring']) => THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[2])), [])
  .filter(([a, b, c]) => Math.abs((ring[b][0] - ring[a][0]) * (ring[c][2] - ring[a][2]) - (ring[b][2] - ring[a][2]) * (ring[c][0] - ring[a][0])) / 2 >= FLAT);
const FLAT = 1e-3; // square metres of ground a triangle must cover

// Texture coordinates are ground metres over the tile, so finishes run on across polygon edges.
function surfaceGeometry(surfaces: RoadSurface[], tile?: number) {
  const position: number[] = [], lift: number[] = [], uv: number[] = [];
  for (const {ring, lift: l} of surfaces) {
    for (const t of triangulate(ring)) {
      const [a, b, c] = t.map(i => ring[i]);
      // Upward faces wind clockwise in (x, z).
      const up = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0;
      for (const p of up ? [a, b, c] : [a, c, b]) { position.push(...p); lift.push(l); if (tile) uv.push(p[0] / tile, p[2] / tile); }
    }
  }
  // Outline-only triangulation leaves long slivers; facet normals would shade their slight tilts as streaks.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: position.length / 3}, () => [0, 1, 0]).flat(), 3));
  g.setAttribute('lift', new THREE.Float32BufferAttribute(lift, 1));
  if (tile) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const SIZE = 512;

function finishTexture(paint: typeof FINISH[Finish]['paint'], anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  paint(canvas.getContext('2d')!, rng);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);
  return texture;
}

// Draws soft blobs wrapped at the tile edges, so repeats join without seams.
function blob(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colour: string, alpha: number) {
  x.globalAlpha = alpha;
  x.fillStyle = colour;
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
    x.beginPath();
    x.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
}

function speckle(x: CanvasRenderingContext2D, rng: () => number, count: number, base: number, spread: number, size: number, alpha: number) {
  x.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const n = base + (rng() - .5) * spread;
    x.fillStyle = `rgb(${n},${n},${n - 3})`;
    x.fillRect(rng() * SIZE, rng() * SIZE, size * (.5 + rng()), size * (.5 + rng()));
  }
  x.globalAlpha = 1;
}

function asphalt(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#696966';
  x.fillRect(0, 0, SIZE, SIZE);
  // Weathering is broad and faint; repairs are darker, cut roughly square, with ragged edges.
  for (let i = 0; i < 10; i++) blob(x, rng() * SIZE, rng() * SIZE, 30 + rng() * 70, 20 + rng() * 50, '#74736e', .06 + rng() * .06);
  for (let i = 0; i < 3; i++) patch(x, rng, rng() * SIZE, rng() * SIZE, 40 + rng() * 90, 30 + rng() * 70);
  speckle(x, rng, 60000, 106, 50, 1.3, .3);
  speckle(x, rng, 2500, 135, 30, 1.6, .35);
}

function patch(x: CanvasRenderingContext2D, rng: () => number, cx: number, cy: number, w: number, h: number) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy], i, all) => {
    const [nx, ny] = all[(i + 1) % 4];
    // Each side wanders a little between its corners.
    return [0, .33, .66].map(t => [(sx + (nx - sx) * t) * w / 2 + (rng() - .5) * 8, (sy + (ny - sy) * t) * h / 2 + (rng() - .5) * 8]);
  });
  x.globalAlpha = .16 + rng() * .1;
  x.fillStyle = '#55554f';
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
    x.beginPath();
    corners.forEach(([px, py], i) => i ? x.lineTo(cx + dx + px, cy + dy + py) : x.moveTo(cx + dx + px, cy + dy + py));
    x.fill();
  }
  x.globalAlpha = 1;
}

// Concrete blocks 20 by 10 cm in running bond.
function paving(x: CanvasRenderingContext2D, rng: () => number) {
  const w = SIZE / 5, h = SIZE / 10;
  x.fillStyle = '#7d7b75';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let row = 0; row < 10; row++) for (let col = -1; col < 5; col++) {
    const shade = 140 + (rng() - .5) * 22;
    x.fillStyle = `rgb(${shade},${shade - 1},${shade - 5})`;
    x.fillRect(col * w + (row % 2) * w / 2 + 2, row * h + 2, w - 4, h - 4);
  }
  speckle(x, rng, 20000, 140, 50, 1.2, .25);
}

function gravel(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#b1a78f';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 40000; i++) {
    const n = (rng() - .5) * 70;
    x.globalAlpha = .45;
    x.fillStyle = `rgb(${181 + n},${171 + n},${147 + n})`;
    x.fillRect(rng() * SIZE, rng() * SIZE, 1 + rng() * 2.5, 1 + rng() * 2.5);
  }
  x.globalAlpha = 1;
}
