import * as THREE from 'three';
import type {SurveyBucket} from '../data.ts';
import type {Point2} from '../types.ts';
import {contains} from '../road-demolition.ts';

type RGB = [number, number, number];
const PAINT = [[.57, .60, .58], [.81, .82, .75], [.89, .89, .81]].map(c => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace).toArray());

export class GroundColour {
  private cells = new Map<string, {x: number; z: number; colour: RGB}[]>();
  private roads = new Map<string, Point2[][]>();
  private terrain = new Map<string, {ring: Point2[]; height: number; natural: boolean}[]>();

  constructor(rings: Point2[][] = []) {
    for (const ring of rings) {
      const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
      for (let x = Math.floor((Math.min(...xs) - 1) / 4); x <= Math.floor((Math.max(...xs) + 1) / 4); x++)
        for (let z = Math.floor((Math.min(...zs) - 1) / 4); z <= Math.floor((Math.max(...zs) + 1) / 4); z++) {
          const key = `${x},${z}`;
          let cell = this.roads.get(key);
          if (!cell) this.roads.set(key, cell = []);
          cell.push(ring);
        }
    }
  }

  add(bucket: SurveyBucket) {
    for (let i = 0; i < bucket.position.length; i += 9) {
      if (bucket.building[i / 3]) continue;
      const colour = [0, 1, 2].map(c => (bucket.color[i + c] + bucket.color[i + c + 3] + bucket.color[i + c + 6]) / 3) as RGB;
      const natural = !PAINT.some(p => p.every((v, k) => Math.abs(v - colour[k]) < .04));
      const ring = [0, 3, 6].map(k => [bucket.position[i + k], bucket.position[i + k + 2]] as Point2);
      const triangle = {ring, natural, height: (bucket.position[i + 1] + bucket.position[i + 4] + bucket.position[i + 7]) / 3};
      const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
      for (let x = Math.floor(Math.min(...xs) / 4); x <= Math.floor(Math.max(...xs) / 4); x++)
        for (let z = Math.floor(Math.min(...zs) / 4); z <= Math.floor(Math.max(...zs) / 4); z++) {
          const key = `${x},${z}`;
          let cell = this.terrain.get(key);
          if (!cell) this.terrain.set(key, cell = []);
          cell.push(triangle);
        }
      if (!natural) continue;
      const x = (bucket.position[i] + bucket.position[i + 3] + bucket.position[i + 6]) / 3;
      const z = (bucket.position[i + 2] + bucket.position[i + 5] + bucket.position[i + 8]) / 3;
      const key = `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
      if ((this.roads.get(key) ?? []).some(r => [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dz]) => contains(r, x + dx, z + dz)))) continue;
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, cell = []);
      cell.push({x, z, colour});
    }
  }

  naturalAt(x: number, z: number) {
    const triangles = (this.terrain.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []).filter(t => contains(t.ring, x, z));
    return triangles.sort((a, b) => b.height - a.height)[0]?.natural === true;
  }

  at(x: number, z: number): RGB | undefined {
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4), found: {d: number; colour: RGB}[] = [];
    for (let reach = 1; reach <= 10; reach++) {
      for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) {
        if (reach > 1 && Math.max(Math.abs(dx), Math.abs(dz)) !== reach) continue;
        for (const p of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) found.push({d: Math.hypot(p.x - x, p.z - z), colour: p.colour});
      }
      if (found.length >= 8) break;
    }
    const nearest = found.sort((a, b) => a.d - b.d).slice(0, 8);
    if (!nearest.length) return undefined;
    const weight = nearest.reduce((s, p) => s + 1 / Math.max(.5, p.d) ** 2, 0);
    return [0, 1, 2].map(c => nearest.reduce((s, p) => s + p.colour[c] / Math.max(.5, p.d) ** 2, 0) / weight) as RGB;
  }
}
