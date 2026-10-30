import {design} from './config.ts';
import {kesk5Datum} from './index.ts';
import {createOffsetSlabStudy} from './offset-slab.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {id: design.id, stages: {shell: {label: 'Plain shape', build({frame}) {
  const root = createOffsetSlabStudy(design);
  root.position.set(design.origin[0] - frame.origin[0], kesk5Datum - frame.base, design.origin[1] - frame.origin[1]); root.rotation.y = -root.userData.audit.fit.angle;
  return {root, dispose: () => root.userData.dispose()};
}}}};
