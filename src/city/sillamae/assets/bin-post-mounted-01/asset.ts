import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, cylinder, palette, type Part} from '../../assets/palette.ts';

export const asset: AssetDefinition = {
  id: 'bin-post-mounted-01', name: 'Post-mounted litter bin', category: 'street furniture', tags: ['bin', 'litter', 'steel', 'bus stop'], attach: 'ground',
  size: [.25, 1.05, .32], triangles: 260, variants: [{id: 'green', label: 'Municipal green'}, {id: 'charcoal', label: 'Charcoal'}],
  build({variant, detail}) {
    const n = detail === 'near' ? 16 : 8, finish = palette.paint(variant === 'charcoal' ? '#3d4240' : '#245341');
    const parts: Part[] = [
      [cylinder(.025, .025, 1.05, n, 0, .525, -.17), palette.galvanised()],
      [new THREE.CylinderGeometry(.125, .125, .4, n, 1, true).translate(0, .75, 0), finish],
      [new THREE.CylinderGeometry(.115, .115, .38, n, 1, true).scale(-1, 1, 1).translate(0, .76, 0), palette.darkMetal()],
      [cylinder(.12, .12, .01, n, 0, .555), palette.darkMetal()],
      [new THREE.RingGeometry(.115, .125, n).rotateX(-Math.PI / 2).translate(0, .95, 0), finish],
    ];
    if (detail === 'near') for (const y of [.62, .88]) parts.push([box(.07, .035, .11, 0, y, -.13), palette.galvanised()]);
    return assemble(parts, 'bin-post-mounted-01');
  },
};
