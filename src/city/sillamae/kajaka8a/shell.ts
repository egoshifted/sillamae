import * as THREE from 'three';
import type {Point2} from '../../../engine/types.ts';
import {design} from './design.ts';
import {acquirePaleMasonry} from '../shared/masonry.ts';
import {surfaces as roofSurfaces} from '../kesk5/surfaces.ts';
import {finishSurface, graffitiTexture} from './finishes.ts';

const roof = [4.71, 4.32, 4.39, 4.78];
const vent = {edge: 0, start: .52, width: 1.62, sill: 2.98, height: .64};
const door = {edge: 3, start: 3.25, width: 1.45, sill: .05, height: 2.35};
type Vertex = [number, number, number];

export function createShell(centre: Point2, finished = false) {
  const footprint = design.footprint!, root = new THREE.Group(); root.name = 'shell';
  const [a, b, , d] = footprint, ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - a[0], vz = d[1] - a[1], determinant = ux * vz - uz * vx;
  const roofAt = (p: Point2) => roof[0] + ((p[0] - a[0]) * vz - (p[1] - a[1]) * vx) / determinant * (roof[1] - roof[0]) + (ux * (p[1] - a[1]) - uz * (p[0] - a[0])) / determinant * (roof[3] - roof[0]);
  const masonry = new THREE.MeshStandardMaterial({name: 'Plain shell', color: '#c5c7be', roughness: 1});
  const metal = new THREE.MeshStandardMaterial({name: 'Plain roof edge and vent', color: '#a9ada9', roughness: 1});
  const slab = new THREE.MeshStandardMaterial({name: 'Plain roof', color: '#878b86', roughness: 1});
  const surfaces = finished ? acquirePaleMasonry() : undefined;
  const red = new THREE.MeshStandardMaterial({name: 'Red masonry trial', color: '#dc967b', roughness: 1, bumpScale: .007});
  const pale = new THREE.MeshStandardMaterial({name: 'Pale masonry trial', color: '#dedbd0', roughness: 1, bumpScale: .006});
  const concrete = new THREE.MeshStandardMaterial({name: 'Pale concrete lintel', color: '#d3d0c4', roughness: 1});
  const east = red.clone(); east.name = 'Weathered east masonry and graffiti';
  const river = pale.clone(); river.name = 'River masonry and graffiti';
  const doorMetal = new THREE.MeshStandardMaterial({name: 'Grey steel double door', color: '#929fa3', roughness: .82});
  const hardware = new THREE.MeshStandardMaterial({name: 'Door hardware', color: '#626d6b', roughness: .8});
  const roofFinish = new THREE.MeshStandardMaterial({name: 'Weathered mineral roof', color: '#999a92', roughness: 1, bumpScale: .018});
  const felt = finished ? roofSurfaces() : undefined, tag = finished ? graffitiTexture() : undefined;
  const riverTag = finished ? graffitiTexture(true) : undefined;
  const finishes = finished ? [finishSurface(east, 'east', centre, tag!), finishSurface(river, 'river', centre, riverTag!), finishSurface(red, 'west', centre, tag!), finishSurface(pale, 'wall', centre, tag!), finishSurface(roofFinish, 'roof', centre, tag!)] : [];
  if (finished) { metal.color.set('#c1c4bf'); metal.roughness = .8; slab.color.set('#777a73'); }
  const setTextures = (enabled: boolean) => { for (const material of [red, pale, east, river]) { material.map = enabled && surfaces ? surfaces.maps[0] : null; material.bumpMap = enabled && surfaces ? surfaces.maps[1] : null; material.needsUpdate = true; } roofFinish.map = enabled && felt ? felt.roof[0] : null; roofFinish.bumpMap = enabled && felt ? felt.roof[1] : null; roofFinish.needsUpdate = true; finishes.forEach(f => f.setTextures(enabled)); };
  setTextures(finished);
  const meshes: THREE.Mesh[] = [];
  const solid = (name: string, vertices: Vertex[], material: THREE.Material, omit: number[] = []) => {
    const c = vertices.reduce((a, p) => a.add(new THREE.Vector3(...p)), new THREE.Vector3()).multiplyScalar(1 / 8), positions: number[] = [];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    if (finished && name === 'weathered-roof-deck') faces.push(faces.splice(1, 1)[0]);
    for (const [index, face] of faces.entries()) {
      if (omit.includes(index)) continue;
      const [a, b, d, e] = face.map(i => new THREE.Vector3(...vertices[i]));
      const outward = b.clone().sub(a).cross(d.clone().sub(a)).dot(a.clone().add(d).multiplyScalar(.5).sub(c)) > 0;
      for (const p of outward ? [a, b, d, a, d, e] : [a, d, b, a, e, d]) positions.push(...p.toArray());
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    const uv: number[] = [], normals = geometry.getAttribute('normal');
    for (let i = 0; i < positions.length; i += 3) { const x = positions[i], y = positions[i + 1], z = positions[i + 2], n = new THREE.Vector3().fromBufferAttribute(normals, i / 3), horizontal = Math.abs(n.y) > .5; uv.push((horizontal ? x : x * -n.z + z * n.x) / 2.08, (horizontal ? z : y) / 1.20); }
    if (finished && name === 'weathered-roof-deck') {
      for (let i = 0; i < positions.length; i += 3) { uv[i / 3 * 2] = positions[i] / 16; uv[i / 3 * 2 + 1] = positions[i + 2] / 16; }
      geometry.addGroup(0, 30, 0); geometry.addGroup(30, 6, 1);
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geometry, finished && name === 'weathered-roof-deck' ? [slab, roofFinish] : material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); meshes.push(mesh);
  };
  const edgePoint = (edge: number, u: number, y: number, offset: number): Vertex => {
    const p = footprint[edge], q = footprint[(edge + 1) % footprint.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]), dx = (q[0] - p[0]) / length, dz = (q[1] - p[1]) / length;
    if (offset && (Math.abs(u) < 1e-8 || Math.abs(u - length) < 1e-8)) {
      const corner = Math.abs(u) < 1e-8 ? edge : (edge + 1) % 4, at = footprint[corner], previous = footprint[(corner + 3) % 4], next = footprint[(corner + 1) % 4];
      const l0 = Math.hypot(at[0] - previous[0], at[1] - previous[1]), l1 = Math.hypot(next[0] - at[0], next[1] - at[1]);
      const a = [(at[1] - previous[1]) / l0, -(at[0] - previous[0]) / l0], b = [(next[1] - at[1]) / l1, -(next[0] - at[0]) / l1], scale = offset / (1 + a[0] * b[0] + a[1] * b[1]);
      return [at[0] + (a[0] + b[0]) * scale - centre[0], y, at[1] + (a[1] + b[1]) * scale - centre[1]];
    }
    return [p[0] + dx * u + dz * offset - centre[0], y, p[1] + dz * u - dx * offset - centre[1]];
  };
  const panel = (name: string, edge: number, start: number, end: number, low: number, top: (u: number) => number, back: number, front: number, material = masonry, omit: number[] = []) => {
    if (finished && material === masonry) material = edge === 0 ? east : edge === 1 ? river : edge === 2 ? red : pale;
    if (finished && name === 'vent-lintel') material = concrete;
    solid(name, [edgePoint(edge, start, low, back), edgePoint(edge, end, low, back), edgePoint(edge, end, low, front), edgePoint(edge, start, low, front), edgePoint(edge, start, top(start), back), edgePoint(edge, end, top(end), back), edgePoint(edge, end, top(end), front), edgePoint(edge, start, top(start), front)], material, omit);
  };
  footprint.forEach((p, i) => {
    const q = footprint[(i + 1) % footprint.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]), top = (u: number) => roofAt([p[0] + (q[0] - p[0]) * u / length, p[1] + (q[1] - p[1]) * u / length]) - (finished ? i % 2 ? .36 : 0 : .12);
    if (finished && i === door.edge) {
      const a = door.start, b = a + door.width, head = door.sill + door.height;
      panel('door-wall-left', i, 0, a, 0, top, -.24, 0);
      panel('door-wall-right', i, b, length, 0, top, -.24, 0);
      panel('door-wall-above', i, a, b, head, top, -.24, 0);
      panel('door-threshold', i, a, b, 0, () => door.sill, -.24, .025, concrete);
      panel('door-leaf-left', i, a + .055, a + door.width / 2 - .012, door.sill + .035, () => head - .055, -.105, -.065, doorMetal);
      panel('door-leaf-right', i, a + door.width / 2 + .012, b - .055, door.sill + .035, () => head - .055, -.105, -.065, doorMetal);
      for (const u of [a, b - .055]) panel('door-frame-jamb', i, u, u + .055, door.sill, () => head, -.13, -.015, doorMetal);
      panel('door-frame-head', i, a, b, head - .055, () => head, -.13, -.015, doorMetal);
      for (const u of [a + .04, b - .065]) for (const y of [.45, 1.95]) panel('door-hinge', i, u, u + .025, y, () => y + .12, -.065, -.025, hardware);
      panel('door-pull', i, a + door.width / 2 + .09, a + door.width / 2 + .12, .95, () => 1.12, -.065, -.015, hardware);
    }
    else if (i !== vent.edge) panel('wall-' + i, i, 0, length, 0, top, -.24, 0);
    else {
      const a = vent.start, b = a + vent.width, head = vent.sill + vent.height;
      if (!finished) {
        panel('vent-wall-left', i, 0, a, 0, top, -.24, 0);
        panel('vent-wall-right', i, b, length, 0, top, -.24, 0);
        panel('vent-wall-below', i, a, b, 0, () => vent.sill, -.24, 0);
        panel('vent-wall-above', i, a, b, head, top, -.24, 0);
      } else {
        const xs = [0, a, b, length], ys = [0, vent.sill, head], exists = (x: number, y: number) => x >= 0 && x < 3 && y >= 0 && y < 3 && !(x === 1 && y === 1);
        for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (exists(x, y)) {
          const omit = [[x,y-1,0],[x,y+1,1],[x+1,y,3],[x-1,y,5]].filter(([nx,ny]) => exists(nx,ny)).map(v => v[2]);
          panel(x === 1 ? y === 0 ? 'vent-wall-below' : 'vent-wall-above' : `vent-wall-${x}-${y}`, i, xs[x], xs[x+1], ys[y], y === 2 ? top : () => ys[y+1], -.24, 0, masonry, omit);
        }
      }
      panel('vent-lintel', i, a - .18, b + .18, head, () => head + .16, 0, .07, metal);
      for (const u of [a, a + vent.width / 3, a + 2 * vent.width / 3, b - .045]) panel('vent-frame-' + u, i, u, u + .045, vent.sill, () => head, -.065, -.015, metal);
      for (const y of [vent.sill, head - .04]) panel('vent-frame-horizontal-' + y, i, a + .045, b - .045, y, () => y + .04, -.065, -.015, metal);
      for (let bay = 0; bay < 3; bay++) for (let row = 0; row < 9; row++) {
        const u0 = a + bay * vent.width / 3 + .045, u1 = a + (bay + 1) * vent.width / 3, y = vent.sill + .055 + row * (vent.height - .11) / 8;
        const back = -.16, front = -.055, fall = .045, thickness = .014;
        solid(`vent-louvre-${bay}-${row}`, [edgePoint(i, u0, y + fall, back), edgePoint(i, u1, y + fall, back), edgePoint(i, u1, y, front), edgePoint(i, u0, y, front), edgePoint(i, u0, y + fall + thickness, back), edgePoint(i, u1, y + fall + thickness, back), edgePoint(i, u1, y + thickness, front), edgePoint(i, u0, y + thickness, front)], metal);
      }
    }
  });
  const outward = footprint.map((p, i) => { const q = footprint[(i + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[1] - p[1]) / L, -(q[0] - p[0]) / L]; });
  const expanded = footprint.map((p, i): Point2 => {
    const a = outward[(i + 3) % 4], b = outward[i], scale = .09 / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * scale, p[1] + (a[1] + b[1]) * scale];
  });
  if (!finished) {
    solid('sloping-roof', [...footprint.map((p): Vertex => [p[0] - centre[0], roofAt(p) - .12, p[1] - centre[1]]), ...footprint.map((p): Vertex => [p[0] - centre[0], roofAt(p), p[1] - centre[1]])], slab);
    solid('projecting-roof-cap', [...expanded.map((p): Vertex => [p[0] - centre[0], roofAt(p), p[1] - centre[1]]), ...expanded.map((p): Vertex => [p[0] - centre[0], roofAt(p) + .09, p[1] - centre[1]])], metal);
  } else {
    const inner = footprint.map((p,i): Point2 => {
      const a=outward[(i+3)%4],b=outward[i],scale=-.24/(1+a[0]*b[0]+a[1]*b[1]);
      return [p[0]+(a[0]+b[0])*scale,p[1]+(a[1]+b[1])*scale];
    });
    solid('weathered-roof-deck', [...inner.map((p): Vertex => [p[0] - centre[0], roofAt(p) - .48, p[1] - centre[1]]), ...inner.map((p): Vertex => [p[0] - centre[0], roofAt(p) - .36, p[1] - centre[1]])], slab);
    footprint.forEach((p,i) => {const q=footprint[(i+1)%4],length=Math.hypot(q[0]-p[0],q[1]-p[1]),level=(u:number)=>roofAt([p[0]+(q[0]-p[0])*u/length,p[1]+(q[1]-p[1])*u/length])-(i%2?.36:0);
      const back=-.24,front=.09,start=i%2? .24 : -.09,end=i%2?length-.24:length+.09;
      const capPoint=(u:number,offset:number,lift:number):Vertex=>{const v=edgePoint(i,u,level(u),offset);v[1]=roofAt([v[0]+centre[0],v[2]+centre[1]])-(i%2?.36:0)+lift;return v;},thickness=i%2?.06:.09;
      solid(i%2?'low-eave-metal':'raised-end-wall-coping',[capPoint(start,back,0),capPoint(end,back,0),capPoint(end,front,0),capPoint(start,front,0),capPoint(start,back,thickness),capPoint(end,back,thickness),capPoint(end,front,thickness),capPoint(start,front,thickness)],metal);
    });
  }
  root.userData.audit = {roofCornerHeights: roof, vent, wallThickness: .24, roofProjection: .09, basis: 'Survey roof fall and June 2023 east-end imagery; vent dimensions and concealed construction approximate'};
  let disposed = false;
  return {root, setTextures, ready: felt?.ready, dispose() { if (disposed) return; disposed = true; for (const mesh of meshes) mesh.geometry.dispose(); for (const material of [masonry, metal, slab, red, pale, concrete, east, river, doorMetal, hardware, roofFinish]) material.dispose(); tag?.dispose(); riverTag?.dispose(); surfaces?.release(); root.removeFromParent(); }};
}



