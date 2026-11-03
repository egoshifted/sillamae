import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {frameOpening, type FrameMaterial} from '../shared/opening-frame.ts';
import {applyWindowLintels} from '../kesk5/lintel-surfaces.ts';
import {design as sister} from '../kesk5/config.ts';
import type {Study} from '../kesk5/types.ts';
import {createBuilding} from './model.ts';

export function createOpenings(context: OverrideContext, detailed = false) {
  const shell = createBuilding(context, true, detailed), root = shell.root as Study;
  const audit = root.userData.audit;
  const palette = {
    reveal: 0xc7c8c0, frame: 0xd6d8d3, stair: 0x918e7c, sill: 0x969d9a,
    door: 0x584539, trim: 0x403733, metal: 0x999a91,
  };
  type Finish = keyof typeof palette;
  const parts = new Map<Finish, THREE.Matrix4[]>();
  const transform = new THREE.Object3D();
  const plan = audit.localFootprint;
  const handed = Math.sign(plan.reduce((sum, a, i) => {
    const b = plan[(i+1) % plan.length];
    return sum + a[0]*b[1] - b[0]*a[1];
  }, 0));
  function solid(edge: number, x: number, y: number, w: number, h: number, out: number, depth: number, finish: Finish) {
    const a = plan[edge], b = plan[(edge+1) % plan.length];
    const length = Math.hypot(b[0]-a[0], b[1]-a[1]);
    const ux = (b[0]-a[0])/length, uz = (b[1]-a[1])/length;
    transform.position.set(a[0]+ux*(x+w/2)+handed*uz*out, y+h/2, a[1]+uz*(x+w/2)-handed*ux*out);
    transform.rotation.y = -Math.atan2(uz, ux);
    transform.scale.set(w, h, depth);
    transform.updateMatrix();
    if (!parts.has(finish)) parts.set(finish, []);
    parts.get(finish)!.push(transform.matrix.clone());
  }
  const photographedEdge = audit.facadeEdges.find(f => f.type === 'entrance' && f.section === 3)!.edge;
  for (const opening of audit.openings) {
    if (opening.kind === 'window' || opening.kind === 'stair') {
      const mullions = opening.kind === 'window' && opening.column === 1 ? [.33, .67] : [.5];
      const frame = (edge: number, x: number, y: number, w: number, h: number, out: number, depth: number, mat: FrameMaterial) =>
        solid(edge, x, y, w, h, out, depth, mat === 'frame' && opening.kind === 'stair' ? 'stair' : mat);
      frameOpening({...opening, kind: opening.kind}, frame, mullions, 1.02);
    }
    if (opening.kind !== 'entrance' || (!detailed && opening.edge !== photographedEdge)) continue;
    const {edge, x, y, w, h} = opening, jamb = .055, bottom = .15;
    const leaf = (w-2*jamb-.016)/2;
    for (const side of [x, x+w-jamb]) solid(edge, side, y+bottom, jamb, h-bottom, -.11, .22, 'trim');
    solid(edge, x+jamb, y+h-jamb, w-2*jamb, jamb, -.11, .22, 'trim');
    for (const start of [x+jamb, x+jamb+leaf+.016]) {
      solid(edge, start, y+bottom, leaf, h-bottom-jamb, -.18, .045, 'door');
      if (edge === photographedEdge) solid(edge, start+.012, y+bottom+.015, leaf-.024, .16, -.154, .008, 'metal');
    }
    if (edge === photographedEdge) solid(edge, x+w/2-.09, y+bottom+.94, .035, .12, -.13, .06, 'metal');
  }
  const lintel = new THREE.MeshStandardMaterial({color: 0xb6b6ae, roughness: 1});
  applyWindowLintels(root, sister, lintel, mesh => !mesh.userData.basePart);
  const unit = new THREE.BoxGeometry(), batches: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
  for (const [finish, matrices] of parts) {
    const material = new THREE.MeshStandardMaterial({color: palette[finish], roughness: finish === 'metal' ? .55 : .85});
    const mesh = new THREE.InstancedMesh(unit, material, matrices.length);
    mesh.name = 'kajaka8-opening-' + finish;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mesh.receiveShadow = true;
    batches.push(mesh);
    root.add(mesh);
  }
  return {...shell, dispose() {
    for (const mesh of batches) { root.remove(mesh); mesh.dispose(); mesh.material.dispose(); }
    unit.dispose(); lintel.dispose(); shell.dispose();
  }};
}
