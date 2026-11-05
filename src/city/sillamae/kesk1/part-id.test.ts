import test from 'node:test';
import assert from 'node:assert/strict';
import {partIds, sourceLines} from './part-id.ts';

// First in the file: the source map loads once per module, so a later test would see it cached.
test('preparing part ids loads nothing, because the atlas prepares them and never asks for one', () => {
  const stub = globalThis as {XMLHttpRequest?: unknown};
  let opened = 0;
  stub.XMLHttpRequest = class { status = 404; responseText = ''; open() { opened++; } send() {} };
  try {
    const next = partIds('http://atlas/bundle.js', () => 'model.ts:1');
    assert.equal(opened, 0);
    next();
    assert.equal(opened, 1);
  } finally { delete stub.XMLHttpRequest; }
});

test('a generated stack line maps back to the authored line', () => {
  assert.equal(sourceLines(';;;;AASA')[5], 10);
});

test('each build numbers its parts from the start', () => {
  const build = () => { const next = partIds('', () => 'model.ts:129'); return [next(), next()]; };
  assert.deepEqual(build(), ['model.ts:129', 'model.ts:129#2']);
  assert.deepEqual(build(), ['model.ts:129', 'model.ts:129#2']);
});
