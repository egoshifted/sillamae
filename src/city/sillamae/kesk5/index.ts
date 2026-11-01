import * as THREE from 'three';
import {carveGroundPatches, concat, groundWithin} from '../../../engine/survey/carve.ts';
import type {BuildingOverride, GroundTriangle, Point2} from '../../../engine/types.ts';
import {design, balconySchedule} from './config.ts';
import {createOffsetSlabStudy} from './offset-slab.ts';
import {createEntranceDetailStudy} from './entrance-detail.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {prepareKesk5Ground} from './ground.ts';
import {preloadSurfaces, surfaces} from './surfaces.ts';

const plain = createOffsetSlabStudy(design), audit = plain.userData.audit;
plain.userData.dispose();

function toSource([x, z]: Point2): Point2 {
  const c = Math.cos(audit.fit.angle), s = Math.sin(audit.fit.angle);
  return [design.origin[0] + x * c - z * s, design.origin[1] + x * s + z * c];
}

function entrancePoints() {
  const g: Point2[] = audit.localFootprint;
  const sign = Math.sign(g.reduce((s, a, i) => { const b = g[(i + 1) % g.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
  return design.facades.filter(f => f.type === 'entrance').map(f => {
    const a = g[f.edge], b = g[(f.edge + 1) % g.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return toSource([(a[0] + b[0]) / 2 + sign * (b[1] - a[1]) / length * .4,
      (a[1] + b[1]) / 2 - sign * (b[0] - a[0]) / length * .4]);
  });
}

// Kesk 5 stands on the ground at its entrances, the median of their heights.
// It first came from a standalone study at a fixed 11.81 m and flattened the
// survey around it to that height, sinking it up to 1.5 m into the terrain
// model, which rises about a metre from its west section to its east one.
// The site works grade the ground near the walls to FLAT_DROP below the datum,
// so the datum read back from that graded ground adds it again.
const FLAT_DROP = .015, NO_GROUND_DATUM = 11.81, SEA_PLANE = 200; // metres
function entranceGround(ground: GroundTriangle[]) {
  const heights = entrancePoints().flatMap(([x, z]) => {
    let low = Infinity;
    for (const [x1, z1, h1, x2, z2, h2, x3, z3, h3] of ground) {
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      // The sea-level plane lies beneath the whole town in kilometre-wide triangles.
      if (Math.abs(d) < 1e-9 || Math.max(x1, x2, x3) - Math.min(x1, x2, x3) > SEA_PLANE) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, c = 1 - a - b;
      if (Math.min(a, b, c) >= -1e-6) low = Math.min(low, a * h1 + b * h2 + c * h3);
    }
    return low === Infinity ? [] : [low];
  }).sort((a, b) => a - b);
  const n = heights.length;
  return n ? (heights[(n - 1) >> 1] + heights[n >> 1]) / 2 : null;
}
const entranceBox = () => {
  const xs = entrancePoints().map(p => p[0]), zs = entrancePoints().map(p => p[1]);
  return {minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1, minZ: Math.min(...zs) - 1, maxZ: Math.max(...zs) + 1};
};
export const kesk5Datum = (ground: GroundTriangle[]) => {
  const h = entranceGround(ground);
  return h === null ? NO_GROUND_DATUM : h + FLAT_DROP;
};

export const kesk5: BuildingOverride = {
  id: design.id,
  carveSurvey(vertices) {
    const datum = entranceGround(groundWithin(vertices, entranceBox())) ?? NO_GROUND_DATUM;
    const ground = prepareKesk5Ground(vertices, design, audit, datum - FLAT_DROP);
    // Keep the sea plane beneath the local site, and leave its original triangles intact.
    return concat([carveGroundPatches(vertices, [ground.patch as Point2[]], 10), ground.vertices]);
  },
  preload: preloadSurfaces,
  build({scene, frame, ground, changed}) {
    const {masonry, roof, ready} = surfaces();
    const root = createEntranceDetailStudy(design, balconySchedule, masonry, roof);
    const stepMaterials = new Map<THREE.Material, THREE.Material>();
    root.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh) || !['landing', 'detail-entry-step'].includes(o.name)) return;
      if (!stepMaterials.has(o.material)) {
        const material = o.material.clone();
        // Survey layers have a depth lift; without the stairs' 1 m lift they can show through the steps.
        material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * 1.;');
        };
        stepMaterials.set(o.material, material);
      }
      o.material = stepMaterials.get(o.material);
    });
    const dispose = root.userData.dispose;
    root.userData.dispose = () => { dispose(); stepMaterials.forEach(m => m.dispose()); };
    batchDetailStudy(root);
    root.name = 'kesk5';
    root.position.set(design.origin[0] - frame.origin[0], kesk5Datum(ground) - frame.base, design.origin[1] - frame.origin[1]);
    root.rotation.y = -audit.fit.angle;
    scene.add(root);
    const materials = new Set<THREE.MeshStandardMaterial>();
    root.traverse((o: THREE.Object3D) => { if (o instanceof THREE.Mesh) materials.add(o.material); });
    for (const m of materials) Object.assign(m.userData, {map: m.map, bumpMap: m.bumpMap});
    // Texture downloads must not delay the plain preview or make the town fail to start.
    root.userData.ready = ready.then(() => changed?.());
    return {root, groundPatches: [], setTextures(enabled) {
      for (const m of materials) {
        m.map = enabled ? m.userData.map : null;
        m.bumpMap = enabled ? m.userData.bumpMap : null;
        m.needsUpdate = true;
      }
    }};
  },
  entrances: entrancePoints,
  view: {offset: [85, 55, -110], span: 80},
  detailShadows: true,
  seatsOnGround: true,
};
