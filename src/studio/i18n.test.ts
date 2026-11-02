import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {translate} from './i18n.ts';

test('Russian status messages keep counts, identifiers and file paths intact', () => {
  assert.equal(translate('2 objects · trees +1 −0 · 3 roads · unsaved changes · 12,345 triangles · 60 draws', 'ru'), 'Объектов: 2 · Деревья +1 −0 · Дорог: 3 · несохранённые изменения · Треугольников: 12,345 · Вызовов отрисовки: 60');
  assert.equal(translate('Square 50 m at 210, 573 · 210_573_50.json', 'ru'), 'Участок 50 м, центр: 210, 573 · 210_573_50.json');
  assert.equal(translate('Saved to data/source/placements/210_573_50.json', 'ru'), 'Сохранено в data/source/placements/210_573_50.json');
  assert.equal(translate('rm123 · 20.8 m long · 2 m wide', 'ru'), 'rm123 · Длина: 20.8 м · Ширина: 2 м');
  assert.equal(translate('Preview Concrete street lamp', 'ru'), 'Просмотр: Уличный фонарь на бетонной опоре');
});

test('English and user identifiers are preserved, including whitespace', () => {
  const text = '  Kerbed asphalt footpath  ';
  assert.equal(translate(text, 'en'), text);
  assert.equal(translate(text, 'ru'), '  Асфальтовая дорожка с бордюром  ');
  for (const id of ['lamp-post-concrete-01', 'Kesk 1 · 213321385', 'Ctrl+S']) assert.equal(translate(id, 'ru'), id);
});

test('every site tool label and instruction has a Russian translation', () => {
  const source = readFileSync(new URL('./site/editor.ts', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const TOOLS:'), source.indexOf('function showTools()'));
  const rows = [...block.matchAll(/\['[^']+', '([^']+)', '([^']+)'\]/g)];
  assert.equal(rows.length, 13);
  for (const [, label, hint] of rows) for (const text of [label, hint]) assert.notEqual(translate(text, 'ru'), text, text);
});

test('static studio and editor text is covered', () => {
  for (const file of ['./index.html', './site/index.html']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const [, raw] of source.matchAll(/>([^<>]+)</g)) {
      const text = raw.trim();
      if (/[A-Za-z]/.test(text)) assert.notEqual(translate(text, 'ru'), text, `${file}: ${text}`);
    }
  }
});
