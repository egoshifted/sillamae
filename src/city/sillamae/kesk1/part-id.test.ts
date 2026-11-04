import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceLines} from './part-id.ts';

test('a generated stack line maps back to the authored line', () => {
  assert.equal(sourceLines(';;;;AASA')[5], 10);
});
