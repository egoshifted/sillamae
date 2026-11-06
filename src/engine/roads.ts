import {pathCoordinates} from './streets.ts';
import * as THREE from 'three';
import {roadKerbs} from './road-kerbs.ts';
import {lineMeshes} from './lines.ts';
import type {Finish, RoadKind, RoadSurface} from './data.ts';
import type {RoadCut} from './types.ts';
import {demolishRoads} from './road-demolition.ts';
import {GROUND_CONTACT, groundUniforms, restoredGroundMaterial} from './survey/layer.ts';

const LOOK: Record<Exclude<RoadKind, 'footway'>, [string, number]> = {carriageway: ['#5f625f', .95], marking: ['#e4e4dc', .8]};
// Footway finishes, matched to Street View on Kesk: worn asphalt a little
// lighter and warmer than the carriageway, with darker patched repairs.
// tile is the ground size of one texture repeat, in metres.
const FINISH: Record<Finish, {tile: number; roughness: number; paint: (x: CanvasRenderingContext2D, rng: () => number) => void}> = {
  'worn-paving': {tile: 2, roughness: 1, paint: wornPaving},
  asphalt: {tile: 6, roughness: .97, paint: asphalt},
  paving: {tile: 1, roughness: .9, paint: paving},
  gravel: {tile: 2, roughness: 1, paint: gravel},
  grass: {tile: 3, roughness: 1, paint: lawn},
  flowerbed: {tile: 2, roughness: 1, paint: flowerbed},
  'worn-grass': {tile: 2, roughness: 1, paint: wornGrass},
};

// kerbsFrom, when given, are the surfaces kerbs follow instead of the drawn ones: the
// studio drapes paths into overlapping fragments that cannot carry one continuous kerb.
export function addRoads(scene: THREE.Scene, surfaces: RoadSurface[], anisotropy = 1, cuts: RoadCut[] = [], context: RoadSurface[] = [], kerbsFrom?: RoadSurface[]) {
  surfaces = demolishRoads(surfaces, cuts);
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
    const own = surfaces.filter(s => !s.groundColour && s.kind === 'footway' && (s.surface ?? 'asphalt') === finish);
    if (!own.length) continue;
    const material = lifted('#ffffff', roughness);
    material.map = finishTexture(paint, anisotropy);
    add(own, material, tile);
  }
  const restored = surfaces.filter(s => s.groundColour);
  if (restored.length) add(restored, restoredGroundMaterial(anisotropy), 2);
  const kerbs = roadKerbs(kerbsFrom ? demolishRoads(kerbsFrom, cuts) : surfaces, demolishRoads(context, cuts));
  for (const lift of new Set(kerbs.map(k => k.lift))) group.add(lineMeshes(kerbs.filter(k => k.lift === lift), {lifted: lift > 0, depthLift: lift + .03}));
  scene.add(group);
  return group;
}

function lifted(color: string, roughness: number) {
  const material = new THREE.MeshStandardMaterial({color, roughness});
  material.userData.groundSurface = true;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, groundUniforms);
    shader.vertexShader = 'attribute float lift;\nvarying vec2 vRoad;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = position.xz;').replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * lift;');
    // Dark, neutral asphalt shows nothing but the sky's own colour in shade, which reads as navy paint.
    const neutralShade = 'reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vec3(dot(reflectedLight.indirectDiffuse, vec3(.2126, .7152, .0722))), .7);\n';
    shader.fragmentShader = 'uniform sampler2D groundCover;\nuniform vec4 groundCoverArea;\nvarying vec2 vRoad;\n' + shader.fragmentShader.replace('#include <aomap_fragment>', 'float groundContact = texture2D(groundCover, (vRoad - groundCoverArea.xy) * groundCoverArea.zw).b;\n' + GROUND_CONTACT + neutralShade + '#include <aomap_fragment>');
  };
  material.customProgramCacheKey = () => 'road-lift-contact-neutral';
  return material;
}

// The data build lays markings on these same triangles. Rings carry collinear
// points (edges are split so heights follow the ground), and a triangle joining
// three of them covers no ground: where their heights differ it stands up as a wall.
// Thinness, not area, tells them apart: draped fragments are often under 10 cm² yet
// solid, and dropping them leaves triangles of grass showing through the road.
export const triangulate = (ring: RoadSurface['ring']) => THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[2])), [])
  .filter(t => {
    const [a, b, c] = t.map(i => ring[i]), area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2;
    return 2 * area / Math.max(Math.hypot(b[0] - a[0], b[2] - a[2]), Math.hypot(c[0] - b[0], c[2] - b[2]), Math.hypot(a[0] - c[0], a[2] - c[2])) >= FLAT;
  });
const FLAT = .002; // metres a triangle must span across its longest side; rounded source points stray up to half a millimetre

