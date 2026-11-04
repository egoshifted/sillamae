import type {PartFact, PosePatch, StudioHost, ViewState} from './host.ts';

export const READS = ['identity', 'selection', 'tree', 'pose', 'bounds', 'appearance', 'camera', 'view', 'cost', 'history', 'edits', 'toolbox'] as const;
export const WRITES = ['select', 'visibility', 'lock', 'group', 'transform', 'place', 'camera', 'view', 'history', 'save'] as const;
export const FIELDS = ['id', 'name', 'parent', 'kind', 'pose', 'bounds', 'material', 'visible', 'locked'] as const;

export type ReadChannel = typeof READS[number];
export type WriteCap = typeof WRITES[number];
export type PartField = typeof FIELDS[number];

const FIELD_CHANNEL: Partial<Record<PartField, ReadChannel>> = {
  pose: 'pose', bounds: 'bounds', material: 'appearance', visible: 'appearance', locked: 'appearance',
};
const BASE_FIELDS: PartField[] = ['id', 'name', 'parent', 'kind'];
const LIMIT = 40;

export interface Profile {
  read: Record<ReadChannel, boolean>;
  write: Record<WriteCap, boolean>;
  fields: PartField[];
  limit: number;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface CallResult {content: {type: 'text'; text: string}[]; isError?: boolean}

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({type: 'object', properties, required, additionalProperties: false});
const idsSchema = {type: 'array', items: {type: 'string'}};

function blankRead(): Record<ReadChannel, boolean> {
  return {identity: true, selection: true, tree: false, pose: false, bounds: false, appearance: false, camera: false, view: false, cost: false, history: false, edits: false, toolbox: false};
}
function blankWrite(): Record<WriteCap, boolean> {
  return {select: true, visibility: false, lock: false, group: false, transform: false, place: false, camera: false, view: false, history: false, save: false};
}

export function defaultProfile(): Profile {
  return {read: blankRead(), write: blankWrite(), fields: [...BASE_FIELDS], limit: LIMIT};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function flags<T extends string>(keys: readonly T[], value: unknown, base: Record<T, boolean>) {
  const next = {...base};
  if (!isRecord(value)) return next;
  for (const key of keys) if (typeof value[key] === 'boolean') next[key] = value[key];
  return next;
}

function project(part: PartFact, fields: PartField[], bounds: BoundsOf) {
  const row: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === 'bounds') { const box = bounds(part.id); if (box) row.bounds = box; continue; }
    row[field] = part[field];
  }
  return row;
}

type BoundsOf = (id: string) => PartFact['bounds'];

function allowedFields(profile: Profile, asked: unknown) {
  const wanted = Array.isArray(asked) ? asked.filter((field): field is PartField => FIELDS.includes(field as PartField)) : profile.fields;
  const fields: PartField[] = [];
  const omitted: string[] = [];
  for (const field of wanted.length ? wanted : BASE_FIELDS) {
    const channel = FIELD_CHANNEL[field];
    if (channel && !profile.read[channel]) { omitted.push(field); continue; }
    if (!fields.includes(field)) fields.push(field);
  }
  if (!fields.includes('id')) fields.unshift('id');
  return {fields, omitted};
}

function narrowed(query: Record<string, unknown>) {
  return typeof query.name === 'string' || typeof query.material === 'string' || typeof query.locked === 'boolean' || typeof query.selected === 'boolean' || (Array.isArray(query.ids) && query.ids.length > 0);
}

function page<T>(rows: T[], limit: number, cursor: unknown) {
  const start = typeof cursor === 'string' && /^\d+$/.test(cursor) ? Number(cursor) : 0;
  const slice = rows.slice(start, start + limit);
  const next = start + slice.length < rows.length ? String(start + slice.length) : undefined;
  return {slice, next};
}

