import type {CityDefinition} from '../../engine/types.ts';
import {kesk1} from './kesk1/index.ts';
import {kesk5} from './kesk5/index.ts';
import {rodina} from './rodina/index.ts';

export const sillamae: CityDefinition = {
  frame: {origin: [750, 760]},
  defaultFocus: rodina.id,
  overrides: [kesk1, kesk5, rodina],
};
