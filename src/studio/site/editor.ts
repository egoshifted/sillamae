/// <reference types="vite/client" />
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {assetById, drafts, library} from '../../city/sillamae/assets/library.ts';
import type {SurveyManifest, WorldData} from '../../engine/data.ts';
import type {AssetDefinition, Placement, PlacementSite, Point2, SiteTree} from '../../engine/types.ts';
import {city} from '../project.ts';
import {Measure} from './measure.ts';
import {TerrainEdit, type TerrainMode} from './terrain.ts';
import {loadSquare, type Square} from './scene.ts';
import {BROADLEAF, CONIFER, pickTree, TreeLayer, treeGhost, treeItems, type TreeItem} from './trees.ts';
import '../style.css';
import './site.css';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const main = document.querySelector('main')!, status = element<HTMLOutputElement>('status'), error = element<HTMLParagraphElement>('error');
const STEP = Math.PI / 12, GRID = .25, CLICK = 5; // radians, metres, pixels a click may move
const NUDGE = .1; // metres per arrow press; Shift moves ten times as far
// A wall is a face within this of vertical; anything flatter is ground or roof.
const WALL = .35;

const params = new URLSearchParams(location.search);
const world = fetch('/data/world.json').then(async r => { if (!r.ok) throw Error('Build data first: npm run data'); return await r.json() as WorldData; });
const survey = fetch('/data/survey.json').then(r => r.json() as Promise<SurveyManifest>);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor('#e0e6d9');
main.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(40, 1, .2, 3000), controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI / 2 - .05;
controls.zoomToCursor = true;
controls.addEventListener('change', () => render());

type Loaded = Awaited<ReturnType<typeof loadSquare>>;
type Brush = {kind: 'asset'; asset: AssetDefinition; variant: string} | {kind: 'tree'; type: string; h: number; r: number};
type Tool = 'select' | 'place' | 'path' | 'scatter' | 'terrain' | 'measure' | 'orbit' | 'pan';
type Gesture =
  | {kind: 'move'; before: string; anchor: THREE.Vector3; start: Map<string, Point2>; moved: boolean; wall?: string}
  | {kind: 'rotate'; before: string; centre: THREE.Vector3; from: number; start: Map<string, {p: Point2; heading: number}>; moved: boolean}
  | {kind: 'marquee'; x: number; y: number; additive: boolean}
  | {kind: 'scatter'; before: string; count: number}
  | {kind: 'terrain'; before: string; last: THREE.Vector3; target: number | null}
  | {kind: 'click'};

let loaded: Loaded | undefined, site: PlacementSite | undefined, sun: THREE.DirectionalLight | undefined, trees: TreeLayer | undefined, measure: Measure | undefined;
// The square's terrain edit, and the one the loaded data was built with: the
// preview shows only the difference.
let terrain: TerrainEdit | undefined, built: TerrainEdit | undefined;
let tool: Tool = 'select', brush: Brush | null = null, gesture: Gesture | null = null, dirty = false, treesChanged = false, space = false;
let selection = new Set<string>(); // 'p:<placement id>', or a tree key from trees.ts
const undo: string[] = [], redo: string[] = [], path: THREE.Vector3[] = [];
const objects = new Map<string, THREE.Object3D>(), placed = new THREE.Group(), highlights = new THREE.Group(), preview = new THREE.Group();
const pointer = {downX: 0, downY: 0, down: false, last: null as THREE.Vector3 | null};
const options = {spacing: 10, facing: 'along', offset: 0, radius: 6, gap: 3, spin: true, inPlace: false, vary: true, shape: 'raise' as TerrainMode, lift: .2, blend: .4};

// Flat on the ground round the selection; dragging it turns the selection, as in The Sims.
const ring = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#f0a400', transparent: true, opacity: .85, depthTest: false, side: THREE.DoubleSide}));
ring.add(new THREE.Mesh(new THREE.CircleGeometry(.09, 16).rotateX(-Math.PI / 2).translate(0, 0, .93), new THREE.MeshBasicMaterial({color: '#233e36', depthTest: false})));
ring.renderOrder = ring.children[0].renderOrder = 998;
ring.visible = false;
const brushRing = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: '#233e36', depthTest: false}));
brushRing.renderOrder = 997;
brushRing.visible = false;

function render() {
  if (!loaded) return;
  renderer.render(loaded.scene, camera);
  const {width, height} = renderer.domElement.getBoundingClientRect();
  measure?.labels(camera, width, height);
}
function resize() {
  const {width, height} = main.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  render();
}
new ResizeObserver(resize).observe(main);

// ---- Geometry under the pointer -------------------------------------------------

function raycaster(clientX: number, clientY: number) {
  const rect = renderer.domElement.getBoundingClientRect(), r = new THREE.Raycaster();
  r.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2), camera);
  return r;
}
function ground(clientX: number, clientY: number, snap = false) {
  const point = loaded?.heights.intersect(raycaster(clientX, clientY).ray)?.point;
  if (point && snap && element<HTMLInputElement>('grid').checked) {
    point.x = Math.round(point.x / GRID) * GRID;
    point.z = Math.round(point.z / GRID) * GRID;
    point.y = loaded!.heights.at(point.x, point.z);
  }
  return point && point.y > -Infinity ? point : null;
}
const isWithin = (object: THREE.Object3D, root: THREE.Object3D) => { for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o === root) return true; return false; };
function inSquare(x: number, z: number) {
  const [ox, oz] = loaded!.frame.origin, [cx, cz] = site!.square.centre, half = site!.square.size / 2;
  return Math.abs(x + ox - cx) <= half && Math.abs(z + oz - cz) <= half;
}

// Where an asset would go: on the ground, or flat against a wall facing out.
function target(clientX: number, clientY: number, asset: AssetDefinition, ignore?: THREE.Object3D) {
  if (!loaded || !site) return null;
  const caster = raycaster(clientX, clientY), floor = loaded.heights.intersect(caster.ray);
  const wall = caster.intersectObjects([loaded.wallMesh, ...loaded.refined.map(r => r.root)], true).find(h => !ignore || !isWithin(h.object, ignore));
  if (wall && wall.face && (!floor || wall.distance < floor.distance)) {
    const normal = wall.face.normal.clone().transformDirection(wall.object.matrixWorld);
    if (normal.dot(caster.ray.direction) > 0) normal.negate();
    if (asset.attach === 'ground' || Math.abs(normal.y) > WALL) return null;
    const building = wall.object === loaded.wallMesh ? loaded.byPick.get((loaded.wallMesh.geometry.attributes.pick as THREE.BufferAttribute).getX(wall.face.a)) : loaded.refined.find(r => isWithin(wall.object, r.root))?.id;
    if (!building || !inSquare(wall.point.x, wall.point.z)) return null;
    return {point: wall.point.clone(), heading: Math.atan2(normal.x, normal.z) as number | undefined, attach: 'wall' as const, building: building as string | undefined};
  }
  if (asset.attach === 'wall') return null;
  const point = ground(clientX, clientY, true);
  return point && inSquare(point.x, point.z) ? {point, heading: undefined, attach: 'ground' as const, building: undefined} : null;
}

// The placed object or tree under the pointer, nearest first.
function itemAt(clientX: number, clientY: number) {
  const caster = raycaster(clientX, clientY), hit = caster.intersectObject(placed, true)[0], tree = pickTree(caster.ray, treeList(), loaded!.frame);
  if (hit && (!tree || hit.distance <= tree.distance)) {
    let root = hit.object;
    while (root.parent && root.parent !== placed) root = root.parent;
    return 'p:' + root.userData.placement;
  }
  return tree ? tree.item.key : null;
}

// ---- Items -----------------------------------------------------------------------

const edits = () => site!.trees ??= {remove: [], add: []};
// Survey trees stand where the loaded data put them, plus any terrain change since.
const treeList = () => {
  if (!loaded || !site) return [];
  const [ox, oz] = loaded.frame.origin;
  return treeItems(loaded.trees, edits()).map(i => i.added ? i : {...i, tree: {...i.tree, z: i.tree.z + shift(i.tree.p[0] - ox, i.tree.p[1] - oz)}});
};
const placementOf = (key: string) => key.startsWith('p:') ? site!.placements.find(p => p.id === key.slice(2)) : undefined;
const treeOf = (key: string, list = treeList()) => list.find(i => i.key === key);
const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;
const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36).padStart(3, '0');

