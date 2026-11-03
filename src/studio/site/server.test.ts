import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {studioSites} from './server.ts';

test('saving separate squares persists both files without rebuilding until explicitly requested', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-save-'));
  const release: (() => void)[] = [];
  const server = await createServer({root, configFile: false, plugins: [studioSites(() => new Promise<void>(resolve => release.push(resolve)))], server: {host: '127.0.0.1', port: 0}, logLevel: 'silent'});
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port + '/__studio';
    const first = {version: 1, id: '214_572_50', square: {centre: [214, 572], size: 50}, placements: [{id: 'bin', asset: 'bin-wheeled-01', p: [214,572,12], heading: 0, attach: 'ground'}]};
    const second = {version: 1, id: '212_612_50', square: {centre: [212,612],size:50}, placements: [], roads: [{id:'path',type:'kerbed-path',points:[[212,612],[214,614]]}]};
    for (const site of [first, second]) {
      const response = await fetch(base + '/sites/' + site.id, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(site)});
      assert.equal(response.status, 200);
      assert.equal((await response.json()).build.state, 'pending');
    }
    assert.equal(release.length, 0);
    const update = await fetch(base + '/atlas-build', {method: 'POST'});
    assert.equal(update.status, 202);
    assert.equal((await update.json()).state, 'building');
    assert.equal(release.length, 1);
    for (const site of [first, second]) {
      const response = await fetch(base + '/sites/' + site.id);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), site);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'data/source/placements',site.id+'.json'),'utf8')),site);
    }
    release[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(release.length, 1);
    assert.deepEqual(await fetch(base + '/atlas-build').then(r=>r.json()), {state:'ready'});
    const bad = await fetch(base + '/sites/' + first.id, {method:'PUT',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(bad.status,400);
    assert.deepEqual(await fetch(base + '/sites/' + first.id).then(r=>r.json()),first);
  } finally { release.forEach(done=>done()); await server.close(); fs.rmSync(root,{recursive:true,force:true}); }
});
