import {createBuilding, createOpenings, createShell} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '213815350',
  stages: {
    shell: {label: 'Plain shell', build: createShell},
    openings: {label: 'Door openings', build: createOpenings},
    draft: {label: 'Finished surfaces', build: createBuilding},
  },
};
