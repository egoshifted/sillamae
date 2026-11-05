import * as THREE from 'three';
import {createMassingStudy} from '../../../studio/assembly/massing.ts';
import {entranceDatum} from '../../../studio/assembly/seat.ts';
import type {OverrideContext, Point2} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {design} from './design.ts';
import {createShell} from './shell.ts';

export function createBuilding(context: OverrideContext, finished = true): StudyModel {
  const footprint = design.footprint!, points: Point2[] = [];
  footprint.forEach((p, i) => {
    const q = footprint[(i + 1) % footprint.length], count = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / .25);
    for (let j = 0; j < count; j++) points.push([p[0] + (q[0] - p[0]) * j / count, p[1] + (q[1] - p[1]) * j / count]);
  });
  const heights = points.map(p => entranceDatum(context.ground, [p]));
  if (heights.some(h => h === null)) throw Error('Kajaka 8a needs ground coverage around its complete footprint');
  // Entrance positions are not verified yet; perimeter sampling supplies a provisional level only.
  const datum = entranceDatum(context.ground, points)!, bottom = Math.min(...heights as number[]) - .25;
  const walls = createShell(context.building.c, finished);
  walls.root.position.set(context.building.c[0] - context.frame.origin[0], datum - context.frame.base, context.building.c[1] - context.frame.origin[1]);
  const foundation = createMassingStudy(context, {footprint, datum: bottom, height: datum - bottom});
  walls.root.name = 'shell'; foundation.root.name = 'foundation';
  const foot = foundation.root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  foot.name = 'foundation-solid'; foot.material.name = 'Plain foundation'; foot.material.color.set('#8c8d86');
  const root = new THREE.Group(); root.name = 'kajaka8a-grounded-study'; root.add(walls.root, foundation.root);
  root.userData.audit = {stage: 'draft', footprint, height: design.height, datum, bottom, groundRange: [Math.min(...heights as number[]), Math.max(...heights as number[])], datumBasis: 'Provisional perimeter-ground median; entrance locations unverified', groundChanged: false, shell: walls.root.userData.audit};
  return {root, ready: walls.ready, setTextures: walls.setTextures, shadowDetail: {radius: 18, normalBias: .01}, dispose() { walls.dispose(); foundation.dispose(); root.removeFromParent(); }};
}

