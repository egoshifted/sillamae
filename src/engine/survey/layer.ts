import * as THREE from 'three';
import {SURFACES, type Detail, type Surface} from './classify.ts';
import type {SurveyBucket, SurveyManifest} from '../data.ts';
import {concat} from './carve.ts';
import {groundCover} from './ground-cover.ts';
import {MIRRORED, waterSurface} from './water.ts';

const MAPPED = (kind: Surface) => kind !== 'plain' && kind !== 'glass' && kind !== 'water';
// Ground seen from below would be lit by nothing, and only hide what stands on it.
const UNMIRRORED = new Set<Surface>(['grass', 'paving', 'clay', 'plain', 'water']);
const BUMPED = (kind: Surface) => kind === 'plaster' || kind === 'roof' || kind === 'stone' || kind === 'brick';

function surfaceTexture(kind: Surface, rng: () => number, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const x = canvas.getContext('2d')!;
  x.fillStyle = '#eeeae2';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    // Grass stays faint: a strong speckle at one scale is what carpet looks like.
    const n = kind === 'grass' ? 208 + rng() * 34 : 205 + rng() * 48;
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

// The survey paints 73% of its grass one pale olive, about 35% brighter than the orthophoto's
// lawns. Lusher, drier and worn areas at several scales, in linear colour, replace that paint
// but follow its brightness, so shading and its own darker areas still read. Grass is told
// apart by vertex colour because the overview mesh merges every surface into one material.
// Finer scales fade out once a cell shrinks below a few pixels, so they do not shimmer.
// Grass is matte: it scatters light between blades, so it takes no highlight.
const WALL_FOOT = '3.'; // metres up a wall that the ground's shade reaches
const GRASS_NOISE = `
uniform sampler2D groundCover;
uniform vec4 groundCoverArea;
float groundMatte = 0.;
float groundContact = 0.;
float contactAt(vec2 p) { return texture2D(groundCover, (p - groundCoverArea.xy) * groundCoverArea.zw).b; }
// around: the ground's own shade at this wall, so its foot darkens with the same corners.
float wallFoot(float up, float around) { return (1. - smoothstep(0., ${WALL_FOOT}, up)) * (.15 + .75 * around); }
vec2 groundBend = vec2(0.);
float grassHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grassNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(grassHash(i), grassHash(i + vec2(1, 0)), u.x), mix(grassHash(i + vec2(0, 1)), grassHash(i + vec2(1, 1)), u.x), u.y);
}
vec3 varyGrass(vec3 colour, vec3 painted, vec2 p) {
  // Vivid paint is a sports pitch or artificial turf, which keeps its colour. The town's main grass
  // paint is only 1.066 green to red, and grey paving is as high, so blue is what separates them.
  float ratio = painted.g / max(painted.r, 1e-3), grass = smoothstep(1.02, 1.055, ratio) * (1. - smoothstep(1.45, 1.8, ratio)) * smoothstep(1.08, 1.2, painted.g / max(painted.b, 1e-3));
  if (grass <= 0.) return colour;
  float pixel = length(fwidth(p));
  float broad = grassNoise(p / 210. + 3.7), local = grassNoise(p / 70.), patchy = grassNoise(p / 18. + 9.1);
  float fine = 1. - smoothstep(.4, 1.2, pixel), finest = 1. - smoothstep(.15, .5, pixel);
  float tufts = grassNoise(p / 3.1 + 1.3) * .6 + grassNoise(p / 1.3 + 7.7) * .4, blades = grassNoise(p / .47);
  vec2 cover = texture2D(groundCover, (p - groundCoverArea.xy) * groundCoverArea.zw).rg;
  float underTrees = smoothstep(.12, .6, cover.r), tended = smoothstep(.2, .85, cover.g) * (1. - underTrees);
  // Early September at 59 north: green only where it is kept or damp, otherwise olive turning
  // to straw. Value noise gathers around .5, so it is stretched to reach both ends.
  // Tufts break the patch edges, which would otherwise read as blurred camouflage.
  float d = clamp(.56 + (broad * .6 + local * .4 - .5) * 2.6 + (patchy - .5) * .45 + (tufts - .5) * .35 * fine, 0., 1.);
  d = mix(d, .22 + d * .34, tended);
  vec3 kept = vec3(.095, .155, .055), olive = vec3(.17, .195, .08), hay = vec3(.3, .275, .13), soil = vec3(.26, .215, .135), litter = vec3(.15, .105, .06);
  vec3 tint = d < .5 ? mix(kept, olive, d * 2.) : mix(olive, hay, (d - .5) * 2.);
  // Long grass grows in tussocks with dead stems showing between them; a mown lawn has neither.
  float rough = 1. - tended;
  tint = mix(tint, hay * .82, smoothstep(.54, .72, tufts) * rough * fine * .55);
  tint = mix(tint, soil, smoothstep(.64, .74, local * .5 + patchy * .3 + tufts * .2) * .32);
  // Fallen leaves and needles over bare soil, broken by the grass that still comes through.
  tint = mix(tint, mix(litter, soil, smoothstep(.35, .7, tufts)), underTrees * (.5 + .4 * smoothstep(.3, .65, patchy)));
  const vec3 LUMA = vec3(.2126, .7152, .0722);
  vec3 varied = tint * dot(colour, LUMA) / dot(tint, LUMA) * (.66 + .26 * d);
  varied *= 1. + (patchy - .5) * .24 + (tufts - .5) * mix(.2, .42, max(rough, underTrees)) * fine + (blades - .5) * mix(.12, .2, rough) * finest;
  groundMatte = grass;
  groundBend = vec2(tufts - .5, grassNoise(p / 2.3 + 4.1) - .5) * (.25 + .75 * rough) * fine * grass * .9;
  return mix(colour, varied, grass * .95);
}
`;
const GROUND_NORMAL = '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(groundBend.x, 0., groundBend.y, 0.)).xyz);';
// Occlusion takes the sky's light, so it shows most in shade, and a little of the sun's.
export const GROUND_CONTACT = 'reflectedLight.indirectDiffuse *= 1. - .8 * groundContact;\nreflectedLight.directDiffuse *= 1. - .35 * groundContact;\n';
const GROUND_MATTE = GROUND_CONTACT + 'reflectedLight.directSpecular *= 1. - groundMatte;\n#include <aomap_fragment>';

export const groundUniforms = {groundCover: groundCover.map, groundCoverArea: groundCover.area};

export function restoredGroundMaterial(anisotropy: number) {
  let seed = 17;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .94, side: THREE.DoubleSide, map: surfaceTexture('grass', rng, anisotropy)});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, groundUniforms);
    shader.vertexShader = 'attribute float lift;\nvarying vec3 vGround;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position;')
      .replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * lift;');
    shader.fragmentShader = 'varying vec3 vGround;\n' + GRASS_NOISE + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = varyGrass(diffuseColor.rgb, vColor.rgb, vGround.xz);\ngroundContact = contactAt(vGround.xz);')
      .replace('#include <normal_fragment_maps>', GROUND_NORMAL).replace('#include <aomap_fragment>', GROUND_MATTE);
  };
  material.customProgramCacheKey = () => 'restored-survey-ground';
  return material;
}

