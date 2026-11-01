import {createFinishes} from './finishes.ts';
import {sourcePosition} from './model.ts';
import {design,fittedFootprint,openingSchedule} from './design.ts';
import {preloadSurfaces} from '../kesk1/surfaces.ts';
import {entranceDatum,seatModel} from '../../../studio/assembly/seat.ts';
import type {BuildingOverride,OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';

const entrances=()=>openingSchedule().filter(o=>o.kind==='door').map(o=>sourcePosition(o.x,-design.width/2-1.35));

// Kesk 9 was drafted at the survey's lowest wall height, about 0.35 m below
// the terrain model at its doors. It stands on the ground at its entrances;
// its foundation, steps and apron already follow the ground they are given.
export function seated<T extends StudyModel>(context:OverrideContext,build:(context:OverrideContext)=>T):T{
  const datum=entranceDatum(context.ground,entrances())??design.datum;
  return seatModel(context.ground,design.datum,datum,ground=>build({...context,ground}));
}

export const refined:BuildingOverride={
  id:design.id,
  carveSurvey(vertices,building){building.g=fittedFootprint();return vertices;},
  preload:preloadSurfaces,
  build(context){
    const model=seated(context,createFinishes),root=model.root;
    let disposed=false;
    root.name='kesk9';context.scene.add(root);
    root.userData.dispose=()=>{if(disposed)return;disposed=true;model.dispose();};
    root.userData.ready=Promise.resolve(model.ready).then(()=>{if(!disposed)context.changed?.();});
    // Keep the sea plane under the site uncut.
    return {root,groundPatches:root.userData.groundPatches??[],groundPatchMinHeight:design.datum-5,setTextures:on=>model.setTextures?.(on)};
  },
  entrances,
  view:{offset:[-90,55,-45],span:85},
  detailShadows:true,
  seatsOnGround:true,
};
