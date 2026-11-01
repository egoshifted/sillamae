import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import type {PreviewRequest} from '../site/asset.ts';
import {localDirectory, option, writeNew} from './local.ts';

// Pictures of one asset for its author to look at before handing it over:
// every variant from four sides, the far detail, and beside a library asset for
// scale. Run against the local dev server; the pictures go outside the checkout.
declare global { interface Window {assetPreview: {ready: boolean; show(request: PreviewRequest): unknown}} }
const id = option('id', true)!, out = localDirectory(option('out', true)!), base = option('url') ?? 'http://127.0.0.1:5173', compare = option('compare') ?? 'bench-slatted-01';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw Error('Capture only a local development server');
if (fs.readdirSync(out).length) throw Error('Use an empty output directory');

const executablePath = process.env.STUDIO_BROWSER;
const browser = await chromium.launch({...(executablePath ? {executablePath} : {}), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const errors: string[] = [], pictures: Record<string, unknown> = {};
try {
  const page = await browser.newPage({viewport: {width: 900, height: 650}, deviceScaleFactor: 1});
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/src/studio/site/asset.html`);
  await page.waitForFunction(() => window.assetPreview?.ready, undefined, {timeout: 60000});
  const take = async (name: string, request: PreviewRequest) => {
    pictures[name] = await page.evaluate(r => window.assetPreview.show(r), request);
    await page.waitForTimeout(100);
    await page.locator('canvas').screenshot({path: path.join(out, name + '.png')});
  };
  const first = await page.evaluate(i => window.assetPreview.show({id: i}), id) as {variants: string[]};
  for (const variant of first.variants) {
    for (const [side, view] of [['front', -36], ['side', 90], ['back', 180]] as const) await take(`${variant}-${side}`, {id, variant, view});
    await take(`${variant}-above`, {id, variant, view: 0, up: 75});
    await take(`${variant}-far`, {id, variant, detail: 'far'});
  }
  if (compare !== id) await take('with-' + compare, {id, compare, view: -20});
} catch (e) { errors.push(String(e)); }
finally { await browser.close(); }
writeNew(path.join(out, 'preview.json'), {asset: id, created: new Date().toISOString(), pictures, errors, visualInspection: 'pending'});
console.log(JSON.stringify({out, pictures: Object.keys(pictures).length, errors}));
process.exitCode = errors.length ? 1 : 0;