interface Overlays {
  tints: THREE.DataTexture;
  bases: THREE.DataTexture; // local height of each building's foot; far above any wall until set
  relief: {value: number};
  reliefRange: {value: THREE.Vector2}; // absolute metres
  base: number;
}

function tintable<M extends THREE.Material>(material: M, overlays: Overlays): M {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      buildingTints: {value: overlays.tints}, buildingBases: {value: overlays.bases}, relief: overlays.relief, reliefRange: overlays.reliefRange,
      reliefBase: {value: overlays.base}, reliefColours: {value: RELIEF_COLOURS}, ...groundUniforms,
    });
    shader.vertexShader = 'attribute float building;\nattribute float layer;\nvarying float vBuilding;\nvarying vec3 vSurvey;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuilding = building;\nvSurvey = position;')
        .replace('#include <project_vertex>', `#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * layer * ${LAYER_LIFT};`);
    shader.fragmentShader = 'uniform sampler2D buildingTints;\nuniform sampler2D buildingBases;\nuniform float relief;\nuniform vec2 reliefRange;\nuniform float reliefBase;\nuniform vec3 reliefColours[5];\nvarying float vBuilding;\nvarying vec3 vSurvey;\n' + GRASS_NOISE +
      shader.fragmentShader.replace('#include <normal_fragment_maps>', GROUND_NORMAL).replace('#include <aomap_fragment>', GROUND_MATTE).replace('#include <color_fragment>', `#include <color_fragment>
if (vBuilding < .5) {
  diffuseColor.rgb = varyGrass(diffuseColor.rgb, vColor.rgb, vSurvey.xz);
  groundContact = contactAt(vSurvey.xz);
} else groundContact = wallFoot(vSurvey.y - texelFetch(buildingBases, ivec2(int(vBuilding + .5), 0), 0).r, contactAt(vSurvey.xz));
vec4 buildingTint = texelFetch(buildingTints, ivec2(int(vBuilding + .5), 0), 0);
diffuseColor.rgb = mix(diffuseColor.rgb, buildingTint.rgb, buildingTint.a);
if (relief > 0. && vBuilding < .5) {
  float h = vSurvey.y + reliefBase, s = clamp((h - reliefRange.x) / (reliefRange.y - reliefRange.x), 0., 1.) * 4.;
  int band = int(min(floor(s), 3.));
  vec3 ramp = mix(reliefColours[band], reliefColours[band + 1], s - float(band));
  float minor = min(abs(fract(h / 2. + .5) - .5) / fwidth(h / 2.), 1.);
  float major = min(abs(fract(h / 10. + .5) - .5) / fwidth(h / 10.) / 1.6, 1.);
  ramp *= 1. - .3 * (1. - minor) - .55 * (1. - major);
  // Most of the town slopes under 5Ã‚Â°, invisible under the scene light: a
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
export function surveyMaterials(anisotropy: number, buildings: number, base: number, flat = false) {
  const tints = new THREE.DataTexture(new Uint8Array(buildings * 4), buildings, 1);
  tints.needsUpdate = true;
  const bases = new THREE.DataTexture(new Float32Array(buildings).fill(-1e4), buildings, 1, THREE.RedFormat, THREE.FloatType);
  bases.needsUpdate = true;
  const overlays: Overlays = {tints, bases, relief: {value: 0}, reliefRange: {value: new THREE.Vector2(0, 1)}, base};
  let seed = 17;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const textures = {} as Record<Surface, THREE.CanvasTexture>, near = {} as Record<Surface, THREE.MeshStandardMaterial>;
  for (const kind of SURFACES) {
    const t = textures[kind] = surfaceTexture(kind, rng, anisotropy);
    near[kind] = tintable(new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.FrontSide,
      flatShading: flat,
      map: MAPPED(kind) ? t : null, bumpMap: BUMPED(kind) ? t : null, bumpScale: kind === 'plaster' ? .025 : .065,
      roughness: kind === 'glass' ? .3 : .94, metalness: kind === 'glass' ? .12 : 0,
    }), overlays);
  }
  const water = waterSurface(tintable(new THREE.MeshStandardMaterial({vertexColors: true, side: THREE.DoubleSide, roughness: .3, flatShading: flat}), overlays), anisotropy);
  near.water = water.material;
  water.glaze(near.glass, true);
  const far = Object.fromEntries(SURFACES.map(k => [k, k === 'water' ? water.material : tintable(new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide, map: null, flatShading: flat}), overlays)])) as unknown as Record<Surface, THREE.Material>;
  return {
    near, far, tints, overlays, water,
    // Refined models paint their own walls. Tagged meshes carry the same building attribute as the
    // survey, so they share its base heights and the ground's shade map.
    shadeFoot(material: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial) {
      const before = material.onBeforeCompile.bind(material), key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        Object.assign(shader.uniforms, groundUniforms, {buildingBases: {value: bases}});
        shader.vertexShader = 'attribute float building;\nuniform sampler2D buildingBases;\nvarying vec3 vFoot;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
vec4 footAt = vec4(transformed, 1.);
#ifdef USE_INSTANCING
footAt = instanceMatrix * footAt;
#endif
footAt = modelMatrix * footAt;
vFoot = vec3(footAt.x, footAt.y - texelFetch(buildingBases, ivec2(int(building + .5), 0), 0).r, footAt.z);`);
        shader.fragmentShader = `uniform sampler2D groundCover;\nuniform vec4 groundCoverArea;\nvarying vec3 vFoot;\nfloat contactAt(vec2 p) { return texture2D(groundCover, (p - groundCoverArea.xy) * groundCoverArea.zw).b; }\nfloat wallFoot(float up, float around) { return (1. - smoothstep(0., ${WALL_FOOT}, up)) * (.15 + .75 * around); }\n` + shader.fragmentShader
          .replace('#include <aomap_fragment>', 'float groundContact = wallFoot(vFoot.y, contactAt(vFoot.xz));\n' + GROUND_CONTACT + '#include <aomap_fragment>');
      };
      material.customProgramCacheKey = () => key + '-wall-foot';
      material.needsUpdate = true;
    },
    setBases(heights: Map<number, number>) {
      const data = bases.image.data as Float32Array;
      for (const [pick, height] of heights) data[pick] = height;
      bases.needsUpdate = true;
    },
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
  // Water keeps its own meshes at every detail level: the overview merges one
  // material per cell, and water needs the shader that level would drop.
  const water = new THREE.Group();
  const meshes = buckets.map(b => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials.near[b.kind]);
    mesh.castShadow = b.detail === 'base' && b.kind !== 'grass' && b.kind !== 'paving' && b.kind !== 'clay' && b.kind !== 'water';
    mesh.receiveShadow = b.detail === 'base';
    mesh.visible = false;
    if (b.detail === 'base' && !UNMIRRORED.has(b.kind)) mesh.layers.enable(MIRRORED);
    kinds.set(mesh, b.kind);
    (b.kind === 'water' ? water : groups[b.detail]).add(mesh);
    return mesh;
  });
  const overview = new THREE.Group(), overviewMaterial = tintable(new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide, flatShading: materials.near.grass.flatShading}), materials.overlays);
  const cells = new Map<string, {mesh: THREE.Mesh; parts: number[]; loaded: Map<number, SurveyBucket>}>();
  buckets.forEach((b, index) => {
    if (b.detail !== 'base' || b.kind === 'water') return;
    let cell = cells.get(b.cell);
    if (!cell) {
      cells.set(b.cell, cell = {mesh: new THREE.Mesh(new THREE.BufferGeometry(), overviewMaterial), parts: [], loaded: new Map()});
      cell.mesh.visible = false;
      overview.add(cell.mesh);
    }
    cell.parts.push(index);
  });
  scene.add(overview, water);
  overview.visible = false;

  let level = -1;
  return {
    // A cell never spans two tiles.
    fill(bucket: SurveyBucket) {
      const geo = meshes[bucket.index].geometry;
      if (bucket.indices) geo.setIndex(new THREE.BufferAttribute(bucket.indices, 1));
      geo.setAttribute('position', new THREE.BufferAttribute(bucket.position, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(bucket.color, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(bucket.uv, 2));
      geo.setAttribute('building', new THREE.BufferAttribute(bucket.building, 1));
      geo.setAttribute('layer', new THREE.BufferAttribute(bucket.layer, 1));
      if (bucket.normal) geo.setAttribute('normal', new THREE.BufferAttribute(bucket.normal, 3)); else geo.computeVertexNormals();
      bucket.normal ??= geo.getAttribute('normal').array as Float32Array;
      if (bucket.bounds) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bucket.bounds.slice(0, 3)), bucket.bounds[3]); else geo.computeBoundingSphere();
      meshes[bucket.index].visible = true;
      const meta = buckets[bucket.index], cell = meta.detail === 'base' && meta.kind !== 'water' && cells.get(meta.cell);
      if (!cell) return;
      cell.loaded.set(bucket.index, bucket);
      if (cell.loaded.size < cell.parts.length) return;
      const parts = cell.parts.map(i => cell.loaded.get(i)!), merged = cell.mesh.geometry;
      merged.setAttribute('position', new THREE.BufferAttribute(concat(parts.map(b => b.position)), 3));
      merged.setAttribute('color', new THREE.BufferAttribute(concat(parts.map(b => b.color)), 3));
      merged.setAttribute('building', new THREE.BufferAttribute(concatUint16(parts.map(b => b.building)), 1));
      merged.setAttribute('layer', new THREE.BufferAttribute(concatBytes(parts.map(b => b.layer)), 1));
      if (parts.every(b => b.normal)) merged.setAttribute('normal', new THREE.BufferAttribute(concat(parts.map(b => b.normal!)), 3)); else merged.computeVertexNormals();
      if (materials.near.grass.flatShading) {
        merged.setAttribute('uv', new THREE.BufferAttribute(concat(parts.map(b => b.uv)), 2));
        const indices = new Uint32Array(parts.reduce((n, b) => n + (b.indices?.length ?? b.building.length), 0));
        let vertex = 0, corner = 0;
        for (const part of parts) {
          const count = part.indices?.length ?? part.building.length;
          for (let j = 0; j < count; j++) indices[corner + j] = vertex + (part.indices?.[j] ?? j);
          vertex += part.building.length; corner += count;
        }
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        corner = 0;
        // Sharing BufferAttribute objects also shares GPU buffers. A separate
        // overview copy doubles terrain memory as soon as the camera zooms out.
        for (const part of parts) {
          const mesh = meshes[part.index], shared = new THREE.BufferGeometry();
          for (const [name, attribute] of Object.entries(merged.attributes)) shared.setAttribute(name, attribute);
          shared.setIndex(merged.index);
          const count = part.indices?.length ?? part.building.length;
          shared.setDrawRange(corner, count); corner += count;
          shared.boundingSphere = mesh.geometry.boundingSphere;
          mesh.geometry.dispose(); mesh.geometry = shared;
        }
      }
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
