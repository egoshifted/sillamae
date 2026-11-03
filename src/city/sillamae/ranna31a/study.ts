import {createBuilding} from './model.ts';
import {createGardenStudy} from './garden-study.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '213730655',
  stages: {
    envelope: {label: 'Preserved starting envelope', build: createBuilding},
    draft: {label: 'Ranna 31a · building and garden', build: createGardenStudy},
  },
};
