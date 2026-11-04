import type {ToolboxItem} from './item.ts';
import {thumbnail} from './thumbnail.ts';

export function mountToolbox(host: HTMLElement, items: ToolboxItem[], choose: (item: ToolboxItem | null) => void) {
  host.replaceChildren(Object.assign(document.createElement('h2'), {textContent: 'Toolbox'}));
  let selected: HTMLButtonElement | null = null;
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'part';
    const name = document.createElement('span');
    name.dataset.noI18n = '';
    name.textContent = item.name;
    button.append(thumbnail(item.create()), name);
    button.onclick = () => {
      const turnOff = selected === button;
      selected?.classList.remove('on');
      selected = turnOff ? null : button;
      selected?.classList.add('on');
      choose(turnOff ? null : item);
    };
    host.append(button);
  }
}
