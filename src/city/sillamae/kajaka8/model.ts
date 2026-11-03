import * as THREE from 'three';
import type {Building, OverrideContext} from '../../../engine/types.ts';
import {design as sister} from '../kesk5/config.ts';
import {createOffsetSlabStudy} from '../kesk5/offset-slab.ts';
import {splitWallAtHeight} from '../kesk5/split-wall.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {design} from './design.ts';
import {gradeSite} from './site.ts';

// Preserve the survey roof envelope when setting the common level for all four sections.
// The 2012 doorway reads as a landing with one shallow rise from the path.
const rise = .13, landingTop = .15;

export const approvedDatum = 29.27 - sister.roofDatum - sister.sideParapetHeight;

export function createShell(building: Building, access: boolean, detailed: boolean) {
  // Kajaka's survey ring starts one corner before the corresponding Kesk 5 corner.
  const footprint = [...building.g.slice(1), building.g[0]];
  return createOffsetSlabStudy({
    ...sister, id: building.id, name: building.name, origin: building.c, footprint,
    basement: access ? {...sister.basement, wallBase: -1.15} : sister.basement,
    facadeRelief: access ? {...sister.facadeRelief, edgeProjection: 0, baseDatum: -1.15} : sister.facadeRelief,
    rearEdgeProjection: access ? 0 : sister.rearEdgeProjection,
    doorWidth: detailed ? sister.stairWidth : sister.doorWidth,
    roofVentLayout: detailed ? sister.roofVentLayout : [],
  });
}

export function createBuilding({building, frame, ground}: OverrideContext, access = true, detailed = false): StudyModel {
  const root = createShell(building, access, detailed);
  const datum = access ? approvedDatum : design.datum!;
  root.position.set(building.c[0] - frame.origin[0], datum - frame.base, building.c[1] - frame.origin[1]);
  root.rotation.y = -root.userData.audit.fit.angle;
  const extraMaterials: THREE.Material[] = [];
  if (access) {
    const entrances = sister.facades.filter(f => f.type === 'entrance');
    const landings = root.children.filter(mesh => mesh.name === 'landing');
    const landing = landings[entrances.findIndex(f => f.section === 3)];
    const plinth = new THREE.MeshStandardMaterial({color: 0xb0b1ad, roughness: 1});
    const rail = new THREE.MeshStandardMaterial({color: 0x995f55, roughness: .85});
    const endWall = new THREE.MeshStandardMaterial({color: 0xa76f53, roughness: 1});
    extraMaterials.push(plinth, rail, endWall);
    splitWallAtHeight(root, .98);
    for (const mesh of root.children) {
      if (mesh.userData.basePart) mesh.material = plinth;
      else if (/^wall-(1|3|5|7|9|11|13|15)$/.test(mesh.name) || mesh.name.startsWith('shared-return-')) mesh.material = endWall;
    }

    // This view shows a landing just wider than the doorway and a rail on each side.
    const width = 2.05, depth = sister.canopyDepth;
    const layout = new THREE.Group();
    layout.position.set(landing.position.x, 0, landing.position.z);
    layout.rotation.copy(landing.rotation);
    root.add(layout);
    landing.scale.x = width / sister.landingWidth;
    // Extend the landing back to the recessed door while keeping its front edge fixed.
    const thresholdExtension = .22;
    landing.scale.z = (depth + thresholdExtension) / depth;
    landing.translateZ(-thresholdExtension / 2);
    const bottom = landingTop - rise - .20;
    for (const slab of landings) {
      const base = slab === landing ? bottom : -1.15;
      slab.scale.y = (landingTop - base) / landingTop;
      slab.position.y = (base + landingTop) / 2;
    }

    // Adapt the slim tubular Kesk 5 rail to the two sides and shallow drop visible here.
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - .085);
      const path = new THREE.CurvePath<THREE.Vector3>();
      const points = [
        new THREE.Vector3(x, landingTop, -.26),
        new THREE.Vector3(x, landingTop + .82, -.26),
        new THREE.Vector3(x, landingTop + .78, depth / 2 - .08),
        new THREE.Vector3(x, landingTop, depth / 2 - .08),
      ];
      for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
      const handrail = new THREE.Mesh(new THREE.TubeGeometry(path, 64, .0175, 8, false), rail);
      handrail.name = 'access-handrail';
      handrail.castShadow = handrail.receiveShadow = true;
      layout.add(handrail);
    }
  }
  const disposeShell = root.userData.dispose;
  const studyGround = access && ground?.length ? gradeSite(ground, building.c, root.userData.audit, datum, landingTop) : undefined;
  return {root, studyGround, dispose() { disposeShell(); extraMaterials.forEach(material => material.dispose()); }};
}
