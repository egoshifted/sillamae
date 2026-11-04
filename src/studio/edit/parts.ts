import * as THREE from 'three';
import {mountContextMenu} from './context.ts';
import {translate} from '../i18n.ts';
import {isLocked, lockOwner, objectId, objectLabel, objectSwatch, userNamed} from './group.ts';
import {applyHistoryChange, type HistoryDish, type HistoryLog, type HistoryNode, type HistoryState, type HistoryStep} from './version.ts';
import {markDrawDirty, markDrawStructure} from './draw.ts';
import {acceleratePick, appendBounds, heavyMesh} from './pick.ts';
import {axisNote, tightenPickers} from './gizmo.ts';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const elementGeometry = new THREE.BoxGeometry(1, 1, 1);
const elementMaterial = new THREE.MeshStandardMaterial({color: '#c8b898', roughness: .85});
elementMaterial.name = 'Element';

function partOf(object: THREE.Object3D, root: THREE.Object3D) {
  let node: THREE.Object3D | null = object;
  while (node && node.parent !== root) node = node.parent;
  return node && node !== root ? node : null;
}
function typing(event: KeyboardEvent) {
  return event.target instanceof Element && !!event.target.closest('input, textarea, select, .menu, .menu-pop');
}

interface Pose {position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; world: THREE.Matrix4}
interface State {parent: THREE.Object3D | null; attached: boolean; visible: boolean; name: string; locked: boolean; pose: Pose}
interface Change {obj: THREE.Object3D; before: State; after: State}
interface Action {name: string; count: number; step: HistoryStep; undo(): void; redo(): void}
type Axis = 'x' | 'y' | 'z';
type Modal = {kind: 'grab' | 'rotate' | 'scale'; axis: Axis | null; pointer: THREE.Vector2; poses: Map<THREE.Object3D, Pose>; center: THREE.Vector3};

