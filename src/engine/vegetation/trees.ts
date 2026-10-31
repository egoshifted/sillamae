import * as THREE from 'three';
import type {Tree, WorldFrame} from '../types.ts';

const CONIFER = 'Okaspuu';
// Crowns are built in units of the crown radius for a few height/radius ratios, so instances scale almost uniformly
// and the leaf cards keep their shape. Each class is one instanced mesh per chunk.
const ASPECTS = [[2.6, 3.4, 4.6], [3.6, 5.4]];
// Cards per crown and card size (in crown radii) for the three detail levels.
const CARDS = [[22, 65, 150], [24, 70, 170]], CARD_SIZE = [[1.2, .85, .62], [1.25, .9, .62]];
// Spring greens read from the May 2023 Maa-amet obliques. The survey has no species, so the yellow-green share
// (willow/birch-like) is spread by a fixed rule rather than placed where those species actually stand.
const BROADLEAF = ['#7f9e48', '#8aa94f', '#749440', '#91ad55', '#7b9a4b'], YELLOW = '#b4c25a';
const CONIFERS = ['#56744b', '#5f7c52', '#4f6c47'];

// Stable per-tree random values from its position, so a tree keeps its look across reloads and detail levels.
const hash = (x: number, z: number, k: number) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };

// Left half of the atlas: a broadleaf leaf cluster; right half: a spruce needle spray. Both have open, ragged
// edges so overlapping cards give a broken silhouette and gaps that show the limbs behind.
function foliageTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const paint = canvas.getContext('2d')!;
  let seed = 917;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const shade = (lo: number, hi: number) => { const n = lo + random() * (hi - lo); return `rgb(${n * .93 | 0},${n | 0},${n * .78 | 0})`; };
  paint.strokeStyle = 'rgb(70,60,48)';
  paint.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const a = random() * 6.28; paint.beginPath(); paint.moveTo(128, 128); paint.lineTo(128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); paint.stroke(); }
  for (let i = 0; i < 760; i++) {
    const a = random() * 6.28, d = Math.sqrt(random()) * 116 * (.78 + .22 * Math.sin(a * 5 + 1));
    paint.fillStyle = shade(120, 245);
    paint.beginPath();
    paint.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 4 + random() * 4, 2 + random() * 2.5, random() * 6.28, 0, Math.PI * 2);
    paint.fill();
  }
  // Spruce spray: a drooping fan of branchlets, dense at the core and ragged at the tips, seen from above.
  paint.lineCap = 'round';
  for (let s = 0; s < 13; s++) {
    const a = (s - 6) * .2, length = 80 + random() * 36;
    for (let k = 0; k < 70; k++) {
      const t = k / 70, x = 384 + Math.sin(a) * length * t, y = 14 + Math.cos(a) * length * t * 1.9 + t * t * 18, side = k % 2 ? 1 : -1, b = Math.PI / 2 + a + side * (.9 + random() * .5), n = 14 + random() * 10 * (1 - t * .6);
      paint.strokeStyle = shade(95, 215);
      paint.lineWidth = 2.6;
      paint.beginPath(); paint.moveTo(x, y); paint.lineTo(x + Math.cos(b) * n, y + Math.sin(b) * n); paint.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// One crown of alpha-cut leaf cards. Normals point out of the crown volume instead of along each card, so the crown
// is lit as one soft mass; vertex colours darken the underside and the inside.
function crownGeometry(conifer: boolean, aspect: number, level: number) {
  let seed = 1009 + Math.round(aspect * 100) + (conifer ? 61 : 0) + level * 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const count = CARDS[+conifer][level], size = CARD_SIZE[+conifer][level], half = conifer ? .5 : 0;
  const centre = new THREE.Vector3(0, aspect * (conifer ? .5 : .62), 0), radiusY = aspect * (conifer ? .46 : .38);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colours: number[] = [];
  const c = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), volume = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const a = rand() * 6.283, depth = .55 + .45 * Math.sqrt(rand());
    let height: number;
    if (conifer) {
      // Spruce: cards on the cone surface in drooping tiers.
      height = .06 + .9 * Math.pow(rand(), .8);
      const radius = (1 - height) * depth;
      c.set(Math.cos(a) * radius, height * aspect, Math.sin(a) * radius);
      // Branches spread out and droop, so from the atlas's raised camera the cards lie closer to flat than upright.
      n.set(Math.cos(a) * .8, 1, Math.sin(a) * .8).normalize();
      t.set(-Math.sin(a), 0, Math.cos(a));
      // The spray's base is at the top of the texture; point it at the trunk so the tips droop outwards.
      b.crossVectors(n, t).normalize().negate();
      volume.set(Math.cos(a), .6, Math.sin(a)).normalize();
    } else {
      const y = rand() * 2 - 1, r = Math.sqrt(1 - y * y);
      c.set(Math.cos(a) * r * depth, centre.y + y * radiusY * depth * (y < 0 ? .8 : 1), Math.sin(a) * r * depth);
      height = (y + 1) / 2;
      n.set(Math.cos(a) * r + rand() - .5, y + rand() - .5, Math.sin(a) * r + rand() - .5).normalize();
      t.set(rand() - .5, rand() - .5, rand() - .5).cross(n).normalize();
      b.crossVectors(n, t).normalize();
      q.setFromAxisAngle(n, rand() * 6.283);
      t.applyQuaternion(q);
      b.applyQuaternion(q);
      volume.set(c.x, (c.y - centre.y) / aspect * 2.2, c.z).normalize().lerp(new THREE.Vector3(0, 1, 0), .25).normalize();
    }
    const s = size * (.8 + .4 * rand()), light = (.62 + .38 * THREE.MathUtils.smoothstep(height, .05, .95)) * (.72 + .28 * depth);
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, 0, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [u, v, tu, tv] of corners) {
      positions.push(c.x + (t.x * u + b.x * v) * s / 2, c.y + (t.y * u + b.y * v) * s / 2, c.z + (t.z * u + b.z * v) * s / 2);
      normals.push(volume.x, volume.y, volume.z);
      uvs.push(half + tu * .5, tv);
      colours.push(light, light, light);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeBoundingSphere();
  return geo;
}

// Two cut-off thresholds: mipmapping averages the leaf alpha down at a distance, so the coarse level, seen small,
// needs a lower threshold or its crowns dissolve into specks.
function foliageMaterials() {
  const map = foliageTexture();
  const leaf = (alphaTest: number) => {
    const material = new THREE.MeshLambertMaterial({vertexColors: true, map, alphaTest, alphaToCoverage: true, side: THREE.DoubleSide});
    // Back faces keep the crown's volume normal; the default flip would light the far side of each card from inside.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    };
    material.customProgramCacheKey = () => 'tree-leaf-cards-v1';
    return material;
  };
  const depth = (alphaTest: number) => new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide});
  return {near: {leaf: leaf(.4), depth: depth(.5)}, far: {leaf: leaf(.12), depth: depth(.2)}};
}

