export interface MenuItem {label: string; shortcut?: string; enabled: boolean; run(): void; gap?: boolean}

export function mountContextMenu(items: () => MenuItem[]) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.hidden = true;
  document.body.append(menu);
  const close = () => { menu.hidden = true; };
  const open = (x: number, y: number) => {
    menu.replaceChildren();
    for (const item of items()) {
      if (item.gap) { const rule = document.createElement('div'); rule.className = 'sep'; menu.append(rule); continue; }
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = !item.enabled;
      button.append(document.createTextNode(item.label));
      if (item.shortcut) button.append(Object.assign(document.createElement('kbd'), {textContent: item.shortcut}));
      button.onclick = () => { close(); item.run(); };
      menu.append(button);
    }
    const fit = () => {
      const measure = document.createElement('div');
      measure.className = 'context-menu';
      measure.dataset.noI18n = '';
      measure.style.visibility = 'hidden';
      measure.style.minWidth = '0';
      measure.style.width = 'max-content';
      measure.style.left = '0px';
      measure.style.top = '0px';
      for (const button of menu.querySelectorAll('button')) {
        const clone = button.cloneNode(true) as HTMLButtonElement;
        clone.style.width = 'max-content';
        clone.style.minWidth = '0';
        measure.append(clone);
      }
      document.body.append(measure);
      const width = Math.ceil(measure.getBoundingClientRect().width);
      measure.remove();
      menu.style.width = `${Math.min(Math.max(width, 196), window.innerWidth - 8)}px`;
      const fitted = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - fitted.width - 4))}px`;
      menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - fitted.height - 4))}px`;
      const box = menu.getBoundingClientRect();
      if (box.right > window.innerWidth - 4) menu.style.left = `${Math.max(4, window.innerWidth - box.width - 4)}px`;
      if (box.bottom > window.innerHeight - 4) menu.style.top = `${Math.max(4, window.innerHeight - box.height - 4)}px`;
    };
    menu.hidden = false;
    menu.style.left = '0px';
    menu.style.top = '0px';
    fit();
    // Language replacement runs after this call and can make the labels wider.
    queueMicrotask(() => { if (!menu.hidden) fit(); });
  };
  const outside = (event: PointerEvent) => { if (!menu.hidden && event.target instanceof Node && !menu.contains(event.target)) close(); };
  addEventListener('pointerdown', outside, true);
  return {open, close, visible: () => !menu.hidden, dispose() { removeEventListener('pointerdown', outside, true); menu.remove(); }};
}
