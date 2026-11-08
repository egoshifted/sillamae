import type {LineKind, Placement, Point2, RoadType, SiteLine, SiteRoad, SiteSurface, SiteTree, SurfaceFinish} from '../../engine/types.ts';

// The site editor's tools for a model, over the area the editor tab has open. All
// positions are source x/z in metres, as saved; heights are absolute metres, as in
// a placement's p[2]. Items are named as the editor names them: p:<id> objects,
// a:<id> added trees, road:, line: and area:<id> drawn items. Each change is one
// undo step in the tab, and nothing reaches the store until save.
export const SITE_READS = ['area', 'items', 'library', 'buildings', 'streets', 'ground', 'camera', 'view'] as const;
export const SITE_WRITES = ['select', 'place', 'trees', 'edit', 'draw', 'hide', 'terrain', 'camera', 'history', 'save', 'open'] as const;
export type SiteRead = typeof SITE_READS[number];
export type SiteWrite = typeof SITE_WRITES[number];

export const ROAD_TYPES: RoadType[] = ['main', 'residential', 'service', 'sidewalk', 'kerbed-path', 'asphalt-path', 'gravel-path', 'worn-path', 'tiled-path'];
export const LINE_KINDS: LineKind[] = ['fence', 'hedge', 'wall', 'kerb'];
export const FINISHES: SurfaceFinish[] = ['asphalt', 'paving', 'gravel', 'grass', 'flowerbed', 'worn-grass', 'worn-paving'];
export const SHAPES = ['raise', 'lower', 'flatten', 'smooth', 'reset'] as const;
export type Shape = typeof SHAPES[number];

export interface SiteArea {
  centre: Point2;
  size: number;
  reach: number; // metres past the edge that drawn items and the terrain brush may go
  dirty: boolean;
  undo: number;
  redo: number;
}

export interface SiteItems {
  objects: Placement[];
  trees: {added: SiteTree[]; removed: Point2[]};
  roads: SiteRoad[];
  lines: SiteLine[];
  areas: SiteSurface[];
  cuts: number;
  hidden: string[];
}

export interface PlaceRequest {asset: string; x: number; z: number; heading?: number; variant?: string; wall?: {building: string; height: number}}
export interface DrawRequest {kind: 'road' | 'line' | 'area'; points: Point2[]; type?: RoadType; footways?: boolean; tiles?: number; lineKind?: LineKind; height?: number; finish?: SurfaceFinish}
export interface ItemPatch {x?: number; z?: number; heading?: number; variant?: string; points?: Point2[]; type?: RoadType; footways?: boolean; tiles?: number; lineKind?: LineKind; height?: number; finish?: SurfaceFinish}
export interface ShapeRequest {mode: Shape; points: Point2[]; radius: number; strength: number; target?: number}

type Done = {ok: true; ids?: string[]} | {error: string};

export interface SiteHost {
  area(): SiteArea | null;
  items(): SiteItems;
  selection(): string[];
  library(): {id: string; name: string; category: string; attach: string; size: number[]; variants: string[]}[];
  buildings(): {id: string; name: string; centre: Point2; footprint: Point2[]; height: number; hidden: boolean; refined: boolean}[];
  streets(): Point2[][];
  ground(points: Point2[]): {x: number; z: number; height: number | null; indoors: string | null}[];
  camera(): {position: number[]; target: number[]};
  screenshot(width: number): Promise<string>; // a data URL
  select(ids: string[]): Done;
  frame(ids: string[]): Done;
  place(request: PlaceRequest): Done;
  addTree(tree: {x: number; z: number; conifer: boolean; height: number; radius: number}): Done;
  removeTree(x: number, z: number): Done;
  change(id: string, patch: ItemPatch): Done;
  remove(ids: string[]): Done;
  draw(request: DrawRequest): Done;
  hide(buildings: string[], on: boolean): Done;
  shape(request: ShapeRequest): Done;
  setCamera(position: number[], target: number[]): void;
  undo(): void;
  redo(): void;
  save(): Promise<Done>;
  open(centre: Point2, size: number, discard: boolean): Done;
}

export interface SiteProfile {read: Record<SiteRead, boolean>; write: Record<SiteWrite, boolean>}

