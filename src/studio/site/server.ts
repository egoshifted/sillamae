import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {AtlasBuildQueue} from './atlas-build.ts';
import path from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin} from 'vite';

// Development-server endpoints for the site editor: it saves placements into
// data/source and moves reviewed drafts. Only the local dev server has them;
// the published build is static.
const SITES = 'data/source/placements', ASSETS = 'src/city/sillamae/assets', DRAFTS = 'src/city/sillamae/asset-drafts';
const SITE_ID = /^-?\d+_-?\d+_\d+$/, ASSET_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d{2}$/;

const body = (request: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let text = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { text += chunk; if (text.length > 5e6) reject(Error('Body too large')); });
  request.on('end', () => resolve(text));
  request.on('error', reject);
});

function send(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(value));
}

function rebuildAtlas(root: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=8192', 'pipeline/build.ts'], {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let log = '';
    const capture = (chunk: Buffer) => { log = (log + chunk.toString()).slice(-12000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Error(log.trim() || 'Atlas rebuild failed (' + code + ')')));
  });
}

export function studioSites(run = rebuildAtlas): Plugin {
  return {
    name: 'studio-sites',
    apply: 'serve',
    config: () => ({server: {watch: {ignored: ['**/public/data', '**/public/data/**', '**/public/.data-*', '**/public/.data-*/**', '**/public/.data-build.lock', '**/data/source/placements/**']}}}),
    configureServer(server) {
      const root = server.config.root, builds = new AtlasBuildQueue(() => run(root));
      server.middlewares.use((request, response, next) => {
        if ((request.url ?? '').startsWith('/data/')) response.setHeader('cache-control', 'no-store');
        next();
      });
      server.middlewares.use('/__studio', (request, response, next) => {
        const parts = (request.url ?? '').split('?')[0].split('/').filter(Boolean);
        void (async () => {
          if (parts[0] === 'atlas-build' && parts.length === 1 && request.method === 'GET') return send(response, 200, builds.status());
          if (parts[0] === 'sites' && parts.length === 1 && request.method === 'GET') {
            const dir = path.join(root, SITES);
            const sites = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
              const site = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
              return {id: site.id, square: site.square, count: site.placements?.length ?? 0};
            }) : [];
            return send(response, 200, sites);
          }
          if (parts[0] === 'sites' && parts.length === 2 && request.method === 'GET') {
            const file = path.join(root, SITES, parts[1] + '.json');
            if (!SITE_ID.test(parts[1]) || !fs.existsSync(file)) return send(response, 404, {error: 'No such site'});
            return send(response, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
          }
          if (parts[0] === 'sites' && parts.length === 2 && request.method === 'PUT') {
            const id = parts[1];
            if (!SITE_ID.test(id)) return send(response, 400, {error: 'Bad site id'});
            const site = JSON.parse(await body(request));
            if (site.version !== 1 || site.id !== id || !Array.isArray(site.placements)) return send(response, 400, {error: 'Not a placement site'});
            fs.mkdirSync(path.join(root, SITES), {recursive: true});
            const file = path.join(root, SITES, id + '.json'), temporary = file + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(site, null, 1) + '\n');
            fs.renameSync(temporary, file);
            return send(response, 200, {saved: site.placements.length, build: builds.request()});
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
