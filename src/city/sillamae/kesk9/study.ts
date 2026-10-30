import {createBuilding,createEnvelope} from './model.ts';
import {createFinishes} from './finishes.ts';
import {correctedOpeningSchedule} from './windows.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id:'73512033',
  stages:{
    envelope:{label:'Preserved starting envelope',build:createEnvelope},
    draft:{label:'Approved plain shell',build:createBuilding},
    windows:{label:'Corrected window proportions · plain',build:context=>createBuilding(context,correctedOpeningSchedule())},
    finishes:{label:'Finishes · provisional reuse trial',build:createFinishes},
  },
};
