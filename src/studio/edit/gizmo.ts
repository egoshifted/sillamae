import * as THREE from 'three';

const SHAFT = 0.2;
const RING = 0.28;

function pinch(geometry: THREE.BufferGeometry, axis: 0 | 1 | 2, factor: number) {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (axis === 0) { y *= factor; z *= factor; }
    else if (axis === 1) { x *= factor; z *= factor; }
    else { x *= factor; y *= factor; }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function pinchUniform(geometry: THREE.BufferGeometry, factor: number) {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * factor, pos.getY(i) * factor, pos.getZ(i) * factor);
  pos.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function shrinkRing(geometry: THREE.BufferGeometry, axis: 0 | 1 | 2, major: number, factor: number) {
  const pos = geometry.getAttribute('position');
  const point = new THREE.Vector3(), radial = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    point.fromBufferAttribute(pos, i);
    radial.copy(point);
    radial.setComponent(axis, 0);
    const len = radial.length();
    if (len < 1e-8) continue;
    radial.multiplyScalar(major / len);
    pos.setXYZ(i, radial.x + (point.x - radial.x) * factor, radial.y + (point.y - radial.y) * factor, radial.z + (point.z - radial.z) * factor);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function tightenPickers(helper: THREE.Object3D) {
  const host = helper.children.find(child => 'picker' in child) as {picker?: Record<string, THREE.Object3D>} | undefined;
  const picker = host?.picker;
  if (!picker) return;
  for (const mode of ['translate', 'scale'] as const) {
    picker[mode]?.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'X') pinch(obj.geometry, 0, SHAFT);
      else if (obj.name === 'Y') pinch(obj.geometry, 1, SHAFT);
      else if (obj.name === 'Z') pinch(obj.geometry, 2, SHAFT);
      else if (obj.name === 'XYZ') pinchUniform(obj.geometry, 0.5);
    });
  }
  picker.rotate?.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.name === 'X') shrinkRing(obj.geometry, 0, 0.5, RING);
    else if (obj.name === 'Y') shrinkRing(obj.geometry, 1, 0.5, RING);
    else if (obj.name === 'Z') shrinkRing(obj.geometry, 2, 0.5, RING);
    else if (obj.name === 'E') shrinkRing(obj.geometry, 2, 0.75, RING);
    else if (obj.name === 'XYZE') pinchUniform(obj.geometry, 0.45);
  });
}

export function axisNote(mode: string, axis: string) {
  if (mode === 'translate') {
    if (axis === 'X') return 'Slides along the red arrow.';
    if (axis === 'Y') return 'Slides along the green arrow.';
    if (axis === 'Z') return 'Slides along the blue arrow.';
    if (axis === 'XY') return 'Slides on the blue plane.';
    if (axis === 'YZ') return 'Slides on the red plane.';
    if (axis === 'XZ') return 'Slides on the green plane.';
    return 'Slides freely.';
  }
  if (mode === 'rotate') {
    if (axis === 'X') return 'Turns around the red ring.';
    if (axis === 'Y') return 'Turns around the green ring.';
    if (axis === 'Z') return 'Turns around the blue ring.';
    if (axis === 'E') return 'Turns in the view plane.';
    return 'Turns freely.';
  }
  if (axis === 'X') return 'Stretches along the red handle.';
  if (axis === 'Y') return 'Stretches along the green handle.';
  if (axis === 'Z') return 'Stretches along the blue handle.';
  if (axis === 'XY') return 'Stretches on the blue plane.';
  if (axis === 'YZ') return 'Stretches on the red plane.';
  if (axis === 'XZ') return 'Stretches on the green plane.';
  return 'Scales from the center.';
}
