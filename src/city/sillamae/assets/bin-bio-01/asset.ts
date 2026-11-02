import type {AssetDefinition} from '../../../../engine/types.ts';
import {wasteDrum} from '../../assets/civic.ts';
export const asset: AssetDefinition = {
  id: 'bin-bio-01', name: 'Cylindrical bio bin', category: 'street furniture', tags: ['bin', 'waste', 'recycling', 'cylindrical', 'paper', 'bio'], attach: 'ground',
  size: [.9, 1.1, .9], triangles: 450, variants: [{"id":"bio","label":"Bio waste"}],
  build({variant, detail}) { return wasteDrum(variant, true, detail); },
};
