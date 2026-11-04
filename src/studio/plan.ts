import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const SIZE = 300;
type ViewName = 'above' | 'front' | 'right' | 'back' | 'left';
type Axis = 'x' | 'y' | 'z';
interface Spec { sx: Axis; signX: number; sy: Axis; signY: number; depth: Axis; far: 'min' | 'max'; back: number }
const SPEC: Record<ViewName, Spec> = {
  above: {sx: 'x', signX: 1, sy: 'z', signY: 1, depth: 'y', far: 'min', back: 1},
  front: {sx: 'x', signX: 1, sy: 'y', signY: 1, depth: 'z', far: 'max', back: -1},
  back: {sx: 'x', signX: -1, sy: 'y', signY: 1, depth: 'z', far: 'min', back: 1},
  right: {sx: 'z', signX: -1, sy: 'y', signY: 1, depth: 'x', far: 'min', back: 1},
  left: {sx: 'z', signX: 1, sy: 'y', signY: 1, depth: 'x', far: 'max', back: -1},
};
const VIEW_LABEL: Record<ViewName, string> = {above: 'Above', front: 'Front', right: 'Right', back: 'Back', left: 'Left'};
type Look = 'textured' | 'plain' | 'xray' | 'deep' | 'lines' | 'line-xray';

export interface PlanFrame {
  angle: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  step: number;
  cx: number;
  cz: number;
  half: number;
}

export function gridStep(span: number) {
  const target = Math.max(span, 1) / 12;
  const pow = 10 ** Math.floor(Math.log10(target));
  const n = target / pow;
  const face = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return face * pow;
}

function edgeAngle(footprint: readonly [number, number][]) {
  let best = 0, angle = 0;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len > best) { best = len; angle = Math.atan2(dz, dx); }
  }
  return angle;
}

export function worldToPlan(x: number, z: number, angle: number): [number, number] {
  const c = Math.cos(-angle), s = Math.sin(-angle);
  return [x * c - z * s, x * s + z * c];
}

export function planToWorld(x: number, z: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c - z * s, x * s + z * c];
}

// Longest footprint edge becomes horizontal. The grid origin is that oriented corner, in whole metres.
export function planFrame(footprint: readonly [number, number][], points: readonly [number, number][]): PlanFrame {
  const angle = edgeAngle(footprint);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of [...footprint, ...points]) {
    const [px, pz] = worldToPlan(x, z, angle);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
  }
  if (!Number.isFinite(minX)) { minX = -5; maxX = 5; minZ = -5; maxZ = 5; }
  const step = gridStep(Math.max(maxX - minX, maxZ - minZ));
  const pad = Math.max(step, Math.max(maxX - minX, maxZ - minZ) * 0.08);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const half = Math.max(maxX - minX, maxZ - minZ) / 2 + pad;
  return {angle, minX, minZ, maxX, maxZ, step, cx, cz, half};
}

interface Draft {root: THREE.Object3D; footprint: readonly [number, number][]}
interface Box {minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number}
interface Drawn {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  marker: THREE.Object3D;
  frame: PlanFrame;
  box: Box;
  view: ViewName;
  dispose(): void;
  aim(view: ViewName, panX: number, panY: number, zoom: number): void;
  look(mode: Look): void;
  place(camera: THREE.Camera): void;
  metres(zoom: number): number;
  mark(objects: readonly THREE.Object3D[]): void;
}

function axisVector(axis: Axis, sign: number, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 'y') return new THREE.Vector3(0, sign, 0);
  if (axis === 'x') return new THREE.Vector3(c * sign, 0, s * sign);
  return new THREE.Vector3(-s * sign, 0, c * sign);
}
function screenSpan(spec: Spec, box: Box) {
  let minS = Infinity, maxS = -Infinity, minU = Infinity, maxU = -Infinity;
  for (const x of [box.minX, box.maxX]) for (const y of [box.minY, box.maxY]) for (const z of [box.minZ, box.maxZ]) {
    const p = {x, y, z};
    const s = spec.signX * p[spec.sx], u = spec.signY * p[spec.sy];
    minS = Math.min(minS, s); maxS = Math.max(maxS, s);
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
  }
  return {minS, maxS, minU, maxU};
}
function toWorld(x: number, y: number, z: number, angle: number) {
  const [wx, wz] = planToWorld(x, z, angle);
  return new THREE.Vector3(wx, y, wz);
}

function bakedMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.source = material;
  return mesh;
}

function bake(root: THREE.Object3D) {
  const groups = new Map<string, {material: THREE.Material; parts: THREE.BufferGeometry[]}>();
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.geometry.getAttribute('position')) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const key = material.uuid + '|' + Object.keys(geometry.attributes).sort().join(',');
    const group = groups.get(key);
    if (group) group.parts.push(geometry);
    else groups.set(key, {material, parts: [geometry]});
  });
  const meshes: THREE.Mesh[] = [];
  for (const group of groups.values()) {
    const merged = group.parts.length === 1 ? group.parts[0] : mergeGeometries(group.parts);
    if (!merged) {
      for (const geometry of group.parts) meshes.push(bakedMesh(geometry, group.material));
      continue;
    }
    if (group.parts.length > 1) for (const geometry of group.parts) geometry.dispose();
    meshes.push(bakedMesh(merged, group.material));
  }
  return meshes;
}

function build(draft: Draft): Drawn {
  const points: [number, number][] = [];
  let minY = Infinity, maxY = -Infinity;
  const corner = new THREE.Vector3();
  draft.root.updateMatrixWorld(true);
  draft.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.geometry.getAttribute('position')) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox!;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corner.set(x, y, z).applyMatrix4(object.matrixWorld);
      points.push([corner.x, corner.z]);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
  });
  if (!Number.isFinite(minY)) { minY = 0; maxY = 1; }
  const frame = planFrame(draft.footprint, points);
  const box: Box = {minX: frame.minX, maxX: frame.maxX, minY, maxY, minZ: frame.minZ, maxZ: frame.maxZ};
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e7eee9', '#6a736c', 1.35));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.8);
  scene.add(sun);
  const meshes = bake(draft.root);
  for (const mesh of meshes) scene.add(mesh);
  const clay = new THREE.MeshStandardMaterial({color: '#c5ccc4', roughness: 1, side: THREE.DoubleSide});
  const xray = new THREE.MeshStandardMaterial({color: '#c5d0c8', roughness: 1, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide});
  const deep = xray.clone(); deep.opacity = .07;
  const looks = {textured: null, plain: clay, xray, deep, lines: null, 'line-xray': null};
  const solidLines = new THREE.LineBasicMaterial({color: '#d7ded8', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
  const ghostLines = new THREE.LineBasicMaterial({color: '#d7ded8', depthTest: false});
  let linePairs: {solid: THREE.LineSegments; ghost: THREE.LineSegments}[] | null = null;
  const ensureLines = () => {
    if (linePairs) return;
    linePairs = [];
    for (const mesh of meshes) {
      const geometry = new THREE.EdgesGeometry(mesh.geometry, 40);
      const solid = new THREE.LineSegments(geometry, solidLines), ghost = new THREE.LineSegments(geometry, ghostLines);
      solid.matrix.copy(mesh.matrix); ghost.matrix.copy(mesh.matrix);
      solid.matrixAutoUpdate = ghost.matrixAutoUpdate = false;
      solid.visible = ghost.visible = false;
      scene.add(solid, ghost);
      linePairs.push({solid, ghost});
    }
  };
  const selectionFill = new THREE.MeshBasicMaterial({color: '#e2c98a', transparent: true, opacity: .8, depthTest: false, side: THREE.DoubleSide});
  const selectionEdge = new THREE.LineBasicMaterial({color: '#fff6d4', depthTest: false});
  let selection: THREE.Group | null = null;
  const clearSelection = () => {
    if (!selection) return;
    scene.remove(selection);
    selection.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); });
    selection = null;
  };
  const marker = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({color: '#e2c15a', depthTest: false, side: THREE.DoubleSide}));
  marker.rotation.x = -Math.PI / 2; marker.renderOrder = 3; scene.add(marker);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 500);
  const drawn: Drawn = {scene, camera, marker, frame, box, view: 'above', metres: () => 1, aim(view, panX, panY, zoom) {
    drawn.view = view;
    const spec = SPEC[view], ext = screenSpan(spec, box);
    const span = Math.max(ext.maxS - ext.minS, ext.maxU - ext.minU, 1);
    const step = gridStep(span), pad = Math.max(step, span * 0.08);
    const half = (span / 2 + pad) / zoom;
    const midS = (ext.minS + ext.maxS) / 2 + panX, midU = (ext.minU + ext.maxU) / 2 + panY;
    const depth = edge(box, spec.depth, spec.far);
    const midDepth = (edge(box, spec.depth, 'min') + edge(box, spec.depth, 'max')) / 2;
    const right = axisVector(spec.sx, spec.signX, frame.angle);
    const up = axisVector(spec.sy, spec.signY, frame.angle);
    const back = axisVector(spec.depth, spec.back, frame.angle);
    const at = screenPoint(spec, midS, midU, midDepth, box, frame.angle);
    const depthSpan = Math.abs(edge(box, spec.depth, 'max') - edge(box, spec.depth, 'min'));
    camera.up.copy(up);
    camera.position.copy(at).addScaledVector(back, depthSpan / 2 + 40);
    camera.lookAt(at);
    camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
    camera.near = 0.05; camera.far = depthSpan + 100;
    camera.updateMatrixWorld(true);
    const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const screenUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    if (screenRight.dot(right) < 0) { const swap = camera.left; camera.left = camera.right; camera.right = swap; }
    if (screenUp.dot(up) < 0) { const swap = camera.top; camera.top = camera.bottom; camera.bottom = swap; }
    camera.updateProjectionMatrix();
    sun.position.copy(camera.position);
    drawn.metres = () => half * 2 / SIZE;
    replaceGrid(scene, spec, ext, step, half, midS, midU, box, frame.angle);
    marker.visible = view === 'above';
    marker.scale.setScalar(half / 18);
  }, mark(objects) {
    clearSelection();
    const parts: THREE.BufferGeometry[] = [];
    for (const obj of objects) {
      obj.updateWorldMatrix(true, true);
      obj.traverse(node => {
        if (!(node instanceof THREE.Mesh) || node.userData.fit || !node.geometry.getAttribute('position')) return;
        const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        geometry.applyMatrix4(node.matrixWorld);
        for (const name of Object.keys(geometry.attributes)) if (name !== 'position') geometry.deleteAttribute(name);
        parts.push(geometry);
      });
    }
    if (!parts.length) return;
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!merged) { for (const geometry of parts) geometry.dispose(); return; }
    if (parts.length > 1) for (const geometry of parts) geometry.dispose();
    const fill = new THREE.Mesh(merged, selectionFill);
    fill.matrixAutoUpdate = false;
    fill.renderOrder = 4;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(merged, 25), selectionEdge);
    lines.matrixAutoUpdate = false;
    lines.renderOrder = 5;
    selection = new THREE.Group();
    selection.add(fill, lines);
    scene.add(selection);
  }, place(source) {
    if (drawn.view !== 'above') return;
    const [px, pz] = worldToPlan(source.position.x, source.position.z, frame.angle);
    const [mx, mz] = planToWorld(px, pz, frame.angle);
    marker.position.set(mx, box.maxY + 0.3, mz);
  }, look(mode) {
    const drawing = mode === 'lines' || mode === 'line-xray';
    if (drawing) ensureLines();
    for (const mesh of meshes) {
      mesh.visible = !drawing;
      if (!drawing) mesh.material = looks[mode] ?? mesh.userData.source;
    }
    for (const pair of linePairs ?? []) { pair.solid.visible = mode === 'lines'; pair.ghost.visible = mode === 'line-xray'; }
  }, dispose() {
    const sharedGeo = new Set<THREE.BufferGeometry>(), sharedMat = new Set<THREE.Material>();
    draft.root.traverse(source => {
      if (!(source instanceof THREE.Mesh)) return;
      sharedGeo.add(source.geometry);
      for (const material of Array.isArray(source.material) ? source.material : [source.material]) sharedMat.add(material);
    });
    clearSelection();
    const owned = new Set<THREE.Material>([clay, xray, deep, solidLines, ghostLines, selectionFill, selectionEdge]);
    const lineGeo = new Set((linePairs ?? []).map(pair => pair.solid.geometry));
    for (const geometry of lineGeo) geometry.dispose();
    scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && !sharedGeo.has(mesh.geometry) && !lineGeo.has(mesh.geometry)) mesh.geometry.dispose();
      for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) if (!sharedMat.has(material) && !owned.has(material)) material.dispose();
    });
    owned.forEach(material => material.dispose());
  }};
  drawn.aim('above', 0, 0, 1);
  return drawn;
}

