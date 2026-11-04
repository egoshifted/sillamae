const valueOf = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!;
const pops = new WeakMap<HTMLSelectElement, HTMLElement>();
const buttons = new WeakMap<HTMLSelectElement, HTMLButtonElement>();
let open: HTMLSelectElement | null = null;

function paint(select: HTMLSelectElement) {
  const pop = pops.get(select), button = buttons.get(select);
  if (!pop || !button) return;
  const label = button.querySelector('.menu-label');
  const chosen = valueOf.get!.call(select) as string;
  pop.replaceChildren();
  for (const option of select.options) {
    if (option.hidden || option.disabled) continue;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'menu-option';
    item.role = 'option';
    item.textContent = option.text;
    const on = option.value === chosen;
    item.setAttribute('aria-selected', String(on));
    if (on) item.classList.add('on');
    item.onclick = () => {
      shut(select);
      if (valueOf.get!.call(select) !== option.value) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', {bubbles: true}));
      }
    };
    pop.append(item);
  }
  if (label) label.textContent = select.selectedOptions[0]?.text ?? '';
  button.disabled = select.disabled;
}

function place(select: HTMLSelectElement) {
  const button = buttons.get(select), pop = pops.get(select);
  if (!button || !pop) return;
  pop.hidden = false;
  const rect = button.getBoundingClientRect();
  pop.style.minWidth = `${Math.max(rect.width, 180)}px`;
  const width = pop.offsetWidth, height = pop.offsetHeight;
  const below = rect.bottom + 6;
  pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
  pop.style.top = `${below + height > innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below}px`;
}

function shut(select?: HTMLSelectElement) {
  const current = select ?? open;
  if (!current) return;
  const pop = pops.get(current);
  if (pop) pop.hidden = true;
  buttons.get(current)?.setAttribute('aria-expanded', 'false');
  if (open === current) open = null;
}

function show(select: HTMLSelectElement) {
  const button = buttons.get(select);
  if (!button || button.disabled) return;
  if (open === select) { shut(select); return; }
  shut();
  paint(select);
  open = select;
  button.setAttribute('aria-expanded', 'true');
  place(select);
}

function enhance(select: HTMLSelectElement) {
  if (select.dataset.menu != null || select.hidden || select.multiple) return;
  select.dataset.menu = '';
  const wrap = document.createElement('span');
  wrap.className = 'menu';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const labelled = select.getAttribute('aria-label');
  if (labelled) button.setAttribute('aria-label', labelled);
  if (select.title) button.title = select.title;
  const label = document.createElement('span');
  label.className = 'menu-label';
  const caret = document.createElement('i');
  caret.className = 'fa-solid fa-chevron-down caret';
  caret.setAttribute('aria-hidden', 'true');
  button.append(label, caret);
  const pop = document.createElement('div');
  pop.className = 'menu-pop';
  pop.role = 'listbox';
  pop.hidden = true;
  select.classList.add('menu-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.before(wrap);
  wrap.append(button, select);
  document.body.append(pop);
  pops.set(select, pop);
  buttons.set(select, button);
  Object.defineProperty(select, 'value', {
    configurable: true,
    get() { return valueOf.get!.call(this); },
    set(next: string) { valueOf.set!.call(this, next); paint(select); },
  });
  paint(select);
  button.onclick = () => show(select);
  button.onkeydown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Space', 'Escape'].includes(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') { shut(select); return; }
    if (pop.hidden) show(select);
    const items = [...pop.querySelectorAll<HTMLButtonElement>('.menu-option')];
    if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
      const index = items.findIndex(item => item.classList.contains('at'));
      const from = index >= 0 ? index : items.findIndex(item => item.classList.contains('on'));
      const next = items[Math.max(0, Math.min(items.length - 1, (from < 0 ? 0 : from) + (event.code === 'ArrowDown' ? 1 : -1)))];
      for (const item of items) item.classList.toggle('at', item === next);
      next?.scrollIntoView({block: 'nearest'});
      return;
    }
    (items.find(item => item.classList.contains('at')) ?? items.find(item => item.classList.contains('on')))?.click();
  };
}

export function installMenus() {
  const known = new Set<HTMLSelectElement>();
  const take = (select: HTMLSelectElement) => { if (known.has(select)) return; known.add(select); enhance(select); };
  const scan = (node: Node) => {
    if (node instanceof HTMLSelectElement) take(node);
    else if (node instanceof Element) node.querySelectorAll('select').forEach(select => take(select));
  };
  scan(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const host = record.target instanceof HTMLSelectElement ? record.target : record.target.parentElement?.closest('select');
      if (host instanceof HTMLSelectElement && known.has(host)) paint(host);
      for (const node of record.addedNodes) scan(node);
    }
  });
  observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['label', 'disabled', 'hidden', 'value']});
  const away = (event: Event) => {
    if (!open) return;
    const target = event.target as Node | null;
    if (target && (open.parentElement?.contains(target) || pops.get(open)?.contains(target))) return;
    shut();
  };
  addEventListener('pointerdown', away, true);
  addEventListener('keydown', event => { if (event.code === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); shut(); } });
  return () => { observer.disconnect(); removeEventListener('pointerdown', away, true); shut(); };
}