// Source x/z of an item.
function spotOf(key: string, list?: TreeItem[]): Point2 | null {
  const p = placementOf(key);
  if (p) return [p.p[0], p.p[1]];
  const t = treeOf(key, list);
  return t ? [t.tree.p[0], t.tree.p[1]] : null;
}
// Local position of an item's base, and how tall it is, for marquee and framing.
function anchorOf(key: string, list?: TreeItem[]) {
  const [ox, oz] = loaded!.frame.origin, base = loaded!.frame.base, p = placementOf(key);
  if (p) return {at: new THREE.Vector3(p.p[0] - ox, p.p[2] - base, p.p[1] - oz), height: assetById.get(p.asset)?.size[1] ?? 1};
  const t = treeOf(key, list);
  return t ? {at: new THREE.Vector3(t.tree.p[0] - ox, t.tree.z - base, t.tree.p[1] - oz), height: t.tree.h} : null;
}

// A survey tree becomes an added one the first time it is changed; returns its new key.
function own(key: string) {
  if (!key.startsWith('s:')) return key;
  const item = treeOf(key);
  if (!item) return key;
  const t = item.tree, added: SiteTree = {id: newId('t'), p: [t.p[0], t.p[1]], z: t.z, h: t.h, r: t.r, type: t.type};
  edits().remove.push([t.p[0], t.p[1]]);
  edits().add.push(added);
  treesChanged = true;
  const next = 'a:' + added.id;
  if (selection.delete(key)) selection.add(next);
  return next;
}
// Moves an item's base to source x/z on the ground; false where that is outside the square or off the ground.
function moveTo(key: string, x: number, z: number) {
  const [ox, oz] = loaded!.frame.origin, base = loaded!.frame.base, h = loaded!.heights.at(x - ox, z - oz);
  if (!inSquare(x - ox, z - oz) || h === -Infinity || loaded!.indoors(x - ox, z - oz)) return false;
  const p = placementOf(key);
  if (p) {
    if (p.attach === 'wall') return false;
    p.p = [round(x), round(z), round(h + base)];
    return true;
  }
  const added = edits().add.find(t => 'a:' + t.id === key);
  if (!added) return false;
  added.p = [round(x), round(z)];
  added.z = round(h + base);
  treesChanged = true;
  return true;
}
function headingOf(key: string) { return placementOf(key)?.heading ?? 0; }
function setHeading(key: string, heading: number) {
  const p = placementOf(key);
  if (p && p.attach === 'ground') p.heading = round(Math.atan2(Math.sin(heading), Math.cos(heading)), 4);
}

// ---- Scene sync and history ------------------------------------------------------

const prototypes = new Map<string, THREE.Object3D>();
function instance(assetId: string, variant?: string) {
  const asset = assetById.get(assetId)!, v = variant ?? asset.variants[0].id, key = assetId + ':' + v;
  let prototype = prototypes.get(key);
  if (!prototype) prototypes.set(key, prototype = asset.build({variant: v, detail: 'near'}));
  return prototype.clone();
}
const ghostMaterials = new Map<THREE.Material, THREE.Material>();
function ghostOf(b: Brush) {
  if (b.kind === 'tree') return treeGhost(b.type, b.h, b.r);
  const object = b.asset.build({variant: b.variant, detail: 'near'});
  object.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const original = o.material as THREE.Material;
    let see = ghostMaterials.get(original);
    if (!see) ghostMaterials.set(original, see = Object.assign(original.clone(), {transparent: true, opacity: .55, depthWrite: false}));
    o.material = see;
    o.castShadow = false;
  });
  return object;
}

function sync(live = false) {
  const [ox, oz] = loaded!.frame.origin, base = loaded!.frame.base;
  for (const [id, object] of objects) if (!site!.placements.some(p => p.id === id)) { object.removeFromParent(); objects.delete(id); }
  for (const p of site!.placements) {
    let object = objects.get(p.id);
    const key = p.asset + ':' + (p.variant ?? '');
    if (object && object.userData.key !== key) { object.removeFromParent(); objects.delete(p.id); object = undefined; }
    if (!object) {
      object = instance(p.asset, p.variant);
      object.userData = {key, placement: p.id};
      placed.add(object);
      objects.set(p.id, object);
    }
    object.position.set(p.p[0] - ox, p.p[2] - base, p.p[1] - oz);
    object.rotation.set(0, p.heading, 0);
  }
  const list = treeList();
  if (treesChanged) {
    treesChanged = false;
    const shown = list.map(i => i.tree);
    if (live) trees!.later(shown, render); else trees!.show(shown);
  }
  for (const key of [...selection]) if (!placementOf(key) && !treeOf(key, list)) selection.delete(key);
  highlights.clear();
  for (const key of selection) {
    const object = key.startsWith('p:') ? objects.get(key.slice(2)) : undefined, tree = treeOf(key, list)?.tree;
    const box = object ? new THREE.Box3().setFromObject(object) : new THREE.Box3(new THREE.Vector3(tree!.p[0] - ox - tree!.r, tree!.z - base, tree!.p[1] - oz - tree!.r), new THREE.Vector3(tree!.p[0] - ox + tree!.r, tree!.z - base + tree!.h, tree!.p[1] - oz + tree!.r));
    highlights.add(new THREE.Box3Helper(box, '#f0a400'));
  }
  placeRing(list);
  renderer.shadowMap.needsUpdate = true;
  showSelection();
  showStatus();
  render();
}
function placeRing(list: TreeItem[]) {
  const entries = [...selection].map(key => ({key, a: anchorOf(key, list)})).filter(e => e.a !== null).map(e => ({key: e.key, at: e.a!.at}));
  ring.visible = tool === 'select' && entries.length > 0 && entries.some(e => placementOf(e.key)?.attach !== 'wall');
  if (!ring.visible) return;
  const centre = entries.reduce((s, e) => s.add(e.at), new THREE.Vector3()).divideScalar(entries.length);
  // Clear of each item's footprint, so the ring can be grabbed beside it rather than through it.
  const extent = (key: string) => { const p = placementOf(key), s = p && assetById.get(p.asset)?.size; return s ? Math.hypot(s[0], s[2]) / 2 : treeOf(key, list)?.tree.r ?? 1; };
  const reach = Math.max(1, ...entries.map(e => Math.hypot(e.at.x - centre.x, e.at.z - centre.z) + extent(e.key) + .4));
  ring.position.set(centre.x, Math.min(...entries.map(e => e.at.y)) + .05, centre.z);
  ring.scale.setScalar(reach);
  ring.rotation.y = selection.size === 1 ? headingOf([...selection][0]) : 0;
}

const snapshot = () => JSON.stringify({placements: site!.placements, trees: edits(), terrain: terrain?.saved() ?? null});
function commit(before: string) {
  if (before === snapshot()) return sync();
  undo.push(before);
  redo.length = 0;
  dirty = true;
  sync();
}
function edit(run: () => void) {
  const before = snapshot();
  run();
  commit(before);
}
function step(from: string[], to: string[]) {
  const state = from.pop();
  if (state === undefined) return;
  to.push(snapshot());
  restore(state);
  dirty = true;
  sync();
}
// The square as it was opened, for Reset, and as last saved, to tell whether a reset leaves unsaved changes.
let opened = '', saved = '';
function reset() {
  if (!site || snapshot() === opened || !confirm('All changes will be lost. Do you want to reset?')) return;
  // Kept on the undo stack all the same, so a reset clicked by mistake can be taken back.
  undo.push(snapshot());
  redo.length = 0;
  restore(opened);
  selection.clear();
  dirty = opened !== saved;
  sync();
}
function restore(state: string) {
  const restored = JSON.parse(state);
  site!.placements = restored.placements;
  site!.trees = restored.trees;
  if (terrain && JSON.stringify(terrain.saved()) !== JSON.stringify(restored.terrain)) { terrain.load(restored.terrain); reshape(); settle(); }
  treesChanged = true;
}

// ---- Terrain ---------------------------------------------------------------------

