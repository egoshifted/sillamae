import {useEffect} from 'react';
import type {Engine} from '../engine/engine.ts';
import type {Building} from '../engine/types.ts';

const CLICK_PX = 5, CLICK_MS = 500, DOUBLE_PX = 25, DOUBLE_MS = 400;

// A click or tap selects the building under it; a second one on the same building glides the view to it.
export function useBuildingTaps(engine: Engine | null) {
  useEffect(() => {
    if (!engine) return;
    const canvas = engine.domElement;
    let down: {x: number; y: number; at: number} | null = null;
    let last: {x: number; y: number; at: number; building: Building} | null = null;
    const press = (e: PointerEvent) => { down = e.button === 0 ? {x: e.clientX, y: e.clientY, at: performance.now()} : null; };
    const release = (e: PointerEvent) => {
      const now = performance.now();
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_PX || now - down.at > CLICK_MS) return;
      const picked = engine.pickBuilding(e.clientX, e.clientY);
      engine.select(picked);
      // DOM dblclick is unreliable for touch, so both pointer kinds pair their own taps.
      if (picked && last?.building === picked && now - last.at < DOUBLE_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_PX) {
        engine.glideToBuilding(picked);
        last = null;
      } else last = picked ? {x: e.clientX, y: e.clientY, at: now, building: picked} : null;
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') engine.select(null); };
    canvas.addEventListener('pointerdown', press);
    canvas.addEventListener('pointerup', release);
    addEventListener('keydown', key);
    return () => {
      canvas.removeEventListener('pointerdown', press);
      canvas.removeEventListener('pointerup', release);
      removeEventListener('keydown', key);
    };
  }, [engine]);
}
