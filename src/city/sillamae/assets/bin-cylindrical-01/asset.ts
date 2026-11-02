import type {AssetDefinition} from '../../../../engine/types.ts';
import {wasteDrum} from '../../assets/civic.ts';
export const asset: AssetDefinition = {
  id: 'bin-cylindrical-01', name: 'Cylindrical waste bin', category: 'street furniture', tags: ['bin', 'waste', 'recycling', 'cylindrical', 'paper', 'bio'], attach: 'ground',
  size: [1.7, 1.1, 1.7], triangles: 450, variants: [{"id":"general","label":"General waste"},{"id":"paper","label":"Paper"}],
  build({variant, detail}) { return wasteDrum(variant, false, detail); },
};
