import {createMassingStudy} from '../../../studio/assembly/massing.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';
import {design} from './design.ts';

export function createBuilding(context: OverrideContext): StudyModel {
  const model = createMassingStudy(context, design);
  model.root.name = 'ranna31a-starting-envelope';
  model.root.userData.audit = {
    ...model.root.userData.audit,
    id: '213730655',
    status: 'Starting envelope only; not a reviewed shell',
    unresolved: ['Separate tower and low wing roof levels', 'Survey versus imported plan alignment', 'Terrain datum and foundation', 'Elevation and opening schedules'],
  };
  return model;
}