// Metres the shown ground must move at local x/z: the edit, less what the loaded data already holds.
const shift = (x: number, z: number) => (terrain?.at(x, z) ?? 0) - (built?.at(x, z) ?? 0);
const baseY = new Map<THREE.BufferGeometry, Float32Array>(), reshaped = new Set<THREE.BufferGeometry>();
// Moves the preview: ground and roads by the shift beneath each point, buildings
// whole by the shift at their centre, and the height lookup used for snapping.
function reshape(box?: {minX: number; maxX: number; minZ: number; maxZ: number}) {
  const {shapeable, centres, heights} = loaded!, reach = box ?? {minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity};
  const within = (x: number, z: number) => x >= reach.minX && x <= reach.maxX && z >= reach.minZ && z <= reach.maxZ;
  for (const {mesh, picks} of shapeable) {
    const g = mesh.geometry as THREE.BufferGeometry, position = g.attributes.position as THREE.BufferAttribute;
    if (!position) continue;
    let base = baseY.get(g);
    if (!base) baseY.set(g, base = (position.array as Float32Array).slice());
    const out = position.array as Float32Array;
    let touched = false;
    for (let v = 0; v < position.count; v++) {
      const pick = picks ? picks.getX(v) : 0, at = pick ? centres.get(pick) : undefined;
      const x = at ? at[0] : base[v * 3], z = at ? at[1] : base[v * 3 + 2];
      if (!within(x, z)) continue;
      out[v * 3 + 1] = base[v * 3 + 1] + shift(x, z);
      touched = true;
    }
    if (touched) { position.needsUpdate = true; reshaped.add(g); }
  }
  heights.reshape(shift, box);
  render();
}
// After a stroke: lighting normals and bounds once, not on every touch of the brush.
function settle() {
  for (const g of reshaped) { g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); }
  reshaped.clear();
  treesChanged = true;
}
// One touch of the terrain brush; objects and added trees on the ground ride with it.
function dab(at: THREE.Vector3, target: number | null) {
  if (!terrain || !loaded) return;
  const [ox, oz] = loaded.frame.origin, r = options.radius, near = (x: number, z: number) => Math.hypot(x - at.x, z - at.z) < r;
  const riders = [
    ...site!.placements.filter(p => p.attach === 'ground' && near(p.p[0] - ox, p.p[1] - oz)).map(p => ({get: () => p.p[2], set: (v: number) => { p.p[2] = v; }, x: p.p[0] - ox, z: p.p[1] - oz})),
    ...edits().add.filter(t => near(t.p[0] - ox, t.p[1] - oz)).map(t => ({get: () => t.z, set: (v: number) => { t.z = v; treesChanged = true; }, x: t.p[0] - ox, z: t.p[1] - oz})),
  ].map(item => ({...item, before: shift(item.x, item.z)}));
  const strength = options.shape === 'raise' || options.shape === 'lower' ? options.lift : options.blend;
  const box = terrain.dab(options.shape, at.x, at.z, r, strength, (x, z) => loaded!.heights.at(x, z), target);
  for (const item of riders) item.set(round(item.get() + shift(item.x, item.z) - item.before));
  reshape(box);
  sync(true);
}

// ---- Adding ----------------------------------------------------------------------

function add(b: Brush, at: THREE.Vector3, heading: number, wall?: {heading?: number; attach: 'ground' | 'wall'; building?: string}) {
  const [ox, oz] = loaded!.frame.origin, base = loaded!.frame.base, x = round(at.x + ox), z = round(at.z + oz), y = round(at.y + base);
  if (b.kind === 'tree') {
    const t: SiteTree = {id: newId('t'), p: [x, z], z: y, h: round(b.h, 2), r: round(b.r, 2), type: b.type};
    edits().add.push(t);
    treesChanged = true;
    return 'a:' + t.id;
  }
  const p: Placement = {id: newId('p'), asset: b.asset.id, p: [x, z, y], heading: round(wall?.heading ?? heading, 4), attach: wall?.attach ?? 'ground'};
  if (b.variant !== b.asset.variants[0].id) p.variant = b.variant;
  if (wall?.building) p.building = wall.building;
  site!.placements.push(p);
  return 'p:' + p.id;
}
// Where the brush would go on a click: assets may take a wall; trees only the ground.
function spotFor(b: Brush, clientX: number, clientY: number) {
  if (b.kind === 'asset') return target(clientX, clientY, b.asset);
  const point = ground(clientX, clientY, true);
  return point && inSquare(point.x, point.z) && !loaded!.indoors(point.x, point.z) ? {point, heading: undefined, attach: 'ground' as const, building: undefined} : null;
}

// With "Vary each tree", every tree drawn from a tree brush gets its own height and
// crown, within a fifth either way; the atlas then picks its crown shape from that
// ratio and its colour and turn from where it stands, so no two look alike.
let next = {h: 1, r: 1};
const roll = () => { next = {h: .8 + Math.random() * .4, r: .8 + Math.random() * .4}; };
const sized = (b: Brush): Brush => b.kind === 'tree' && options.vary ? {...b, h: b.h * next.h, r: b.r * next.r} : b;
// Takes the brush as the next tree will be, and rolls the one after.
function draw(b: Brush) {
  const out = sized(b);
  if (b.kind === 'tree' && options.vary) roll();
  return out;
}

let ghost: THREE.Object3D | null = null, placeHeading = 0;
// The ghost shows the next tree's size, so it changes after every placement.
function showGhost() {
  const old = ghost;
  ghost = brush ? ghostOf(sized(brush)) : null;
  if (ghost) {
    ghost.visible = !!old?.visible;
    if (old) { ghost.position.copy(old.position); ghost.rotation.copy(old.rotation); }
    loaded?.scene.add(ghost);
  }
  old?.removeFromParent();
}
function setBrush(b: Brush | null) {
  brush = b;
  showGhost();
  if (ghost) ghost.visible = false;
  if (b && !['place', 'path', 'scatter'].includes(tool)) setTool('place');
  else { showOptions(); updatePreview(); }
  showPalette();
}

// Positions along the path every spacing metres, measured on plan, with headings.
function pathSpots(points: THREE.Vector3[]) {
  const out: {at: THREE.Vector3; heading: number}[] = [];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const along = Math.atan2(b.x - a.x, b.z - a.z), side = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).divideScalar(length);
    const heading = along + (options.facing === 'left' ? Math.PI / 2 : options.facing === 'right' ? -Math.PI / 2 : 0);
    for (let s = carry; s <= length + 1e-6; s += Math.max(.2, options.spacing)) {
      const at = a.clone().lerp(b, s / length).addScaledVector(side, options.offset);
      at.y = loaded!.heights.at(at.x, at.z);
      if (at.y > -Infinity && inSquare(at.x, at.z) && !loaded!.indoors(at.x, at.z)) out.push({at, heading});
      carry = s + options.spacing - length;
    }
  }
  return out;
}
function updatePreview() {
  preview.clear();
  if (tool !== 'path' || !brush || !ghost) return render();
  const points = pointer.last && path.length ? [...path, pointer.last] : path;
  for (const s of pathSpots(points)) {
    const g = ghost.clone();
    g.visible = true;
    g.position.copy(s.at);
    g.rotation.set(0, s.heading, 0);
    preview.add(g);
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => p.clone().setY(p.y + .08))), new THREE.LineBasicMaterial({color: '#233e36', depthTest: false}));
  line.renderOrder = 997;
  preview.add(line);
  render();
}
function finishPath() {
  if (!brush || path.length < 2) return;
  const b = brush, spots = pathSpots(path);
  edit(() => { selection = new Set(spots.map(s => add(draw(b), s.at, s.heading))); });
  path.length = 0;
  updatePreview();
}

// One stroke of the scatter brush: a few tries per move, each kept if nothing of
// the same kind stands within the gap.
function scatter(centre: THREE.Vector3) {
  if (!brush) return 0;
  const [ox, oz] = loaded!.frame.origin, list = treeList();
  const others = brush.kind === 'tree' ? list.map(i => [i.tree.p[0] - ox, i.tree.p[1] - oz]) : site!.placements.filter(p => p.asset === (brush as {asset: AssetDefinition}).asset.id).map(p => [p.p[0] - ox, p.p[1] - oz]);
  let added = 0;
  for (let k = 0; k < 4; k++) {
    const angle = Math.random() * Math.PI * 2, distance = Math.sqrt(Math.random()) * options.radius;
    const x = centre.x + Math.sin(angle) * distance, z = centre.z + Math.cos(angle) * distance, y = loaded!.heights.at(x, z);
    if (y === -Infinity || !inSquare(x, z) || loaded!.indoors(x, z) || others.some(([px, pz]) => Math.hypot(px - x, pz - z) < options.gap)) continue;
    add(draw(brush), new THREE.Vector3(x, y, z), options.spin ? Math.random() * Math.PI * 2 : placeHeading);
    others.push([x, z]);
    added++;
  }
  return added;
}
function showBrushRing(at: THREE.Vector3 | null) {
  brushRing.visible = (tool === 'scatter' || tool === 'terrain') && !!at;
  if (!at) return;
  const points: THREE.Vector3[] = [];
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2, x = at.x + Math.sin(a) * options.radius, z = at.z + Math.cos(a) * options.radius, h = loaded!.heights.at(x, z);
    points.push(new THREE.Vector3(x, (h > -Infinity ? h : at.y) + .1, z));
  }
  brushRing.geometry.dispose();
  brushRing.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

// ---- Selection edits -------------------------------------------------------------

