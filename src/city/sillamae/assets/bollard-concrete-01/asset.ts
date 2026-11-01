import * as THREE from 'three';
import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, cylinder, palette} from '../../assets/palette.ts';

// Round concrete bollard with a domed top, as used to keep cars off footways.
export const asset: AssetDefinition = {
  id: 'bollard-concrete-01',
  name: 'Concrete bollard',
  category: 'street furniture',
  tags: ['bollard', 'post', 'barrier', 'concrete'],
  attach: 'ground',
  size: [.26, .82, .26],
  triangles: 240,
  variants: [{id: 'concrete', label: 'Bare concrete'}, {id: 'banded', label: 'Painted band'}],
  build({variant, detail}) {
    const segments = detail === 'near' ? 14 : 8;
    const dome = new THREE.SphereGeometry(.12, segments, Math.max(3, segments / 3), 0, Math.PI * 2, 0, Math.PI / 2).translate(0, .7, 0);
    return assemble([
      [cylinder(.12, .13, .7, segments), palette.concrete()],
      [dome, palette.concrete()],
      [cylinder(.125, .125, .08, segments, 0, .56), variant === 'banded' ? palette.paint('#d9c23b') : palette.darkConcrete()],
    ], 'bollard-concrete-01');
  },
};
