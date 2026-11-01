import * as THREE from 'three';
import {decodeTile, fetchTile, tileBounds, type SurveyManifest, type WorldData} from '../../engine/data.ts';
import {clippingPlanes} from '../../engine/extent.ts';
import {addRoads, triangulate} from '../../engine/roads.ts';
import {addStairs} from '../../engine/stairs.ts';
import {addSurveyLayer, surveyMaterials} from '../../engine/survey/layer.ts';
import type {Point2} from '../../engine/types.ts';
import {usePhysicalDepth} from '../depth.ts';
import {city} from '../project.ts';

export interface Square {
  centre: Point2; // source x/z
  size: number; // metres
}

// Metres of context shown around the square; editing stays inside the square.
export const MARGIN = 15;
// Metres between ground height samples; finer than the 1 m rebuilt ground, so kerbs register.
const STEP = .25;

// Highest ground or road surface on a grid over the square, for snapping and for
// a ray to stop on: raycasting the town's million-triangle tiles per mouse move is too slow.
export class HeightField {
  readonly heights: Float32Array;
  readonly nx: number;
  readonly nz: number;
  readonly minX: number;
  readonly minZ: number;
  readonly size: number;
  low = Infinity;
  high = -Infinity;

  constructor(minX: number, minZ: number, size: number) {
    this.minX = minX;
    this.minZ = minZ;
    this.size = size;
    this.nx = this.nz = Math.ceil(size / STEP) + 1;
    this.heights = new Float32Array(this.nx * this.nz).fill(-Infinity);
  }

  add(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like) {
    const i0 = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - this.minX) / STEP)), i1 = Math.min(this.nx - 1, Math.floor((Math.max(a.x, b.x, c.x) - this.minX) / STEP));
    const j0 = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - this.minZ) / STEP)), j1 = Math.min(this.nz - 1, Math.floor((Math.max(a.z, b.z, c.z) - this.minZ) / STEP));
    if (i0 > i1 || j0 > j1) return;
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.minX + i * STEP, z = this.minZ + j * STEP;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const h = u * a.y + v * b.y + w * c.y, k = j * this.nx + i;
      if (h > this.heights[k]) this.heights[k] = h;
      if (h < this.low) this.low = h;
      if (h > this.high) this.high = h;
    }
  }

  #base: Float32Array | null = null;
  // Each sample becomes its loaded height plus shift(x, z), within the box if one is given.
  reshape(shift: (x: number, z: number) => number, box?: {minX: number; maxX: number; minZ: number; maxZ: number}) {
    const base = this.#base ??= this.heights.slice();
    const i0 = box ? Math.max(0, Math.floor((box.minX - this.minX) / STEP)) : 0, i1 = box ? Math.min(this.nx - 1, Math.ceil((box.maxX - this.minX) / STEP)) : this.nx - 1;
    const j0 = box ? Math.max(0, Math.floor((box.minZ - this.minZ) / STEP)) : 0, j1 = box ? Math.min(this.nz - 1, Math.ceil((box.maxZ - this.minZ) / STEP)) : this.nz - 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.nx + i;
      if (base[k] === -Infinity) continue;
      const h = base[k] + shift(this.minX + i * STEP, this.minZ + j * STEP);
      this.heights[k] = h;
      if (h < this.low) this.low = h;
      if (h > this.high) this.high = h;
    }
  }

  // -Infinity where no ground was found nearby.
  at(x: number, z: number) {
    const fx = (x - this.minX) / STEP, fz = (z - this.minZ) / STEP, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.nx - 1 || j >= this.nz - 1) return -Infinity;
    const corners = [this.heights[j * this.nx + i], this.heights[j * this.nx + i + 1], this.heights[(j + 1) * this.nx + i], this.heights[(j + 1) * this.nx + i + 1]];
    if (corners.some(h => h === -Infinity)) return Math.max(...corners);
    const tx = fx - i, tz = fz - j;
    return (corners[0] * (1 - tx) + corners[1] * tx) * (1 - tz) + (corners[2] * (1 - tx) + corners[3] * tx) * tz;
  }

  intersect(ray: THREE.Ray) {
    const box = new THREE.Box3(new THREE.Vector3(this.minX, this.low - 1, this.minZ), new THREE.Vector3(this.minX + this.size, this.high + 1, this.minZ + this.size));
    const entry = box.containsPoint(ray.origin) ? ray.origin.clone() : ray.intersectBox(box, new THREE.Vector3());
    if (!entry) return null;
    const start = entry.distanceTo(ray.origin), end = start + this.size * 3, p = new THREE.Vector3();
    let previous = start;
    for (let t = start; t <= end; t += STEP / 2) {
      ray.at(t, p);
      if (p.y < this.low - 1) break;
      const h = this.at(p.x, p.z);
      if (h === -Infinity || p.y > h) { previous = t; continue; }
      let lo = previous, hi = t;
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        ray.at(mid, p);
        if (p.y > this.at(p.x, p.z)) lo = mid; else hi = mid;
      }
      ray.at(hi, p);
      return {point: p.clone(), distance: hi};
    }
    return null;
  }
}

