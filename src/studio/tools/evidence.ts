import fs from 'node:fs';
import path from 'node:path';
import {hash, localDirectory, manifest, option, repo, sourcePaths, writeNew} from './local.ts';

const captures = path.resolve(option('captures', true)!), extra = path.resolve(option('extra', true)!), out = localDirectory(option('out', true)!);
if (fs.readdirSync(out).length) throw Error('Use an empty output directory');
const record = JSON.parse(fs.readFileSync(path.join(captures, 'captures.json'), 'utf8'));
if (JSON.stringify(record.data) !== JSON.stringify(manifest(repo, ['public/data'])) || JSON.stringify(record.sources) !== JSON.stringify(manifest(repo, sourcePaths))) throw Error('Sources changed since capture');
for (const [name, digest] of Object.entries(record.files)) {
  if (path.basename(name) !== name) throw Error('Invalid capture filename');
  const bytes = fs.readFileSync(path.join(captures, name)); if (hash(bytes) !== digest) throw Error('Capture changed: ' + name);
  fs.writeFileSync(path.join(out, name), bytes, {flag: 'wx'});
}
const files = {...record.files};
const extras = fs.readdirSync(extra).filter(name => /\.(png|webm|mp4)$/i.test(name));
if (!extras.length) throw Error('No manual PNG or motion recordings found');
for (const name of extras) {
  const bytes = fs.readFileSync(path.join(extra, name)), target = 'manual-' + name;
  fs.writeFileSync(path.join(out, target), bytes, {flag: 'wx'}); files[target] = hash(bytes);
}
writeNew(path.join(out, 'captures.json'), {...record, created: new Date().toISOString(), files, manualEvidence: {files: extras, freshness: 'Reviewer must confirm capture conditions and freshness; filesystem dates are not proof.'}, parent: hash(fs.readFileSync(path.join(captures, 'captures.json')))});
console.log('Additional local evidence bound to a new record. Inspect and record its scope and freshness.');
