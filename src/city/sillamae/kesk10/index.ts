import {entrancePoints} from './model.ts';
import {createDetail} from './detail.ts';
import type {BuildingOverride} from '../../../engine/types.ts';

export const refined: BuildingOverride = {
  id: "65395731",
  entrances() {
    const length = Math.hypot(30.72, 15.01), dx = 30.72 / length, dz = 15.01 / length;
    // The annex door is an atlas entrance, not a new anchor for the approved seating datum.
    return [...entrancePoints(), [302.4 + dx * 17.25 + dz * 20.9, 555.92 + dz * 17.25 - dx * 20.9] as [number, number]];
  },
  seatsOnGround: true,
  detailShadows: true,
  build(context) {
    const model = createDetail(context);
    context.scene.add(model.root);
    model.root.userData.dispose = model.dispose;
    return {root: model.root, groundPatches: [], ready: model.ready, setTextures: on => model.setTextures?.(on)};
  },
};
