import type {AssetDefinition} from '../../../../engine/types.ts';
import {shrub} from '../../assets/civic.ts';
export const asset: AssetDefinition = {
  id: 'shrub-spreading-01', name: 'Low spreading shrub', category: 'vegetation', tags: ['bush', 'shrub', 'leafy', 'green'], attach: 'ground',
  size: [1.8,0.85,1.5], triangles: 1800, variants: [{id:'atlas',label:'Atlas season'}, {id:'spring',label:'Spring foliage'}, {id:'summer',label:'Summer foliage'}, {id:'autumn',label:'Autumn foliage'}, {id:'winter',label:'Winter branches'}],
  build({detail, variant}) { return shrub([1.8,0.85,1.5], detail, true, variant); },
};
