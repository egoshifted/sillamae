import test from 'node:test';
import assert from 'node:assert/strict';
import {cutGround} from './ground-cut.ts';

const square = [[0, 0, 1, 10, 0, 1, 10, 10, 1], [0, 0, 1, 10, 10, 1, 0, 10, 1]];
const area = (t: number[]) => Math.abs((t[3] - t[0]) * (t[7] - t[1]) - (t[6] - t[0]) * (t[4] - t[1])) / 2;

test('ground cuts: no cuts return the site ground itself', () => {
  assert.equal(cutGround(square, []), square);
});

test('ground cuts: a convex cut removes exactly its area, keeps heights, and leaves the input untouched', () => {
  const before = JSON.stringify(square);
  for (const cut of [[[2, 2], [5, 2], [5, 4], [2, 4]], [[2, 4], [5, 4], [5, 2], [2, 2]]] as [number, number][][]) {
    const out = cutGround(square, [cut]);
    assert.ok(Math.abs(out.reduce((s, t) => s + area(t), 0) - (100 - 6)) < 1e-9, 'cut area is not removed for either winding');
    assert.ok(out.every(t => t[2] === 1 && t[5] === 1 && t[8] === 1));
    for (const t of out) {
      const cx = (t[0] + t[3] + t[6]) / 3, cz = (t[1] + t[4] + t[7]) / 3;
      assert.ok(!(cx > 2 && cx < 5 && cz > 2 && cz < 4), 'ground left inside the cut');
    }
  }
  assert.equal(JSON.stringify(square), before);
});
