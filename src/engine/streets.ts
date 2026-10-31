import * as THREE from 'three';
import type {LocalPoint, Streets} from './data.ts';

const KERB = {width: .15, rise: .12, skirt: .35};
const EDGE_SKIRT = .3;
const MARKING_RISE = .01;

export function addStreets(scene: THREE.Scene, streets: Streets) {
  const group = new THREE.Group();
  group.name = 'streets';
  const material = (color: string, roughness: number) => {
    const m = new THREE.MeshStandardMaterial({color, roughness});
    m.userData.groundSurface = true;
    return m;
  };
  const asphalt = material('#5f625f', .95), kerb = material('#b7b6ad', .9), paint = material('#e4e4dc', .8);
  const tarmac = material('#696c68', .95), paving = material('#a9a9a1', .95), gravel = material('#b5ab93', 1);
  paint.polygonOffset = true;
  paint.polygonOffsetFactor = paint.polygonOffsetUnits = -2;
  const surfaceLayers = [[streets.carriageways, asphalt, 0], [streets.markings, paint, MARKING_RISE], [streets.footways, tarmac, 0], [streets.pavers, paving, 0], [streets.paths, gravel, 0]] as const;
  for (const [polygons, m, rise] of surfaceLayers) {
    if (!polygons.length) continue;
    const mesh = new THREE.Mesh(surfaces(polygons, rise), m);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (streets.kerbs.length) {
    const mesh = new THREE.Mesh(kerbs(streets.kerbs), kerb);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (streets.edges.length) {
    const mesh = new THREE.Mesh(skirts(streets.edges), paving);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

function surfaces(polygons: LocalPoint[][][], rise: number) {
  const position: number[] = [];
  for (const [outer, ...holes] of polygons) {
    const points = [outer, ...holes].flat(), v2 = (r: LocalPoint[]) => r.map(p => new THREE.Vector2(p[0], p[2]));
    for (const t of THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2))) {
      const [a, b, c] = t.map(i => points[i]);
      // Upward faces wind clockwise in (x, z); ShapeUtils keeps the outline's winding.
      const up = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0;
      for (const p of up ? [a, b, c] : [a, c, b]) position.push(p[0], p[1] + rise, p[2]);
    }
  }
  // Outline-only triangulation leaves long slivers; facet normals would shade their slight tilts as streaks.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: position.length / 3}, () => [0, 1, 0]).flat(), 3));
  return g;
}

// Runs have their surface on the left; the outward normal is to the right.
const outward = (run: LocalPoint[]) => run.map((_, i) => {
  const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
});

function kerbs(runs: LocalPoint[][]) {
  const position: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => position.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const run of runs) {
    const out = outward(run), ring = run.map((p, i) => {
      const [nx, nz] = out[i], top = p[1] + KERB.rise, ox = p[0] + nx * KERB.width, oz = p[2] + nz * KERB.width;
      return {inBottom: [p[0], p[1], p[2]], inTop: [p[0], top, p[2]], outTop: [ox, top, oz], outBottom: [ox, p[1] - KERB.skirt, oz]};
    });
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      quad(a.inBottom, b.inBottom, b.inTop, a.inTop);
      quad(a.inTop, b.inTop, b.outTop, a.outTop);
      quad(a.outTop, b.outTop, b.outBottom, a.outBottom);
    }
  }
  return geometry(position);
}

// Footways sit a little above or below the cut survey ground; a skirt closes the gap at their edge.
function skirts(runs: LocalPoint[][]) {
  const position: number[] = [];
  for (const run of runs) for (let i = 1; i < run.length; i++) {
    const [a, b] = [run[i - 1], run[i]], low = (p: LocalPoint) => [p[0], p[1] - EDGE_SKIRT, p[2]];
    position.push(...a, ...b, ...low(b), ...a, ...low(b), ...low(a));
  }
  return geometry(position);
}

function geometry(position: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.computeVertexNormals();
  return g;
}
