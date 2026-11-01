import * as THREE from 'three';
import type {RoadKind, RoadSurface} from './data.ts';

const LOOK: Record<RoadKind, [string, number]> = {carriageway: ['#5f625f', .95], footway: ['#a9a9a1', .95], marking: ['#e4e4dc', .8]};

export function addRoads(scene: THREE.Scene, surfaces: RoadSurface[]) {
  const group = new THREE.Group();
  group.name = 'roads';
  for (const kind of Object.keys(LOOK) as RoadKind[]) {
    const own = surfaces.filter(s => s.kind === kind);
    if (!own.length) continue;
    const mesh = new THREE.Mesh(surfaceGeometry(own), lifted(...LOOK[kind]));
    mesh.receiveShadow = true;
    group.add(mesh);
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

// The data build lays markings on these same triangles.
export const triangulate = (ring: RoadSurface['ring']) => THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[2])), []);

function surfaceGeometry(surfaces: RoadSurface[]) {
  const position: number[] = [], lift: number[] = [];
  for (const {ring, lift: l} of surfaces) {
    for (const t of triangulate(ring)) {
      const [a, b, c] = t.map(i => ring[i]);
      // Upward faces wind clockwise in (x, z).
      const up = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0;
      for (const p of up ? [a, b, c] : [a, c, b]) { position.push(...p); lift.push(l); }
    }
  }
  // Outline-only triangulation leaves long slivers; facet normals would shade their slight tilts as streaks.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: position.length / 3}, () => [0, 1, 0]).flat(), 3));
  g.setAttribute('lift', new THREE.Float32BufferAttribute(lift, 1));
  return g;
}
