const HOSTS = '#picker, .toolbox, .explorer .tree, .menu-pop, body.site aside, #tools, #views';

function attach(host: HTMLElement) {
  if (host.dataset.scroll != null) return;
  host.dataset.scroll = '';
  const thumb = document.createElement('div');
  thumb.className = 'scroll-thumb';
  thumb.hidden = true;
  document.body.append(thumb);
  const place = () => {
    const rect = host.getBoundingClientRect();
    const max = host.scrollHeight - host.clientHeight;
    if (max <= 1 || rect.width < 8 || rect.height < 24 || host.closest('[hidden]')) { thumb.hidden = true; return; }
    const height = Math.max(28, rect.height * rect.height / host.scrollHeight);
    thumb.hidden = false;
    thumb.style.height = `${height}px`;
    thumb.style.left = `${rect.right - 14}px`;
    thumb.style.top = `${rect.top + host.scrollTop / max * (rect.height - height)}px`;
  };
  host.addEventListener('scroll', place, {passive: true});
  const observer = new ResizeObserver(place);
  observer.observe(host);
  const content = new MutationObserver(place);
  content.observe(host, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});
  thumb.onpointerdown = event => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY, start = host.scrollTop;
    const travel = () => Math.max(1, host.clientHeight - thumb.offsetHeight);
    const max = () => host.scrollHeight - host.clientHeight;
    const move = (next: PointerEvent) => { host.scrollTop = start + (next.clientY - startY) * max() / travel(); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };
  place();
  return () => { observer.disconnect(); content.disconnect(); thumb.remove(); };
}

export function installScrollbars() {
  const seen = new Set<HTMLElement>();
  const scan = (node: ParentNode) => node.querySelectorAll(HOSTS).forEach(host => { if (!(host instanceof HTMLElement) || seen.has(host)) return; seen.add(host); attach(host); });
  scan(document);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) {
      if (node instanceof HTMLElement && node.matches(HOSTS) && !seen.has(node)) { seen.add(node); attach(node); }
      scan(node);
    }
  });
  observer.observe(document.body, {subtree: true, childList: true});
  addEventListener('resize', () => seen.forEach(host => host.dispatchEvent(new Event('scroll'))));
  return () => observer.disconnect();
}
