import {installLanguage, translate} from './i18n.ts';
import {installMenus} from './ui/menu.ts';
import {installScrollbars} from './ui/scroll.ts';
import {installTips} from './ui/tip.ts';
/// <reference types="vite/client" />
import * as THREE from 'three';
import {buildingShadows, setShadowCoverage, shadowDistance} from '../engine/lighting/sun.ts';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {useBlenderOrbit} from './blender-orbit.ts';
import {editables} from './editables.ts';
import {mountToolbox} from './toolbox/panel.ts';
import {mountPlacement} from './toolbox/placement.ts';
import {toolboxItems} from './toolbox/items/index.ts';
import type {ToolboxItem} from './toolbox/item.ts';
import {useWalk} from './walk.ts';
import {mountPlan} from './plan.ts';
import {buildStudyGrid} from './grid.ts';
import {acceleratePick} from './edit/pick.ts';
import {readSetup, writeSetup, type CameraSetup, type FolderSetup, type StudioSetup} from './prefs.ts';
import {mountPartEditor} from './edit/parts.ts';
import {bindStudioHost} from './mcp/bind.ts';
import {connectStudio, paintMcp, type McpStatus} from './mcp/link.ts';
import {objectId, objectLabel} from './edit/group.ts';
import {disposeDraw, markDrawStructure, syncDraw} from './edit/draw.ts';
import {applyParts, diffParts, rememberParts, type HistoryLog, type PartVersion} from './edit/version.ts';
import {mountExplorer} from './edit/explorer.ts';
import {city} from './project.ts';
import {drawRecord, sameRecord} from './inspector.ts';
import {buildStudy, stages, label} from './studies.ts';
import type {OverrideContext} from '../engine/types.ts';
import type {WorldData} from '../engine/data.ts';
import './style.css';

addEventListener('contextmenu', event => event.preventDefault(), true);
const disposeLanguage = installLanguage();
const disposeMenus = installMenus();
const disposeScroll = installScrollbars();
const disposeTips = installTips();
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const building = element<HTMLSelectElement>('building'), mode = element<HTMLSelectElement>('mode');
const list = element<HTMLDivElement>('list'), fields = element<HTMLDivElement>('fields'), note = element<HTMLParagraphElement>('record-note');
const picker = element<HTMLDivElement>('picker'), hint = element<HTMLSpanElement>('hint');
const orbitHint = '';
const main = document.querySelector('main')!, status = element<HTMLOutputElement>('status'), cost = element<HTMLOutputElement>('cost'), error = element<HTMLParagraphElement>('error');
status.textContent = translate('Loading…');
const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.classList.add('capture');
let buildings: WorldData['buildings'] = [];
const drafts = new Map<string, Record<string, unknown>>(), saved = new Map<string, string>();
const localEdits = new Map<string, PartVersion[]>(), editsLoaded = new Set<string>();
let born = rememberParts(new THREE.Group());
let incomingHistory: HistoryLog | null = null;
let readHistory = (): HistoryLog => ({cursor: -1, steps: []});
let writeHistory = (_log: HistoryLog) => {};
let selectionFacts = {count: 0, labels: [] as string[], extra: 0, id: '', size: '', center: '', editCount: 0, editTotal: 0};
let modelVerts = 0, drawnTriangles = 0, drawnCalls = 0;
let readMode = (): 'translate' | 'rotate' | 'scale' => 'translate';
function paintStatus() {
  const distance = translate(`${camera.position.distanceTo(controls.target).toFixed(1)} m`);
  const history = selectionFacts.editTotal ? translate(selectionFacts.editCount === selectionFacts.editTotal ? `${selectionFacts.editTotal} edits` : `${selectionFacts.editCount}/${selectionFacts.editTotal} edits`) : '';
  if (!selectionFacts.count) { status.textContent = [translate('No selection'), history, distance].filter(Boolean).join(' · '); return; }
  const names = selectionFacts.labels.join(', ') + (selectionFacts.extra ? ` +${selectionFacts.extra}` : '');
  const mode = translate(readMode() === 'rotate' ? 'Rotate' : readMode() === 'scale' ? 'Scale' : 'Move');
  status.textContent = [translate(`${selectionFacts.count} selected`), names, selectionFacts.id, selectionFacts.size ? translate(selectionFacts.size) : '', selectionFacts.center ? translate(`Centre ${selectionFacts.center}`) : '', mode, history, distance].filter(Boolean).join(' · ');
}
function countVerts(root: THREE.Object3D) {
  let count = 0;
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || node.userData.fit) return;
    const position = node.geometry.getAttribute('position');
    if (position) count += position.count;
  });
  return count;
}
function paintCost(triangles: number, draws: number) {
  drawnTriangles = triangles; drawnCalls = draws;
  const num = (value: number) => value.toLocaleString('en-US');
  cost.textContent = [translate(`${num(triangles)} rendered triangles`), translate(`${num(modelVerts)} corners`), translate(`${num(draws)} draws`)].join(' · ');
}
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#e3e8df');
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
main.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 2000), controls = new OrbitControls(camera, renderer.domElement);
const gridScene = new THREE.Scene();
controls.enableDamping = false; controls.maxDistance = 1200;
controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
useBlenderOrbit(controls);
const neutral = new THREE.MeshStandardMaterial({color: '#c8cbc2', roughness: 1});
let current: Awaited<ReturnType<typeof buildStudy>> | undefined, sun: THREE.DirectionalLight | undefined;
let studyGrid: THREE.Group | null = null, gridOn = false;
let setup: StudioSetup = readSetup(), activeId = '';
let generation = 0, disposed = false, radius = 40, ready = false, timer = 0, shown = '', persist = false, rememberTimer = 0;
let armed: ToolboxItem | null = null;
let refreshParts = () => {};
let shadowKey = '', shadowTimer = 0;
const centre = new THREE.Vector3(), sunOffset = new THREE.Vector3(-25, 80, -35);
const world = fetch('/data/world.json').then(async response => { if (!response.ok) throw Error('Build data first: npm run data'); return await response.json() as WorldData; });
const checked = (id: string) => element<HTMLInputElement>(id).checked;

