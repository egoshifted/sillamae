import {useEffect} from 'react';
import type {SavedView} from '../engine/camera/controller.ts';
import type {Engine} from '../engine/engine.ts';

const WRITE_MS = 500;
const KEYS = {x: 'x', y: 'y', z: 'z', span: 's', zoom: 'zoom', heading: 'h', elevation: 'e'} as const;

// Before any tile loads, so the linked view streams first.
export function applyViewFromUrl(engine: Engine) {
  const params = new URLSearchParams(location.hash.slice(1));
  const building = engine.buildings.find(b => b.id === params.get('b'));
  const values = Object.entries(KEYS).map(([field, key]) => [field, parseFloat(params.get(key) ?? '')] as const);
  if (values.every(([, v]) => Number.isFinite(v))) engine.camera.view = Object.fromEntries(values) as unknown as SavedView;
  else if (building) engine.focusBuilding(building);
  engine.select(building ?? null);
}

export function useViewUrl(engine: Engine | null) {
  useEffect(() => {
    if (!engine) return;
    const timer = setInterval(() => {
      const view = engine.camera.view, params = new URLSearchParams();
      for (const [field, key] of Object.entries(KEYS)) {
        const value = view[field as keyof SavedView];
        params.set(key, field === 'zoom' ? value.toFixed(3) : value.toFixed(1));
      }
      if (engine.selected) params.set('b', engine.selected.id);
      const hash = '#' + params;
      if (hash !== location.hash) history.replaceState(null, '', hash);
    }, WRITE_MS);
    // Pasting a link into the same tab, or going back, changes only the hash.
    const follow = () => {
      applyViewFromUrl(engine);
      engine.requestRedraw();
    };
    addEventListener('hashchange', follow);
    return () => {
      clearInterval(timer);
      removeEventListener('hashchange', follow);
    };
  }, [engine]);
}
