import {createBuilding} from './model.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: "213321429",
  seatsOnGround: true,
  build(context) {
    const model = createBuilding(context);
    context.scene.add(model.root);
    model.root.userData.dispose = model.dispose;
    return {root: model.root, groundPatches: [], ready: model.ready, setTextures: on => model.setTextures?.(on)};
  },
};

