import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {CHUNK} from '../../engine/terrain-edit.ts';
import {studioSites} from './server.ts';

test('saving the site store writes items and terrain chunks, refuses stale saves, and rebuilds only on request', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-save-'));
  const release: (() => void)[] = [];
  const server = await createServer({root, configFile: false, plugins: [studioSites(() => new Promise<void>(resolve => release.push(resolve)))], server: {host: '127.0.0.1', port: 0}, logLevel: 'silent'});
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port + '/__studio';
    const put = (value: unknown) => fetch(base + '/site', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(value)});
    const opened = await fetch(base + '/site').then(r => r.json());
    assert.deepEqual(opened.site, {version: 3, placements: []});
    const site = {version: 3, placements: [{id: 'bin', asset: 'bin-wheeled-01', p: [214, 572, 12], heading: 0, attach: 'ground'}], roads: [{id: 'path', type: 'kerbed-path', points: [[212, 612], [214, 614]]}]};
    const raised = new Array(CHUNK * CHUNK).fill(0);
    raised[5] = 40;
    const first = await put({revision: opened.revision, site, terrain: {'3_9': raised, '4_9': null}});
    assert.equal(first.status, 200);
    const saved = await first.json();
    assert.equal(saved.build.state, 'pending');
    assert.equal(release.length, 0);
    // A second window opened before that save would undo it.
    const stale = await put({revision: opened.revision, site: {version: 3, placements: []}});
    assert.equal(stale.status, 409);
    const update = await fetch(base + '/atlas-build', {method: 'POST'});
    assert.equal(update.status, 202);
    assert.equal(release.length, 1);
    const reread = await fetch(base + '/site');
    assert.equal(reread.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await reread.json(), {revision: saved.revision, site});
    assert.deepEqual(await fetch(base + '/terrain?keys=3_9,4_9').then(r => r.json()), {'3_9': raised});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/source/site/items.json'), 'utf8')), site);
    const cleared = await put({revision: saved.revision, site, terrain: {'3_9': null}});
    assert.equal(cleared.status, 200);
    assert.ok(!fs.existsSync(path.join(root, 'data/source/site/terrain/3_9.json')));
    release[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await put({revision: 'x', site: {}})).status, 400);
    assert.equal((await put({revision: (await cleared.json()).revision, site, terrain: {'3_9': [1, 2]}})).status, 400);
  } finally { release.forEach(done => done()); await server.close(); fs.rmSync(root, {recursive: true, force: true}); }
});
