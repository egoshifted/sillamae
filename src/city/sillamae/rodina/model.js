import {createRodina as plain} from './plain-model.js';
import {createDetailedRodina} from './detailed-model.js';
export {dimensions,frontOpenings,gardenOpenings,courtyardOpenings} from './plain-model.js';
export const createPlainRodina=plain;
export function createRodina(options={}){return createDetailedRodina(plain(),options);}
