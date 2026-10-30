import * as THREE from 'three';
import {rodinaPlacement} from './index.ts';
import {createPlainRodina, createRodina} from './model.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

function build({frame}: OverrideContext, compact: boolean) {
  const root: THREE.Object3D = compact ? createRodina({compact: true}) : createPlainRodina();
  const {origin, angle, datum} = rodinaPlacement;
  root.position.set(origin[0] - frame.origin[0], datum - frame.base, origin[1] - frame.origin[1]); root.rotation.y = -angle;
  return {root, setTextures: (on: boolean) => root.userData.setTextures?.(on), dispose() {
    if (root.userData.dispose) root.userData.dispose();
    else {
      const materials = new Set<THREE.Material>();
      root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
      materials.forEach(m => m.dispose());
    }
  }};
}
export const study: StudyDefinition = {id: '213731733', stages: {shell: {label: 'Plain shape', build: context => build(context, false)}, compact: {label: 'Compact', build: context => build(context, true)}}};
