import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page} from 'playwright';
import {hash, localDirectory, manifest, option, repo, sourcePaths, writeNew} from './local.ts';
import {sillamae} from '../../city/sillamae/index.ts';
import type {WorldData} from '../../engine/data.ts';
import type {studio} from '../viewer.ts';
import type {town} from '../../app/town.ts';

declare global { interface Window {studio: typeof studio; __studioTown: typeof town} }
const out = localDirectory(option('out', true)!), base = option('url') ?? 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw Error('Capture only a local development server');
if (fs.readdirSync(out).length) throw Error('Use an empty output directory');
const sourceRoot = path.resolve(option('source') ?? repo), world: WorldData = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'public/data/world.json'), 'utf8'));
const selected = option('id'), atlasOnly = process.argv.includes('--atlas-only');
if (!selected && !atlasOnly) throw Error('Choose the active building with --id <stable ID>; --atlas-only checks registered production models');
const targets = world.buildings.filter(b => selected ? b.id === selected : sillamae.overrides.some(o => o.id === b.id));
if (!targets.length) throw Error('Unknown building ID');
const dataBefore = manifest(sourceRoot, ['public/data']);
const sourceBefore = manifest(sourceRoot, sourcePaths), errors: string[] = [], images: Record<string, string> = {};
const executablePath = process.env.STUDIO_BROWSER;
const browser = await chromium.launch({...(executablePath ? {executablePath} : {}), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
async function capture(page: Page, name: string) {
  await page.waitForTimeout(250);
  const bytes = await page.locator('canvas').first().screenshot({path: path.join(out, name + '.png')});
  images[name] = await page.evaluate(async png => {
    const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const digest = await crypto.subtle.digest('SHA-256', context.getImageData(0, 0, canvas.width, canvas.height).data);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }, bytes.toString('base64'));
}
const browserVersion = browser.version();
let failed = false;
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 800}, deviceScaleFactor: 1});
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  // Bind the live instance; importing town again after HMR can create an empty store.
  await page.route('**/src/app/town.ts*', async route => { const response = await route.fetch(); await route.fulfill({response, body: await response.text() + '\nwindow.__studioTown=town;'}); });
  await page.goto(base);
  await page.waitForFunction(() => window.__studioTown?.get().engine && document.documentElement.dataset.tiles === 'done', undefined, {timeout: 180000});
  for (const {id} of targets) for (const rear of [false, true]) {
    await page.evaluate(({id, rear}) => {
      const engine = window.__studioTown.get().engine!;
      engine.focusBuilding(engine.buildings.find(b => b.id === id)!); engine.select(null);
      engine.clock.set(.58); engine.setShadows(true); engine.showTrees(true); engine.setTextures(true);
      if (rear) engine.camera.view = {...engine.camera.view, heading: engine.camera.view.heading + 180}; engine.requestRedraw();
    }, {id, rear});
    await page.waitForTimeout(1000); await capture(page, 'atlas-' + id + (rear ? '-rear' : '-front'));
  }
  if (!atlasOnly) {
    await page.goto(base + '/src/studio/?capture&building=' + selected);
    await page.waitForFunction(() => window.studio?.ready || window.studio?.error, undefined, {timeout: 180000});
    const studyError = await page.evaluate(() => window.studio.error); if (studyError) throw Error(studyError);
    for (const {id} of targets) {
      await page.evaluate(({id, stage}) => window.studio.select(id, stage), {id, stage: option('stage')});
      for (let angle = 0; angle < 360; angle += 45) { await page.evaluate(angle => window.studio.view(angle), angle); await capture(page, id + '-' + angle); }
      for (const light of ['morning', 'midday', 'late']) for (const shadows of [true, false]) {
        await page.evaluate(({light, shadows}) => { window.studio.view(); window.studio.options({light, shadows}); }, {light, shadows});
        await capture(page, id + '-' + light + '-' + shadows);
      }
      await page.evaluate(() => window.studio.options({light: 'midday', shadows: true, textures: false, plain: true})); await capture(page, id + '-plain-materials');
      await page.evaluate(() => window.studio.options({textures: true, plain: false})); await capture(page, id + '-restored');
      for (const distance of [2, 4]) { await page.evaluate(distance => window.studio.view(0, distance), distance); await capture(page, id + '-distance-' + distance); }
      for (const stage of await page.evaluate(() => window.studio.stages)) {
        await page.evaluate(({id, stage}) => window.studio.select(id, stage), {id, stage: stage.id}); await capture(page, id + '-stage-' + stage.id);
      }
    }
  }
} catch (e) { errors.push(String(e)); failed = true; }
finally { await browser.close(); }
const sources = manifest(sourceRoot, sourcePaths), data = manifest(sourceRoot, ['public/data']);
const unchangedDuringCapture = JSON.stringify(sourceBefore) === JSON.stringify(sources) && JSON.stringify(dataBefore) === JSON.stringify(data);
const comparison = option('compare'); let differences: string[] = [];
if (comparison) {
  const previous = JSON.parse(fs.readFileSync(path.join(comparison, 'captures.json'), 'utf8')) as {images: Record<string, string>};
  differences = [...new Set([...Object.keys(previous.images), ...Object.keys(images)])].filter(name => previous.images[name] !== images[name]);
}
const files = Object.fromEntries(Object.keys(images).map(name => [name + '.png', hash(fs.readFileSync(path.join(out, name + '.png')))]));
writeNew(path.join(out, 'captures.json'), {created: new Date().toISOString(), sources, data, unchangedDuringCapture, images, files, errors, differences, comparison: comparison ?? null, viewport: [1100, 800], deviceScaleFactor: 1, browser: executablePath ?? 'Playwright Chromium', browserVersion, platform: process.platform, pixelFormat: 'SHA-256 of decoded RGBA', visualInspection: 'pending'});
failed ||= errors.length > 0 || !unchangedDuringCapture || differences.length > 0;
console.log(JSON.stringify({out, images: Object.keys(images).length, errors, differences})); process.exitCode = failed ? 1 : 0;