const blank = <T extends string>(keys: readonly T[], on: T[]) => Object.fromEntries(keys.map(k => [k, on.includes(k)])) as Record<T, boolean>;
export const defaultSiteProfile = (): SiteProfile => ({read: blank(SITE_READS, ['area', 'items', 'library', 'buildings', 'ground']), write: blank(SITE_WRITES, ['select'])});

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({type: 'object', properties, required, additionalProperties: false});
const point = {type: 'array', items: {type: 'number'}, minItems: 2, maxItems: 2};
const points = {type: 'array', items: point};
const ids = {type: 'array', items: {type: 'string'}};

const TOOLS: {name: string; read?: SiteRead; write?: SiteWrite; description: string; inputSchema: Record<string, unknown>}[] = [
  {name: 'configure', description: 'Turn information channels (read) and actions (write) on or off, e.g. {"write": {"place": true}}. Reads area, items, library, buildings and ground start on; only select is writable. Call tools/list again after changing writes.', inputSchema: schema({read: {type: 'object'}, write: {type: 'object'}})},
  {name: 'look', description: 'Read every enabled channel: area (open square, source x/z metres), items (objects, trees, roads, lines, areas in it), library (assets), buildings (footprints near it), streets (street centrelines near it), camera.', inputSchema: schema({})},
  {name: 'ground', read: 'ground', description: 'Ground height in absolute metres at source x/z points, and the building a point is inside, if any. Heights are null outside the loaded ground.', inputSchema: schema({points}, ['points'])},
  {name: 'screenshot', read: 'view', description: 'A picture of the editor view as it is now, to check work. width is in pixels, up to 1600.', inputSchema: schema({width: {type: 'number'}})},
  {name: 'select', write: 'select', description: 'Select items by id (p:, a:, road:, line:, area:) and optionally frame the camera on them.', inputSchema: schema({ids, frame: {type: 'boolean'}}, ['ids'])},
  {name: 'place', write: 'place', description: 'Place a library asset on the ground at x/z, inside the area and not inside a building. heading is radians. For a wall asset give wall: {building, height}; it goes on that building\'s nearest wall to x/z, height metres above the ground, facing out.', inputSchema: schema({asset: {type: 'string'}, x: {type: 'number'}, z: {type: 'number'}, heading: {type: 'number'}, variant: {type: 'string'}, wall: schema({building: {type: 'string'}, height: {type: 'number'}}, ['building', 'height'])}, ['asset', 'x', 'z'])},
  {name: 'add_tree', write: 'trees', description: 'Add a tree at x/z inside the area. height 3–40 m (default 12), radius is the crown radius (default 3.5).', inputSchema: schema({x: {type: 'number'}, z: {type: 'number'}, conifer: {type: 'boolean'}, height: {type: 'number'}, radius: {type: 'number'}}, ['x', 'z'])},
  {name: 'remove_tree', write: 'trees', description: 'Remove the tree nearest x/z within 2 m: a survey tree, or one added before.', inputSchema: schema({x: {type: 'number'}, z: {type: 'number'}}, ['x', 'z'])},
  {name: 'change', write: 'edit', description: 'Change one item. Objects and trees: x, z (the base moves there), heading, variant. Drawn items: x, z (the centre moves there), points (all of them), and type, footways, tiles (roads), lineKind, height (lines) or finish (areas).', inputSchema: schema({id: {type: 'string'}, x: {type: 'number'}, z: {type: 'number'}, heading: {type: 'number'}, variant: {type: 'string'}, points, type: {type: 'string', enum: ROAD_TYPES}, footways: {type: 'boolean'}, tiles: {type: 'number'}, lineKind: {type: 'string', enum: LINE_KINDS}, height: {type: 'number'}, finish: {type: 'string', enum: FINISHES}}, ['id'])},
  {name: 'remove', write: 'edit', description: 'Remove items by id.', inputSchema: schema({ids}, ['ids'])},
  {name: 'draw', write: 'draw', description: 'Draw a road or path (kind road, type, at least 2 points; ends within a few metres of a street or another road join it in the atlas), a line (kind line, lineKind fence, hedge, wall or kerb, optional height up to 4 m) or an area (kind area, finish, at least 3 corners). Points may run up to reach metres past the area.', inputSchema: schema({kind: {type: 'string', enum: ['road', 'line', 'area']}, points, type: {type: 'string', enum: ROAD_TYPES}, footways: {type: 'boolean'}, tiles: {type: 'number'}, lineKind: {type: 'string', enum: LINE_KINDS}, height: {type: 'number'}, finish: {type: 'string', enum: FINISHES}}, ['kind', 'points'])},
  {name: 'hide_buildings', write: 'hide', description: 'Leave survey buildings out of the atlas (sheds, kiosks, survey blobs), or bring them back with show: true. Refined buildings cannot be hidden.', inputSchema: schema({ids, show: {type: 'boolean'}}, ['ids'])},
  {name: 'shape_ground', write: 'terrain', description: 'Shape the ground with the terrain brush at each point in turn: raise or lower (strength in metres), flatten to target (absolute metres; default the height under the first point), smooth or reset to the survey (strength 0–1 of the way). radius 1–30 m. Objects and trees on the ground ride with it. Keep away from refined buildings, whose models do not follow.', inputSchema: schema({mode: {type: 'string', enum: [...SHAPES]}, points, radius: {type: 'number'}, strength: {type: 'number'}, target: {type: 'number'}}, ['mode', 'points', 'radius', 'strength'])},
  {name: 'set_camera', write: 'camera', description: 'Move the camera and its look-at target, both in the editor\'s local frame as look returns it.', inputSchema: schema({position: {type: 'array'}, target: {type: 'array'}}, ['position', 'target'])},
  {name: 'undo', write: 'history', description: 'Undo the last change in the tab.', inputSchema: schema({})},
  {name: 'redo', write: 'history', description: 'Redo the change just undone.', inputSchema: schema({})},
  {name: 'save', write: 'save', description: 'Merge the area\'s changes into the town\'s site store. Refused if the store was saved elsewhere since the area opened. This does not rebuild the atlas; the owner does that.', inputSchema: schema({})},
  {name: 'open_area', write: 'open', description: 'Open another square of 100, 200 or 300 m centred on x/z. Refused with unsaved changes unless discard is true. The tab reloads; call look again once it has.', inputSchema: schema({x: {type: 'number'}, z: {type: 'number'}, size: {type: 'number', enum: [100, 200, 300]}, discard: {type: 'boolean'}}, ['x', 'z'])},
];

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown): v is Point2 => Array.isArray(v) && v.length === 2 && v.every(finite);
const pointList = (v: unknown, min: number) => Array.isArray(v) && v.length >= min && v.every(isPoint) ? v.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100] as Point2) : null;
const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : [];
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : undefined;

