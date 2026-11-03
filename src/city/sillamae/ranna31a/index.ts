import {createBuilding} from './model.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: "213730655",
  build(context) {
    const model = createBuilding(context);
    context.scene.add(model.root);
    model.root.userData.dispose = model.dispose;
    return {root: model.root, groundPatches: [], ready: model.ready, setTextures: on => model.setTextures?.(on)};
  },
};
