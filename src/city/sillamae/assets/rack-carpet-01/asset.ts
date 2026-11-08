import * as THREE from 'three';
import type {AssetDefinition} from '../../../../engine/types.ts';
import {assemble, palette, type Part} from '../../assets/palette.ts';

// Rugs hang over the rails, which run along x; the beater stands on the +z side.
// Heights and spacing are estimated from a 2012 Street View image near Kesk tn.
// Each end is a shallow Λ in depth: the post pair splays from FOOT at the ground to HEAD at the top.
const HALF_SPAN = 1.15, FOOT = .22, HEAD = .05, TOP = 2.1, LOWER = 1.2, POST_TOP = 2.22;
const splay = (y: number) => FOOT + (HEAD - FOOT) * y / POST_TOP;
// Real tube is about 40 mm; drawn at 50 mm because thinner bars vanish from the atlas camera.
const R = .025, BALL = .035;

// Open tubes: every end is buried in the ground, a post or a ball, so caps would only add hidden faces.
function tube(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, segments: number) {
  const a = new THREE.Vector3(...from), direction = new THREE.Vector3(...to).sub(a), length = direction.length();
  return new THREE.CylinderGeometry(R, R, length, segments, 1, true)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
    .translate(a.x + direction.x * length / 2, a.y + direction.y * length / 2, a.z + direction.z * length / 2);
}

export const asset: AssetDefinition = {
  id: 'rack-carpet-01',
  name: 'Carpet-beating rack',
  category: 'street furniture',
  tags: ['carpet rack', 'rug', 'courtyard', 'steel', 'soviet'],
  attach: 'ground',
  size: [2 * (HALF_SPAN + BALL), POST_TOP + BALL, 2 * (FOOT + R)],
  triangles: 360,
  variants: [{id: 'weathered', label: 'Weathered brown, worn top rail'}, {id: 'painted', label: 'Fresh dark paint'}],
  build({variant, detail}) {
    const near = detail === 'near', segments = near ? 8 : 4;
    const frame = variant === 'painted' ? palette.darkMetal() : palette.paint('#4b3b31');
    const rail = variant === 'painted' ? frame : palette.paint('#7d746a');
    const parts: Part[] = [
      [tube([-HALF_SPAN, TOP, 0], [HALF_SPAN, TOP, 0], segments), rail],
      [tube([-HALF_SPAN, LOWER, 0], [HALF_SPAN, LOWER, 0], segments), frame],
    ];
    for (const x of [-HALF_SPAN, HALF_SPAN]) {
      for (const side of [-1, 1]) {
        parts.push([tube([x, 0, side * FOOT], [x, POST_TOP, side * HEAD], segments), frame]);
        if (near) parts.push([new THREE.SphereGeometry(BALL, 8, 4).translate(x, POST_TOP, side * HEAD), frame]);
      }
      if (near) for (const y of [TOP, LOWER]) parts.push([tube([x, y, -splay(y)], [x, y, splay(y)], segments), frame]);
    }
    return assemble(parts, 'rack-carpet-01');
  },
};
