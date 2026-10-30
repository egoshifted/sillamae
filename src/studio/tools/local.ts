import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function option(name: string, required = false) {
  const index = process.argv.indexOf('--' + name), value = index < 0 ? undefined : process.argv[index + 1];
  if (value?.startsWith('--') || required && !value) throw Error('Expected --' + name + ' <value>');
  return value;
}
function within(parent: string, child: string) { const relative = path.relative(parent, child); return !relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); }
export function localDirectory(value: string) {
  const target = path.resolve(value); let existing = target;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const real = path.resolve(fs.realpathSync(existing), path.relative(existing, target));
  if (within(fs.realpathSync(repo), real) || within(path.resolve(repo), target)) throw Error('Review output must be outside the repository');
  fs.mkdirSync(target, {recursive: true}); return target;
}
export function writeNew(file: string, value: unknown) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); }
export function manifest(base: string, paths: string[]) {
  const result: Record<string, string> = {};
  function visit(relative: string) {
    const full = path.join(base, relative), stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Error('Unexpected symlink in manifest: ' + full);
    if (stat.isDirectory()) for (const name of fs.readdirSync(full).sort()) visit(path.join(relative, name));
    else result[relative.replaceAll(path.sep, '/')] = hash(fs.readFileSync(full));
  }
  paths.forEach(visit); return result;
}
export const sourcePaths = ['src', 'pipeline', 'data/source', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'AGENTS.md'];
