import * as THREE from 'three';
import {SURFACES, type Detail, type Surface} from './classify.ts';
import type {SurveyBucket, SurveyManifest} from '../data.ts';
import {concat} from './carve.ts';

const MAPPED = (kind: Surface) => kind !== 'plain' && kind !== 'glass';
const BUMPED = (kind: Surface) => kind === 'plaster' || kind === 'roof' || kind === 'stone' || kind === 'brick';

function surfaceTexture(kind: Surface, rng: () => number, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const x = canvas.getContext('2d')!;
  x.fillStyle = '#eeeae2';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const n = kind === 'grass' ? 150 + rng() * 95 : 205 + rng() * 48;
    x.fillStyle = `rgb(${n},${n},${n})`;
    x.globalAlpha = kind === 'plaster' ? .16 : .25;
    x.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 1 + rng() * 2);
  }
  x.globalAlpha = 1;
  if (kind === 'brick' || kind === 'stone' || kind === 'paving') {
    const h = kind === 'stone' ? 64 : 40, w = kind === 'stone' ? 100 : 80;
    for (let row = 0; row < 256 / h; row++) for (let col = -1; col < 5; col++) {
      const xx = col * w + (row % 2) * w / 2, yy = row * h, shade = 210 + rng() * 35;
      x.fillStyle = `rgb(${shade},${shade},${shade})`;
      x.fillRect(xx + 1, yy + 1, w - 2, h - 2);
      x.strokeStyle = '#b8b7af';
      x.lineWidth = kind === 'stone' ? 3 : 1.5;
      x.strokeRect(xx, yy, w, h);
      x.strokeStyle = '#f2efe5';
      x.beginPath();
      x.moveTo(xx + 2, yy + 2);
      x.lineTo(xx + w - 2, yy + 2);
      x.stroke();
    }
  }
  if (kind === 'roof') {
    x.fillStyle = '#e1e4e1';
    x.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 256; j += 32) {
      x.fillStyle = '#a2aaa8';
      x.fillRect(j, 0, 2, 256);
      x.fillStyle = '#f0f1ec';
      x.fillRect(j + 2, 0, 1, 256);
    }
    x.fillStyle = '#bec5c1';
    x.fillRect(0, 127, 256, 1);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, anisotropy);
  return t;
}

const RELIEF_EXAGGERATION = 6;
// Depth-only lift per stacked ground layer, in metres, so a higher layer wins
// where the draped layers touch between vertices.
const LAYER_LIFT = .3;
const RELIEF_COLOURS = ['#2f6b3f', '#7fa65a', '#e3d27c', '#c98a4a', '#8a4b2f'].map(c => new THREE.Color(c));

// The survey paints grass one washed-out olive town-wide. Patches of lusher and
// drier grass at several scales, in linear colour, keep the survey's brightness
// so shading and its own darker areas still read. Grass is told apart by vertex
// colour because the overview mesh merges every surface into one material.
// Finer scales fade out once a cell shrinks below a few pixels, so they do not shimmer.
const GRASS_NOISE = `
float grassHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grassNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(grassHash(i), grassHash(i + vec2(1, 0)), u.x), mix(grassHash(i + vec2(0, 1)), grassHash(i + vec2(1, 1)), u.x), u.y);
}
vec3 varyGrass(vec3 colour, vec3 painted, vec2 p) {
  // Vivid paint is a sports pitch or artificial turf, which keeps its colour.
  float ratio = painted.g / max(painted.r, 1e-3), grass = smoothstep(1.03, 1.15, ratio) * (1. - smoothstep(1.45, 1.8, ratio)) * step(painted.b, painted.g);
  if (grass <= 0.) return colour;
  float pixel = length(fwidth(p));
  float wide = grassNoise(p / 210. + 3.7) * .6 + grassNoise(p / 70.) * .4;
  float patchy = grassNoise(p / 18. + 9.1), clumps = grassNoise(p / 3.5 + 1.3), blades = grassNoise(p / 1.1);
  vec3 lush = vec3(.12, .19, .065), meadow = vec3(.17, .22, .085), dry = vec3(.27, .26, .13);
  float d = clamp(wide + (patchy - .5) * .35, 0., 1.);
  vec3 tint = d < .5 ? mix(lush, meadow, d * 2.) : mix(meadow, dry, (d - .5) * 2.);
  const vec3 LUMA = vec3(.2126, .7152, .0722);
  vec3 varied = tint * dot(colour, LUMA) / dot(tint, LUMA);
  varied *= 1. + (patchy - .5) * .22 + (clumps - .5) * .16 * (1. - smoothstep(.4, 1.2, pixel)) + (blades - .5) * .12 * (1. - smoothstep(.15, .5, pixel));
  return mix(colour, varied, grass * .7);
}
`;