function edge(box: Box, axis: Axis, end: 'min' | 'max') {
  if (axis === 'x') return end === 'min' ? box.minX : box.maxX;
  if (axis === 'y') return end === 'min' ? box.minY : box.maxY;
  return end === 'min' ? box.minZ : box.maxZ;
}

function screenPoint(spec: Spec, s: number, u: number, depth: number, box: Box, angle: number) {
  const p = {x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, z: (box.minZ + box.maxZ) / 2};
  p[spec.sx] = spec.signX * s;
  p[spec.sy] = spec.signY * u;
  p[spec.depth] = depth;
  return toWorld(p.x, p.y, p.z, angle);
}

function replaceGrid(scene: THREE.Scene, spec: Spec, ext: {minS: number; maxS: number; minU: number; maxU: number}, step: number, half: number, midS: number, midU: number, box: Box, angle: number) {
  const previous = scene.getObjectByName('plan-grid');
  if (previous) {
    previous.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); (mesh.material as THREE.Material | undefined)?.dispose?.(); });
    scene.remove(previous);
  }
  const far = edge(box, spec.depth, spec.far);
  const minor: number[] = [], major: number[] = [];
  const push = (list: number[], s0: number, u0: number, s1: number, u1: number) => {
    const a = screenPoint(spec, s0, u0, far, box, angle), b = screenPoint(spec, s1, u1, far, box, angle);
    list.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };
  const s0 = midS - half, s1 = midS + half, u0 = midU - half, u1 = midU + half;
  for (let i = Math.floor((s0 - ext.minS) / step); i <= Math.ceil((s1 - ext.minS) / step); i++) push(i % 5 === 0 ? major : minor, ext.minS + i * step, u0, ext.minS + i * step, u1);
  for (let i = Math.floor((u0 - ext.minU) / step); i <= Math.ceil((u1 - ext.minU) / step); i++) push(i % 5 === 0 ? major : minor, s0, ext.minU + i * step, s1, ext.minU + i * step);
  const group = new THREE.Group(); group.name = 'plan-grid';
  const add = (values: number[], color: string) => {
    if (!values.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color})));
  };
  add(minor, '#3d4a44');
  add(major, '#7d8b84');
  scene.add(group);
}

