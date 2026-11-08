import type {AssetDefinition} from '../../../../engine/types.ts';
import * as THREE from 'three';
import {assemble, box, cylinder, graphic, palette, rod, type Part} from '../../assets/palette.ts';

const face = (reverse: boolean) => graphic('crossing-photo-v3-' + reverse, c => {
  c.fillStyle = '#0647bd'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#eeeede'; c.beginPath(); c.roundRect(3, 3, 250, 250, 15); c.fill();
  c.fillStyle = '#0647bd'; c.beginPath(); c.roundRect(8, 8, 240, 240, 12); c.fill();
  const polygon = (points: number[][]) => { c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill(); };
  c.fillStyle = '#eeeede'; polygon([[128,14],[244,213],[12,213]]);
  c.save(); if (reverse) { c.translate(256, 0); c.scale(-1, 1); }
  c.scale(256 / 257, 256 / 295); c.translate(-46, -20);
  c.fillStyle = '#141b19';
  polygon([[110,221],[129,221],[119,249],[98,249]]);
  polygon([[171,222],[187,222],[192,250],[167,250]]);
  polygon([[226,222],[243,222],[257,250],[236,250]]);
  c.beginPath(); c.ellipse(174, 96, 8.5, 12, .08, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(171,105); c.lineTo(178,106); c.lineTo(178,113);
  c.bezierCurveTo(184,117,190,121,193,126);
  c.lineTo(202,140); c.quadraticCurveTo(205,145,204,150);
  c.lineTo(201,167); c.lineTo(204,174); c.lineTo(202,178);
  c.lineTo(198,175); c.lineTo(196,168); c.lineTo(198,145); c.lineTo(187,130);
  c.lineTo(185,158); c.lineTo(187,179);
  c.quadraticCurveTo(190,191,199,203); c.lineTo(215,221);
  c.quadraticCurveTo(220,225,216,230); c.lineTo(211,237);
  c.lineTo(204,239); c.lineTo(200,235); c.lineTo(207,228);
  c.lineTo(188,211); c.quadraticCurveTo(183,206,180,198); c.lineTo(172,181);
  c.lineTo(163,197); c.lineTo(158,229); c.lineTo(157,235);
  c.quadraticCurveTo(154,239,148,237); c.lineTo(136,235);
  c.quadraticCurveTo(132,233,136,230); c.lineTo(141,228); c.lineTo(147,230);
  c.lineTo(151,210); c.lineTo(152,195); c.quadraticCurveTo(154,186,159,180);
  c.lineTo(172,163); c.lineTo(171,144);
  c.lineTo(152,164); c.quadraticCurveTo(147,168,145,163);
  c.quadraticCurveTo(144,160,147,156); c.lineTo(160,141); c.lineTo(169,128);
  c.lineTo(170,117); c.lineTo(173,111); c.closePath(); c.fill();
  c.restore();
});

function panelShape(width: number, radius: number) {
  const h = width / 2, s = new THREE.Shape();
  s.moveTo(-h + radius, -h); s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius); s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h); s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius); s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

function panelFace(detail: string) {
  const g = new THREE.ShapeGeometry(panelShape(.592, .035), detail === 'near' ? 4 : 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / .592 + .5, p.getY(i) / .592 + .5);
  return g.translate(0, 2.8, .078);
}
export const asset: AssetDefinition = {
  id: 'sign-crossing-01', name: 'Illuminated pedestrian crossing sign', category: 'signs', tags: ['crossing', 'pedestrian', 'blue', 'lamp', 'Kesk'], attach: 'ground',
  size: [.98, 6.15, .27], triangles: 420, variants: [{id: 'left', label: 'Walking left'}, {id: 'right', label: 'Walking right'}],
  build({variant, detail}) {
    const n = detail === 'near' ? 12 : 8;
    const parts: Part[] = [
      [box(.24, .22, .24), palette.concrete()],
      [cylinder(.075, .085, .045, n, 0, .2425), palette.galvanised()],
      [cylinder(.035, .055, 5.8, n, 0, 3.14), palette.galvanised()],
    ];
    // The lamp lights the crossing, so it reaches along the sign's plane the way the walker faces.
    const reach = variant === 'right' ? Math.PI / 2 : -Math.PI / 2;
    parts.push(
      [rod([0, 5.98, 0], [0, 6.055, .2], .032, n).rotateY(reach), palette.galvanised()],
      [box(.27, .09, .6, 0, 6.105, .38).rotateY(reach), palette.galvanised()],
      [box(.225, .012, .51, 0, 6.054, .4).rotateY(reach), palette.lamp()],
    );
    // Traffic from the other direction has the road on its other side, so the back walks the opposite way.
    for (const back of [false, true]) {
      const turn = (g: THREE.BufferGeometry) => back ? g.rotateY(Math.PI) : g;
      parts.push(
        [turn(new THREE.ExtrudeGeometry(panelShape(.6, .039), {depth: .025, bevelEnabled: false, curveSegments: detail === 'near' ? 4 : 2}).translate(0, 2.8, .0525)), palette.galvanised()],
        [turn(panelFace(detail)), face((variant === 'right') !== back)],
      );
      if (detail === 'near') for (const y of [2.61, 2.99]) parts.push([turn(box(.11, .04, .035, 0, y, .035)), palette.darkMetal()]);
    }
    return assemble(parts, 'sign-crossing-01');
  },
};
