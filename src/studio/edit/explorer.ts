import type * as THREE from 'three';
import {groupParts, isLocked, lockOwner, userNamed, type GroupNode} from './group.ts';
import {flattenRows, revealRow, ROW_PITCH, rowWindow, type Row} from './rows.ts';

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
  const sizer = document.createElement('div');
  sizer.className = 'tree-rows';
  tree.append(sizer);
  options.host.append(title, input, tree);
  options.host.addEventListener('contextmenu', event => event.preventDefault());
  const open = new Set<string>();
  const collapsed = new Set<string>();
  let query = '';
  let paintedQuery = '';
  let paintedNames = '';
  let members: THREE.Object3D[] = [];
  let flat: Row<GroupNode>[] = [];
  // A model can list thousands of parts, and every row in the page slows each frame, so only rows near the viewport exist.
  const mounted = new Map<number, HTMLElement>();
  let drawing = 0;
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
  const restyle = () => { for (const index of mounted.keys()) mark(mounted.get(index)!, flat[index].node); };
  const activeRow = () => {
    const row = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>('.row') : null;
    return row && sizer.contains(row) ? Number(row.dataset.index) : -1;
  };
  // keep stays mounted outside the window: removing the focused row or a rename field would lose it.
  const draw = (keep = activeRow()) => {
    const [first, last] = rowWindow(tree.scrollTop, tree.clientHeight, flat.length);
    for (const [index, row] of mounted) if ((index < first || index >= last) && index !== keep) { row.remove(); mounted.delete(index); }
    const mount = (index: number) => {
      if (mounted.has(index) || !flat[index]) return;
      const row = createRow(flat[index], index);
      mounted.set(index, row);
      sizer.append(row);
    };
    for (let index = first; index < last; index++) mount(index);
    if (keep >= 0) mount(keep);
  };
  const queueDraw = () => {
    if (drawing) return;
    drawing = requestAnimationFrame(() => { drawing = 0; draw(); });
  };
  const focusRow = (index: number) => {
    if (!flat[index]) return;
    tree.scrollTop = revealRow(tree.scrollTop, tree.clientHeight, index);
    draw(index);
    mounted.get(index)?.focus();
  };
  const createRow = ({node, depth, position, siblings}: Row<GroupNode>, index: number) => {
      const row = document.createElement('div');
      row.className = 'row' + (node.objects[0]?.userData.studioGroup ? ' section' : '');
      row.role = 'treeitem';
      row.tabIndex = -1;
      row.onpointerdown = () => row.focus();
      row.dataset.key = node.key;
      row.dataset.index = String(index);
      row.style.top = `${index * ROW_PITCH}px`;
      row.style.paddingLeft = `${depth * 14}px`;
      row.setAttribute('aria-level', String(depth + 1));
      row.setAttribute('aria-posinset', String(position));
      row.setAttribute('aria-setsize', String(siblings));
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
      return row;
  };
  const paint = (objects: THREE.Object3D[], nodesIn: GroupNode[]) => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('.row')?.dataset.key ?? '' : '';
    const q = query;
    const nodes = nodesIn.map(node => prune(node, q)).filter((node): node is GroupNode => node != null);
    flat = flattenRows(nodes, isOpen);
    mounted.clear();
    sizer.replaceChildren();
    sizer.style.height = `${flat.length * ROW_PITCH}px`;
    tree.querySelector(':scope > p')?.remove();
    if (!flat.length) {
      const empty = document.createElement('p');
      empty.textContent = objects.length ? 'Nothing shown' : 'Empty';
      tree.append(empty);
    }
    const obj = naming;
    naming = null;
    const keep = obj ? flat.findIndex(row => row.node.objects[0] === obj) : focus ? flat.findIndex(row => row.node.key === focus) : -1;
    if (obj && keep >= 0) tree.scrollTop = revealRow(tree.scrollTop, tree.clientHeight, keep);
    draw(keep);
    const row = mounted.get(keep);
    if (obj && row) beginEdit(row, obj);
    else row?.focus();
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
    const index = activeRow();
    const row = flat[index];
    if (!row) return;
    const {node, depth} = row;
    if (event.code === 'ArrowDown') focusRow(Math.min(flat.length - 1, index + 1));
    else if (event.code === 'ArrowUp') focusRow(Math.max(0, index - 1));
    else if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
      if (event.code === 'ArrowRight' && node.children.length && !isOpen(node.key, depth)) toggle(node.key, depth);
      else if (event.code === 'ArrowRight' && node.children.length) focusRow(index + 1);
      else if (event.code === 'ArrowRight') options.frame(node.objects);
      else if (node.children.length && isOpen(node.key, depth)) toggle(node.key, depth);
      else {
        let parent = index - 1;
        while (parent >= 0 && flat[parent].depth >= depth) parent--;
        focusRow(parent);
      }
    } else if (event.code === 'F2') {
      const obj = node.objects[0];
      if (!obj || !userNamed(obj)) return;
      editName(obj);
    } else if (event.code === 'Enter') { fromList = true; options.choose(node.objects, 'set'); }
    else if (event.code === 'Space') {
      fromList = true;
      const visible = node.objects.filter(obj => obj.visible);
      if (visible.length) options.hide(visible); else options.show(node.objects);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const blank = (event: Event) => event.target === tree || event.target === sizer;
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
  tree.addEventListener('scroll', queueDraw, {passive: true});
  const resized = new ResizeObserver(queueDraw);
  resized.observe(tree);
  input.oninput = () => { query = input.value.trim().toLowerCase(); fromList = true; const objects = current(); paint(objects, grouped(objects)); };
  input.addEventListener('keydown', event => { if (event.code === 'ArrowDown') { focusRow(0); event.preventDefault(); } });
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
      if (!fromList && selectedKeys.size) {
        const index = flat.findIndex(row => selectedKeys.has(row.node.key));
        if (index >= 0) { tree.scrollTop = revealRow(tree.scrollTop, tree.clientHeight, index); draw(); }
      }
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
  return {sync, editName, useLayout, layout: () => ({open: [...open], collapsed: [...collapsed]}), dispose() { cancelAnimationFrame(scheduled); cancelAnimationFrame(drawing); resized.disconnect(); tree.removeEventListener('keydown', onKey); options.host.replaceChildren(); }};
}
