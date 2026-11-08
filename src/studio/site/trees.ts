import * as THREE from 'three';
import {TREE_MATCH, type PlacementSite, type SiteTree, type Tree, type WorldFrame} from '../../engine/types.ts';
import {addTrees} from '../../engine/vegetation/trees.ts';

export const BROADLEAF = 'Lehtpuu', CONIFER = 'Okaspuu';

export interface TreeItem {
  key: string; // 's:<x>,<z>' for a survey tree, 'a:<id>' for an added one
  tree: Tree;
  added?: SiteTree;
}

export const surveyKey = (t: Tree) => `s:${t.p[0].toFixed(2)},${t.p[1].toFixed(2)}`;
export const asTree = (t: SiteTree): Tree => ({p: t.p, z: t.z, h: t.h, r: t.r, type: t.type, year: 0, ...t.young && {young: true}});

export function treeItems(survey: Tree[], edits: NonNullable<PlacementSite['trees']>): TreeItem[] {
  const kept = survey.filter(t => !edits.remove.some(([x, z]) => Math.hypot(x - t.p[0], z - t.p[1]) < TREE_MATCH));
  return [...kept.map(tree => ({key: surveyKey(tree), tree})), ...edits.add.map(added => ({key: 'a:' + added.id, tree: asTree(added), added}))];
}

// The atlas's own tree builder, rebuilt whole after an edit: a square holds a few
// hundred trees, which rebuild in a few milliseconds.
export class TreeLayer {
  readonly group = new THREE.Group();
  readonly #frame: WorldFrame;
  readonly #centre: THREE.Vector3;
  #pending: Tree[] | null = null;

  constructor(parent: THREE.Object3D, frame: WorldFrame, centre: THREE.Vector3) {
    this.#frame = frame;
    this.#centre = centre;
    parent.add(this.group);
  }

  show(trees: Tree[]) {
    for (const child of [...this.group.children]) {
      child.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { (m as THREE.MeshLambertMaterial).map?.dispose(); m.dispose(); }
      });
      child.removeFromParent();
    }
    addTrees(this.group, trees, this.#frame).update(this.#centre, 10);
  }

  // Coalesces rebuilds while dragging to one per frame.
  later(trees: Tree[], done: () => void) {
    const first = !this.#pending;
    this.#pending = trees;
    if (first) requestAnimationFrame(() => { const t = this.#pending!; this.#pending = null; this.show(t); done(); });
  }
}

// Nearest positive ray distance to an upright cylinder's surface, or null.
function intoCylinder(ray: THREE.Ray, cx: number, cz: number, r: number, bottom: number, top: number) {
  const {origin: o, direction: d} = ray, fx = o.x - cx, fz = o.z - cz;
  const a = d.x * d.x + d.z * d.z, b = 2 * (fx * d.x + fz * d.z), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
  let best: number | null = null;
  const take = (s: number) => { if (s > 0 && (best === null || s < best)) best = s; };
  if (a > 1e-9 && disc >= 0) for (const s of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
    const y = o.y + d.y * s;
    if (y >= bottom && y <= top) take(s);
  }
  if (Math.abs(d.y) > 1e-9) for (const y of [bottom, top]) {
    const s = (y - o.y) / d.y;
    if ((fx + d.x * s) ** 2 + (fz + d.z * s) ** 2 <= r * r) take(s);
  }
  return best;
}

// A trunk under a crown, each an upright cylinder: close enough to click, cheap enough
// to test every tree on every move. The crown starts above the ground (spruce near it),
// so lines and objects beside a trunk stay clickable; a tree the camera stands in is skipped.
const TRUNK_PICK = .4, CROWN_BASE = {broadleaf: .25, conifer: .1};
export function pickTree(ray: THREE.Ray, items: TreeItem[], frame: WorldFrame) {
  const [ox, oz] = frame.origin;
  let best: {item: TreeItem; distance: number} | null = null;
  for (const item of items) {
    const t = item.tree, cx = t.p[0] - ox, cz = t.p[1] - oz, r = Math.max(1, t.r), y0 = t.z - frame.base;
    const crown = y0 + t.h * (t.type === CONIFER ? CROWN_BASE.conifer : CROWN_BASE.broadleaf), top = y0 + t.h;
    const fx = ray.origin.x - cx, fz = ray.origin.z - cz;
    if (fx * fx + fz * fz <= r * r && ray.origin.y >= y0 && ray.origin.y <= top) continue;
    for (const s of [intoCylinder(ray, cx, cz, r, crown, top), intoCylinder(ray, cx, cz, TRUNK_PICK, y0, crown)])
      if (s !== null && (!best || s < best.distance)) best = {item, distance: s};
  }
  return best;
}

// A see-through stand-in while placing or drawing trees.
export function treeGhost(type: string, h: number, r: number) {
  const material = new THREE.MeshBasicMaterial({color: type === CONIFER ? '#4f6c47' : '#7f9e48', transparent: true, opacity: .45, depthWrite: false});
  const crown = type === CONIFER ? new THREE.ConeGeometry(r, h * .85, 10).translate(0, h * .15 + h * .425, 0) : new THREE.SphereGeometry(1, 12, 8).scale(r, h * .38, r).translate(0, h * .62, 0);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(crown, material), new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, h * .4, 6).translate(0, h * .2, 0), material));
  return group;
}