function treeColour(t: Tree, conifer: boolean, colour: THREE.Color) {
  const [x, z] = t.p, pick = hash(x, z, 2);
  if (conifer) colour.set(CONIFERS[Math.floor(pick * CONIFERS.length)]);
  // Large spreading crowns are the likeliest willows, so they take the yellow-green more often.
  else if (hash(x, z, 5) < (t.r >= 4.5 ? .24 : .1)) colour.set(YELLOW);
  else colour.set(BROADLEAF[Math.floor(pick * BROADLEAF.length)]);
  return colour.multiplyScalar(.9 + .2 * hash(x, z, 6));
}

const radiusOf = (t: Tree) => Math.min(6, Math.max(1, t.r)), heightOf = (t: Tree) => Math.min(25, t.h);
const aspectOf = (t: Tree, con: number) => {
  const ratio = heightOf(t) / radiusOf(t);
  return ASPECTS[con].reduce((best, a, i) => Math.abs(Math.log(a / ratio)) < Math.abs(Math.log(ASPECTS[con][best] / ratio)) ? i : best, 0);
};

function placeCrown(dummy: THREE.Object3D, t: Tree, con: number, ox: number, oz: number, base: number) {
  const [x, z] = t.p, r = radiusOf(t), aspect = ASPECTS[con][aspectOf(t, con)];
  dummy.rotation.set(0, hash(x, z, 7) * 6.283, 0);
  dummy.position.set(x - ox, t.z - base, z - oz);
  dummy.scale.set(r * (.94 + .12 * hash(x, z, 3)), heightOf(t) / aspect, r * (.94 + .12 * hash(x, z, 4)));
  dummy.updateMatrix();
}

interface Chunk {
  group: THREE.Group;
  levels: THREE.Group[];
  centre: THREE.Vector3;
  trunks: THREE.InstancedMesh;
  level: number;
}

