import {createFinishes} from './finishes.ts';
import {sourcePosition} from './model.ts';
import {design,fittedFootprint,openingSchedule} from './design.ts';
import {preloadSurfaces} from '../kesk1/surfaces.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined:BuildingOverride={
  id:design.id,
  carveSurvey(vertices,building){building.g=fittedFootprint();return vertices;},
  preload:preloadSurfaces,
  build(context){
    const model=createFinishes(context),root=model.root;
    let disposed=false;
    root.name='kesk9';context.scene.add(root);
    root.userData.dispose=()=>{if(disposed)return;disposed=true;model.dispose();};
    root.userData.ready=Promise.resolve(model.ready).then(()=>{if(!disposed)context.changed?.();});
    // The apron replaces the survey ground under it; the sea plane far below is left alone.
    return {root,groundPatches:root.userData.groundPatches??[],groundPatchMinHeight:design.datum-5,setTextures:on=>model.setTextures?.(on)};
  },
  entrances:()=>openingSchedule().filter(o=>o.kind==='door').map(o=>sourcePosition(o.x,-design.width/2-1.35)),
  view:{offset:[-90,55,-45],span:85},
  detailShadows:true,
};