// Turns the selection round its centre; a lone object turns on the spot.
function turn(by: number, start?: Map<string, {p: Point2; heading: number}>, centre?: THREE.Vector3) {
  const [ox, oz] = loaded!.frame.origin, keys = [...selection].map(own);
  const from = start ?? new Map(keys.map(k => [k, {p: spotOf(k)!, heading: headingOf(k)}]));
  const c = centre ?? (() => { const s = [...from.values()]; return new THREE.Vector3(s.reduce((t, v) => t + v.p[0] - ox, 0) / s.length, 0, s.reduce((t, v) => t + v.p[1] - oz, 0) / s.length); })();
  const cos = Math.cos(by), sin = Math.sin(by);
  for (const [key, {p, heading}] of from) {
    if (placementOf(key)?.attach === 'wall') continue;
    const dx = p[0] - ox - c.x, dz = p[1] - oz - c.z;
    if (from.size > 1 && !options.inPlace) moveTo(key, c.x + dx * cos + dz * sin + ox, c.z - dx * sin + dz * cos + oz);
    setHeading(key, heading + by);
  }
}
function remove() {
  if (!selection.size) return;
  edit(() => {
    const list = treeList();
    for (const key of selection) {
      if (key.startsWith('p:')) site!.placements = site!.placements.filter(p => 'p:' + p.id !== key);
      else if (key.startsWith('a:')) edits().add = edits().add.filter(t => 'a:' + t.id !== key);
      else { const t = treeOf(key, list); if (t) edits().remove.push([t.tree.p[0], t.tree.p[1]]); }
    }
    treesChanged = true;
    selection.clear();
  });
}
// Copies sit a metre to the camera's right, selected, as Photoshop duplicates a layer.
function duplicate() {
  if (!selection.size) return;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
  edit(() => {
    const list = treeList(), copies = new Set<string>();
    for (const key of selection) {
      const p = placementOf(key), t = treeOf(key, list);
      if (p) {
        const copy: Placement = structuredClone(p);
        copy.id = newId('p');
        site!.placements.push(copy);
        if (p.attach === 'ground' && !moveTo('p:' + copy.id, p.p[0] + right.x, p.p[1] + right.z)) site!.placements.pop(); else copies.add('p:' + copy.id);
      } else if (t) {
        const copy: SiteTree = {id: newId('t'), p: [t.tree.p[0], t.tree.p[1]], z: t.tree.z, h: t.tree.h, r: t.tree.r, type: t.tree.type};
        edits().add.push(copy);
        if (moveTo('a:' + copy.id, t.tree.p[0] + right.x, t.tree.p[1] + right.z)) copies.add('a:' + copy.id); else edits().add.pop();
      }
    }
    treesChanged = true;
    selection = copies;
  });
}
// Arrow keys move along the view: up is away from the camera.
function nudge(forward: number, sideways: number) {
  const ahead = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), right = new THREE.Vector3(-ahead.z, 0, ahead.x);
  const dx = ahead.x * forward + right.x * sideways, dz = ahead.z * forward + right.z * sideways;
  edit(() => { for (const key of [...selection].map(own)) { const s = spotOf(key); if (s) moveTo(key, s[0] + dx, s[1] + dz); } });
}
function selectAll() {
  const list = treeList();
  selection = new Set([...site!.placements.map(p => 'p:' + p.id), ...list.filter(i => { const a = anchorOf(i.key, list)!.at; return inSquare(a.x, a.z); }).map(i => i.key)]);
  sync();
}
// Alt-click picks the clicked object's asset and variant, or the tree's size, as the brush.
function eyedrop(clientX: number, clientY: number) {
  const key = itemAt(clientX, clientY);
  if (!key) return;
  const p = placementOf(key), t = treeOf(key)?.tree, asset = p && assetById.get(p.asset);
  if (asset) setBrush({kind: 'asset', asset, variant: p.variant ?? asset.variants[0].id});
  else if (t) setBrush({kind: 'tree', type: t.type, h: t.h, r: t.r});
}

// ---- Pointer ---------------------------------------------------------------------

const marquee = element('marquee');
renderer.domElement.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !loaded || !site || space || tool === 'orbit' || tool === 'pan') return;
  Object.assign(pointer, {downX: event.clientX, downY: event.clientY, down: true});
  if (event.altKey && ['place', 'path', 'scatter'].includes(tool)) { eyedrop(event.clientX, event.clientY); pointer.down = false; return; }
  if (tool === 'terrain') {
    const at = ground(event.clientX, event.clientY);
    if (!at) { pointer.down = false; return; }
    gesture = {kind: 'terrain', before: snapshot(), last: at, target: options.shape === 'flatten' ? at.y : null};
    dab(at, gesture.target);
    return;
  }
  if (tool === 'scatter') {
    const at = ground(event.clientX, event.clientY);
    gesture = {kind: 'scatter', before: snapshot(), count: at ? scatter(at) : 0};
    sync(true);
    return;
  }
  if (tool !== 'select') { gesture = {kind: 'click'}; return; }
  const caster = raycaster(event.clientX, event.clientY);
  if (ring.visible && caster.intersectObject(ring, true).length) {
    const at = ground(event.clientX, event.clientY) ?? ring.position.clone(), keys = [...selection];
    gesture = {kind: 'rotate', before: snapshot(), centre: ring.position.clone(), from: Math.atan2(at.x - ring.position.x, at.z - ring.position.z), start: new Map(keys.map(k => [k, {p: spotOf(k)!, heading: headingOf(k)}])), moved: false};
    return;
  }
  const key = itemAt(event.clientX, event.clientY);
  if (!key) {
    gesture = {kind: 'marquee', x: event.clientX, y: event.clientY, additive: event.shiftKey || event.ctrlKey};
    return;
  }
  if (event.ctrlKey || event.metaKey) { if (!selection.delete(key)) selection.add(key); sync(); gesture = {kind: 'click'}; return; }
  if (event.shiftKey) selection.add(key);
  else if (!selection.has(key)) selection = new Set([key]);
  const anchor = ground(event.clientX, event.clientY) ?? anchorOf(key)!.at;
  const single = selection.size === 1 ? placementOf(key) : undefined;
  gesture = {kind: 'move', before: snapshot(), anchor, start: new Map([...selection].map(k => [k, spotOf(k)!])), moved: false, wall: single?.attach === 'wall' || single && assetById.get(single.asset)?.attach === 'either' ? key : undefined};
  sync();
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!loaded || !site) return;
  const at = ground(event.clientX, event.clientY);
  const [ox, oz] = loaded.frame.origin;
  element('cursor').textContent = at ? `x ${(at.x + ox).toFixed(2)} · z ${(at.z + oz).toFixed(2)} · ground ${(at.y + loaded.frame.base).toFixed(2)} m` : '';
  if (tool === 'measure') { measure!.hover(at); render(); }
  if (tool === 'path') { pointer.last = at; updatePreview(); }
  if (tool === 'scatter' || tool === 'terrain') { showBrushRing(at); render(); }
  if (tool === 'place' && ghost && brush) {
    const spot = spotFor(brush, event.clientX, event.clientY);
    ghost.visible = !!spot;
    if (spot) { ghost.position.copy(spot.point); ghost.rotation.set(0, spot.heading ?? placeHeading, 0); }
    render();
  }
  if (!gesture || !pointer.down) return;
  const moved = Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY) >= CLICK;
  if (gesture.kind === 'scatter' && at) { gesture.count += scatter(at); sync(true); }
  // Touches are spaced a third of the brush apart, so a stroke's effect does not depend on the pointer's speed.
  else if (gesture.kind === 'terrain' && at && Math.hypot(at.x - gesture.last.x, at.z - gesture.last.z) >= options.radius / 3) { gesture.last = at; dab(at, gesture.target); }
  else if (gesture.kind === 'marquee' && moved) {
    const rect = main.getBoundingClientRect();
    Object.assign(marquee.style, {left: Math.min(gesture.x, event.clientX) - rect.left + 'px', top: Math.min(gesture.y, event.clientY) - rect.top + 'px', width: Math.abs(event.clientX - gesture.x) + 'px', height: Math.abs(event.clientY - gesture.y) + 'px'});
    marquee.hidden = false;
  } else if (gesture.kind === 'move' && (moved || gesture.moved)) {
    if (!gesture.moved) {
      gesture.moved = true;
      for (const key of [...gesture.start.keys()]) { const next = own(key); if (next !== key) { gesture.start.set(next, gesture.start.get(key)!); gesture.start.delete(key); } }
    }
    const wall = gesture.wall && placementOf(gesture.wall);
    if (wall) {
      const asset = assetById.get(wall.asset)!, spot = target(event.clientX, event.clientY, asset, objects.get(wall.id));
      if (spot) {
        const base = loaded.frame.base;
        Object.assign(wall, {p: [round(spot.point.x + ox), round(spot.point.z + oz), round(spot.point.y + base)], attach: spot.attach, heading: round(spot.heading ?? wall.heading, 4)});
        if (spot.building) wall.building = spot.building; else delete wall.building;
      }
    } else if (at) {
      let dx = at.x - gesture.anchor.x, dz = at.z - gesture.anchor.z;
      if (element<HTMLInputElement>('grid').checked) { dx = Math.round(dx / GRID) * GRID; dz = Math.round(dz / GRID) * GRID; }
      for (const [key, [x, z]] of gesture.start) moveTo(key, x + dx, z + dz);
    }
    sync(true);
  } else if (gesture.kind === 'rotate' && at) {
    if (!gesture.moved) {
      gesture.moved = true;
      for (const key of [...gesture.start.keys()]) { const next = own(key); if (next !== key) { gesture.start.set(next, gesture.start.get(key)!); gesture.start.delete(key); } }
    }
    let by = Math.atan2(at.x - gesture.centre.x, at.z - gesture.centre.z) - gesture.from;
    if (!event.altKey) by = Math.round(by / STEP) * STEP;
    turn(by, gesture.start, gesture.centre);
    sync(true);
  }
});