export function mountPartEditor(options: {
  dom: HTMLElement;
  camera: THREE.Camera;
  controls: OrbitControls;
  study(): {scene: THREE.Scene; root: THREE.Object3D} | undefined;
  armed(): unknown;
  redraw(): void;
  setHint(text: string | null): void;
  setActions(rows: {label: string; keys: string; note: string}[]): void;
  setNote(text: string | null): void;
  historyHost: HTMLElement;
  placement: {drop(ids: string[]): void; restore(ids: {id: string; item: string; position: THREE.Vector3; quaternion: THREE.Quaternion}[]): void};
  onChange?(): void;
  frame?(objects: THREE.Object3D[]): void;
  nameObject?(obj: THREE.Object3D): void;
  onSetup?(): void;
  caption?(): string;
}) {
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  raycaster.layers.enable(1);
  const gizmo = new TransformControls(options.camera, options.dom);
  tightenPickers(gizmo.getHelper());
  const helper = gizmo.getHelper();
  const pivot = new THREE.Object3D();
  const boxInverse = new THREE.Matrix4();
  const sample = new THREE.Vector3();
  const wire = (color: number, depth: boolean) => {
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color, toneMapped: false, depthTest: depth, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
    lines.frustumCulled = false;
    lines.raycast = () => {};
    lines.visible = false;
    if (!depth) lines.renderOrder = 2;
    return lines;
  };
  const hover = wire(0xe7eee9, false);
  const boxHelpers: THREE.LineSegments[] = [];
  let hovered: THREE.Object3D | null = null;
  const selected = new Set<THREE.Object3D>();
  const hidden = new Set<THREE.Object3D>();
  const history: Action[] = [];
  let cursor = -1;
  let studioSerial = 0;
  const studioId = () => `studio:${++studioSerial}`;
  const historyHost = document.createElement('div');
  historyHost.id = 'history';
  const historyTitle = document.createElement('h2');
  historyTitle.textContent = 'History';
  const historyList = document.createElement('div');
  historyHost.append(historyTitle, historyList);
  options.historyHost.append(historyHost);
  const band = document.createElement('div');
  band.id = 'marquee';
  options.dom.parentElement?.append(band);
  let down: {x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; gizmo: boolean} | null = null;
  let dragged = false;
  let boxing = false;
  let modal: Modal | null = null;
  let gizmoBefore: Map<THREE.Object3D, State> | null = null;
  const poses = new Map<THREE.Object3D, THREE.Matrix4>();
  let pivotStart = new THREE.Matrix4();

  const ndc = (event: {clientX: number; clientY: number}) => {
    const rect = options.dom.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    return pointer;
  };
  const parts = () => options.study()?.root.children.filter(child => child.visible) ?? [];
  let aimLocked = false;
  const heavyPart = (obj: THREE.Object3D) => {
    let heavy = false;
    obj.traverse(node => { if (!heavy && node instanceof THREE.Mesh && heavyMesh(node.geometry)) heavy = true; });
    return heavy;
  };
  const describe = () => {
    const axis = (gizmo as {axis: string | null}).axis;
    if (axis) return axisNote(gizmo.getMode(), axis);
    if (aimLocked) return 'Locked. The view will not move it, select it or delete it.';
    if (boxing) return 'Drag the rectangle. Only parts you can see inside it are selected.';
    if (!selected.size) return 'Click the part under the cursor. Shift adds it, Ctrl removes it.';
    if ([...selected].every(isLocked)) return 'Locked. The view will not move it, select it or delete it.';
    const mode = gizmo.getMode();
    if (mode === 'rotate') return 'Drag a ring to turn the selection.';
    if (mode === 'scale') return 'Drag a handle to resize the selection.';
    return 'Drag an arrow to move the selection. A square between arrows slides on that plane.';
  };
  const showHint = () => {
    const rows: {label: string; keys: string; note: string}[] = [];
    const add = (label: string, keys: string, note: string) => rows.push({label, keys, note});
    if (boxing) {
      add('Drag a box', 'left drag', 'Drag across the view. The rectangle selects only the parts you can see inside it.');
      add('Add to selection', 'Shift', 'Hold Shift while dragging to add those parts to the selection.');
      add('Cancel', 'Esc', 'Leaves box selection without changing what is selected.');
    } else if (!selected.size) {
      add('Select', 'click', 'Selects the part under the cursor.');
      add('Add or remove', 'Shift / Ctrl', 'Shift adds the part under the cursor. Ctrl removes it from the selection.');
      add('Menu', 'right click', 'Opens the actions for the part under the cursor.');
      add('Box select', 'Alt+left', 'Drag a rectangle. Only parts you can see inside it are selected.');
      add('Select all', 'Ctrl+A', 'Selects every unlocked part.');
      add('Orbit', 'middle', 'Drag with the middle button to look around.');
      add('Pan', 'Shift+middle', 'Shift and the middle button slide the view.');
      add('Zoom', 'wheel', 'The wheel zooms toward the cursor.');
      add('Walk', 'W A S D', 'W A S D move the viewpoint.');
    } else {
      const mode = gizmo.getMode();
      add(mode === 'rotate' ? 'Rotate' : mode === 'scale' ? 'Scale' : 'Move', 'drag arrows', mode === 'rotate' ? 'Drag a ring to turn the selection.' : mode === 'scale' ? 'Drag a handle to resize the selection.' : 'Drag an arrow to move the selection. A square between arrows slides on that plane.');
      add('Move, rotate, scale', 'G / R / S', 'G, R and S switch between moving, turning and resizing.');
      add('Menu', 'right click', 'Opens the actions for the selection.');
      add('Copy description', 'Ctrl+C', 'Copies a text description of the selection.');
      add('Duplicate', 'Shift+D', 'Makes a copy. The copy is not locked.');
      add('Delete', 'Del', 'Removes the selection. Locked parts stay.');
      add('Hide', 'H', 'Hides the selection. It stays in the list.');
      if ([...selected].some(obj => !obj.visible) || hidden.size) add('Show', 'Alt+H', 'Shows the hidden parts again.');
      if (selected.size > 1) add('Group', 'Ctrl+G', 'Puts the unlocked selection into a new group.');
      if ([...selected].some(obj => obj.userData.studioGroup)) add('Ungroup', 'Ctrl+Shift+G', 'Takes the parts out of the group.');
      if ([...selected].some(obj => !isLocked(obj))) add('Lock', 'L', 'Freezes the selection so the view cannot move, select or delete it.');
      if ([...selected].some(isLocked)) add('Unlock', 'L', 'Unfreezes the selection.');
      if ([...selected].filter(userNamed).length === 1) add('Rename', 'F2', 'Renames this group or element.');
      add('Undo', 'Ctrl+Z', 'Reverts the last edit.');
      add('Redo', 'Ctrl+Shift+Z', 'Reapplies the edit that was just undone.');
      add('Clear selection', 'Alt+A', 'Deselects everything.');
    }
    options.setActions(rows);
    options.setNote(describe());
  };
  const seatLines = (lines: THREE.LineSegments, obj: THREE.Object3D) => {
    const study = options.study();
    if (!obj.visible && study) {
      obj.updateWorldMatrix(true, true);
      lines.matrixAutoUpdate = false;
      lines.matrix.copy(obj.matrixWorld);
      lines.matrixWorldNeedsUpdate = true;
      if (lines.parent !== study.scene) study.scene.add(lines);
      return;
    }
    if (lines.parent === obj && lines.matrixAutoUpdate) return;
    lines.matrixAutoUpdate = true;
    lines.position.set(0, 0, 0);
    lines.quaternion.identity();
    lines.scale.set(1, 1, 1);
    if (lines.parent !== obj) obj.add(lines);
  };
  const fitLines = (lines: THREE.LineSegments, obj: THREE.Object3D) => {
    if (lines.userData.fit !== obj) {
      obj.updateWorldMatrix(true, true);
      boxInverse.copy(obj.matrixWorld).invert();
      const positions: number[] = [];
      obj.traverse(node => {
        if (!(node instanceof THREE.Mesh) || !node.geometry.getAttribute('position')) return;
        if (heavyMesh(node.geometry)) { appendBounds(node.geometry, node.matrixWorld, boxInverse, positions); return; }
        const edges = new THREE.EdgesGeometry(node.geometry, 25);
        const attr = edges.getAttribute('position');
        for (let i = 0; i < attr.count; i++) {
          sample.fromBufferAttribute(attr, i).applyMatrix4(node.matrixWorld).applyMatrix4(boxInverse);
          positions.push(sample.x, sample.y, sample.z);
        }
        edges.dispose();
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      lines.geometry.dispose();
      lines.geometry = geometry;
      lines.userData.fit = obj;
    }
    seatLines(lines, obj);
    lines.visible = (lines.geometry.getAttribute('position')?.count ?? 0) > 0;
  };
  const refreshOutline = () => {
    const list = [...selected];
    while (boxHelpers.length < list.length) boxHelpers.push(wire(0xc4a46a, true));
    for (let i = 0; i < boxHelpers.length; i++) {
      const helper = boxHelpers[i];
      if (i >= list.length) { helper.visible = false; helper.removeFromParent(); helper.userData.fit = null; continue; }
      fitLines(helper, list[i]);
    }
    if (hovered && selected.has(hovered)) { hovered = null; hover.visible = false; hover.removeFromParent(); hover.userData.fit = null; }
  };
  let hoverQueued = 0;
  let hoverAt: {clientX: number; clientY: number} | null = null;
  const queueHover = (event: {clientX: number; clientY: number} | null) => {
    if (!event) { if (hoverQueued) cancelAnimationFrame(hoverQueued); hoverQueued = 0; hoverAt = null; showHover(null); return; }
    hoverAt = {clientX: event.clientX, clientY: event.clientY};
    if (hoverQueued) return;
    hoverQueued = requestAnimationFrame(() => { hoverQueued = 0; showHover(hoverAt); });
  };
  const showHover = (event: {clientX: number; clientY: number} | null) => {
    const study = options.study();
    if (study) acceleratePick(study.root);
    aimLocked = false;
    let next: THREE.Object3D | null = null;
    if (study && event && !modal && !down && !onHandle()) {
      raycaster.setFromCamera(ndc(event), options.camera);
      const hit = raycaster.intersectObject(study.root, true).find(item => item.object.visible && !item.object.userData.fit);
      const part = hit ? partOf(hit.object, study.root) : null;
      if (hit && (isLocked(hit.object) || (part != null && isLocked(part)))) aimLocked = true;
      else if (hit && part && !selected.has(part)) next = heavyPart(part) ? hit.object : part;
    }
    options.setNote(describe());
    if (next === hovered) return;
    hovered = next;
    if (!hovered) { hover.visible = false; hover.removeFromParent(); hover.userData.fit = null; options.redraw(); return; }
    fitLines(hover, hovered);
    options.redraw();
  };
  const bindPivot = () => {
    const study = options.study();
    const movable = [...selected].filter(obj => !isLocked(obj));
    if (!study || !movable.length) { gizmo.detach(); refreshOutline(); return; }
    if (pivot.parent !== study.scene) study.scene.add(pivot);
    if (helper.parent !== study.scene) study.scene.add(helper);
    const center = new THREE.Vector3();
    for (const obj of movable) { obj.updateMatrixWorld(true); center.add(obj.getWorldPosition(new THREE.Vector3())); }
    center.multiplyScalar(1 / movable.length);
    pivot.position.copy(center); pivot.quaternion.identity(); pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(true);
    pivotStart = pivot.matrixWorld.clone();
    poses.clear();
    for (const obj of movable) poses.set(obj, obj.matrixWorld.clone());
    gizmo.attach(pivot);
    refreshOutline();
  };
  const applyPivot = () => {
    const delta = pivot.matrixWorld.clone().multiply(pivotStart.clone().invert());
    const world = new THREE.Matrix4(), inverse = new THREE.Matrix4();
    const ready = new Set<THREE.Object3D>();
    for (const [obj, base] of poses) {
      const parent = obj.parent;
      if (!parent) continue;
      if (!ready.has(parent)) { parent.updateWorldMatrix(true, false); ready.add(parent); }
      world.copy(delta).multiply(base);
      inverse.copy(parent.matrixWorld).invert().multiply(world).decompose(obj.position, obj.quaternion, obj.scale);
      obj.updateMatrixWorld();
      markDrawDirty(obj);
    }
    refreshOutline();
  };
  const stateOf = (obj: THREE.Object3D): State => ({parent: obj.parent, attached: obj.parent != null, visible: obj.visible, name: obj.name, locked: !!obj.userData.locked, pose: {position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone(), world: obj.matrixWorld.clone()}});
  const same = (a: State, b: State) => a.attached === b.attached && a.visible === b.visible && a.name === b.name && a.locked === b.locked && a.parent === b.parent && a.pose.position.distanceTo(b.pose.position) < 1e-5 && a.pose.quaternion.angleTo(b.pose.quaternion) < 1e-5 && a.pose.scale.distanceTo(b.pose.scale) < 1e-5;
  const apply = (obj: THREE.Object3D, state: State) => {
    obj.name = state.name;
    obj.userData.locked = state.locked;
    const attached = obj.parent != null;
    if (!state.attached) { obj.removeFromParent(); selected.delete(obj); if (attached) markDrawStructure(); return; }
    if (state.parent && obj.parent !== state.parent) state.parent.add(obj);
    obj.position.copy(state.pose.position); obj.quaternion.copy(state.pose.quaternion); obj.scale.copy(state.pose.scale);
    obj.visible = state.visible;
    if (state.visible) hidden.delete(obj); else hidden.add(obj);
    if (attached !== (obj.parent != null)) markDrawStructure(); else markDrawDirty(obj);
  };
  const paintHistory = () => {
    historyList.replaceChildren();
    if (!history.length) { const empty = document.createElement('p'); empty.textContent = 'No edits'; historyList.append(empty); return; }
    history.forEach((action, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = `${action.name} · ${action.count}`;
      row.className = index === cursor ? 'on' : index > cursor ? 'future' : '';
      row.onclick = () => jump(index);
      historyList.append(row);
    });
  };
  const flatState = (state: State): HistoryState => ({
    parent: state.parent && typeof state.parent.userData.id === 'string' ? state.parent.userData.id : null,
    attached: state.attached, visible: state.visible, name: state.name, locked: state.locked,
    position: state.pose.position.toArray() as HistoryState['position'],
    quaternion: state.pose.quaternion.toArray() as HistoryState['quaternion'],
    scale: state.pose.scale.toArray() as HistoryState['scale'],
  });
  const nodesOf = (obj: THREE.Object3D): HistoryNode[] | undefined => {
    const rows: HistoryNode[] = [];
    const walk = (node: THREE.Object3D) => {
      if (node.userData.fit) return;
      if (typeof node.userData.id === 'string') rows.push({id: node.userData.id, cloneOf: typeof node.userData.cloneOf === 'string' ? node.userData.cloneOf : undefined});
      for (const child of node.children) walk(child);
    };
    walk(obj);
    return rows.some(row => row.cloneOf) ? rows : undefined;
  };
  const kindOf = (obj: THREE.Object3D): HistoryStep['changes'][number]['kind'] => obj.userData.studioGroup ? 'group' : String(obj.userData.id).startsWith('studio:') && obj instanceof THREE.Mesh ? 'element' : 'part';
  const commit = (name: string, changes: Change[], extra?: {undo(): void; redo(): void}, dishes?: HistoryDish[]) => {
    if (!changes.length && !extra && !dishes?.length) return;
    for (const change of changes) if (typeof change.obj.userData.id !== 'string') change.obj.userData.id = studioId();
    const step: HistoryStep = {name, changes: changes.map(change => ({id: change.obj.userData.id as string, kind: kindOf(change.obj), name: change.obj.name, nodes: nodesOf(change.obj), before: flatState(change.before), after: flatState(change.after)})), dishes};
    const action: Action = {name, count: Math.max(changes.length, dishes?.length ?? 0, extra ? 1 : 0), step, undo() { for (const change of [...changes].reverse()) apply(change.obj, change.before); if (dishes?.length) applyDishes(dishes, 'before'); else extra?.undo(); }, redo() { for (const change of changes) apply(change.obj, change.after); if (dishes?.length) applyDishes(dishes, 'after'); else extra?.redo(); }};
    history.splice(cursor + 1);
    history.push(action);
    cursor = history.length - 1;
    paintHistory();
    options.onChange?.();
  };
  const applyDishes = (dishes: HistoryDish[], which: 'before' | 'after') => {
    const absent = dishes.filter(dish => !dish[which]);
    const present = dishes.filter(dish => dish[which]);
    if (absent.length) options.placement.drop(absent.map(dish => dish.id));
    if (present.length) options.placement.restore(present.map(dish => ({id: dish.id, item: dish.item, position: new THREE.Vector3().fromArray(dish.position), quaternion: new THREE.Quaternion().fromArray(dish.quaternion)})));
  };
  const undoAction = () => { if (cursor < 0) return; history[cursor].undo(); cursor--; bindPivot(); showHint(); paintHistory(); options.redraw(); options.onChange?.(); };
  const redoAction = () => { if (cursor + 1 >= history.length) return; cursor++; history[cursor].redo(); bindPivot(); showHint(); paintHistory(); options.redraw(); options.onChange?.(); };
  const jump = (index: number) => { while (cursor > index) undoAction(); while (cursor < index) redoAction(); };
  paintHistory();
  const setSelection = (objects: THREE.Object3D[]) => {
    selected.clear();
    for (const obj of objects) if (!hidden.has(obj)) selected.add(obj);
    bindPivot();
    showHint();
    options.redraw();
    options.onChange?.();
  };
  const choose = (objects: THREE.Object3D[], mode: 'set' | 'add' | 'toggle') => {
    const visible = objects.filter(obj => obj.visible && !hidden.has(obj));
    if (mode === 'set') setSelection(visible);
    else if (mode === 'add' || !visible.every(obj => selected.has(obj))) setSelection([...selected, ...visible]);
    else { const drop = new Set(visible); setSelection([...selected].filter(obj => !drop.has(obj))); }
  };
  const hitPart = (event: {clientX: number; clientY: number}) => {
    const study = options.study();
    if (!study) return null;
    raycaster.setFromCamera(ndc(event), options.camera);
    const hit = raycaster.intersectObject(study.root, true).find(item => item.object.visible && !item.object.userData.fit);
    if (!hit || isLocked(hit.object)) return null;
    const part = partOf(hit.object, study.root);
    return part && !isLocked(part) ? part : null;
  };
  const pick = (event: {clientX: number; clientY: number; shiftKey: boolean; ctrlKey: boolean}) => {
    const part = hitPart(event);
    if (event.shiftKey) { if (part) selected.has(part) ? selected.delete(part) : selected.add(part); }
    else if (event.ctrlKey) { if (part) selected.delete(part); }
    else { selected.clear(); if (part) selected.add(part); }
    bindPivot();
    showHint();
    options.redraw();
    options.onChange?.();
    return part;
  };
  const screenCorner = new THREE.Vector3();
  const screenOf = (obj: THREE.Object3D, rect: DOMRect) => {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const camera = options.camera;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      screenCorner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      if (screenCorner.z >= 0) continue;
      screenCorner.set(x, y, z).project(camera);
      if (screenCorner.z < -1 || screenCorner.z > 1) continue;
      minX = Math.min(minX, (screenCorner.x * .5 + .5) * rect.width + rect.left);
      maxX = Math.max(maxX, (screenCorner.x * .5 + .5) * rect.width + rect.left);
      minY = Math.min(minY, (-screenCorner.y * .5 + .5) * rect.height + rect.top);
      maxY = Math.max(maxY, (-screenCorner.y * .5 + .5) * rect.height + rect.top);
    }
    return Number.isFinite(minX) ? {minX, minY, maxX, maxY} : null;
  };
  const cancel = () => {
    if (!modal) return;
    for (const [obj, pose] of modal.poses) { obj.position.copy(pose.position); obj.quaternion.copy(pose.quaternion); obj.scale.copy(pose.scale); obj.updateMatrixWorld(); markDrawDirty(obj); }
    modal = null;
    gizmo.enabled = true;
    options.controls.enabled = true;
    bindPivot();
    showHint();
    options.redraw();
  };
  const begin = (kind: Modal['kind']) => {
    const movable = [...selected].filter(obj => !isLocked(obj));
    if (!movable.length) return;
    const center = new THREE.Vector3();
    const stored = new Map<THREE.Object3D, Pose>();
    for (const obj of movable) {
      obj.updateMatrixWorld(true);
      center.add(obj.getWorldPosition(new THREE.Vector3()));
      stored.set(obj, {position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone(), world: obj.matrixWorld.clone()});
    }
    center.multiplyScalar(1 / movable.length);
    modal = {kind, axis: null, pointer: pointer.clone(), poses: stored, center};
    options.controls.enabled = false;
    gizmo.enabled = false;
    showHint();
  };
  const axisVector = (axis: Axis) => new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const worldM = new THREE.Matrix4(), inverseM = new THREE.Matrix4();
  const write = (obj: THREE.Object3D, position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3) => {
    const parent = obj.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    worldM.compose(position, quaternion, scale);
    inverseM.copy(parent.matrixWorld).invert().multiply(worldM).decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld();
    markDrawDirty(obj);
  };
  const track = (event: PointerEvent) => {
    if (!modal) return;
    ndc(event);
    const view = new THREE.Vector3();
    options.camera.getWorldDirection(view);
    const axis = modal.axis ? axisVector(modal.axis) : view;
    const place = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3();
    if (modal.kind === 'grab') {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(view, modal.center);
      const start = new THREE.Vector3(), now = new THREE.Vector3();
      raycaster.setFromCamera(modal.pointer, options.camera); raycaster.ray.intersectPlane(plane, start);
      raycaster.setFromCamera(pointer, options.camera); if (!raycaster.ray.intersectPlane(plane, now)) return;
      let delta = now.sub(start);
      if (modal.axis) delta = axis.clone().multiplyScalar(delta.dot(axis));
      for (const [obj, pose] of modal.poses) {
        pose.world.decompose(place, quat, scale);
        write(obj, place.add(delta), quat, scale);
      }
    } else if (modal.kind === 'rotate') {
      const origin = modal.center.clone().project(options.camera);
      const angle = Math.atan2(pointer.y - origin.y, pointer.x - origin.x) - Math.atan2(modal.pointer.y - origin.y, modal.pointer.x - origin.x);
      const spin = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      for (const [obj, pose] of modal.poses) {
        pose.world.decompose(place, quat, scale);
        write(obj, place.sub(modal.center).applyQuaternion(spin).add(modal.center), spin.clone().multiply(quat), scale);
      }
    } else {
      const origin = modal.center.clone().project(options.camera);
      const factor = Math.max(.02, pointer.distanceTo(new THREE.Vector2(origin.x, origin.y))) / Math.max(.02, modal.pointer.distanceTo(new THREE.Vector2(origin.x, origin.y)));
      for (const [obj, pose] of modal.poses) {
        pose.world.decompose(place, quat, scale);
        const offset = place.clone().sub(modal.center);
        if (modal.axis) {
          const component = modal.axis === 'x' ? 0 : modal.axis === 'y' ? 1 : 2;
          offset.setComponent(component, offset.getComponent(component) * factor);
          scale.setComponent(component, scale.getComponent(component) * factor);
        } else { offset.multiplyScalar(factor); scale.multiplyScalar(factor); }
        write(obj, offset.add(modal.center), quat, scale);
      }
    }
    refreshOutline();
    options.redraw();
  };
  const confirm = () => {
    if (modal) {
      const changes: Change[] = [];
      for (const [obj, pose] of modal.poses) {
        const before: State = {parent: obj.parent, attached: obj.parent != null, visible: true, name: obj.name, locked: !!obj.userData.locked, pose};
        const after = stateOf(obj);
        if (!same(before, after)) changes.push({obj, before, after});
      }
      commit(modal.kind === 'grab' ? 'Move' : modal.kind === 'rotate' ? 'Rotate' : 'Scale', changes);
    }
    modal = null; gizmo.enabled = true; options.controls.enabled = true; bindPivot(); showHint(); options.redraw();
  };
  gizmo.addEventListener('objectChange', () => { applyPivot(); options.redraw(); });
  gizmo.addEventListener('dragging-changed', event => {
    const dragging = !!(event as {value?: boolean}).value;
    options.controls.enabled = !dragging;
    if (dragging) gizmoBefore = new Map([...selected].map(obj => [obj, stateOf(obj)]));
    else if (gizmoBefore) {
      const changes: Change[] = [];
      for (const [obj, before] of gizmoBefore) { const after = stateOf(obj); if (!same(before, after)) changes.push({obj, before, after}); }
      const mode = gizmo.getMode();
      commit(mode === 'rotate' ? 'Rotate' : mode === 'scale' ? 'Scale' : 'Move', changes);
      gizmoBefore = null;
    }
  });
  const onHandle = () => (gizmo as {axis: string | null}).axis != null;
  const finishBox = (gesture: {x: number; y: number; shift: boolean; ctrl: boolean}, event: PointerEvent) => {
    band.style.display = 'none';
    const study = options.study();
    const rect = options.dom.getBoundingClientRect();
    const x0 = Math.min(gesture.x, event.clientX), x1 = Math.max(gesture.x, event.clientX);
    const y0 = Math.min(gesture.y, event.clientY), y1 = Math.max(gesture.y, event.clientY);
    const candidates = study ? parts().flatMap(obj => {
      const screen = screenOf(obj, rect);
      return screen && screen.maxX >= x0 && screen.minX <= x1 && screen.maxY >= y0 && screen.minY <= y1 ? [{obj, ...screen}] : [];
    }) : [];
    const width = Math.max(1, x1 - x0), height = Math.max(1, y1 - y0);
    const cols = Math.min(32, Math.max(1, Math.ceil(width / 5))), rows = Math.min(32, Math.max(1, Math.ceil(height / 5)));
    const samples: {clientX: number; clientY: number}[] = [];
    for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) samples.push({clientX: x0 + (ix + .5) * width / cols, clientY: y0 + (iy + .5) * height / rows});
    const stepX = width / cols, stepY = height / rows;
    for (const cand of candidates) {
      const cx = (cand.minX + cand.maxX) / 2, cy = (cand.minY + cand.maxY) / 2;
      if (cand.maxX - cand.minX < stepX && cand.maxY - cand.minY < stepY && cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) samples.push({clientX: cx, clientY: cy});
    }
    const picked = new Set<THREE.Object3D>();
    for (const samplePoint of samples) {
      raycaster.setFromCamera(ndc(samplePoint), options.camera);
      let best: THREE.Object3D | null = null, distance = Infinity;
      for (const cand of candidates) {
        if (samplePoint.clientX < cand.minX || samplePoint.clientX > cand.maxX || samplePoint.clientY < cand.minY || samplePoint.clientY > cand.maxY) continue;
        const hit = raycaster.intersectObject(cand.obj, true).find(item => item.object.visible && !item.object.userData.fit);
        if (hit && hit.distance < distance) {
          distance = hit.distance;
          const obj = partOf(hit.object, study!.root);
          best = obj && !isLocked(hit.object) && !isLocked(obj) ? obj : null;
        }
      }
      if (best) picked.add(best);
    }
    if (!gesture.shift && !gesture.ctrl) selected.clear();
    for (const obj of picked) selected.add(obj);
    bindPivot();
    showHint();
    options.redraw();
    options.onChange?.();
  };
  options.dom.addEventListener('pointerdown', event => {
    if (event.button === 2 || (event.button === 0 && event.altKey)) { event.preventDefault(); event.stopPropagation(); }
    if (modal) return;
    const alt = event.altKey && (event.button === 0 || event.button === 2);
    if (boxing && event.button === 0 && !alt) { down = {x: event.clientX, y: event.clientY, button: 0, shift: event.shiftKey, ctrl: event.ctrlKey, alt: false, gizmo: false}; dragged = false; return; }
    if (event.button === 0 && !alt && (options.armed() || onHandle())) return;
    if (event.button !== 0 && !alt && event.button !== 2) return;
    if (event.button === 0 || event.button === 2) {
      down = {x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey, ctrl: event.ctrlKey, alt, gizmo: onHandle()};
      dragged = false;
      if (alt) options.dom.setPointerCapture(event.pointerId);
      queueHover(null);
    }
  }, true);
  options.dom.addEventListener('pointermove', event => {
    if (modal) { track(event); return; }
    if (!down) { queueHover(event); return; }
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 3) dragged = true;
    if ((boxing || down.alt) && dragged) {
      const host = options.dom.parentElement!.getBoundingClientRect();
      band.style.display = 'block';
      band.style.left = `${Math.min(down.x, event.clientX) - host.left}px`;
      band.style.top = `${Math.min(down.y, event.clientY) - host.top}px`;
      band.style.width = `${Math.abs(event.clientX - down.x)}px`;
      band.style.height = `${Math.abs(event.clientY - down.y)}px`;
    }
  });
  options.dom.addEventListener('pointerleave', () => queueHover(null));
  options.dom.addEventListener('pointerup', event => {
    if (modal) {
      if (event.button === 0) confirm();
      else if (event.button === 2) cancel();
      return;
    }
    if (!down || event.button !== down.button) return;
    const gesture = down;
    down = null;
    if (gesture.alt || (boxing && gesture.button === 0)) {
      boxing = false;
      if (dragged) finishBox(gesture, event);
      else pick({clientX: gesture.x, clientY: gesture.y, shiftKey: gesture.shift, ctrlKey: gesture.ctrl});
      return;
    }
    if (gesture.button === 2 && !dragged) {
      const part = hitPart({clientX: gesture.x, clientY: gesture.y});
      if (part && !selected.has(part)) pick({clientX: gesture.x, clientY: gesture.y, shiftKey: false, ctrlKey: false});
      menu.open(event.clientX, event.clientY);
      return;
    }
    if (!dragged && !gesture.gizmo) pick({clientX: gesture.x, clientY: gesture.y, shiftKey: gesture.shift, ctrlKey: gesture.ctrl});
  });
  const onKey = (event: KeyboardEvent) => {
    if (typing(event)) return;
    if ((menu.visible() || createMenu.visible()) && event.code === 'Escape') { menu.close(); createMenu.close(); event.preventDefault(); event.stopPropagation(); return; }
    if (modal) {
      if (event.code === 'KeyX' || event.code === 'KeyY' || event.code === 'KeyZ') modal.axis = event.code === 'KeyX' ? 'x' : event.code === 'KeyY' ? 'y' : 'z';
      else if (event.code === 'Enter') confirm();
      else if (event.code === 'Escape') cancel();
      else return;
      event.preventDefault(); event.stopPropagation(); options.redraw(); return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.code === 'KeyA') setSelection(parts().filter(obj => !isLocked(obj)));
    else if (event.altKey && event.code === 'KeyA') setSelection([]);
    else if (ctrl && event.code === 'KeyI') { const next = parts().filter(obj => !selected.has(obj) && !isLocked(obj)); setSelection(next); }
    else if (ctrl && event.code === 'KeyZ' && event.shiftKey) redoAction();
    else if (ctrl && event.code === 'KeyY') redoAction();
    else if (ctrl && event.code === 'KeyZ') undoAction();
    else if (ctrl && event.code === 'KeyC' && !event.shiftKey && selected.size) copyDescription();
    else if (event.shiftKey && event.code === 'KeyD') duplicate();
    else if (event.code === 'KeyB') { boxing = true; showHint(); }
    else if (ctrl && event.code === 'KeyG' && event.shiftKey) ungroupSelected();
    else if (ctrl && event.code === 'KeyG') groupSelected();
    else if (!ctrl && event.code === 'KeyG' && selected.size) { gizmo.setMode('translate'); showHint(); options.redraw(); options.onSetup?.(); }
    else if (!ctrl && event.code === 'KeyR' && selected.size) { gizmo.setMode('rotate'); showHint(); options.redraw(); options.onSetup?.(); }
    else if (!ctrl && event.code === 'KeyS' && selected.size) { gizmo.setMode('scale'); showHint(); options.redraw(); options.onSetup?.(); }
    else if (event.code === 'KeyH' && event.altKey) showObjects([...hidden]);
    else if (event.code === 'KeyL' && selected.size && !ctrl) toggleLock();
    else if (event.code === 'KeyH' && selected.size) hideObjects([...selected]);
    else if (event.code === 'F2' && [...selected].filter(userNamed).length === 1) options.nameObject?.([...selected].find(userNamed)!);
    else if ((event.code === 'Delete' || event.code === 'Backspace' || event.code === 'KeyX') && selected.size && !ctrl) remove();
    else if (event.code === 'Escape') { boxing = false; band.style.display = 'none'; setSelection([]); }
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  function topmost(objects: THREE.Object3D[]) {
    const set = new Set(objects);
    return objects.filter(obj => { let parent = obj.parent; while (parent) { if (set.has(parent)) return false; parent = parent.parent; } return true; });
  }
  function groupSelected() {
    const study = options.study();
    const tops = topmost([...selected].filter(obj => obj.parent && !isLocked(obj)));
    if (!study || !tops.length) return;
    const host = tops.every(obj => obj.parent === tops[0].parent) ? tops[0].parent! : study.root;
    const before = new Map(tops.map(obj => [obj, stateOf(obj)]));
    const box = new THREE.Box3();
    for (const obj of tops) box.expandByObject(obj);
    const group = new THREE.Group();
    group.name = translate('New group');
    group.userData.studioGroup = true;
    host.add(group);
    host.updateWorldMatrix(true, false);
    group.position.copy(host.worldToLocal(box.getCenter(new THREE.Vector3())));
    group.updateMatrixWorld(true);
    for (const obj of tops) group.attach(obj);
    const pose = stateOf(group);
    const changes: Change[] = [{obj: group, before: {parent: host, attached: false, visible: true, name: group.name, locked: false, pose: pose.pose}, after: pose}];
    for (const obj of tops) { changes.push({obj, before: before.get(obj)!, after: stateOf(obj)}); markDrawDirty(obj); }
    commit('Group', changes);
    setSelection([group]);
    options.nameObject?.(group);
  }
  function ungroupSelected() {
    const groups = [...selected].filter(obj => obj.userData.studioGroup && obj.parent && !isLocked(obj));
    if (!groups.length) return;
    const changes: Change[] = [];
    const freed: THREE.Object3D[] = [];
    for (const group of groups) {
      const host = group.parent!;
      const children = [...group.children];
      const childBefore = children.map(obj => stateOf(obj));
      for (const obj of children) host.attach(obj);
      children.forEach((obj, index) => { changes.push({obj, before: childBefore[index], after: stateOf(obj)}); markDrawDirty(obj); });
      const pose = stateOf(group);
      group.removeFromParent();
      changes.push({obj: group, before: pose, after: {parent: pose.parent, attached: false, visible: pose.visible, name: pose.name, locked: pose.locked, pose: pose.pose}});
      freed.push(...children);
    }
    commit('Ungroup', changes);
    setSelection(freed);
  }
  const menu = mountContextMenu(() => {
    const has = selected.size > 0;
    return [
      {label: 'Group', shortcut: 'Ctrl+G', enabled: [...selected].some(obj => !isLocked(obj)), run: groupSelected},
      {label: 'Ungroup', shortcut: 'Ctrl+Shift+G', enabled: [...selected].some(obj => obj.userData.studioGroup && !isLocked(obj)), run: ungroupSelected},
      {label: 'Rename', shortcut: 'F2', enabled: [...selected].filter(userNamed).length === 1, run: () => { const obj = [...selected].find(userNamed); if (obj) options.nameObject?.(obj); }},
      {gap: true, label: '', enabled: false, run() {}},
      {label: 'Copy description', shortcut: 'Ctrl+C', enabled: has, run: copyDescription},
      {label: 'Duplicate', shortcut: 'Shift+D', enabled: has, run: duplicate},
      {label: 'Delete', shortcut: 'Del', enabled: [...selected].some(obj => !isLocked(obj)), run: remove},
      {gap: true, label: '', enabled: false, run() {}},
      {label: 'Lock', shortcut: 'L', enabled: [...selected].some(obj => !isLocked(obj)), run: () => setLocked([...selected].filter(obj => !isLocked(obj)), true)},
      {label: 'Unlock', shortcut: 'L', enabled: [...selected].some(isLocked), run: () => setLocked([...new Set([...selected].map(lockOwner).filter((obj): obj is THREE.Object3D => !!obj))], false)},
      {label: 'Hide', shortcut: 'H', enabled: has, run: () => hideObjects([...selected])},
      {label: 'Show', shortcut: 'Alt+H', enabled: has || hidden.size > 0, run: () => { const hiddenSelected = [...selected].filter(obj => !obj.visible); showObjects(hiddenSelected.length ? hiddenSelected : [...hidden]); }},
      {gap: true, label: '', enabled: false, run() {}},
      {label: 'Frame selection', shortcut: '', enabled: has && !!options.frame, run: () => options.frame?.([...selected])},
      {gap: true, label: '', enabled: false, run() {}},
      {label: 'Create layer', enabled: !!options.study(), run: createLayer},
      {label: 'Create element', enabled: !!options.study(), run: createElement},
    ];
  });
  function parentForNew() {
    const study = options.study();
    if (!study) return null;
    return [...selected].find(obj => obj.userData.studioGroup && obj.parent) ?? study.root;
  }
  function introduce(obj: THREE.Object3D, action: string) {
    const parent = parentForNew();
    if (!parent) return;
    if (typeof obj.userData.id !== 'string') obj.userData.id = studioId();
    parent.add(obj);
    parent.updateWorldMatrix(true, false);
    obj.position.copy(parent.worldToLocal(options.controls.target.clone()));
    obj.updateMatrixWorld(true);
    const after = stateOf(obj);
    if (obj instanceof THREE.Mesh) markDrawStructure();
    commit(action, [{obj, before: {parent, attached: false, visible: true, name: obj.name, locked: false, pose: after.pose}, after}]);
    setSelection([obj]);
  }
  function createLayer() {
    const layer = new THREE.Group();
    layer.name = translate('Layer');
    layer.userData.studioGroup = true;
    introduce(layer, 'Layer');
    options.nameObject?.(layer);
  }
  function createElement() {
    const mesh = new THREE.Mesh(elementGeometry, elementMaterial);
    mesh.name = translate('Element');
    mesh.castShadow = mesh.receiveShadow = true;
    introduce(mesh, 'Element');
  }
  const createMenu = mountContextMenu(() => [
    {label: 'Create layer', enabled: !!options.study(), run: createLayer},
    {label: 'Create element', enabled: !!options.study(), run: createElement},
  ]);
  function copyDescription() {
    const study = options.study();
    const objects = topmost([...selected].filter(obj => obj.parent));
    if (!study || !objects.length) return;
    const num = (value: number) => value.toFixed(2);
    const point = (value: THREE.Vector3) => `(${num(value.x)}, ${num(value.y)}, ${num(value.z)})`;
    const measure = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = study.root.worldToLocal(box.getCenter(new THREE.Vector3()));
      const dims = [size.x, size.y, size.z].sort((a, b) => b - a).map(num).join(' × ');
      return {box, center, dims};
    };
    const lines = [options.caption?.() ?? 'Building study', 'Change only these parts. An id is the model source file and line; #n is the nth part emitted from that line.', ''];
    const few = objects.length <= 16;
    if (!few) {
      const buckets = new Map<string, {label: string; dims: string; count: number; min: THREE.Vector3; max: THREE.Vector3; ids: string[]}>();
      for (const obj of objects) {
        const {center, dims} = measure(obj);
        const label = objectLabel(obj);
        const key = `${label}|${dims}`;
        const bucket = buckets.get(key);
        const id = objectId(obj);
        if (!bucket) buckets.set(key, {label, dims, count: 1, min: center.clone(), max: center.clone(), ids: id ? [id] : []});
        else { bucket.count++; bucket.min.min(center); bucket.max.max(center); if (id) bucket.ids.push(id); }
      }
      lines.push(`${objects.length} parts, grouped by kind and size. Centers are metres in building space, y up.`);
      for (const bucket of buckets.values()) {
        lines.push(`- ${bucket.label}, ${bucket.dims} m × ${bucket.count}`);
        lines.push(`  centers ${point(bucket.min)} to ${point(bucket.max)}`);
        if (bucket.ids.length) lines.push(`  ids ${bucket.ids.join(', ')}`);
      }
    } else for (const obj of objects) {
      const {center, dims} = measure(obj);
      const swatch = objectSwatch(obj);
      const id = objectId(obj);
      const bits = [`- ${objectLabel(obj)}`, ...(id ? [`  id ${id}`] : []), `  size ${dims} m`, `  center ${point(center)} m in building space, y up`];
      if (typeof obj.userData.item === 'string') bits.push(`  placed ${obj.userData.item}`);
      if (isLocked(obj)) bits.push('  locked');
      if (obj.userData.studioGroup) bits.push(`  group, ${obj.children.length} children`);
      if (swatch) bits.push(`  color ${swatch}`);
      const parent = obj.parent;
      if (parent?.userData.studioGroup) bits.push(`  inside ${parent.name || 'Group'}`);
      lines.push(bits.join('\n'));
    }
    const text = lines.join('\n');
    const done = () => { options.setHint('Copied'); window.setTimeout(() => options.setHint(null), 1200); };
    const fallback = () => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('data-no-i18n', '');
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      done();
    };
    const pending = navigator.clipboard?.writeText(text);
    if (pending) pending.then(done, fallback);
    else fallback();
  }
  function duplicate() {
    const copies: THREE.Object3D[] = [];
    for (const obj of selected) {
      const copy = obj.clone(false);
      copy.userData = {...obj.userData, id: studioId(), cloneOf: typeof obj.userData.id === 'string' ? obj.userData.id : undefined, locked: false};
      for (const child of obj.children) copy.add(child.clone(true));
      copy.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const cloneOf = child === copy ? copy.userData.cloneOf : typeof child.userData.id === 'string' ? child.userData.id : undefined;
        const id = child === copy ? copy.userData.id : studioId();
        child.geometry = child.geometry.clone();
        child.userData = {...child.userData, part: true, id, cloneOf, locked: false};
      });
      obj.parent?.add(copy);
      copy.position.x += .4;
      copies.push(copy);
    }
    if (!copies.length) return;
    markDrawStructure();
    setSelection(copies);
    commit('Duplicate', copies.map(obj => ({obj, before: {parent: obj.parent, attached: false, visible: true, name: obj.name, locked: false, pose: {position: obj.position.clone(), quaternion: obj.quaternion.clone(), scale: obj.scale.clone(), world: obj.matrixWorld.clone()}}, after: stateOf(obj)})));
  }
  function hideObjects(list: THREE.Object3D[]) {
    const targets = list.filter(obj => obj.visible);
    if (!targets.length) return;
    const changes: Change[] = [];
    for (const obj of targets) { const before = stateOf(obj); obj.visible = false; hidden.add(obj); changes.push({obj, before, after: stateOf(obj)}); markDrawDirty(obj); }
    commit('Hide', changes);
    bindPivot();
    showHint();
    options.redraw();
  }
  function showObjects(list: THREE.Object3D[]) {
    const targets = list.filter(obj => !obj.visible);
    if (!targets.length) return;
    const changes: Change[] = [];
    for (const obj of targets) { const before = stateOf(obj); obj.visible = true; hidden.delete(obj); changes.push({obj, before, after: stateOf(obj)}); markDrawDirty(obj); }
    commit('Show', changes);
    bindPivot();
    showHint();
    options.redraw();
  }
  function remove() {
    if (!selected.size) return;
    const plain = [...selected].filter(obj => typeof obj.userData.partId !== 'string' && !isLocked(obj));
    const dishes = [...selected].filter(obj => typeof obj.userData.partId === 'string' && !isLocked(obj)).map(obj => ({id: obj.userData.partId as string, item: obj.userData.item as string, position: obj.position.clone(), quaternion: obj.quaternion.clone()}));
    if (!plain.length && !dishes.length) return;
    markDrawStructure();
    const changes: Change[] = plain.map(obj => ({obj, before: stateOf(obj), after: stateOf(obj)}));
    for (const obj of plain) obj.removeFromParent();
    for (const change of changes) change.after = stateOf(change.obj);
    if (dishes.length) options.placement.drop(dishes.map(dish => dish.id));
    const dishLog = dishes.map(dish => ({id: dish.id, item: dish.item, position: dish.position.toArray() as HistoryDish['position'], quaternion: dish.quaternion.toArray() as HistoryDish['quaternion'], before: true, after: false}));
    commit('Delete', changes, undefined, dishLog.length ? dishLog : undefined);
    setSelection([...selected].filter(isLocked));
  }
  function setLocked(list: THREE.Object3D[], locked: boolean) {
    const targets = list.filter(obj => !!obj.userData.locked !== locked);
    if (!targets.length) return;
    const changes: Change[] = [];
    for (const obj of targets) {
      const before = stateOf(obj);
      obj.userData.locked = locked;
      changes.push({obj, before, after: stateOf(obj)});
    }
    commit(locked ? 'Lock' : 'Unlock', changes);
    bindPivot();
    showHint();
    options.redraw();
    options.onChange?.();
  }
  function toggleLock() {
    const list = [...selected];
    if (list.some(obj => !isLocked(obj))) setLocked(list.filter(obj => !isLocked(obj)), true);
    else setLocked([...new Set(list.map(lockOwner).filter((obj): obj is THREE.Object3D => !!obj))], false);
  }
  showHint();
  addEventListener('keydown', onKey, true);
  const historySnapshot = (): HistoryLog => ({cursor, steps: history.map(action => action.step)});
  const installHistory = (log: HistoryLog) => {
    const study = options.study();
    if (!study) return;
    history.splice(0);
    cursor = -1;
    const byId = new Map<string, THREE.Object3D>();
    study.root.traverse(obj => { if (typeof obj.userData.id === 'string') byId.set(obj.userData.id, obj); });
    for (const step of log.steps) {
      for (const change of step.changes) { const match = /^studio:(\d+)$/.exec(change.id); if (match) studioSerial = Math.max(studioSerial, Number(match[1])); }
      const track = (change: HistoryStep['changes'][number]) => {
        const obj = byId.get(change.id);
        if (!obj) return;
        if (!obj.parent) { hidden.delete(obj); selected.delete(obj); markDrawStructure(); return; }
        if (obj.visible) hidden.delete(obj); else hidden.add(obj);
        markDrawDirty(obj);
      };
      const action: Action = {name: step.name, count: Math.max(step.changes.length, step.dishes?.length ?? 0, 1), step, undo() { for (const change of [...step.changes].reverse()) { applyHistoryChange(study.root, byId, change, 'before'); track(change); } if (step.dishes?.length) applyDishes(step.dishes, 'before'); }, redo() { for (const change of step.changes) { applyHistoryChange(study.root, byId, change, 'after'); track(change); } if (step.dishes?.length) applyDishes(step.dishes, 'after'); }};
      history.push(action);
    }
    const target = Math.min(log.cursor, history.length - 1);
    while (cursor < target) { cursor++; history[cursor].redo(); }
    markDrawStructure();
    paintHistory();
    bindPivot();
    showHint();
    options.redraw();
    options.onChange?.();
  };
  function applyPose(objects: THREE.Object3D[], next: {position?: number[]; quaternion?: number[]; scale?: number[]}) {
    const movable = objects.filter(obj => obj.parent && !isLocked(obj));
    if (!movable.length) return;
    const changes: Change[] = [];
    for (const obj of movable) {
      const before = stateOf(obj);
      if (next.position) obj.position.fromArray(next.position);
      if (next.quaternion) obj.quaternion.fromArray(next.quaternion).normalize();
      if (next.scale) obj.scale.fromArray(next.scale);
      obj.updateMatrixWorld();
      markDrawDirty(obj);
      const after = stateOf(obj);
      if (!same(before, after)) changes.push({obj, before, after});
    }
    commit(next.position ? 'Move' : next.quaternion ? 'Rotate' : 'Scale', changes);
    bindPivot();
    showHint();
    options.redraw();
  }
  const rename = (obj: THREE.Object3D, name: string) => {
    const next = name.trim();
    if (!userNamed(obj) || !next || next === obj.name) return;
    const before = stateOf(obj);
    obj.name = next;
    commit('Rename', [{obj, before, after: stateOf(obj)}]);
  };
  return {clear() { if (modal) cancel(); menu.close(); createMenu.close(); boxing = false; band.style.display = 'none'; history.splice(0); cursor = -1; paintHistory(); setSelection([]); }, audit(name: string, undo: () => void, redo: () => void, dishes?: HistoryDish[]) { commit(name, [], dishes?.length ? undefined : {undo, redo}, dishes); }, historySnapshot, installHistory, mode: () => gizmo.getMode(), setMode(next: 'translate' | 'rotate' | 'scale') { gizmo.setMode(next); showHint(); options.redraw(); }, choose, hide: hideObjects, show: showObjects, lock: setLocked, pose: applyPose, group(objects: THREE.Object3D[]) { setSelection(objects); groupSelected(); }, ungroup(objects: THREE.Object3D[]) { setSelection(objects); ungroupSelected(); }, undo: undoAction, redo: redoAction, rename, selected: () => [...selected], openMenu: menu.open, openCreate: createMenu.open, dispose() {
    if (hoverQueued) cancelAnimationFrame(hoverQueued); removeEventListener('keydown', onKey, true); menu.dispose(); createMenu.dispose(); gizmo.dispose();
    for (const helper of [hover, ...boxHelpers]) { helper.removeFromParent(); helper.geometry.dispose(); (helper.material as THREE.Material).dispose(); }
    elementGeometry.dispose(); elementMaterial.dispose(); pivot.removeFromParent(); band.remove(); historyHost.remove();
  }};
}