interface Overlays {
  tints: THREE.DataTexture;
  relief: {value: number};
  reliefRange: {value: THREE.Vector2}; // absolute metres
  base: number;
}

function tintable<M extends THREE.Material>(material: M, overlays: Overlays): M {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      buildingTints: {value: overlays.tints}, relief: overlays.relief, reliefRange: overlays.reliefRange,
      reliefBase: {value: overlays.base}, reliefColours: {value: RELIEF_COLOURS},
    });
    shader.vertexShader = 'attribute float building;\nattribute float layer;\nvarying float vBuilding;\nvarying vec3 vSurvey;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuilding = building;\nvSurvey = position;')
        .replace('#include <project_vertex>', `#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * layer * ${LAYER_LIFT};`);
    shader.fragmentShader = 'uniform sampler2D buildingTints;\nuniform float relief;\nuniform vec2 reliefRange;\nuniform float reliefBase;\nuniform vec3 reliefColours[5];\nvarying float vBuilding;\nvarying vec3 vSurvey;\n' + GRASS_NOISE +
      shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if (vBuilding < .5) diffuseColor.rgb = varyGrass(diffuseColor.rgb, vColor.rgb, vSurvey.xz);
vec4 buildingTint = texelFetch(buildingTints, ivec2(int(vBuilding + .5), 0), 0);
diffuseColor.rgb = mix(diffuseColor.rgb, buildingTint.rgb, buildingTint.a);
if (relief > 0. && vBuilding < .5) {
  float h = vSurvey.y + reliefBase, s = clamp((h - reliefRange.x) / (reliefRange.y - reliefRange.x), 0., 1.) * 4.;
  int band = int(min(floor(s), 3.));
  vec3 ramp = mix(reliefColours[band], reliefColours[band + 1], s - float(band));
  float minor = min(abs(fract(h / 2. + .5) - .5) / fwidth(h / 2.), 1.);
  float major = min(abs(fract(h / 10. + .5) - .5) / fwidth(h / 10.) / 1.6, 1.);
  ramp *= 1. - .3 * (1. - minor) - .55 * (1. - major);
  // Most of the town slopes under 5°, invisible under the scene light: a
  // map-style hillshade, lit from the north-west with slopes exaggerated.
  vec3 slope = normalize(cross(dFdx(vSurvey), dFdy(vSurvey)));
  slope = normalize(vec3(slope.x * ${RELIEF_EXAGGERATION}., abs(slope.y), slope.z * ${RELIEF_EXAGGERATION}.) * sign(slope.y));
  ramp *= .35 + .9 * clamp(dot(slope, normalize(vec3(-1., 1.41, -1.))), 0., 1.);
  diffuseColor.rgb = mix(diffuseColor.rgb, ramp, relief);
}`);
  };
  return material;
}

// buildings: one more than the highest building number. base: absolute height of local y = 0.
export function surveyMaterials(anisotropy: number, buildings: number, base: number) {
  const tints = new THREE.DataTexture(new Uint8Array(buildings * 4), buildings, 1);
  tints.needsUpdate = true;
  const overlays: Overlays = {tints, relief: {value: 0}, reliefRange: {value: new THREE.Vector2(0, 1)}, base};
  let seed = 17;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const textures = {} as Record<Surface, THREE.CanvasTexture>, near = {} as Record<Surface, THREE.MeshStandardMaterial>;
  for (const kind of SURFACES) {
    const t = textures[kind] = surfaceTexture(kind, rng, anisotropy);
    near[kind] = tintable(new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.FrontSide,
      map: MAPPED(kind) ? t : null, bumpMap: BUMPED(kind) ? t : null, bumpScale: kind === 'plaster' ? .025 : .065,
      roughness: kind === 'glass' ? .3 : .94, metalness: kind === 'glass' ? .12 : 0,
    }), overlays);
  }
  const far = Object.fromEntries(SURFACES.map(k => [k, tintable(new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide, map: null}), overlays)])) as Record<Surface, THREE.MeshLambertMaterial>;
  return {
    near, far, tints, overlays,
    setTextures(enabled: boolean) {
      for (const kind of SURFACES) {
        const m = near[kind];
        m.map = enabled && MAPPED(kind) ? textures[kind] : null;
        m.bumpMap = enabled && BUMPED(kind) ? textures[kind] : null;
        m.needsUpdate = true;
      }
    },
  };
}

export type SurveyMaterials = ReturnType<typeof surveyMaterials>;
export const DETAIL_NAMES = ['Overview detail', 'Neighbourhood detail', 'Close-up detail'];

// Equal-depth survey meshes draw in creation order, so every mesh exists from
// the start in manifest order; tiles may then arrive in any order.
export function addSurveyLayer(scene: THREE.Scene, buckets: SurveyManifest['buckets'], materials: SurveyMaterials) {
  const groups: Record<Detail, THREE.Group> = {base: new THREE.Group(), medium: new THREE.Group(), fine: new THREE.Group()};
  Object.values(groups).forEach(g => scene.add(g));
  const kinds = new Map<THREE.Mesh, Surface>();
  const meshes = buckets.map(b => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials.near[b.kind]);
    mesh.castShadow = b.detail === 'base' && b.kind !== 'grass' && b.kind !== 'paving' && b.kind !== 'clay';
    mesh.receiveShadow = b.detail === 'base';
    mesh.visible = false;
    kinds.set(mesh, b.kind);
    groups[b.detail].add(mesh);
    return mesh;
  });
  const overview = new THREE.Group(), overviewMaterial = tintable(new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide}), materials.overlays);
  const cells = new Map<string, {mesh: THREE.Mesh; parts: number[]; loaded: Map<number, SurveyBucket>}>();
  buckets.forEach((b, index) => {
    if (b.detail !== 'base') return;
    let cell = cells.get(b.cell);
    if (!cell) {
      cells.set(b.cell, cell = {mesh: new THREE.Mesh(new THREE.BufferGeometry(), overviewMaterial), parts: [], loaded: new Map()});
      cell.mesh.visible = false;
      overview.add(cell.mesh);
    }
    cell.parts.push(index);
  });
  scene.add(overview);
  overview.visible = false;

  let level = -1;
  return {
    // A cell never spans two tiles.
    fill(bucket: SurveyBucket) {
      const geo = meshes[bucket.index].geometry;
      geo.setAttribute('position', new THREE.BufferAttribute(bucket.position, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(bucket.color, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(bucket.uv, 2));
      geo.setAttribute('building', new THREE.BufferAttribute(bucket.building, 1));
      geo.setAttribute('layer', new THREE.BufferAttribute(bucket.layer, 1));
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      meshes[bucket.index].visible = true;
      const meta = buckets[bucket.index], cell = meta.detail === 'base' && cells.get(meta.cell);
      if (!cell) return;
      cell.loaded.set(bucket.index, bucket);
      if (cell.loaded.size < cell.parts.length) return;
      const parts = cell.parts.map(i => cell.loaded.get(i)!), merged = cell.mesh.geometry;
      merged.setAttribute('position', new THREE.BufferAttribute(concat(parts.map(b => b.position)), 3));
      merged.setAttribute('color', new THREE.BufferAttribute(concat(parts.map(b => b.color)), 3));
      merged.setAttribute('building', new THREE.BufferAttribute(concatUint16(parts.map(b => b.building)), 1));
      merged.setAttribute('layer', new THREE.BufferAttribute(concatBytes(parts.map(b => b.layer)), 1));
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      cell.mesh.visible = true;
      cell.loaded.clear();
    },

    setTints(rgba: Uint8Array) {
      materials.tints.image.data!.set(rgba);
      materials.tints.needsUpdate = true;
    },

    setRelief(visible: boolean, low: number, high: number) {
      materials.overlays.relief.value = visible ? 1 : 0;
      materials.overlays.reliefRange.value.set(low, high);
    },

    // 0 overview, 1 neighbourhood, 2 close-up; returns true when it changed.
    setLevel(next: number) {
      if (next === level) return false;
      level = next;
      overview.visible = level === 0;
      groups.base.visible = level > 0;
      for (const [mesh, kind] of kinds) mesh.material = level === 0 ? materials.far[kind] : materials.near[kind];
      groups.fine.visible = level === 2;
      groups.medium.visible = level >= 1;
      return true;
    },
  };
}

function concatUint16(chunks: Uint16Array[]) {
  const out = new Uint16Array(chunks.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

function concatBytes(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
