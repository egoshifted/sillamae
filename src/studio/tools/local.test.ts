import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localDirectory, repo, writeNew} from './local.ts';

test('review outputs cannot enter the repository, including through a junction', () => {
  assert.throws(() => localDirectory(path.join(repo, 'review-test')), /outside/);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-studio-'));
  try {
    fs.symlinkSync(repo, path.join(scratch, 'repo-link'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => localDirectory(path.join(scratch, 'repo-link', 'review-test')), /outside/);
    const out = localDirectory(path.join(scratch, 'evidence'));
    const file = path.join(out, 'record.json'); writeNew(file, {original: true});
    assert.throws(() => writeNew(file, {original: false}), /EEXIST/);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).original, true);
  } finally { fs.unlinkSync(path.join(scratch, 'repo-link')); assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir())); fs.rmSync(scratch, {recursive: true}); }
});
