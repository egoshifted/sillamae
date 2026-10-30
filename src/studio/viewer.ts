/// <reference types="vite/client" />
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildStudy, stages, label} from './studies.ts';
import type {WorldData} from '../engine/data.ts';
import './style.css';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const building = element<HTMLSelectElement>('building'), mode = element<HTMLSelectElement>('mode');
const main = document.querySelector('main')!, status = element<HTMLOutputElement>('status'), error = element<HTMLParagraphElement>('error');
const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.classList.add('capture');
let buildings: WorldData['buildings'] = [];
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#e3e8df');
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
main.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 2000), controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false; controls.maxDistance = 1200;
const neutral = new THREE.MeshStandardMaterial({color: '#c8cbc2', roughness: 1});
let current: Awaited<ReturnType<typeof buildStudy>> | undefined, sun: THREE.DirectionalLight | undefined;
let generation = 0, disposed = false, radius = 40, ready = false;
const centre = new THREE.Vector3(), sunOffset = new THREE.Vector3(-25, 80, -35);
const world = fetch('/data/world.json').then(async response => { if (!response.ok) throw Error('Build data first: npm run data'); return await response.json() as WorldData; });
const checked = (id: string) => element<HTMLInputElement>(id).checked;

function render() {
  if (!current || !sun || disposed) return;
  current.ground.visible = checked('ground'); current.scene.overrideMaterial = checked('plain') ? neutral : null;
  sun.castShadow = checked('shadows'); sun.target.position.copy(centre); sun.position.copy(centre).add(sunOffset.clone().normalize().multiplyScalar(radius * 3));
  renderer.render(current.scene, camera);
  status.textContent = `${buildings.find(s => s.id === building.value)?.name} · ${mode.selectedOptions[0].text} · ${renderer.info.render.triangles.toLocaleString()} rendered triangles · ${renderer.info.render.calls} draws`;
}
function resize() { const {width, height} = main.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); render(); }
const observer = new ResizeObserver(resize); observer.observe(main); controls.addEventListener('change', render);
function view(angle = 0, distance = Number(element<HTMLSelectElement>('distance').value), elevation = 25) {
  const h = THREE.MathUtils.degToRad(angle), e = THREE.MathUtils.degToRad(elevation), d = radius * 3 * distance;
  controls.target.copy(centre); camera.position.copy(centre).add(new THREE.Vector3(Math.sin(h) * Math.cos(e), Math.sin(e), Math.cos(h) * Math.cos(e)).multiplyScalar(d));
  camera.up.set(0, 1, 0); controls.update(); render();
}
function lighting() {
  const value = element<HTMLSelectElement>('light').value;
  sunOffset.set(...(value === 'morning' ? [65, 30, -50] : value === 'late' ? [-65, 20, 25] : [-25, 80, -35]) as [number, number, number]); render();
}
function modes(preferred = mode.value) {
  mode.replaceChildren();
  for (const stage of stages(building.value)) mode.add(new Option(stage.label, stage.id));
  mode.value = [...mode.options].some(o => o.value === preferred) ? preferred : [...mode.options].some(o => o.value === 'draft') ? 'draft' : [...mode.options].some(o => o.value === 'assembled') ? 'assembled' : 'survey';
}
async function load(reset = true) {
  const ticket = ++generation; ready = false; error.textContent = ''; status.textContent = 'Building…';
  try {
    const next = await buildStudy(await world, building.value, mode.value);
    if (ticket !== generation || disposed) { next.dispose(); return; }
    sun?.shadow.map?.dispose(); current?.dispose(); current = next;
    centre.copy(next.bounds.getCenter(new THREE.Vector3())); radius = Math.max(10, next.bounds.getSize(new THREE.Vector3()).length() / 2);
    next.scene.add(new THREE.HemisphereLight(0xe5edf2, 0x7b775e, 1.65));
    sun = new THREE.DirectionalLight(0xfff4df, 3); sun.shadow.mapSize.set(4096, 4096); sun.shadow.normalBias = .008; sun.shadow.bias = -.000015;
    Object.assign(sun.shadow.camera, {left: -radius * 2, right: radius * 2, top: radius * 2, bottom: -radius * 2, near: .1, far: radius * 8}); sun.shadow.camera.updateProjectionMatrix();
    next.scene.add(sun, sun.target); next.textures(checked('textures'));
    if (reset) view(); resize(); ready = true;
  } catch (e) { if (ticket === generation) { error.textContent = String(e); status.textContent = 'Study failed'; } throw e; }
}
function saveView() {
  const query = new URLSearchParams({building: building.value, mode: mode.value, light: element<HTMLSelectElement>('light').value, position: camera.position.toArray().join(','), target: controls.target.toArray().join(',')});
  for (const id of ['shadows', 'textures', 'plain', 'ground']) query.set(id, String(checked(id)));
  history.replaceState(null, '', '?' + query); return location.href;
}
const action = (run: () => Promise<unknown>) => { void run().catch(e => { error.textContent = String(e); }); };
building.onchange = () => { modes(''); action(() => load()); };
element<HTMLInputElement>('search').oninput = event => {
  const query = (event.target as HTMLInputElement).value.toLowerCase();
  for (const option of building.options) option.hidden = !option.text.toLowerCase().includes(query);
};
mode.onchange = () => action(() => load(false));
element('reload').onclick = () => action(() => load(false));
element('home').onclick = () => view();
element('rotate').onclick = () => { camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).add(controls.target); controls.update(); };
element('plan').onclick = () => view(0, 1, 89.9);
element('distance').onchange = () => view(); element('light').onchange = lighting;
for (const id of ['shadows', 'plain', 'ground']) element(id).onchange = render;
element('textures').onchange = () => { current?.textures(checked('textures')); render(); };
element('save').onclick = saveView;
element('capture').onclick = () => { render(); const a = document.createElement('a'); a.download = `study-${building.value}-${Date.now()}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); };

export const studio = {get stages() { return stages(building.value); }, get ready() { return ready; }, get error() { return error.textContent; }, view, render, saveView,
  async select(id: string, assembly?: string) { if (!buildings.some(b => b.id === id)) throw Error('Unknown building ID'); if (assembly && !stages(id).some(s => s.id === assembly)) throw Error('Unknown study stage: ' + assembly); building.value = id; modes(assembly ?? ''); await load(); },
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
  for (const b of [...buildings].sort((a,b) => a.name.localeCompare(b.name))) building.add(new Option(label(b), b.id));
  building.value = buildings.some(b => b.id === params.get('building')) ? params.get('building')! : buildings[0].id; modes(params.get('mode') ?? '');
  await load();
  const vector = (key: string) => { const values = params.get(key)?.split(',').map(Number); return values?.length === 3 && values.every(Number.isFinite) ? values : null; };
  const position = vector('position'), target = vector('target');
  if (position && target) { camera.position.fromArray(position); controls.target.fromArray(target); controls.update(); render(); }
});
import.meta.hot?.dispose(() => { disposed = true; generation++; observer.disconnect(); controls.dispose(); sun?.shadow.map?.dispose(); current?.dispose(); neutral.dispose(); renderer.dispose(); renderer.domElement.remove(); });
