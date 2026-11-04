import {kesk1} from '../kesk1/index.ts';
import {addSteppedApartment} from '../kesk1/model.ts';
import {kesk1Order, kesk7Design} from './design.ts';
import {entranceDatum, lowered} from '../../../studio/assembly/seat.ts';
import type {OverrideContext} from '../../../engine/types.ts';
import type {StudyModel} from '../../../studio/types.ts';

// Local height of Kesk 1's main entrance landing.
const KESK1_LANDING = .95;

// Kesk 1 seating puts local zero on the median entrance ground. Landing
// seating puts the main entrance landing on the ground in front of it.
export function createTransfer({scene, building, terrain, frame, ground}: OverrideContext, seating: 'kesk1' | 'landing' = 'kesk1', design: typeof kesk7Design = kesk7Design): StudyModel {
  building = {...building, g: kesk1Order(building.g)};
  const level = design.foundationLevel, entrances = kesk1.entrances!(building);
  const datum = seating === 'landing' ? (entranceDatum(ground, entrances.slice(0, 1)) ?? level + KESK1_LANDING) - KESK1_LANDING : entranceDatum(ground, entrances) ?? level;
  const lift = datum - level;
  const siteGround = lowered(ground.filter(t => Math.max(t[2], t[5], t[8]) >= 10), lift);
  const grid = {...terrain, values: terrain.values.map(v => v - lift * 10)};
  const root = addSteppedApartment(scene, building, {...grid, siteGround}, design, frame);
  root.position.y += lift;
  return {root, dispose: root.userData.dispose, setTextures: root.userData.setTextures, ready: root.userData.ready};
}
