import {translate} from '../i18n.ts';

export function installTips() {
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.dataset.noI18n = '';
  tip.hidden = true;
  document.body.append(tip);
  let timer = 0;
  let current: HTMLElement | null = null;
  const hide = () => {
    window.clearTimeout(timer);
    timer = 0;
    current = null;
    tip.hidden = true;
  };
  const show = (anchor: HTMLElement) => {
    const text = anchor.dataset.tip;
    if (!text) return;
    tip.textContent = translate(text);
    tip.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - box.width / 2, innerWidth - box.width - 8))}px`;
    const below = rect.bottom + 8;
    tip.style.top = `${below + box.height > innerHeight - 8 ? Math.max(8, rect.top - box.height - 8) : below}px`;
  };
  const arm = (anchor: HTMLElement) => {
    if (anchor === current) return;
    hide();
    current = anchor;
    timer = window.setTimeout(() => { if (current === anchor) show(anchor); }, 280);
  };
  const over = (event: PointerEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tip]') : null;
    if (anchor) arm(anchor);
  };
  const out = (event: PointerEvent) => {
    if (!current) return;
    const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-tip]') : null;
    if (next !== current) hide();
  };
  document.addEventListener('pointerover', over);
  document.addEventListener('pointerout', out);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  return () => {
    hide();
    document.removeEventListener('pointerover', over);
    document.removeEventListener('pointerout', out);
    document.removeEventListener('pointerdown', hide, true);
    document.removeEventListener('scroll', hide, true);
    window.removeEventListener('blur', hide);
    tip.remove();
  };
}