addEventListener('pointerup', event => {
  if (!pointer.down) return;
  pointer.down = false;
  const g = gesture, click = Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY) < CLICK, onCanvas = event.target === renderer.domElement;
  gesture = null;
  if (!g || !site) return;
  if (g.kind === 'terrain') settle();
  if (g.kind === 'move' || g.kind === 'rotate' || g.kind === 'scatter' || g.kind === 'terrain') return commit(g.before);
  if (g.kind === 'marquee') {
    marquee.hidden = true;
    if (!g.additive) selection.clear();
    if (!click) {
      const rect = renderer.domElement.getBoundingClientRect(), left = Math.min(g.x, event.clientX), right = Math.max(g.x, event.clientX), top = Math.min(g.y, event.clientY), bottom = Math.max(g.y, event.clientY), list = treeList();
      for (const key of [...site.placements.map(p => 'p:' + p.id), ...list.map(i => i.key)]) {
        const a = anchorOf(key, list)!, v = a.at.clone().setY(a.at.y + a.height / 2).project(camera);
        const sx = rect.left + (v.x + 1) / 2 * rect.width, sy = rect.top + (1 - v.y) / 2 * rect.height;
        if (v.z < 1 && sx >= left && sx <= right && sy >= top && sy <= bottom && inSquare(a.at.x, a.at.z)) selection.add(key);
      }
    }
    return sync();
  }
  if (!click || !onCanvas) return;
  if (tool === 'place' && brush) {
    const b = brush, spot = spotFor(b, event.clientX, event.clientY);
    if (spot) {
      edit(() => { selection = new Set([add(draw(b), spot.point, placeHeading, spot)]); });
      if (b.kind === 'tree') { showGhost(); render(); }
    }
  } else if (tool === 'path') {
    const at = ground(event.clientX, event.clientY);
    if (at) { path.push(at); updatePreview(); }
  } else if (tool === 'measure') {
    const at = ground(event.clientX, event.clientY);
    if (at) { measure!.add(at); render(); }
  }
});
renderer.domElement.addEventListener('dblclick', () => {
  if (tool === 'path') finishPath();
  if (tool === 'measure') { measure!.finish(); render(); }
});
renderer.domElement.addEventListener('contextmenu', event => {
  if (tool === 'place' || tool === 'path' || tool === 'measure') event.preventDefault();
  if (tool === 'path' && path.length) { path.length = 0; updatePreview(); }
});

// ---- Keys ------------------------------------------------------------------------

const TOOL_KEYS: Record<string, Tool> = {v: 'select', a: 'place', p: 'path', b: 'scatter', u: 'terrain', i: 'measure', r: 'orbit', h: 'pan'};
addEventListener('keydown', event => {
  if (!site || (event.target as HTMLElement).closest('input, select, textarea, dialog')) return;
  const key = event.key.toLowerCase(), ctrl = event.ctrlKey || event.metaKey, by = event.shiftKey ? 10 : 1;
  if (key === ' ') { if (!space) { space = true; navigation(); } }
  else if (ctrl && key === 'z' && !event.shiftKey) step(undo, redo);
  else if (ctrl && (key === 'y' || key === 'z')) step(redo, undo);
  else if (ctrl && key === 's') action(save);
  else if (ctrl && key === 'd') duplicate();
  else if (ctrl && key === 'a') selectAll();
  else if (ctrl) return;
  else if (key === 'escape') {
    if (tool === 'path' && path.length) { path.length = 0; updatePreview(); }
    else if (tool === 'measure' && measure!.active) { measure!.clear(); render(); }
    else if (tool !== 'select') setTool('select');
    else { selection.clear(); sync(); }
  }
  else if (key === 'enter') { if (tool === 'path') finishPath(); if (tool === 'measure') { measure!.finish(); render(); } }
  else if (key === 'delete' || key === 'backspace') { if (tool === 'path' && path.length) { path.pop(); updatePreview(); } else remove(); }
  else if (key === 'q' || key === 'e') {
    const angle = (key === 'q' ? 1 : -1) * (event.shiftKey ? Math.PI / 2 : STEP);
    if (tool === 'place') { placeHeading += angle; if (ghost) ghost.rotation.y = placeHeading; render(); }
    else if (selection.size) edit(() => turn(angle));
  }
  else if (key.startsWith('arrow') && selection.size) nudge((key === 'arrowup' ? 1 : key === 'arrowdown' ? -1 : 0) * NUDGE * by, (key === 'arrowright' ? 1 : key === 'arrowleft' ? -1 : 0) * NUDGE * by);
  else if (key === 'g') element<HTMLInputElement>('grid').click();
  else if (key === 'f') frame();
  else if (key === 't') topView();
  else if (key === 'home') resetView();
  else if (TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);
  else return;
  event.preventDefault();
});
addEventListener('keyup', event => { if (event.key === ' ') { space = false; navigation(); } });

// ---- Tools and views -------------------------------------------------------------

const ICONS: Record<string, string> = {
  select: '<path d="M5 3l12 8-5 1.5L9.5 18z"/>',
  place: '<path d="M10 4v12M4 10h12"/><circle cx="10" cy="10" r="7.5"/>',
  path: '<path d="M3 16c4-1 4-11 8-11s3 9 6 9"/><circle cx="3" cy="16" r="1.4"/><circle cx="11" cy="5" r="1.4"/><circle cx="17" cy="14" r="1.4"/>',
  scatter: '<circle cx="10" cy="10" r="7.5" stroke-dasharray="2 2"/><circle cx="7" cy="8" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="13.5" cy="12" r="1"/>',
  terrain: '<path d="M2 16l5-8 3 4 2-3 6 7z"/><path d="M14 3v4M12 5l2-2 2 2"/>',
  measure: '<path d="M2.5 13.5l11-11 4 4-11 11z"/><path d="M6 10l1.5 1.5M8.5 7.5l1.5 1.5M11 5l1.5 1.5"/>',
  orbit: '<ellipse cx="10" cy="10" rx="8" ry="3.5"/><path d="M15 4.5l2.5 2-3 1"/><circle cx="10" cy="10" r="1.6"/>',
  pan: '<path d="M10 2v16M2 10h16M10 2l-2 2M10 2l2 2M10 18l-2-2M10 18l2-2M2 10l2-2M2 10l2 2M18 10l-2-2M18 10l-2 2"/>',
  frame: '<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><rect x="7" y="7" width="6" height="6"/>',
  top: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 6v8M6 10h8"/>',
  turn: '<path d="M16 10a6 6 0 1 1-2-4.5"/><path d="M14.5 2.5v3.5H11"/>',
  home: '<path d="M3 10l7-6 7 6M5 9v8h10V9"/>',
};
const TOOLS: [Tool, string, string][] = [
  ['select', 'Select and move (V)', 'Click to select, Shift-click to add, Ctrl-click to toggle, drag empty ground for a box · drag to move · drag the orange ring to turn (Alt: free), round the group centre or each in place · Q/E turn 15° (Shift 90°) · arrows nudge 10 cm (Shift 1 m) · Del removes · Ctrl+D duplicates · Ctrl+A selects all'],
  ['place', 'Place (A)', 'Pick an asset or tree on the left, then click the ground or a wall · Q/E turn before placing · Alt-click an object to pick up its asset · right-click or Esc stops'],
  ['path', 'Draw a row along a path (P)', 'Click points along the path · double-click or Enter places the row · Backspace removes the last point · Esc or right-click clears'],
  ['scatter', 'Scatter brush (B)', 'Drag over the ground to scatter the brush; nothing lands closer than the gap to its own kind · Alt-click picks up an object'],
  ['terrain', 'Shape the ground (U)', 'Drag over the ground to raise, lower, flatten (to the height where the stroke began), smooth, or reset it to the survey · objects and trees on the ground ride with it · edits fade out 5 m inside the square · keep away from refined buildings, whose models do not follow'],
  ['measure', 'Measure (I)', 'Click points along the ground for lengths on plan, height changes and slope · double-click or Enter ends · Esc clears'],
  ['orbit', 'Orbit view (R)', 'Drag to orbit · in any tool, hold Space or drag with the middle button to orbit, right-drag to pan, scroll to zoom'],
  ['pan', 'Pan view (H)', 'Drag to pan · scroll zooms toward the pointer'],
];
function showTools() {
  const bar = element('tools');
  bar.replaceChildren(...TOOLS.map(([id, label]) => {
    const b = Object.assign(document.createElement('button'), {type: 'button', title: label, className: tool === id ? 'on' : '', onclick: () => setTool(id)});
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(tool === id));
    b.innerHTML = `<svg viewBox="0 0 20 20">${ICONS[id]}</svg>`;
    return b;
  }));
  element('views').replaceChildren(...([['frame', 'Frame selection (F)', frame], ['top', 'Top view (T)', topView], ['turn', 'Turn view 45°', turnView], ['home', 'Reset view (Home)', resetView]] as [string, string, () => void][]).map(([id, label, run]) => {
    const b = Object.assign(document.createElement('button'), {type: 'button', title: label, onclick: run});
    b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 20 20">${ICONS[id]}</svg>`;
    return b;
  }));
  element('hint').textContent = TOOLS.find(t => t[0] === tool)![2];
}
function setTool(next: Tool) {
  if (tool === 'path' && next !== 'path') { path.length = 0; }
  tool = next;
  if (ghost) ghost.visible = false;
  showBrushRing(null);
  updatePreview();
  navigation();
  showTools();
  showOptions();
  if (loaded && site) sync();
}
function navigation() {
  const left = space || tool === 'orbit' ? THREE.MOUSE.ROTATE : tool === 'pan' ? THREE.MOUSE.PAN : null;
  controls.mouseButtons = {LEFT: left as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN};
  renderer.domElement.style.cursor = left === THREE.MOUSE.ROTATE ? 'grab' : left === THREE.MOUSE.PAN ? 'move' : tool === 'select' ? 'default' : 'crosshair';
}

