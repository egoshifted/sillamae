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
    const ready = Promise.resolve(model.ready).then(() => context.changed?.());
    return {root: model.root, groundPatches: [], ready, setTextures: on => model.setTextures?.(on)};
  },
  entrances: () => [frontDoorFoot(), rearDoorFoot()],
  detailShadows: true,
  seatsOnGround: true,
};
