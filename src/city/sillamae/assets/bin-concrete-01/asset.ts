import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, cylinder, palette} from '../../assets/palette.ts';

// The cast concrete litter urn of Soviet-era estates: a short plinth under a
// flared bowl, its dark mouth open at the top.
export const asset: AssetDefinition = {
  id: 'bin-concrete-01',
  name: 'Concrete litter urn',
  category: 'street furniture',
  tags: ['bin', 'litter', 'concrete', 'soviet'],
  attach: 'ground',
  size: [.56, .67, .56],
  triangles: 300,
  variants: [{id: 'concrete', label: 'Bare concrete'}, {id: 'green', label: 'Painted green'}],
  build({variant, detail}) {
    const segments = detail === 'near' ? 16 : 8, body = variant === 'green' ? palette.paint('#4f6b4a') : palette.concrete();
    return assemble([
      [cylinder(.2, .22, .12, segments), palette.darkConcrete()],
      [cylinder(.28, .22, .55, segments, 0, .12 + .275), body],
      [cylinder(.24, .24, .01, segments, 0, .665), palette.darkMetal()],
    ], 'bin-concrete-01');
  },
};