function showOptions() {
  const bar = element('options'), parts: HTMLElement[] = [];
  const number = (label: string, key: 'spacing' | 'offset' | 'radius' | 'gap', step: number, min: number) => {
    const input = Object.assign(document.createElement('input'), {type: 'number', step: String(step), min: String(min), value: String(options[key])});
    input.onchange = () => { options[key] = Math.max(min, Number(input.value) || 0); updatePreview(); };
    return labelled(label, input);
  };
  if (tool === 'path') {
    const facing = document.createElement('select');
    for (const [v, t] of [['along', 'Along the path'], ['left', 'Facing left'], ['right', 'Facing right']]) facing.add(new Option(t, v));
    facing.value = options.facing;
    facing.onchange = () => { options.facing = facing.value; updatePreview(); };
    parts.push(number('Every m', 'spacing', .5, .2), labelled('Facing', facing), number('Offset m', 'offset', .25, -50));
  } else if (tool === 'scatter') {
    const spin = Object.assign(document.createElement('input'), {type: 'checkbox', checked: options.spin});
    spin.onchange = () => { options.spin = spin.checked; };
    parts.push(number('Radius m', 'radius', .5, .5), number('Gap m', 'gap', .25, .1), labelled('Random turn', spin));
  }
  else if (tool === 'terrain') {
    const shape = document.createElement('select');
    for (const [v, t] of [['raise', 'Raise'], ['lower', 'Lower'], ['flatten', 'Flatten'], ['smooth', 'Smooth'], ['reset', 'Reset to survey']]) shape.add(new Option(t, v));
    shape.value = options.shape;
    shape.onchange = () => { options.shape = shape.value as TerrainMode; showOptions(); };
    const amount = (label: string, key: 'lift' | 'blend', step: number, min: number, max: number) => {
      const input = Object.assign(document.createElement('input'), {type: 'number', step: String(step), min: String(min), max: String(max), value: String(options[key])});
      input.onchange = () => { options[key] = Math.min(max, Math.max(min, Number(input.value) || min)); };
      return labelled(label, input);
    };
    parts.push(labelled('Brush', shape), number('Radius m', 'radius', .5, .5),
      options.shape === 'raise' || options.shape === 'lower' ? amount('Per touch m', 'lift', .05, .01, 2) : amount('Strength 0–1', 'blend', .05, .05, 1));
  }
  else if (tool === 'select') {
    const inPlace = Object.assign(document.createElement('input'), {type: 'checkbox', checked: options.inPlace});
    inPlace.onchange = () => { options.inPlace = inPlace.checked; };
    parts.push(labelled('Turn each in place', inPlace));
  }
  if (['place', 'path', 'scatter'].includes(tool) && brush?.kind === 'tree') {
    const vary = Object.assign(document.createElement('input'), {type: 'checkbox', checked: options.vary});
    vary.title = 'Each tree gets its own height and crown, within a fifth of the brush size';
    vary.onchange = () => { options.vary = vary.checked; showGhost(); render(); };
    parts.push(labelled('Vary each tree', vary));
  }
  if (['place', 'path', 'scatter'].includes(tool)) parts.unshift(Object.assign(document.createElement('span'), {className: 'tip', textContent: brush ? `Brush: ${brush.kind === 'tree' ? `${brush.type === CONIFER ? 'conifer' : 'broadleaf'} tree` : brush.asset.name}` : 'Pick an asset or tree on the left'}));
  bar.replaceChildren(...parts);
}
const labelled = (text: string, control: HTMLElement) => { const l = document.createElement('label'); l.append(text, ' ', control); return l; };

function frame() {
  const list = treeList(), keys = selection.size ? [...selection] : [], anchors = keys.map(k => anchorOf(k, list)).filter(a => a !== null);
  if (!anchors.length) return resetView();
  const box = new THREE.Box3();
  for (const a of anchors) box.expandByPoint(a.at).expandByPoint(a.at.clone().setY(a.at.y + a.height));
  const centre = box.getCenter(new THREE.Vector3()), size = Math.max(4, box.getSize(new THREE.Vector3()).length());
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(centre);
  camera.position.copy(centre).addScaledVector(direction, size * 1.8);
  controls.update();
}
function topView() {
  const height = site!.square.size * 1.3;
  camera.position.set(controls.target.x, controls.target.y + height, controls.target.z + .01);
  controls.update();
}
function turnView() {
  camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).add(controls.target);
  controls.update();
}
function resetView() {
  if (!loaded || !site) return;
  const [ox, oz] = loaded.frame.origin, cx = site.square.centre[0] - ox, cz = site.square.centre[1] - oz, size = site.square.size, h = loaded.heights.at(cx, cz), y = h > -Infinity ? h : 0;
  controls.target.set(cx, y, cz);
  camera.position.set(cx - size * .55, y + size * .6, cz - size * .75);
  controls.update();
}

// ---- Panels ----------------------------------------------------------------------

const TREE_BRUSHES: {label: string; brush: Brush}[] = [
  {label: 'Broadleaf tree', brush: {kind: 'tree', type: BROADLEAF, h: 12, r: 3.5}},
  {label: 'Conifer', brush: {kind: 'tree', type: CONIFER, h: 14, r: 2.5}},
];
function showPalette() {
  const query = element<HTMLInputElement>('filter').value.toLowerCase(), palette = element('palette');
  const matches = (text: string) => !query || text.toLowerCase().includes(query);
  const keyOf = (a: AssetDefinition) => [a.id, a.name, a.category, ...a.tags].join(' ');
  const groups = new Map<string, HTMLElement[]>(), into = (name: string, row: HTMLElement) => groups.set(name, [...groups.get(name) ?? [], row]);
  for (const a of library) if (!a.retired && matches(keyOf(a)))
    into(a.category, item(a.name, a.id, brush?.kind === 'asset' && brush.asset === a, () => setBrush(brush?.kind === 'asset' && brush.asset === a ? null : {kind: 'asset', asset: a, variant: a.variants[0].id})));
  for (const t of TREE_BRUSHES) if (t.brush.kind === 'tree' && matches(t.label + ' tree vegetation')) {
    const type = t.brush.type;
    into('vegetation', item(t.label, `${t.brush.h} m tall`, brush?.kind === 'tree' && brush.type === type, () => setBrush(brush?.kind === 'tree' && brush.type === type ? null : {...t.brush})));
  }
  const sections = [...groups.keys()].sort().map(name => group(name, groups.get(name)!, !!query));
  const pending = drafts.filter(a => matches(keyOf(a))).map(a => {
    const row = item(a.name, a.id, brush?.kind === 'asset' && brush.asset === a, () => setBrush({kind: 'asset', asset: a, variant: a.variants[0].id}));
    const actions = Object.assign(document.createElement('span'), {className: 'actions'});
    actions.append(button('Approve', () => action(() => review(a, 'approve'))), button('Reject…', () => action(() => review(a, 'reject'))));
    row.append(actions);
    return row;
  });
  if (pending.length) sections.push(group('Drafts to review', pending, !!query));
  palette.replaceChildren(...sections);
  if (!sections.length) palette.append(Object.assign(document.createElement('p'), {textContent: 'Nothing matches.'}));
}

