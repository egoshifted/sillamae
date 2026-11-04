const scalar = (value: unknown): value is number | string | boolean => ['number', 'string', 'boolean'].includes(typeof value);

export function sameRecord(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function drawRecord(host: HTMLElement, record: Record<string, unknown>, edit: () => void) {
  host.replaceChildren();
  for (const [key, value] of Object.entries(record)) {
    const label = document.createElement('label');
    label.append(Object.assign(document.createElement('span'), {textContent: key}));
    if (typeof value === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = value;
      input.onchange = () => { record[key] = input.checked; edit(); };
      label.append(input);
    } else if (typeof value === 'number') {
      const input = document.createElement('input');
      input.type = 'number'; input.step = 'any'; input.value = String(value);
      input.onchange = () => { const next = Number(input.value); if (Number.isFinite(next)) { record[key] = next; edit(); } };
      label.append(input);
    } else if (typeof value === 'string') {
      const input = document.createElement('input');
      input.type = 'text'; input.value = value;
      input.onchange = () => { record[key] = input.value; edit(); };
      label.append(input);
    } else {
      const input = document.createElement('textarea');
      input.rows = scalar(value) ? 1 : Math.min(8, JSON.stringify(value, null, 2).split('\n').length);
      input.value = JSON.stringify(value, null, 2);
      input.onchange = () => {
        try { record[key] = JSON.parse(input.value); input.classList.remove('bad'); edit(); }
        catch { input.classList.add('bad'); }
      };
      label.append(input);
    }
    host.append(label);
  }
}
