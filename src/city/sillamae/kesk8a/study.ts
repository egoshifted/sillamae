import {createFinished} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '73512071',
  stages: {draft: {label: 'Finished surfaces', build: createFinished}},
};
