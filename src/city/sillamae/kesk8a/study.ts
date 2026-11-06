import {createFinished} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

// One entry, as Kesk 1 shows. The building is not registered, so the reserved 'assembled' stage is not available yet.
export const study: StudyDefinition = {
  id: '73512071',
  stages: {draft: {label: 'Atlas assembly', build: createFinished}},
};
