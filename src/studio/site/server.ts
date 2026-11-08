import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn, type ChildProcess} from 'node:child_process';
import {AtlasBuildQueue} from './atlas-build.ts';
import path from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {CHUNK, CHUNK_KEY} from '../../engine/terrain-edit.ts';

// Development-server endpoints for the site editor: it saves the town's site store
// into data/source and moves reviewed drafts. Only the local dev server has them;
// the published build is static.
const SITE = 'data/source/site', TERRAIN = 'data/source/site/terrain', BUILDINGS = 'data/source/buildings', ASSETS = 'src/city/sillamae/assets', DRAFTS = 'src/city/sillamae/asset-drafts';
const BUILDING_ID = /^\d+$/, ASSET_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d{2}$/;

const body = (request: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let text = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { text += chunk; if (text.length > 5e7) reject(Error('Body too large')); });
  request.on('end', () => resolve(text));
  request.on('error', reject);
});

function send(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(value));
}

// The store as saved, items and every terrain chunk, so a save from a stale window is refused.
function revision(root: string) {
  const hash = createHash('sha1'), items = path.join(root, SITE, 'items.json'), chunks = path.join(root, TERRAIN);
  hash.update(fs.existsSync(items) ? fs.readFileSync(items) : '');
  for (const f of fs.existsSync(chunks) ? fs.readdirSync(chunks).sort() : []) hash.update('/' + f + '/').update(fs.readFileSync(path.join(chunks, f)));
  return hash.digest('hex');
}

// Writes atomically, and only when the contents change; true when it wrote.
function write(file: string, contents: string) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents) return false;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file + '.tmp', contents);
  fs.renameSync(file + '.tmp', file);
  return true;
}

