import type {AssetDefinition} from '../../../../engine/types.ts';
import {shrub, SHRUB_SIZES} from '../../assets/civic.ts';
export const asset: AssetDefinition = {
  id: 'shrub-rounded-01', name: 'Rounded leafy bush', category: 'vegetation', tags: ['bush', 'shrub', 'leafy', 'green'], attach: 'ground',
  size: [2.2,2.1,2], triangles: 1800, variants: [{id:'atlas',label:'Atlas season'}, {id:'spring',label:'Spring foliage'}, {id:'summer',label:'Summer foliage'}, {id:'autumn',label:'Autumn foliage'}, {id:'winter',label:'Winter branches'}], sizes: SHRUB_SIZES,
  build({detail, variant, size}) { return shrub([2.2,2.1,2], detail, false, variant, size); },
};