// Collapsed groups are remembered per browser; a search opens every group it matches.
const COLLAPSED = 'site-editor:collapsed';
const collapsed = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(COLLAPSED) ?? '[]') as string[]; } catch { return []; } })());
function group(name: string, rows: HTMLElement[], searching: boolean) {
  const section = Object.assign(document.createElement('details'), {className: 'group', open: searching || !collapsed.has(name)});
  const summary = document.createElement('summary');
  summary.append(Object.assign(document.createElement('span'), {textContent: name}), Object.assign(document.createElement('small'), {textContent: String(rows.length)}));
  section.append(summary, ...rows);
  section.ontoggle = () => {
    if (searching) return;
    if (section.open) collapsed.delete(name); else collapsed.add(name);
    try { localStorage.setItem(COLLAPSED, JSON.stringify([...collapsed])); } catch { /* private windows may refuse storage; the state then lasts the session */ }
  };
  return section;
}
const heading = (text: string) => Object.assign(document.createElement('h3'), {textContent: text});
const button = (text: string, onclick: () => void) => Object.assign(document.createElement('button'), {textContent: text, type: 'button', onclick});
function item(name: string, detail: string, active: boolean, onclick: () => void) {
  const row = document.createElement('div');
  row.className = 'asset' + (active ? ' active' : '');
  row.append(button(name, onclick), Object.assign(document.createElement('small'), {textContent: detail}));
  return row;
}
element('filter').oninput = showPalette;

function showSelection() {
  const panel = element('selection'), keys = [...selection];
  panel.hidden = !keys.length;
  if (!keys.length) return;
  const number = (value: number, step: number, onchange: (v: number) => void) => {
    const input = Object.assign(document.createElement('input'), {type: 'number', step: String(step), value: String(round(value, 2))});
    input.onchange = () => onchange(Number(input.value) || 0);
    return input;
  };
  const tools = [button('Turn −15°', () => edit(() => turn(-STEP))), button('Turn +15°', () => edit(() => turn(STEP))), button('Duplicate (Ctrl+D)', duplicate), button('Remove (Del)', remove)];
  if (keys.length > 1) {
    const objectsSelected = keys.filter(k => k.startsWith('p:')).length;
    panel.replaceChildren(heading(`${keys.length} selected`), Object.assign(document.createElement('p'), {textContent: `${objectsSelected} objects, ${keys.length - objectsSelected} trees`}), ...tools);
    return;
  }
  const p = placementOf(keys[0]);
  if (p) {
    const asset = assetById.get(p.asset)!, variant = document.createElement('select');
    for (const v of asset.variants) variant.add(new Option(v.label, v.id));
    variant.value = p.variant ?? asset.variants[0].id;
    variant.onchange = () => edit(() => { if (variant.value === asset.variants[0].id) delete p.variant; else p.variant = variant.value; });
    const angle = number(THREE.MathUtils.radToDeg(p.heading), 15, v => edit(() => setHeading(keys[0], THREE.MathUtils.degToRad(v))));
    angle.disabled = p.attach === 'wall';
    panel.replaceChildren(heading(asset.name), Object.assign(document.createElement('small'), {textContent: `${p.id} · ${asset.id}${drafts.includes(asset) ? ' · draft' : ''}`}),
      labelled('Variant', variant), labelled('Heading °', angle),
      Object.assign(document.createElement('p'), {textContent: p.attach === 'wall' ? `On a wall of building ${p.building}` : 'On the ground'}), ...tools);
    return;
  }
  const t = treeOf(keys[0])!.tree, type = document.createElement('select');
  type.add(new Option('Broadleaf', BROADLEAF));
  type.add(new Option('Conifer', CONIFER));
  type.value = t.type;
  const change = (patch: Partial<SiteTree>) => edit(() => { const key = own(keys[0]); Object.assign(edits().add.find(a => 'a:' + a.id === key)!, patch); treesChanged = true; });
  type.onchange = () => change({type: type.value});
  panel.replaceChildren(heading(keys[0].startsWith('s:') ? 'Survey tree' : 'Added tree'), Object.assign(document.createElement('small'), {textContent: keys[0]}),
    labelled('Kind', type), labelled('Height m', number(t.h, .5, v => change({h: Math.max(3, v)}))), labelled('Crown radius m', number(t.r, .25, v => change({r: Math.max(.5, v)}))),
    ...tools.slice(2));
}

function showStatus() {
  if (!site || !loaded) return;
  const previews = site.placements.filter(p => drafts.some(d => d.id === p.asset)).length, e = edits();
  status.textContent = `${site.placements.length} objects${previews ? ` (${previews} draft previews, not saved)` : ''} · trees +${e.add.length} −${e.remove.length}${dirty ? ' · unsaved changes' : ''} · ${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} draws`;
  element<HTMLButtonElement>('undo').disabled = !undo.length;
  element<HTMLButtonElement>('redo').disabled = !redo.length;
  element<HTMLButtonElement>('save').textContent = dirty ? 'Save •' : 'Save';
  element<HTMLButtonElement>('reset').disabled = snapshot() === opened;
}

// Draft previews let the owner judge a draft in place; they never reach the saved file.
async function save() {
  if (!site) return;
  const kept: PlacementSite = {...site, placements: site.placements.filter(p => !drafts.some(d => d.id === p.asset)), trees: edits()};
  if (!kept.trees!.add.length && !kept.trees!.remove.length) delete kept.trees;
  const deltas = terrain?.saved();
  if (deltas) kept.terrain = {deltas}; else delete kept.terrain;
  const response = await fetch('/__studio/sites/' + site.id, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(kept)});
  if (!response.ok) throw Error('Save failed: ' + (await response.json()).error);
  dirty = kept.placements.length !== site.placements.length;
  saved = dirty ? '' : snapshot();
  showStatus();
  status.textContent = `Saved to data/source/placements/${site.id}.json` + (dirty ? '; draft previews were left out' : '');
}

