import test from 'node:test';
import assert from 'node:assert/strict';
import {planFrame, planToWorld, worldToPlan} from './plan.ts';

test('a rotated rectangle lands square inside the plan grid', () => {
  const angle = 20 * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const local: [number, number][] = [[0, 0], [10, 0], [10, 4], [0, 4]];
  const world = local.map(([x, z]): [number, number] => [x * c - z * s + 30, x * s + z * c - 12]);
  const frame = planFrame(world, world);
  const planned = world.map(([x, z]) => worldToPlan(x, z, frame.angle));
  const xs = planned.map(p => p[0]), zs = planned.map(p => p[1]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 10) < 1e-6);
  assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - 4) < 1e-6);
  assert.ok(Math.abs(frame.minX - Math.min(...xs)) < 1e-9);
  assert.ok(Math.abs(frame.minZ - Math.min(...zs)) < 1e-9);
  for (const [x, z] of planned) {
    assert.ok(x >= frame.cx - frame.half && x <= frame.cx + frame.half);
    assert.ok(z >= frame.cz - frame.half && z <= frame.cz + frame.half);
  }
  world.forEach(([x, z], i) => {
    const [px, pz] = worldToPlan(x, z, frame.angle);
    const [wx, wz] = planToWorld(px, pz, frame.angle);
    assert.ok(Math.abs(wx - x) < 1e-9 && Math.abs(wz - z) < 1e-9, String(i));
  });
});

test('points outside the footprint stay inside the plan square', () => {
  const footprint: [number, number][] = [[0, 0], [8, 0], [8, 8], [0, 8]];
  const balcony: [number, number] = [8.4, 3];
  const frame = planFrame(footprint, [balcony]);
  const [x, z] = worldToPlan(balcony[0], balcony[1], frame.angle);
  assert.ok(x <= frame.maxX && x >= frame.minX);
  assert.ok(x < frame.cx + frame.half && z < frame.cz + frame.half);
});
