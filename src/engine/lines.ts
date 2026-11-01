import * as THREE from 'three';
import type {BuiltLine} from './data.ts';
import type {LineKind} from './types.ts';

// Fences, hedges, low walls and kerbs drawn in the studio. Each run follows the
// ground point by point, so its foot never floats on a slope.
export const LINE_HEIGHT: Record<LineKind, number> = {fence: 1.2, hedge: 1.1, wall: .6, kerb: .12};
const LOOK: Record<LineKind, {color: string; roughness: number; width: number}> = {
  fence: {color: '#3d4a3d', roughness: .6, width: .04},
  hedge: {color: '#4f6b3a', roughness: 1, width: .8},
  wall: {color: '#a9a59b', roughness: .95, width: .3},
  kerb: {color: '#a4a39c', roughness: .9, width: .15},
};
const FOOT = .25; // metres below the ground, so a run's foot stays buried between its points
const POST = {every: 2.5, size: .07}; // fence posts, metres
// Depth-only lift over the survey ground's own (see placements.ts).
const DEPTH_LIFT = 1;

// A box along a-b, standing from bottom to top above each end's ground, so it bends with the slope.
function run(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, width: number, bottom: number, top: number, out: number[]) {
  const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
  if (length < 1e-4) return;
  const sx = -dz / length * width / 2, sz = dx / length * width / 2;
  const c = (p: THREE.Vector3Tuple, side: number, y: number): THREE.Vector3Tuple => [p[0] + sx * side, p[1] + y, p[2] + sz * side];
  const [a0, a1, a2, a3] = [c(a, -1, bottom), c(a, 1, bottom), c(a, 1, top), c(a, -1, top)];
  const [b0, b1, b2, b3] = [c(b, -1, bottom), c(b, 1, bottom), c(b, 1, top), c(b, -1, top)];
  const quad = (p: THREE.Vector3Tuple, q: THREE.Vector3Tuple, r: THREE.Vector3Tuple, s: THREE.Vector3Tuple) => out.push(...p, ...q, ...r, ...p, ...r, ...s);
  quad(a3, a2, b2, b3); quad(a0, a3, b3, b0); quad(a1, b1, b2, a2); quad(a0, a1, a2, a3); quad(b1, b0, b3, b2);
}

const hash = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// Local positions, one merged mesh per kind; lifted adds the atlas depth lift.
export function lineMeshes(lines: BuiltLine[], {lifted = true} = {}) {
  const group = new THREE.Group(), positions: Record<LineKind, number[]> = {fence: [], hedge: [], wall: [], kerb: []};
  for (const line of lines) {
    const {width} = LOOK[line.kind], h = line.height, out = positions[line.kind], p = line.points;
    if (line.kind === 'fence') {
      for (let i = 1; i < p.length; i++) for (const y of [.3 * h, .85 * h]) run(p[i - 1], p[i], width, y, y + .05, out);
      let travelled = 0, next = 0;
      for (let i = 0; i < p.length; i++) {
        if (i) travelled += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
        if (travelled + 1e-6 < next && i !== p.length - 1) continue;
        run([p[i][0] - POST.size / 2, p[i][1], p[i][2]], [p[i][0] + POST.size / 2, p[i][1], p[i][2]], POST.size, -FOOT, h, out);
        next = travelled + POST.every;
      }
    } else for (let i = 1; i < p.length; i++) {
      // Hedges are trimmed unevenly; walls and kerbs are not.
      const top = line.kind === 'hedge' ? h * (.92 + .16 * hash(p[i][0], p[i][2])) : h;
      run(p[i - 1], p[i], width, -FOOT, top, out);
    }
  }
  for (const kind of Object.keys(positions) as LineKind[]) {
    if (!positions[kind].length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions[kind], 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({color: LOOK[kind].color, roughness: LOOK[kind].roughness});
    if (lifted) {
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * ${DEPTH_LIFT}.;`);
      };
      material.customProgramCacheKey = () => 'line-lift';
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = kind;
    group.add(mesh);
  }
  return group;
}

// Stands a line on the ground: a point at each corner and every step metres between.
export function standLine(points: [number, number][], heightAt: (x: number, z: number) => number | null, step = 1) {
  const out: [number, number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    if (i) {
      const [px, pz] = points[i - 1], n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / step));
      for (let k = 1; k < n; k++) out.push([px + (x - px) * k / n, 0, pz + (z - pz) * k / n]);
    }
    out.push([x, 0, z]);
  }
  for (const p of out) p[1] = heightAt(p[0], p[2]) ?? 0;
  return out;
}
