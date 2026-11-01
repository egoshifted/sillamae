import fs from 'node:fs';
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
  response.end(JSON.stringify(value));
}

export function studioSites(): Plugin {
  return {
    name: 'studio-sites',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;
      server.middlewares.use('/__studio', (request, response, next) => {
        const parts = (request.url ?? '').split('?')[0].split('/').filter(Boolean);
        void (async () => {
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
            fs.writeFileSync(path.join(root, SITES, id + '.json'), JSON.stringify(site, null, 1) + '\n');
            return send(response, 200, {saved: site.placements.length});
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
