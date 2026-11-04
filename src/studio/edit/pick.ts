import * as THREE from 'three';

const HEAVY = 6000;
const GRID = 18;

interface PickGrid {
  minX: number; minY: number; minZ: number;
  stepX: number; stepY: number; stepZ: number;
  triangles: number;
  start: Int32Array;
  tris: Int32Array;
  wide: Int32Array;
  stamp: Int32Array;
  mark: number;
}

const grids = new WeakMap<THREE.BufferGeometry, PickGrid>();
const inverse = new THREE.Matrix4();
const localRay = new THREE.Ray();
const bounds = new THREE.Box3();
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
const hit = new THREE.Vector3(), world = new THREE.Vector3(), bestPoint = new THREE.Vector3(), entry = new THREE.Vector3();

export function heavyMesh(geometry: THREE.BufferGeometry) {
  return geometry.getAttribute('position')?.count > HEAVY;
}

export function appendBounds(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4, intoLocal: THREE.Matrix4, positions: number[]) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const p = new THREE.Vector3();
  const corner = (x: number, y: number, z: number) => {
    p.set(x, y, z).applyMatrix4(worldMatrix).applyMatrix4(intoLocal);
    positions.push(p.x, p.y, p.z);
  };
  const min = box.min, max = box.max;
  const edge = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { corner(x0, y0, z0); corner(x1, y1, z1); };
  edge(min.x, min.y, min.z, max.x, min.y, min.z); edge(max.x, min.y, min.z, max.x, max.y, min.z);
  edge(max.x, max.y, min.z, min.x, max.y, min.z); edge(min.x, max.y, min.z, min.x, min.y, min.z);
  edge(min.x, min.y, max.z, max.x, min.y, max.z); edge(max.x, min.y, max.z, max.x, max.y, max.z);
  edge(max.x, max.y, max.z, min.x, max.y, max.z); edge(min.x, max.y, max.z, min.x, min.y, max.z);
  edge(min.x, min.y, min.z, min.x, min.y, max.z); edge(max.x, min.y, min.z, max.x, min.y, max.z);
  edge(max.x, max.y, min.z, max.x, max.y, max.z); edge(min.x, max.y, min.z, min.x, max.y, max.z);
}

function buildGrid(geometry: THREE.BufferGeometry): PickGrid {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangles = index ? index.count / 3 : position.count / 3;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const grid: PickGrid = {
    minX: box.min.x, minY: box.min.y, minZ: box.min.z,
    stepX: Math.max((box.max.x - box.min.x) / GRID, 1e-4),
    stepY: Math.max((box.max.y - box.min.y) / GRID, 1e-4),
    stepZ: Math.max((box.max.z - box.min.z) / GRID, 1e-4),
    triangles, start: new Int32Array(GRID ** 3 + 1), tris: new Int32Array(0), wide: new Int32Array(0),
    stamp: new Int32Array(triangles), mark: 0,
  };
  const counts = new Int32Array(GRID ** 3);
  const wide: number[] = [];
  const axis = (triangle: number, corner: number, channel: number) => {
    const at = triangle * 3 + corner;
    return position.getComponent(index ? index.getX(at) : at, channel);
  };
  const bucket = (value: number, min: number, step: number) => Math.min(GRID - 1, Math.max(0, Math.floor((value - min) / step)));
  const span = (triangle: number, write: ((cell: number) => void) | null) => {
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let corner = 0; corner < 3; corner++) {
      const x = axis(triangle, corner, 0), y = axis(triangle, corner, 1), z = axis(triangle, corner, 2);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const x0 = bucket(minX, grid.minX, grid.stepX), x1 = bucket(maxX, grid.minX, grid.stepX);
    const y0 = bucket(minY, grid.minY, grid.stepY), y1 = bucket(maxY, grid.minY, grid.stepY);
    const z0 = bucket(minZ, grid.minZ, grid.stepZ), z1 = bucket(maxZ, grid.minZ, grid.stepZ);
    if (x1 - x0 > 3 || y1 - y0 > 3 || z1 - z0 > 3) { if (!write) wide.push(triangle); return; }
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const cell = x + GRID * (y + GRID * z);
      if (write) write(cell); else counts[cell]++;
    }
  };
  for (let triangle = 0; triangle < triangles; triangle++) span(triangle, null);
  for (let cell = 0; cell < counts.length; cell++) grid.start[cell + 1] = grid.start[cell] + counts[cell];
  grid.tris = new Int32Array(grid.start[counts.length]);
  grid.wide = Int32Array.from(wide);
  const cursor = grid.start.slice();
  for (let triangle = 0; triangle < triangles; triangle++) span(triangle, cell => { grid.tris[cursor[cell]++] = triangle; });
  return grid;
}

