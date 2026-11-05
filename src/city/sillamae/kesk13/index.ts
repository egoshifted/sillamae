import type {BuildingOverride, OverrideContext, Point2} from '../../../engine/types.ts';
import {entranceDatum, seatModel} from '../../../studio/assembly/seat.ts';
import {createFinished} from './model.ts';
import {baseElevation} from './design.ts';
import {wallCorners} from './cornice.ts';
import {courtyardWalls} from './street.ts';

export function entrances(): Point2[] {
  const walls = wallCorners();
  return Object.entries(courtyardWalls).flatMap(([key, wall]) => {
    if (!wall) return [];
    const edge = Number(key), a = walls[edge], b = walls[(edge + 1) % walls.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    return wall.bays.filter(bay => bay.lower === 'door').map(bay =>
      [a[0] + dx * bay.centre + dz / length * .23, a[1] + dz * bay.centre - dx / length * .23] as Point2);
  });
}

export function createSeated(context: OverrideContext) {
  const datum = entranceDatum(context.ground, entrances()) ?? baseElevation;
  return seatModel(context.ground, baseElevation, datum, ground => createFinished({...context, ground}));
}

export const refined: BuildingOverride = {
  id: '213726928',
  entrances,
  seatsOnGround: true,
  detailShadows: true,
  view: {offset: [-65, 25, 0], span: 65},
  build(context) {
    const model = createSeated(context);
    let disposed = false;
    model.root.name = 'kesk13';
    model.root.userData.dispose = () => {if (!disposed) {disposed = true; model.dispose();}};
    context.scene.add(model.root);
    return {root: model.root, groundPatches: [], setTextures: model.setTextures!};
  },
};
