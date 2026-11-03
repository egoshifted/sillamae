import type {BuildingOverride} from '../../../engine/types.ts';
import {createDetailed} from './detail.ts';
import {approvedDatum, createShell} from './model.ts';
import {gradeSurvey} from './site.ts';

export const refined: BuildingOverride = {
  id: '213727328',
  detailShadows: true,
  seatsOnGround: true,
  carveSurvey(vertices, building) {
    const shell=createShell(building,true,false);
    try {return gradeSurvey(vertices,building.c,shell.userData.audit,approvedDatum,.15);}
    finally {shell.userData.dispose();}
  },
  build(context) {
    // The data build already graded the atlas triangles. Studio supplies the original survey.
    const model=createDetailed({...context,ground:[]});
    context.scene.add(model.root);
    model.root.userData.dispose=model.dispose;
    return {root:model.root,groundPatches:[],ready:model.ready,setTextures:model.setTextures};
  },
};