async function review(asset: AssetDefinition, verdict: 'approve' | 'reject') {
  let notes = '';
  if (verdict === 'reject') {
    notes = prompt(`What should change in ${asset.id}? The notes go to asset-drafts/${asset.id}/REVIEW.md for the agent.`) ?? '';
    if (!notes.trim()) return;
  } else if (!confirm(`Approve ${asset.id} into the library? Its id is then permanent.`)) return;
  const response = await fetch(`/__studio/assets/${asset.id}/${verdict}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({notes})});
  if (!response.ok) throw Error(`${verdict} failed: ` + (await response.json()).error);
  status.textContent = verdict === 'approve' ? `${asset.id} approved; reloading the library…` : `Notes saved to asset-drafts/${asset.id}/REVIEW.md`;
}

function lighting() {
  if (!sun || !loaded) return;
  const value = element<HTMLSelectElement>('light').value, centre = controls.target;
  // Early morning matches the atlas's default sun.
  const offset = new THREE.Vector3(...(value === 'morning' ? [-280, 150, -100] : value === 'late' ? [260, 170, -60] : [-40, 350, -100]) as THREE.Vector3Tuple).normalize();
  sun.color.set(value === 'midday' ? '#fff1dc' : '#ffd8b0');
  sun.position.copy(centre).addScaledVector(offset, 300);
  sun.target.position.copy(centre);
  sun.castShadow = element<HTMLInputElement>('shadows').checked;
  renderer.shadowMap.needsUpdate = true;
  render();
}
element('light').onchange = lighting;
element('shadows').onchange = lighting;
element('trees').onchange = () => { if (trees) { trees.group.visible = element<HTMLInputElement>('trees').checked; render(); } };
element('grid').onchange = () => render();
element('undo').onclick = () => step(undo, redo);
element('redo').onclick = () => step(redo, undo);
element('save').onclick = () => action(save);
element('reset').onclick = reset;
const action = (run: () => Promise<unknown>) => { void run().catch(e => { error.textContent = String(e instanceof Error ? e.message : e); }); };
addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });

// ---- Choosing a square -----------------------------------------------------------

// The map is drawn north up in the national grid, which the survey's own axes are not.
function chooseSquare(data: WorldData, sites: {id: string; square: Square}[]) {
  const dialog = element<HTMLDialogElement>('map'), canvas = element<HTMLCanvasElement>('chart'), x = canvas.getContext('2d')!;
  const [a, b, c, d, e, f] = data.geo.toGrid, [ox, oz] = city.frame.origin;
  const grid = ([sx, sz]: Point2): Point2 => [a * sx + b * sz + c, d * sx + e * sz + f];
  const source = ([gx, gy]: Point2): Point2 => { const det = a * e - b * d, px = gx - c, py = gy - f; return [(e * px - b * py) / det, (a * py - d * px) / det]; };
  const corners = data.buildings.flatMap(bd => bd.g).map(grid), es = corners.map(p => p[0]), ns = corners.map(p => p[1]);
  const view = {scale: Math.min(canvas.width / (Math.max(...es) - Math.min(...es)), canvas.height / (Math.max(...ns) - Math.min(...ns))) * .9, e: (Math.max(...es) + Math.min(...es)) / 2, n: (Math.max(...ns) + Math.min(...ns)) / 2};
  let centre: Point2 | null = site?.square.centre ?? null, drag: {x: number; y: number; e: number; n: number; moved: boolean} | null = null;
  const toCanvas = ([ge, gn]: Point2): Point2 => [canvas.width / 2 + (ge - view.e) * view.scale, canvas.height / 2 - (gn - view.n) * view.scale];
  const fromCanvas = (px: number, py: number): Point2 => [view.e + (px - canvas.width / 2) / view.scale, view.n - (py - canvas.height / 2) / view.scale];
  const outline = (points: Point2[]) => { x.beginPath(); points.map(grid).map(toCanvas).forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); };
  const squareOf = ([cx, cz]: Point2, s: number): Point2[] => [[cx - s / 2, cz - s / 2], [cx + s / 2, cz - s / 2], [cx + s / 2, cz + s / 2], [cx - s / 2, cz + s / 2]];
  function draw() {
    x.fillStyle = '#eef1ea';
    x.fillRect(0, 0, canvas.width, canvas.height);
    x.fillStyle = '#9aa196';
    for (const r of data.roads) if (r.kind === 'carriageway') { outline(r.ring.map(([px, , pz]): Point2 => [px + ox, pz + oz])); x.fill(); }
    x.fillStyle = '#c9a98b';
    x.strokeStyle = '#7d6a58';
    x.lineWidth = .5;
    for (const bd of data.buildings) { outline(bd.g); x.fill(); x.stroke(); }
    x.strokeStyle = '#2b6cb0';
    x.lineWidth = 1.5;
    for (const s of sites) { outline(squareOf(s.square.centre, s.square.size)); x.stroke(); }
    if (centre) {
      x.strokeStyle = '#e07b00';
      x.lineWidth = 2.5;
      outline(squareOf(centre, Number(element<HTMLSelectElement>('size').value)));
      x.stroke();
    }
    element('picked').textContent = centre ? `Centre ${centre.map(v => Math.round(v)).join(', ')}` : 'No square chosen';
    element<HTMLButtonElement>('open').disabled = !centre;
  }
  canvas.onwheel = event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect(), px = (event.clientX - rect.left) * canvas.width / rect.width, py = (event.clientY - rect.top) * canvas.height / rect.height, before = fromCanvas(px, py);
    view.scale *= event.deltaY < 0 ? 1.25 : .8;
    const after = fromCanvas(px, py);
    view.e += before[0] - after[0];
    view.n += before[1] - after[1];
    draw();
  };
  canvas.onpointerdown = event => { drag = {x: event.clientX, y: event.clientY, e: view.e, n: view.n, moved: false}; canvas.setPointerCapture(event.pointerId); };
  canvas.onpointermove = event => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect(), k = canvas.width / rect.width;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > CLICK) drag.moved = true;
    if (!drag.moved) return;
    view.e = drag.e - (event.clientX - drag.x) * k / view.scale;
    view.n = drag.n + (event.clientY - drag.y) * k / view.scale;
    draw();
  };
  canvas.onpointerup = event => {
    if (drag && !drag.moved) {
      const rect = canvas.getBoundingClientRect(), k = canvas.width / rect.width, picked = source(fromCanvas((event.clientX - rect.left) * k, (event.clientY - rect.top) * k));
      const existing = sites.find(s => Math.abs(s.square.centre[0] - picked[0]) <= s.square.size / 2 && Math.abs(s.square.centre[1] - picked[1]) <= s.square.size / 2);
      if (existing) element<HTMLSelectElement>('size').value = String(existing.square.size);
      centre = existing?.square.centre ?? [Math.round(picked[0]), Math.round(picked[1])];
      draw();
    }
    drag = null;
  };
  element('size').onchange = draw;
  dialog.onclose = () => {
    if (dialog.returnValue !== 'open' || !centre) return;
    if (dirty && !confirm('Leave this square without saving?')) return;
    dirty = false;
    location.search = new URLSearchParams({x: String(centre[0]), z: String(centre[1]), size: element<HTMLSelectElement>('size').value}).toString();
  };
  draw();
  dialog.showModal();
}

async function open(square: Square) {
  const data = await world, id = `${square.centre[0]}_${square.centre[1]}_${square.size}`;
  loaded = await loadSquare(data, await survey, square, renderer, text => { status.textContent = text; });
  const response = await fetch('/__studio/sites/' + id);
  site = response.ok ? await response.json() as PlacementSite : {version: 1, id, square, placements: []};
  const missing = site.placements.filter(p => !assetById.has(p.asset));
  if (missing.length) error.textContent = `Not shown, unknown assets: ${[...new Set(missing.map(p => p.asset))].join(', ')}`;
  site.placements = site.placements.filter(p => assetById.has(p.asset));
  const {scene, frame} = loaded, [ox, oz] = frame.origin;
  // The built data holds this square's added trees from the last data build; they
  // are drawn from the edits instead. Trees can only be added inside their square.
  loaded.trees = loaded.trees.filter(t => !t.added || !inSquare(t.p[0] - ox, t.p[1] - oz));
  const low: Point2 = [square.centre[0] - ox - square.size / 2, square.centre[1] - oz - square.size / 2];
  const baked: Record<string, number[]> = await fetch('/data/terrain.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
  built = new TerrainEdit(...low, square.size, baked[id]);
  terrain = new TerrainEdit(...low, square.size, site.terrain?.deltas);
  if (JSON.stringify(terrain.saved()) !== JSON.stringify(built.saved())) { reshape(); settle(); }
  opened = saved = snapshot();
  trees = new TreeLayer(scene, frame, new THREE.Vector3(square.centre[0] - ox, 0, square.centre[1] - oz));
  treesChanged = true;
  measure = new Measure(scene, element('labels'));
  scene.add(placed, highlights, preview, ring, brushRing);
  scene.add(new THREE.HemisphereLight('#e6efff', '#73775c', 1.1));
  sun = new THREE.DirectionalLight('#ffd8b0', 2.2);
  const reach = square.size / 2 + 30;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 800});
  sun.shadow.bias = -.0002;
  sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  scene.add(squareOutline(square, loaded));
  resetView();
  lighting();
  element('where').textContent = `Square ${square.size} m at ${square.centre.join(', ')} · ${id}.json`;
  element<HTMLAnchorElement>('atlas').href = `/#x=${(square.centre[0] - ox).toFixed(1)}&y=6&z=${(square.centre[1] - oz).toFixed(1)}&s=120&zoom=1&h=140&e=35`;
  sync();
  resize();
}

function squareOutline(square: Square, scene: Loaded) {
  const [ox, oz] = scene.frame.origin, [cx, cz] = square.centre, half = square.size / 2, points: THREE.Vector3[] = [];
  const corners: Point2[] = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half], [cx - half, cz - half]];
  let last = 0;
  for (let k = 0; k < 4; k++) for (let t = 0; t < square.size; t += 1) {
    const x = corners[k][0] + (corners[k + 1][0] - corners[k][0]) * t / square.size - ox, z = corners[k][1] + (corners[k + 1][1] - corners[k][1]) * t / square.size - oz;
    const h = scene.heights.at(x, z);
    if (h > -Infinity) last = h;
    points.push(new THREE.Vector3(x, last + .15, z));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: '#e07b00'}));
}

element('choose').onclick = () => action(async () => {
  const sites = await (await fetch('/__studio/sites')).json() as {id: string; square: Square}[];
  chooseSquare(await world, sites);
});

// For capture scripts and debugging, as window.studio in the building studio.
Object.assign(window, {site: {
  get loaded() { return loaded; }, get placements() { return site?.placements; }, get trees() { return site && edits(); },
  get selection() { return [...selection]; }, get tool() { return tool; }, setTool, camera, controls, render,
}});

showTools();
showOptions();
navigation();
showPalette();
action(async () => {
  const x = Number(params.get('x')), z = Number(params.get('z')), size = Number(params.get('size'));
  if (params.has('x') && Number.isFinite(x) && Number.isFinite(z) && [50, 100, 200].includes(size)) await open({centre: [x, z], size});
  else {
    status.textContent = 'Choose a square to edit';
    element('choose').click();
  }
});