type Result = {content: ({type: 'text'; text: string} | {type: 'image'; data: string; mimeType: string})[]; isError?: boolean};
const text = (value: unknown): Result => ({content: [{type: 'text', text: JSON.stringify(value)}], ...(isRecord(value) && typeof value.error === 'string' ? {isError: true} : {})});

export function createSiteSession(host: SiteHost) {
  let profile = defaultSiteProfile(), live = true;
  const tools = () => TOOLS.filter(t => (!t.write || profile.write[t.write]) && (!t.read || profile.read[t.read])).map(({name, description, inputSchema}) => ({name, description, inputSchema}));
  const inside = (x: number, z: number, beyond = 0) => {
    const a = host.area();
    return !!a && Math.abs(x - a.centre[0]) <= a.size / 2 + beyond && Math.abs(z - a.centre[1]) <= a.size / 2 + beyond;
  };
  const reach = () => host.area()?.reach ?? 0;
  const outside = (where: string) => ({error: `${where} is outside the open area; open_area there first`});

  const look = () => {
    const body: Record<string, unknown> = {}, area = host.area();
    if (!area) return {error: 'no area is open in the editor'};
    if (profile.read.area) body.area = {...area, selection: host.selection(), units: 'source x/z metres; heights absolute metres'};
    if (profile.read.items) body.items = host.items();
    if (profile.read.library) body.library = host.library();
    if (profile.read.buildings) body.buildings = host.buildings();
    if (profile.read.streets) body.streets = host.streets();
    if (profile.read.camera) body.camera = host.camera();
    return body;
  };

  const patchOf = (a: Record<string, unknown>): ItemPatch | {error: string} => {
    const p: ItemPatch = {};
    for (const key of ['x', 'z', 'heading', 'height', 'tiles'] as const) if (a[key] !== undefined) { if (!finite(a[key])) return {error: 'bad ' + key}; p[key] = a[key]; }
    if (a.points !== undefined) { const list = pointList(a.points, 2); if (!list) return {error: 'bad points'}; p.points = list; }
    if (a.variant !== undefined) { if (typeof a.variant !== 'string') return {error: 'bad variant'}; p.variant = a.variant; }
    if (a.type !== undefined) { const t = oneOf(a.type, ROAD_TYPES); if (!t) return {error: 'bad type'}; p.type = t; }
    if (a.lineKind !== undefined) { const k = oneOf(a.lineKind, LINE_KINDS); if (!k) return {error: 'bad lineKind'}; p.lineKind = k; }
    if (a.finish !== undefined) { const f = oneOf(a.finish, FINISHES); if (!f) return {error: 'bad finish'}; p.finish = f; }
    if (typeof a.footways === 'boolean') p.footways = a.footways;
    if (p.tiles !== undefined && (!Number.isInteger(p.tiles) || p.tiles < 1 || p.tiles > 6)) return {error: 'tiles must be 1–6'};
    if (p.height !== undefined && !(p.height > 0 && p.height <= 4)) return {error: 'height must be over 0 and up to 4 m'};
    return p;
  };

  const act = async (name: string, a: Record<string, unknown>): Promise<unknown> => {
    const tool = TOOLS.find(t => t.name === name);
    if (!tool) return {error: 'unknown tool'};
    if (tool.write && !profile.write[tool.write]) return {error: 'disabled', enable: {write: {[tool.write]: true}}};
    if (tool.read && !profile.read[tool.read]) return {error: 'disabled', enable: {read: {[tool.read]: true}}};
    if (name === 'configure') {
      const flip = <T extends string>(keys: readonly T[], value: unknown, base: Record<T, boolean>) => Object.fromEntries(keys.map(k => [k, isRecord(value) && typeof value[k] === 'boolean' ? value[k] : base[k]])) as Record<T, boolean>;
      profile = {read: flip(SITE_READS, a.read, profile.read), write: flip(SITE_WRITES, a.write, profile.write)};
      return {profile, refreshTools: true};
    }
    if (name === 'look') return look();
    if (!host.area() && name !== 'open_area') return {error: 'no area is open in the editor'};
    if (name === 'ground') {
      const list = pointList(a.points, 1);
      if (!list || list.length > 500) return {error: 'give 1–500 [x, z] points'};
      return {points: host.ground(list)};
    }
    if (name === 'screenshot') {
      const width = finite(a.width) ? Math.max(200, Math.min(1600, Math.round(a.width))) : 1000;
      const url = await host.screenshot(width), [head, data] = url.split(',');
      return {image: data, mimeType: head.slice(5, head.indexOf(';'))};
    }
    if (name === 'select') {
      const list = strings(a.ids);
      return a.frame ? host.frame(list) : host.select(list);
    }
    if (name === 'place') {
      const asset = host.library().find(x => x.id === a.asset);
      if (!asset) return {error: `unknown asset ${String(a.asset)}; see the library channel`};
      if (!finite(a.x) || !finite(a.z)) return {error: 'bad x/z'};
      if (!inside(a.x, a.z)) return outside('x/z');
      if (a.heading !== undefined && !finite(a.heading)) return {error: 'bad heading'};
      if (a.variant !== undefined && !asset.variants.includes(String(a.variant))) return {error: `${asset.id} has variants ${asset.variants.join(', ')}`};
      let wall: PlaceRequest['wall'];
      if (a.wall !== undefined) {
        if (!isRecord(a.wall) || typeof a.wall.building !== 'string' || !finite(a.wall.height) || a.wall.height < 0 || a.wall.height > 30) return {error: 'wall needs a building id and a height of 0–30 m'};
        if (asset.attach === 'ground') return {error: `${asset.id} stands on the ground`};
        wall = {building: a.wall.building, height: a.wall.height};
      } else if (asset.attach === 'wall') return {error: `${asset.id} hangs on a wall; give wall: {building, height}`};
      return host.place({asset: asset.id, x: a.x, z: a.z, ...(a.heading !== undefined && {heading: a.heading as number}), ...(a.variant !== undefined && {variant: String(a.variant)}), ...(wall && {wall})});
    }
    if (name === 'add_tree') {
      if (!finite(a.x) || !finite(a.z)) return {error: 'bad x/z'};
      if (!inside(a.x, a.z)) return outside('x/z');
      const height = a.height === undefined ? 12 : a.height, radius = a.radius === undefined ? 3.5 : a.radius;
      if (!finite(height) || height < 3 || height > 40 || !finite(radius) || radius <= 0 || radius > 15) return {error: 'height must be 3–40 m and radius up to 15 m'};
      return host.addTree({x: a.x, z: a.z, conifer: a.conifer === true, height, radius});
    }
    if (name === 'remove_tree') {
      if (!finite(a.x) || !finite(a.z)) return {error: 'bad x/z'};
      if (!inside(a.x, a.z)) return outside('x/z');
      return host.removeTree(a.x, a.z);
    }
    if (name === 'change') {
      if (typeof a.id !== 'string') return {error: 'bad id'};
      const patch = patchOf(a);
      if ('error' in patch) return patch;
      const drawn = /^(road|line|area):/.test(a.id);
      if (patch.x !== undefined || patch.z !== undefined) {
        if (patch.x === undefined || patch.z === undefined) return {error: 'give both x and z'};
        if (!inside(patch.x, patch.z, drawn ? reach() : 0)) return outside('x/z');
      }
      if (patch.points && (!drawn || !patch.points.every(([x, z]) => inside(x, z, reach())))) return drawn ? outside('a point') : {error: 'only drawn items have points'};
      return host.change(a.id, patch);
    }
    if (name === 'remove') return host.remove(strings(a.ids));
    if (name === 'draw') {
      const kind = oneOf(a.kind, ['road', 'line', 'area'] as const);
      if (!kind) return {error: 'kind is road, line or area'};
      const list = pointList(a.points, kind === 'area' ? 3 : 2);
      if (!list) return {error: kind === 'area' ? 'an area needs at least 3 [x, z] corners' : 'give at least 2 [x, z] points'};
      if (!list.every(([x, z]) => inside(x, z, reach()))) return outside('a point');
      const patch = patchOf(a);
      if ('error' in patch) return patch;
      if (kind === 'road' && !patch.type) return {error: 'a road needs a type'};
      if (kind === 'line' && !patch.lineKind) return {error: 'a line needs a lineKind'};
      if (kind === 'area' && !patch.finish) return {error: 'an area needs a finish'};
      return host.draw({kind, points: list, ...patch} as DrawRequest);
    }
    if (name === 'hide_buildings') return host.hide(strings(a.ids), a.show !== true);
    if (name === 'shape_ground') {
      const mode = oneOf(a.mode, SHAPES), list = pointList(a.points, 1);
      if (!mode) return {error: 'mode is raise, lower, flatten, smooth or reset'};
      if (!list || list.length > 200) return {error: 'give 1–200 [x, z] points'};
      if (!list.every(([x, z]) => inside(x, z, reach()))) return outside('a point');
      if (!finite(a.radius) || a.radius < 1 || a.radius > 30) return {error: 'radius must be 1–30 m'};
      const raising = mode === 'raise' || mode === 'lower';
      if (!finite(a.strength) || a.strength <= 0 || a.strength > (raising ? 5 : 1)) return {error: raising ? 'strength must be over 0 and up to 5 m' : 'strength must be over 0 and up to 1'};
      if (a.target !== undefined && (!finite(a.target) || mode !== 'flatten')) return {error: 'target is an absolute height, for flatten only'};
      return host.shape({mode, points: list, radius: a.radius, strength: a.strength, ...(a.target !== undefined && {target: a.target as number})});
    }
    if (name === 'set_camera') {
      const three = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(finite);
      if (!three(a.position) || !three(a.target)) return {error: 'position and target are [x, y, z]'};
      host.setCamera(a.position as number[], a.target as number[]);
      return {ok: true};
    }
    if (name === 'undo') { host.undo(); return {ok: true, area: host.area()}; }
    if (name === 'redo') { host.redo(); return {ok: true, area: host.area()}; }
    if (name === 'save') return host.save();
    if (name === 'open_area') {
      const size = a.size === undefined ? 200 : a.size;
      if (!finite(a.x) || !finite(a.z) || ![100, 200, 300].includes(size as number)) return {error: 'give x/z and a size of 100, 200 or 300'};
      return host.open([Math.round(a.x), Math.round(a.z)], size as number, a.discard === true);
    }
    return {error: 'unknown tool'};
  };

  return {
    profile: () => profile,
    tools,
    kill() { live = false; },
    async call(method: string, params: unknown): Promise<unknown> {
      if (!live) return method === 'tools/call' ? text({error: 'disconnected'}) : {error: 'disconnected'};
      if (method === 'tools/list') return {tools: tools()};
      if (method !== 'tools/call' || !isRecord(params) || typeof params.name !== 'string') return {error: 'unknown'};
      let result: unknown;
      try { result = await act(params.name, isRecord(params.arguments) ? params.arguments : {}); }
      catch (error) { result = {error: error instanceof Error ? error.message : String(error)}; }
      if (isRecord(result) && typeof result.image === 'string') return {content: [{type: 'image', data: result.image, mimeType: String(result.mimeType)}]} satisfies Result;
      return text(result);
    },
  };
}
