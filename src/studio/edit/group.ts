import * as THREE from 'three';

export interface GroupNode {
  key: string;
  label: string;
  swatch: string | null;
  objects: THREE.Object3D[];
  children: GroupNode[];
}

function materialOf(obj: THREE.Object3D): THREE.MeshStandardMaterial | null {
  if (obj instanceof THREE.Mesh) {
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (mat instanceof THREE.MeshStandardMaterial) return mat;
  }
  for (const child of obj.children) {
    const found = materialOf(child);
    if (found) return found;
  }
  return null;
}

function labelOf(obj: THREE.Object3D): string {
  const mat = materialOf(obj);
  if (!mat) return obj.name || 'Part';
  if (mat.name) return mat.name;
  if (mat.userData.foundationRender) return 'Foundation';
  if (mat.userData.roofMembrane || mat.userData.roofEdgeMetal) return 'Roof';
  if (mat.userData.groundSurface) return 'Apron';
  if (mat.userData.sheetMetal) return 'Metal';
  if (mat.roughness <= 0.4 && mat.metalness < 0.2) return 'Glazing';
  return 'Part';
}

function swatchOf(obj: THREE.Object3D): string | null {
  const mat = materialOf(obj);
  return mat ? '#' + mat.color.getHexString() : null;
}

export function objectId(obj: THREE.Object3D): string {
  if (typeof obj.userData.id === 'string') return obj.userData.id;
  if (typeof obj.userData.part === 'number') return `part:${obj.userData.part}`;
  return '';
}

export function isLocked(obj: THREE.Object3D) {
  for (let node: THREE.Object3D | null = obj; node; node = node.parent) if (node.userData.locked) return true;
  return false;
}
export function lockOwner(obj: THREE.Object3D) {
  for (let node: THREE.Object3D | null = obj; node; node = node.parent) if (node.userData.locked) return node;
  return null;
}
export function userNamed(obj: THREE.Object3D) {
  return !!obj.userData.studioGroup || (typeof obj.userData.id === 'string' && obj.userData.id.startsWith('studio:') && typeof obj.userData.item !== 'string');
}

export function objectLabel(obj: THREE.Object3D) {
  if (userNamed(obj)) return obj.name || (obj.userData.studioGroup ? 'Group' : 'Element');
  if (obj.name === 'original-survey') return 'Survey';
  if (obj.name === 'provisional-massing') return 'Massing';
  return labelOf(obj);
}

export function objectSwatch(obj: THREE.Object3D) {
  return obj.userData.studioGroup ? null : swatchOf(obj);
}

function nodeOf(obj: THREE.Object3D, key: string, itemName: (id: string) => string): GroupNode {
  const id = objectId(obj);
  const stable = id || key;
  if (obj.userData.studioGroup) {
    const children = obj.children.filter(child => !child.userData.fit);
    return {key: stable, label: objectLabel(obj), swatch: null, objects: [obj], children: children.map((child, index) => nodeOf(child, `${stable}/${index}`, itemName))};
  }
  const label = typeof obj.userData.item === 'string' ? itemName(String(obj.userData.item)) : objectLabel(obj);
  return {key: stable, label, swatch: objectSwatch(obj), objects: [obj], children: []};
}

export function groupParts(objects: THREE.Object3D[], itemName: (id: string) => string): GroupNode[] {
  return objects.filter(obj => !obj.userData.fit).map((obj, index) => nodeOf(obj, String(index), itemName));
}
