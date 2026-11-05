import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type {OverrideContext} from '../../../engine/types.ts';
import {createMassingStudy} from '../../../studio/assembly/massing.ts';
import {createBuilding} from './model.ts';
import {design} from './design.ts';
import {createShell} from './shell.ts';

const h = (x: number, z: number) => 11.2 + (x - 243) * .04 + (z - 754) * .015;
const triangle = (offset: number, coords: number[]) => coords.flatMap((x, i) => i % 2 ? [] : [x, coords[i + 1], h(x, coords[i + 1]) + offset]);
const ground = [0, .18, .32].flatMap(offset => [triangle(offset, [235, 745, 265, 745, 265, 775]), triangle(offset, [235, 745, 265, 775, 235, 775])]);
const context = {scene: new THREE.Scene(), building: {id: '213321429', name: 'Kajaka 8a', pick: 277, c: [248.125, 758.825], g: design.footprint!, h: 4.78}, frame: {origin: [750, 760], base: 19.3}, ground, terrain: {origin: [0, 0], step: 1, width: 0, height: 0, values: [], meta: {}}} as OverrideContext;

function gaps(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  let missed = 0;
  const g = design.footprint!;
  g.forEach((p, i) => {
    const q = g[(i + 1) % g.length], dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    const outward = new THREE.Vector3(dz / length, 0, -dx / length);
    for (let j = 1; j < 31; j++) {
      const x = p[0] + dx * j / 31, z = p[1] + dz * j / 31;
      for (const lift of [.01, .19, .33]) {
        const at = new THREE.Vector3(x - 750, h(x, z) + lift - 19.3, z - 760).addScaledVector(outward, .1);
        const hit = new THREE.Raycaster(at, outward.clone().negate(), 0, .2).intersectObject(root, true);
        if (!hit.length) missed++;
      }
    }
  });
  return missed;
}

test('all four sides meet sloping, layered ground in a shifted frame; old floating mass fails', () => {
  const before = JSON.stringify(context.ground), old = createMassingStudy(context, design), model = createBuilding(context);
  assert.ok(gaps(old.root) > 0, 'negative control must expose the original ground gap');
  assert.equal(gaps(model.root), 0, 'every perimeter probe must hit an outward-facing wall or foundation just above ground');
  assert.equal(JSON.stringify(context.ground), before, 'seating must not grade or move survey layers');
  const shell = new THREE.Box3().setFromObject(model.root.getObjectByName('shell')!);
  assert.ok(shell.max.y - shell.min.y > 4.86 && shell.max.y - shell.min.y < 4.90);
  model.dispose(); model.dispose(); old.dispose();
});

test('missing site ground cannot silently recreate a floating shell', () => {
  assert.throws(() => createBuilding({...context, ground: []}), /ground coverage/);
});

test('east-end vent is recessed through the wall and has three separate louvred bays', () => {
  const model = createShell([0, 0]); model.root.updateMatrixWorld(true);
  const p = design.footprint![0], q = design.footprint![1], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), out = new THREE.Vector3(dz / L, 0, -dx / L);
  const origin = new THREE.Vector3(p[0] + dx / L * 1.25, 3.25, p[1] + dz / L * 1.25).addScaledVector(out, .2);
  const ray = new THREE.Raycaster(origin, out.clone().negate(), 0, .5);
  const walls = model.root.children.filter(m => m.name.includes('wall'));
  assert.equal(ray.intersectObjects(walls).length, 0, 'the vent must not have a solid wall behind its visible frame');
  for (const bay of [0, 1, 2]) assert.ok(model.root.children.some(m => m.name.startsWith('vent-louvre-' + bay + '-')));
  assert.ok(ray.intersectObjects(model.root.children.filter(m => m.name.startsWith('vent-louvre'))).every(hit => hit.distance > .2), 'louvres must sit behind the wall plane');
  model.dispose();
});

