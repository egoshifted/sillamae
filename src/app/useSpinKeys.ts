import {useEffect} from 'react';
import type {Engine} from '../engine/engine.ts';

const SPIN_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function useSpinKeys(engine: Engine | null) {
  useEffect(() => {
    if (!engine) return;
    const held = new Set<string>();
    const spin = () => {
      const axis = (minus: string, plus: string) => (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);
      engine.camera.spin(axis('KeyA', 'KeyD'), axis('KeyS', 'KeyW'));
    };
    const down = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!SPIN_KEYS.has(e.code) || typing || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      held.add(e.code);
      spin();
    };
    const up = (e: KeyboardEvent) => { if (held.delete(e.code)) spin(); };
    const blur = () => { held.clear(); spin(); };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    return () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('blur', blur);
      blur();
    };
  }, [engine]);
}
