import * as THREE from 'three';

export interface PartVersion {
  id: string;
  name: string;
  kind: 'part' | 'group' | 'element';
  parent: string | null;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  visible: boolean;
  locked?: boolean;
  removed?: boolean;
}

interface Born {
  name: string;
  kind: PartVersion['kind'];
  parent: string | null;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  visible: boolean;
  locked?: boolean;
}

const near = (a: number[], b: number[]) => a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 1e-4);

function kindOf(obj: THREE.Object3D, id: string): PartVersion['kind'] {
  if (obj.userData.studioGroup) return 'group';
  if (id.startsWith('studio:') && obj instanceof THREE.Mesh) return 'element';
  return 'part';
}

function visit(root: THREE.Object3D, read: (obj: THREE.Object3D, id: string) => void) {
  const walk = (obj: THREE.Object3D) => {
    if (obj.userData.fit) return;
    const id = typeof obj.userData.id === 'string' ? obj.userData.id : '';
    if (id) read(obj, id);
    for (const child of obj.children) walk(child);
  };
  walk(root);
}

function pose(obj: THREE.Object3D, id: string): Born {
  const parent = obj.parent;
  return {
    name: obj.name,
    kind: kindOf(obj, id),
    parent: parent && typeof parent.userData.id === 'string' ? parent.userData.id : null,
    position: obj.position.toArray() as [number, number, number],
    quaternion: obj.quaternion.toArray() as [number, number, number, number],
    scale: obj.scale.toArray() as [number, number, number],
    visible: obj.visible,
    locked: !!obj.userData.locked,
  };
}

export function rememberParts(root: THREE.Object3D) {
  const born = new Map<string, Born>();
  visit(root, (obj, id) => born.set(id, pose(obj, id)));
  return born;
}

export function diffParts(root: THREE.Object3D, born: ReadonlyMap<string, Born>): PartVersion[] {
  const live = new Set<string>();
  const edits: PartVersion[] = [];
  visit(root, (obj, id) => {
    live.add(id);
    const now = pose(obj, id);
    const base = born.get(id);
    const same = base && base.name === now.name && base.parent === now.parent && base.visible === now.visible && !!base.locked === !!now.locked && near(base.position, now.position) && near(base.quaternion, now.quaternion) && near(base.scale, now.scale);
    if (!same) edits.push({id, ...now});
  });
  for (const id of born.keys()) if (!live.has(id)) edits.push({id, name: '', kind: 'part', parent: null, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], visible: false, removed: true});
  return edits;
}

function index(root: THREE.Object3D) {
  const byId = new Map<string, THREE.Object3D>();
  visit(root, (obj, id) => byId.set(id, obj));
  return byId;
}

export interface HistoryState {
  parent: string | null;
  attached: boolean;
  visible: boolean;
  name?: string;
  locked?: boolean;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

export interface HistoryNode {id: string; cloneOf?: string}

export interface HistoryChange {
  id: string;
  kind: 'part' | 'group' | 'element';
  name: string;
  nodes?: HistoryNode[];
  before: HistoryState;
  after: HistoryState;
}

export interface HistoryDish {
  id: string;
  item: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  before: boolean;
  after: boolean;
}

export interface HistoryStep {name: string; changes: HistoryChange[]; dishes?: HistoryDish[]}
export interface HistoryLog {cursor: number; steps: HistoryStep[]}

function nonFit(obj: THREE.Object3D) {
  const nodes: THREE.Object3D[] = [];
  const walk = (node: THREE.Object3D) => {
    if (node.userData.fit) return;
    nodes.push(node);
    for (const child of node.children) walk(child);
  };
  walk(obj);
  return nodes;
}

function createLogged(change: HistoryChange, byId: Map<string, THREE.Object3D>) {
  const sourceId = change.nodes?.find(node => node.id === change.id)?.cloneOf;
  const source = sourceId ? byId.get(sourceId) : undefined;
  if (source && change.nodes) {
    const copy = source.clone(true);
    const fresh = nonFit(copy);
    change.nodes.forEach((row, index) => {
      const node = fresh[index];
      if (!node) return;
      node.userData = {...node.userData, id: row.id, cloneOf: row.cloneOf};
      byId.set(row.id, node);
    });
    if (!byId.has(change.id)) { copy.userData.id = change.id; byId.set(change.id, copy); }
    return byId.get(change.id)!;
  }
  const obj = change.kind === 'group' ? new THREE.Group() : new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: '#c8b898', roughness: .85}));
  if (obj instanceof THREE.Mesh) { obj.castShadow = obj.receiveShadow = true; obj.material.name = 'Element'; }
  if (change.kind === 'group') obj.userData.studioGroup = true;
  obj.name = change.name;
  obj.userData.id = change.id;
  byId.set(change.id, obj);
  return obj;
}

export function applyHistoryChange(root: THREE.Object3D, byId: Map<string, THREE.Object3D>, change: HistoryChange, which: 'before' | 'after') {
  const state = change[which];
  let obj = byId.get(change.id);
  if (!obj) {
    if (!state.attached) return;
    obj = createLogged(change, byId);
  }
  if (typeof state.locked === 'boolean') obj.userData.locked = state.locked;
  if (!state.attached) { obj.removeFromParent(); return; }
  const parent = state.parent ? byId.get(state.parent) ?? root : root;
  if (obj.parent !== parent) parent.add(obj);
  if (typeof state.name === 'string') obj.name = state.name;
  obj.position.fromArray(state.position);
  obj.quaternion.fromArray(state.quaternion);
  obj.scale.fromArray(state.scale);
  obj.visible = state.visible;
  obj.updateMatrixWorld();
}

export function applyParts(root: THREE.Object3D, edits: readonly PartVersion[]) {
  const byId = index(root);
  const pending = edits.filter(edit => !edit.removed && !byId.has(edit.id));
  let guard = pending.length + 1;
  while (pending.length && guard--) {
    for (let i = 0; i < pending.length;) {
      const edit = pending[i];
      if (edit.parent && !byId.has(edit.parent)) { i++; continue; }
      const obj = edit.kind === 'group' ? new THREE.Group() : new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: '#c8b898', roughness: .85, name: 'Element'}));
      obj.name = edit.name;
      obj.userData.id = edit.id;
      if (edit.kind === 'group') obj.userData.studioGroup = true;
      if (obj instanceof THREE.Mesh) obj.castShadow = obj.receiveShadow = true;
      byId.set(edit.id, obj);
      pending.splice(i, 1);
    }
  }
  for (const edit of edits) {
    const obj = byId.get(edit.id);
    if (!obj || edit.removed) continue;
    const parent = edit.parent ? byId.get(edit.parent) : root;
    if (parent && obj.parent !== parent) parent.add(obj);
    obj.name = edit.name;
    if (typeof edit.locked === 'boolean') obj.userData.locked = edit.locked;
    obj.position.fromArray(edit.position);
    obj.quaternion.fromArray(edit.quaternion);
    obj.scale.fromArray(edit.scale);
    obj.visible = edit.visible;
    obj.updateMatrixWorld();
  }
  for (const edit of edits) if (edit.removed) byId.get(edit.id)?.removeFromParent();
}
