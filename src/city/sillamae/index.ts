import type {CityDefinition} from '../../engine/types.ts';
import {kesk1} from './kesk1/index.ts';

export const sillamae: CityDefinition = {
  frame: {origin: [750, 760]},
  // Temporary review default requested by Anton. Search still selects any building.
  defaultFocus: kesk1.id,
  overrides: [kesk1],
};
