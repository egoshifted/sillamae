import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDraft} from './new.ts';
import type {WorldData} from '../../engine/data.ts';

test('scaffold supports an unrelated building without overwriting work or registering it in production', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-draft-'));
  const city = path.join(root, 'src/city/sillamae'); fs.mkdirSync(city, {recursive: true}); fs.writeFileSync(path.join(city, 'index.ts'), 'unchanged');
  const world = {base: 20, buildings: [{id: '99', name: 'New test building', pick: 99, c: [0, 0], h: 4, g: [[0, 0], [1, 0], [1, 1]], heightRange: [2, 6]}]} as WorldData;
  try {
    assert.throws(() => createDraft(root, world, 'missing', 'new'), /missing/);
    assert.throws(() => createDraft(root, world, '99', '../outside'), /lowercase/);
    const result = createDraft(root, world, '99', 'new'); assert.equal(result.files.length, 4);
    assert.equal(fs.readFileSync(path.join(city, 'index.ts'), 'utf8'), 'unchanged');
    fs.writeFileSync(path.join(result.directory, 'model.ts'), 'preserved author work');
    assert.throws(() => createDraft(root, world, '99', 'new'), /never overwritten/);
    assert.equal(fs.readFileSync(path.join(result.directory, 'model.ts'), 'utf8'), 'preserved author work');
  } finally { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); fs.rmSync(root, {recursive: true}); }
});
