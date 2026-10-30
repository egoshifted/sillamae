import fs from 'node:fs';
import path from 'node:path';
import {hash, localDirectory, manifest, option, repo, sourcePaths, writeNew} from './local.ts';

const checks = path.resolve(option('checks', true)!), captures = path.resolve(option('captures', true)!), reviewFile = path.resolve(option('review', true)!);
const report = JSON.parse(fs.readFileSync(path.join(checks, 'report.json'), 'utf8'));
const capture = JSON.parse(fs.readFileSync(path.join(captures, 'captures.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8')) as {reviewer: string; inspectedAt: string; knownFailures: {status: string; finding: string}[]; intentionalDifferences?: {image: string; reason: string}[]; gates: Record<string, {status: string; finding: string; images: string[]}>};
const sources = manifest(repo, sourcePaths);
if (report.automated !== 'passed' || !report.unchangedDuringChecks || !capture.unchangedDuringCapture || capture.errors.length) throw Error('Automated checks or capture failed');
if (JSON.stringify(sources) !== JSON.stringify(report.sources) || JSON.stringify(sources) !== JSON.stringify(capture.sources)) throw Error('Source changed since checks/capture; run again');
if (JSON.stringify(capture.data) !== JSON.stringify(report.data) || JSON.stringify(manifest(repo, ['public/data'])) !== JSON.stringify(report.data)) throw Error('Generated data changed since checks');
if (!review.reviewer?.trim() || !Number.isFinite(Date.parse(review.inspectedAt)) || Date.parse(review.inspectedAt) < Date.parse(capture.created)) throw Error('A named, dated inspection after capture is required');
if (!Array.isArray(review.knownFailures) || review.knownFailures.some(f => f.status !== 'resolved' || !f.finding?.trim())) throw Error('Known failures are open or not recorded');
for (const [name, digest] of Object.entries(report.logs)) if (hash(fs.readFileSync(path.join(checks, name))) !== digest) throw Error('Check log changed: ' + name);
for (const name of capture.differences) if (!review.intentionalDifferences?.some(d => d.image === name && d.reason.trim())) throw Error('Unexplained comparison difference: ' + name);
for (const [name, digest] of Object.entries(capture.files)) if (hash(fs.readFileSync(path.join(captures, name))) !== digest) throw Error('Capture changed: ' + name);
for (const name of ['reference', 'close', 'distance', 'lighting', 'motion', 'global', 'runtime']) {
  const gate = review.gates[name];
  if (!gate || !['passed', 'not-applicable'].includes(gate.status) || !gate.finding?.trim()) throw Error('Unresolved review gate: ' + name);
  if (gate.status === 'passed' && !gate.images?.length) throw Error('Missing evidence for ' + name);
  for (const image of gate.images ?? []) if (!(image in capture.files)) throw Error('Image is not bound to this capture: ' + image);
}
const out = localDirectory(option('out', true)!);
writeNew(path.join(out, 'finalized.json'), {created: new Date().toISOString(), sources, review, checks: hash(fs.readFileSync(path.join(checks, 'report.json'))), captures: hash(fs.readFileSync(path.join(captures, 'captures.json'))), evidenceRecord: 'validated', architecturalApproval: 'not granted'});
console.log('Evidence record validated. This does not inspect images or grant architectural approval.');