function render(shadow = false) {
  if (!current || !sun || disposed) return;
  const why = syncDraw(current.scene, current.root);
  if (why === 'rebuild' || !modelVerts) modelVerts = countVerts(current.root);
  current.ground.visible = checked('ground'); current.scene.overrideMaterial = checked('plain') ? neutral : null;
  sun.castShadow = checked('shadows');
  const lightKey = `${centre.x},${centre.y},${centre.z}|${sunOffset.x},${sunOffset.y},${sunOffset.z}|${radius}|${sun.castShadow}`;
  const lightChanged = lightKey !== shadowKey;
  if (lightChanged) { sun.target.position.copy(centre); sun.position.copy(centre).addScaledVector(sunOffset.clone().normalize(), shadowDistance(sun.shadow.camera.right)); shadowKey = lightKey; }
  if (why === 'rebuild' || lightChanged || shadow) { window.clearTimeout(shadowTimer); renderer.shadowMap.needsUpdate = true; }
  else if (why === 'edit') { window.clearTimeout(shadowTimer); shadowTimer = window.setTimeout(() => render(true), 160); }
  renderer.render(current.scene, camera);
  const drawn = renderer.info.render.triangles, draws = renderer.info.render.calls;
  // Plain materials replace every material in the study scene. The grid is drawn afterwards so its colour and the depth already in the frame stay.
  if (studyGrid) { renderer.autoClear = false; renderer.render(gridScene, camera); renderer.autoClear = true; }
  plan.paint();
  paintStatus();
  paintCost(drawn, draws);
}
function resize() { const {width, height} = main.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); render(); }
const observer = new ResizeObserver(resize); observer.observe(main); controls.addEventListener('change', () => { render(); remember(); });
function view(angle = 0, distance = Number(element<HTMLSelectElement>('distance').value), elevation = 25) {
  const h = THREE.MathUtils.degToRad(angle), e = THREE.MathUtils.degToRad(elevation), d = radius * 3 * distance;
  controls.target.copy(centre); camera.position.copy(centre).add(new THREE.Vector3(Math.sin(h) * Math.cos(e), Math.sin(e), Math.cos(h) * Math.cos(e)).multiplyScalar(d));
  camera.up.set(0, 1, 0); controls.update(); render();
}
function lighting() {
  const value = element<HTMLSelectElement>('light').value;
  sunOffset.set(...(value === 'morning' ? [65, 30, -50] : value === 'late' ? [-65, 20, 25] : [-25, 80, -35]) as [number, number, number]); render(); remember();
}
function modes(preferred = mode.value) {
  mode.replaceChildren();
  for (const stage of stages(building.value)) mode.add(new Option(stage.label, stage.id));
  mode.value = [...mode.options].some(o => o.value === preferred) ? preferred : [...mode.options].some(o => o.value === 'draft') ? 'draft' : [...mode.options].some(o => o.value === 'assembled') ? 'assembled' : 'survey';
}
function fillList() {
  list.replaceChildren();
  for (const option of building.options) {
    if (option.hidden) continue;
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = option.text; button.className = option.value === building.value ? 'on' : '';
    button.onclick = () => { picker.hidden = true; element<HTMLButtonElement>('studio-title').setAttribute('aria-expanded', 'false'); building.value = option.value; building.onchange?.(new Event('change')); };
    list.append(button);
  }
}
async function draft(id: string) {
  const editable = editables.get(id);
  if (!editsLoaded.has(id) || (editable && !drafts.has(id))) {
    let record: {design?: Record<string, unknown>; edits?: PartVersion[]} | null = null;
    try {
      const response = await fetch('/__studio/buildings/' + id);
      if (response.ok) record = await response.json();
    } catch { /* A static preview has no save endpoint; the source model still shows. */ }
    if (!editsLoaded.has(id)) {
      localEdits.set(id, Array.isArray(record?.edits) ? record.edits : []);
      editsLoaded.add(id);
    }
    if (editable && !drafts.has(id)) {
      const design = record?.design && typeof record.design === 'object' ? record.design : structuredClone(editable.source) as Record<string, unknown>;
      drafts.set(id, design);
      if (!saved.has(id)) saved.set(id, JSON.stringify(design));
    }
  }
  return drafts.get(id);
}
function unsaved(id: string) {
  const design = drafts.get(id), editable = editables.get(id);
  return !!design && !!editable && JSON.stringify(design) !== (saved.get(id) ?? JSON.stringify(editable.source));
}
function showRecord(force = false) {
  const editable = editables.get(building.value), design = drafts.get(building.value);
  const edited = unsaved(building.value);
  note.hidden = false;
  note.textContent = !editable || !design
    ? 'This building is drawn by its source model. There is no separate record to edit yet.'
    : edited
      ? 'Unsaved changes rebuild the source generator in this view. Save record writes data/source/buildings.'
      : 'These fields feed the same generator as the atlas. Save record stores a copy in data/source/buildings; the atlas still uses the source model.';
  if (!force && shown === building.value) return;
  shown = building.value;
  if (!editable || !design) { fields.replaceChildren(); return; }
  drawRecord(fields, design, () => {
    if (mode.value !== 'assembled') mode.value = 'assembled';
    window.clearTimeout(timer); timer = window.setTimeout(() => action(() => load(false)), 350);
  });
}
async function load(reset = true) {
  const ticket = ++generation; ready = false; error.textContent = ''; status.textContent = translate('Building…');
  try {
    const id = building.value, design = await draft(id);
    const editable = editables.get(id);
    const custom = editable && design && !sameRecord(design, editable.source) ? (context: OverrideContext) => editable.build(context, design) : undefined;
    const next = await buildStudy(await world, id, mode.value, custom);
    if (ticket !== generation || disposed) { next.dispose(); return; }
    disposeDraw(); sun?.shadow.map?.dispose(); dropGrid(); current?.dispose(); current = next; parts.clear();
    born = rememberParts(next.root);
    if (incomingHistory) { writeHistory(incomingHistory); incomingHistory = null; }
    else applyParts(next.root, localEdits.get(id) ?? []);
    markDrawStructure();
    acceleratePick(next.root);
    centre.copy(next.bounds.getCenter(new THREE.Vector3())); radius = Math.max(10, next.bounds.getSize(new THREE.Vector3()).length() / 2);
    next.scene.add(new THREE.HemisphereLight(0xe5edf2, 0x7b775e, 1.65));
    sun = new THREE.DirectionalLight(0xfff4df, 3);
    const mapSize = Math.min(renderer.capabilities.maxTextureSize, buildingShadows.mapSize);
    sun.shadow.mapSize.set(mapSize, mapSize);
    sun.shadow.bias = buildingShadows.bias;
    sun.shadow.normalBias = buildingShadows.normalBias;
    sun.shadow.radius = buildingShadows.filterRadius;
    setShadowCoverage(sun, Math.max(buildingShadows.radius, radius));
    next.scene.add(sun, sun.target); next.textures(checked('textures'));
    refreshParts();
    element<HTMLOutputElement>('where').textContent = buildings.find(s => s.id === id)?.name ?? '';
    const record = buildings.find(s => s.id === id);
    const [ox, oz] = city.frame.origin;
    const framed = setup.plans[id];
    plan.use({view: setup.planView || framed?.view, look: setup.planLook || framed?.look, panX: framed?.panX ?? 0, panY: framed?.panY ?? 0, zoom: framed?.zoom ?? 1});
    plan.setStudy(record ? {root: next.root, footprint: record.g.map(([x, z]) => [x - ox, z - oz] as [number, number])} : null);
    syncGrid();
    showRecord(); fillList();
    activeId = id;
    if (reset && !applyStoredCamera(id)) view();
    resize(); ready = true; remember();
  } catch (e) { if (ticket === generation) { error.textContent = String(e); status.textContent = translate('Study failed'); } throw e; }
}
const round = (value: number) => String(Math.round(value * 100) / 100);
function saveView() {
  if (params.has('capture')) return location.href;
  captureSetup();
  const query = new URLSearchParams({building: building.value, mode: mode.value, light: element<HTMLSelectElement>('light').value, position: camera.position.toArray().map(round).join(','), target: controls.target.toArray().map(round).join(',')});
  for (const id of ['shadows', 'textures', 'plain', 'ground']) query.set(id, String(checked(id)));
  const next = '?' + query;
  if (next !== location.search) history.replaceState(null, '', next);
  return location.href;
}
function finiteTriple(value: number[] | undefined): value is [number, number, number] {
  return !!value && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
}
function applyStoredCamera(id: string) {
  const saved: CameraSetup | undefined = setup.cameras[id];
  if (!finiteTriple(saved?.position) || !finiteTriple(saved?.target)) return false;
  camera.position.fromArray(saved.position);
  controls.target.fromArray(saved.target);
  controls.update();
  return true;
}
function remember() {
  if (!persist) return;
  window.clearTimeout(rememberTimer);
  rememberTimer = window.setTimeout(saveView, 300);
}
const action = (run: () => Promise<unknown>) => { void run().catch(e => { error.textContent = String(e); }); };
building.onchange = () => { captureSetup(); modes(''); action(() => load()); };
element<HTMLInputElement>('search').oninput = event => {
  const query = (event.target as HTMLInputElement).value.toLowerCase();
  for (const option of building.options) option.hidden = !option.text.toLowerCase().includes(query);
  fillList();
};
mode.onchange = () => { captureSetup(); action(() => load(false)); };
element('reload').onclick = () => { captureSetup(); action(() => load(false)); };
element('home').onclick = () => view();
const cheats = element<HTMLDivElement>('cheats');
const cheatNote = element<HTMLParagraphElement>('cheat-note');
let hoverNote: string | null = null;
let contextNote: string | null = null;
const paintNote = () => {
  const text = cheats.hasAttribute('hidden') ? null : (hoverNote || contextNote);
  cheatNote.hidden = !text;
  if (text) cheatNote.textContent = translate(text);
};
const noteTarget = (event: Event) => event.target instanceof Element ? event.target.closest<HTMLElement>('[data-note]') : null;
document.addEventListener('pointerover', event => {
  const target = noteTarget(event);
  if (!target?.dataset.note) return;
  hoverNote = target.dataset.note;
  paintNote();
});
document.addEventListener('pointerout', event => {
  if (!noteTarget(event)) return;
  const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-note]') : null;
  if (next) return;
  hoverNote = null;
  paintNote();
});
const hints = element<HTMLButtonElement>('hints');
hints.onclick = () => {
  const on = cheats.hasAttribute('hidden');
  cheats.toggleAttribute('hidden', !on);
  hints.classList.toggle('on', on);
  hints.setAttribute('aria-pressed', String(on));
  paintNote();
  remember();
};
element('distance').onchange = () => { view(); remember(); }; element('light').onchange = lighting;
for (const id of ['shadows', 'plain', 'ground']) element(id).onchange = () => { render(); remember(); };
element('textures').onchange = () => { current?.textures(checked('textures')); render(); remember(); };
element('save-view').onclick = saveView;
element('revert').onclick = () => {
  const editable = editables.get(building.value);
  if (!editable) return;
  drafts.set(building.value, structuredClone(editable.source) as Record<string, unknown>);
  shown = '';
  action(() => load(false));
};
const mcp = element<HTMLButtonElement>('mcp');
const mcpPop = element<HTMLDivElement>('mcp-pop');
mcp.textContent = 'MCP';
const fileButton = element<HTMLButtonElement>('file-menu');
const filePop = element<HTMLDivElement>('file-pop');
const closeFile = () => { filePop.hidden = true; fileButton.setAttribute('aria-expanded', 'false'); };
const closeMcp = () => { mcpPop.hidden = true; mcp.setAttribute('aria-expanded', 'false'); };
const openPop = (button: HTMLButtonElement, pop: HTMLDivElement) => {
  const rect = button.getBoundingClientRect();
  pop.hidden = false;
  pop.style.left = `${rect.left}px`;
  pop.style.top = `${rect.bottom + 4}px`;
  button.setAttribute('aria-expanded', 'true');
};
fileButton.onclick = () => {
  if (!filePop.hidden) { closeFile(); return; }
  closeMcp();
  openPop(fileButton, filePop);
};
mcp.onclick = () => {
  if (!mcpPop.hidden) { closeMcp(); return; }
  closeFile();
  openPop(mcp, mcpPop);
};
addEventListener('pointerdown', event => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!filePop.hidden && !filePop.contains(target) && !fileButton.contains(target)) closeFile();
  if (!mcpPop.hidden && !mcpPop.contains(target) && !mcp.contains(target)) closeMcp();
}, true);
addEventListener('keydown', event => {
  if (event.code !== 'Escape' || (filePop.hidden && mcpPop.hidden)) return;
  closeFile();
  closeMcp();
  event.preventDefault();
  event.stopPropagation();
}, true);
function versionRecord() {
  const id = building.value;
  const design = drafts.get(id);
  const edits = current ? diffParts(current.root, born) : [];
  const history = readHistory();
  if (!design && !edits.length && history.cursor < 0) throw Error('Nothing to save');
  return {version: 1, id, ...(design ? {design} : {}), edits, history, savedAt: new Date().toISOString()};
}
async function saveBuilding() {
  const id = building.value;
  const design = drafts.get(id);
  const edits = current ? diffParts(current.root, born) : [];
  const history = readHistory();
  if (!design && !edits.length && history.cursor < 0) return {error: 'Nothing to save'};
  const record = versionRecord();
  const response = await fetch('/__studio/buildings/' + id, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(record)});
  if (!response.ok) return {error: 'Save failed'};
  localEdits.set(id, record.edits);
  if (design) saved.set(id, JSON.stringify(design));
  return {saved: id};
}
function exportVersion() {
  closeFile();
  const record = versionRecord();
  const file = new Blob([JSON.stringify(record, null, 2) + '\n'], {type: 'application/json'});
  const link = document.createElement('a');
  link.download = record.id + '-local.json';
  link.href = URL.createObjectURL(file);
  link.click();
  URL.revokeObjectURL(link.href);
  status.textContent = translate('Exported a local file. The city atlas was not changed.');
}
function importVersion(file: File) {
  closeFile();
  return file.text().then(async text => {
    const record = JSON.parse(text) as {version?: number; id?: string; design?: Record<string, unknown>; edits?: PartVersion[]; history?: HistoryLog};
    if (record.version !== 1 || record.id !== building.value || !Array.isArray(record.edits)) throw Error('Not a version of this building');
    if (record.design && typeof record.design === 'object') { drafts.set(record.id, record.design); shown = ''; }
    localEdits.set(record.id, record.edits);
    editsLoaded.add(record.id);
    incomingHistory = record.history && Array.isArray(record.history.steps) ? record.history : null;
    await load(false);
    status.textContent = translate('Imported a local file. The city atlas was not changed.');
  });
}
element('save-record').onclick = () => action(async () => exportVersion());
element('export-version').onclick = () => action(async () => exportVersion());
element('import-version').onclick = () => { closeFile(); element<HTMLInputElement>('import-file').click(); };
element<HTMLInputElement>('import-file').onchange = event => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) action(() => importVersion(file));
};
element('capture').onclick = () => { render(); const a = document.createElement('a'); a.download = `study-${building.value}-${Date.now()}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); };

const stopWalk = useWalk(camera, controls);
const plan = mountPlan(main, element('plan'), () => camera, remember);
function dropGrid() {
  if (!studyGrid) return;
  studyGrid.traverse(object => {
    const line = object as THREE.LineSegments;
    line.geometry?.dispose();
    (line.material as THREE.Material | undefined)?.dispose?.();
  });
  studyGrid.removeFromParent();
  studyGrid = null;
}
function syncGrid() {
  dropGrid();
  if (!gridOn || !current) return;
  const record = buildings.find(item => item.id === building.value);
  const [ox, oz] = city.frame.origin;
  const footprint = record ? record.g.map(([x, z]) => [x - ox, z - oz] as [number, number]) : [];
  studyGrid = buildStudyGrid(current.root, footprint, current.root.position.y);
  gridScene.add(studyGrid);
}
const gridButton = element<HTMLButtonElement>('grid');
gridButton.onclick = () => {
  gridOn = !gridOn;
  gridButton.classList.toggle('on', gridOn);
  gridButton.setAttribute('aria-pressed', String(gridOn));
  syncGrid();
  render();
  remember();
};
const explorerButton = element<HTMLButtonElement>('explorer-toggle');
explorerButton.onclick = () => {
  const aside = element('explorer');
  aside.hidden = !aside.hidden;
  explorerButton.classList.toggle('on', !aside.hidden);
  explorerButton.setAttribute('aria-pressed', String(!aside.hidden));
  remember();
};
const toolboxButton = element<HTMLButtonElement>('toolbox-toggle');
toolboxButton.onclick = () => {
  const aside = element('toolbox');
  aside.hidden = !aside.hidden;
  toolboxButton.classList.toggle('on', !aside.hidden);
  toolboxButton.setAttribute('aria-pressed', String(!aside.hidden));
  remember();
};
const placed: {drop(ids: string[]): void; restore(parts: {id: string; item: string; position: THREE.Vector3; quaternion: THREE.Quaternion}[]): void} = {drop() {}, restore() {}};
mountToolbox(element('toolbox'), toolboxItems, item => {
  armed = item;
  hint.textContent = item?.hint ?? orbitHint;
});
let syncExplorer = () => {};
let nameInExplorer = (_obj: THREE.Object3D) => {};
const frame = (objects: THREE.Object3D[]) => {
  const box = new THREE.Box3();
  for (const obj of objects) box.expandByObject(obj);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(.6, box.getSize(new THREE.Vector3()).length() / 2);
  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() < 1e-4) offset.set(1, .4, 1);
  const dist = Math.max(offset.length(), radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.35);
  controls.target.copy(center);
  camera.position.copy(center).add(offset.normalize().multiplyScalar(dist));
  controls.update();
  render();
};
const parts = mountPartEditor({
  dom: renderer.domElement, camera, controls, redraw: render, armed: () => armed,
  study: () => current && {scene: current.scene, root: current.root},
  setHint: text => { hint.textContent = text ?? orbitHint; },
  setNote: text => { const next = text || null; if (next === contextNote) return; contextNote = next; paintNote(); },
  setActions: rows => {
    cheats.replaceChildren(...rows.map(row => {
      const line = document.createElement('div');
      line.dataset.note = row.note;
      const name = document.createElement('span');
      name.textContent = row.label;
      const keys = document.createElement('kbd');
      keys.dataset.noI18n = '';
      keys.textContent = row.keys;
      line.append(name, keys);
      return line;
    }));
  },
  historyHost: element('toolbox'), placement: placed, onChange: () => { syncExplorer(); plan.mark(parts.selected()); describeSelection(); }, frame,
  nameObject: obj => nameInExplorer(obj),
  onSetup: remember,
  caption: () => {
    const name = buildings.find(item => item.id === building.value)?.name ?? building.value;
    const stage = stages(building.value).find(item => item.id === mode.value)?.label ?? mode.value;
    return `${name} (${building.value}), ${stage}`;
  },
});
readHistory = () => parts.historySnapshot();
writeHistory = log => parts.installHistory(log);
readMode = () => parts.mode();
function describeSelection() {
  const list = parts.selected();
  const history = readHistory();
  const box = new THREE.Box3();
  for (const obj of list) box.expandByObject(obj);
  const size = box.isEmpty() ? '' : box.getSize(new THREE.Vector3()).toArray().sort((a, b) => b - a).map(value => value.toFixed(2)).join(' × ') + ' m';
  const center = !current || box.isEmpty() ? '' : `(${current.root.worldToLocal(box.getCenter(new THREE.Vector3())).toArray().map(value => value.toFixed(2)).join(', ')})`;
  const labels = [...new Set(list.map(objectLabel))];
  const id = list.length === 1 ? objectId(list[0]) : '';
  selectionFacts = {count: list.length, labels: labels.slice(0, 3), extra: Math.max(0, labels.length - 3), id: /([^/]+\.ts:\d+(?:#\d+)?)$/.exec(id)?.[1] ?? id, size, center, editCount: Math.max(0, history.cursor + 1), editTotal: history.steps.length};
  paintStatus();
}
const explorer = mountExplorer({
  host: element('explorer'),
  study: () => current && {root: current.root},
  itemName: id => toolboxItems.find(item => item.id === id)?.name ?? id,
  selected: parts.selected, choose: parts.choose, rename: parts.rename, hide: parts.hide, show: parts.show, lock: parts.lock, frame,
  onMenu: parts.openMenu, onCreate: parts.openCreate, onLayout: remember,
});
syncExplorer = explorer.sync;
nameInExplorer = explorer.editName;
function captureSetup() {
  if (activeId && current) {
    const frame = plan.frame();
    setup.planView = frame.view;
    setup.planLook = frame.look;
    setup.plans[activeId] = {view: frame.view, look: frame.look, panX: frame.panX, panY: frame.panY, zoom: frame.zoom};
    setup.cameras[activeId] = {position: camera.position.toArray(), target: controls.target.toArray()};
    setup.folders[activeId] = explorer.layout();
  }
  const frame = plan.frame();
  setup.plan = frame.open;
  setup.planView = frame.view;
  setup.planLook = frame.look;
  setup.grid = gridOn;
  setup.toolbox = !element('toolbox').hidden;
  setup.explorer = !element('explorer').hidden;
  setup.hints = !cheats.hasAttribute('hidden');
  setup.distance = element<HTMLSelectElement>('distance').value;
  setup.light = element<HTMLSelectElement>('light').value;
  setup.shadows = checked('shadows');
  setup.textures = checked('textures');
  setup.plain = checked('plain');
  setup.ground = checked('ground');
  setup.gizmo = parts.mode();
  setup.building = building.value;
  setup.mode = mode.value;
  writeSetup(setup);
}
function setPanel(id: 'toolbox' | 'explorer', buttonId: string, open: boolean) {
  const aside = element(id);
  aside.hidden = !open;
  const button = element<HTMLButtonElement>(buttonId);
  button.classList.toggle('on', open);
  button.setAttribute('aria-pressed', String(open));
}
function applyChrome() {
  if (!params.has('light')) element<HTMLSelectElement>('light').value = setup.light;
  for (const id of ['shadows', 'textures', 'plain', 'ground'] as const) if (!params.has(id)) element<HTMLInputElement>(id).checked = setup[id];
  if (setup.distance === '1' || setup.distance === '2' || setup.distance === '4') element<HTMLSelectElement>('distance').value = setup.distance;
  setPanel('toolbox', 'toolbox-toggle', setup.toolbox);
  setPanel('explorer', 'explorer-toggle', setup.explorer);
  cheats.toggleAttribute('hidden', !setup.hints);
  hints.classList.toggle('on', setup.hints);
  hints.setAttribute('aria-pressed', String(setup.hints));
  gridOn = setup.grid;
  gridButton.classList.toggle('on', gridOn);
  gridButton.setAttribute('aria-pressed', String(gridOn));
  plan.setOpen(setup.plan);
  lighting();
}
const placement = mountPlacement({
  dom: renderer.domElement, camera, items: toolboxItems, redraw: render,
  study: () => current && {scene: current.scene, root: current.root},
  buildingId: () => building.value,
  armed: () => armed, audit: parts.audit,
});
refreshParts = placement.refresh;
placed.drop = placement.drop;
placed.restore = placement.restore;
const mcpNodes = {status: element<HTMLParagraphElement>('mcp-status'), channels: element<HTMLParagraphElement>('mcp-channels'), toggle: element<HTMLButtonElement>('mcp-toggle')};
let mcpSharing = false;
const mcpLink = connectStudio(bindStudioHost({
  identity: () => ({id: building.value, name: buildings.find(item => item.id === building.value)?.name ?? building.value, stage: mode.value, ready}),
  root: () => current?.root,
  editor: parts,
  camera: () => ({position: camera.position.toArray(), target: controls.target.toArray()}),
  setCamera(position, target) { camera.position.fromArray(position); controls.target.fromArray(target); controls.update(); render(); remember(); },
  view: () => ({light: element<HTMLSelectElement>('light').value, shadows: checked('shadows'), textures: checked('textures'), plain: checked('plain'), ground: checked('ground'), grid: gridOn, plan: plan.frame().open, gizmo: parts.mode()}),
  setView(patch) {
    if (patch.light) element<HTMLSelectElement>('light').value = patch.light;
    for (const id of ['shadows', 'textures', 'plain', 'ground'] as const) if (patch[id] !== undefined) element<HTMLInputElement>(id).checked = patch[id];
    if (patch.grid !== undefined && patch.grid !== gridOn) { gridOn = patch.grid; gridButton.classList.toggle('on', gridOn); gridButton.setAttribute('aria-pressed', String(gridOn)); syncGrid(); }
    if (patch.plan !== undefined) plan.setOpen(patch.plan);
    if (patch.gizmo === 'translate' || patch.gizmo === 'rotate' || patch.gizmo === 'scale') parts.setMode(patch.gizmo);
    current?.textures(checked('textures'));
    lighting();
    remember();
  },
  cost: () => ({triangles: drawnTriangles, corners: modelVerts, draws: drawnCalls}),
  edits: () => current ? diffParts(current.root, born).map(edit => ({id: edit.id, name: edit.name})) : [],
  toolbox: () => toolboxItems.map(item => ({id: item.id, name: item.name})),
  place: (item, position) => placement.put(item, position as [number, number, number]),
  save: saveBuilding,
}), (status: McpStatus) => { mcpSharing = status.sharing; paintMcp(status, mcpNodes); });
mcpNodes.toggle.onclick = () => { closeMcp(); if (mcpSharing) mcpLink.disconnect(); else mcpLink.connect(); };
element<HTMLButtonElement>('studio-title').onclick = () => {
  picker.hidden = !picker.hidden;
  element('studio-title').setAttribute('aria-expanded', String(!picker.hidden));
  if (!picker.hidden) element<HTMLInputElement>('search').focus();
};
addEventListener('pointerdown', event => {
  const target = event.target as Node;
  if (picker.hidden || picker.contains(target) || element('studio-title').contains(target)) return;
  picker.hidden = true;
  element('studio-title').setAttribute('aria-expanded', 'false');
});

export const studio = {get stages() { return stages(building.value); }, get ready() { return ready; }, get error() { return error.textContent; }, view, render, saveView,
  async select(id: string, assembly?: string) { if (!buildings.some(b => b.id === id)) throw Error('Unknown building ID'); if (assembly && !stages(id).some(s => s.id === assembly)) throw Error('Unknown study stage: ' + assembly); building.value = id; modes(assembly ?? ''); captureSetup(); await load(); },
  options(options: {light?: string; shadows?: boolean; textures?: boolean; plain?: boolean; ground?: boolean}) {
    if (options.light) element<HTMLSelectElement>('light').value = options.light;
    for (const id of ['shadows', 'textures', 'plain', 'ground'] as const) if (options[id] !== undefined) element<HTMLInputElement>(id).checked = options[id];
    current?.textures(checked('textures')); lighting();
  },
};
Object.assign(window, {studio});

for (const id of ['shadows', 'textures', 'plain', 'ground']) if (params.has(id)) element<HTMLInputElement>(id).checked = params.get(id) === 'true';
if (['morning', 'midday', 'late'].includes(params.get('light')!)) element<HTMLSelectElement>('light').value = params.get('light')!;
lighting();
action(async () => {
  const data = await world; buildings = data.buildings;
  for (const b of [...buildings].sort((a, b) => a.name.localeCompare(b.name))) building.add(new Option(label(b), b.id));
  const wanted = params.get('building') || setup.building;
  building.value = buildings.some(b => b.id === wanted) ? wanted : buildings[0].id;
  modes(params.get('mode') || setup.mode || '');
  applyChrome();
  await load();
  const vector = (key: string) => { const values = params.get(key)?.split(',').map(Number); return values?.length === 3 && values.every(Number.isFinite) ? values : null; };
  const position = vector('position'), target = vector('target');
  if (position && target) { camera.position.fromArray(position); controls.target.fromArray(target); controls.update(); render(); }
  const folders: FolderSetup = setup.folders[building.value] ?? {open: [], collapsed: []};
  if (Array.isArray(folders.open) && Array.isArray(folders.collapsed)) explorer.useLayout({open: folders.open.filter(item => typeof item === 'string'), collapsed: folders.collapsed.filter(item => typeof item === 'string')});
  if (setup.gizmo === 'rotate' || setup.gizmo === 'scale') parts.setMode(setup.gizmo);
  persist = true;
  saveView();
});
import.meta.hot?.dispose(() => { mcpLink.disconnect(); disposeLanguage(); disposeMenus(); disposeScroll(); disposeTips(); stopWalk(); plan.dispose(); explorer.dispose(); parts.dispose(); disposeDraw(); dropGrid(); disposed = true; generation++; window.clearTimeout(timer); window.clearTimeout(rememberTimer); window.clearTimeout(shadowTimer); observer.disconnect(); controls.dispose(); sun?.shadow.map?.dispose(); current?.dispose(); neutral.dispose(); renderer.dispose(); renderer.domElement.remove(); });
