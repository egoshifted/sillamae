import {kesk1} from '../kesk1/index.ts';
import {preloadSurfaces} from '../kesk1/surfaces.ts';
import {createTransfer} from './model.ts';
import {id, kesk1Order} from './design.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

// The lightwells and the sunken annex access are ground patches, so the data
// build cuts them from the survey; no separate carve is needed.
export const refined: BuildingOverride = {
  id,
  carveSurvey(vertices, building) {
    building.g = kesk1Order(building.g);
    return vertices;
  },
  preload: preloadSurfaces,
  build(context) {
    const model = createTransfer(context, 'landing'), root = model.root;
    root.userData.ready.then(() => context.changed?.());
    // Keep the sea plane under the site uncut.
    return {root, groundPatches: root.userData.groundPatches ?? [], groundPatchMinHeight: 10, setTextures: on => model.setTextures?.(on)};
  },
  entrances: building => kesk1.entrances!(building),
  view: {offset: [110, 80, 45], span: 65},
  detailShadows: true,
  seatsOnGround: true,
};
