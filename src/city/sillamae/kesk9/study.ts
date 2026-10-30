import {createBuilding,createEnvelope} from './model.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id:'73512033',
  stages:{
    envelope:{label:'Preserved starting envelope',build:createEnvelope},
    draft:{label:'Plain shell · provisional',build:createBuilding},
  },
};
