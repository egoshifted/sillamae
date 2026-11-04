import * as THREE from 'three';
import {isLocked, objectId, objectLabel} from '../edit/group.ts';
import type {BoundsFact, PartFact, PosePatch, StudioHost, ViewState} from './host.ts';

const round = (value: number) => Math.round(value * 1e5) / 1e5;

function kindOf(obj: THREE.Object3D): PartFact['kind'] {
  if (obj.userData.studioGroup) return 'group';
  if (typeof obj.userData.item === 'string') return 'element';
  if (String(obj.userData.id ?? '').startsWith('studio:') && obj instanceof THREE.Mesh) return 'element';
  return 'part';
}

function materialOf(obj: THREE.Object3D) {
  if (!(obj instanceof THREE.Mesh)) return null;
  const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  return material?.name || null;
}

function expand(obj: THREE.Object3D, box: THREE.Box3) {
  if (obj.userData.fit) return;
  if (obj instanceof THREE.Mesh && obj.geometry.getAttribute('position')) {
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const local = obj.geometry.boundingBox;
    if (local) {
      obj.updateWorldMatrix(true, false);
      box.union(local.clone().applyMatrix4(obj.matrixWorld));
    }
  }
  for (const child of obj.children) expand(child, box);
}

export interface StudioEditor {
  choose(objects: THREE.Object3D[], mode: 'set' | 'add' | 'toggle'): void;
  hide(objects: THREE.Object3D[]): void;
  show(objects: THREE.Object3D[]): void;
  lock(objects: THREE.Object3D[], on: boolean): void;
  group(objects: THREE.Object3D[]): void;
  ungroup(objects: THREE.Object3D[]): void;
  pose(objects: THREE.Object3D[], next: PosePatch): void;
  undo(): void;
  redo(): void;
  mode(): 'translate' | 'rotate' | 'scale';
  setMode(next: 'translate' | 'rotate' | 'scale'): void;
  selected(): THREE.Object3D[];
  historySnapshot(): {cursor: number; steps: {name: string}[]};
}

export function bindStudioHost(deps: {
  identity(): {id: string; name: string; stage: string; ready: boolean};
  root(): THREE.Object3D | undefined;
  editor: StudioEditor;
  camera(): {position: number[]; target: number[]};
  setCamera(position: number[], target: number[]): void;
  view(): ViewState;
  setView(patch: Partial<ViewState>): void;
  cost(): {triangles: number; corners: number; draws: number};
  edits(): {id: string; name: string}[];
  toolbox(): {id: string; name: string}[];
  place(item: string, position: number[]): void;
  save(): Promise<{saved?: string; error?: string}>;
}): StudioHost {
  const scene = () => {
    const root = deps.root();
    const facts: PartFact[] = [];
    const objects = new Map<string, THREE.Object3D>();
    if (!root) return {facts, objects};
    const selected = new Set(deps.editor.selected());
    const walk = (obj: THREE.Object3D) => {
      if (obj.userData.fit) return;
      const id = objectId(obj);
      if (id && obj !== root) {
        const parent = obj.parent && obj.parent !== root ? objectId(obj.parent) || null : null;
        objects.set(id, obj);
        facts.push({
          id, name: objectLabel(obj), parent, kind: kindOf(obj), material: materialOf(obj),
          visible: obj.visible, locked: isLocked(obj), selected: selected.has(obj),
          pose: {position: obj.position.toArray().map(round), quaternion: obj.quaternion.toArray().map(round), scale: obj.scale.toArray().map(round)},
        });
      }
      for (const child of obj.children) walk(child);
    };
    walk(root);
    return {facts, objects};
  };
  const take = (ids: string[]) => {
    const {objects} = scene();
    return ids.flatMap(id => { const obj = objects.get(id); return obj ? [obj] : []; });
  };
  return {
    identity: deps.identity,
    parts: () => scene().facts,
    bounds(ids) {
      const {objects} = scene();
      const found: Record<string, BoundsFact> = {};
      const size = new THREE.Vector3(), center = new THREE.Vector3();
      for (const id of ids) {
        const obj = objects.get(id);
        if (!obj) continue;
        const box = new THREE.Box3();
        expand(obj, box);
        if (box.isEmpty()) continue;
        found[id] = {size: box.getSize(size).toArray().map(round), center: box.getCenter(center).toArray().map(round)};
      }
      return found;
    },
    camera: deps.camera,
    view: deps.view,
    cost: deps.cost,
    history: () => deps.editor.historySnapshot(),
    edits: deps.edits,
    toolbox: deps.toolbox,
    select: (ids, mode) => deps.editor.choose(take(ids), mode),
    hide: ids => deps.editor.hide(take(ids)),
    show: ids => deps.editor.show(take(ids)),
    lock: (ids, on) => deps.editor.lock(take(ids), on),
    group: ids => deps.editor.group(take(ids)),
    ungroup: ids => deps.editor.ungroup(take(ids)),
    pose: (ids, next) => deps.editor.pose(take(ids), next),
    place: deps.place,
    setCamera: deps.setCamera,
    setView: deps.setView,
    undo: () => deps.editor.undo(),
    redo: () => deps.editor.redo(),
    save: deps.save,
  };
}
