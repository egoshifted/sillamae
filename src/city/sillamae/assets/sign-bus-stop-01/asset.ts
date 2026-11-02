import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, cylinder, graphic, palette} from '../../assets/palette.ts';

const face = () => graphic('bus-stop-541a', c => {
  c.fillStyle = '#eeeedd'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#15579f'; c.fillRect(7, 5, 242, 246);
  c.fillStyle = '#eeeedd'; c.fillRect(24, 29, 208, 174);
  c.fillStyle = '#222923'; c.fillRect(49, 83, 158, 67); c.fillRect(61, 149, 22, 15); c.fillRect(173, 149, 22, 15);
  c.fillStyle = '#eeeedd'; for (let x = 58; x < 190; x += 30) c.fillRect(x, 91, 24, 28);
  c.fillStyle = '#eeeedd'; c.textAlign = 'center'; c.font = 'bold 19px sans-serif'; c.fillText('BUSS', 128, 232);
});
const timetable = () => graphic('bus-stop-timetable', c => {
  c.fillStyle = '#e9e7da'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#26465c'; c.fillRect(12, 12, 232, 32);
  c.fillStyle = '#61716e'; for (let y = 62; y < 240; y += 19) for (let x = 17; x < 239; x += 43) c.fillRect(x, y, 29, 4);
});
export const asset: AssetDefinition = {
  id: 'sign-bus-stop-01', name: 'Bus stop marker and timetable', category: 'signs', tags: ['bus', 'stop', '541a', 'Kesk'], attach: 'ground',
  size: [.4, 2.8, .086], triangles: 140, variants: [{id: 'timetable', label: 'With timetable'}, {id: 'plain', label: 'Marker only'}],
  build({variant, detail}) {
    const parts: import('../../assets/palette.ts').Part[] = [
      [cylinder(.03, .03, 2.75, detail === 'near' ? 10 : 6), palette.galvanised()],
      [box(.4, .6, .025, 0, 2.5, .0425), palette.galvanised()],
      [new THREE.PlaneGeometry(.392, .592).translate(0, 2.5, .0555), face()],
    ];
    if (variant === 'timetable') {
      parts.push([box(.22, .32, .025, 0, 1.45, .0425), palette.galvanised()]);
      if (detail === 'near') parts.push([new THREE.PlaneGeometry(.2, .3).translate(0, 1.45, .0555), timetable()]);
    }
    return assemble(parts, 'sign-bus-stop-01');
  },
};
