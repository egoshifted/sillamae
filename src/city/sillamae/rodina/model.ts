import {createRodina as plain} from './plain-model.ts';
import {createDetailedRodina} from './detailed-model.ts';
import type {ModelOptions} from './types.ts';

export {dimensions,frontOpenings,gardenOpenings,courtyardOpenings} from './plain-model.ts';
export const createPlainRodina=plain;
export function createRodina(options: ModelOptions={}){return createDetailedRodina(plain(),options);}
