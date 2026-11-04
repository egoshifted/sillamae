import type * as THREE from 'three';
import {groupParts, isLocked, lockOwner, userNamed, type GroupNode} from './group.ts';

export function mountExplorer(options: {
  host: HTMLElement;
  study(): {root: THREE.Object3D} | undefined;
  itemName(id: string): string;
  selected(): THREE.Object3D[];
  choose(objects: THREE.Object3D[], mode: 'set' | 'add' | 'toggle'): void;
  rename(obj: THREE.Object3D, name: string): void;
  hide(objects: THREE.Object3D[]): void;
  show(objects: THREE.Object3D[]): void;
  lock(objects: THREE.Object3D[], on: boolean): void;
  frame(objects: THREE.Object3D[]): void;
  onMenu(x: number, y: number): void;
  onCreate(x: number, y: number): void;
  onLayout?(): void;
}) {
  const title = document.createElement('h2');
  title.textContent = 'Explorer';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Find';
  input.autocomplete = 'off';
  input.spellcheck = false;
  const tree = document.createElement('div');
  tree.className = 'tree';
  tree.role = 'tree';
  options.host.append(title, input, tree);
  options.host.addEventListener('contextmenu', event => event.preventDefault());
  const open = new Set<string>();
  const collapsed = new Set<string>();
  let query = '';
  let paintedQuery = '';
  let paintedNames = '';
  let members: THREE.Object3D[] = [];
  let rows: {el: HTMLElement; node: GroupNode}[] = [];
  let seen: THREE.Object3D | null = null;
  let pendingLayout: {open: string[]; collapsed: string[]} | null = null;
  let fromList = false;
  let naming: THREE.Object3D | null = null;
  let scheduled = 0;

  const isOpen = (key: string, depth: number) => query.length > 0 || (!collapsed.has(key) && open.has(key) && depth >= 0);
  const same = (next: THREE.Object3D[]) => next.length === members.length && next.every((obj, index) => obj === members[index]);
  const namedSignature = (objects: THREE.Object3D[]) => {
    const names: string[] = [];
    const walk = (obj: THREE.Object3D) => {
      if (userNamed(obj)) names.push(obj.name);
      for (const child of obj.children) if (!child.userData.fit) walk(child);
    };
    for (const obj of objects) walk(obj);
    return names.join('\n');
  };
  const grouped = (objects: THREE.Object3D[]) => groupParts(objects, options.itemName);
  const toggle = (key: string, depth: number) => {
    if (isOpen(key, depth)) { open.delete(key); collapsed.add(key); }
    else { collapsed.delete(key); open.add(key); }
    options.onLayout?.();
    const objects = current();
    paint(objects, grouped(objects));
  };
  const current = () => {
    const root = options.study()?.root;
    if (root !== seen) {
      seen = root ?? null; query = ''; input.value = ''; open.clear(); collapsed.clear();
      if (pendingLayout) {
        for (const key of pendingLayout.open) open.add(key);
        for (const key of pendingLayout.collapsed) collapsed.add(key);
        pendingLayout = null;
      }
    }
    if (!root) return [];
    const children = [...root.children].filter(child => !child.userData.fit);
    return children.length ? children : [root];
  };
  const prune = (node: GroupNode, q: string): GroupNode | null => {
    if (!q) return node;
    const self = node.label.toLowerCase().includes(q);
    const children = node.children.map(child => prune(child, q)).filter((child): child is GroupNode => child != null);
    if (!self && !children.length) return null;
    return self ? node : {...node, children};
  };
  const reveal = (key: string) => {
    let changed = false;
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/');
      if (!isOpen(ancestor, i - 1)) { collapsed.delete(ancestor); open.add(ancestor); changed = true; }
    }
    return changed;
  };
  const selectedKeys = new Set<string>();
  const ancestorKeys = new Set<string>();
  const classify = (nodes: GroupNode[], picked: Set<THREE.Object3D>): boolean => {
    let hit = false;
    for (const node of nodes) {
      const self = node.objects.some(obj => picked.has(obj));
      const child = classify(node.children, picked);
      if (self) selectedKeys.add(node.key);
      if (child && !self) ancestorKeys.add(node.key);
      if (self || child) hit = true;
    }
    return hit;
  };
  const mark = (el: HTMLElement, node: GroupNode) => {
    const visible = node.objects.filter(obj => obj.visible);
    const on = selectedKeys.has(node.key);
    el.classList.toggle('on', on);
    el.classList.toggle('partial', ancestorKeys.has(node.key));
    el.setAttribute('aria-selected', String(on));
    const name = el.querySelector<HTMLElement>('.name');
    if (name && name.dataset.source !== node.label) { name.dataset.source = node.label; name.textContent = node.label; }
    el.classList.toggle('hidden', node.objects.length > 0 && visible.length === 0);
    const locked = node.objects[0] ? isLocked(node.objects[0]) : false;
    el.classList.toggle('locked', locked);
    const lock = el.querySelector<HTMLButtonElement>('.lock');
    if (lock) {
      lock.dataset.tip = locked ? 'Unlock' : 'Lock';
      lock.dataset.note = locked ? 'Unfreezes this part. A locked group unlocks from the row that holds the lock.' : 'Freezes this part or group. The view will not move, select or delete it.';
      const mark = lock.querySelector('i');
      if (mark) mark.className = locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
    }
    const eye = el.querySelector<HTMLButtonElement>('.eye');
    if (!eye) return;
    const off = visible.length === 0;
    eye.dataset.tip = off ? 'Show' : 'Hide';
    eye.dataset.note = off ? 'Shows this row again.' : 'Hides this row. The part stays in the list.';
    const icon = eye.querySelector('i');
    if (icon) icon.className = off ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  };
  const restyle = () => { for (const row of rows) mark(row.el, row.node); };
  const paint = (objects: THREE.Object3D[], nodesIn: GroupNode[]) => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('.row')?.dataset.key ?? '' : '';
    const q = query;
    const nodes = nodesIn.map(node => prune(node, q)).filter((node): node is GroupNode => node != null);
    rows = [];
    tree.replaceChildren();
    const add = (node: GroupNode, depth: number) => {
      const row = document.createElement('div');
      row.className = 'row' + (node.objects[0]?.userData.studioGroup ? ' section' : '');
      row.role = 'treeitem';
      row.tabIndex = -1;
      row.onpointerdown = () => row.focus();
      row.dataset.key = node.key;
      row.style.paddingLeft = `${depth * 14}px`;
      const twist = document.createElement('button');
      twist.type = 'button';
      twist.className = 'twist';
      twist.tabIndex = -1;
      const opened = node.children.length > 0 && isOpen(node.key, depth);
      twist.innerHTML = node.children.length ? `<i class="fa-solid ${opened ? 'fa-chevron-down' : 'fa-chevron-right'}" aria-hidden="true"></i>` : '';
      twist.onpointerdown = event => event.preventDefault();
      twist.onclick = event => { event.stopPropagation(); if (node.children.length) toggle(node.key, depth); };
      const name = document.createElement('span');
      name.className = 'name';
      name.dataset.noI18n = '';
      name.dataset.source = node.label;
      name.textContent = node.label;
      if (node.swatch) {
        const chip = document.createElement('i');
        chip.className = 'swatch';
        chip.style.background = node.swatch;
        row.append(twist, chip, name);
      } else row.append(twist, name);
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = String(node.objects.length === 1 && node.objects[0].userData.studioGroup ? node.objects[0].children.filter(child => !child.userData.fit).length : node.objects.length);
      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'eye';
      eye.tabIndex = -1;
      eye.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
      eye.onpointerdown = event => event.preventDefault();
      eye.onclick = event => {
        event.stopPropagation();
        fromList = true;
        const visible = node.objects.filter(obj => obj.visible);
        if (visible.length) options.hide(visible);
        else options.show(node.objects);
      };
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'lock';
      lock.tabIndex = -1;
      lock.innerHTML = '<i class="fa-solid fa-lock-open" aria-hidden="true"></i>';
      lock.onpointerdown = event => event.preventDefault();
      lock.onclick = event => {
        event.stopPropagation();
        const obj = node.objects[0];
        if (!obj) return;
        fromList = true;
        const owner = lockOwner(obj);
        if (owner) options.lock([owner], false);
        else options.lock([obj], true);
      };
      row.append(count, lock, eye);
      row.addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
        fromList = true;
        const picked = new Set(options.selected());
        if (!node.objects.some(obj => picked.has(obj))) options.choose(node.objects, 'set');
        options.onMenu(event.clientX, event.clientY);
      });
      row.onclick = event => {
        if (event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest('.lock, .eye, .twist')) return;
        fromList = true;
        const mode = event.shiftKey ? 'add' : event.ctrlKey || event.metaKey ? 'toggle' : 'set';
        options.choose(node.objects, mode);
      };
      row.ondblclick = event => {
        if (event.target instanceof Element && event.target.closest('.eye, .twist, .lock')) return;
        const obj = node.objects[0];
        if (event.target instanceof Element && event.target.closest('.name') && obj && userNamed(obj)) { editName(obj); return; }
        options.frame(node.objects);
      };
      mark(row, node);
      tree.append(row);
      rows.push({el: row, node});
      if (opened) for (const child of node.children) add(child, depth + 1);
    };
    for (const node of nodes) add(node, 0);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.textContent = objects.length ? 'Nothing shown' : 'Empty';
      tree.append(empty);
    }
    if (naming) {
      const row = rows.find(item => item.node.objects[0] === naming);
      const obj = naming;
      naming = null;
      if (row && obj) beginEdit(row.el, obj);
    } else if (focus) tree.querySelector<HTMLElement>(`[data-key="${CSS.escape(focus)}"]`)?.focus();
    members = objects;
    paintedQuery = q;
    paintedNames = namedSignature(objects);
  };
  const beginEdit = (row: HTMLElement, obj: THREE.Object3D) => {
    const name = row.querySelector<HTMLElement>('.name');
    if (!name) return;
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'name-edit';
    field.value = obj.name;
    field.dataset.noI18n = '';
    field.setAttribute('aria-label', 'Rename');
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      const value = field.value.trim();
      field.replaceWith(name);
      if (save && value && value !== obj.name) options.rename(obj, value);
    };
    field.onpointerdown = event => event.stopPropagation();
    field.onclick = event => event.stopPropagation();
    field.ondblclick = event => { event.stopPropagation(); event.preventDefault(); };
    field.onkeydown = event => {
      event.stopPropagation();
      if (event.code === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.code === 'Escape') { event.preventDefault(); finish(false); }
    };
    field.onblur = () => finish(true);
    name.replaceWith(field);
    field.focus();
    field.select();
  };
  const editName = (obj: THREE.Object3D) => { naming = obj; fromList = true; sync(); };
  const onKey = (event: KeyboardEvent) => {
    const list = [...tree.querySelectorAll<HTMLElement>('.row')];
    const index = list.indexOf((document.activeElement instanceof Element ? document.activeElement.closest('.row') : null) as HTMLElement);
    const row = list[index];
    if (!row) return;
    if (event.code === 'ArrowDown') list[Math.min(list.length - 1, index + 1)]?.focus();
    else if (event.code === 'ArrowUp') list[Math.max(0, index - 1)]?.focus();
    else if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
      const node = rows.find(item => item.el === row)?.node;
      if (!node) return;
      const depth = Number(row.style.paddingLeft.replace('px', '')) / 14;
      if (event.code === 'ArrowRight' && node.children.length && !isOpen(node.key, depth)) toggle(node.key, depth);
      else if (event.code === 'ArrowRight' && node.children.length) list[index + 1]?.focus();
      else if (event.code === 'ArrowRight') options.frame(node.objects);
      else if (node.children.length && isOpen(node.key, depth)) toggle(node.key, depth);
      else list.slice(0, index).reverse().find(item => Number(item.style.paddingLeft.replace('px', '')) < depth * 14)?.focus();
    } else if (event.code === 'F2') {
      const obj = rows.find(item => item.el === row)?.node.objects[0];
      if (!obj || !userNamed(obj)) return;
      editName(obj);
    } else if (event.code === 'Enter') { fromList = true; options.choose(rows.find(item => item.el === row)?.node.objects ?? [], 'set'); }
    else if (event.code === 'Space') {
      fromList = true;
      const node = rows.find(item => item.el === row)?.node;
      if (!node) return;
      const visible = node.objects.filter(obj => obj.visible);
      if (visible.length) options.hide(visible); else options.show(node.objects);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const blank = (event: Event) => event.target === tree;
  tree.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !blank(event)) return;
    options.choose([], 'set');
  });
  tree.addEventListener('contextmenu', event => {
    if (!blank(event)) return;
    event.preventDefault();
    options.choose([], 'set');
    options.onCreate(event.clientX, event.clientY);
  });
  tree.addEventListener('keydown', onKey);
  input.oninput = () => { query = input.value.trim().toLowerCase(); fromList = true; const objects = current(); paint(objects, grouped(objects)); };
  input.addEventListener('keydown', event => { if (event.code === 'ArrowDown') { tree.querySelector<HTMLElement>('.row')?.focus(); event.preventDefault(); } });
  const sync = () => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      const objects = current();
      const nodes = grouped(objects);
      const picked = new Set(options.selected());
      selectedKeys.clear();
      ancestorKeys.clear();
      classify(nodes, picked);
      let revealed = false;
      if (!fromList) for (const key of selectedKeys) if (reveal(key)) revealed = true;
      if (!same(objects) || namedSignature(objects) !== paintedNames || revealed || query !== paintedQuery || naming) paint(objects, nodes);
      else restyle();
      if (!fromList && selectedKeys.size) tree.querySelector('.row.on')?.scrollIntoView({block: 'nearest'});
      fromList = false;
    });
  };
  const useLayout = (next: {open: string[]; collapsed: string[]}) => {
    pendingLayout = {open: [...next.open], collapsed: [...next.collapsed]};
    open.clear(); collapsed.clear();
    for (const key of pendingLayout.open) open.add(key);
    for (const key of pendingLayout.collapsed) collapsed.add(key);
    sync();
  };
  return {sync, editName, useLayout, layout: () => ({open: [...open], collapsed: [...collapsed]}), dispose() { cancelAnimationFrame(scheduled); tree.removeEventListener('keydown', onKey); options.host.replaceChildren(); }};
}
