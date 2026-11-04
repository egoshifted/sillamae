// event.code is the physical key, so ЙЦУКЕН still drives the same controls as QWERTY.
export function physicalKey(event: {code: string; key: string}) {
  if (event.code.startsWith('Key') && event.code.length === 4) return event.code.slice(3).toLowerCase();
  const named: Record<string, string> = {
    Space: ' ', Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter',
    Delete: 'delete', Backspace: 'backspace', Home: 'home',
    ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
  };
  return named[event.code] ?? event.key.toLowerCase();
}
