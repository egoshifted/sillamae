import {createBuilding, createShell, createStreet} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '213726928',
  stages: {
    shell: {label: 'Plain shell', build: createShell},
    street: {label: 'Street openings', build: createStreet},
    draft: {label: 'Courtyard openings', build: createBuilding},
  },
};