function readTriangle(geometry: THREE.BufferGeometry, index: number) {
  const position = geometry.getAttribute('position');
  const indexed = geometry.getIndex();
  const at = index * 3;
  const read = (corner: number, target: THREE.Vector3) => target.fromBufferAttribute(position, indexed ? indexed.getX(at + corner) : at + corner);
  read(0, va); read(1, vb); read(2, vc);
}

function raycastMesh(mesh: THREE.Mesh, grid: PickGrid, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  inverse.copy(mesh.matrixWorld).invert();
  localRay.copy(raycaster.ray).applyMatrix4(inverse);
  bounds.min.set(grid.minX, grid.minY, grid.minZ);
  bounds.max.set(grid.minX + grid.stepX * GRID, grid.minY + grid.stepY * GRID, grid.minZ + grid.stepZ * GRID);
  const inside = bounds.containsPoint(localRay.origin);
  if (!inside && !localRay.intersectBox(bounds, entry)) return;
  const origin = inside ? localRay.origin : entry;
  grid.mark = grid.mark === 0x7ffffffe ? 1 : grid.mark + 1;
  if (grid.mark === 1) grid.stamp.fill(0);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!material) return;
  let best = Infinity, face = -1;
  const consider = (index: number) => {
    if (grid.stamp[index] === grid.mark) return;
    grid.stamp[index] = grid.mark;
    readTriangle(mesh.geometry, index);
    const back = material.side === THREE.BackSide;
    const point = localRay.intersectTriangle(back ? vc : va, vb, back ? va : vc, material.side !== THREE.DoubleSide, hit);
    if (!point) return;
    world.copy(point).applyMatrix4(mesh.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(world);
    if (distance < raycaster.near || distance > raycaster.far || distance >= best) return;
    best = distance; face = index; bestPoint.copy(world);
  };
  for (const index of grid.wide) consider(index);
  const dir = localRay.direction;
  let x = Math.min(GRID - 1, Math.max(0, Math.floor((origin.x - grid.minX) / grid.stepX)));
  let y = Math.min(GRID - 1, Math.max(0, Math.floor((origin.y - grid.minY) / grid.stepY)));
  let z = Math.min(GRID - 1, Math.max(0, Math.floor((origin.z - grid.minZ) / grid.stepZ)));
  const sx = dir.x === 0 ? 0 : dir.x > 0 ? 1 : -1;
  const sy = dir.y === 0 ? 0 : dir.y > 0 ? 1 : -1;
  const sz = dir.z === 0 ? 0 : dir.z > 0 ? 1 : -1;
  const dx = sx === 0 ? Infinity : Math.abs(grid.stepX / dir.x);
  const dy = sy === 0 ? Infinity : Math.abs(grid.stepY / dir.y);
  const dz = sz === 0 ? Infinity : Math.abs(grid.stepZ / dir.z);
  let tx = sx === 0 ? Infinity : ((grid.minX + (x + (sx > 0 ? 1 : 0)) * grid.stepX) - origin.x) / dir.x;
  let ty = sy === 0 ? Infinity : ((grid.minY + (y + (sy > 0 ? 1 : 0)) * grid.stepY) - origin.y) / dir.y;
  let tz = sz === 0 ? Infinity : ((grid.minZ + (z + (sz > 0 ? 1 : 0)) * grid.stepZ) - origin.z) / dir.z;
  for (let guard = 0; guard < GRID * 3; guard++) {
    const cell = x + GRID * (y + GRID * z);
    for (let cursor = grid.start[cell]; cursor < grid.start[cell + 1]; cursor++) consider(grid.tris[cursor]);
    if (tx <= ty && tx <= tz) { x += sx; if (x < 0 || x >= GRID) break; tx += dx; }
    else if (ty <= tz) { y += sy; if (y < 0 || y >= GRID) break; ty += dy; }
    else { z += sz; if (z < 0 || z >= GRID) break; tz += dz; }
  }
  if (face >= 0) intersects.push({distance: best, point: bestPoint.clone(), object: mesh, faceIndex: face});
}

export function acceleratePick(root: THREE.Object3D) {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !heavyMesh(node.geometry) || node.userData.pickGrid) return;
    let grid = grids.get(node.geometry);
    if (!grid) grids.set(node.geometry, grid = buildGrid(node.geometry));
    node.userData.pickGrid = true;
    node.raycast = (raycaster, intersects) => raycastMesh(node, grid, raycaster, intersects);
  });
}
