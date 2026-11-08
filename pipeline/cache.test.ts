import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {beginBuild, changedInputs, onlyLiveModels} from './cache.ts';

test('changed inputs are listed against the published data, which must exist and be intact', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillamae-cache-'));
  try {
    fs.writeFileSync(path.join(root,'first'),'one');fs.writeFileSync(path.join(root,'second'),'two');
    assert.equal(changedInputs(root,['first','second']),null);
    const build=await beginBuild(root,['first','second']);assert.ok(build);
    fs.writeFileSync(path.join(build.directory,'world.json'),'accepted');build.commit();
    assert.deepEqual(changedInputs(root,['first','second']),[]);
    fs.writeFileSync(path.join(root,'second'),'three');
    assert.deepEqual(changedInputs(root,['first','second']),['second']);
    fs.unlinkSync(path.join(root,'public/data/world.json'));
    assert.equal(changedInputs(root,['first','second']),null);
  } finally {assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});}
});

test('only edits inside building folders can skip a rebuild', () => {
  assert.ok(onlyLiveModels([]));
  assert.ok(onlyLiveModels(['src/city/sillamae/kesk8a/details.ts','src/city/sillamae/shared/masonry.ts','src/studio/assembly/batch.ts']));
  for (const name of ['src/city/sillamae/index.ts','src/city/sillamae/terrain-detail.ts','src/city/sillamae/assets/library.ts','src/engine/survey/drape.ts','pipeline/roads.ts','data/source/osm.json','package.json'])
    assert.ok(!onlyLiveModels(['src/city/sillamae/kesk8a/details.ts',name]),name);
});

test('cache verifies content, repairs missing outputs and retains accepted data on input races', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sillamae-cache-'));
  try {
    fs.writeFileSync(path.join(root,'input'),'first');
    const build=await beginBuild(root,['input']);assert.ok(build);
    fs.writeFileSync(path.join(build.directory,'world.json'),'accepted');build.commit();
    assert.equal(await beginBuild(root,['input']),null);
    fs.unlinkSync(path.join(root,'public/data/world.json'));
    const repair=await beginBuild(root,['input']);assert.ok(repair);
    fs.writeFileSync(path.join(repair.directory,'world.json'),'accepted');repair.commit();
    const changed=await beginBuild(root,['input'],true);assert.ok(changed);
    fs.writeFileSync(path.join(changed.directory,'world.json'),'unaccepted');
    fs.writeFileSync(path.join(root,'input'),'second');
    assert.throws(()=>changed.commit(),/changed during/);changed.close();
    assert.equal(fs.readFileSync(path.join(root,'public/data/world.json'),'utf8'),'accepted');
    assert.ok(!fs.existsSync(path.join(root,'public/.data-build.lock')));
    const staged=await beginBuild(root,['input'],true);assert.ok(staged);
    fs.writeFileSync(path.join(staged.directory,'world.json'),'recovered');
    const previous=path.join(root,'public','.data-previous-'+process.pid);fs.mkdirSync(previous);
    assert.throws(()=>staged.commit(),/publication failed/);staged.close();
    assert.equal(fs.readFileSync(path.join(root,'public/data/world.json'),'utf8'),'accepted');
    assert.ok(fs.existsSync(staged.directory));fs.rmdirSync(previous);
    assert.equal(await beginBuild(root,['input']),null);
    assert.equal(fs.readFileSync(path.join(root,'public/data/world.json'),'utf8'),'recovered');
  } finally {assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});}
});
