import {createFinished, createOpenings, createShell} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '228951176',
  stages: {
    draft: {label: 'Roof and details', build: createFinished},
    openings: {label: 'Openings', build: createOpenings},
    shell: {label: 'Plain shell', build: createShell},
  },
};
