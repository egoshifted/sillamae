import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, box, palette, type Part} from '../../assets/palette.ts';

// Park bench: wooden slats on two cast concrete legs, with a two-slat back.
// Sitters face +z.
export const asset: AssetDefinition = {
  id: 'bench-slatted-01',
  name: 'Slatted bench',
  category: 'street furniture',
  tags: ['bench', 'seat', 'wood', 'park'],
  attach: 'ground',
  size: [1.8, .82, .55],
  triangles: 200,
  variants: [{id: 'wood', label: 'Natural wood'}, {id: 'green', label: 'Painted green'}],
  build({variant, detail}) {
    const slat = variant === 'green' ? palette.paint('#3f5e3b') : palette.wood(), parts: Part[] = [];
    for (const x of [-.7, .7]) parts.push([box(.1, .42, .5, x), palette.concrete()]);
    if (detail === 'near') {
      for (let i = 0; i < 4; i++) parts.push([box(1.8, .04, .09, 0, .44, .2 - i * .11), slat]);
      // The back leans out of the vertical by about ten degrees.
      for (const y of [.6, .73]) parts.push([box(1.8, .09, .04, 0, 0, 0).rotateX(-.17).translate(0, y, -.22 - (y - .6) * .1), slat]);
      for (const x of [-.7, .7]) parts.push([box(.05, .4, .04, 0, .2, 0).rotateX(-.17).translate(x, .42, -.21), palette.darkMetal()]);
    } else {
      parts.push([box(1.8, .04, .42, 0, .44, .04), slat], [box(1.8, .24, .04, 0, .67, -.23), slat]);
    }
    return assemble(parts, 'bench-slatted-01');
  },
};
