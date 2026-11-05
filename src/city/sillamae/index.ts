import type {CityDefinition} from '../../engine/types.ts';
import {kesk1} from './kesk1/index.ts';
import {kesk5} from './kesk5/index.ts';
import {rodina} from './rodina/index.ts';
import {refined as kesk9} from './kesk9/index.ts';
import {refined as kesk7} from './kesk7/index.ts';
import {refined as kajaka8} from './kajaka8/index.ts';
import {refined as kajaka12a} from './kajaka12a/index.ts';
import {refined as ranna31a} from './ranna31a/index.ts';
import {refined as kesk13} from './kesk13/index.ts';
import {terrainDetail} from './terrain-detail.ts';

export const sillamae: CityDefinition = {
  frame: {origin: [750, 760]},
  defaultFocus: rodina.id,
  overrides: [kesk1, kesk5, rodina, kesk9, kesk7, kajaka8, ranna31a, kajaka12a, kesk13],
  terrainDetail,
  extent: [[3430, 2010], [-290, 1840], [-110, -1355], [3550, -1260]],
};
