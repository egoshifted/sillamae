import {preloadSurfaces} from '../kesk1/surfaces.ts';
import {frontDesign as d,sourcePoint} from './front-design.ts';
import {createGarden} from './garden-study.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: '213730655',
  preload: preloadSurfaces,
  build(context) {
    const model=createGarden(context),root=model.root;
    let disposed=false;
    root.name='ranna31a';context.scene.add(root);
    root.userData.dispose=()=>{if(disposed)return;disposed=true;model.dispose();};
    root.userData.ready=Promise.resolve(model.ready).then(()=>{if(!disposed)context.changed?.();});
    // Paving and stair pits own their surface; the sea plane stays uncut beneath them.
    return {root,groundPatches:model.groundCuts,groundPatchMinHeight:model.datum-5,setTextures:on=>model.setTextures(on)};
  },
  entrances:()=>[sourcePoint(d.entranceX,d.centreFront+3.5)],
  view:{offset:[-70,55,90],span:85},
  detailShadows:true,
  seatsOnGround:true,
};
