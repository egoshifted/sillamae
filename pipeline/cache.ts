import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const buildInputs = ['data/source', 'pipeline', 'src/engine', 'src/city', 'src/studio/assembly', 'package.json', 'package-lock.json', 'tsconfig.json'];
export function files(root: string, paths: string[]) {
  const result: Record<string, string> = {};
  const visit = (name: string) => {
    const file = path.join(root, name), stat = fs.statSync(file);
    if (stat.isDirectory()) for (const child of fs.readdirSync(file).sort()) visit(path.join(name, child));
    else result[name.replaceAll(path.sep, '/')] = hash(fs.readFileSync(file));
  };
  paths.forEach(visit); return result;
}

export async function beginBuild(root: string, inputs = buildInputs, force = false) {
  root = fs.realpathSync(root);
  const publicDir = path.join(root, 'public'), output = path.join(publicDir, 'data'), lock = path.join(publicDir, '.data-build.lock');
  fs.mkdirSync(publicDir, {recursive: true});
  const fingerprint = () => hash(JSON.stringify({node: process.versions.node, inputs: files(root, inputs)}));
  const signature = fingerprint();
  const valid = (directory = output) => {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(directory, '.build.json'), 'utf8')) as {signature: string; outputs: Record<string, string>};
      return record.signature === signature && Object.keys(record.outputs).length > 0 && Object.entries(record.outputs).every(([file, digest]) => hash(fs.readFileSync(path.join(directory, file))) === digest);
    } catch { return false; }
  };
  const start = Date.now();
  for (;;) {
    try { fs.writeFileSync(lock, String(process.pid), {flag: 'wx'}); break; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      let owner: number;
      try { owner = Number(fs.readFileSync(lock, 'utf8')); } catch { continue; }
      if (owner > 0) {
        try { process.kill(owner, 0); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') { fs.rmSync(lock, {force: true}); continue; } }
      }
      if (Date.now() - start > 30 * 60 * 1000) throw Error('Another data build still holds ' + lock);
      await setTimeout(250);
    }
  }
  const release = () => { try { if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.unlinkSync(lock); } catch {} };
  const publish = (directory: string) => {
    const previous = path.join(publicDir, '.data-previous-' + process.pid);
    if (fs.existsSync(previous)) throw Error('Previous output recovery directory exists: ' + previous);
    const existed = fs.existsSync(output);
    if (existed) fs.renameSync(output, previous);
    try { fs.renameSync(directory, output); }
    catch (error) { if (existed) fs.renameSync(previous, output); throw error; }
    if (existed) fs.rmSync(previous, {recursive: true});
  };
  try {
    if (fingerprint() !== signature) throw Error('Data inputs changed while waiting for the build lock; rerun the build');
    if (!force && valid()) { release(); console.log('data: unchanged inputs and verified outputs; using cache'); return null; }
    if (!force) for (const name of fs.readdirSync(publicDir).filter(name => name.startsWith('.data-build-'))) {
      const staged = path.join(publicDir, name);
      if (fs.statSync(staged).isDirectory() && valid(staged)) { publish(staged); release(); console.log('data: published verified staged output'); return null; }
    }
    const directory = fs.mkdtempSync(path.join(publicDir, '.data-build-'));
    let closed = false, preserve = false;
    const close = () => {
      if (closed) return; closed = true;
      if (path.dirname(directory) !== publicDir || !path.basename(directory).startsWith('.data-build-')) throw Error('Invalid build directory');
      if (!preserve) fs.rmSync(directory, {recursive: true, force: true});
      release(); process.removeListener('exit', release);
    };
    process.once('exit', release);
    return {directory, close, commit() {
      if (fingerprint() !== signature) throw Error('Data inputs changed during the build; existing output was retained');
      const outputs = files(directory, fs.readdirSync(directory).sort());
      fs.writeFileSync(path.join(directory, '.build.json'), JSON.stringify({signature, outputs}));
      try { publish(directory); }
      catch (error) { preserve = true; throw new Error(`Data publication failed; verified output retained at ${directory}. Close processes holding public/data and rerun npm run data.`, {cause: error}); }
      close();
    }};
  } catch (error) { release(); throw error; }
}