const TOOLS: {name: string; write: WriteCap | null; description: string; inputSchema: Record<string, unknown>}[] = [
  {name: 'configure', write: null, description: 'Turn information channels and actions on or off. A channel that is off is left out of later results, including find. Call tools/list again when the write set changes.', inputSchema: schema({read: {type: 'object'}, write: {type: 'object'}, fields: {type: 'array', items: {type: 'string'}}, limit: {type: 'number'}})},
  {name: 'look', write: null, description: 'Read the studio slices that are currently enabled. Nothing else is included.', inputSchema: schema({})},
  {name: 'find', write: null, description: 'Find parts by name, material, lock, selection or id. Without the tree channel a query must narrow the search. Disabled fields are omitted.', inputSchema: schema({name: {type: 'string'}, material: {type: 'string'}, locked: {type: 'boolean'}, selected: {type: 'boolean'}, ids: idsSchema, fields: {type: 'array', items: {type: 'string'}}, limit: {type: 'number'}, cursor: {type: 'string'}})},
  {name: 'select', write: 'select', description: 'Select parts by id. mode is set, add or toggle.', inputSchema: schema({ids: idsSchema, mode: {type: 'string', enum: ['set', 'add', 'toggle']}}, ['ids'])},
  {name: 'hide', write: 'visibility', description: 'Hide these parts. They stay in the list.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'show', write: 'visibility', description: 'Show these parts again.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'lock', write: 'lock', description: 'Freeze these parts so the view cannot move, select or delete them.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'unlock', write: 'lock', description: 'Unfreeze these parts, or the group that holds their lock.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'group', write: 'group', description: 'Put the unlocked parts into a new group.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'ungroup', write: 'group', description: 'Take the parts out of these groups.', inputSchema: schema({ids: idsSchema}, ['ids'])},
  {name: 'pose', write: 'transform', description: 'Move, turn or resize parts. Locked parts are skipped. The edit is one history step.', inputSchema: schema({ids: idsSchema, position: {type: 'array'}, quaternion: {type: 'array'}, scale: {type: 'array'}}, ['ids'])},
  {name: 'place', write: 'place', description: 'Place a toolbox item at a position in the study.', inputSchema: schema({item: {type: 'string'}, position: {type: 'array'}}, ['item', 'position'])},
  {name: 'set_camera', write: 'camera', description: 'Move the camera and its look-at target.', inputSchema: schema({position: {type: 'array'}, target: {type: 'array'}}, ['position', 'target'])},
  {name: 'set_view', write: 'view', description: 'Change light, shadows, textures, plain materials, ground, grid, plan or the gizmo mode.', inputSchema: schema({light: {type: 'string'}, shadows: {type: 'boolean'}, textures: {type: 'boolean'}, plain: {type: 'boolean'}, ground: {type: 'boolean'}, grid: {type: 'boolean'}, plan: {type: 'boolean'}, gizmo: {type: 'string'}})},
  {name: 'undo', write: 'history', description: 'Revert the last edit.', inputSchema: schema({})},
  {name: 'redo', write: 'history', description: 'Reapply the edit that was just undone.', inputSchema: schema({})},
  {name: 'save', write: 'save', description: 'Write the local building version. This does not rebuild the city atlas.', inputSchema: schema({})},
];

function text(value: unknown, isError = false): CallResult {
  return {content: [{type: 'text', text: JSON.stringify(value)}], ...(isError ? {isError: true} : {})};
}

function idsOf(args: Record<string, unknown>) {
  return Array.isArray(args.ids) ? args.ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

function finiteTriple(value: unknown, size: number) {
  return Array.isArray(value) && value.length === size && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

export function createSession(host: StudioHost) {
  let profile = defaultProfile();
  let live = true;
  const dead = () => ({error: 'disconnected'});
  const tools = () => TOOLS.filter(tool => tool.write == null || profile.write[tool.write]).map(({name, description, inputSchema}) => ({name, description, inputSchema}));
  const known = (ids: string[]) => {
    const have = new Set(host.parts().map(part => part.id));
    const missing = ids.filter(id => !have.has(id));
    return missing.length ? {error: 'missing', ids: missing} : null;
  };
  const matches = (query: Record<string, unknown>) => {
    const name = typeof query.name === 'string' ? query.name.toLowerCase() : '';
    const material = typeof query.material === 'string' ? query.material.toLowerCase() : '';
    const want = Array.isArray(query.ids) ? new Set(query.ids.filter((id): id is string => typeof id === 'string')) : null;
    return host.parts().filter(part => {
      if (want && !want.has(part.id)) return false;
      if (name && !part.name.toLowerCase().includes(name)) return false;
      if (material && !(part.material ?? '').toLowerCase().includes(material)) return false;
      if (typeof query.locked === 'boolean' && part.locked !== query.locked) return false;
      if (typeof query.selected === 'boolean' && part.selected !== query.selected) return false;
      return true;
    });
  };
  const boxes = (ids: string[], fields: PartField[]) => {
    if (!fields.includes('bounds')) return () => undefined;
    const found = host.bounds(ids);
    return (id: string) => found[id];
  };
  const configure = (args: Record<string, unknown>) => {
    const read = flags(READS, args.read, profile.read);
    const write = flags(WRITES, args.write, profile.write);
    const mask = allowedFields({...profile, read, write}, args.fields ?? profile.fields);
    profile = {read, write, fields: mask.fields, limit: typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(200, Math.floor(args.limit))) : profile.limit};
    return {profile, omitted: mask.omitted, refreshTools: true};
  };
  const look = () => {
    const body: Record<string, unknown> = {};
    if (profile.read.identity) body.identity = host.identity();
    if (profile.read.selection) {
      const items = host.parts().filter(part => part.selected).map(part => ({id: part.id, name: part.name}));
      body.selection = {count: items.length, items};
    }
    if (profile.read.tree) {
      const {fields, omitted} = allowedFields(profile, profile.fields);
      const rows = host.parts();
      const {slice, next} = page(rows, profile.limit, 0);
      const bound = boxes(slice.map(part => part.id), fields);
      body.tree = {parts: slice.map(part => project(part, fields, bound)), ...(next ? {cursor: next} : {}), ...(omitted.length ? {omitted} : {})};
    }
    if (profile.read.camera) body.camera = host.camera();
    if (profile.read.view) body.view = host.view();
    if (profile.read.cost) body.cost = host.cost();
    if (profile.read.history) {
      const history = host.history();
      body.history = {cursor: history.cursor, total: history.steps.length, steps: history.steps.map(step => ({name: step.name}))};
    }
    if (profile.read.edits) body.edits = host.edits();
    if (profile.read.toolbox) body.toolbox = host.toolbox();
    return body;
  };
  const find = (args: Record<string, unknown>) => {
    if (!profile.read.tree && !narrowed(args)) return {parts: [], omitted: ['tree']};
    const {fields, omitted} = allowedFields(profile, args.fields ?? profile.fields);
    const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(profile.limit, Math.floor(args.limit))) : profile.limit;
    const rows = matches(args);
    const {slice, next} = page(rows, limit, args.cursor);
    const bound = boxes(slice.map(part => part.id), fields);
    return {parts: slice.map(part => project(part, fields, bound)), ...(next ? {cursor: next} : {}), ...(omitted.length ? {omitted} : {})};
  };
  const posePatch = (args: Record<string, unknown>): PosePatch | {error: string} => {
    const next: PosePatch = {};
    if (args.position !== undefined) { if (!finiteTriple(args.position, 3)) return {error: 'bad pose'}; next.position = args.position as number[]; }
    if (args.quaternion !== undefined) { if (!finiteTriple(args.quaternion, 4)) return {error: 'bad pose'}; next.quaternion = args.quaternion as number[]; }
    if (args.scale !== undefined) { if (!finiteTriple(args.scale, 3)) return {error: 'bad pose'}; next.scale = args.scale as number[]; }
    if (!next.position && !next.quaternion && !next.scale) return {error: 'bad pose'};
    return next;
  };
  const viewPatch = (args: Record<string, unknown>): Partial<ViewState> | {error: string} => {
    const next: Partial<ViewState> = {};
    if (args.light !== undefined) { if (args.light !== 'morning' && args.light !== 'midday' && args.light !== 'late') return {error: 'bad view'}; next.light = args.light; }
    for (const key of ['shadows', 'textures', 'plain', 'ground', 'grid', 'plan'] as const) if (typeof args[key] === 'boolean') next[key] = args[key];
    if (args.gizmo !== undefined) { if (args.gizmo !== 'translate' && args.gizmo !== 'rotate' && args.gizmo !== 'scale') return {error: 'bad view'}; next.gizmo = args.gizmo; }
    return next;
  };
  const act = async (name: string, args: Record<string, unknown>) => {
    const tool = TOOLS.find(item => item.name === name);
    if (!tool) return {error: 'unknown'};
    if (tool.write && !profile.write[tool.write]) return {error: 'disabled', capability: tool.write};
    if (name === 'configure') return configure(args);
    if (name === 'look') return look();
    if (name === 'find') return find(args);
    if (name === 'undo') { host.undo(); return {ok: true}; }
    if (name === 'redo') { host.redo(); return {ok: true}; }
    if (name === 'save') return host.save();
    if (name === 'set_camera') {
      if (!finiteTriple(args.position, 3) || !finiteTriple(args.target, 3)) return {error: 'bad camera'};
      host.setCamera(args.position as number[], args.target as number[]);
      return {ok: true};
    }
    if (name === 'set_view') {
      const patch = viewPatch(args);
      if ('error' in patch) return patch;
      host.setView(patch);
      return {ok: true};
    }
    if (name === 'place') {
      if (typeof args.item !== 'string' || !finiteTriple(args.position, 3)) return {error: 'bad place'};
      if (!host.toolbox().some(item => item.id === args.item)) return {error: 'unknown item'};
      host.place(args.item, args.position as number[]);
      return {ok: true};
    }
    const ids = idsOf(args);
    if (!ids.length) return {error: 'missing', ids: []};
    const missing = known(ids);
    if (missing) return missing;
    if (name === 'select') {
      const mode = args.mode === 'add' || args.mode === 'toggle' ? args.mode : 'set';
      host.select(ids, mode);
      return {ok: true};
    }
    if (name === 'hide') { host.hide(ids); return {ok: true}; }
    if (name === 'show') { host.show(ids); return {ok: true}; }
    if (name === 'lock') { host.lock(ids, true); return {ok: true}; }
    if (name === 'unlock') { host.lock(ids, false); return {ok: true}; }
    if (name === 'group') { host.group(ids); return {ok: true}; }
    if (name === 'ungroup') { host.ungroup(ids); return {ok: true}; }
    if (name === 'pose') {
      const next = posePatch(args);
      if ('error' in next) return next;
      host.pose(ids, next);
      return {ok: true};
    }
    return {error: 'unknown'};
  };
  return {
    profile: () => profile,
    tools,
    kill() { live = false; },
    async call(method: string, params: unknown): Promise<CallResult | {tools: ToolDef[]} | {error: string}> {
      if (!live) return method === 'tools/call' ? text(dead(), true) : dead();
      if (method === 'tools/list') return {tools: tools()};
      if (method !== 'tools/call' || !isRecord(params) || typeof params.name !== 'string') return {error: 'unknown'};
      const args = isRecord(params.arguments) ? params.arguments : {};
      const result = await act(params.name, args);
      const failed = isRecord(result) && 'error' in result && typeof result.error === 'string';
      return text(result, failed);
    },
  };
}
