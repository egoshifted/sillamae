import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, type ToolDef} from './session.ts';
import type {PartFact, StudioHost} from './host.ts';

function part(id: string, name: string, material: string, locked = false): PartFact {
  const index = Number(id.slice(1));
  return {
    id, name, parent: null, kind: 'part', material, visible: true, locked, selected: id === 'p0',
    pose: {position: [index, 2, 3], quaternion: [0, 0, 0, 1], scale: [1, 1, 1]},
    bounds: {size: [4, 5, 6], center: [index, 0, 0]},
  };
}

function host(count = 50): StudioHost & {posed: number} {
  const parts = Array.from({length: count}, (_, index) => part('p' + index, index === 0 ? 'Masonry' : 'Frame ' + index, index === 0 ? 'Masonry' : 'Frames', index === 2));
  const api = {
    posed: 0,
    identity: () => ({id: '213321385', name: 'Kesk 1', stage: 'assembled', ready: true}),
    parts: () => parts,
    bounds: (ids: string[]) => Object.fromEntries(ids.map(id => [id, parts.find(item => item.id === id)!.bounds!])),
    camera: () => ({position: [1, 2, 3], target: [0, 0, 0]}),
    view: () => ({light: 'midday', shadows: true, textures: true, plain: false, ground: true, grid: false, plan: false, gizmo: 'translate'}),
    cost: () => ({triangles: 10, corners: 20, draws: 2}),
    history: () => ({cursor: -1, steps: []}),
    edits: () => [],
    toolbox: () => [{id: 'dish', name: 'Satellite dish'}],
    select() {}, hide() {}, show() {}, lock() {}, group() {}, ungroup() {},
    pose() { api.posed += 1; },
    place() {}, setCamera() {}, setView() {}, undo() {}, redo() {},
    async save() { return {saved: '213321385'}; },
  };
  return api;
}

async function payload(session: ReturnType<typeof createSession>, name: string, args: Record<string, unknown> = {}) {
  const result = await session.call('tools/call', {name, arguments: args});
  assert.ok(result && 'content' in result);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

test('a fresh look keeps pose and the part list out', async () => {
  const session = createSession(host());
  const look = await payload(session, 'look');
  assert.deepEqual(Object.keys(look).sort(), ['identity', 'selection']);
  assert.equal(JSON.stringify(look).includes('position'), false);
  assert.equal((look.selection as {count: number}).count, 1);
});

test('find without the tree channel does not return the whole building', async () => {
  const session = createSession(host());
  const found = await payload(session, 'find');
  assert.deepEqual(found.parts, []);
  assert.deepEqual(found.omitted, ['tree']);
});

test('pose stays omitted until the channel is on, then a narrow find can read it', async () => {
  const session = createSession(host());
  const blocked = await payload(session, 'configure', {read: {pose: true, tree: true}, fields: ['id', 'name', 'pose']});
  assert.equal((blocked.omitted as string[]).includes('pose'), false);
  const hit = await payload(session, 'find', {name: 'masonry'});
  assert.equal((hit.parts as {pose: {position: number[]}}[]).length, 1);
  assert.deepEqual((hit.parts as {pose: {position: number[]}}[])[0].pose.position, [0, 2, 3]);
  const closed = await payload(session, 'configure', {read: {pose: false}, fields: ['id', 'pose']});
  assert.deepEqual(closed.omitted, ['pose']);
  const again = await payload(session, 'find', {name: 'Masonry', fields: ['pose']});
  assert.equal(JSON.stringify(again).includes('position'), false);
  assert.deepEqual(again.omitted, ['pose']);
});

test('write tools appear only after the model enables them', async () => {
  const api = host();
  const session = createSession(api);
  const names = () => ((session.call('tools/list', {}) as Promise<{tools: ToolDef[]}>)).then(result => result.tools.map(tool => tool.name));
  assert.equal((await names()).includes('select'), true);
  assert.equal((await names()).includes('pose'), false);
  assert.equal((await names()).includes('save'), false);
  const denied = await payload(session, 'pose', {ids: ['p0'], position: [1, 0, 0]});
  assert.equal(denied.error, 'disabled');
  assert.equal(api.posed, 0);
  await payload(session, 'configure', {write: {transform: true}});
  assert.equal((await names()).includes('pose'), true);
  const moved = await payload(session, 'pose', {ids: ['p0'], position: [1, 0, 0]});
  assert.equal(moved.ok, true);
  assert.equal(api.posed, 1);
});
