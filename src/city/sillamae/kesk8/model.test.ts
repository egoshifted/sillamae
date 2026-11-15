import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {design, frontispieceOpenings, length, width} from './design.ts';
import {createFinished, createOpenings, createShell} from './model.ts';

const context = () => {
  const scene = new THREE.Scene();
  scene.userData.keepParts = true;
  return {building: {} as never, frame: {origin: [750, 760] as [number, number], base: 19.3}, terrain: {} as never, ground: [], scene};
};
const parts = (root: THREE.Object3D) => {
  const meshes: THREE.Mesh[] = [];
  root.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child); });
  return meshes;
};

test('every stage builds finite geometry', () => {
  for (const build of [createShell, createOpenings, createFinished]) {
    const model = build(context());
    for (const mesh of parts(model.root)) {
      const p = mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.array.length; i++) assert.ok(Number.isFinite(p.array[i]), `${mesh.name} has a non-finite vertex`);
    }
    model.dispose();
  }
});

test('no eave or cornice crosses the frontispiece face', () => {
  const model = createFinished(context()), {from, to} = design.frontispiece, {eave} = design;
  const inside = (x: number) => x > from + .35 && x < to - .35;
  for (const mesh of parts(model.root)) {
    if (/shoulder|verge|surround|frontispiece|dormer|landing|step|rail/.test(mesh.name)) continue;
    const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
    // In front of the wall (z > 0 is -v), within the frontispiece span, at eave height.
    const crosses = box.max.z > .01 && inside((box.min.x + box.max.x) / 2) && box.min.y < eave + .3 && box.max.y > eave - .4;
    assert.ok(!crosses || box.max.x - box.min.x < .5, `${mesh.name} runs across the frontispiece at the eave`);
  }
  model.dispose();
});

test('no cornice rises through the roof sheets above it', () => {
  const model = createFinished(context()), {eave, ridge, eaveOverhang, rake, frontispiece, wing} = design;
  const slope = (ridge - eave) / (width / 2), underside = (v: number) => ridge - slope * Math.abs(v - width / 2);
  for (const mesh of parts(model.root)) {
    if (!/cornice/.test(mesh.name)) continue;
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), h = p.getY(i), v = -p.getZ(i);
      const covered = u > -rake && u < length + rake && v > -eaveOverhang && v < width + eaveOverhang
        && !(v < 0 && u > frontispiece.from - 1e-6 && u < frontispiece.to + 1e-6) && !(v > width && u > wing.from - 1e-6 && u < wing.to + 1e-6);
      if (covered) assert.ok(h <= underside(v) + 1e-6, `${mesh.name} reaches ${(h - underside(v)).toFixed(3)} m above the roof underside at u ${u.toFixed(2)}, v ${v.toFixed(2)}`);
    }
  }
  model.dispose();
});

test('frontispiece openings sit inside its span and the footprint is a fitted rectangle', () => {
  for (const o of frontispieceOpenings) assert.ok(o.from > design.frontispiece.from && o.to < design.frontispiece.to, o.id);
  assert.ok(Math.abs(length - 28.1) < .01 && Math.abs(width - 16.55) < 1e-9);
});
