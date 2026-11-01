import {createBuilding,createEnvelope} from './model.ts';
import {createFinishes} from './finishes.ts';
import {correctedOpeningSchedule} from './windows.ts';
import {seated} from './index.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

// The preserved envelope keeps its original datum; later stages stand where the atlas puts the building.
export const study: StudyDefinition = {
  id:'73512033',
  stages:{
    envelope:{label:'Preserved starting envelope',build:createEnvelope},
    draft:{label:'Approved plain shell',build:context=>seated(context,c=>createBuilding(c))},
    windows:{label:'Corrected window proportions · plain',build:context=>seated(context,c=>createBuilding(c,correctedOpeningSchedule()))},
    finishes:{label:'Finishes · provisional reuse trial',build:context=>seated(context,createFinishes)},
  },
};