// Rebuilds go to one long-lived build process (pipeline/build.ts --serve) that keeps
// the town's ground between them: the first takes minutes, and later ones whose edits
// leave the ground alone take seconds. It exits on its own when idle.
function atlasBuilder(root: string) {
  let child: ChildProcess | undefined, log = '';
  const start = () => {
    const c = spawn(process.execPath, ['--max-old-space-size=8192', 'pipeline/build.ts', '--serve'], {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
    const capture = (chunk: Buffer) => { log = (log + chunk.toString()).slice(-12000); };
    c.stdout!.on('data', capture);
    c.stderr!.on('data', capture);
    c.once('exit', () => { if (child === c) child = undefined; });
    return c;
  };
  const once = () => new Promise<'built' | 'restart'>((resolve, reject) => {
    const c = child ??= start();
    log = '';
    const settle = () => { c.off('message', message); c.off('exit', exit); c.off('error', exit); };
    const message = (m: {state: string; error?: string}) => {
      settle();
      if (m.state === 'failed') return reject(Error(log.trim() || m.error || 'Atlas rebuild failed'));
      if (m.state === 'restart') { if (child === c) child = undefined; c.kill(); }
      resolve(m.state === 'restart' ? 'restart' : 'built');
    };
    const exit = (code: unknown) => { settle(); reject(Error(log.trim() || 'Atlas rebuild failed (' + code + ')')); };
    c.on('message', message);
    c.once('exit', exit);
    c.once('error', exit);
    c.send('build');
  });
  return {
    // A process started before code changed would build with the old modules, so it hands over to a fresh one.
    async run() { if (await once() === 'restart' && await once() === 'restart') throw Error('Atlas build process restarted twice'); },
    stop() { child?.kill(); },
  };
}

export function studioSites(run?: (root: string) => Promise<void>): Plugin {
  return {
    name: 'studio-sites',
    apply: 'serve',
    config: () => ({server: {watch: {ignored: ['**/public/data', '**/public/data/**', '**/public/.data-*', '**/public/.data-*/**', '**/public/.data-build.lock', '**/data/source/site/**', '**/data/source/buildings/**']}}}),
    configureServer(server) {
      const root = server.config.root, builder = run ? null : atlasBuilder(root), builds = new AtlasBuildQueue(() => run ? run(root) : builder!.run());
      server.httpServer?.once('close', () => builder?.stop());
      server.middlewares.use((request, response, next) => {
        if ((request.url ?? '').startsWith('/data/')) response.setHeader('cache-control', 'no-store');
        next();
      });
      server.middlewares.use('/__studio', (request, response, next) => {
        const parts = (request.url ?? '').split('?')[0].split('/').filter(Boolean);
        void (async () => {
          if (parts[0] === 'atlas-build' && parts.length === 1 && request.method === 'GET') return send(response, 200, builds.status());
          if (parts[0] === 'atlas-build' && parts.length === 1 && request.method === 'POST') return send(response, 202, builds.request());
          if (parts[0] === 'site' && parts.length === 1 && request.method === 'GET') {
            const file = path.join(root, SITE, 'items.json');
            const site = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {version: 3, placements: []};
            return send(response, 200, {revision: revision(root), site});
          }
          if (parts[0] === 'terrain' && parts.length === 1 && request.method === 'GET') {
            const keys = (new URL(request.url ?? '', 'http://local').searchParams.get('keys') ?? '').split(',').filter(k => CHUNK_KEY.test(k));
            const chunks: Record<string, number[]> = {};
            for (const key of keys) {
              const file = path.join(root, TERRAIN, key + '.json');
              if (fs.existsSync(file)) chunks[key] = JSON.parse(fs.readFileSync(file, 'utf8')).deltas;
            }
            return send(response, 200, chunks);
          }
          if (parts[0] === 'site' && parts.length === 1 && request.method === 'PUT') {
            const {revision: base, site, terrain = {}} = JSON.parse(await body(request));
            if (site?.version !== 3 || !Array.isArray(site.placements)) return send(response, 400, {error: 'Not a site store'});
            const chunksOk = Object.entries(terrain as Record<string, unknown>).every(([key, deltas]) => CHUNK_KEY.test(key) && (deltas === null || (Array.isArray(deltas) && deltas.length === CHUNK * CHUNK && deltas.every(v => Number.isInteger(v)))));
            if (!chunksOk) return send(response, 400, {error: 'Bad terrain chunks'});
            // Another window or tool saved since this one opened; writing now would undo its work.
            if (base !== revision(root)) return send(response, 409, {error: 'The site was saved elsewhere since this area was opened. Reopen the area to continue; saving now would undo that work.'});
            let changed = write(path.join(root, SITE, 'items.json'), JSON.stringify(site, null, 1) + '\n');
            for (const [key, deltas] of Object.entries(terrain as Record<string, number[] | null>)) {
              const file = path.join(root, TERRAIN, key + '.json');
              if (deltas) changed = write(file, JSON.stringify({deltas}) + '\n') || changed;
              else if (fs.existsSync(file)) { fs.rmSync(file); changed = true; }
            }
            if (changed) builds.saved();
            return send(response, 200, {revision: revision(root), saved: site.placements.length, build: builds.status()});
          }
          if (parts[0] === 'buildings' && parts.length === 2 && BUILDING_ID.test(parts[1]) && request.method === 'GET') {
            const file = path.join(root, BUILDINGS, parts[1] + '.json');
            // Most buildings have no record; a 404 would count as a browser error in every capture.
            if (!fs.existsSync(file)) return send(response, 200, {});
            return send(response, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
          }
          if (parts[0] === 'buildings' && parts.length === 2 && request.method === 'PUT') {
            const id = parts[1];
            if (!BUILDING_ID.test(id)) return send(response, 400, {error: 'Bad building id'});
            const record = JSON.parse(await body(request));
            const designOk = record.design == null || typeof record.design === 'object';
            const editsOk = record.edits == null || Array.isArray(record.edits);
            // A studio version stays in data/source/buildings. It must not queue an atlas rebuild.
            if (record.version !== 1 || record.id !== id || !designOk || !editsOk || (record.design == null && record.edits == null)) return send(response, 400, {error: 'Not a building record'});
            fs.mkdirSync(path.join(root, BUILDINGS), {recursive: true});
            const file = path.join(root, BUILDINGS, id + '.json'), temporary = file + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n');
            fs.renameSync(temporary, file);
            return send(response, 200, {saved: id});
          }
          if (parts[0] === 'assets' && parts.length === 3 && request.method === 'POST' && ASSET_ID.test(parts[1])) {
            const [, id, action] = parts, draft = path.join(root, DRAFTS, id), approved = path.join(root, ASSETS, id);
            if (!fs.existsSync(draft)) return send(response, 404, {error: 'No such draft'});
            if (action === 'approve') {
              if (fs.existsSync(approved)) return send(response, 409, {error: 'The library already has ' + id});
              fs.renameSync(draft, approved);
              return send(response, 200, {approved: id});
            }
            if (action === 'reject') {
              const {notes} = JSON.parse(await body(request));
              if (!String(notes ?? '').trim()) return send(response, 400, {error: 'Notes are needed'});
              fs.appendFileSync(path.join(draft, 'REVIEW.md'), `\n## Rejected ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n\n${String(notes).trim()}\n`);
              return send(response, 200, {rejected: id});
            }
          }
          next();
        })().catch(e => send(response, 500, {error: String(e)}));
      });
    },
  };
}
