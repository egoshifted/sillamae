import test from 'node:test';
import assert from 'node:assert/strict';
import {partIds, sourceLines} from './part-id.ts';

test('a generated stack line maps back to the authored line', () => {
  assert.equal(sourceLines(';;;;AASA')[5], 10);
});

test('each build numbers its parts from the start', () => {
  const build = () => { const next = partIds('', () => 'model.ts:129'); return [next(), next()]; };
  assert.deepEqual(build(), ['model.ts:129', 'model.ts:129#2']);
  assert.deepEqual(build(), ['model.ts:129', 'model.ts:129#2']);
});
