import {preloadSurfaces} from '../kesk1/surfaces.ts';
import {doorPoints} from './design.ts';
import {createBuilding} from './model.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: '213815350',
  preload: preloadSurfaces,
  build(context) {
    const model = createBuilding(context);
    context.scene.add(model.root);
    model.root.userData.dispose = model.dispose;
    model.root.userData.ready = Promise.resolve(model.ready).then(() => context.changed?.());
    return {root: model.root, groundPatches: [], ready: model.root.userData.ready, setTextures: on => model.setTextures?.(on)};
  },
  entrances: () => doorPoints(),
  view: {offset: [90, 45, 20], span: 95},
  detailShadows: true,
  seatsOnGround: true,
};
