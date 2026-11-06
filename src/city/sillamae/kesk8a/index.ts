import {preloadSurfaces} from '../kesk1/surfaces.ts';
import {frontDoorFoot, rearDoorFoot} from './design.ts';
import {createFinished} from './model.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: '73512071',
  preload: preloadSurfaces,
  build(context) {
    const model = createFinished(context);
    context.scene.add(model.root);
    model.root.userData.dispose = model.dispose;
    return {root: model.root, groundPatches: [], ready: model.ready, setTextures: on => model.setTextures?.(on)};
  },
  entrances: () => [frontDoorFoot(), rearDoorFoot()],
  seatsOnGround: true,
};
