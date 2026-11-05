import assert from 'node:assert/strict';
import test from 'node:test';
import {balconies} from './balconies.ts';

test('every balcony row is ordered and stays inside its bay', () => {
  for (const row of balconies.rows) {
    let end = 0;
    for (const seg of row.segments) {
      assert.ok(seg.from >= end && seg.to > seg.from && seg.to <= 1, `section ${row.section} floor ${row.floor}`);
      end = seg.to;
    }
  }
});

test('section 4 follows the May 2024 southeast view', () => {
  const floor = (n: number) => balconies.rows.find(r => r.section === 4 && r.floor === n)!.segments;
  assert.deepEqual(floor(1).map(s => s.frame), ['light', 'white']);
  assert.ok(floor(1)[0].panePitch! < .4, 'the older run has narrow panes');
  assert.ok(floor(2)[1].curtains);
  assert.ok(floor(3).at(-1)!.fascia, 'the red-brown enclosure is on the third floor, not the second');
  assert.ok(floor(3)[1].from - floor(3)[0].to > .4, 'most of the third floor stays open');
  assert.equal(floor(5)[0].cover, 'sheet');
});
