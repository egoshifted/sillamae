import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash, localDirectory, manifest, option, repo, sourcePaths, writeNew} from './local.ts';

const out = localDirectory(option('out', true)!);
if (fs.readdirSync(out).length) throw Error('Use a new empty output directory; old evidence is immutable');
const before = manifest(repo, sourcePaths);
const commands = [
  ['typecheck', ['node_modules/typescript/bin/tsc', '-p', '.']],
  ['tests', ['--test', 'src/**/*.test.ts']],
  ['data', ['pipeline/build.ts']],
  ['production-build', ['node_modules/vite/bin/vite.js', 'build']],
] as const;
const checks = [];
for (const [name, args] of commands) {
  const result = spawnSync(process.execPath, [...args], {cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  fs.writeFileSync(path.join(out, name + '.log'), result.stdout + result.stderr + (result.error?.message ?? ''), {flag: 'wx'});
  checks.push({name, command: [process.execPath, ...args], exit: result.status, passed: result.status === 0});
  console.log(name + ': ' + (result.status === 0 ? 'passed' : 'FAILED'));
  if (result.status !== 0) break;
}
const sources = manifest(repo, sourcePaths), unchangedDuringChecks = JSON.stringify(before) === JSON.stringify(sources);
const passed = unchangedDuringChecks && checks.length === commands.length && checks.every(c => c.passed);
writeNew(path.join(out, 'report.json'), {created: new Date().toISOString(), node: process.version, checks, unchangedDuringChecks, logs: Object.fromEntries(checks.map(c => [c.name + '.log', hash(fs.readFileSync(path.join(out, c.name + '.log')))])), sources, data: manifest(repo, ['public/data']), automated: passed ? 'passed' : 'failed', visual: 'pending', architecturalApproval: 'not granted'});
process.exitCode = passed ? 2 : 1;
console.log('Report: ' + path.join(out, 'report.json') + (passed ? '\nExit 2: automated checks passed; visual review is pending.' : '\nExit 1: checks failed or sources changed during the run.'));