export async function loadSquare(world: WorldData, survey: SurveyManifest, square: Square, renderer: THREE.WebGLRenderer, progress: (text: string) => void) {
  const frame = {...city.frame, base: world.base}, [ox, oz] = frame.origin, [cx, cz] = square.centre, half = square.size / 2 + MARGIN;
  const box = {minX: cx - ox - half, maxX: cx - ox + half, minZ: cz - oz - half, maxZ: cz - oz + half};
  const inside = (x: number, z: number) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
  const scene = new THREE.Scene(), heights = new HeightField(box.minX, box.minZ, half * 2);
  const buildings = Math.max(...world.buildings.map(b => b.pick)) + 1;
  const materials = surveyMaterials(renderer.capabilities.getMaxAnisotropy(), buildings, world.base);
  const layer = addSurveyLayer(scene, survey.buckets, materials);
  const walls: number[] = [], wallPicks: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  // Survey cells, and so tile bounds, are in the local frame.
  const tiles = survey.tiles.filter(name => {
    const t = tileBounds(survey, name);
    return t.maxX >= box.minX && t.minX <= box.maxX && t.maxZ >= box.minZ && t.minZ <= box.maxZ;
  });
  for (const [n, name] of tiles.entries()) {
    progress(`Loading ground ${n + 1} of ${tiles.length}…`);
    for (const bucket of decodeTile(survey, name, await fetchTile('/data/', name), frame)) {
      layer.fill(bucket);
      const water = survey.buckets[bucket.index].kind === 'water', p = bucket.position;
      for (let i = 0; i < p.length; i += 9) {
        a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
        if (!inside((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3) && !inside(a.x, a.z) && !inside(b.x, b.z) && !inside(c.x, c.z)) continue;
        const pick = bucket.building[i / 3];
        if (pick) { walls.push(...p.subarray(i, i + 9)); wallPicks.push(pick, pick, pick); }
        else if (!water) heights.add(a, b, c);
      }
    }
  }
  layer.setLevel(2);

  progress('Roads, trees and buildings…');
  const roads = world.roads.filter(r => r.ring.some(([x, , z]) => inside(x, z)));
  const roadGroup = addRoads(scene, roads, renderer.capabilities.getMaxAnisotropy());
  for (const r of roads) for (const t of triangulate(r.ring)) {
    const [p, q, s] = t.map(k => r.ring[k]);
    heights.add({x: p[0], y: p[1], z: p[2]}, {x: q[0], y: q[1], z: q[2]}, {x: s[0], y: s[1], z: s[2]});
  }
  addStairs(scene, world.stairs.filter(s => inside(s.from[0], s.from[2]) || inside(s.to[0], s.to[2])));
  const trees = world.trees.filter(t => t.h >= 3 && inside(t.p[0] - ox, t.p[1] - oz));

  const refined: {id: string; root: THREE.Object3D}[] = [];
  for (const o of city.overrides) {
    const building = world.buildings.find(b => b.id === o.id), ground = world.siteGround[o.id];
    if (!building || !ground || !building.g.some(([x, z]) => inside(x - ox, z - oz))) continue;
    const built = o.build({scene, building: structuredClone(building), terrain: world.terrain, frame, ground, changed() {}});
    await Promise.all([built.ready, built.root.userData.ready]);
    if (!built.root.parent) scene.add(built.root);
    refined.push({id: o.id, root: built.root});
  }
  usePhysicalDepth(scene);
  renderer.clippingPlanes = clippingPlanes([[box.minX, box.minZ], [box.maxX, box.minZ], [box.maxX, box.maxZ], [box.minX, box.maxZ]]);

  // Walls are picked, never drawn: the survey layer already draws them.
  const wallGeometry = new THREE.BufferGeometry();
  wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
  wallGeometry.setAttribute('pick', new THREE.Float32BufferAttribute(wallPicks, 1));
  const wallMesh = new THREE.Mesh(wallGeometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  wallMesh.updateMatrixWorld();
  const byPick = new Map(world.buildings.map(b => [b.pick, b.id]));
  // The rebuilt ground runs on under buildings, so standing on ground is not enough.
  const footprints = world.buildings.filter(b => b.g.some(([x, z]) => inside(x - ox, z - oz))).map(b => b.g.map(([x, z]): Point2 => [x - ox, z - oz]));
  const indoors = (x: number, z: number) => footprints.some(g => {
    let inside = false;
    for (let i = 0, j = g.length - 1; i < g.length; j = i++) if ((g[i][1] > z) !== (g[j][1] > z) && x < (g[j][0] - g[i][0]) * (z - g[i][1]) / (g[j][1] - g[i][1]) + g[i][0]) inside = !inside;
    return inside;
  });
  // What the terrain brush reshapes while previewing: survey ground and buildings
  // (water keeps its level), roads, and the picking walls. Buildings move whole, by
  // the change at their centre, as the data build seats them.
  const shapeable: {mesh: THREE.Mesh; picks?: THREE.BufferAttribute}[] = [];
  scene.traverse(o => {
    if (!(o instanceof THREE.Mesh) || !o.parent?.visible) return;
    const g = o.geometry as THREE.BufferGeometry;
    if (g.attributes.layer && g.attributes.position && o.material !== materials.near.water) shapeable.push({mesh: o, picks: g.attributes.building as THREE.BufferAttribute});
  });
  roadGroup.traverse(o => { if (o instanceof THREE.Mesh) shapeable.push({mesh: o}); });
  shapeable.push({mesh: wallMesh, picks: wallGeometry.attributes.pick as THREE.BufferAttribute});
  const centres = new Map(world.buildings.map(b => [b.pick, [b.c[0] - ox, b.c[1] - oz] as Point2]));
  return {scene, heights, wallMesh, refined, trees, byPick, box, frame, indoors, shapeable, centres};
}
