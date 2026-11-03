import {createDetailed} from './detail.ts';
import {createOpenings} from './openings.ts';
import {createBuilding} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '213727328',
  studyGroundSource: 'survey',
  stages: {
    shell: {label: 'Original sister shell', build: context => createBuilding(context, false)},
    plain: {label: 'Approved plain shell', build: createBuilding},
    openings: {label: 'Northeast windows and entrances', build: createOpenings},
    draft: {label: 'Detailed building', build: createDetailed},
  },
};
