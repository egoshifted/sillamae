import {russian, russianTemplates} from './russian.ts';

export type Language = 'en' | 'ru';
const KEY = 'studio:language';
let language: Language = 'en';
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = russianTemplates.map(([source, target]) => ({
  source, target, pattern: new RegExp('^' + source.split(/\{\d+\}/).map(escape).join('(.+?)') + '$'),
}));

export function translate(text: string, lang: Language = language): string {
  if (lang === 'en' || !text.trim()) return text;
  const source = text.trim();
  let result = russian[source];
  if (!result) {
    const candidates = source.includes(' · ') ? templates.filter(t => t.source.includes(' · ')) : templates;
    for (const {pattern, target} of candidates) {
      const match = source.match(pattern);
      if (match) { result = target.replace(/\{(\d+)\}/g, (_, n: string) => translate(match[Number(n) + 1], lang)); break; }
    }
  }
  if (!result) {
    const separator = source.includes(' · ') ? ' · ' : source.includes(', ') ? ', ' : null;
    if (separator) result = source.split(separator).map(part => translate(part, lang)).join(separator);
    else if (/^[\d. ×]+ m$/.test(source)) result = source.replace(/ m$/, ' м');
    else result = source;
  }
  return text.slice(0, text.indexOf(source)) + result + text.slice(text.indexOf(source) + source.length);
}

export function installLanguage() {
  const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
  language = saved === 'ru' ? 'ru' : 'en';
  const records = new WeakMap<Node, Map<string, {source: string; rendered: string}>>();
  const attributes = ['title', 'aria-label', 'placeholder', 'alt'];
  const control = document.createElement('button');
  control.type = 'button'; control.className = 'bar-icon language'; control.dataset.noI18n = '';
  control.innerHTML = '<i class="fa-solid fa-language" aria-hidden="true"></i><span></span>';
  const code = control.querySelector('span')!;
  (document.getElementById('language-slot') ?? document.querySelector('header'))?.append(control);
  const update = (node: Node, key: string, current: string, write: (value: string) => void) => {
    let entries = records.get(node);
    if (!entries) records.set(node, entries = new Map());
    const previous = entries.get(key), source = previous?.rendered === current ? previous.source : current;
    const rendered = translate(source);
    entries.set(key, {source, rendered});
    if (current !== rendered) write(rendered);
  };
  const localize = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    if (element?.closest('script, style, textarea, [contenteditable], [data-no-i18n]')) return;
    if (node instanceof Text) update(node, 'text', node.data, value => { node.data = value; });
    else if (node instanceof Element) {
      for (const name of attributes) {
        const value = node.getAttribute(name);
        if (value !== null) update(node, name, value, translated => node.setAttribute(name, translated));
      }
      for (const child of node.childNodes) localize(child);
    }
  };
  const apply = (next: Language) => {
    language = next; code.textContent = next === 'ru' ? 'RU' : 'EN';
    control.setAttribute('aria-label', next === 'ru' ? 'Язык' : 'Language');
    document.documentElement.lang = next;
    localize(document.documentElement);
  };
  // Text nodes keep their English source so switching language never rebuilds the editor or loses a draft.
  const observer = new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'childList') for (const node of change.addedNodes) localize(node);
      else localize(change.target);
    }
  });
  apply(language);
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes});
  control.onclick = () => {
    const next = language === 'ru' ? 'en' : 'ru';
    try { localStorage.setItem(KEY, next); } catch { /* Language switching also works when storage is disabled. */ }
    apply(next);
  };
  const storage = (event: StorageEvent) => { if (event.key === KEY) apply(event.newValue === 'ru' ? 'ru' : 'en'); };
  window.addEventListener('storage', storage);
  return () => { observer.disconnect(); window.removeEventListener('storage', storage); control.remove(); };
}
