import test from 'node:test';
import assert from 'node:assert/strict';
import {createSiteSession, type SiteHost} from './site-session.ts';

function fakeHost() {
  const calls: [string, unknown][] = [];
  const log = (name: string) => (value?: unknown) => { calls.push([name, value]); return {ok: true as const}; };
  const host: SiteHost = {
    area: () => ({centre: [200, 600], size: 200, reach: 15, dirty: false, undo: 0, redo: 0}),
    items: () => ({objects: [], trees: {added: [], removed: []}, roads: [], lines: [], areas: [], cuts: 0, hidden: []}),
    selection: () => [],
    library: () => [{id: 'bench-slatted-01', name: 'Bench', category: 'street furniture', attach: 'ground', size: [1.8, .8, .6], variants: ['default', 'green']}, {id: 'lamp-wall-01', name: 'Wall lantern', category: 'lighting', attach: 'wall', size: [.3, .4, .3], variants: ['default']}],
    buildings: () => [],
    streets: () => [],
    ground: points => points.map(([x, z]) => ({x, z, height: 12, indoors: null})),
    camera: () => ({position: [0, 0, 0], target: [0, 0, 0]}),
    screenshot: async () => 'data:image/jpeg;base64,AAAA',
    select: log('select'), frame: log('frame'), place: log('place'), addTree: log('addTree'), removeTree: log('removeTree'),
    change: (id, patch) => { calls.push(['change', {id, patch}]); return {ok: true}; },
    remove: log('remove'), draw: log('draw'), hide: (ids, on) => { calls.push(['hide', {ids, on}]); return {ok: true}; }, shape: log('shape'),
    setCamera: log('setCamera'), undo: log('undo'), redo: log('redo'), save: async () => ({ok: true}),
    open: (centre, size, discard) => { calls.push(['open', {centre, size, discard}]); return {ok: true}; },
  };
  return {host, calls};
}
const call = async (session: ReturnType<typeof createSiteSession>, name: string, args: Record<string, unknown> = {}) => {
  const result = await session.call('tools/call', {name, arguments: args}) as {content: {type: string; text?: string; data?: string}[]; isError?: boolean};
  return {...result, value: result.content[0].text ? JSON.parse(result.content[0].text) : result.content[0]};
};

test('a new connection can read the area but change nothing until a write is enabled', async () => {
  const {host, calls} = fakeHost(), session = createSiteSession(host);
  const names = (await session.call('tools/list', {}) as {tools: {name: string}[]}).tools.map(t => t.name);
  assert.deepEqual(names, ['configure', 'look', 'ground', 'select']);
  const look = await call(session, 'look');
  assert.deepEqual(Object.keys(look.value), ['area', 'items', 'library', 'buildings']);
  const refused = await call(session, 'place', {asset: 'bench-slatted-01', x: 200, z: 600});
  assert.equal(refused.isError, true);
  assert.deepEqual(refused.value.enable, {write: {place: true}});
  assert.equal(calls.length, 0);
  await call(session, 'configure', {write: {place: true}});
  assert.ok((await call(session, 'place', {asset: 'bench-slatted-01', x: 200, z: 600})).value.ok);
  assert.equal(calls[0][0], 'place');
});

test('requests are checked against the area, the library and each kind before the editor sees them', async () => {
  const {host, calls} = fakeHost(), session = createSiteSession(host);
  await call(session, 'configure', {write: {place: true, draw: true, edit: true, terrain: true, open: true}});
  const errors = [
    await call(session, 'place', {asset: 'bench-slatted-01', x: 400, z: 600}),
    await call(session, 'place', {asset: 'nope', x: 200, z: 600}),
    await call(session, 'place', {asset: 'bench-slatted-01', x: 200, z: 600, variant: 'red'}),
    await call(session, 'place', {asset: 'lamp-wall-01', x: 200, z: 600}),
    await call(session, 'draw', {kind: 'road', points: [[200, 600]], type: 'residential'}),
    await call(session, 'draw', {kind: 'line', points: [[200, 600], [210, 600]]}),
    await call(session, 'draw', {kind: 'area', points: [[200, 600], [210, 600], [330, 600]], finish: 'grass'}),
    await call(session, 'change', {id: 'p:1', points: [[200, 600], [201, 600]]}),
    await call(session, 'change', {id: 'p:1', x: 200}),
    await call(session, 'shape_ground', {mode: 'raise', points: [[200, 600]], radius: 6, strength: 9}),
    await call(session, 'shape_ground', {mode: 'smooth', points: [[200, 600]], radius: 6, strength: .5, target: 12}),
    await call(session, 'open_area', {x: 0, z: 0, size: 150}),
  ];
  for (const e of errors) assert.equal(e.isError, true, JSON.stringify(e.value));
  assert.equal(calls.length, 0);
  // Drawn items may reach past the edge; objects may not.
  assert.ok((await call(session, 'draw', {kind: 'road', points: [[290, 600], [310, 600]], type: 'residential', footways: true})).value.ok);
  assert.deepEqual(calls[0], ['draw', {kind: 'road', points: [[290, 600], [310, 600]], type: 'residential', footways: true}]);
  assert.ok((await call(session, 'change', {id: 'road:r1', x: 305, z: 600, type: 'kerbed-path'})).value.ok);
  assert.ok((await call(session, 'shape_ground', {mode: 'flatten', points: [[200, 600], [205, 600]], radius: 6, strength: .5, target: 12.5})).value.ok);
  assert.deepEqual(calls.at(-1), ['shape', {mode: 'flatten', points: [[200, 600], [205, 600]], radius: 6, strength: .5, target: 12.5}]);
  assert.ok((await call(session, 'open_area', {x: 412.4, z: 600.6})).value.ok);
  assert.deepEqual(calls.at(-1), ['open', {centre: [412, 601], size: 200, discard: false}]);
});

test('a screenshot comes back as an image, and a dropped connection answers nothing', async () => {
  const {host} = fakeHost(), session = createSiteSession(host);
  assert.equal((await call(session, 'screenshot')).isError, true);
  await call(session, 'configure', {read: {view: true}});
  const shot = await call(session, 'screenshot', {width: 800});
  assert.deepEqual(shot.content[0], {type: 'image', data: 'AAAA', mimeType: 'image/jpeg'});
  session.kill();
  assert.equal((await call(session, 'look')).value.error, 'disconnected');
});