export function addTrees(parent: THREE.Object3D, trees: Tree[], frame: WorldFrame) {
  const [ox, oz] = frame.origin, base = frame.base;
  const materials = foliageMaterials(), bark = new THREE.MeshStandardMaterial({color: '#5c4f45', roughness: 1});
  const geometries = ASPECTS.map((aspects, con) => aspects.map(aspect => [0, 1, 2].map(level => crownGeometry(!!con, aspect, level))));
  const crowns = (geometry: THREE.BufferGeometry, count: number, level: number) => {
    const {leaf, depth} = level ? materials.near : materials.far, mesh = new THREE.InstancedMesh(geometry, leaf, count);
    mesh.customDepthMaterial = depth;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  };
  const cells = new Map<string, Tree[]>(), dummy = new THREE.Object3D(), colour = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  for (const t of trees) {
    if (t.h < 3) continue;
    const key = Math.floor(t.p[0] / 90) + ',' + Math.floor(t.p[1] / 90);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(t);
  }
  const chunks: Chunk[] = [];
  for (const list of cells.values()) {
    const group = new THREE.Group(), levels = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    levels.forEach(l => group.add(l));
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.55, 1, 1, 6), bark, list.length * 6);
    let ti = 0;
    for (const t of list) {
      const x = t.p[0] - ox, z = t.p[1] - oz, y = t.z - base, h = heightOf(t), r = radiusOf(t), conifer = t.type === CONIFER;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y + h * (conifer ? .45 : .3), z);
      dummy.scale.set(.1 + r * .03, h * (conifer ? .9 : .6), .1 + r * .03);
      dummy.updateMatrix();
      trunks.setMatrixAt(ti++, dummy.matrix);
      // Limbs fan out into the crown and show through the gaps between leaf cards.
      if (conifer) continue;
      for (let j = 0; j < 5; j++) {
        const a = j * 1.2566 + hash(t.p[0], t.p[1], 8) * 6.28, rise = .3 + .06 * j;
        const start = new THREE.Vector3(x, y + h * rise, z), end = new THREE.Vector3(x + Math.cos(a) * r * .62, y + h * (rise + .3), z + Math.sin(a) * r * .62);
        dir.subVectors(end, start);
        dummy.position.copy(start).add(end).multiplyScalar(.5);
        dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize());
        dummy.scale.set(.05 + r * .012, dir.length(), .05 + r * .012);
        dummy.updateMatrix();
        trunks.setMatrixAt(ti++, dummy.matrix);
      }
    }
    trunks.count = ti;
    trunks.computeBoundingSphere();
    trunks.castShadow = true;
    group.add(trunks);
    for (let con = 0; con < 2; con++) for (let aspect = 0; aspect < ASPECTS[con].length; aspect++) {
      const subset = list.filter(t => (t.type === CONIFER ? 1 : 0) === con && aspectOf(t, con) === aspect);
      if (!subset.length) continue;
      for (let level = 0; level < 3; level++) {
        const mesh = crowns(geometries[con][aspect][level], subset.length, level);
        subset.forEach((t, i) => {
          placeCrown(dummy, t, con, ox, oz, base);
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, treeColour(t, !!con, colour));
        });
        mesh.computeBoundingSphere();
        levels[level].add(mesh);
      }
    }
    const centre = new THREE.Vector3(list[0].p[0] - ox, 0, list[0].p[1] - oz);
    parent.add(group);
    chunks.push({group, levels, centre, trunks, level: -1});
  }
  const distant = new THREE.Group(), farCells = new Map<string, {con: number; aspect: number; list: Tree[]}>();
  parent.add(distant);
  for (const t of trees) {
    if (t.h < 3) continue;
    const con = t.type === CONIFER ? 1 : 0, aspect = aspectOf(t, con), key = Math.floor(t.p[0] / 360) + ',' + Math.floor(t.p[1] / 360) + ',' + con + ',' + aspect;
    if (!farCells.has(key)) farCells.set(key, {con, aspect, list: []});
    farCells.get(key)!.list.push(t);
  }
  for (const {con, aspect, list} of farCells.values()) {
    const mesh = crowns(geometries[con][aspect][0], list.length, 0);
    mesh.castShadow = false;
    list.forEach((t, i) => {
      placeCrown(dummy, t, con, ox, oz, base);
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, treeColour(t, !!con, colour));
    });
    mesh.computeBoundingSphere();
    distant.add(mesh);
  }
  let farMode = false;
  return {
    update(target: THREE.Vector3, pixelsPerMetre: number) {
      let changed = false;
      const far = pixelsPerMetre <= 1.3;
      distant.visible = far;
      for (const chunk of chunks) chunk.group.visible = !far;
      if (far !== farMode) { changed = true; farMode = far; }
      if (far) return changed;
      for (const chunk of chunks) {
        const distance = Math.hypot(chunk.centre.x - target.x, chunk.centre.z - target.z);
        const level = pixelsPerMetre > 5 && distance < 140 ? 2 : pixelsPerMetre > 1.3 && distance < 350 ? 1 : 0;
        if (level !== chunk.level) {
          chunk.level = level;
          chunk.levels.forEach((g, i) => g.visible = i === level);
          chunk.trunks.visible = pixelsPerMetre > .8;
          changed = true;
        }
      }
      return changed;
    },
  };
}
