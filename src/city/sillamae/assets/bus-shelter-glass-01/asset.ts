import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, graphic, palette, type Part} from '../../assets/palette.ts';

const notice = () => graphic('shelter-notice', c => {
  c.fillStyle = '#dddccf'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#355356'; c.fillRect(0, 0, 256, 45);
  c.fillStyle = '#ecebdd'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('SILLAMÄE', 128, 31);
  c.strokeStyle = '#727f79'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(35, 66); c.lineTo(100, 98); c.lineTo(76, 131); c.lineTo(210, 157); c.stroke();
  c.fillStyle = '#6b7470'; for (let y = 178; y < 242; y += 12) for (let x = 18; x < 230; x += 41) c.fillRect(x, y, 30, 3);
});
export const asset: AssetDefinition = {
  id: 'bus-shelter-glass-01', name: 'Glass bus shelter with bench', category: 'street furniture', tags: ['bus', 'shelter', 'glass', 'Kesk'], attach: 'ground',
  size: [3, 2.5, 1.5], triangles: 650, variants: [{id: 'notice', label: 'With information board'}, {id: 'clear', label: 'Clear glazing'}],
  build({variant, detail}) {
    const steel = palette.darkMetal(), parts: Part[] = [];
    for (const x of [-1.35, 0, 1.35]) {
      parts.push([box(.06, 2.42, .06, x, 1.21, -.61), steel]);
      parts.push([box(.18, .02, .25, x, .01, -.61), steel]);
      parts.push([box(.05, .06, 1.5, x, 2.42), steel]);
    }
    for (const z of [-.72, .72]) parts.push([box(3, .06, .06, 0, 2.42, z), steel]);
    parts.push([box(3, .02, 1.5, 0, 2.49), palette.glass()]);
    for (const x of [-.675, .675]) parts.push([box(1.28, 2.12, .012, x, 1.18, -.61), palette.glass()]);
    for (const x of [-1.35, 1.35]) {
      parts.push([box(.012, 2.12, 1.12, x, 1.18, -.02), palette.glass()]);
      if (detail === 'near') for (const y of [.28, 2.08]) parts.push([box(.04, .04, .08, x, y, -.55), palette.galvanised()]);
    }
    for (const x of [-.65, .65]) parts.push([box(.07, .43, .32, x, .215, -.24), steel]);
    const count = detail === 'near' ? 3 : 1;
    for (let i = 0; i < count; i++) parts.push([box(1.8, .055, count === 1 ? .39 : .12, 0, .4575, count === 1 ? -.22 : -.35 + i * .13), palette.wood()]);
    if (variant === 'notice') {
      parts.push([box(.8, 1.15, .045, 0, 1.4, -.565), steel]);
      parts.push([new THREE.PlaneGeometry(.72, 1.07).translate(0, 1.4, -.5415), notice()]);
    }
    const root = assemble(parts, 'bus-shelter-glass-01');
    for (const child of root.children) if ((child as THREE.Mesh).material === palette.glass()) child.castShadow = false;
    return root;
  },
};
