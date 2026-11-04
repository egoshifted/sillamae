import * as THREE from 'three';
import {markDrawStructure} from '../edit/draw.ts';
import type {ToolboxItem} from './item.ts';

interface Placed {id: string; item: string; position: THREE.Vector3; quaternion: THREE.Quaternion}

export function mountPlacement(options: {
  dom: HTMLElement;
  camera: THREE.Camera;
  study(): {scene: THREE.Scene; root: THREE.Object3D} | undefined;
  buildingId(): string;
  armed(): ToolboxItem | null;
  items: ToolboxItem[];
  redraw(): void;
  audit?(name: string, undo: () => void, redo: () => void, dishes?: {id: string; item: string; position: [number, number, number]; quaternion: [number, number, number, number]; before: boolean; after: boolean}[]): void;
}) {
  const byBuilding = new Map<string, Placed[]>(), raycaster = new THREE.Raycaster();
  raycaster.layers.enable(1);
  let selected: string | null = null, down: {x: number; y: number} | null = null;
  const catalog = new Map(options.items.map(item => [item.id, item]));

  function owned(object: THREE.Object3D) {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (typeof node.userData.partId === 'string') return node.userData.partId as string;
    return null;
  }
  function ground(object: THREE.Object3D) {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.name === 'study-ground') return true;
    return false;
  }
  function refresh() {
    const study = options.study();
    if (!study) return;
    for (const child of [...study.root.children]) if (typeof child.userData.partId === 'string') {
      study.root.remove(child);
      child.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    }
    for (const placed of byBuilding.get(options.buildingId()) ?? []) {
      const item = catalog.get(placed.item);
      if (!item) continue;
      const mesh = item.create();
      mesh.position.copy(placed.position); mesh.quaternion.copy(placed.quaternion); mesh.userData.partId = placed.id; mesh.userData.item = placed.item;
      if (placed.id === selected) mesh.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).emissive?.set('#8a5a12'); });
      study.root.add(mesh);
    }
    markDrawStructure();
  }
  function put(itemId: string, position: [number, number, number]) {
    const item = catalog.get(itemId);
    const study = options.study();
    if (!item || !study) return;
    const mesh = item.create();
    study.scene.add(mesh);
    mesh.position.fromArray(position);
    study.root.attach(mesh);
    const id = 'p' + Date.now().toString(36);
    const list = byBuilding.get(options.buildingId()) ?? [];
    const record = {id, item: item.id, position: mesh.position.clone(), quaternion: mesh.quaternion.clone()};
    list.push(record);
    byBuilding.set(options.buildingId(), list);
    study.root.remove(mesh);
    mesh.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    selected = id;
    refresh();
    options.redraw();
    options.audit?.('Place', () => drop([id]), () => restore([record]), [{id, item: record.item, position: record.position.toArray() as [number, number, number], quaternion: record.quaternion.toArray() as [number, number, number, number], before: false, after: true}]);
  }
  function place(item: ToolboxItem, hit: THREE.Intersection) {
    const study = options.study();
    if (!study) return;
    const normal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3(0, 1, 0);
    if (normal.y < -.2) normal.y = 0;
    normal.normalize();
    const mesh = item.create();
    study.scene.add(mesh);
    mesh.position.copy(hit.point);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    study.root.attach(mesh);
    const id = 'p' + Date.now().toString(36);
    const list = byBuilding.get(options.buildingId()) ?? [];
    list.push({id, item: item.id, position: mesh.position.clone(), quaternion: mesh.quaternion.clone()});
    byBuilding.set(options.buildingId(), list);
    study.root.remove(mesh);
    mesh.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    selected = id;
    refresh();
    options.redraw();
    const record = list[list.length - 1];
    options.audit?.('Place', () => drop([id]), () => restore([record]), [{id, item: record.item, position: record.position.toArray() as [number, number, number], quaternion: record.quaternion.toArray() as [number, number, number, number], before: false, after: true}]);
  }
  function drop(ids: string[]) {
    const id = options.buildingId();
    byBuilding.set(id, (byBuilding.get(id) ?? []).filter(part => !ids.includes(part.id)));
    if (selected && ids.includes(selected)) selected = null;
    refresh();
    options.redraw();
  }
  function restore(parts: Placed[]) {
    const id = options.buildingId();
    const list = byBuilding.get(id) ?? [];
    for (const part of parts) if (!list.some(item => item.id === part.id)) list.push(part);
    byBuilding.set(id, list);
    refresh();
    options.redraw();
  }

  options.dom.addEventListener('pointerdown', event => { if (event.button === 0) down = {x: event.clientX, y: event.clientY}; });
  options.dom.addEventListener('pointerup', event => {
    const study = options.study();
    if (event.button !== 0 || !down || !study) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5;
    down = null;
    if (moved || !options.armed()) return;
    const rect = options.dom.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), options.camera);
    const hits = raycaster.intersectObject(study.scene, true).filter(hit => !ground(hit.object));
    const existing = hits.map(hit => owned(hit.object)).find(id => id);
    if (existing) { selected = existing; refresh(); options.redraw(); return; }
    const item = options.armed();
    if (item && hits[0]) place(item, hits[0]);
  });
  addEventListener('keydown', event => {
    if ((event.code !== 'Delete' && event.code !== 'Backspace') || !selected || (event.target instanceof Element && event.target.closest('input, textarea, select, .menu'))) return;
    const id = options.buildingId();
    const part = (byBuilding.get(id) ?? []).find(item => item.id === selected);
    if (!part) return;
    const copy = {id: part.id, item: part.item, position: part.position.clone(), quaternion: part.quaternion.clone()};
    drop([part.id]);
    options.audit?.('Delete', () => restore([copy]), () => drop([copy.id]), [{id: copy.id, item: copy.item, position: copy.position.toArray() as [number, number, number], quaternion: copy.quaternion.toArray() as [number, number, number, number], before: true, after: false}]);
  });
  return {refresh, drop, restore, put};
}