export function mountPlan(host: HTMLElement, button: HTMLButtonElement, viewCamera: () => THREE.Camera, onChange: () => void) {
  const panel = document.createElement('div');
  panel.id = 'plan-panel';
  panel.hidden = true;
  const bar = document.createElement('div');
  bar.className = 'plan-bar';
  let view: ViewName = 'above', look: Look = 'xray', panX = 0, panY = 0, zoom = 1;
  const viewSelect = document.createElement('select');
  viewSelect.setAttribute('aria-label', 'View');
  for (const name of ['above', 'front', 'right', 'back', 'left'] as const) viewSelect.add(new Option(VIEW_LABEL[name], name));
  viewSelect.value = view;
  viewSelect.onchange = () => { view = viewSelect.value as ViewName; panX = panY = 0; zoom = 1; drawn?.aim(view, panX, panY, zoom); paint(); onChange(); };
  const lookSelect = document.createElement('select');
  lookSelect.setAttribute('aria-label', 'X-ray');
  for (const [value, label] of [['textured', 'Textured'], ['plain', 'Plain'], ['xray', 'X-ray'], ['deep', 'Deep x-ray'], ['lines', 'Lines'], ['line-xray', 'Line x-ray']] as const) lookSelect.add(new Option(label, value));
  lookSelect.value = look;
  lookSelect.onchange = () => { look = lookSelect.value as Look; drawn?.look(look); paint(); onChange(); };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'plan-reset';
  reset.dataset.tip = 'Reset view';
  reset.setAttribute('aria-label', 'Reset view');
  reset.innerHTML = '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i>';
  const framePlan = () => { panX = panY = 0; zoom = 1; drawn?.aim(view, 0, 0, 1); paint(); onChange(); };
  reset.onclick = framePlan;
  bar.append(viewSelect, lookSelect, reset);
  const canvas = document.createElement('canvas');
  panel.append(bar, canvas);
  host.append(panel);
  let renderer: THREE.WebGLRenderer | undefined;
  let drawn: Drawn | undefined;
  let draft: Draft | null = null;
  let drag: {x: number; y: number; panX: number; panY: number} | null = null;
  let picked: readonly THREE.Object3D[] = [];
  const open = () => !panel.hidden;
  const looks = new Set<Look>(['textured', 'plain', 'xray', 'deep', 'lines', 'line-xray']);
  function paint() {
    if (!open() || !drawn || !renderer) return;
    drawn.place(viewCamera());
    renderer.render(drawn.scene, drawn.camera);
  }
  function rebuild() {
    drawn?.dispose();
    drawn = draft ? build(draft) : undefined;
    drawn?.aim(view, panX, panY, zoom);
    drawn?.look(look);
    drawn?.mark(picked);
    paint();
  }
  canvas.addEventListener('wheel', event => {
    if (!open() || !drawn) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const dx = (event.clientX - rect.left - rect.width / 2) * SIZE / rect.width;
    const dy = (event.clientY - rect.top - rect.height / 2) * SIZE / rect.height;
    const before = drawn.metres(zoom);
    const next = Math.min(24, Math.max(.3, zoom * (event.deltaY > 0 ? .9 : 1.12)));
    const after = before * zoom / next;
    // Screen +x tracks -panX and screen +y tracks +panY, the same way dragging the plan does.
    panX += dx * (after - before);
    panY += dy * (before - after);
    zoom = next;
    drawn.aim(view, panX, panY, zoom);
    paint();
    onChange();
  }, {passive: false});
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 1) return;
    drag = {x: event.clientX, y: event.clientY, panX, panY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || !drawn) return;
    const metres = drawn.metres(zoom);
    panX = drag.panX - (event.clientX - drag.x) * metres;
    panY = drag.panY + (event.clientY - drag.y) * metres;
    drawn.aim(view, panX, panY, zoom);
    paint();
  });
  canvas.addEventListener('pointerup', () => { if (!drag) return; drag = null; onChange(); });
  canvas.addEventListener('dblclick', framePlan);
  function ensure() {
    renderer ??= new THREE.WebGLRenderer({canvas, antialias: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor('#101412');
  }
  function setOpen(next: boolean) {
    if (open() === next) return;
    panel.hidden = !next;
    button.classList.toggle('on', next);
    button.setAttribute('aria-pressed', String(next));
    if (!next) return;
    ensure();
    rebuild();
  }
  button.onclick = () => { setOpen(!open()); onChange(); };
  return {setOpen, use(next: {view?: string; look?: string; panX?: number; panY?: number; zoom?: number} | undefined) {
    if (!next) { panX = panY = 0; zoom = 1; return; }
    if (next.view && next.view in SPEC) { view = next.view as ViewName; viewSelect.value = view; }
    if (next.look && looks.has(next.look as Look)) { look = next.look as Look; lookSelect.value = look; }
    if (typeof next.panX === 'number' && Number.isFinite(next.panX)) panX = next.panX;
    if (typeof next.panY === 'number' && Number.isFinite(next.panY)) panY = next.panY;
    if (typeof next.zoom === 'number' && Number.isFinite(next.zoom)) zoom = next.zoom;
  }, frame: () => ({open: open(), view, look, panX, panY, zoom}), setStudy(next: Draft | null) { draft = next; if (open()) rebuild(); }, mark(objects: readonly THREE.Object3D[]) { picked = objects; if (!open()) return; drawn?.mark(objects); paint(); }, paint, dispose() {
    drawn?.dispose(); drawn = undefined; renderer?.dispose(); panel.remove();
  }};
}
