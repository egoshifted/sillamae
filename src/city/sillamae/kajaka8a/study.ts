import {createBuilding} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {id: "213321429", stages: {plain: {label: 'Approved plain shell', build: context => createBuilding(context, false)}, draft: {label: 'Material refinement', build: context => createBuilding(context)}}};
