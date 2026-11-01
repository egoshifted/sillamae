import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, box, palette, rod, type Part} from '../../assets/palette.ts';

// Entrance lamp: a lantern hung from a bracket over a doorway.
export const asset: AssetDefinition = {
  id: 'lamp-wall-01',
  name: 'Wall lantern',
  category: 'lighting',
  tags: ['lamp', 'lantern', 'entrance', 'wall'],
  attach: 'wall',
  size: [.16, .21, .4],
  triangles: 150,
  variants: [{id: 'black', label: 'Black'}],
  build({detail}) {
    const metal = palette.darkMetal(), parts: Part[] = [
      [box(.1, .2, .02, 0, 0, .01), metal],
      [box(.16, .03, .16, 0, .08, .32), metal],
      [box(.12, .17, .12, 0, -.025, .32), detail === 'near' ? palette.lamp() : metal],
    ];
    if (detail === 'near') parts.push([rod([0, .05, .02], [0, .09, .26], .012, 6), metal]);
    return assemble(parts, 'lamp-wall-01');
  },
};
