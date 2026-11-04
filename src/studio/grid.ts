import * as THREE from 'three';
import {gridStep, planFrame, worldToPlan} from './plan.ts';

export interface GridTick {at: number; major: boolean}

// Marks are measured from an origin: the facade centre in plan, the building base vertically.
export function gridTicks(origin: number, min: number, max: number, step: number, pad: number): GridTick[] {
  if (!(step > 0) || ![origin, min, max].every(Number.isFinite)) return [];
  const below = Math.max(0, Math.min(120, Math.ceil((origin - (min - pad)) / step)));
  const above = Math.max(0, Math.min(120, Math.ceil((max + pad - origin) / step)));
  const ticks: GridTick[] = [];
  for (let i = -below; i <= above; i++) ticks.push({at: origin + i * step, major: i % 5 === 0});
  return ticks;
}

function extents(root: THREE.Object3D, angle: number) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const point = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    const position = mesh.geometry?.getAttribute?.('position');
    if (!position || object.userData.fit) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
      const [px, pz] = worldToPlan(point.x, point.z, angle);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
  });
  return {minX, maxX, minY, maxY, minZ, maxZ};
}

function push(list: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  list.push(x0, y0, z0, x1, y1, z1);
}

function face(minor: number[], major: number[], fixed: 'x' | 'z' | 'y', at: number, a: GridTick[], b: GridTick[], a0: number, a1: number, b0: number, b1: number) {
  const put = (tick: GridTick, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => push(tick.major ? major : minor, x0, y0, z0, x1, y1, z1);
  if (fixed === 'x') {
    for (const tick of a) put(tick, at, tick.at, b0, at, tick.at, b1);
    for (const tick of b) put(tick, at, a0, tick.at, at, a1, tick.at);
  } else if (fixed === 'z') {
    for (const tick of a) put(tick, b0, tick.at, at, b1, tick.at, at);
    for (const tick of b) put(tick, tick.at, a0, at, tick.at, a1, at);
  } else {
    for (const tick of a) put(tick, tick.at, at, b0, tick.at, at, b1);
    for (const tick of b) put(tick, a0, at, tick.at, a1, at, tick.at);
  }
}

export function buildStudyGrid(root: THREE.Object3D, footprint: readonly [number, number][], baseY: number) {
  const group = new THREE.Group();
  group.name = 'study-grid';
  group.raycast = () => {};
  const angle = footprint.length >= 2 ? planFrame(footprint, footprint).angle : 0;
  const box = extents(root, angle);
  if (!Number.isFinite(box.minX)) return group;
  const span = Math.max(box.maxX - box.minX, box.maxZ - box.minZ, box.maxY - box.minY, 1);
  const step = span > 80 ? gridStep(span) : 1;
  const midX = (box.minX + box.maxX) / 2, midZ = (box.minZ + box.maxZ) / 2;
  const xs = gridTicks(midX, box.minX, box.maxX, step, 0);
  const zs = gridTicks(midZ, box.minZ, box.maxZ, step, 0);
  const ys = gridTicks(baseY, box.minY, box.maxY, step, 0);
  const xWide = gridTicks(midX, box.minX, box.maxX, step, step);
  const zWide = gridTicks(midZ, box.minZ, box.maxZ, step, step);
  if (!xs.length || !zs.length || !ys.length) return group;
  const minor: number[] = [], major: number[] = [];
  const gap = Math.min(0.03, step * 0.03);
  const y0 = ys[0].at, y1 = ys[ys.length - 1].at;
  face(minor, major, 'y', baseY + gap, xWide, zWide, xWide[0].at, xWide[xWide.length - 1].at, zWide[0].at, zWide[zWide.length - 1].at);
  face(minor, major, 'x', box.minX - gap, ys, zs, y0, y1, zs[0].at, zs[zs.length - 1].at);
  face(minor, major, 'x', box.maxX + gap, ys, zs, y0, y1, zs[0].at, zs[zs.length - 1].at);
  face(minor, major, 'z', box.minZ - gap, ys, xs, y0, y1, xs[0].at, xs[xs.length - 1].at);
  face(minor, major, 'z', box.maxZ + gap, ys, xs, y0, y1, xs[0].at, xs[xs.length - 1].at);
  const add = (values: number[], color: string, opacity: number) => {
    if (!values.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color, transparent: true, opacity, depthWrite: false, toneMapped: false}));
    lines.raycast = () => {};
    group.add(lines);
  };
  add(minor, '#6a7a72', 0.22);
  add(major, '#24312c', 0.62);
  group.rotation.y = -angle;
  return group;
}
