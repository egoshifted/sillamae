import {createBuilding, createEnvelope} from './model.ts';
import {createDetail} from './detail.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {id:'65395731',studyGroundSource:'atlas',stages:{
  envelope:{label:'Starting envelope',build:createEnvelope},
  draft:{label:'Approved plain shell',build:createBuilding},
  detail:{label:'Refinement in progress',build:createDetail},
}};
