import * as THREE from 'three';
import {carveGroundPatches, concat, groundWithin} from '../../../engine/survey/carve.ts';
import type {BuildingOverride, GroundTriangle, Point2} from '../../../engine/types.ts';
import {design, balconySchedule} from './config.ts';
import {createOffsetSlabStudy} from './offset-slab.ts';
import {createEntranceDetailStudy} from './entrance-detail.ts';
import {batchDetailStudy} from '../../../studio/assembly/batch.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import {prepareKesk5Ground} from './ground.ts';
import {preloadSurfaces, surfaces} from './surfaces.ts';

const plain = createOffsetSlabStudy(design), audit = plain.userData.audit;
plain.userData.dispose();

function toSource([x, z]: Point2): Point2 {
  const c = Math.cos(audit.fit.angle), s = Math.sin(audit.fit.angle);
  return [design.origin[0] + x * c - z * s, design.origin[1] + x * s + z * c];
}

function entrancePoints(out = .4) {
  const g: Point2[] = audit.localFootprint;
  const sign = Math.sign(g.reduce((s, a, i) => { const b = g[(i + 1) % g.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
  return design.facades.filter(f => f.type === 'entrance').map(f => {
    const a = g[f.edge], b = g[(f.edge + 1) % g.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return toSource([(a[0] + b[0]) / 2 + sign * (b[1] - a[1]) / length * out,
      (a[1] + b[1]) / 2 - sign * (b[0] - a[0]) / length * out]);
  });
}

// Kesk 5 stands on a foundation whose top is the ground at its entrances, the
// median of their heights. It first came from a standalone study at a fixed
// 11.81 m and flattened the survey around it to that height, sinking it up to
// 1.5 m into the terrain model, which rises about a metre from its west section
// to its east one. The ground is read DATUM_OUT out from each entrance, beyond
// the site works' grading, so the data build, the atlas and the studio all read
// the same ungraded ground.
const FLAT_DROP = .015, NO_GROUND_DATUM = 11.81, DATUM_OUT = 4, FOUNDATION_BELOW = .4; // metres
const datumPoints = () => entrancePoints(DATUM_OUT);
const entranceBox = () => {
  const xs = datumPoints().map(p => p[0]), zs = datumPoints().map(p => p[1]);
  return {minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1, minZ: Math.min(...zs) - 1, maxZ: Math.max(...zs) + 1};
};
export const kesk5Datum = (ground: GroundTriangle[]) => entranceDatum(ground, datumPoints()) ?? NO_GROUND_DATUM;

// The foundation (wall base and facade projections) reaches below the lowest ground along the walls.
function foundationBase(ground: GroundTriangle[], datum: number) {
  const g = design.footprint, heights: number[] = [];
  g.forEach((p, i) => { const q = g[(i + 1) % g.length]; for (let t = 0; t < 1; t += .1) { const h = entranceDatum(ground, [[p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]]); if (h !== null) heights.push(h); } });
  return Math.min(design.basement.wallBase, (heights.length ? Math.min(...heights) : datum) - datum - FOUNDATION_BELOW);
}

export const kesk5: BuildingOverride = {
  id: design.id,
  carveSurvey(vertices) {
    const datum = entranceDatum(groundWithin(vertices, entranceBox()), datumPoints()) ?? NO_GROUND_DATUM;
    const ground = prepareKesk5Ground(vertices, design, audit, datum - FLAT_DROP);
    // Keep the sea plane beneath the local site, and leave its original triangles intact.
    return concat([carveGroundPatches(vertices, [ground.patch as Point2[]], 10), ground.vertices]);
  },
  preload: preloadSurfaces,
  build({scene, frame, ground, changed}) {
    const {masonry, roof, ready} = surfaces(), datum = kesk5Datum(ground), base = foundationBase(ground, datum);
    const spec = {...design, basement: {...design.basement, wallBase: base}, facadeRelief: {...design.facadeRelief, baseDatum: base}};
    const root = createEntranceDetailStudy(spec, balconySchedule, masonry, roof);
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
    root.position.set(design.origin[0] - frame.origin[0], datum - frame.base, design.origin[1] - frame.origin[1]);
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
  entrances: () => entrancePoints(),
  view: {offset: [85, 55, -110], span: 80},
  detailShadows: true,
  seatsOnGround: true,
};
