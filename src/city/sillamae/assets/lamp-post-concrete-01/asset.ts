import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, box, cylinder, palette, rod, type Part} from '../../assets/palette.ts';

// Street lamp: a tapered octagonal concrete pole with a short raked arm and a
// flat luminaire. The arm reaches out along +z, over the road.
export const asset: AssetDefinition = {
  id: 'lamp-post-concrete-01',
  name: 'Concrete street lamp',
  category: 'lighting',
  tags: ['lamp', 'street light', 'pole', 'concrete', 'soviet'],
  attach: 'ground',
  size: [.28, 8.16, 1.92],
  triangles: 300,
  variants: [{id: 'concrete', label: 'Concrete pole'}, {id: 'metal', label: 'Galvanised pole'}],
  build({variant, detail}) {
    const pole = variant === 'metal' ? palette.galvanised() : palette.concrete(), segments = detail === 'near' ? 8 : 6;
    const parts: Part[] = [
      [cylinder(.08, .14, 7.8, segments), pole],
      [rod([0, 7.6, 0], [0, 8.05, 1.3], .04, segments), palette.darkMetal()],
      [box(.25, .12, .55, 0, 0).rotateX(.08).translate(0, 8.08, 1.5), palette.darkMetal()],
    ];
    if (detail === 'near') parts.push([box(.2, .02, .45, 0, 8.01, 1.5), palette.lamp()]);
    return assemble(parts, 'lamp-post-concrete-01');
  },
};
