import * as THREE from 'three';
import {carveGroundPatches, concat} from '../../../engine/survey/carve.ts';
import type {BuildingOverride, Point2} from '../../../engine/types.ts';
import {createRodina} from './model.ts';
import {prepareRodinaGround} from './ground.ts';

export const rodinaPlacement = {origin: [304, 594] as Point2, angle: .40919415678848364, datum: 14.5};
const {origin, angle, datum} = rodinaPlacement;
const toSource = ([u, v]: Point2): Point2 => [origin[0] + u * Math.cos(angle) - v * Math.sin(angle), origin[1] + u * Math.sin(angle) + v * Math.cos(angle)];
const footprint: Point2[] = [[0,0],[21.4,0],[21.4,21.65],[17.8,21.65],[17.8,45.47],[3.95,45.47],[3.95,21.65],[0,21.65],[0,17.43],[-23.92,17.43],[-23.92,3.93],[0,3.93]];

function prepare(root: ReturnType<typeof createRodina>, pick: number) {
  const offsets: Record<string, number> = {};
  root.traverse(o => {
    if (o instanceof THREE.Mesh) o.geometry.setAttribute('building', new THREE.BufferAttribute(new Uint16Array(o.geometry.attributes.position.count).fill(pick), 1));
  });
  const concrete = root.children.find(o => o.name === 'rodina-detail-concrete') as THREE.Mesh;
  const lift = new Float32Array(concrete.geometry.attributes.position.count);
  for (const f of root.userData.audit.features) {
    const offset = offsets[f.material] || 0;
    if (f.material === 'concrete' && /flight|threshold/.test(f.name)) lift.fill(1, offset, offset + f.vertices);
    offsets[f.material] = offset + f.vertices;
  }
  concrete.geometry.setAttribute('rodinaLift', new THREE.BufferAttribute(lift, 1));
  const material = concrete.material as THREE.MeshStandardMaterial, compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    // Match the survey's depth lift without moving the approved stair geometry.
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float rodinaLift;').replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z += projectionMatrix[2][2] * rodinaLift;');
  };
  material.customProgramCacheKey = () => 'rodina-concrete-lift-v1';
  return root;
}

export const rodina: BuildingOverride = {
  id: '213731733',
  carveSurvey(vertices) {
    const ground = prepareRodinaGround(vertices, {origin}, {fit: {angle}, localFootprint: footprint});
    return concat([carveGroundPatches(vertices, [ground.patch as Point2[]], 10), ground.vertices]);
  },
  build({scene, building, frame, changed}) {
    const root = new THREE.LOD();
    root.name = 'rodina';
    root.position.set(origin[0] - frame.origin[0], datum - frame.base, origin[1] - frame.origin[1]);
    root.rotation.y = -angle;
    const compact = prepare(createRodina({compact:true}), building.pick);
    root.addLevel(compact, 0);
    let full: ReturnType<typeof createRodina> | null = null, disposed = false, textures = true;
    root.update = camera => {
      const distance = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).distanceTo(new THREE.Vector3().setFromMatrixPosition(root.matrixWorld));
      const zoom = 'zoom' in camera ? Number(camera.zoom) : 1;
      // Atlas depth fitting moves orthographic cameras; framing remains the useful detail measure.
      const orthographic = (camera as THREE.OrthographicCamera).isOrthographicCamera ? camera as THREE.OrthographicCamera : null;
      const framing = orthographic ? (orthographic.top - orthographic.bottom) / (2 * Math.tan(35 * Math.PI / 360)) : null;
      if (root.levels[1]) root.levels[1].distance = framing ? 85 * distance / framing : 85;
      THREE.LOD.prototype.update.call(root, camera);
      const effectiveDistance = (framing ?? distance) / zoom;
      full?.userData.updateDetail(effectiveDistance);
    };
    root.userData.dispose = () => { disposed = true; compact.userData.dispose(); full?.userData.dispose(); root.clear(); scene.remove(root); };
    if (changed) root.userData.ready = new Promise<void>(resolve => setTimeout(() => {
      if (!disposed) {
        try {
          full = prepare(createRodina(), building.pick);
          full.userData.setTextures(textures);
          root.remove(compact); root.levels.length = 0;
          root.addLevel(full, 0); root.addLevel(compact, 85);
          full.visible = true; compact.visible = false;
          changed();
        } catch (e) { root.userData.detailError = String(e); changed(); }
      }
      resolve();
    }, 0));
    scene.add(root);
    return {root, groundPatches: [], ready: root.userData.ready, setTextures(on) { textures = on; compact.userData.setTextures(on); full?.userData.setTextures(on); }};
  },
  entrances() { return [[10.7,-.6],[22,10.85],[-.6,19.9]].map(p => toSource(p as Point2)); },
  view: {offset: [75,50,-90], span:85},
  detailShadows: true,
};
