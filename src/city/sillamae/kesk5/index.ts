import * as THREE from 'three';
import {carveGroundPatches, concat} from '../../../engine/survey/carve.ts';
import type {BuildingOverride, Point2} from '../../../engine/types.ts';
import {design, balconySchedule} from './config.ts';
import {createOffsetSlabStudy} from './offset-slab.ts';
import {createEntranceDetailStudy} from './entrance-detail.ts';
import {batchDetailStudy} from './batch-detail.ts';
import {prepareKesk5Ground} from './ground.ts';
import {preloadSurfaces, surfaces} from './surfaces.ts';

const DATUM = 11.81;
const plain = createOffsetSlabStudy(design), audit = plain.userData.audit;
plain.userData.dispose();

function toSource([x, z]: Point2): Point2 {
  const c = Math.cos(audit.fit.angle), s = Math.sin(audit.fit.angle);
  return [design.origin[0] + x * c - z * s, design.origin[1] + x * s + z * c];
}

export const kesk5: BuildingOverride = {
  id: design.id,
  carveSurvey(vertices) {
    const ground = prepareKesk5Ground(vertices, design, audit);
    // Keep the sea plane beneath the local site, and leave its original triangles intact.
    return concat([carveGroundPatches(vertices, [ground.patch as Point2[]], 10), ground.vertices]);
  },
  preload: preloadSurfaces,
  build({scene, frame, changed}) {
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
    root.position.set(design.origin[0] - frame.origin[0], DATUM - frame.base, design.origin[1] - frame.origin[1]);
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
  entrances() {
    const g: Point2[] = audit.localFootprint;
    const sign = Math.sign(g.reduce((s, a, i) => { const b = g[(i + 1) % g.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
    return design.facades.filter(f => f.type === 'entrance').map(f => {
      const a = g[f.edge], b = g[(f.edge + 1) % g.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return toSource([(a[0] + b[0]) / 2 + sign * (b[1] - a[1]) / length * .4,
        (a[1] + b[1]) / 2 - sign * (b[0] - a[0]) / length * .4]);
    });
  },
  view: {offset: [85, 55, -110], span: 80},
  detailShadows: true,
};