test('roof follows the survey fall and projects beyond the former flush shell', () => {
  const model = createShell([0, 0]); model.root.updateMatrixWorld(true);
  const footprint = design.footprint!, p = footprint[0], q = footprint[1], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
  const height = (t: number) => {
    const x = p[0] + dx * t + dz / L * .05, z = p[1] + dz * t - dx / L * .05;
    const hit = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)).intersectObject(model.root, true)[0];
    assert.ok(hit, 'roof edge must extend beyond the imported wall line'); return hit.point.y;
  };
  assert.ok(Math.abs(height(.1) - height(.9) - .39 * .8) < .015);
  model.dispose();
});

test('corner wall thicknesses do not project beyond adjoining exterior planes', () => {
  const model = createShell([0, 0]); model.root.updateMatrixWorld(true);
  const footprint = design.footprint!;
  footprint.forEach((p, i) => {
    const q = footprint[(i + 1) % 4], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), out = new THREE.Vector3(dz / L, 0, -dx / L);
    for (const u of [.01, .08, .2, L - .2, L - .08, L - .01]) {
      const origin = new THREE.Vector3(p[0] + dx * u / L, 1.5, p[1] + dz * u / L).addScaledVector(out, .1);
      const hit = new THREE.Raycaster(origin, out.clone().negate(), 0, .2).intersectObject(model.root, true)[0];
      assert.ok(hit && Math.abs(hit.distance - .1) < .00005, 'only the intended exterior plane may be visible near a corner');
    }
  });
  model.dispose();
});

test('refined roof lies below the raised end walls shown in the supplied river view', () => {
  const model = createShell([0, 0], true), old = createShell([0, 0]);
  model.root.updateMatrixWorld(true); old.root.updateMatrixWorld(true);
  const p = design.footprint!.reduce((v, p) => [v[0] + p[0] / 4, v[1] + p[1] / 4], [0, 0]);
  const ray = new THREE.Raycaster(new THREE.Vector3(p[0], 10, p[1]), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(model.root, true)[0], prior = ray.intersectObject(old.root, true)[0];
  assert.equal(hit.object.name, 'weathered-roof-deck');
  assert.ok(prior.point.y - hit.point.y > .44 && prior.point.y - hit.point.y < .46);
  assert.equal(model.root.children.filter(m => m.name === 'raised-end-wall-coping').length, 2);
  model.dispose(); old.dispose();
});

test('grey double door is recessed in a real opening on the opposite pale wall', () => {
  const model = createShell([0, 0], true), old = createShell([0, 0]);
  model.root.updateMatrixWorld(true); old.root.updateMatrixWorld(true);
  const p = design.footprint![3], q = design.footprint![0], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), out = new THREE.Vector3(dz / L, 0, -dx / L);
  const origin = new THREE.Vector3(p[0] + dx / L * 3.6, 1.5, p[1] + dz / L * 3.6).addScaledVector(out, .1), ray = new THREE.Raycaster(origin, out.clone().negate(), 0, .4);
  assert.equal(ray.intersectObjects(model.root.children.filter(m => m.name.includes('wall'))).length, 0);
  const hit = ray.intersectObject(model.root, true)[0];
  assert.equal(hit.object.name, 'door-leaf-left'); assert.ok(hit.distance > .16 && hit.distance < .17);
  assert.equal(ray.intersectObject(old.root, true)[0].object.name, 'wall-3');
  model.dispose(); old.dispose();
});

test('roof slab cannot overlap either exposed long wall below the eaves', () => {
  const model = createShell([0, 0], true); model.root.updateMatrixWorld(true);
  const heights = [4.71, 4.32, 4.39, 4.78];
  for (const edge of [1, 3]) {
    const p = design.footprint![edge], q = design.footprint![(edge + 1) % 4], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), out = new THREE.Vector3(dz / L, 0, -dx / L);
    for (const t of [.2, .4, .6, .8]) {
      const y = heights[edge] * (1 - t) + heights[(edge + 1) % 4] * t - .42;
      const origin = new THREE.Vector3(p[0] + dx * t, y, p[1] + dz * t).addScaledVector(out, .1);
      const hits = new THREE.Raycaster(origin, out.clone().negate(), 0, .13).intersectObject(model.root, true);
      assert.ok(hits.length); assert.ok(hits.every(hit => hit.object.name.includes('wall')), 'only masonry may occupy this exterior strip');
    }
  }
  model.dispose();
});
