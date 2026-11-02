import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, cylinder, palette, type Part} from '../../assets/palette.ts';
export const asset: AssetDefinition = {
  id: 'bin-wheeled-01', name: 'Wheeled rubbish bin', category: 'street furniture', tags: ['bin', 'waste', 'wheelie', '240 litre'], attach: 'ground',
  size: [.58, 1.061, .73], triangles: 300, variants: [{id: 'grey', label: 'Dark grey'}, {id: 'green', label: 'Green'}],
  build({variant, detail}) {
    const body = palette.paint(variant === 'green' ? '#3e5945' : '#494e4a'), dark = palette.paint('#292c2a');
    const shell = box(.53, .88, .64, 0, .57, 0), p = shell.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < .5) { p.setX(i, p.getX(i) * .77); p.setZ(i, p.getZ(i) * .77); }
    shell.computeVertexNormals();
    const parts: Part[] = [[shell, body], [box(.58, .051, .73, 0, 1.0355, 0), dark], [box(.44, .045, .045, 0, .96, -.34), dark], [box(.39, .13, .39, 0, .065, .025), body]];
    for (const x of [-.245, .245]) parts.push([cylinder(.1, .1, .08, detail === 'near' ? 12 : 6, 0, 0).rotateZ(Math.PI / 2).translate(x, .1, -.24), dark]);
    if (detail === 'near') for (const x of [-.2, .2]) parts.push([box(.025, .64, .025, x, .6, .315), body]);
    return assemble(parts, 'bin-wheeled-01');
  },
};