// Texture coordinates are ground metres over the tile, so finishes run on across polygon edges.
function surfaceGeometry(surfaces: RoadSurface[], tile?: number) {
  const position: number[] = [], lift: number[] = [], uv: number[] = [], colour: number[] = [];
  for (const {ring, lift: l, groundColour, groundColours, tileLayout} of surfaces) {
    for (const t of triangulate(ring)) {
      const [a, b, c] = t.map(i => ring[i]);
      // Upward faces wind clockwise in (x, z).
      const up = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0;
      for (const k of up ? t : [t[0], t[2], t[1]]) { const p = ring[k]; position.push(...p); lift.push(l); if (tile) { const coords = tileLayout ? pathCoordinates(tileLayout.points, tileLayout.width, p[0], p[2]) : [p[0], p[2]]; uv.push(coords[0] / tile, coords[1] / tile); } if (groundColour) colour.push(...(groundColours?.[k] ?? groundColour)); }
    }
  }
  // Outline-only triangulation leaves long slivers; facet normals would shade their slight tilts as streaks.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: position.length / 3}, () => [0, 1, 0]).flat(), 3));
  g.setAttribute('lift', new THREE.Float32BufferAttribute(lift, 1));
  if (tile) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colour.length) { g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3)); g.computeVertexNormals(); }
  return g;
}

const SIZE = 512;

function wornGrass(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#8b8062'; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 90; i++) blob(x, rng() * SIZE, rng() * SIZE, 8 + rng() * 40, 5 + rng() * 25, i % 3 ? '#b1a080' : '#706c50', .12);
  speckle(x, rng, 32000, 125, 45, 1.3, .2);
  for (let i = 0; i < 650; i++) {
    x.strokeStyle = i % 2 ? '#747b51' : '#92966a'; x.globalAlpha = .5;
    const px = rng() * SIZE, py = rng() * SIZE;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - .5) * 6, py - 2 - rng() * 7); x.stroke();
  }
  x.globalAlpha = 1;
}

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

// Mown lawn: a fresher green than the survey's grass, with faint mowing stripes.
function lawn(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#6f8f44';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 4; i++) { x.globalAlpha = .06; x.fillStyle = i % 2 ? '#86a653' : '#5f7d3a'; x.fillRect(0, i * SIZE / 4, SIZE, SIZE / 4); }
  for (let i = 0; i < 30000; i++) {
    const n = (rng() - .5) * 60;
    x.globalAlpha = .35;
    x.fillStyle = `rgb(${105 + n},${140 + n},${66 + n * .6})`;
    x.fillRect(rng() * SIZE, rng() * SIZE, 1, 1 + rng() * 3);
  }
  x.globalAlpha = 1;
}

// Dug soil with clumps of planting in flower.
function flowerbed(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#5b4636';
  x.fillRect(0, 0, SIZE, SIZE);
  speckle(x, rng, 20000, 95, 40, 1.5, .35);
  const flowers = ['#d9443f', '#e8c33a', '#f2efe6', '#b45ab8', '#e9874a'];
  for (let i = 0; i < 70; i++) {
    const cx = rng() * SIZE, cy = rng() * SIZE, r = 14 + rng() * 22;
    blob(x, cx, cy, r, r * .8, '#55743a', .9);
    const colour = flowers[Math.floor(rng() * flowers.length)];
    for (let k = 0; k < 40; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * .8;
      blob(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d * .8, 2 + rng() * 2, 2 + rng() * 2, colour, .95);
    }
  }
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

function wornPaving(x: CanvasRenderingContext2D, rng: () => number) {
  x.fillStyle = '#566344'; x.fillRect(0, 0, SIZE, SIZE);
  speckle(x, rng, 22000, 81, 44, 1.7, .35);
  const slab = SIZE / 4;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const px = col * slab, py = row * slab, gap = 3 + rng() * 2, tone = 126 + Math.floor(rng() * 30);
    x.save(); x.beginPath();
    x.moveTo(px + gap + rng() * 3, py + gap); x.lineTo(px + slab - gap, py + gap + rng() * 3);
    x.lineTo(px + slab - gap - rng() * 3, py + slab - gap); x.lineTo(px + gap, py + slab - gap - rng() * 3); x.closePath(); x.clip();
    x.fillStyle = 'rgb(' + tone + ',' + (tone - 3) + ',' + (tone - 13) + ')'; x.fillRect(px, py, slab, slab);
    for (let i = 0; i < 100; i++) {
      x.globalAlpha = .08; x.fillStyle = i % 2 ? '#514c40' : '#d2cbb4';
      x.beginPath(); x.ellipse(px + rng() * slab, py + rng() * slab, 3 + rng() * 14, 2 + rng() * 9, rng() * Math.PI, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = .4;
    for (let i = 0; i < 1800; i++) { const v = 95 + Math.floor(rng() * 90); x.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 8) + ')'; x.fillRect(px + rng() * slab, py + rng() * slab, .7, .7); }
    if (rng() < .35) { x.strokeStyle = '#686453'; x.lineWidth = .7; x.beginPath(); x.moveTo(px + gap, py + slab * .4); x.lineTo(px + slab * .35, py + slab * .48); x.lineTo(px + slab * .5, py + slab * .7); x.stroke(); }
    x.restore();
    for (let i = 0; i < 35; i++) {
      const horizontal = i % 2, a = px + (horizontal ? rng() * slab : rng() * gap), b = py + (horizontal ? rng() * gap : rng() * slab);
      x.strokeStyle = i % 3 ? '#68794c' : '#89925a'; x.lineWidth = .8;
      x.beginPath(); x.moveTo(a, b); x.lineTo(a + (rng() - .5) * 7, b - rng() * 6); x.stroke();
    }
  }
}
